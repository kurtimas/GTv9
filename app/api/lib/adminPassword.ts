import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// --- Admin password (guards administrative mutations) ----------------------
// Verified server-side against ADMIN_PASSWORD; the client sends it in the
// POST body of each guarded mutation (never as a query param).
let warnedDefaultPassword = false;
const adminHash = () => createHash("sha256").update(env.ADMIN_PASSWORD).digest();

export function verifyAdminPassword(given: string): boolean {
  if (!warnedDefaultPassword && env.ADMIN_PASSWORD === "grain-admin") {
    warnedDefaultPassword = true;
    console.warn(
      "[admin] Using default ADMIN_PASSWORD — set ADMIN_PASSWORD in the environment to change it",
    );
  }
  const h = createHash("sha256").update(given).digest();
  return h.length === adminHash().length && timingSafeEqual(h, adminHash());
}

export function assertAdmin(given: string | undefined): void {
  if (!given || !verifyAdminPassword(given)) {
    throw new Error("Admin password required");
  }
}
