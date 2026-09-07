import { useEffect, useRef } from "react";
import { Card, Chip } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";
import type { SimEvent } from "../types";
import { fmtClock } from "../format";

const typeColor: Record<string, "default" | "accent" | "success" | "warning" | "danger"> = {
  OPEN: "accent",
  CLOSE: "success",
  HOLD: "default",
  WATCH: "default",
  INFO: "warning",
  SUMMARY: "accent",
  ERROR: "danger",
};

export function EventFeed({ events }: { events: SimEvent[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [events]);

  return (
    <Card className="h-full">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <DynamicIcon name="radio" size={16} strokeWidth={1.75} className="shrink-0" />
          Live event feed
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div ref={ref} className="h-[300px] overflow-y-auto font-mono text-xs space-y-1 pr-1">
          {events.length === 0 ? (
            <div className="text-[var(--muted-foreground)]">No events yet.</div>
          ) : (
            events.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[var(--muted-foreground)] shrink-0">
                  {fmtClock(new Date(e.ts).getTime())}
                </span>
                <Chip size="sm" color={typeColor[e.type] ?? "default"} className="shrink-0">
                  {e.type}
                </Chip>
                <span className="break-all">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
