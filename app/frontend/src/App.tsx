import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Chip } from "@heroui/react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { api } from "./api";
import { useSim } from "./useSim";
import type { MarketSnapshot, Preset, SimConfig, Trade } from "./types";
import { StatusBar } from "./components/StatusBar";
import { KpiCards } from "./components/KpiCards";
import { PortfolioChart } from "./components/PortfolioChart";
import { PositionCard } from "./components/PositionCard";
import { EventFeed } from "./components/EventFeed";
import { TradesTable } from "./components/TradesTable";
import { SettingsPanel } from "./components/SettingsPanel";

const EMPTY_MARKET: MarketSnapshot = {
  slug: null, seconds_left: null, up_ask: null, dn_ask: null, up_bid: null, dn_bid: null, spread: null,
};

function SectionHeading({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      <DynamicIcon name={icon} size={17} strokeWidth={1.75} className="shrink-0" />
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}

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
  const startBalance = status?.config?.start_balance ?? config?.start_balance ?? 100;
  const balance = status?.balance ?? startBalance;
  const equityVal = status?.equity ?? balance;
  const pos = status?.position ?? null;

  const onStart = async () => { if (config) await api.start(config); };
  const onStop = async () => { await api.stop(); };
  const onSavePreset = async (name: string) => { if (config) { await api.savePreset(name, config); reloadPresets(); } };
  const onDeletePreset = async (id: number) => { await api.deletePreset(id); reloadPresets(); };

  return (
    <div className="min-h-full w-full max-w-[1760px] mx-auto p-4 md:p-6">
      <header className="flex items-center gap-3 mb-5">
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

        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <aside className="w-full lg:w-[360px] lg:shrink-0">
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
          </aside>

          <main className="flex-1 min-w-0 space-y-5">
            <PortfolioChart data={equity} startBalance={startBalance} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <section className="lg:col-span-1">
                <SectionHeading icon="briefcase" title="Position">
                  {pos ? (
                    <Chip size="sm" color={pos.side === "UP" ? "success" : "danger"}>
                      <DynamicIcon name={pos.side === "UP" ? "trending-up" : "trending-down"} size={13} strokeWidth={1.75} className="shrink-0" />
                      {pos.side}
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default">FLAT</Chip>
                  )}
                </SectionHeading>
                {status ? (
                  <div className="h-[300px]">
                    <PositionCard status={status} />
                  </div>
                ) : (
                  <div className="h-[300px]" />
                )}
              </section>

              <section className="lg:col-span-2">
                <SectionHeading icon="radio" title="Live event feed">
                  <Chip size="sm" color="default">{events.length}</Chip>
                </SectionHeading>
                <div className="h-[300px]">
                  <EventFeed events={events} />
                </div>
              </section>
            </div>

            <section>
              <SectionHeading icon="history" title="Trade history">
                <Chip size="sm" color="default">{trades.length}</Chip>
              </SectionHeading>
              <TradesTable trades={trades} />
            </section>
          </main>
        </div>

        <footer className="text-center text-xs text-[var(--muted-foreground)] py-4">
          Educational paper-trading simulator. No real orders, wallets, or funds are involved.
        </footer>
      </div>
    </div>
  );
}
