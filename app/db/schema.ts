import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  timestamp,
  bigint,
  int,
  decimal,
} from "drizzle-orm/mysql-core";

export const CROPS = ["Corn", "Soybeans", "Wheat"] as const;
export type Crop = (typeof CROPS)[number];

export const sites = mysqlTable("sites", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
});

export const farmers = mysqlTable("farmers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
});

export const lots = mysqlTable("lots", {
  id: serial("id").primaryKey(),
  siteId: bigint("site_id", { mode: "number", unsigned: true }).notNull(),
  farmerId: bigint("farmer_id", { mode: "number", unsigned: true }).notNull(),
  code: varchar("code", { length: 40 }).notNull(),
  crop: mysqlEnum("crop", CROPS).notNull(),
  landlordName: varchar("landlord_name", { length: 120 }),
  splitPct: int("split_pct"),
});

export const bins = mysqlTable("bins", {
  id: serial("id").primaryKey(),
  siteId: bigint("site_id", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  crop: mysqlEnum("crop", CROPS).notNull(),
  capacityLbs: int("capacity_lbs").notNull(),
  currentLbs: int("current_lbs").notNull().default(0),
});

export const sheets = mysqlTable("sheets", {
  id: serial("id").primaryKey(),
  ticketNo: varchar("ticket_no", { length: 20 }).notNull().unique(),
  siteId: bigint("site_id", { mode: "number", unsigned: true }).notNull(),
  lotId: bigint("lot_id", { mode: "number", unsigned: true }).notNull(),
  direction: mysqlEnum("direction", ["INBOUND", "OUTBOUND"]).notNull(),
  status: mysqlEnum("status", ["OPEN", "CLOSED"]).notNull().default("OPEN"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const loads = mysqlTable("loads", {
  id: serial("id").primaryKey(),
  sheetId: bigint("sheet_id", { mode: "number", unsigned: true }).notNull(),
  seq: int("seq").notNull(),
  truckId: varchar("truck_id", { length: 60 }).notNull(),
  firstWeightLbs: int("first_weight_lbs").notNull(),
  secondWeightLbs: int("second_weight_lbs"),
  grossLbs: int("gross_lbs"),
  tareLbs: int("tare_lbs"),
  netLbs: int("net_lbs"),
  bushels: decimal("bushels", { precision: 12, scale: 2 }),
  binId: bigint("bin_id", { mode: "number", unsigned: true }),
  status: mysqlEnum("status", ["ON_SCALE", "COMPLETE", "VOID"])
    .notNull()
    .default("ON_SCALE"),
  moisture: decimal("moisture", { precision: 5, scale: 2 }),
  testWeight: decimal("test_weight", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const activity = mysqlTable("activity", {
  id: serial("id").primaryKey(),
  ts: timestamp("ts").notNull().defaultNow(),
  kind: mysqlEnum("kind", [
    "weigh_in",
    "weigh_out",
    "create",
    "close",
    "void",
    "grade",
  ]).notNull(),
  message: varchar("message", { length: 255 }).notNull(),
});
