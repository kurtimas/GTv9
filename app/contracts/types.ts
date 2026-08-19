import type {
  sites,
  farmers,
  lots,
  bins,
  sheets,
  loads,
  activity,
  Crop,
} from "@db/schema";

export type { Crop };
export const CROP_TEST_WEIGHT: Record<Crop, number> = {
  Corn: 56,
  Soybeans: 60,
  Wheat: 60,
};

export type Site = typeof sites.$inferSelect;
export type Farmer = typeof farmers.$inferSelect;
export type Lot = typeof lots.$inferSelect;
export type Bin = typeof bins.$inferSelect;
export type Sheet = typeof sheets.$inferSelect;
export type Load = typeof loads.$inferSelect;
export type Activity = typeof activity.$inferSelect;

/** Load as sent to the client — decimal columns normalized to numbers. */
export type ClientLoad = Omit<Load, "bushels" | "moisture" | "testWeight"> & {
  bushels: number | null;
  moisture: number | null;
  testWeight: number | null;
  binName?: string | null;
};

/** Open sheet with everything the dashboard needs. */
export interface OpenSheet {
  sheet: Sheet;
  lot: Lot;
  farmer: Farmer;
  loads: ClientLoad[];
  activeLoad: ClientLoad | null;
  completedCount: number;
  netLbs: number;
  bushels: number;
  lastTruckId: string | null;
  needsGrade: boolean;
}

export interface TruckTare {
  truckId: string;
  avgTareLbs: number;
  loads: number;
}

export interface DailyReport {
  inboundLbs: number;
  inboundBu: number;
  outboundLbs: number;
  outboundBu: number;
  loadsWeighedOut: number;
  sheetsOpened: number;
  onScaleCount: number;
  binUtilization: { pct: number; totalLbs: number; binCount: number };
  hourly: { hour: number; lbs: number; loads: number }[];
  cropMix: { crop: Crop; bu: number }[];
}

export interface SheetDetail {
  sheet: Sheet;
  lot: Lot;
  farmer: Farmer;
  site: Site;
  loads: ClientLoad[];
}

export interface WeighSecondResult {
  netLbs: number;
  bushels: number;
  sheetFull: boolean;
}

export const TARE_TOLERANCE = 0.03;
export const MAX_LOADS_PER_SHEET = 10;

export * from "./errors";
