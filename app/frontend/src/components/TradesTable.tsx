import { useEffect, useMemo, useState } from "react";
import { Button, Chip, ListBox, Pagination, Select, Table, type SortDescriptor } from "@heroui/react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { Trade } from "../types";
import { fmtDateTime, fmtNum, fmtSigned, fmtUsd } from "../format";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";
export type Period = "today" | "yesterday" | "24h" | "7d" | "all";

export const PERIODS: { k: Period; label: string }[] = [
  { k: "today", label: "Today" },
  { k: "yesterday", label: "Yesterday" },
  { k: "24h", label: "Last 24h" },
  { k: "7d", label: "Last 7d" },
  { k: "all", label: "All" },
];

const PAGE_SIZES = [10, 25, 50, 100];

export function PeriodFilter({ period, setPeriod }: { period: Period; setPeriod: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <DynamicIcon name="calendar-range" size={15} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
      {PERIODS.map((p) => (
        <Button key={p.k} size="sm" variant={period === p.k ? "primary" : "ghost"} onPress={() => setPeriod(p.k)}>
          {p.label}
        </Button>
      ))}
    </div>
  );
}

function reasonMeta(reason: string): { label: string; color: ChipColor; icon: IconName } {
  if (reason.startsWith("time_exit")) return { label: "Time exit", color: "accent", icon: "clock" };
  if (reason.startsWith("stop_loss")) return { label: "Stop loss", color: "danger", icon: "shield-alert" };
  if (reason === "slot_rolled") return { label: "Slot rolled", color: "warning", icon: "refresh-cw" };
  return { label: "Session end", color: "default", icon: "flag" };
}

export function inPeriod(iso: string, period: Period): boolean {
  if (period === "all") return true;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  const now = new Date();
  if (period === "24h") return t >= now.getTime() - 24 * 3600e3;
  if (period === "7d") return t >= now.getTime() - 7 * 24 * 3600e3;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === "today") return t >= startOfToday;
  if (period === "yesterday") return t >= startOfToday - 24 * 3600e3 && t < startOfToday;
  return true;
}

const COLUMNS: { id: string; label: string }[] = [
  { id: "n", label: "#" },
  { id: "date", label: "Date" },
  { id: "side", label: "Side" },
  { id: "entry", label: "Entry" },
  { id: "exit", label: "Exit" },
  { id: "fees", label: "Fees" },
  { id: "pnl", label: "P&L" },
  { id: "reason", label: "Reason" },
];

function sortValue(t: Trade, col: string): number | string {
  switch (col) {
    case "n": return t.id;
    case "date": return new Date(t.closed_at).getTime();
    case "side": return t.side;
    case "entry": return t.entry_price;
    case "exit": return t.exit_price;
    case "fees": return t.fees;
    case "pnl": return t.pnl;
    case "reason": return t.close_reason;
    default: return t.id;
  }
}

type Row = Trade & { uid: string };

export function TradesTable({ trades, period }: { trades: Trade[]; period: Period }) {
  const [sort, setSort] = useState<SortDescriptor>({ column: "date", direction: "descending" });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const rows = useMemo<Row[]>(() => {
    const filtered = trades
      .filter((t) => inPeriod(t.closed_at, period))
      .map((t, i) => ({ ...t, uid: `${t.closed_at}-${t.id}-${i}` }));
    const col = String(sort.column);
    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, col);
      const bv = sortValue(b, col);
      let cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      if (sort.direction === "descending") cmp *= -1;
      return cmp;
    });
    return sorted;
  }, [trades, period, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  );

  const from = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, rows.length);

  const pnlText = (t: Trade) => (t.pnl >= 0 ? "success" : "danger");

  return (
    <div>
      <Table>
        <Table.ScrollContainer className="max-h-[520px] overflow-y-auto">
          <Table.Content
            aria-label="Trade history"
            className="min-w-[760px]"
            sortDescriptor={sort}
            onSortChange={setSort}
          >
            <Table.Header className="sticky top-0 z-10 bg-surface-secondary">
              {COLUMNS.map((c) => (
                <Table.Column key={c.id} id={c.id} allowsSorting isRowHeader={c.id === "n"}>
                  {({ sortDirection }: { sortDirection?: "ascending" | "descending" }) => (
                    <Table.SortableColumnHeader sortDirection={sortDirection}>{c.label}</Table.SortableColumnHeader>
                  )}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body renderEmptyState={() => (
              <div className="py-10 text-center text-sm text-[var(--muted)]">No completed trades in this period.</div>
            )}>
              <Table.Collection items={pageRows}>
                {(t: Row) => {
                  const rm = reasonMeta(t.close_reason);
                  return (
                    <Table.Row key={t.uid} id={t.uid}>
                      <Table.Cell className="text-[var(--muted)]">{t.id}</Table.Cell>
                      <Table.Cell className="whitespace-nowrap text-[var(--muted)]">{fmtDateTime(t.closed_at)}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={t.side === "UP" ? "success" : "danger"} className="px-2">
                          <DynamicIcon name={t.side === "UP" ? "trending-up" : "trending-down"} size={13} strokeWidth={1.75} className="shrink-0" />
                          {t.side}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="tabular-nums">{fmtNum(t.entry_price, 3)}</Table.Cell>
                      <Table.Cell className="tabular-nums">{fmtNum(t.exit_price, 3)}</Table.Cell>
                      <Table.Cell className="tabular-nums text-[var(--muted)]">{fmtUsd(t.fees, 3)}</Table.Cell>
                      <Table.Cell className="tabular-nums">
                        <Chip size="sm" variant="soft" color={pnlText(t)} className="px-2">{fmtSigned(t.pnl)}</Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={rm.color} className="px-2">
                          <DynamicIcon name={rm.icon} size={13} strokeWidth={1.75} className="shrink-0" />
                          {rm.label}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Collection>
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Rows per page</span>
          <Select
            aria-label="Rows per page"
            variant="secondary"
            value={String(pageSize)}
            onChange={(v) => { setPageSize(Number(v)); setPage(1); }}
            className="w-[92px]"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {PAGE_SIZES.map((n) => (
                  <ListBox.Item key={n} id={String(n)} textValue={String(n)}>
                    {n}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          <span className="text-xs text-[var(--muted)]">
            {from}–{to} of {rows.length}
          </span>
        </div>

        <Pagination size="sm">
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous isDisabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
                <Pagination.PreviousIcon />
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>
                  {p}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next isDisabled={page >= totalPages} onPress={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    </div>
  );
}
