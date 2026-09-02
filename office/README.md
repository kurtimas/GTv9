# Grain Tracker — main-office portal

The office-side companion to the scale-house app (`../app`). Scale houses
push their end-of-day packages here over HTTP (shared `x-gt-sync-key`
secret; receiver in `api/syncReceiver.ts`), and the portal mirrors
farmers/landlords/lots and each site's sheets, loads, and bin levels.

Same stack as `app/` (React 19 + Vite frontend, Hono + tRPC + Drizzle
backend). Routers: `core` / `people` / `sheets` (shared with the scale
house) plus `office` (per-site overview, today's loads, EOD upload
history) and the `/api/sync` receiver.

## What the UI has today

- `/` — office home: today's totals across sites, per-site bin levels and
  last-upload times, and the end-of-day report history table.

## Not built yet (backend ready)

Management pages for the mirrored data (sheets archive, bins, people/lots,
reports drill-down) are not implemented — the routers exist and the smoke
script exercises them, but there is no UI beyond the home page. The
`siteId`-scoped queries in `sheets.*` are the intended starting point.

## Commands

```bash
npm run dev      # Vite dev server (embedded SQLite when MySQL is absent)
npm run check    # typecheck
npm run test     # vitest unit tests
npm run build    # client + server bundles → dist/
npm start        # production server on :3000 (NODE_ENV=production)
npm run smoke    # end-to-end tRPC smoke test against a running server
```

The receiver authenticates inbound syncs with the `x-gt-sync-key` header
matched against the `officeKey` setting — the same shared key the scale
house stores in its sync settings.
