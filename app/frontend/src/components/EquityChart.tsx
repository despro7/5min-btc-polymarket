import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EquityPoint } from "../types";
import { fmtClock, fmtUsd } from "../format";

export function EquityChart({ data }: { data: EquityPoint[] }) {
  const chartData = data.map((p) => ({ ...p, label: fmtClock(p.t) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-default-200)" opacity={0.3} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-default-500)" }} minTickGap={40} />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 11, fill: "var(--color-default-500)" }}
          width={54}
          tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-default-50)",
            border: "1px solid var(--color-default-200)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v) => [fmtUsd(Number(v)), "Equity"]}
        />
        <Area type="monotone" dataKey="equity" stroke="var(--color-accent)" strokeWidth={2} fill="url(#eq)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
