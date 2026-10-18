# Single-stage build for pnpm monorepo compatibility
FROM node:20-alpine
WORKDIR /app

# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for dependency resolution
COPY packages/api-server/package.json packages/api-server/
COPY packages/shared/package.json packages/shared/
COPY prisma/ prisma/

# Install dependencies
# A BuildKit cache mount for pnpm's content-addressable store. Packages
# downloaded by one build are reused by the next, so rebuilds (and CI runs with
# a warm cache) skip the network entirely instead of re-fetching the whole tree.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

# Copy source code
COPY packages/api-server/ packages/api-server/
COPY packages/shared/ packages/shared/

# Generate Prisma client and build
RUN npx prisma generate
RUN pnpm --filter @tenderbazaar/api-server run build

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "packages/api-server/dist/index.js"]
