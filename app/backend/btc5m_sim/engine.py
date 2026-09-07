"""Tick-based paper-trading simulation engine.

The engine is deliberately transport-agnostic: it exposes a single `tick()`
method that performs one poll/decision step and returns the events it emitted.
A scheduler (the FastAPI session loop) calls `tick()` every `poll_sec`. Keeping
the loop external (instead of a `while True` inside) makes it easy to test and
to port the scheduler later without touching strategy logic.
"""
from __future__ import annotations

import time
from typing import Optional

from . import market_data as md
from . import realism
from .models import (
    Kpis,
    MarketSnapshot,
    Position,
    SimConfig,
    SimEvent,
    SessionStatus,
    Trade,
    ts_iso,
)

MAX_BUY_PRICE = 0.99  # never pay more than this per share (price protection)
FORCE_MIN_PRICE = 0.01  # aggressive force-close accepts selling down to here


class SimEngine:
    def __init__(self, config: SimConfig):
        self.config = config
        self.balance = float(config.start_balance)
        self.state = "FLAT"
        self.position: Optional[Position] = None
        self.trades: list[Trade] = []
        self.kpis = Kpis()
        self.finished_reason: Optional[str] = None
        self.started_at = ts_iso()
        self._deadline = time.time() + config.run_min * 60.0 if config.run_min else None
        self._peak_balance = float(config.start_balance)
        self._last_market = MarketSnapshot()
        self._trade_seq = 0

    # ---- effective realism flags ----
    @property
    def _use_book(self) -> bool:
        return self.config.realism.enabled and self.config.realism.slippage

    @property
    def _partial(self) -> bool:
        return self.config.realism.enabled and self.config.realism.partial_fills

    @property
    def _force(self) -> bool:
        return self.config.realism.enabled and self.config.realism.force_close

    @property
    def _fee_rate(self) -> float:
        return float(self.config.realism.fee_rate)

    def _latency(self) -> float:
        if not self.config.realism.enabled:
            return 0.0
        return realism.sample_latency_sec(
            self.config.realism.latency_min_ms, self.config.realism.latency_max_ms
        )

    @property
    def finished(self) -> bool:
        return self.finished_reason is not None

    # ---- main step ----
    def tick(self) -> list[SimEvent]:
        events: list[SimEvent] = []
        if self.finished:
            return events

        if self._deadline is not None and time.time() >= self._deadline:
            # flatten any open position before ending
            if self.state == "IN_POSITION":
                events += self._close_position("session_time_ended")
            self._finish("run_min_reached", events)
            return events

        try:
            market = md.resolve_current_market()
        except Exception as e:
            events.append(SimEvent(type="ERROR", message=f"market fetch failed: {e}"))
            return events

        if market is None:
            events.append(SimEvent(type="INFO", message="no active current 5m market"))
            return events

        sec_left = market.seconds_left()

        # ---- manage open position ----
        if self.state == "IN_POSITION" and self.position is not None:
            if self.position.market_slug != market.slug:
                events += self._close_position("slot_rolled")
            else:
                events += self._manage_position(market, sec_left)
                return events

        # ---- look for entry ----
        events += self._look_for_entry(market, sec_left)
        return events

    def _manage_position(self, market: md.Market, sec_left: float) -> list[SimEvent]:
        assert self.position is not None
        pos = self.position
        try:
            book = md.fetch_order_book(pos.token_id)
        except Exception as e:
            return [SimEvent(type="ERROR", message=f"book fetch failed: {e}")]
        cur_bid = book.best_bid if book.best_bid is not None else pos.entry_price
        self._update_market_snapshot(market)

        reason = None
        if sec_left <= self.config.exit_before_sec:
            reason = f"time_exit_{self.config.exit_before_sec}s"
        elif cur_bid <= pos.stop_price:
            reason = f"stop_loss_{int(self.config.stop_loss_pct * 100)}pct"

        if reason:
            return self._close_position(reason, book=book)

        unreal = pos.shares * cur_bid - pos.cost
        return [SimEvent(
            type="HOLD",
            message=f"{pos.side} {pos.market_slug} bid={cur_bid:.3f} sec_left={sec_left:.0f}",
            data={
                "side": pos.side, "slug": pos.market_slug, "entry": pos.entry_price,
                "cur_bid": cur_bid, "stop": pos.stop_price, "seconds_left": sec_left,
                "unrealized_pnl": round(unreal, 4),
            },
        )]

    def _look_for_entry(self, market: md.Market, sec_left: float) -> list[SimEvent]:
        events: list[SimEvent] = []
        # risk limits
        cfg = self.config
        if cfg.max_trades_per_session and self.kpis.trades >= cfg.max_trades_per_session:
            self._finish("max_trades_reached", events)
            return events
        if cfg.daily_max_loss and self.kpis.total_pnl <= -abs(cfg.daily_max_loss):
            self._finish("daily_max_loss_reached", events)
            return events
        if self.balance < cfg.stake_usd:
            self._finish("insufficient_balance", events)
            return events

        try:
            up_book = md.fetch_order_book(market.up_token)
            dn_book = md.fetch_order_book(market.dn_token)
        except Exception as e:
            return [SimEvent(type="ERROR", message=f"book fetch failed: {e}")]

        up_ask, dn_ask = up_book.best_ask, dn_book.best_ask
        self._last_market = MarketSnapshot(
            slug=market.slug, seconds_left=sec_left,
            up_ask=up_ask, dn_ask=dn_ask,
            up_bid=up_book.best_bid, dn_bid=dn_book.best_bid,
            spread=up_book.spread,
        )
        events.append(SimEvent(
            type="WATCH",
            message=f"{market.slug} up_ask={up_ask} dn_ask={dn_ask} sec_left={sec_left:.0f}",
            data={
                "slug": market.slug, "seconds_left": sec_left,
                "up_ask": up_ask, "dn_ask": dn_ask,
                "up_bid": up_book.best_bid, "dn_bid": dn_book.best_bid,
            },
        ))

        if sec_left < cfg.min_entry_seconds_left:
            return events
        # Entry-window upper bound: skip entries that are too early in the slot.
        if cfg.max_entry_seconds_left and sec_left > cfg.max_entry_seconds_left:
            return events

        candidates = []
        if up_ask is not None and up_ask >= cfg.threshold:
            candidates.append(("UP", market.up_token, up_book))
        if dn_ask is not None and dn_ask >= cfg.threshold:
            candidates.append(("DOWN", market.dn_token, dn_book))
        if not candidates:
            return events

        candidates.sort(key=lambda c: c[2].best_ask or 0.0, reverse=True)
        side, token, _ = candidates[0]

        # latency: price may move before the order lands -> re-fetch the book
        time.sleep(self._latency())
        try:
            book = md.fetch_order_book(token)
        except Exception as e:
            return events + [SimEvent(type="ERROR", message=f"entry book fetch failed: {e}")]

        fill = realism.buy_notional(
            book.asks, cfg.stake_usd, max_price=MAX_BUY_PRICE,
            use_book=self._use_book, fee_rate=self._fee_rate,
        )
        if not self._partial and 0 < fill.filled_ratio < 1.0 and fill.shares > 0:
            full_shares = cfg.stake_usd / fill.avg_price if fill.avg_price > 0 else 0.0
            fill = realism.Fill(
                fill.avg_price, full_shares, cfg.stake_usd, 1.0,
                realism.taker_fee(full_shares, fill.avg_price, self._fee_rate),
            )
        if fill.shares <= 0:
            events.append(SimEvent(type="INFO", message=f"entry skipped: no fillable liquidity for {side}"))
            return events

        cost = fill.notional + fill.fee
        self.balance -= cost
        self.position = Position(
            market_slug=market.slug, side=side, token_id=token,
            entry_price=fill.avg_price, shares=fill.shares, cost=cost,
            entry_fee=fill.fee, stop_price=fill.avg_price * (1.0 - cfg.stop_loss_pct),
            opened_at=ts_iso(), filled_ratio=fill.filled_ratio, end_ts=market.end_ts,
        )
        self.state = "IN_POSITION"
        events.append(SimEvent(
            type="OPEN",
            message=f"OPEN {side} {market.slug} @ {fill.avg_price:.3f} shares={fill.shares:.2f} cost={cost:.2f}",
            data={
                "side": side, "slug": market.slug, "entry_price": fill.avg_price,
                "shares": fill.shares, "cost": cost, "fee": fill.fee,
                "filled_ratio": fill.filled_ratio, "stop_price": self.position.stop_price,
                "balance": self.balance,
            },
        ))
        return events

    def _close_position(self, reason: str, book: Optional[md.OrderBook] = None) -> list[SimEvent]:
        assert self.position is not None
        pos = self.position
        time.sleep(self._latency())
        if book is None:
            try:
                book = md.fetch_order_book(pos.token_id)
            except Exception:
                book = md.OrderBook(token_id=pos.token_id)

        best_bid = book.best_bid if book.best_bid is not None else pos.entry_price
        min_price = FORCE_MIN_PRICE if self._force else max(FORCE_MIN_PRICE, best_bid)
        fill = realism.sell_shares(
            book.bids, pos.shares, min_price=min_price,
            use_book=self._use_book, fee_rate=self._fee_rate,
        )
        # paper always flattens: sell any remainder at the marginal price reached
        if fill.shares < pos.shares and fill.avg_price > 0:
            remainder = pos.shares - fill.shares
            extra_notional = remainder * fill.avg_price
            total_shares = fill.shares + remainder
            total_notional = fill.notional + extra_notional
            avg = total_notional / total_shares if total_shares else fill.avg_price
            fill = realism.Fill(
                avg, total_shares, total_notional, 1.0,
                realism.taker_fee(total_shares, avg, self._fee_rate),
            )
        elif fill.shares <= 0:
            fill = realism.Fill(best_bid, pos.shares, pos.shares * best_bid, 1.0,
                                realism.taker_fee(pos.shares, best_bid, self._fee_rate))

        proceeds = fill.notional - fill.fee
        self.balance += proceeds
        pnl = round(proceeds - pos.cost, 6)

        self._trade_seq += 1
        trade = Trade(
            id=self._trade_seq, market_slug=pos.market_slug, side=pos.side,
            entry_price=pos.entry_price, exit_price=fill.avg_price, shares=pos.shares,
            cost=pos.cost, proceeds=proceeds, entry_fee=pos.entry_fee, exit_fee=fill.fee,
            fees=round(pos.entry_fee + fill.fee, 6), pnl=pnl, filled_ratio=pos.filled_ratio,
            close_reason=reason, opened_at=pos.opened_at, closed_at=ts_iso(),
        )
        self.trades.append(trade)
        self._update_kpis(trade)

        self.state = "FLAT"
        self.position = None
        return [SimEvent(
            type="CLOSE",
            message=f"CLOSE {trade.side} {trade.market_slug} @ {fill.avg_price:.3f} PnL={pnl:+.2f} ({reason})",
            data=trade.model_dump(),
        )]

    def _update_kpis(self, trade: Trade) -> None:
        k = self.kpis
        k.trades += 1
        if trade.pnl > 0:
            k.wins += 1
        else:
            k.losses += 1
        k.win_rate = round(k.wins / k.trades, 4) if k.trades else 0.0
        k.total_pnl = round(k.total_pnl + trade.pnl, 6)
        k.fees_paid = round(k.fees_paid + trade.fees, 6)
        self._peak_balance = max(self._peak_balance, self.balance)
        k.max_drawdown = round(max(k.max_drawdown, self._peak_balance - self.balance), 6)

    def _finish(self, reason: str, events: list[SimEvent]) -> None:
        self.finished_reason = reason
        events.append(SimEvent(
            type="SUMMARY",
            message=f"session finished: {reason}",
            data={"reason": reason, "kpis": self.kpis.model_dump(), "balance": self.balance},
        ))

    def _update_market_snapshot(self, market: md.Market) -> None:
        self._last_market.slug = market.slug
        self._last_market.seconds_left = market.seconds_left()

    def status(self) -> SessionStatus:
        unreal = 0.0
        equity = self.balance
        if self.position is not None:
            cur = self._last_market
            bid = cur.up_bid if self.position.side == "UP" else cur.dn_bid
            if bid is None:
                bid = self.position.entry_price
            unreal = self.position.shares * bid - self.position.cost
            equity = self.balance + self.position.shares * bid
        return SessionStatus(
            running=not self.finished,
            state=self.state,
            finished_reason=self.finished_reason,
            balance=round(self.balance, 4),
            equity=round(equity, 4),
            unrealized_pnl=round(unreal, 4),
            started_at=self.started_at,
            config=self.config,
            position=self.position,
            market=self._last_market,
            kpis=self.kpis,
        )
