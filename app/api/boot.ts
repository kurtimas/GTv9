import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

// Ensure DB schema + seed on boot (idempotent; non-fatal if DB not yet reachable —
// the dashboard shows its retryable "database initializing" banner until it is).
async function ensureDatabase() {
  try {
    const { migrate } = await import("drizzle-orm/mysql2/migrator");
    const { getDb } = await import("./queries/connection");
    const path = await import("node:path");
    await migrate(getDb(), {
      migrationsFolder: path.resolve(process.cwd(), "db/migrations"),
    });
    const { seedIfEmpty } = await import("@db/seed");
    const seeded = await seedIfEmpty();
    console.log(seeded ? "Database seeded." : "Database ready.");
  } catch (e) {
    console.warn("DB ensure failed (will retry on next boot):", e);
  }
}
void ensureDatabase();

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
