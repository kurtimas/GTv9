import { getTableColumns, sql } from "drizzle-orm";
import { getDb, isOffline } from "../queries/connection";
import * as schema from "../../db/schema";

// Full-database backup/restore as a self-describing JSON document.
//
// Why not mysqldump: the app container has no mysql client (and no docker
// socket), so backups are produced and consumed through the app's own DB
// connection — same data, but a portable JSON document instead of SQL text.
// The server-side nightly `grain-backup` (real mysqldump) continues to run
// alongside this; the two formats are NOT interchangeable.

type AnyTable = Record<string, unknown>;
type Rows = Record<string, unknown>[];

export interface BackupPayload {
  app: "grain-tracker";
  kind: "full";
  version: 1;
  createdAt: string;
  /** table name → all rows */
  tables: Record<string, Rows>;
}

// Parents first, children after — cosmetic with FK checks suspended, but it
// keeps hand-inspection sane. Child → parent for the clear pass.
const TABLES: [string, AnyTable][] = [
  ["settings", schema.settings as AnyTable],
  ["sites", schema.sites as AnyTable],
  ["farmers", schema.farmers as AnyTable],
  ["landlords", schema.landlords as AnyTable],
  ["bins", schema.bins as AnyTable],
  ["lots", schema.lots as AnyTable],
  ["weight_sheets", schema.weightSheets as AnyTable],
  ["loads", schema.loads as AnyTable],
  ["sheet_events", schema.sheetEvents as AnyTable],
  ["bin_movements", schema.binMovements as AnyTable],
  ["shipments", schema.shipments as AnyTable],
  ["eod_reports", schema.eodReports as AnyTable],
  ["sync_log", schema.syncLog as AnyTable],
  ["audit_log", schema.auditLog as AnyTable],
];

/** Snapshot every table into a portable payload. */
export async function exportAll(): Promise<BackupPayload> {
  const db = getDb();
  const tables: BackupPayload["tables"] = {};
  for (const [name, table] of TABLES) {
    tables[name] = (await db.select().from(table as never)) as Rows;
  }
  return {
    app: "grain-tracker",
    kind: "full",
    version: 1,
    createdAt: new Date().toISOString(),
    tables,
  };
}

function reviveRow(
  cols: Record<string, { dataType?: string }>,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const col = cols[key];
    if (
      col?.dataType === "date" &&
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(value)
    ) {
      out[key] = new Date(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Replace the entire database with the payload's contents. Validated against
 * the known table set, run in one transaction (FK checks suspended), with
 * auto-increment counters raised past the restored ids afterwards.
 */
export async function importAll(payload: unknown): Promise<Record<string, number>> {
  if (!payload || typeof payload !== "object") {
    throw new Error("That file is not a Grain Tracker backup");
  }
  const p = payload as Partial<BackupPayload>;
  if (p.app !== "grain-tracker" || p.kind !== "full" || !p.tables) {
    throw new Error("That file is not a Grain Tracker full backup");
  }
  const known = new Map(TABLES);
  const unknownTables = Object.keys(p.tables).filter((t) => !known.has(t));
  if (unknownTables.length > 0) {
    throw new Error(
      `Backup contains tables this version does not know: ${unknownTables.join(", ")}`,
    );
  }

  const counts: Record<string, number> = {};
  const offline = isOffline();
  const db = getDb();

  await db.transaction(async (tx) => {
    // MySQL: suspend FK enforcement for the clear+load (session-scoped).
    // SQLite (offline dev): foreign keys are off by default on this handle.
    if (!offline) {
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    }
    // Clear child → parent. DELETE (not TRUNCATE) keeps the pass
    // transactional; auto-increment counters are fixed up afterwards.
    for (let i = TABLES.length - 1; i >= 0; i--) {
      await tx.delete(TABLES[i][1] as never);
    }
    for (const [name, table] of TABLES) {
      const rows = (p.tables[name] ?? []) as Rows;
      const cols = getTableColumns(table as never) as Record<
        string,
        { dataType?: string }
      >;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r) => reviveRow(cols, r));
        if (chunk.length > 0) {
          await tx.insert(table as never).values(chunk);
        }
      }
      counts[name] = rows.length;
    }
    if (!offline) {
      await tx.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    }
  });

  // Raise AUTO_INCREMENT past the restored ids (DELETE leaves the counter
  // untouched). ALTER implicitly commits, so this runs after the payload
  // transaction — MySQL only; SQLite tracks the counter per inserted row.
  if (!offline) {
    for (const [name] of TABLES) {
      const rows = (p.tables[name] ?? []) as Rows;
      const maxId = rows.reduce((m, r) => Math.max(m, Number(r.id ?? 0)), 0);
      if (maxId > 0) {
        await db.execute(
          sql.raw(`ALTER TABLE \`${name}\` AUTO_INCREMENT = ${maxId + 1}`),
        );
      }
    }
  }

  return counts;
}
