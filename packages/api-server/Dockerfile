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
RUN pnpm install --frozen-lockfile

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
