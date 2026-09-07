import { useEffect, useMemo, useState } from "react";
import { Chip } from "@heroui/react";
import { DynamicIcon } from "lucide-react/dynamic";
import { api } from "./api";
import { useSim } from "./useSim";
import type { MarketSnapshot, Preset, SimConfig, Trade } from "./types";
import { StatusBar } from "./components/StatusBar";
import { KpiCards } from "./components/KpiCards";
import { EquityChart } from "./components/EquityChart";
import { PositionCard } from "./components/PositionCard";
import { EventFeed } from "./components/EventFeed";
import { TradesTable } from "./components/TradesTable";
import { SettingsPanel } from "./components/SettingsPanel";

const EMPTY_MARKET: MarketSnapshot = {
  slug: null, seconds_left: null, up_ask: null, dn_ask: null, up_bid: null, dn_bid: null, spread: null,
};

export default function App() {
  const { connected, status, events, equity } = useSim();
  const [config, setConfig] = useState<SimConfig | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [preview, setPreview] = useState<MarketSnapshot>(EMPTY_MARKET);

  useEffect(() => {
    api.defaults().then(setConfig).catch(() => {});
    api.presets().then(setPresets).catch(() => {});
  }, []);

  const running = !!status?.running;

  // Poll a live market preview for the status bar while idle.
  useEffect(() => {
    if (running) return;
    let alive = true;
    const load = () =>
      api.market().then((m) => {
        if (!alive || !m.available) return;
        setPreview({
          slug: (m.slug as string) ?? null,
          seconds_left: (m.seconds_left as number) ?? null,
          up_ask: (m.up_ask as number) ?? null,
          dn_ask: (m.dn_ask as number) ?? null,
          up_bid: (m.up_bid as number) ?? null,
          dn_bid: (m.dn_bid as number) ?? null,
          spread: null,
        });
      }).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [running]);

  const reloadPresets = () => api.presets().then(setPresets).catch(() => {});

  const trades = useMemo<Trade[]>(
    () => events.filter((e) => e.type === "CLOSE").map((e) => e.data as unknown as Trade),
    [events]
  );

  const market = running && status ? status.market : preview;
  const state = status?.state ?? "FLAT";
  const kpis = status?.kpis ?? { trades: 0, wins: 0, losses: 0, win_rate: 0, total_pnl: 0, fees_paid: 0, max_drawdown: 0 };
  const balance = status?.balance ?? config?.start_balance ?? 100;
  const equityVal = status?.equity ?? balance;

  const onStart = async () => { if (config) await api.start(config); };
  const onStop = async () => { await api.stop(); };
  const onSavePreset = async (name: string) => { if (config) { await api.savePreset(name, config); reloadPresets(); } };
  const onDeletePreset = async (id: number) => { await api.deletePreset(id); reloadPresets(); };

  return (
    <div className="min-h-full max-w-[1400px] mx-auto p-4 md:p-6">
      <header className="flex items-center gap-3 mb-4">
        <DynamicIcon name="candlestick-chart" size={26} strokeWidth={1.75} className="shrink-0 text-accent" />
        <h1 className="text-xl md:text-2xl font-bold">BTC 5m Paper Simulator</h1>
        <Chip color="warning">
          <DynamicIcon name="flask-conical" size={14} strokeWidth={1.75} className="shrink-0" />
          PAPER MODE
        </Chip>
        <div className="ml-auto">
          <Chip color={connected ? "success" : "danger"} size="sm">
            <DynamicIcon name={connected ? "wifi" : "wifi-off"} size={14} strokeWidth={1.75} className="shrink-0" />
            {connected ? "connected" : "reconnecting…"}
          </Chip>
        </div>
      </header>

      <div className="space-y-4">
        <StatusBar market={market} state={state} running={running} />
        <KpiCards kpis={kpis} balance={balance} equity={equityVal} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 lg:row-span-2">
            {config ? (
              <SettingsPanel
                config={config}
                setConfig={setConfig}
                running={running}
                onStart={onStart}
                onStop={onStop}
                presets={presets}
                onSavePreset={onSavePreset}
                onDeletePreset={onDeletePreset}
              />
            ) : (
              <div className="text-[var(--muted-foreground)]">Loading settings…</div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-[var(--color-default-200)] bg-[var(--color-default-50)] p-3">
              <div className="flex items-center gap-2 text-sm font-medium mb-1 px-1">
              <DynamicIcon name="line-chart" size={16} strokeWidth={1.75} className="shrink-0" />
              Equity curve
            </div>
              <EquityChart data={equity} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {status ? <PositionCard status={status} /> : <div />}
              <EventFeed events={events} />
            </div>
            <TradesTable trades={trades} />
          </div>
        </div>

        <footer className="text-center text-xs text-[var(--muted-foreground)] py-4">
          Educational paper-trading simulator. No real orders, wallets, or funds are involved.
        </footer>
      </div>
    </div>
  );
}
