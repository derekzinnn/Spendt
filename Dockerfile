# syntax=docker/dockerfile:1

# Spendly / Casa — one build, three images.
#
#   target: api       the Express server (node dist/server.js)
#   target: migrator   a short-lived container that runs `prisma migrate deploy` and exits
#   target: web        nginx serving apps/web/dist with the SPA fallback
#
# Caddy puts them on one origin: /api/* to the api, everything else to the web.

# ---- Base: pnpm on Node 24 ----------------------------------------------------
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@11.2.2

# ---- Builder: install once, build both apps -----------------------------------
FROM base AS builder
WORKDIR /repo

# Manifests first, so a code-only change does not reinstall the world.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# The api's postinstall runs `prisma generate`, which needs the schema and the config.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @spendly/api build
RUN pnpm --filter @spendly/web build
# A production-only tree for the api: the bundle inlines @spendly/shared, but the
# native and runtime dependencies (@node-rs/argon2, @prisma/client, express…) stay out.
# --legacy: pnpm 10+ refuses to deploy a workspace that does not inject its packages.
RUN pnpm --filter @spendly/api deploy --prod --legacy /out

# ---- Migrator: applies pending migrations, then exits --------------------------
# It keeps the dev dependencies on purpose — the Prisma CLI lives there. The schema
# engine is a native binary, so it needs openssl.
FROM builder AS migrator
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /repo/apps/api
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# ---- API runtime ---------------------------------------------------------------
FROM node:24-slim AS api
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333

# Runs as the image's unprivileged "node" user: a bug in the app must not come with root.
COPY --from=builder --chown=node:node /out/node_modules ./node_modules
COPY --from=builder --chown=node:node /out/dist ./dist

USER node
EXPOSE 3333

# Node 24 has fetch built in, so the check needs nothing installed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]

# ---- Web runtime ---------------------------------------------------------------
FROM nginx:1.27-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
