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
RUN pnpm install --frozen-lockfile

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

EXPOSE 4001

HEALTHCHECK --interval=60s --timeout=15s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4001/api/health || exit 1

CMD ["node", "packages/scraper-engine/dist/main.js"]
