"""Execution-realism helpers: latency, order-book slippage, partial fills, fees.

These turn the naive "fill the whole size at the top-of-book price instantly"
assumption into something much closer to how a real taker order behaves.
"""
from __future__ import annotations

import random
from dataclasses import dataclass

from .market_data import Level


@dataclass
class Fill:
    avg_price: float
    shares: float
    notional: float  # USDC spent (buy) or received before fees (sell)
    filled_ratio: float  # 0..1 of the intended size
    fee: float = 0.0


def sample_latency_sec(latency_min_ms: int, latency_max_ms: int) -> float:
    lo = max(0, int(latency_min_ms))
    hi = max(lo, int(latency_max_ms))
    return random.randint(lo, hi) / 1000.0


def taker_fee(shares: float, price: float, fee_rate: float) -> float:
    """Polymarket taker fee: fee = shares * feeRate * p * (1 - p) (crypto rate = 0.07)."""
    p = min(max(price, 0.0), 1.0)
    return max(0.0, shares * fee_rate * p * (1.0 - p))


def buy_notional(
    asks: list[Level],
    notional: float,
    *,
    max_price: float = 1.0,
    use_book: bool = True,
    fee_rate: float = 0.0,
) -> Fill:
    """Spend up to `notional` USDC buying shares, walking asks (cheapest first).

    - use_book=False collapses to a single top-of-book fill (idealized).
    - Stops at `max_price` (FAK-style price protection) or when book is exhausted,
      producing a partial fill.
    """
    if not asks:
        return Fill(0.0, 0.0, 0.0, 0.0, 0.0)

    if not use_book:
        price = asks[0].price
        if price > max_price:
            return Fill(price, 0.0, 0.0, 0.0, 0.0)
        shares = notional / price if price > 0 else 0.0
        fee = taker_fee(shares, price, fee_rate)
        return Fill(price, shares, notional, 1.0, fee)

    remaining = float(notional)
    shares = 0.0
    spent = 0.0
    for lv in asks:
        if lv.price > max_price or remaining <= 1e-9:
            break
        level_notional = lv.price * lv.size
        take_notional = min(remaining, level_notional)
        take_shares = take_notional / lv.price if lv.price > 0 else 0.0
        shares += take_shares
        spent += take_notional
        remaining -= take_notional

    if shares <= 0:
        return Fill(asks[0].price, 0.0, 0.0, 0.0, 0.0)
    avg = spent / shares
    fee = taker_fee(shares, avg, fee_rate)
    filled_ratio = spent / notional if notional > 0 else 0.0
    return Fill(avg, shares, spent, min(1.0, filled_ratio), fee)


def sell_shares(
    bids: list[Level],
    shares: float,
    *,
    min_price: float = 0.0,
    use_book: bool = True,
    fee_rate: float = 0.0,
) -> Fill:
    """Sell up to `shares`, walking bids (highest first).

    - use_book=False collapses to a single top-of-book fill (idealized).
    - Stops at `min_price` or when book is exhausted (partial fill).
    """
    if not bids or shares <= 0:
        return Fill(bids[0].price if bids else 0.0, 0.0, 0.0, 0.0, 0.0)

    if not use_book:
        price = bids[0].price
        if price < min_price:
            return Fill(price, 0.0, 0.0, 0.0, 0.0)
        proceeds = shares * price
        fee = taker_fee(shares, price, fee_rate)
        return Fill(price, shares, proceeds, 1.0, fee)

    remaining = float(shares)
    sold = 0.0
    proceeds = 0.0
    for lv in bids:
        if lv.price < min_price or remaining <= 1e-9:
            break
        take = min(remaining, lv.size)
        sold += take
        proceeds += take * lv.price
        remaining -= take

    if sold <= 0:
        return Fill(bids[0].price, 0.0, 0.0, 0.0, 0.0)
    avg = proceeds / sold
    fee = taker_fee(sold, avg, fee_rate)
    filled_ratio = sold / shares if shares > 0 else 0.0
    return Fill(avg, sold, proceeds, min(1.0, filled_ratio), fee)
