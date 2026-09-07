import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from btc5m_sim.market_data import Level  # noqa: E402
from btc5m_sim import realism  # noqa: E402


def test_taker_fee_formula():
    # fee = shares * rate * p * (1-p); at p=0.5 -> 100 * 0.07 * 0.25 = 1.75
    assert abs(realism.taker_fee(100, 0.5, 0.07) - 1.75) < 1e-9
    # maker/zero rate -> 0
    assert realism.taker_fee(100, 0.5, 0.0) == 0.0


def test_buy_vwap_walks_levels():
    asks = [Level(0.60, 5), Level(0.62, 5), Level(0.65, 100)]
    # spend $6: 5 shares @0.60 = $3, then $3 more @0.62 = 4.8387 shares
    fill = realism.buy_notional(asks, 6.0, use_book=True, fee_rate=0.0)
    assert abs(fill.notional - 6.0) < 1e-6
    assert 9.8 < fill.shares < 9.85
    assert 0.60 < fill.avg_price < 0.62
    assert fill.filled_ratio == 1.0


def test_buy_partial_when_book_thin():
    asks = [Level(0.60, 2)]  # only $1.20 of liquidity
    fill = realism.buy_notional(asks, 5.0, use_book=True, fee_rate=0.0)
    assert fill.shares == 2
    assert abs(fill.notional - 1.2) < 1e-9
    assert fill.filled_ratio < 1.0


def test_buy_idealized_top_of_book():
    asks = [Level(0.60, 2), Level(0.99, 1000)]
    fill = realism.buy_notional(asks, 5.0, use_book=False, fee_rate=0.0)
    # ignores depth -> full fill at top price
    assert abs(fill.avg_price - 0.60) < 1e-9
    assert abs(fill.shares - (5.0 / 0.60)) < 1e-6
    assert fill.filled_ratio == 1.0


def test_buy_price_protection():
    asks = [Level(0.995, 1000)]
    fill = realism.buy_notional(asks, 5.0, max_price=0.99, use_book=True)
    assert fill.shares == 0.0


def test_sell_vwap_walks_bids():
    bids = [Level(0.90, 3), Level(0.85, 100)]
    fill = realism.sell_shares(bids, 5, use_book=True, fee_rate=0.0)
    # 3 @0.90 + 2 @0.85 = 2.7 + 1.7 = 4.4
    assert abs(fill.notional - 4.4) < 1e-9
    assert fill.shares == 5
    assert 0.85 < fill.avg_price < 0.90


def test_sell_min_price_stops_walk():
    bids = [Level(0.90, 3), Level(0.50, 100)]
    fill = realism.sell_shares(bids, 5, min_price=0.80, use_book=True)
    # only the 0.90 level qualifies -> partial 3 shares
    assert fill.shares == 3
