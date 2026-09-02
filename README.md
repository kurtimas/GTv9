# Grain Tracker v9

Grain-trucking scale software for a country elevator: truck scale capture,
multi-load weight sheets, bin inventory, people/lots, daily reports, and a
main-office portal that receives end-of-day syncs.

## Layout

- `app/` — the scale-house application (React 19 + TypeScript + Vite +
  Tailwind + shadcn/ui frontend; Hono + tRPC + Drizzle backend on MySQL,
  with a dev-only embedded SQLite fallback). See `app/README.md`.
- `office/` — the main-office portal variant (same stack): receives EOD
  uploads from each scale house over HTTP (`x-gt-sync-key`) and shows
  per-site bin levels and upload history. See `office/README.md`.
- `gtv8-vps-setup.sh` — one-shot Ubuntu VPS setup (clones GTv9, generates
  secrets, builds `app/` with Docker Compose + MySQL behind Caddy).
- `vps-grain-stack-setup.sh` — a generic variant of the same idea.
- `grain-track-ubuntu-bootstrap/` — Ubuntu workstation bootstrap kit
  (checksums in `SHA256SUMS.txt`).
- `design/`, `gt-rebuild/` — design notes and rebuild recon (partly stale;
  treat code as the source of truth).
- `Grain-Tracker-Install-Guide.md` + `.docx` — operator install guide.
- `scale-dashboard-rebuild-spec.md` — a proposed single-screen scale
  dashboard rebuild. **Not implemented in this tree** — see below.

## Status of the dashboard rebuild spec

`scale-dashboard-rebuild-spec.md` (single-screen console with keyboard
shortcuts Space/Enter/N, sound beeps, ticket printing/auto-print, tare
memory, tare-deviation + duplicate-truck warnings, est-net, auto-advance,
ops overview) is **a design document only**. None of it exists in this
codebase — earlier READMEs claimed otherwise; that was wrong. What ships is
a multi-page app (Dashboard → `/scale/:sheetId` weigh console → Sheets
archive). Spec-aligned groundwork that IS present but unwired:

- `sheets.truckTares` API (tare memory query; no UI calls it)
- `#ticket-print` print stylesheet in `app/src/index.css` (no component
  renders it)
- `contracts/errors.ts` `Errors` factory (no `errorFormatter` wired)

## Configuration (environment)

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | MySQL connection string (production) |
| `ADMIN_PASSWORD` | password for admin-gated mutations (sites, farmers, landlords, lots, bins, sync settings). **Default `grain-admin` triggers a loud boot warning — always set it in production.** |
| `SEED_DEMO` | demo dataset on first boot of an *empty* database. Defaults to on in dev, **off in production** (`SEED_DEMO=true` to opt in). |
| `ALLOW_OFFLINE` | `1` to permit the embedded SQLite fallback in production. Without it, production refuses to boot when MySQL is unreachable. |
| `TZ` | day boundaries for the daily report / EOD close follow this zone. Keep the app and MySQL containers on the same zone. |

## Development

```bash
cd app
npm ci
npm run dev        # Vite dev server (falls back to embedded SQLite w/o MySQL)
npm run check      # typecheck
npm run test       # vitest (bushels/shrink + lot-code units)
npm run build      # vite build + esbuild server bundle
npm start          # production server on :3000
npm run smoke      # end-to-end tRPC smoke test against a running server
```

`office/` uses the same commands.
