export interface RealismConfig {
  enabled: boolean;
  latency_min_ms: number;
  latency_max_ms: number;
  slippage: boolean;
  partial_fills: boolean;
  force_close: boolean;
  fee_rate: number;
}

export interface SimConfig {
  profile: "conservative" | "aggressive" | "custom";
  threshold: number;
  stake_usd: number;
  stop_loss_pct: number;
  exit_before_sec: number;
  min_entry_seconds_left: number;
  poll_sec: number;
  start_balance: number;
  max_trades_per_session: number;
  daily_max_loss: number;
  run_min: number;
  realism: RealismConfig;
}

export interface Position {
  market_slug: string;
  side: "UP" | "DOWN";
  token_id: string;
  entry_price: number;
  shares: number;
  cost: number;
  entry_fee: number;
  stop_price: number;
  opened_at: string;
  filled_ratio: number;
  end_ts: number;
}

export interface Trade {
  id: number;
  market_slug: string;
  side: "UP" | "DOWN";
  entry_price: number;
  exit_price: number;
  shares: number;
  cost: number;
  proceeds: number;
  entry_fee: number;
  exit_fee: number;
  fees: number;
  pnl: number;
  filled_ratio: number;
  close_reason: string;
  opened_at: string;
  closed_at: string;
}

export interface Kpis {
  trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  fees_paid: number;
  max_drawdown: number;
}

export interface MarketSnapshot {
  slug: string | null;
  seconds_left: number | null;
  up_ask: number | null;
  dn_ask: number | null;
  up_bid: number | null;
  dn_bid: number | null;
  spread: number | null;
}

export interface SessionStatus {
  running: boolean;
  state: "FLAT" | "IN_POSITION";
  finished_reason: string | null;
  balance: number;
  equity: number;
  unrealized_pnl: number;
  started_at: string | null;
  config: SimConfig | null;
  position: Position | null;
  market: MarketSnapshot;
  kpis: Kpis;
}

export interface SimEvent {
  ts: string;
  type: "WATCH" | "OPEN" | "HOLD" | "CLOSE" | "INFO" | "SUMMARY" | "STATUS" | "ERROR";
  message: string;
  data: Record<string, unknown>;
}

export interface EquityPoint {
  t: number;
  equity: number;
  balance: number;
  pnl: number;
}

export interface Preset {
  id: number | null;
  name: string;
  config: SimConfig;
}
