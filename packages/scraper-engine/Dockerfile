# Single-stage build — Playwright base image with Node.js
# Must match the `playwright` version in pnpm-lock.yaml: each Playwright release
# expects its own browser build, which only the same-version image ships.
# Enforced by src/tests/playwright-image-version.test.ts.
FROM mcr.microsoft.com/playwright:v1.64.1-jammy
WORKDIR /app

# Node.js comes with the Playwright base image (it bundles the current Node
# release it supports; v1.64.1-jammy ships Node 26). A separate NodeSource
# install used to be layered on top; it is redundant, and since Node 20 went
# end-of-life the 20.x setup script no longer pins anything, so it is gone.
# curl stays for the HEALTHCHECK below.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# pnpm pinned to the workspace's packageManager version. corepack is not used
# here: installing it from npm collides with the yarn shims the image ships.
RUN npm install -g pnpm@10.33.0

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
