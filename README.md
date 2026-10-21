# TenderBazaar

India's Smartest Tender Platform — AI-powered tender aggregation, eligibility checking, and smart alerts.

## Prerequisites

- Node.js 20 LTS (use `nvm use` to activate)
- pnpm (`npm install -g pnpm`)
- Docker & Docker Compose
- Python 3.11+ (for AI service)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> tenderbazaar
cd tenderbazaar
nvm use
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, and Elasticsearch (plus the app services).

> This is the **development** command. It also loads
> `docker-compose.override.yml`, which publishes the database, Redis,
> Elasticsearch and the scraper control API to localhost. For production use
> the explicit two-file form — see
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md):
>
> ```bash
> docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
> # or: ./scripts/docker-start.sh --prod
> ```

### 3. Set up environment

```bash
cp .env.example .env
# Edit .env with your values (defaults work for local development)
```

### 4. Set up database

```bash
pnpm db:generate       # Generate Prisma client
pnpm db:migrate:deploy # Apply committed migrations (use this, not db:push)
pnpm db:seed           # Subscription plans (+ demo tenders outside production)
```

`pnpm db:push` still exists for throwaway experiments, but the schema is
managed by committed Prisma migrations in `prisma/migrations/`. In Docker the
`db-init` container runs `prisma migrate deploy` for you and does **not** seed
unless `DB_INIT_SEED=true`.

The seed never changes an existing administrator's password; it only creates
accounts that are missing, and outside development only from an explicit
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

### 5. Start development

```bash
pnpm dev
```

This starts all apps simultaneously:
- **Web**: http://localhost:3000
- **Admin**: http://localhost:3001
- **API**: http://localhost:4000
- **AI Service**: http://localhost:5000

## Project Structure

```
tenderbazaar/
├── apps/
│   ├── web/              # Main web application (Next.js)
│   ├── admin/            # Admin dashboard (Next.js)
│   └── mobile/           # Mobile app (React Native + Expo)
├── packages/
│   ├── api-server/       # REST API (Express.js)
│   ├── shared/           # Shared types & constants
│   ├── scraper-engine/   # Tender scraping system
│   ├── notification-service/  # Email, Push, WhatsApp, SMS
│   └── ai-service/       # AI eligibility engine (Python)
├── prisma/               # Database schema & migrations
├── docker-compose.yml    # Local infrastructure
└── turbo.json           # Turborepo configuration
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to database |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Mobile**: React Native, Expo Router, NativeWind
- **Backend**: Express.js, TypeScript, Prisma
- **Database**: PostgreSQL 16
- **Search**: Elasticsearch 8.12
- **Cache/Queue**: Redis 7, BullMQ
- **AI**: Python FastAPI, Anthropic Claude API
- **Payments**: Razorpay
