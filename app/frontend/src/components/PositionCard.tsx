import { Card } from "@heroui/react";
import type { SessionStatus } from "../types";
import { fmtNum, fmtSigned, fmtUsd, pnlClass } from "../format";

function Row({ k, v, vClass }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-[var(--separator)] last:border-0">
      <span className="text-[var(--muted)]">{k}</span>
      <span className={`tabular-nums font-medium ${vClass ?? ""}`}>{v}</span>
    </div>
  );
}

export function PositionCard({ status }: { status: SessionStatus }) {
  const pos = status.position;
  return (
    <Card className="h-full">
      <Card.Content className="h-full flex flex-col justify-center py-2">
        {pos ? (
          <div>
            <Row k="Market" v={pos.market_slug.replace("btc-updown-5m-", "#")} />
            <Row k="Entry price" v={fmtNum(pos.entry_price, 3)} />
            <Row k="Shares" v={fmtNum(pos.shares, 2)} />
            <Row k="Cost (incl. fee)" v={fmtUsd(pos.cost)} />
            <Row k="Stop price" v={fmtNum(pos.stop_price, 3)} vClass="text-danger" />
            <Row k="Filled" v={`${(pos.filled_ratio * 100).toFixed(0)}%`} />
            <Row k="Unrealized P&L" v={fmtSigned(status.unrealized_pnl)} vClass={pnlClass(status.unrealized_pnl)} />
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)] py-6 text-center">
            No open position.
            <br />
            Waiting for an entry signal…
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
