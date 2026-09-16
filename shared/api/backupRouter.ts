import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { assertAdmin } from "./lib/adminPassword";
import { exportAll, importAll } from "./lib/backupRestore";

// Full-database backup/restore from within the app (Reports page). The
// export is a portable JSON document downloaded by the browser; restore
// replaces ALL data with an uploaded document — both are admin-gated.
export const backupRouter = createRouter({
  export: publicQuery
    .input(z.object({ adminPassword: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      assertAdmin(input?.adminPassword);
      const payload = await exportAll();
      const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[T:]/g, "-");
      return {
        filename: `graintracker-backup-${stamp}.json`,
        payload,
      };
    }),

  restore: publicQuery
    .input(
      z.object({
        adminPassword: z.string().optional(),
        payload: z.unknown(),
      }),
    )
    .mutation(async ({ input }) => {
      assertAdmin(input.adminPassword);
      const counts = await importAll(input.payload);
      const tables = Object.entries(counts)
        .filter(([, c]) => c > 0)
        .map(([t, c]) => `${t}: ${c}`)
        .join(", ");
      return { ok: true, counts, summary: tables };
    }),
});

export type BackupRouter = typeof backupRouter;
