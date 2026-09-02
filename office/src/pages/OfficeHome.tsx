import { trpc } from "@/lib/trpc";
import { fmtBu, fmtLbs } from "@contracts/grain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtDateTime(d: Date | null): string {
  if (!d) return "never";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fillTone(pct: number): string {
  if (pct > 90) return "text-crit";
  if (pct >= 70) return "text-go";
  return "text-stable";
}

/**
 * Office portal home: today's mirrored activity across sites, per-site bin
 * levels, and the end-of-day upload history pushed by each scale house.
 */
export default function OfficeHome() {
  const overview = trpc.office.overview.useQuery();
  const today = trpc.office.todayLoads.useQuery();
  const eod = trpc.office.eodReports.useQuery();

  return (
    <div className="space-y-6">
      {/* today's totals across all sites */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="gt-eyebrow">Loads today</div>
            {today.isPending ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <div className="mt-1 font-mono text-xl font-bold tabular-nums">
                {today.data?.loadCount ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="gt-eyebrow">Completed today</div>
            {today.isPending ? (
              <Skeleton className="mt-2 h-7 w-16" />
            ) : (
              <div className="mt-1 font-mono text-xl font-bold tabular-nums">
                {today.data?.completedCount ?? 0}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="gt-eyebrow">Net today</div>
            {today.isPending ? (
              <Skeleton className="mt-2 h-7 w-24" />
            ) : (
              <div className="mt-1 font-mono text-xl font-bold tabular-nums">
                {fmtLbs(today.data?.netLbs ?? 0)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">lb</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* per-site cards */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest">Sites</h2>
        {overview.isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            {["a", "b"].map((k) => (
              <Card key={k}>
                <CardContent className="p-4">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !overview.data?.length ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No sites yet — they appear here as scale houses sync in.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {overview.data.map((s) => (
              <Card key={s.site.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-baseline justify-between text-base">
                    <span>{s.site.name}</span>
                    <span className={fillTone(s.fillPct)}>{s.fillPct}% full</span>
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.site.location ?? "—"}
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {s.todaySheets} sheet{s.todaySheets === 1 ? "" : "s"} today
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 font-mono text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">On hand</span>
                    <span>
                      {fmtLbs(s.currentLbs)} / {fmtLbs(s.capacityLbs)} lb
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last EOD upload</span>
                    <span>{fmtDateTime(s.lastReceiveAt)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* end-of-day upload history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest">
          End-of-day uploads
        </h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Sheets</TableHead>
                  <TableHead className="text-right">Loads</TableHead>
                  <TableHead className="text-right">Inbound</TableHead>
                  <TableHead className="text-right">Outbound</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eod.isPending ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : !eod.data?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No end-of-day reports received yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  eod.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.day}</TableCell>
                      <TableCell>{r.siteName ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.sheetsOpened}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.completedCount}/{r.loadCount}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtLbs(r.inboundLbs)} lb
                        <span className="ml-1 text-muted-foreground">
                          ({fmtBu(r.inboundBu)} bu)
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtLbs(r.outboundLbs)} lb
                        <span className="ml-1 text-muted-foreground">
                          ({fmtBu(r.outboundBu)} bu)
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {fmtDateTime(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
