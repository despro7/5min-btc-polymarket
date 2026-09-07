import { Card, Chip } from "@heroui/react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { Trade } from "../types";
import { fmtDateTime, fmtNum, fmtSigned, fmtUsd, pnlClass } from "../format";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

function reasonMeta(reason: string): { label: string; color: ChipColor; icon: IconName } {
  if (reason.startsWith("time_exit")) return { label: "Time exit", color: "accent", icon: "clock" };
  if (reason.startsWith("stop_loss")) return { label: "Stop loss", color: "danger", icon: "shield-alert" };
  if (reason === "slot_rolled") return { label: "Slot rolled", color: "warning", icon: "refresh-cw" };
  return { label: "Session end", color: "default", icon: "flag" };
}

export function TradesTable({ trades }: { trades: Trade[] }) {
  // Number chronologically (oldest = 1), display newest first.
  const rows = trades.map((t, i) => ({ t, n: i + 1 })).reverse();
  const th = "py-2.5 px-4 font-medium text-xs uppercase tracking-wide text-[var(--muted-foreground)]";
  const td = "py-3 px-4 align-middle";

  return (
    <Card>
      <Card.Content className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-default-200)]">
                <th className={`${th} text-left`}>#</th>
                <th className={`${th} text-left`}>Date</th>
                <th className={`${th} text-left`}>Side</th>
                <th className={`${th} text-right`}>Entry</th>
                <th className={`${th} text-right`}>Exit</th>
                <th className={`${th} text-right`}>Fees</th>
                <th className={`${th} text-right`}>P&L</th>
                <th className={`${th} text-left`}>Reason</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[var(--muted-foreground)]">
                    No completed trades yet.
                  </td>
                </tr>
              ) : (
                rows.map(({ t, n }) => {
                  const rm = reasonMeta(t.close_reason);
                  return (
                    <tr key={t.id} className="border-b border-[var(--color-default-100)] last:border-0 hover:bg-[var(--color-default-100)] transition-colors">
                      <td className={`${td} text-[var(--muted-foreground)]`}>{n}</td>
                      <td className={`${td} whitespace-nowrap text-[var(--muted-foreground)]`}>{fmtDateTime(t.closed_at)}</td>
                      <td className={td}>
                        <Chip size="sm" color={t.side === "UP" ? "success" : "danger"}>
                          <DynamicIcon name={t.side === "UP" ? "trending-up" : "trending-down"} size={13} strokeWidth={1.75} className="shrink-0" />
                          {t.side}
                        </Chip>
                      </td>
                      <td className={`${td} text-right`}>{fmtNum(t.entry_price, 3)}</td>
                      <td className={`${td} text-right`}>{fmtNum(t.exit_price, 3)}</td>
                      <td className={`${td} text-right text-[var(--muted-foreground)]`}>{fmtUsd(t.fees, 3)}</td>
                      <td className={`${td} text-right font-semibold ${pnlClass(t.pnl)}`}>{fmtSigned(t.pnl)}</td>
                      <td className={td}>
                        <Chip size="sm" color={rm.color}>
                          <DynamicIcon name={rm.icon} size={13} strokeWidth={1.75} className="shrink-0" />
                          {rm.label}
                        </Chip>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card.Content>
    </Card>
  );
}
