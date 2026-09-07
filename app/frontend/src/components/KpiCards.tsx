import { Card } from "@heroui/react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { Kpis } from "../types";
import { fmtNum, fmtPct, fmtSigned, fmtUsd, pnlClass } from "../format";

function Stat({ icon, label, value, valueClass }: { icon: IconName; label: string; value: string; valueClass?: string }) {
  return (
    <Card className="flex-1 min-w-[130px]">
      <Card.Content className="py-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <DynamicIcon name={icon} size={14} strokeWidth={1.75} className="shrink-0" />
          {label}
        </div>
        <div className={`text-xl font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</div>
      </Card.Content>
    </Card>
  );
}

export function KpiCards({ kpis, balance, equity }: { kpis: Kpis; balance: number; equity: number }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Stat icon="wallet" label="Balance" value={fmtUsd(balance)} />
      <Stat icon="line-chart" label="Equity" value={fmtUsd(equity)} />
      <Stat icon="trending-up" label="Total P&L" value={fmtSigned(kpis.total_pnl)} valueClass={pnlClass(kpis.total_pnl)} />
      <Stat icon="repeat" label="Trades" value={`${kpis.trades}`} />
      <Stat icon="target" label="Win rate" value={fmtPct(kpis.win_rate, 0)} />
      <Stat icon="receipt" label="Fees paid" value={fmtUsd(kpis.fees_paid)} />
      <Stat icon="trending-down" label="Max drawdown" value={fmtNum(kpis.max_drawdown)} valueClass="text-danger" />
    </div>
  );
}
