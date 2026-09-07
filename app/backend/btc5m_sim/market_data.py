"""Read-only access to public Polymarket data (Gamma + CLOB REST).

No credentials and no py-clob-client are needed: the paper simulator only reads
public market metadata and order books. Keeping this behind a small interface
makes the data source easy to swap later (e.g. a different transport).
"""
from __future__ import annotations

import datetime as dt
import json
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import requests

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"
UTC = dt.timezone.utc

_session = requests.Session()
_session.headers.update({"User-Agent": "btc5m-paper-sim/0.1"})


def now_ts() -> float:
    return time.time()


def bucket_5m(ts: Optional[float] = None) -> int:
    t = int(ts if ts is not None else time.time())
    return t - (t % 300)


def current_slug(ts: Optional[float] = None) -> str:
    return f"btc-updown-5m-{bucket_5m(ts)}"


@dataclass
class Level:
    price: float
    size: float


@dataclass
class OrderBook:
    token_id: str
    bids: list[Level] = field(default_factory=list)  # sorted best (highest) first
    asks: list[Level] = field(default_factory=list)  # sorted best (lowest) first

    @property
    def best_bid(self) -> Optional[float]:
        return self.bids[0].price if self.bids else None

    @property
    def best_ask(self) -> Optional[float]:
        return self.asks[0].price if self.asks else None

    @property
    def spread(self) -> Optional[float]:
        if self.best_bid is None or self.best_ask is None:
            return None
        return max(0.0, self.best_ask - self.best_bid)


@dataclass
class Market:
    slug: str
    end_ts: float
    up_token: str
    dn_token: str
    gamma_up: Optional[float]
    gamma_dn: Optional[float]

    def seconds_left(self, ts: Optional[float] = None) -> float:
        return max(0.0, self.end_ts - (ts if ts is not None else time.time()))


def _parse_json_field(v: Any) -> Any:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except Exception:
            return v
    return v


def fetch_event(slug: str, timeout: float = 12.0) -> Optional[dict[str, Any]]:
    r = _session.get(f"{GAMMA_BASE}/events", params={"slug": slug}, timeout=timeout)
    r.raise_for_status()
    arr = r.json()
    return arr[0] if arr else None


def resolve_current_market(ts: Optional[float] = None) -> Optional[Market]:
    """Resolve the active BTC 5m market for the current slot, or None."""
    slug = current_slug(ts)
    try:
        ev = fetch_event(slug)
    except Exception:
        return None
    if not ev:
        return None
    mkts = ev.get("markets") or []
    if not mkts:
        return None
    m = mkts[0]
    if m.get("closed") is True or m.get("active") is False:
        return None

    end_iso = str(m.get("endDate") or m.get("endDateIso") or "")
    try:
        end_ts = dt.datetime.fromisoformat(end_iso.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None
    if end_ts - time.time() <= 3:
        return None

    outcomes = _parse_json_field(m.get("outcomes")) or []
    prices = _parse_json_field(m.get("outcomePrices")) or []
    token_ids = _parse_json_field(m.get("clobTokenIds")) or []
    if len(token_ids) < 2:
        return None

    up_i, dn_i = 0, 1
    labs = [str(x).lower() for x in outcomes[:2]] if isinstance(outcomes, list) else []
    if len(labs) >= 2 and ("up" in labs[1] or "yes" in labs[1]):
        up_i, dn_i = 1, 0

    def _price(i: int) -> Optional[float]:
        try:
            return float(prices[i])
        except Exception:
            return None

    return Market(
        slug=slug,
        end_ts=end_ts,
        up_token=str(token_ids[up_i]),
        dn_token=str(token_ids[dn_i]),
        gamma_up=_price(up_i),
        gamma_dn=_price(dn_i),
    )


def fetch_order_book(token_id: str, timeout: float = 12.0) -> OrderBook:
    r = _session.get(f"{CLOB_BASE}/book", params={"token_id": token_id}, timeout=timeout)
    r.raise_for_status()
    data = r.json() or {}
    bids = [Level(float(x["price"]), float(x["size"])) for x in (data.get("bids") or [])]
    asks = [Level(float(x["price"]), float(x["size"])) for x in (data.get("asks") or [])]
    # Normalize ordering: best bid = highest price first, best ask = lowest price first.
    bids.sort(key=lambda lv: lv.price, reverse=True)
    asks.sort(key=lambda lv: lv.price)
    return OrderBook(token_id=str(token_id), bids=bids, asks=asks)
