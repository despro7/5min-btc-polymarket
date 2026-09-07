export const fmtUsd = (n: number | null | undefined, d = 2): string =>
  n === null || n === undefined ? "—" : `$${n.toFixed(d)}`;

export const fmtNum = (n: number | null | undefined, d = 2): string =>
  n === null || n === undefined ? "—" : n.toFixed(d);

export const fmtPct = (n: number | null | undefined, d = 0): string =>
  n === null || n === undefined ? "—" : `${(n * 100).toFixed(d)}%`;

export const fmtSigned = (n: number | null | undefined, d = 2): string =>
  n === null || n === undefined ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}`;

export const fmtClock = (ms: number): string => {
  const dt = new Date(ms);
  return dt.toLocaleTimeString("en-GB", { hour12: false });
};

export const fmtDateTime = (iso: string): string => {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";
  const date = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} · ${time}`;
};

export const fmtSecs = (s: number | null | undefined): string =>
  s === null || s === undefined ? "—" : `${Math.max(0, Math.floor(s))}s`;

export const pnlClass = (n: number | null | undefined): string =>
  n === null || n === undefined
    ? "text-[var(--muted-foreground)]"
    : n > 0
    ? "text-success"
    : n < 0
    ? "text-danger"
    : "text-[var(--muted-foreground)]";
