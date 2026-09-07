# BTC 5m Paper-Trading Simulator (web app)

A **paper-only** dashboard to watch the BTC 5m momentum strategy trade on live
Polymarket data. No real orders, wallets, or credentials are involved.

- **Backend:** FastAPI + a tick-based simulation engine with realistic execution
  (latency, order-book VWAP slippage, partial fills, Polymarket taker fees, and
  aggressive force-close). Market data is read-only via public Polymarket REST.
- **Frontend:** Vite + React 19 + TypeScript + HeroUI v3 (Tailwind v4, dark theme)
  with a live WebSocket feed, equity curve, KPIs, position card, event feed,
  trade history, and a full settings panel. Icons use Lucide.

## Run (development)

Two processes. From the repo root:

```bash
# 1) Backend (http://localhost:8000)
.venv/bin/python -m uvicorn btc5m_sim.main:app --host 0.0.0.0 --port 8000
#   (run inside app/backend, or: cd app/backend && ../../.venv/bin/python -m uvicorn btc5m_sim.main:app --port 8000)

# 2) Frontend dev server (http://localhost:5173, proxies /api and /ws to :8000)
cd app/frontend && npm install && npm run dev
```

Open http://localhost:5173, adjust settings, and click **Start paper session**.

## Run (single origin / production-like)

Build the frontend; the backend serves it at `/`:

```bash
cd app/frontend && npm install && npm run build
cd ../backend && ../../.venv/bin/python -m uvicorn btc5m_sim.main:app --host 0.0.0.0 --port 8000
# open http://localhost:8000
```

## Tests

```bash
cd app/backend && ../../.venv/bin/python -m pytest -q
```

## Notes

- Backend deps: `app/backend/requirements.txt` (installed into the repo `.venv`).
- SQLite data (presets, trade history) lives in `app/backend/data/` (gitignored).
- Deployment to a VPS (e.g. Docker Compose, front+back) is a planned follow-up.
