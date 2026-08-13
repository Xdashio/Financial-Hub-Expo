# Build context: monorepo root (required — needs packages/shared)
#   docker build -f apps/api/Dockerfile .
#   Railway: railway.toml at repo root (dockerfilePath = apps/api/Dockerfile)
# Force rebuild for CORS fix - Aug 13 2026

# Node 22+: @supabase/supabase-js needs native WebSocket (Node 20 crashes at boot).
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install only what the API graph needs (shared + api)
RUN pnpm install --frozen-lockfile --filter api...

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @financial-hub/shared build \
 && pnpm --filter api build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Keep workspace layout so pnpm's file: link to @financial-hub/shared resolves.
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 3000

CMD ["node", "dist/main.js"]
