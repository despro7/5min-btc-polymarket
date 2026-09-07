#!/usr/bin/env python3
"""Paper-trading (demo money) simulator for the BTC 5m strategy.

This does NOT place any real orders and needs no credentials or the external
execution engine. It reuses the real market-data + strategy helpers from
test_btc_5m_session_exit_sl.py, but "fills" trades on paper and tracks a
fake balance so you can watch how the strategy behaves on live data.

Model (mirrors the real bot, which closes BEFORE settlement):
- Entry:  buy the stronger side at its live CLOB best ASK when ask >= threshold.
- Exit:   sell at the live CLOB best BID, triggered by stop-loss or the
          time-exit (N seconds before the 5m market ends).
- PnL:    proceeds (shares * exit_bid) - cost (stake).

Everything is imaginary money. Read-only network access to public Polymarket
endpoints only.
"""
import argparse
import datetime as dt
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_btc_5m_session_exit_sl as strat  # noqa: E402

UTC = dt.timezone.utc


def now_hhmmss() -> str:
    return dt.datetime.now(UTC).strftime("%H:%M:%S")


def log(msg: str) -> None:
    print(f"[{now_hhmmss()}] {msg}", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="BTC 5m paper-trading demo (no real money)")
    ap.add_argument("--start-balance", type=float, default=100.0, help="Demo starting balance in USDC")
    ap.add_argument("--stake-usd", type=float, default=5.0, help="Stake per trade")
    ap.add_argument("--threshold", type=float, default=0.55,
                    help="Enter when a side's CLOB ask >= this (0.55 makes the demo trigger quickly; the repo default is 0.70)")
    ap.add_argument("--stop-loss-pct", type=float, default=0.25, help="0.25 = exit if price falls 25%% from entry")
    ap.add_argument("--exit-before-sec", type=int, default=20, help="Force paper-exit N seconds before market end")
    ap.add_argument("--min-entry-seconds-left", type=int, default=30, help="Do not open if fewer seconds remain")
    ap.add_argument("--poll-sec", type=float, default=5.0, help="Polling interval")
    ap.add_argument("--run-min", type=float, default=8.0, help="How long to run the demo (minutes)")
    args = ap.parse_args()

    balance = float(args.start_balance)
    trades = []
    position = None  # dict when in a paper position

    log("=== BTC 5m PAPER-TRADING DEMO (fake money, no real orders) ===")
    log(f"start_balance={balance:.2f} USDC  stake={args.stake_usd:.2f}  threshold={args.threshold}  "
        f"stop_loss={int(args.stop_loss_pct*100)}%  exit_before={args.exit_before_sec}s")

    deadline = time.time() + args.run_min * 60.0

    while time.time() < deadline:
        try:
            m = strat.resolve_active_current_5m_market()
            if not m:
                log("... no active current 5m market yet, waiting")
                time.sleep(args.poll_sec)
                continue

            g_up, g_dn, up_t, dn_t, slug, end_iso = strat.market_side_prices(m)
            try:
                end_ts = dt.datetime.fromisoformat(end_iso.replace("Z", "+00:00")).timestamp()
            except Exception:
                time.sleep(args.poll_sec)
                continue
            sec_left = max(0.0, end_ts - time.time())

            # ---- Manage an open paper position ----
            if position is not None and position["slug"] == slug:
                side = position["side"]
                token = position["token_id"]
                sell_bid = strat.clob_best_bid(token)
                if sell_bid is None:
                    sp = strat.get_side_price_from_slug(slug, side)
                    sell_bid = sp if sp is not None else position["entry_price"]

                reason = None
                if sec_left <= args.exit_before_sec:
                    reason = f"time_exit_{args.exit_before_sec}s_before_end"
                elif sell_bid <= position["stop_price"]:
                    reason = f"stop_loss_{int(args.stop_loss_pct*100)}pct"

                if reason:
                    proceeds = position["shares"] * float(sell_bid)
                    pnl = proceeds - position["cost"]
                    balance += proceeds
                    trades.append(pnl)
                    log(f"CLOSE  {side:<4} {slug}  sell_bid={sell_bid:.3f} "
                        f"proceeds={proceeds:.2f}  PnL={pnl:+.2f} USDC  reason={reason}")
                    log(f"       balance -> {balance:.2f} USDC")
                    position = None
                else:
                    log(f"HOLD   {side:<4} {slug}  entry={position['entry_price']:.3f} "
                        f"cur_bid={sell_bid:.3f} stop={position['stop_price']:.3f} sec_left={sec_left:.0f}")
                time.sleep(args.poll_sec)
                continue

            # If we hold a position but the slot rolled over, force a close at last known bid.
            if position is not None and position["slug"] != slug:
                token = position["token_id"]
                sell_bid = strat.clob_best_bid(token) or position["entry_price"]
                proceeds = position["shares"] * float(sell_bid)
                pnl = proceeds - position["cost"]
                balance += proceeds
                trades.append(pnl)
                log(f"CLOSE  {position['side']:<4} {position['slug']}  (slot rolled) "
                    f"sell_bid={sell_bid:.3f} PnL={pnl:+.2f} USDC  balance -> {balance:.2f}")
                position = None

            # ---- Look for a paper entry ----
            up_ask, dn_ask, spread = strat.clob_side_prices(up_t, dn_t)
            log(f"WATCH  {slug}  up_ask={up_ask}  dn_ask={dn_ask}  sec_left={sec_left:.0f}  min_spread={spread}")

            if sec_left < args.min_entry_seconds_left:
                time.sleep(args.poll_sec)
                continue

            candidates = []
            if up_ask is not None and float(up_ask) >= args.threshold:
                candidates.append(("UP", float(up_ask), up_t))
            if dn_ask is not None and float(dn_ask) >= args.threshold:
                candidates.append(("DOWN", float(dn_ask), dn_t))
            if not candidates:
                time.sleep(args.poll_sec)
                continue

            side, entry_price, token = sorted(candidates, key=lambda x: x[1], reverse=True)[0]
            if balance < args.stake_usd:
                log(f"SKIP   insufficient demo balance ({balance:.2f} < {args.stake_usd:.2f})")
                break
            cost = float(args.stake_usd)
            shares = cost / entry_price
            balance -= cost
            position = {
                "slug": slug,
                "side": side,
                "token_id": token,
                "entry_price": entry_price,
                "shares": shares,
                "cost": cost,
                "stop_price": entry_price * (1.0 - args.stop_loss_pct),
            }
            log(f"OPEN   {side:<4} {slug}  ask={entry_price:.3f}  stake={cost:.2f}  "
                f"shares={shares:.2f}  stop={position['stop_price']:.3f}  balance -> {balance:.2f}")
        except Exception as e:  # keep the demo resilient to transient API hiccups
            log(f"warn: {e}")
        time.sleep(args.poll_sec)

    # Close any still-open paper position at the last known bid.
    if position is not None:
        try:
            sell_bid = strat.clob_best_bid(position["token_id"]) or position["entry_price"]
        except Exception:
            sell_bid = position["entry_price"]
        proceeds = position["shares"] * float(sell_bid)
        pnl = proceeds - position["cost"]
        balance += proceeds
        trades.append(pnl)
        log(f"CLOSE  {position['side']:<4} {position['slug']}  (demo ended) "
            f"sell_bid={sell_bid:.3f} PnL={pnl:+.2f} USDC  balance -> {balance:.2f}")

    wins = sum(1 for p in trades if p > 0)
    total = round(sum(trades), 4)
    log("=== DEMO SUMMARY ===")
    log(f"trades={len(trades)}  wins={wins}  losses={len(trades)-wins}  "
        f"total_PnL={total:+.2f} USDC  final_balance={balance:.2f} USDC")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
