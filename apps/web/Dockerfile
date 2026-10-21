# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for dependency resolution
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

# Install dependencies
# A BuildKit cache mount for pnpm's content-addressable store. Packages
# downloaded by one build are reused by the next, so rebuilds (and CI runs with
# a warm cache) skip the network entirely instead of re-fetching the whole tree.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

# Copy source code
COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/

# Accept build-time env vars so they get baked into the JS bundle
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENABLE_DEMO_GOOGLE_AUTH=true
ENV NEXT_PUBLIC_ENABLE_DEMO_GOOGLE_AUTH=$NEXT_PUBLIC_ENABLE_DEMO_GOOGLE_AUTH
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Build Next.js (standalone output)
RUN pnpm --filter @tenderbazaar/web run build

# ── Stage 2: Production ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://0.0.0.0:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
