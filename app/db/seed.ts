import { getDb } from "../api/queries/connection";
import {
  activity,
  bins,
  farmers,
  loads,
  lots,
  sheets,
  sites,
  
} from "./schema";

const TEST_W: Record<string, number> = { Corn: 56, Soybeans: 60, Wheat: 60 };

function todayAt(h: number, m = 0): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export async function seedDatabase() {
  const db = getDb();
  console.log("Seeding database...");

  // wipe (fresh dev DB)
  await db.delete(activity);
  await db.delete(loads);
  await db.delete(sheets);
  await db.delete(lots);
  await db.delete(bins);
  await db.delete(farmers);
  await db.delete(sites);

  const sr = await db.insert(sites).values({ name: "Home Farm" });
  const site = { id: Number(sr[0].insertId) };

  const farmerNames = ["J. Kowalski", "R. Mendez", "A. Thompson", "D. Weaver"];
  const farmerIds: Record<string, number> = {};
  for (const name of farmerNames) {
    const r = await db.insert(farmers).values({ name });
    farmerIds[name] = Number(r[0].insertId);
  }

  const binDefs = [
    { name: "BIN 01", crop: "Corn" as const, cap: 400_000, cur: 268_000 },
    { name: "BIN 02", crop: "Corn" as const, cap: 400_000, cur: 372_000 }, // crit >90
    { name: "BIN 03", crop: "Corn" as const, cap: 320_000, cur: 96_000 },
    { name: "BIN 04", crop: "Soybeans" as const, cap: 320_000, cur: 249_600 }, // warn 78
    { name: "BIN 05", crop: "Soybeans" as const, cap: 240_000, cur: 52_800 },
    { name: "BIN 06", crop: "Wheat" as const, cap: 240_000, cur: 48_000 },
    { name: "BIN 07", crop: "Wheat" as const, cap: 320_000, cur: 272_000 }, // warn 85
    { name: "BIN 08", crop: "Corn" as const, cap: 400_000, cur: 388_000 }, // crit 97
  ];
  const binIds: Record<string, number> = {};
  for (const b of binDefs) {
    const r = await db.insert(bins).values({
      siteId: site.id,
      name: b.name,
      crop: b.crop,
      capacityLbs: b.cap,
      currentLbs: b.cur,
    });
    binIds[b.name] = Number(r[0].insertId);
  }

  const lotDefs = [
    { farmer: "J. Kowalski", code: "C-12", crop: "Corn" as const, landlord: "Hansen Land Co", split: 33 },
    { farmer: "J. Kowalski", code: "C-18", crop: "Corn" as const },
    { farmer: "R. Mendez", code: "S-04", crop: "Soybeans" as const },
    { farmer: "A. Thompson", code: "W-21", crop: "Wheat" as const, landlord: "Prairie Trust", split: 25 },
    { farmer: "D. Weaver", code: "C-30", crop: "Corn" as const },
  ];
  const lotIds: Record<string, number> = {};
  for (const l of lotDefs) {
    const r = await db.insert(lots).values({
      siteId: site.id,
      farmerId: farmerIds[l.farmer],
      code: l.code,
      crop: l.crop,
      landlordName: l.landlord ?? null,
      splitPct: l.split ?? null,
    });
    lotIds[l.code] = Number(r[0].insertId);
  }

  // ---- helpers ----
  let ticket = 0;
  const nextTicket = () => `T-${String(++ticket).padStart(5, "0")}`;
  const mkLoad = async (
    sheetId: number,
    seq: number,
    truckId: string,
    gross: number,
    tare: number,
    binName: string | null,
    crop: string,
    direction: "INBOUND" | "OUTBOUND",
    when: Date,
    opts?: { onScale?: boolean; moisture?: number },
  ) => {
    const net = Math.abs(gross - tare);
    const bu = Math.round((net / TEST_W[crop]) * 100) / 100;
    await db.insert(loads).values({
      sheetId,
      seq,
      truckId,
      firstWeightLbs: direction === "INBOUND" ? gross : tare,
      secondWeightLbs: opts?.onScale ? null : direction === "INBOUND" ? tare : gross,
      grossLbs: opts?.onScale ? null : gross,
      tareLbs: opts?.onScale ? null : tare,
      netLbs: opts?.onScale ? null : net,
      bushels: opts?.onScale ? null : String(bu),
      binId: binName ? binIds[binName] : null,
      status: opts?.onScale ? "ON_SCALE" : "COMPLETE",
      moisture: opts?.onScale ? null : (opts?.moisture != null ? String(opts.moisture) : null),
      createdAt: when,
      completedAt: opts?.onScale ? null : when,
    });
  };

  const mkSheet = async (
    lotCode: string,
    direction: "INBOUND" | "OUTBOUND",
    status: "OPEN" | "CLOSED",
    openedAt: Date,
  ) => {
    const t = nextTicket();
    const r = await db.insert(sheets).values({
      ticketNo: t,
      siteId: site.id,
      lotId: lotIds[lotCode],
      direction,
      status,
      createdAt: openedAt,
      closedAt: status === "CLOSED" ? new Date(openedAt.getTime() + 90 * 60000) : null,
    });
    return { id: Number(r[0].insertId), ticketNo: t };
  };

  const act = (kind: "weigh_in" | "weigh_out" | "create" | "close", message: string, ts: Date) =>
    db.insert(activity).values({ kind, message, ts });

  // ---- closed sheets earlier today (throughput across hours) ----
  const closedPlan: {
    lot: string; dir: "INBOUND" | "OUTBOUND"; hour: number;
    trucks: [string, number, number][]; bin: string | null; crop: string;
  }[] = [
    { lot: "C-12", dir: "INBOUND", hour: 7, bin: "BIN 01", crop: "Corn", trucks: [["KM-04 Peterbilt", 81_400, 29_500], ["RW-11", 79_900, 28_900]] },
    { lot: "S-04", dir: "INBOUND", hour: 8, bin: "BIN 04", crop: "Soybeans", trucks: [["RM-02 Freightliner", 76_200, 27_800]] },
    { lot: "W-21", dir: "INBOUND", hour: 9, bin: "BIN 07", crop: "Wheat", trucks: [["AT-77", 74_500, 27_100], ["AT-78", 75_100, 27_300]] },
    { lot: "C-18", dir: "INBOUND", hour: 10, bin: "BIN 03", crop: "Corn", trucks: [["KM-04 Peterbilt", 82_000, 29_400], ["KM-07", 80_300, 29_100]] },
    { lot: "C-12", dir: "OUTBOUND", hour: 11, bin: "BIN 02", crop: "Corn", trucks: [["DW-02", 78_600, 28_200]] },
    { lot: "C-30", dir: "INBOUND", hour: 12, bin: "BIN 03", crop: "Corn", trucks: [["DW-02", 79_800, 28_400], ["KM-04 Peterbilt", 81_700, 29_300]] },
  ];
  for (const p of closedPlan) {
    const s = await mkSheet(p.lot, p.dir, "CLOSED", todayAt(p.hour, 5));
    await act("create", `Sheet ${s.ticketNo} opened · Lot ${p.lot} · ${p.dir.toLowerCase()}`, todayAt(p.hour, 5));
    let seq = 0;
    for (const [truck, gross, tare] of p.trucks) {
      seq += 1;
      const w = todayAt(p.hour, 10 + seq * 12);
      await mkLoad(s.id, seq, truck, gross, tare, p.bin, p.crop, p.dir, w, { moisture: p.crop === "Corn" ? 15.2 : undefined });
      await act("weigh_out", `${truck} weighed out · net ${Math.abs(gross - tare).toLocaleString()} lbs · ${s.ticketNo}`, w);
    }
    await act("close", `Sheet ${s.ticketNo} closed`, new Date(todayAt(p.hour, 5).getTime() + 90 * 60000));
  }

  // ---- OPEN sheets ----
  // 1) four completed loads, corn inbound
  const o1 = await mkSheet("C-12", "INBOUND", "OPEN", todayAt(13, 20));
  await act("create", `Sheet ${o1.ticketNo} opened · Lot C-12 · inbound`, todayAt(13, 20));
  const o1loads: [string, number, number][] = [
    ["KM-04 Peterbilt", 81_900, 29_450],
    ["RW-11", 80_100, 28_850],
    ["KM-07", 80_900, 29_050],
    ["KM-04 Peterbilt", 81_600, 29_350],
  ];
  for (let i = 0; i < o1loads.length; i++) {
    const [truck, g, t] = o1loads[i];
    const w = todayAt(13, 30 + i * 14);
    await mkLoad(o1.id, i + 1, truck, g, t, "BIN 01", "Corn", "INBOUND", w,
      i === 3 ? {} : { moisture: 15.4 }); // last load needs grade
    await act("weigh_out", `${truck} weighed out · net ${(g - t).toLocaleString()} lbs · ${o1.ticketNo}`, w);
  }

  // 2) truck currently ON THE SCALE
  const o2 = await mkSheet("S-04", "INBOUND", "OPEN", todayAt(14, 40));
  await act("create", `Sheet ${o2.ticketNo} opened · Lot S-04 · inbound`, todayAt(14, 40));
  await mkLoad(o2.id, 1, "RM-02 Freightliner", 77_300, 0, "BIN 04", "Soybeans", "INBOUND", todayAt(14, 55), { onScale: true });
  await act("weigh_in", `RM-02 Freightliner weighed in · 77,300 lbs · ${o2.ticketNo}`, todayAt(14, 55));

  // 3) fresh sheet, no loads yet
  const o3 = await mkSheet("W-21", "OUTBOUND", "OPEN", todayAt(15, 10));
  await act("create", `Sheet ${o3.ticketNo} opened · Lot W-21 · outbound`, todayAt(15, 10));

  console.log("Seed complete.");
}

/** Seed only when the sites table is empty (safe for boot-time calls). */
export async function seedIfEmpty(): Promise<boolean> {
  const db = getDb();
  const existing = await db.select().from(sites).limit(1);
  if (existing.length > 0) return false;
  await seedDatabase();
  return true;
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
