import path from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { getDb, initDb, isOffline } from "./queries/connection";
import { env } from "./lib/env";
import { seedIfEmpty } from "../db/seed";

/**
 * Runs once at server start: establishes the database (MySQL, or the embedded
 * offline database when MySQL is missing/unreachable), applies migrations for
 * MySQL, then loads the demo dataset if allowed and the database is empty.
 *
 * A failed migration aborts the boot — a server that "looks healthy" against
 * a stale schema fails on every write at the scale. Seed failures are only
 * logged.
 */
export async function migrateAndSeedOnBoot() {
  await initDb();
  const db = getDb();
  if (isOffline()) {
    console.log("[boot] running in OFFLINE MODE (embedded local database)");
  } else {
    try {
      await migrate(db, {
        migrationsFolder: path.resolve(process.cwd(), "db/migrations"),
      });
      console.log("[boot] database schema up to date");
    } catch (err) {
      console.error("[boot] database migration failed:", err);
      if (env.isProduction) process.exit(1);
      throw err;
    }
  }
  if (!env.SEED_DEMO) {
    console.log("[boot] SEED_DEMO off — skipping demo dataset");
    return;
  }
  try {
    const seeded = await seedIfEmpty();
    if (seeded) console.log("[boot] demo dataset loaded");
  } catch (err) {
    console.error("[boot] demo seed failed (continuing):", err);
  }
}
