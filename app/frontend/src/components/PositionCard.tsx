import { Card, Chip } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { SessionStatus } from "../types";
import { fmtNum, fmtSigned, fmtUsd, pnlClass } from "../format";

function Row({ k, v, vClass }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-[var(--muted-foreground)]">{k}</span>
      <span className={`tabular-nums font-medium ${vClass ?? ""}`}>{v}</span>
    </div>
  );
}

export function PositionCard({ status }: { status: SessionStatus }) {
  const pos = status.position;
  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <DynamicIcon name="briefcase" size={16} strokeWidth={1.75} className="shrink-0" />
          Position
          {pos ? (
            <Chip color={pos.side === "UP" ? "success" : "danger"} size="sm">
              <DynamicIcon name={pos.side === "UP" ? "trending-up" : "trending-down"} size={14} strokeWidth={1.75} className="shrink-0" />
              {pos.side}
            </Chip>
          ) : (
            <Chip color="default" size="sm">
              FLAT
            </Chip>
          )}
        </Card.Title>
      </Card.Header>
      <Card.Content>
        {pos ? (
          <div>
            <Row k="Market" v={pos.market_slug.replace("btc-updown-5m-", "#")} />
            <Row k="Entry price" v={fmtNum(pos.entry_price, 3)} />
            <Row k="Shares" v={fmtNum(pos.shares, 2)} />
            <Row k="Cost (incl. fee)" v={fmtUsd(pos.cost)} />
            <Row k="Stop price" v={fmtNum(pos.stop_price, 3)} vClass="text-danger" />
            <Row k="Filled" v={`${(pos.filled_ratio * 100).toFixed(0)}%`} />
            <Row
              k="Unrealized P&L"
              v={fmtSigned(status.unrealized_pnl)}
              vClass={pnlClass(status.unrealized_pnl)}
            />
          </div>
        ) : (
          <div className="text-sm text-[var(--muted-foreground)] py-6 text-center">
            No open position. Waiting for an entry signal…
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
