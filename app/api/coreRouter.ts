import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { sites, bins, loads } from "@db/schema";
import { eq } from "drizzle-orm";
import { CROPS } from "@contracts/grain";

// --- Admin password (guards site create/edit) ---------------------------
let warnedDefaultPassword = false;
const adminHash = () => createHash("sha256").update(env.ADMIN_PASSWORD).digest();

function verifyAdminPassword(given: string): boolean {
  if (!warnedDefaultPassword && env.ADMIN_PASSWORD === "grain-admin") {
    warnedDefaultPassword = true;
    console.warn(
      "[admin] Using default ADMIN_PASSWORD — set ADMIN_PASSWORD in the environment to change it",
    );
  }
  const h = createHash("sha256").update(given).digest();
  return h.length === adminHash().length && timingSafeEqual(h, adminHash());
}

function assertAdmin(given: string | undefined): void {
  if (!given || !verifyAdminPassword(given)) {
    throw new Error("Admin password required");
  }
}

export const coreRouter = createRouter({
  // ------------------------------------------------------------- admin
  admin: createRouter({
    // Mutation (not query) so the password travels in the POST body.
    verify: publicQuery
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => ({ ok: verifyAdminPassword(input.password) })),
  }),

  // ------------------------------------------------------------- sites
  sites: createRouter({
    list: publicQuery.query(() => getDb().select().from(sites).orderBy(sites.name)),
    create: publicQuery
      .input(
        z.object({
          adminPassword: z.string(),
          name: z.string().min(1),
          location: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        assertAdmin(input.adminPassword);
        const [{ id }] = await getDb()
          .insert(sites)
          .values({ name: input.name, location: input.location })
          .$returningId();
        return getDb().query.sites.findFirst({ where: eq(sites.id, id) });
      }),
    update: publicQuery
      .input(
        z.object({
          adminPassword: z.string(),
          id: z.number(),
          name: z.string().min(1).optional(),
          location: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        assertAdmin(input.adminPassword);
        const { id, ...data } = input;
        delete data.adminPassword;
        if (Object.keys(data).length === 0) throw new Error("Nothing to update");
        await getDb().update(sites).set(data).where(eq(sites.id, id));
        return getDb().query.sites.findFirst({ where: eq(sites.id, id) });
      }),
  }),

  // -------------------------------------------------------------- bins
  bins: createRouter({
    list: publicQuery
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const db = getDb();
        const rows = await db
          .select({ bin: bins, siteName: sites.name })
          .from(bins)
          .leftJoin(sites, eq(bins.siteId, sites.id))
          .where(input?.siteId ? eq(bins.siteId, input.siteId) : undefined)
          .orderBy(sites.name, bins.name);
        return rows.map((r) => ({ ...r.bin, siteName: r.siteName }));
      }),
    create: publicQuery
      .input(
        z.object({
          siteId: z.number(),
          name: z.string().min(1),
          crop: z.enum(CROPS),
          capacityLbs: z.number().int().positive(),
        }),
      )
      .mutation(async ({ input }) => {
        const [{ id }] = await getDb().insert(bins).values(input).$returningId();
        return getDb().query.bins.findFirst({ where: eq(bins.id, id) });
      }),
    update: publicQuery
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          crop: z.enum(CROPS).optional(),
          capacityLbs: z.number().int().positive().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await getDb().update(bins).set(data).where(eq(bins.id, id));
        return getDb().query.bins.findFirst({ where: eq(bins.id, id) });
      }),
    // Delete an empty bin with no ticket history
    delete: publicQuery
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = getDb();
        const bin = await db.query.bins.findFirst({ where: eq(bins.id, input.id) });
        if (!bin) throw new Error("Bin not found");
        if (bin.currentLbs > 0)
          throw new Error("Bin is not empty — adjust the level to 0 before deleting");
        const refs = await db
          .select({ id: loads.id })
          .from(loads)
          .where(eq(loads.binId, input.id))
          .limit(1);
        if (refs.length) throw new Error("Bin has load history and cannot be deleted");
        await db.delete(bins).where(eq(bins.id, input.id));
        return { ok: true };
      }),
    // Manual level correction (e.g. after physical measurement)
    adjust: publicQuery
      .input(z.object({ id: z.number(), currentLbs: z.number().int().min(0) }))
      .mutation(async ({ input }) => {
        await getDb()
          .update(bins)
          .set({ currentLbs: input.currentLbs })
          .where(eq(bins.id, input.id));
        return getDb().query.bins.findFirst({ where: eq(bins.id, input.id) });
      }),
  }),
});

export type CoreRouter = typeof coreRouter;
