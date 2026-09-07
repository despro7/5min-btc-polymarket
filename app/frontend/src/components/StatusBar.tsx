import { Card, Chip } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { MarketSnapshot } from "../types";
import { fmtNum, fmtSecs } from "../format";

function Cell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</span>
      <span className={`text-base font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</span>
    </div>
  );
}

export function StatusBar({
  market,
  state,
  running,
}: {
  market: MarketSnapshot;
  state: "FLAT" | "IN_POSITION";
  running: boolean;
}) {
  const secs = market.seconds_left ?? null;
  const lowTime = secs !== null && secs <= 30;
  return (
    <Card>
      <Card.Content className="py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Cell label="Market" value={market.slug ? market.slug.replace("btc-updown-5m-", "#") : "—"} />
          <Cell label="Time left" value={fmtSecs(secs)} valueClass={lowTime ? "text-warning" : ""} />
          <Cell label="UP ask" value={fmtNum(market.up_ask, 3)} valueClass="text-success" />
          <Cell label="DOWN ask" value={fmtNum(market.dn_ask, 3)} valueClass="text-danger" />
          <Cell label="UP bid" value={fmtNum(market.up_bid, 3)} />
          <Cell label="DOWN bid" value={fmtNum(market.dn_bid, 3)} />
          <div className="ml-auto flex items-center gap-2">
            <Chip color={state === "IN_POSITION" ? "accent" : "default"}>
              <DynamicIcon name={state === "IN_POSITION" ? "briefcase" : "circle-dashed"} size={14} strokeWidth={1.75} className="shrink-0" />
              {state}
            </Chip>
            <Chip color={running ? "success" : "default"}>
              <DynamicIcon name={running ? "activity" : "pause"} size={14} strokeWidth={1.75} className="shrink-0" />
              {running ? "RUNNING" : "IDLE"}
            </Chip>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
