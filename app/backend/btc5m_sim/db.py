"""Minimal SQLite persistence for settings presets and completed trades."""
from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Optional

from .models import Preset, SimConfig, Trade

_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "btc5m_sim.db"
_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(_DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _lock, _conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                config TEXT NOT NULL
            )"""
        )
        c.execute(
            """CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                trade TEXT NOT NULL,
                closed_at TEXT NOT NULL
            )"""
        )


def list_presets() -> list[Preset]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT id, name, config FROM presets ORDER BY name").fetchall()
    return [Preset(id=r["id"], name=r["name"], config=SimConfig(**json.loads(r["config"]))) for r in rows]


def save_preset(name: str, config: SimConfig) -> Preset:
    with _lock, _conn() as c:
        cur = c.execute(
            "INSERT INTO presets(name, config) VALUES(?, ?) "
            "ON CONFLICT(name) DO UPDATE SET config=excluded.config RETURNING id",
            (name, config.model_dump_json()),
        )
        pid = cur.fetchone()["id"]
    return Preset(id=pid, name=name, config=config)


def delete_preset(preset_id: int) -> None:
    with _lock, _conn() as c:
        c.execute("DELETE FROM presets WHERE id=?", (preset_id,))


def record_trade(session_id: str, trade: Trade) -> None:
    with _lock, _conn() as c:
        c.execute(
            "INSERT INTO trades(session_id, trade, closed_at) VALUES(?, ?, ?)",
            (session_id, trade.model_dump_json(), trade.closed_at),
        )


def recent_trades(limit: int = 200) -> list[dict[str, Any]]:
    with _lock, _conn() as c:
        rows = c.execute(
            "SELECT trade FROM trades ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [json.loads(r["trade"]) for r in rows]
