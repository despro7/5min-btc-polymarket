import { useState } from "react";
import { Button, Card, Chip } from "@heroui/react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { Preset, SimConfig } from "../types";
import { LabeledSwitch, NumField } from "./fields";

function SectionLabel({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] mb-2 uppercase tracking-wide">
      <DynamicIcon name={icon} size={14} strokeWidth={1.75} className="shrink-0" />
      {text}
    </div>
  );
}

const PROFILE_PRESETS: Record<string, Partial<SimConfig>> = {
  conservative: { threshold: 0.7, stake_usd: 5, stop_loss_pct: 0.25, exit_before_sec: 20, min_entry_seconds_left: 60, poll_sec: 5 },
  aggressive: { threshold: 0.7, stake_usd: 5, stop_loss_pct: 0.3, exit_before_sec: 20, min_entry_seconds_left: 60, poll_sec: 5 },
};

export function SettingsPanel(props: {
  config: SimConfig;
  setConfig: (c: SimConfig) => void;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  presets: Preset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: number) => void;
}) {
  const { config, setConfig, running, onStart, onStop, presets, onSavePreset, onDeletePreset } = props;
  const [presetName, setPresetName] = useState("");

  const set = (patch: Partial<SimConfig>, keepProfile = false) =>
    setConfig({ ...config, ...patch, profile: keepProfile ? config.profile : "custom" });
  const setRealism = (patch: Partial<SimConfig["realism"]>) =>
    setConfig({ ...config, realism: { ...config.realism, ...patch } });

  const chooseProfile = (p: "conservative" | "aggressive" | "custom") => {
    if (p === "custom") return setConfig({ ...config, profile: "custom" });
    setConfig({ ...config, ...PROFILE_PRESETS[p], profile: p });
  };

  const r = config.realism;

  return (
    <Card className="h-full">
      <Card.Content className="space-y-5 pt-5">
        <div>
          <div className="text-xs text-[var(--muted)] mb-2">Profile</div>
          <div className="flex gap-2">
            {(["conservative", "aggressive", "custom"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={config.profile === p ? "primary" : "outline"}
                onPress={() => chooseProfile(p)}
                isDisabled={running}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="Entry threshold" value={config.threshold} onChange={(v) => set({ threshold: v })} minValue={0} maxValue={1} step={0.01} isDisabled={running} />
          <NumField label="Stake (USDC)" value={config.stake_usd} onChange={(v) => set({ stake_usd: v })} minValue={1} step={1} isDisabled={running} />
          <NumField label="Stop-loss (fraction)" value={config.stop_loss_pct} onChange={(v) => set({ stop_loss_pct: v })} minValue={0} maxValue={1} step={0.05} isDisabled={running} />
          <NumField label="Start balance" value={config.start_balance} onChange={(v) => set({ start_balance: v })} minValue={1} step={10} isDisabled={running} />
          <NumField label="Exit before (sec)" value={config.exit_before_sec} onChange={(v) => set({ exit_before_sec: v })} minValue={0} step={5} isDisabled={running} />
          <NumField label="Min entry sec left" value={config.min_entry_seconds_left} onChange={(v) => set({ min_entry_seconds_left: v })} minValue={0} step={5} isDisabled={running} />
          <NumField label="Max entry sec (0=off)" value={config.max_entry_seconds_left} onChange={(v) => set({ max_entry_seconds_left: v })} minValue={0} step={5} isDisabled={running} />
          <NumField label="Poll (sec)" value={config.poll_sec} onChange={(v) => set({ poll_sec: v })} minValue={1} step={1} isDisabled={running} />
        </div>
        <div className="text-xs text-[var(--muted)] -mt-2">
          Entry window: only enter when <span className="text-[var(--foreground)]">Min ≤ seconds-left ≤ Max</span> (set Max &gt; 0 to skip entries that are too early).
        </div>

        <div>
          <SectionLabel icon="shield" text="Risk limits" />
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Max trades (0=∞)" value={config.max_trades_per_session} onChange={(v) => set({ max_trades_per_session: v }, true)} minValue={0} step={1} isDisabled={running} />
            <NumField label="Daily max loss (0=off)" value={config.daily_max_loss} onChange={(v) => set({ daily_max_loss: v }, true)} minValue={0} step={5} isDisabled={running} />
            <NumField label="Run min (0=∞)" value={config.run_min} onChange={(v) => set({ run_min: v }, true)} minValue={0} step={5} isDisabled={running} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
              <DynamicIcon name="gauge" size={14} strokeWidth={1.75} className="shrink-0" />
              Execution realism
            </span>
            <Chip size="sm" color={r.enabled ? "success" : "default"}>{r.enabled ? "ON" : "idealized"}</Chip>
          </div>
          <div className="space-y-3">
            <LabeledSwitch label="Realistic execution (master)" description="Latency, slippage, partial fills, force-close" isSelected={r.enabled} onChange={(v) => setRealism({ enabled: v })} isDisabled={running} />
            <div className="grid grid-cols-2 gap-3 pl-1">
              <LabeledSwitch label="Order-book slippage" isSelected={r.slippage} onChange={(v) => setRealism({ slippage: v })} isDisabled={running || !r.enabled} />
              <LabeledSwitch label="Partial fills" isSelected={r.partial_fills} onChange={(v) => setRealism({ partial_fills: v })} isDisabled={running || !r.enabled} />
              <LabeledSwitch label="Aggressive force-close" isSelected={r.force_close} onChange={(v) => setRealism({ force_close: v })} isDisabled={running || !r.enabled} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Latency min (ms)" value={r.latency_min_ms} onChange={(v) => setRealism({ latency_min_ms: v })} minValue={0} step={100} isDisabled={running || !r.enabled} />
              <NumField label="Latency max (ms)" value={r.latency_max_ms} onChange={(v) => setRealism({ latency_max_ms: v })} minValue={0} step={100} isDisabled={running || !r.enabled} />
              <NumField label="Taker fee rate" value={r.fee_rate} onChange={(v) => setRealism({ fee_rate: v })} minValue={0} maxValue={1} step={0.01} isDisabled={running} />
            </div>
            <div className="text-xs text-[var(--muted)]">Polymarket crypto taker fee = shares × rate × p × (1−p). Default rate 0.07.</div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          {running ? (
            <Button variant="danger" size="lg" onPress={onStop} className="flex-1">
              Stop session
            </Button>
          ) : (
            <Button variant="primary" size="lg" onPress={onStart} className="flex-1">
              Start paper session
            </Button>
          )}
        </div>

        <div>
          <SectionLabel icon="bookmark" text="Presets" />
          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 rounded-md bg-[var(--field-background)] border border-[var(--field-border)] px-2 py-1 text-sm outline-none focus:border-[var(--field-border-focus)]"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <Button size="sm" variant="secondary" isDisabled={!presetName.trim()} onPress={() => { onSavePreset(presetName.trim()); setPresetName(""); }}>
              <DynamicIcon name="save" size={15} strokeWidth={1.75} className="shrink-0" />
              Save
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onPress={() => setConfig(p.config)} isDisabled={running}>{p.name}</Button>
                <Button size="sm" variant="ghost" isIconOnly onPress={() => p.id && onDeletePreset(p.id)} isDisabled={running}>
                  <DynamicIcon name="trash-2" size={16} strokeWidth={1.75} className="shrink-0" />
                </Button>
              </div>
            ))}
            {presets.length === 0 ? <span className="text-xs text-[var(--muted)]">No saved presets.</span> : null}
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
