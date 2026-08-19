import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { CROPS } from "@db/schema";
import * as grain from "./queries/grain";

const cropEnum = z.enum(CROPS);

const sheetsRouter = createRouter({
  open: publicQuery.query(() => grain.listOpenSheets()),

  list: publicQuery
    .input(z.object({ limit: z.number().int().min(1).max(100).default(10) }))
    .query(({ input }) => grain.listRecentSheets(input.limit)),

  get: publicQuery
    .input(z.object({ id: z.number().int() }))
    .query(({ input }) => grain.getSheetDetail(input.id)),

  truckTares: publicQuery.query(() => grain.truckTares()),

  dailyReport: publicQuery.query(() => grain.dailyReport()),

  recentActivity: publicQuery
    .input(
      z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional(),
    )
    .query(({ input }) => grain.recentActivity(input?.limit ?? 30)),

  create: publicQuery
    .input(
      z.object({
        siteId: z.number().int(),
        lotId: z.number().int().optional(),
        quickLot: z
          .object({
            farmerName: z.string().min(1),
            crop: cropEnum,
            landlordName: z.string().optional(),
            splitPct: z.number().int().min(0).max(100).optional(),
          })
          .optional(),
        direction: z.enum(["INBOUND", "OUTBOUND"]),
      }),
    )
    .mutation(({ input }) => grain.createSheet(input)),

  weighFirst: publicQuery
    .input(
      z.object({
        sheetId: z.number().int(),
        weightLbs: z.number().positive(),
        truckId: z.string().min(1),
        binId: z.number().int().nullish(),
      }),
    )
    .mutation(({ input }) => grain.weighFirst(input)),

  weighSecond: publicQuery
    .input(
      z.object({
        sheetId: z.number().int(),
        weightLbs: z.number().positive(),
        binId: z.number().int().nullish(),
      }),
    )
    .mutation(({ input }) => grain.weighSecond(input)),

  voidLoad: publicQuery
    .input(z.object({ loadId: z.number().int() }))
    .mutation(({ input }) => grain.voidLoad(input)),

  gradeLoad: publicQuery
    .input(
      z.object({
        loadId: z.number().int(),
        moisture: z.number().min(0).max(60).nullish(),
        testWeight: z.number().min(0).max(80).nullish(),
      }),
    )
    .mutation(({ input }) => grain.gradeLoad(input)),

  close: publicQuery
    .input(z.object({ sheetId: z.number().int() }))
    .mutation(({ input }) => grain.closeSheet(input)),
});

const coreRouter = createRouter({
  bins: createRouter({
    list: publicQuery.query(() => grain.listBins()),
  }),
  sites: createRouter({
    list: publicQuery.query(() => grain.listSites()),
  }),
  farmers: createRouter({
    list: publicQuery.query(() => grain.listFarmers()),
  }),
  lots: createRouter({
    list: publicQuery.query(() => grain.listLots()),
  }),
});

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  sheets: sheetsRouter,
  core: coreRouter,
});

export type AppRouter = typeof appRouter;
