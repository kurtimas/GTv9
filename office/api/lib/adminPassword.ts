import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "./env";

// --- Admin password (guards administrative mutations) ----------------------
// Verified server-side against ADMIN_PASSWORD; the client sends it in the
// POST body of each guarded mutation (never as a query param).
let warnedDefaultPassword = false;
const adminHash = () => createHash("sha256").update(env.ADMIN_PASSWORD).digest();

// --- Brute-force guard ------------------------------------------------------
// admin.verify and every assertAdmin call are an oracle for the password; cap
// failed attempts in a rolling window so it can't be guessed offline-speed.
const VERIFY_WINDOW_MS = 60_000;
const VERIFY_MAX_FAILURES = 5;
let verifyFailures: number[] = [];

export function usingDefaultAdminPassword(): boolean {
  return env.ADMIN_PASSWORD === "grain-admin";
}

export function verifyAdminPassword(given: string): boolean {
  if (!warnedDefaultPassword && usingDefaultAdminPassword()) {
    warnedDefaultPassword = true;
    console.warn(
      "[admin] Using default ADMIN_PASSWORD — set ADMIN_PASSWORD in the environment to change it",
    );
  }
  const cutoff = Date.now() - VERIFY_WINDOW_MS;
  verifyFailures = verifyFailures.filter((t) => t > cutoff);
  if (verifyFailures.length >= VERIFY_MAX_FAILURES) {
    throw new Error("Too many admin password attempts — wait a minute and try again");
  }
  const h = createHash("sha256").update(given).digest();
  const ok = h.length === adminHash().length && timingSafeEqual(h, adminHash());
  if (!ok) verifyFailures.push(Date.now());
  return ok;
}

export function assertAdmin(given: string | undefined): void {
  if (!given || !verifyAdminPassword(given)) {
    throw new Error("Admin password required");
  }
}
