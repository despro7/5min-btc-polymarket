"""Pydantic models for config, events, trades, and status."""
from __future__ import annotations

import datetime as dt
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

UTC = dt.timezone.utc


def ts_iso() -> str:
    return dt.datetime.now(UTC).isoformat().replace("+00:00", "Z")


class RealismConfig(BaseModel):
    """Toggles that make paper fills behave like real execution."""
    enabled: bool = Field(True, description="Master switch for realistic execution")
    latency_min_ms: int = Field(300, ge=0, description="Min decision->fill latency")
    latency_max_ms: int = Field(1200, ge=0, description="Max decision->fill latency")
    slippage: bool = Field(True, description="Walk the order book (VWAP) instead of filling at top price")
    partial_fills: bool = Field(True, description="Allow partial fills when book depth is thin")
    force_close: bool = Field(True, description="Model the aggressive escalating force-close on exit")
    fee_rate: float = Field(0.07, ge=0, description="Polymarket taker fee rate (crypto=0.07). fee = shares*rate*p*(1-p)")


class SimConfig(BaseModel):
    profile: Literal["conservative", "aggressive", "custom"] = "conservative"
    threshold: float = Field(0.70, ge=0.0, le=1.0)
    stake_usd: float = Field(5.0, gt=0)
    stop_loss_pct: float = Field(0.25, ge=0.0, le=1.0)
    exit_before_sec: int = Field(20, ge=0)
    min_entry_seconds_left: int = Field(60, ge=0, description="Do not open if FEWER than N seconds remain (too late)")
    max_entry_seconds_left: int = Field(0, ge=0, description="Do not open if MORE than N seconds remain (too early). 0 = off")
    poll_sec: float = Field(5.0, gt=0.5)
    start_balance: float = Field(100.0, gt=0)
    # Risk limits (actually enforced here, unlike the original CLI)
    max_trades_per_session: int = Field(0, ge=0, description="0 = unlimited")
    daily_max_loss: float = Field(0.0, ge=0, description="Stop session if realized loss reaches this (USDC). 0 = off")
    run_min: float = Field(0.0, ge=0, description="Auto-stop after N minutes. 0 = run until stopped")
    realism: RealismConfig = RealismConfig()


class Position(BaseModel):
    market_slug: str
    side: Literal["UP", "DOWN"]
    token_id: str
    entry_price: float
    shares: float
    cost: float
    entry_fee: float
    stop_price: float
    opened_at: str
    filled_ratio: float = 1.0
    end_ts: float


class Trade(BaseModel):
    id: int
    market_slug: str
    side: Literal["UP", "DOWN"]
    entry_price: float
    exit_price: float
    shares: float
    cost: float
    proceeds: float
    entry_fee: float
    exit_fee: float
    fees: float
    pnl: float
    filled_ratio: float
    close_reason: str
    opened_at: str
    closed_at: str


class Kpis(BaseModel):
    trades: int = 0
    wins: int = 0
    losses: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    fees_paid: float = 0.0
    max_drawdown: float = 0.0


class MarketSnapshot(BaseModel):
    slug: Optional[str] = None
    seconds_left: Optional[float] = None
    up_ask: Optional[float] = None
    dn_ask: Optional[float] = None
    up_bid: Optional[float] = None
    dn_bid: Optional[float] = None
    spread: Optional[float] = None


class SessionStatus(BaseModel):
    running: bool
    state: Literal["FLAT", "IN_POSITION"] = "FLAT"
    finished_reason: Optional[str] = None
    balance: float = 0.0
    equity: float = 0.0
    unrealized_pnl: float = 0.0
    started_at: Optional[str] = None
    config: Optional[SimConfig] = None
    position: Optional[Position] = None
    market: MarketSnapshot = MarketSnapshot()
    kpis: Kpis = Kpis()


class SimEvent(BaseModel):
    ts: str = Field(default_factory=ts_iso)
    type: Literal["WATCH", "OPEN", "HOLD", "CLOSE", "INFO", "SUMMARY", "STATUS", "ERROR"]
    message: str = ""
    data: dict[str, Any] = Field(default_factory=dict)


class Preset(BaseModel):
    id: Optional[int] = None
    name: str
    config: SimConfig
