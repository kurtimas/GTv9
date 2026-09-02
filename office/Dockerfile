# Grain Tracker v2 — full-stack (Vite frontend + Hono/tRPC API + Drizzle/MySQL)
FROM node:20-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production-only dependencies (same toolchain so native modules build)
FROM node:20-slim AS deps-prod
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Runtime: no build toolchain, no sources, unprivileged user
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Day boundaries (daily report / EOD close) follow the container clock —
# override for your locale, e.g. -e TZ=America/Chicago. Keep MySQL on the
# same zone so TIMESTAMP conversion stays consistent.
ENV TZ=UTC

COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/db/migrations ./db/migrations

# Unprivileged runtime user; ./data is where offline mode would write
RUN useradd --system --create-home grain \
    && mkdir -p /app/data && chown grain:grain /app/data
USER grain

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Boots dist/boot.js: applies DB migrations (+ demo seed only when SEED_DEMO
# is enabled and the database is empty), then serves.
CMD ["node", "dist/boot.js"]
