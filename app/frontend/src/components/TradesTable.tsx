import { Card } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { Trade } from "../types";
import { fmtNum, fmtSigned, fmtUsd, pnlClass } from "../format";

export function TradesTable({ trades }: { trades: Trade[] }) {
  const ordered = [...trades].reverse();
  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <DynamicIcon name="history" size={16} strokeWidth={1.75} className="shrink-0" />
          Trade history ({trades.length})
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--color-default-200)]">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Side</th>
                <th className="py-2 pr-3 font-medium">Entry</th>
                <th className="py-2 pr-3 font-medium">Exit</th>
                <th className="py-2 pr-3 font-medium">Fees</th>
                <th className="py-2 pr-3 font-medium">P&L</th>
                <th className="py-2 pr-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ordered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[var(--muted-foreground)]">
                    No completed trades yet.
                  </td>
                </tr>
              ) : (
                ordered.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--color-default-100)]">
                    <td className="py-2 pr-3">{t.id}</td>
                    <td className={`py-2 pr-3 font-medium ${t.side === "UP" ? "text-success" : "text-danger"}`}>
                      {t.side}
                    </td>
                    <td className="py-2 pr-3">{fmtNum(t.entry_price, 3)}</td>
                    <td className="py-2 pr-3">{fmtNum(t.exit_price, 3)}</td>
                    <td className="py-2 pr-3">{fmtUsd(t.fees, 3)}</td>
                    <td className={`py-2 pr-3 font-semibold ${pnlClass(t.pnl)}`}>{fmtSigned(t.pnl)}</td>
                    <td className="py-2 pr-3 text-[var(--muted-foreground)]">{t.close_reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card.Content>
    </Card>
  );
}
