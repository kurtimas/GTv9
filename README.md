# Grain Tracker v9

Combined repository: **GTv8Beta** (full grain-trucking scale app — Dashboard, Sheets, Bins, People, Reports) **with the spec-faithful Scale Dashboard rebuild merged in**.

## Layout

- `app/` — main application (React 19 + TypeScript + Vite + Tailwind + shadcn/ui frontend; Hono + tRPC + Drizzle backend)
- `office/` — office/companion variant of the app
- `grain-track-ubuntu-bootstrap/` — Ubuntu machine bootstrap scripts
- `gt-rebuild/` — rebuild planning/recon docs
- `scale-dashboard-rebuild-spec.md` — the dashboard rebuild specification

## Dashboard rebuild

The scale dashboard was rebuilt per `scale-dashboard-rebuild-spec.md` and ported onto the existing tRPC API with no changes to `api/`, `db/`, or `contracts/`:

- Component kit: `app/src/components/kit/` (PageHeader, StatCard, ErrorBanner, EmptyState, TestBadge, NodeToggle, StatusBadge, LoadSlots)
- Dashboard components: `app/src/components/dashboard/` (ScalePanel, ManualWeight, CaptureButtons, TogglesStrip, BinStrip, QuickStats, ContextPanel, OpenSheetsList, TicketPrint, OpsOverview, NewSheetDialog, SheetDetailDialog, types)
- Support: `app/src/lib/{fillTone,format,printTicket,sound}.ts`, `app/src/hooks/useNow.ts`, extended `app/src/hooks/useScale.ts`
- Full rewrite of `app/src/pages/Dashboard.tsx`

Features: 15 s polling, Web Serial scale + simulator + manual fallback, weigh state machine (INBOUND/OUTBOUND aware), operator guards (tare deviation, duplicate truck, estimated net, bin auto-suggest, repeat last load), keyboard shortcuts (Space/Enter/N), sound beeps, ticket print/auto-print.
