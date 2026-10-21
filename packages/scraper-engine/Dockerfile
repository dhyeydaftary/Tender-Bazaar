# Single-stage build — Playwright base image with Node.js
FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app

# Install Node.js 20 + pnpm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for dependency resolution
COPY packages/scraper-engine/package.json packages/scraper-engine/
COPY packages/shared/package.json packages/shared/
COPY prisma/ prisma/

# Install dependencies
# A BuildKit cache mount for pnpm's content-addressable store. Packages
# downloaded by one build are reused by the next, so rebuilds (and CI runs with
# a warm cache) skip the network entirely instead of re-fetching the whole tree.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir=/pnpm-store

# Copy source code
COPY packages/scraper-engine/ packages/scraper-engine/
COPY packages/shared/ packages/shared/

# Generate Prisma client and build
RUN npx prisma generate
RUN pnpm --filter @tenderbazaar/scraper-engine run build

# Environment
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV SCRAPER_API_PORT=4001
ENV SCRAPER_API_ENABLED=true

# Run as the unprivileged user that ships with the Playwright base image,
# instead of root (every other service already drops privileges). The app only
# needs to read /app; logging to a file is off by default.
RUN chown -R pwuser:pwuser /app
USER pwuser

EXPOSE 4001

# /api/ready fails when the scheduler is not running, so a scheduler-less
# container can no longer report itself healthy (/api/health is liveness only).
HEALTHCHECK --interval=60s --timeout=15s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4001/api/ready || exit 1

CMD ["node", "packages/scraper-engine/dist/main.js"]
