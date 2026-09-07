import { useMemo, useState } from "react";
import { Button, Card } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "../types";
import { fmtClock, fmtSigned } from "../format";

type Range = "1d" | "1w" | "1m" | "1y" | "ytd" | "all";

const RANGES: { key: Range; label: string; subtitle: string }[] = [
  { key: "1d", label: "1D", subtitle: "Past day" },
  { key: "1w", label: "1W", subtitle: "Past week" },
  { key: "1m", label: "1M", subtitle: "Past month" },
  { key: "1y", label: "1Y", subtitle: "Past year" },
  { key: "ytd", label: "YTD", subtitle: "Year to date" },
  { key: "all", label: "ALL", subtitle: "All time" },
];

function cutoff(range: Range): number {
  const now = Date.now();
  switch (range) {
    case "1d": return now - 24 * 3600e3;
    case "1w": return now - 7 * 24 * 3600e3;
    case "1m": return now - 30 * 24 * 3600e3;
    case "1y": return now - 365 * 24 * 3600e3;
    case "ytd": return new Date(new Date().getFullYear(), 0, 1).getTime();
    case "all": return -Infinity;
  }
}

export function PortfolioChart({ data }: { data: EquityPoint[] }) {
  const [range, setRange] = useState<Range>("1d");

  const chartData = useMemo(() => {
    const c = cutoff(range);
    return data
      .filter((p) => p.t >= c)
      .map((p) => ({ ...p, label: fmtClock(p.t) }));
  }, [data, range]);

  const last = chartData[chartData.length - 1];
  const lastVal = last ? last.pnl : null;
  const positive = (lastVal ?? 0) >= 0;
  const rangeMeta = RANGES.find((r) => r.key === range)!;

  const startColor = positive ? "#a855f7" : "#f43f5e";
  const endColor = positive ? "#38bdf8" : "#fb7185";

  const valueText = lastVal === null ? "—" : `${lastVal >= 0 ? "+" : "-"}$${Math.abs(lastVal).toFixed(2)}`;
  const valueColor = positive ? "var(--color-success)" : "var(--color-danger)";

  return (
    <Card>
      <Card.Content className="pt-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5" style={{ color: valueColor }}>
              <DynamicIcon name={positive ? "trending-up" : "trending-down"} size={16} strokeWidth={2.25} className="shrink-0" />
              <span className="text-sm font-semibold">Profit/Loss</span>
            </div>
            <div className="text-4xl font-bold tabular-nums mt-1" style={{ color: valueColor }}>
              {valueText}
            </div>
            <div className="text-xs text-[var(--muted)] mt-1">{rangeMeta.subtitle}</div>
          </div>
          <div className="flex gap-1 rounded-lg p-1 bg-[var(--surface-secondary)]">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={range === r.key ? "primary" : "ghost"}
                onPress={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260} className="mt-3">
          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={startColor} />
                <stop offset="100%" stopColor={endColor} />
              </linearGradient>
              <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={endColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={endColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" opacity={0.6} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--foreground)" }} minTickGap={44} tickLine={false} axisLine={false} />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 11, fill: "var(--foreground)" }}
              width={56}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmtSigned(Number(v), 0)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
              formatter={(v) => [fmtSigned(Number(v)), "P&L"]}
            />
            <Area type="monotone" dataKey="pnl" stroke="url(#pnlStroke)" strokeWidth={2.5} fill="url(#pnlFill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card.Content>
    </Card>
  );
}
