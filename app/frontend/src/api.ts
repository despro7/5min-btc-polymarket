import type { Preset, SimConfig, SessionStatus, Trade } from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  defaults: () => fetch("/api/config/defaults").then((r) => j<SimConfig>(r)),
  market: () => fetch("/api/market/current").then((r) => j<Record<string, unknown>>(r)),
  status: () => fetch("/api/session/status").then((r) => j<SessionStatus>(r)),
  start: (config: SimConfig) =>
    fetch("/api/session/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then((r) => j<{ ok: boolean; session_id: string }>(r)),
  stop: () => fetch("/api/session/stop", { method: "POST" }).then((r) => j<{ ok: boolean }>(r)),
  trades: () => fetch("/api/session/trades").then((r) => j<{ live: Trade[]; history: Trade[] }>(r)),
  presets: () => fetch("/api/presets").then((r) => j<Preset[]>(r)),
  savePreset: (name: string, config: SimConfig) =>
    fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config }),
    }).then((r) => j<Preset>(r)),
  deletePreset: (id: number) => fetch(`/api/presets/${id}`, { method: "DELETE" }).then((r) => j(r)),
};
