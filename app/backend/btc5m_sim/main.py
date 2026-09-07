"""FastAPI app: REST control + WebSocket live stream for the paper simulator."""
from __future__ import annotations

import asyncio
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import db, market_data as md
from .engine import SimEngine
from .models import Preset, SimConfig, SimEvent

MAX_EVENTS = 600
MAX_EQUITY_POINTS = 2000


class SessionManager:
    def __init__(self) -> None:
        self.engine: Optional[SimEngine] = None
        self.session_id: Optional[str] = None
        self.task: Optional[asyncio.Task] = None
        self.events: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)
        self.equity: deque[dict[str, Any]] = deque(maxlen=MAX_EQUITY_POINTS)
        self.sockets: set[WebSocket] = set()
        self._stop = False

    def is_running(self) -> bool:
        return self.engine is not None and not self.engine.finished and self.task is not None

    async def broadcast(self, payload: dict[str, Any]) -> None:
        dead = []
        for ws in list(self.sockets):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.sockets.discard(ws)

    async def _emit(self, event: SimEvent) -> None:
        d = event.model_dump()
        self.events.append(d)
        await self.broadcast({"kind": "event", "event": d})

    async def _emit_status(self) -> None:
        assert self.engine is not None
        status = self.engine.status()
        point = {
            "t": int(time.time() * 1000),
            "equity": status.equity,
            "balance": status.balance,
            "pnl": status.kpis.total_pnl,
        }
        self.equity.append(point)
        await self.broadcast({"kind": "status", "status": status.model_dump(), "point": point})

    async def start(self, config: SimConfig) -> None:
        if self.is_running():
            await self.stop()
        self.engine = SimEngine(config)
        self.session_id = uuid.uuid4().hex
        self.events.clear()
        self.equity.clear()
        self._stop = False
        self.task = asyncio.create_task(self._run())

    async def _run(self) -> None:
        assert self.engine is not None
        await self._emit(SimEvent(type="INFO", message="paper session started"))
        await self._emit_status()
        try:
            while not self._stop and not self.engine.finished:
                events = await asyncio.to_thread(self.engine.tick)
                for ev in events:
                    await self._emit(ev)
                    if ev.type == "CLOSE" and self.session_id:
                        try:
                            from .models import Trade
                            db.record_trade(self.session_id, Trade(**ev.data))
                        except Exception:
                            pass
                await self._emit_status()
                if self.engine.finished:
                    break
                await asyncio.sleep(self.engine.config.poll_sec)
        except asyncio.CancelledError:
            pass
        finally:
            if self.engine and not self.engine.finished:
                self.engine.finished_reason = "stopped"
                await self._emit(SimEvent(type="SUMMARY", message="session stopped",
                                          data={"reason": "stopped",
                                                "kpis": self.engine.kpis.model_dump(),
                                                "balance": self.engine.balance}))
            await self._emit_status()

    async def stop(self) -> None:
        self._stop = True
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except Exception:
                pass
            self.task = None

    def snapshot(self) -> dict[str, Any]:
        status = self.engine.status().model_dump() if self.engine else None
        return {
            "kind": "snapshot",
            "status": status,
            "events": list(self.events),
            "equity": list(self.equity),
            "session_id": self.session_id,
        }


manager = SessionManager()
app = FastAPI(title="BTC 5m Paper Simulator")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True, "running": manager.is_running()}


@app.get("/api/config/defaults", response_model=SimConfig)
def config_defaults() -> SimConfig:
    return SimConfig()


@app.get("/api/market/current")
def market_current() -> dict[str, Any]:
    m = md.resolve_current_market()
    if m is None:
        return {"available": False}
    try:
        up = md.fetch_order_book(m.up_token)
        dn = md.fetch_order_book(m.dn_token)
    except Exception as e:
        raise HTTPException(502, f"order book fetch failed: {e}")
    return {
        "available": True, "slug": m.slug, "seconds_left": m.seconds_left(),
        "up_ask": up.best_ask, "dn_ask": dn.best_ask,
        "up_bid": up.best_bid, "dn_bid": dn.best_bid,
        "gamma_up": m.gamma_up, "gamma_dn": m.gamma_dn,
    }


@app.get("/api/session/status")
def session_status() -> dict[str, Any]:
    if manager.engine is None:
        return {"running": False, "state": "FLAT"}
    return manager.engine.status().model_dump()


@app.post("/api/session/start")
async def session_start(config: SimConfig) -> dict[str, Any]:
    await manager.start(config)
    return {"ok": True, "session_id": manager.session_id}


@app.post("/api/session/stop")
async def session_stop() -> dict[str, Any]:
    await manager.stop()
    return {"ok": True}


@app.get("/api/session/trades")
def session_trades() -> dict[str, Any]:
    live = [t.model_dump() for t in manager.engine.trades] if manager.engine else []
    return {"live": live, "history": db.recent_trades()}


@app.get("/api/presets")
def get_presets() -> list[Preset]:
    return db.list_presets()


@app.post("/api/presets")
def post_preset(preset: Preset) -> Preset:
    return db.save_preset(preset.name, preset.config)


@app.delete("/api/presets/{preset_id}")
def del_preset(preset_id: int) -> dict[str, Any]:
    db.delete_preset(preset_id)
    return {"ok": True}


@app.websocket("/ws")
async def ws(websocket: WebSocket) -> None:
    await websocket.accept()
    manager.sockets.add(websocket)
    try:
        await websocket.send_json(manager.snapshot())
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.sockets.discard(websocket)


# Serve the built frontend (if present) as static files at the root.
_frontend_dist = Path(__file__).resolve().parents[1].parent / "frontend" / "dist"
if _frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")


def run() -> None:
    import uvicorn
    uvicorn.run("btc5m_sim.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    run()
