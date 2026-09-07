# Project conventions & agent guidance

This repo contains the BTC 5m Polymarket skill (Python CLI) plus a paper-trading
web app under `app/` (FastAPI backend + React frontend).

## Frontend conventions (`app/frontend`)

- **Framework:** Vite + React 19 + TypeScript.
- **UI library:** HeroUI v3 (`@heroui/react`, `@heroui/styles`) on Tailwind CSS v4.
  - Use v3 compound components (e.g. `Card.Header`, `Card.Content`), `onPress`
    (not `onClick`), and semantic variants (`primary`, `secondary`, `danger`, …).
  - No `HeroUIProvider` (v3 needs none). Dark theme is the default (`<html class="dark" data-theme="dark">`).
- **Icons: use Lucide (`lucide-react`).** This is the preferred icon set for the project.
  - Import via the dynamic entrypoint and render with `DynamicIcon`:
    ```tsx
    import { DynamicIcon } from 'lucide-react/dynamic';

    <DynamicIcon name="trash-2" size={16} strokeWidth={1.75} className="shrink-0" />
    ```
  - `strokeWidth` is optional (default ~1.75 looks good with HeroUI). Use kebab-case
    icon `name`s. Prefer icons over emoji/unicode glyphs for actions and status.
- **Charts:** Recharts.

## Backend conventions (`app/backend`)

- FastAPI + Pydantic v2. Market data is read-only via public Polymarket REST
  (Gamma + CLOB `/book`); do **not** add `py-clob-client` to the paper path.
- The sim engine is tick-based (`SimEngine.tick()`), scheduler lives in the API
  layer — keep strategy logic transport-agnostic.

## Safety

- The web app is paper-only (no real orders, wallets, or credentials).
- Live trading (`--execute`) stays in the CLI scripts and requires the external
  execution repo; never wire real order placement into the web app without an
  explicit request.
