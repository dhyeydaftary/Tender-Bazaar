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
COPY packages/notification-service/package.json packages/notification-service/
COPY packages/shared/package.json packages/shared/
COPY prisma/ prisma/

# Install dependencies
# A BuildKit cache mount for pnpm's content-addressable store. Packages
# downloaded by one build are reused by the next, so rebuilds (and CI runs with
# a warm cache) skip the network entirely instead of re-fetching the whole tree.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

# Copy source code
COPY packages/notification-service/ packages/notification-service/
COPY packages/shared/ packages/shared/

# Generate Prisma client and build
RUN npx prisma generate
RUN pnpm --filter @tenderbazaar/notification-service run build

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

ENV NODE_ENV=production

# A real check: this service's job is to consume the notification queue, so the
# healthcheck proves it can actually reach Redis. The previous command was
# `node -e "process.exit(0)"`, which passes unconditionally and so reported a
# healthy container no matter what state the service was in.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD ["node", "/app/packages/notification-service/healthcheck.js"]

CMD ["node", "packages/notification-service/dist/index.js"]
