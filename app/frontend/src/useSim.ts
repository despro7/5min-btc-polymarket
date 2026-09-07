import { useCallback, useEffect, useRef, useState } from "react";
import type { EquityPoint, SessionStatus, SimEvent } from "./types";

interface WsSnapshot {
  kind: "snapshot";
  status: SessionStatus | null;
  events: SimEvent[];
  equity: EquityPoint[];
  session_id: string | null;
}
interface WsEvent { kind: "event"; event: SimEvent }
interface WsStatus { kind: "status"; status: SessionStatus; point: EquityPoint }
type WsMessage = WsSnapshot | WsEvent | WsStatus;

const MAX_EVENTS = 400;

export function useSim() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [events, setEvents] = useState<SimEvent[]>([]);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 1500);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data) as WsMessage;
      if (msg.kind === "snapshot") {
        setStatus(msg.status);
        setEvents(msg.events.slice(-MAX_EVENTS));
        setEquity(msg.equity);
      } else if (msg.kind === "event") {
        setEvents((prev) => [...prev, msg.event].slice(-MAX_EVENTS));
      } else if (msg.kind === "status") {
        setStatus(msg.status);
        setEquity((prev) => [...prev, msg.point].slice(-2000));
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, status, events, equity, setEvents, setEquity };
}
