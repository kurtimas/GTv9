import { relations } from "drizzle-orm";
import { sites, farmers, lots, bins, sheets, loads } from "./schema";

export const sitesRelations = relations(sites, ({ many }) => ({
  lots: many(lots),
  bins: many(bins),
  sheets: many(sheets),
}));

export const farmersRelations = relations(farmers, ({ many }) => ({
  lots: many(lots),
}));

export const lotsRelations = relations(lots, ({ one, many }) => ({
  site: one(sites, { fields: [lots.siteId], references: [sites.id] }),
  farmer: one(farmers, { fields: [lots.farmerId], references: [farmers.id] }),
  sheets: many(sheets),
}));

export const binsRelations = relations(bins, ({ one, many }) => ({
  site: one(sites, { fields: [bins.siteId], references: [sites.id] }),
  loads: many(loads),
}));

export const sheetsRelations = relations(sheets, ({ one, many }) => ({
  site: one(sites, { fields: [sheets.siteId], references: [sites.id] }),
  lot: one(lots, { fields: [sheets.lotId], references: [lots.id] }),
  loads: many(loads),
}));

export const loadsRelations = relations(loads, ({ one }) => ({
  sheet: one(sheets, { fields: [loads.sheetId], references: [sheets.id] }),
  bin: one(bins, { fields: [loads.binId], references: [bins.id] }),
}));
