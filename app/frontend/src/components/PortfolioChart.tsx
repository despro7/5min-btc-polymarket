import { useMemo, useState } from "react";
import { Button, Card } from "@heroui/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "../types";
import { fmtClock, fmtSigned, fmtUsd } from "../format";

type Series = "equity" | "pnl" | "rate";

const SERIES: { key: Series; label: string }[] = [
  { key: "equity", label: "Equity" },
  { key: "pnl", label: "P&L" },
  { key: "rate", label: "Rate" },
];

export function PortfolioChart({ data, startBalance }: { data: EquityPoint[]; startBalance: number }) {
  const [series, setSeries] = useState<Series>("equity");

  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: fmtClock(p.t),
        rate: startBalance ? (p.equity / startBalance - 1) * 100 : 0,
      })),
    [data, startBalance]
  );

  const last = chartData[chartData.length - 1];
  const lastVal = last ? (last[series] as number) : null;
  const positive = (lastVal ?? 0) >= 0;

  const color =
    series === "equity"
      ? "var(--color-accent)"
      : positive
      ? "var(--color-success)"
      : "var(--color-danger)";

  const fmt = (v: number) =>
    series === "equity" ? fmtUsd(v) : series === "pnl" ? fmtSigned(v) : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  const currentText =
    lastVal === null ? "—" : series === "equity" ? fmtUsd(lastVal) : fmt(lastVal);

  return (
    <Card>
      <Card.Content className="pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Portfolio</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              {series === "equity" ? "Equity value" : series === "pnl" ? "Realized P&L" : "Return vs start"}
            </div>
            <div className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: series === "equity" ? undefined : color }}>
              {currentText}
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-[var(--color-default-200)] p-1 bg-[var(--color-default-100)]">
            {SERIES.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={series === s.key ? "primary" : "ghost"}
                onPress={() => setSeries(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-xs text-[var(--muted-foreground)]">{SERIES.find((s) => s.key === series)?.label}</span>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-default-200)" opacity={0.3} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-default-500)" }} minTickGap={44} tickLine={false} axisLine={false} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "var(--color-default-500)" }}
              width={56}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (series === "equity" ? `$${Number(v).toFixed(0)}` : series === "rate" ? `${Number(v).toFixed(0)}%` : Number(v).toFixed(1))}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-default-50)",
                border: "1px solid var(--color-default-200)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-default-500)" }}
              formatter={(v) => [fmt(Number(v)), SERIES.find((s) => s.key === series)?.label ?? ""]}
            />
            <Area type="monotone" dataKey={series} stroke={color} strokeWidth={2} fill="url(#portfolioFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card.Content>
    </Card>
  );
}
