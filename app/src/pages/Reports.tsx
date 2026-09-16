import { useEffect, useState } from "react";
import { trpc } from "@shared/src/lib/trpc";
import { useSite } from "@/providers/site";
import { fmtBu, fmtLbs } from "@contracts/grain";
import { AdminPasswordField } from "@/components/AdminPasswordField";
import { useAdminGate } from "@/hooks/useAdminGate";
import { QueryError } from "@shared/src/components/QueryError";
import { toast } from "@shared/src/components/ui/sonner";
import { Button } from "@shared/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/src/components/ui/card";
import { Input } from "@shared/src/components/ui/input";
import { Label } from "@shared/src/components/ui/label";
import { Badge } from "@shared/src/components/ui/badge";
import { Skeleton } from "@shared/src/components/ui/skeleton";
import { Separator } from "@shared/src/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/src/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/src/components/ui/dialog";

function todayInput(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DirectionBadge({ direction }: { direction: "INBOUND" | "OUTBOUND" }) {
  return (
    <Badge
      variant="outline"
      className={
        direction === "INBOUND"
          ? "border-stable/50 font-mono text-[10px] text-stable"
          : "border-go/50 font-mono text-[10px] text-go"
      }
    >
      {direction === "INBOUND" ? "IN" : "OUT"}
    </Badge>
  );
}

function LoadStatusBadge({ status }: { status: "OPEN" | "COMPLETED" }) {
  return status === "OPEN" ? (
    <Badge variant="outline" className="border-live/50 font-mono text-[10px] text-live">
      ON SCALE
    </Badge>
  ) : (
    <Badge variant="outline" className="border-stable/50 font-mono text-[10px] text-stable">
      COMPLETED
    </Badge>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "go" | "amber";
}) {
  const toneClass =
    props.tone === "go"
      ? "text-go"
      : props.tone === "amber"
        ? "text-primary"
        : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="gt-eyebrow">{props.label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`font-mono text-2xl font-semibold ${toneClass}`}>
          {props.value}
        </div>
        {props.sub ? (
          <div className="mt-1 font-mono text-xs text-muted-foreground">{props.sub}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const utils = trpc.useUtils();
  const { siteId, siteName } = useSite();
  const [date, setDate] = useState(todayInput);
  const [closeOpen, setCloseOpen] = useState(false);

  const report = trpc.sheets.dailyReport.useQuery(
    { date, siteId: siteId ?? undefined },
    { enabled: siteId != null },
  );
  const openSheets = trpc.sheets.open.useQuery(
    { siteId: siteId ?? undefined },
    { enabled: siteId != null },
  );

  const closeDay = trpc.sheets.closeDay.useMutation({
    onSuccess: async (r) => {
      toast.success(`${r.closed} sheet${r.closed === 1 ? "" : "s"} closed`);
      if (r.office) {
        if (r.office.ok) {
          toast.success(`Office push OK — ${r.office.pushed} report(s) pushed`);
        } else {
          toast.error(`Office push failed: ${r.office.error ?? "unknown error"}`);
        }
      }
      setCloseOpen(false);
      await Promise.all([
        utils.sheets.dailyReport.invalidate(),
        utils.sheets.open.invalidate(),
        utils.sheets.list.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message),
  });

  // ---- office sync ----
  const settings = trpc.sync.getSettings.useQuery();
  const syncStatus = trpc.sync.status.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const [officeUrl, setOfficeUrl] = useState("");
  // The server never returns the key — an empty field means "keep existing".
  const [officeKey, setOfficeKey] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { passwordRequired } = useAdminGate();
  const officeKeySet = settings.data?.officeKeySet ?? false;
  useEffect(() => {
    if (settings.data) {
      setOfficeUrl(settings.data.officeUrl);
      setOfficeKey("");
    }
  }, [settings.data]);

  const saveSettings = trpc.sync.setSettings.useMutation({
    onSuccess: async () => {
      toast.success("Office sync settings saved");
      setOfficeKey("");
      setAdminPassword("");
      await utils.sync.getSettings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveSyncSettings = () => {
    if (passwordRequired && !adminPassword) {
      toast.error("Admin password is required to change sync settings");
      return;
    }
    saveSettings.mutate({
      adminPassword,
      officeUrl,
      // omit the key when untouched so the stored one is kept
      ...(officeKey.trim() !== "" ? { officeKey: officeKey.trim() } : {}),
    });
  };

  const syncNow = trpc.sync.syncNow.useMutation({
    onSuccess: async (r) => {
      if (r.pull.ok) {
        const p = r.pull.pulled;
        toast.success(
          `Pull OK — ${p ? `${p.farmers} farmers, ${p.landlords} landlords, ${p.lots} lots` : "nothing new"}`,
        );
      } else {
        toast.error(`Pull failed: ${r.pull.error ?? "unknown error"}`);
      }
      if (r.push.ok) {
        toast.success(`Push OK — ${r.push.pushed} package(s) sent`);
      } else {
        toast.error(`Push failed: ${r.push.error ?? "unknown error"}`);
      }
      await utils.sync.status.invalidate();
      await utils.sync.outboxStatus.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // failed pushes queued for automatic retry (P1-8)
  const outbox = trpc.sync.outboxStatus.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const retryOutbox = trpc.sync.retryOutbox.useMutation({
    onSuccess: async (r) => {
      if (r.attempted === 0) {
        toast.success("Outbox is empty — nothing to retry");
      } else if (r.failed === 0) {
        toast.success(`Outbox flushed — ${r.succeeded} push(es) sent`);
      } else {
        toast.warning(
          `Outbox retry: ${r.succeeded} sent, ${r.failed} still failing (auto-retry continues)`,
        );
      }
      await utils.sync.outboxStatus.invalidate();
      await utils.sync.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const data = report.data;
  const openCount = openSheets.data?.length ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* header + date picker */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daily Report</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Day totals, load ledger, bin levels, and end-of-day close.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-date" className="gt-eyebrow">
            Report date
          </Label>
          <Input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            className="w-44 font-mono"
          />
        </div>
      </div>

      {/* summary cards */}
      {report.isError && (
        <QueryError
          title="Daily report failed to load"
          message={report.error.message}
          onRetry={() => void report.refetch()}
          retrying={report.isRefetching}
        />
      )}
      {report.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {["a", "b", "c", "d"].map((k) => (
            <Card key={k}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
                <Skeleton className="mt-2 h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Sheets opened" value={String(data.sheetCount)} />
          <SummaryCard
            label="Loads weighed"
            value={String(data.loadCount)}
            sub={`${data.completedCount} completed`}
          />
          <SummaryCard
            label="Inbound"
            value={`${fmtLbs(data.inboundLbs)} lbs`}
            sub={`${fmtBu(data.inboundBu)} bu`}
            tone="go"
          />
          <SummaryCard
            label="Outbound"
            value={`${fmtLbs(data.outboundLbs)} lbs`}
            sub={`${fmtBu(data.outboundBu)} bu`}
            tone="amber"
          />
        </div>
      ) : null}

      {/* by crop / by farmer */}
      {data && data.loadCount > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By crop</CardTitle>
              <CardDescription>Net totals for completed loads.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Crop</TableHead>
                    <TableHead className="text-right">Loads</TableHead>
                    <TableHead className="text-right">Net lbs</TableHead>
                    <TableHead className="text-right">Net bu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCrop.map((r) => (
                    <TableRow key={r.crop}>
                      <TableCell className="font-medium">{r.crop}</TableCell>
                      <TableCell className="text-right font-mono">{r.count}</TableCell>
                      <TableCell className="text-right font-mono">{fmtLbs(r.lbs)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBu(r.bu)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By farmer</CardTitle>
              <CardDescription>Net totals for completed loads.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer</TableHead>
                    <TableHead className="text-right">Loads</TableHead>
                    <TableHead className="text-right">Net lbs</TableHead>
                    <TableHead className="text-right">Net bu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byFarmer.map((r) => (
                    <TableRow key={r.farmer}>
                      <TableCell className="font-medium">{r.farmer}</TableCell>
                      <TableCell className="text-right font-mono">{r.count}</TableCell>
                      <TableCell className="text-right font-mono">{fmtLbs(r.lbs)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtBu(r.bu)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* loads ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Loads ledger</CardTitle>
          <CardDescription>Every load weighed on {date}.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <div className="space-y-2">
              {["a", "b", "c", "d", "e"].map((k) => (
                <Skeleton key={k} className="h-8 w-full" />
              ))}
            </div>
          ) : report.isError ? null : !data || data.loads.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No loads recorded for this date.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Farmer</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Crop</TableHead>
                    <TableHead>Dir</TableHead>
                    <TableHead>Truck</TableHead>
                    <TableHead>Bin</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Tare</TableHead>
                    <TableHead className="text-right">Net lbs</TableHead>
                    <TableHead className="text-right">Net bu</TableHead>
                    <TableHead className="text-right">Moist %</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.loads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.ticketNo}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtTime(l.createdAt)}
                      </TableCell>
                      <TableCell>{l.farmerName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.lotCode ?? "—"}
                      </TableCell>
                      <TableCell>{l.crop}</TableCell>
                      <TableCell>
                        <DirectionBadge direction={l.direction} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.truckId ?? "—"}
                      </TableCell>
                      <TableCell>{l.binName ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtLbs(l.grossLbs)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtLbs(l.tareLbs)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtLbs(l.netLbs)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtBu(l.netBushels)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {l.moisturePct != null ? l.moisturePct.toFixed(1) : "—"}
                      </TableCell>
                      <TableCell>
                        <LoadStatusBadge status={l.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* bin levels snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bin levels</CardTitle>
          <CardDescription>Inventory snapshot at report time.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <div className="space-y-2">
              {["a", "b", "c"].map((k) => (
                <Skeleton key={k} className="h-8 w-full" />
              ))}
            </div>
          ) : report.isError ? null : !data || data.bins.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              No bins configured.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bin</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead className="text-right">Current lbs</TableHead>
                  <TableHead className="text-right">Capacity lbs</TableHead>
                  <TableHead className="w-40">Fill</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.bins.map((b) => {
                  const pct =
                    b.capacityLbs > 0
                      ? Math.min(100, (b.currentLbs / b.capacityLbs) * 100)
                      : 0;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.siteName ?? "—"}
                      </TableCell>
                      <TableCell>{b.crop}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtLbs(b.currentLbs)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {fmtLbs(b.capacityLbs)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted">
                            <div
                              className="h-1.5 rounded-full bg-go"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* close day */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm text-destructive">
            Close day{siteName ? ` — ${siteName}` : ""}
          </CardTitle>
          <CardDescription>
            Closes open sheets at this location and locks the day. If an office
            portal is configured, the end-of-day report is pushed
            automatically. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-mono text-foreground">{openCount}</span> sheet
            {openCount === 1 ? "" : "s"} currently open at
            {" "}{siteName ?? "this location"}.
          </div>
          <Button
            variant="destructive"
            onClick={() => setCloseOpen(true)}
            disabled={openSheets.isLoading}
          >
            Close day
          </Button>
        </CardContent>
      </Card>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close the day at {siteName ?? "this location"}?</DialogTitle>
            <DialogDescription>
              This closes{" "}
              <span className="font-mono font-semibold text-foreground">
                {openCount}
              </span>{" "}
              currently OPEN sheet{openCount === 1 ? "" : "s"} with reason EOD and
              locks them against further weighing. The day&apos;s report is pushed
              to the office portal if one is configured.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseOpen(false)}
              disabled={closeDay.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => closeDay.mutate({ siteId: siteId ?? undefined })}
              disabled={closeDay.isPending}
            >
              {closeDay.isPending ? "Closing…" : "Close day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* office sync */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Office sync</CardTitle>
          <CardDescription>
            Main-office portal connection. People and lots pull down; daily
            reports push up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.isError && (
            <QueryError
              title="Sync settings failed to load"
              message={settings.error.message}
              onRetry={() => void settings.refetch()}
              retrying={settings.isRefetching}
            />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="office-url" className="gt-eyebrow">
                Office URL
              </Label>
              {settings.isLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Input
                  id="office-url"
                  placeholder="https://office.example.com"
                  value={officeUrl}
                  onChange={(e) => setOfficeUrl(e.target.value)}
                  className="font-mono text-xs"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="office-key" className="gt-eyebrow">
                Office key
              </Label>
              {settings.isLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Input
                  id="office-key"
                  type="password"
                  placeholder={officeKeySet ? "unchanged — type to replace" : "shared key"}
                  value={officeKey}
                  onChange={(e) => setOfficeKey(e.target.value)}
                  className="font-mono text-xs"
                />
              )}
            </div>
          </div>
          <AdminPasswordField
            id="sync-settings-password"
            value={adminPassword}
            onChange={setAdminPassword}
            hint="Sync settings send your data to the office portal — they require the admin password."
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={saveSyncSettings}
              disabled={saveSettings.isPending}
            >
              {saveSettings.isPending ? "Saving…" : "Save settings"}
            </Button>
            <Button
              onClick={() => syncNow.mutate({ date })}
              disabled={syncNow.isPending}
            >
              {syncNow.isPending ? "Syncing…" : "Sync now"}
            </Button>
          </div>

          {/* outbox: failed pushes waiting for automatic retry */}
          {(outbox.data?.pending ?? 0) > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[hsl(38_92%_60%)]/50 bg-[hsl(38_92%_60%)]/10 px-4 py-2">
              <div className="font-mono text-xs text-[hsl(38_92%_60%)]">
                {outbox.data!.pending} push{outbox.data!.pending === 1 ? "" : "es"} queued
                for retry —{" "}
                {outbox.data!.entries
                  .map((e) => `${e.siteName} ${e.day}${e.dead ? " (gave up — retry manually)" : ""}`)
                  .join(", ")}
                . Auto-retry runs every minute with backoff.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryOutbox.mutate()}
                disabled={retryOutbox.isPending}
              >
                {retryOutbox.isPending ? "Retrying…" : "Retry now"}
              </Button>
            </div>
          )}

          <Separator />

          <div>
            <div className="gt-eyebrow mb-2">Sync log</div>
            {syncStatus.isError && (
              <QueryError
                title="Sync log failed to load"
                message={syncStatus.error.message}
                onRetry={() => void syncStatus.refetch()}
                retrying={syncStatus.isRefetching}
              />
            )}
            {syncStatus.isLoading ? (
              <div className="space-y-2">
                {["a", "b", "c"].map((k) => (
                  <Skeleton key={k} className="h-7 w-full" />
                ))}
              </div>
            ) : !syncStatus.isError && (!syncStatus.data || syncStatus.data.length === 0) ? (
              <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                No sync activity yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(syncStatus.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.direction === "PUSH"
                              ? "border-go/50 font-mono text-[10px] text-go"
                              : "border-live/50 font-mono text-[10px] text-live"
                          }
                        >
                          {row.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.status === "OK"
                              ? "border-stable/50 font-mono text-[10px] text-stable"
                              : "border-crit/60 font-mono text-[10px] text-crit"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                        {row.detail ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {fmtDateTime(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <BackupRestoreCard />
    </div>
  );
}

// ---------------------------------------------------------------- backup

/**
 * Full-database backup/restore (admin-gated). Backup downloads a portable
 * JSON document of every table; restore replaces ALL current data with an
 * uploaded document. A safety copy of the current data is downloaded
 * automatically before any restore runs. The server-side nightly dump
 * (grain-backup) is separate and keeps 14 days of .sql.gz files.
 */
function BackupRestoreCard() {
  const [adminPassword, setAdminPassword] = useState("");
  const [filePayload, setFilePayload] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const { passwordRequired } = useAdminGate();

  const downloadJson = (filename: string, data: string) => {
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportMut = trpc.backup.export.useMutation({
    onSuccess: (r) => {
      downloadJson(r.filename, JSON.stringify(r.payload, null, 2));
      toast.success("Backup downloaded — keep it somewhere safe");
    },
    onError: (e) => toast.error(e.message),
  });

  const restoreMut = trpc.backup.restore.useMutation({
    onSuccess: (r) => {
      toast.success(`Database restored — ${r.summary || "empty dataset"}`, {
        description: "Reloading…",
        duration: 8_000,
      });
      setTimeout(() => window.location.reload(), 1800);
    },
    onError: (e) => toast.error(e.message),
  });

  // Safety first: before replacing anything, download a copy of the data
  // that is about to be replaced, then chain the restore.
  const safetyMut = trpc.backup.export.useMutation({
    onSuccess: (r) => {
      downloadJson(`safety-copy-before-restore-${r.filename}`, JSON.stringify(r.payload));
      toast("Safety copy of current data downloaded", {
        description: "Keep that file — restoring it undoes this restore.",
        duration: 10_000,
      });
      restoreMut.mutate({ payload: filePayload, adminPassword: adminPassword || undefined });
    },
    onError: (e) => toast.error(e.message),
  });

  const onPickFile = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if ((parsed as { app?: string })?.app !== "grain-tracker") {
        toast.error("That file is not a Grain Tracker backup");
        return;
      }
      setFilePayload(parsed);
      setFileName(file.name);
    } catch {
      toast.error("Could not read that file as JSON");
    }
  };

  const canRestore =
    filePayload != null &&
    confirmText === "REPLACE" &&
    (!passwordRequired || adminPassword !== "") &&
    !safetyMut.isPending &&
    !restoreMut.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Backup &amp; restore</CardTitle>
        <CardDescription>
          A full copy of every table as a single file. The server also takes
          its own automatic backup nightly (14 days kept on the server).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={exportMut.isPending}
            onClick={() => exportMut.mutate({ adminPassword: adminPassword || undefined })}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportMut.isPending ? "Preparing…" : "Download backup"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Downloads a .json copy of all data.
          </span>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="gt-eyebrow">Restore from a backup file</div>
          <Alert variant="destructive">
            <AlertTitle>Restore replaces ALL current data</AlertTitle>
            <AlertDescription>
              Every sheet, load, farmer, and bin level is replaced by the
              uploaded file. A safety copy of the current data downloads
              automatically first — keep it.
            </AlertDescription>
          </Alert>
          <Input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onPickFile(f);
              e.target.value = "";
            }}
            className="text-xs"
          />
          {fileName && (
            <p className="font-mono text-xs text-muted-foreground">
              Loaded: {fileName}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="restore-confirm" className="text-xs">
              Type <span className="font-mono font-bold">REPLACE</span> to confirm
            </Label>
            <Input
              id="restore-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="REPLACE"
              className="font-mono"
            />
          </div>
          {passwordRequired && (
            <AdminPasswordField
              id="restore-admin-password"
              value={adminPassword}
              onChange={setAdminPassword}
              hint="Restoring requires the site admin password."
            />
          )}
          <Button
            variant="destructive"
            disabled={!canRestore}
            onClick={() => {
              if (passwordRequired && !adminPassword) {
                toast.error("Admin password is required to restore");
                return;
              }
              safetyMut.mutate({ adminPassword: adminPassword || undefined });
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            {restoreMut.isPending
              ? "Restoring…"
              : safetyMut.isPending
                ? "Saving safety copy…"
                : "Restore database"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
