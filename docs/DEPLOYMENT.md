# TenderBazaar — Production Deployment (Render + Vercel)

This document is the operator's reference for the first production deployment.
Every command below was checked against the package scripts, Dockerfiles and
entry points in this repository (Phase 3, 2026-11-03). It contains no secrets:
generate every value marked **secret** yourself and paste it into the hosting
dashboard only.

## 1. Architecture

| Component | Hosting | Type | Source |
|---|---|---|---|
| Web app | Vercel | Project (root `apps/web`) | Next.js |
| Admin app | Vercel | Project (root `apps/admin`) | Next.js |
| API server | Render | Web Service, native Node | `packages/api-server` |
| PostgreSQL | Render | Managed PostgreSQL (Singapore) | — |
| Redis | Render | Key Value, persistent, `noeviction` | — |
| Notification service | Render | Background Worker, native Node | `packages/notification-service` |
| AI service | Render | Private Service, native Python (or Docker) | `packages/ai-service` |
| Scraper | Render | Private Service, Docker, ≥ 2 GB RAM | `packages/scraper-engine` |
| Elasticsearch | not deployed in v1 | — | optional; search runs on PostgreSQL |

How the services talk to each other:

```
browser ──HTTPS──▶ api-server ──▶ PostgreSQL
   │                 │  ├──▶ Redis (sessions/OTP/limits, BullMQ queues)
   │                 │  ├──HTTP + Bearer AI_SERVICE_TOKEN──▶ ai-service
   │                 │  └──HTTP + Bearer SCRAPER_API_TOKEN──▶ scraper (control API)
   └──(admin app)────┘
notification-service ◀─ Redis queue "notifications" ◀─ api-server
scraper ──▶ PostgreSQL (writes tenders) ──▶ Redis queue "tender-index" ──▶ api-server worker
```

All inter-service addresses are configuration (`AI_SERVICE_URL`,
`SCRAPER_API_URL`, `DATABASE_URL`, `REDIS_URL`); no service assumes another is
on `localhost` in production (the localhost values are development defaults and
the API refuses to start in production with them).

## 2. Render services

### 2.1 Common

- Node version: **20** (`.nvmrc`; `engines.node >= 20`). Set `NODE_VERSION=20` on
  every Node service, or rely on `.nvmrc`.
- Package manager: pnpm 10.33.0 via `corepack` (`packageManager` in the root
  `package.json`). Render's Node runtime provides corepack.
- Monorepo: leave **Root Directory empty** (repository root) for every Node
  service so the pnpm workspace and the root `prisma/` folder are present.
- `NODE_ENV=production` must be set on every service. The API refuses to start
  on Render without it (`RENDER` is detected) and when any production rule
  fails: missing `DATABASE_URL`, non-https `FRONTEND_URL`, weak or shared JWT
  secrets, Redis URL without a password, half a Razorpay key pair, placeholder
  Google client id or AI token.
- Install must not skip devDependencies: `typescript`, `prisma` and `tsx` are
  devDependencies. Because `NODE_ENV=production` is also present at build time,
  pass `--prod=false` explicitly.

### 2.2 API server — Web Service (native Node)

| Setting | Value |
|---|---|
| Root directory | *(empty)* |
| Build command | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm db:generate && pnpm --filter @tenderbazaar/api-server build` |
| Pre-deploy command | `pnpm db:migrate:deploy` |
| Start command | `node packages/api-server/dist/index.js` |
| Health check path | `/health` |
| Port | the API reads `PORT` (Render sets it); do not set it yourself |
| Instances | 1 (see §8, rate limiting and in-process workers) |
| Plan | 1 GB RAM or more |

What the build does: `pnpm db:generate` runs `prisma generate` against
`prisma/schema.prisma` (root script), then `tsc` compiles to
`packages/api-server/dist`. `pnpm db:migrate:deploy` runs `prisma migrate deploy`
(root script) and applies only pending migrations, including
`20261103120000_broadcast_campaigns`. The API never runs migrations itself.

Health semantics (`/health` and `/api/v1/health`):

| HTTP | `status` | Meaning |
|---|---|---|
| 200 | `ok` | PostgreSQL, Redis and Elasticsearch healthy |
| 200 | `degraded` | PostgreSQL and Redis healthy; search served from PostgreSQL (Elasticsearch down or disabled) |
| 503 | `unhealthy` | PostgreSQL or Redis down |

`/health/live` answers 200 whenever the process is up, without probing anything.

Startup order: environment validation → optional-integration report →
PostgreSQL connect (fatal if it fails; Render restarts the service) → **HTTP
listener opens** → alert scheduler → Elasticsearch setup and reindex in the
background (never blocks, never fatal). With `ELASTICSEARCH_ENABLED=false` no
cluster is contacted and the tender-index queue is drained as a no-op.

### 2.3 Notification service — Background Worker (native Node)

| Setting | Value |
|---|---|
| Root directory | *(empty)* |
| Build command | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm db:generate && pnpm --filter @tenderbazaar/notification-service build` |
| Start command | `node packages/notification-service/dist/index.js` |
| Port | none; the worker opens no HTTP port |
| Plan | 512 MB |

It consumes the `notifications` queue from Redis. In production, a channel with
no provider configured **fails the job** (`EMAIL_NOT_CONFIGURED`,
`SMS_NOT_CONFIGURED`, `WHATSAPP_NOT_CONFIGURED`) instead of printing the
message; failed jobs are kept (last 5000) and logged with their attempt count.
Configure an email provider before go-live or password resets will fail.

### 2.4 AI service — Private Service (native Python)

| Setting | Value |
|---|---|
| Root directory | `packages/ai-service` |
| Runtime | Python 3.11 (`PYTHON_VERSION=3.11.9`) |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health check path | `/health` (public, unauthenticated) |
| Plan | 512 MB |

Docker alternative: `packages/ai-service/Dockerfile` (context
`packages/ai-service`) now starts uvicorn on `${PORT:-5000}`.

Every endpoint except `/health` requires `Authorization: Bearer
<AI_SERVICE_TOKEN>` and answers 503 while the token is unset. CORS headers are
sent only for origins listed in `AI_SERVICE_ALLOWED_ORIGINS` (leave empty).
Interactive docs are off unless `AI_SERVICE_EXPOSE_DOCS=true`.

### 2.5 Scraper — Private Service (Docker)

| Setting | Value |
|---|---|
| Runtime | Docker |
| Dockerfile path | `packages/scraper-engine/Dockerfile` |
| Docker build context | *(repository root)* |
| Start | image `CMD`: `node packages/scraper-engine/dist/main.js` |
| Port | reads `PORT` (fallback `SCRAPER_API_PORT`, then 4001) |
| Health check path | `/api/ready` (liveness: `/api/health`) |
| Plan | **2 GB RAM or more**, exactly **1 instance** |

The image is `mcr.microsoft.com/playwright:v1.64.1-jammy`, which bundles its own Node runtime (Node 26 for this tag) plus pnpm 10.33.0 installed by the Dockerfile;
the Playwright browsers ship inside it (`PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`),
so no browser download happens at runtime. The version must match the
`playwright` package in `pnpm-lock.yaml` (enforced by a scraper test).

In production every real portal is **disabled** until its `PORTAL_<NAME>_ENABLED=true`
is set (names in `.env.example`). The control API refuses to start without a
real `SCRAPER_API_TOKEN`.

### 2.6 Vercel (web and admin)

One project per app, Root Directory `apps/web` or `apps/admin`, "Include source
files outside of the Root Directory" enabled, Node 20. Required build variable:
`NEXT_PUBLIC_API_URL=https://<api-service>.onrender.com/api/v1`. The build fails
without it, and on Vercel it must be https and not localhost. Optional:
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GA_ID`.
Never set `NEXT_PUBLIC_DEMO_*`.

## 3. Environment variables

"Secret" marks values that must only ever live in the hosting dashboard.

### 3.1 API server

| Variable | Required | Secret | Purpose | Format |
|---|---|---|---|---|
| `NODE_ENV` | yes | no | Selects production rules; refused on Render otherwise | `production` |
| `PORT` | set by Render | no | Listening port | integer |
| `DATABASE_URL` | yes | yes | PostgreSQL (Prisma) | `postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20` |
| `REDIS_URL` | yes | yes | Sessions, OTP, plan cache, BullMQ | `rediss://default:password@host:6379` (password required in production) |
| `JWT_SECRET` | yes | yes | Signs access tokens | ≥ 32 chars, random (`openssl rand -base64 48`) |
| `JWT_REFRESH_SECRET` | yes | yes | Signs refresh tokens | ≥ 32 chars, different from `JWT_SECRET` |
| `JWT_EXPIRY` | no | no | Access token lifetime | default `15m` |
| `JWT_REFRESH_EXPIRY` | no | no | Refresh token lifetime | default `7d` |
| `FRONTEND_URL` | yes | no | Web origin: CORS allow-list and emailed links | `https://app.example.com` (https, no path) |
| `ADMIN_URL` | if admin deployed | no | Admin origin for CORS | `https://admin.example.com` |
| `CORS_ORIGINS` | no | no | Extra exact origins (custom domain + `*.vercel.app` preview is NOT allowed: wildcards refused) | comma-separated https origins |
| `AI_SERVICE_URL` | yes (for AI features) | no | Where the AI service listens | `https://<ai-service>.onrender.com` or internal URL |
| `AI_SERVICE_TOKEN` | yes (for AI features) | yes | Bearer token sent to the AI service | ≥ 16 chars, random (`openssl rand -hex 24`); unset disables AI calls |
| `SCRAPER_API_URL` | yes | no | Scraper control API | internal URL of the scraper service, e.g. `http://<scraper>:10000` |
| `SCRAPER_API_TOKEN` | yes | yes | Bearer token for the scraper control API | ≥ 16 chars, random |
| `SCRAPER_QUEUE_FALLBACK` | no | no | Queue a run when the scraper API is unreachable | `true` (default) |
| `ELASTICSEARCH_ENABLED` | no | no | `false` for v1 (no cluster) | `true`/`false` |
| `ELASTICSEARCH_URL` | if enabled | yes (if it carries credentials) | Cluster URL | `https://user:pass@host:9200` |
| `ES_REINDEX_PAGE_SIZE` | no | no | Boot reindex page size | integer, default 500 |
| `RAZORPAY_KEY_ID` | for payments | no | Razorpay key id | `rzp_live_...`; set with the secret or not at all |
| `RAZORPAY_KEY_SECRET` | for payments | yes | Razorpay key secret | string |
| `RAZORPAY_WEBHOOK_SECRET` | for payments | yes | Verifies `/api/v1/webhooks/razorpay` | string |
| `GOOGLE_CLIENT_ID` | for Google sign-in | no | Accepted OAuth client id(s) | `<id>.apps.googleusercontent.com`, comma-separated; unset disables |
| `GOOGLE_CLIENT_SECRET` | no | yes | Not used for ID-token verification; may stay unset | string |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` / `MSG91_TEMPLATE_ID` | one SMS provider for phone sign-in | yes / no / no | OTP delivery via MSG91 | strings |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | alternative SMS provider | no / yes / no | OTP delivery via Twilio | strings |
| `FAST2SMS_API_KEY` | alternative SMS provider | yes | OTP delivery via Fast2SMS | string |
| `RATE_LIMIT_AUTHED_MAX` / `RATE_LIMIT_ANON_MAX` / `RATE_LIMIT_AUTH_MAX` | recommended | no | Per-15-minute ceilings (per user / per IP / failed auth per IP) | positive integers, e.g. `600` / `120` / `20` |
| `SENTRY_DSN` | no | yes | Error reporting | DSN |
| `NOTIFICATIONS_QUEUE`, `SCRAPER_JOBS_QUEUE`, `ALERT_EVALUATION_QUEUE` | no | no | Queue name overrides; must match the consumers | strings |

Must **not** be set in production: `PAYMENTS_DEMO_MODE`, `DEMO_DEPLOYMENT`,
`ALLOW_DEMO_GOOGLE_AUTH`, `DISABLE_RATE_LIMIT`, `ENABLE_SYNTHETIC_RESULTS`. The
API refuses to start with the first three when they would change behaviour.

### 3.2 Notification service

| Variable | Required | Secret | Purpose | Format |
|---|---|---|---|---|
| `NODE_ENV` | yes | no | Production delivery guards | `production` |
| `REDIS_URL` | yes | yes | Queue connection | same value as the API |
| `FRONTEND_URL` | yes | no | Links inside emails | `https://app.example.com` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | one email provider required | no / no / no / yes | Custom SMTP (first choice) | host, port (587 or 465), credentials |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | alternative | no / yes | Gmail SMTP | address, app password |
| `AWS_SES_ACCESS_KEY` / `AWS_SES_SECRET_KEY` / `AWS_REGION` / `AWS_SES_FROM_EMAIL` | alternative | yes / yes / no / no | AWS SES | keys, region (`ap-south-1`), sender address |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` | for SMS notifications | yes / no | SMS channel | strings |
| `WATI_API_URL` / `WATI_API_KEY` | for WhatsApp | no / yes | WhatsApp channel | URL, key |
| `FIREBASE_PROJECT_ID` / `FIREBASE_SERVICE_ACCOUNT_PATH` | for push | no / path to a Render Secret File | FCM push | project id, `/etc/secrets/firebase.json` |
| `PUSH_NOTIFICATIONS_REQUIRED` | no | no | Refuse to start without push | `false` (default) |
| `NOTIFICATIONS_QUEUE` | no | no | Must equal the API's value | string |

### 3.3 AI service

| Variable | Required | Secret | Purpose | Format |
|---|---|---|---|---|
| `PORT` | set by Render | no | Listening port | integer |
| `PYTHON_VERSION` | yes (native runtime) | no | Interpreter | `3.11.9` |
| `AI_SERVICE_TOKEN` | yes | yes | Must equal the API's value | string |
| `ANTHROPIC_API_KEY` | yes (for real analysis) | yes | Claude API | `sk-ant-...`; without it the engine answers with rule-based results |
| `AI_MODEL` | recommended | no | Model id | a current Claude model id |
| `REDIS_URL` | no | yes | Only if caching is used | URL |
| `AI_SERVICE_ALLOWED_ORIGINS` | no | no | CORS origins; leave empty | comma-separated |
| `AI_SERVICE_EXPOSE_DOCS` | no | no | OpenAPI docs | `false` |
| `LOG_LEVEL` | no | no | Logging | `info` |

### 3.4 Scraper

| Variable | Required | Secret | Purpose | Format |
|---|---|---|---|---|
| `NODE_ENV` | yes | no | Production portal defaults and token enforcement | `production` |
| `PORT` | set by Render | no | Control API port | integer |
| `DATABASE_URL` | yes | yes | Writes tenders | same database as the API (own `connection_limit`) |
| `REDIS_URL` | yes | yes | Scheduler locks and queues | same value as the API |
| `SCRAPER_API_TOKEN` | yes | yes | Must equal the API's value | ≥ 16 chars |
| `SCRAPER_API_ENABLED` | no | no | Control API on/off | `true` |
| `SCRAPER_API_ALLOWED_ORIGINS` | no | no | CORS; leave empty | comma-separated |
| `PORTAL_<NAME>_ENABLED` | per portal | no | Opt each real portal in | `true` (GEM, CPPP, EPROCURE, GUJARAT, MAHARASHTRA, RAJASTHAN, KARNATAKA, TAMILNADU, UP, MP, DELHI, KERALA, WB) |
| `SCRAPER_CONCURRENCY`, `SCRAPER_REQUEST_DELAY_MS`, `SCRAPER_MAX_PAGES`, `QUEUE_*`, `PROXY_URLS`, `LOG_LEVEL` | no | no | Tuning | see `.env.example` |
| `PLAYWRIGHT_BROWSERS_PATH` | set by the image | no | Browser location | `/ms-playwright` |

Must **not** be set: `DEMO_SCRAPER_MODE`, `SCRAPER_ALLOW_INSECURE_TLS` (ignored in
production anyway).

## 4. PostgreSQL

- Region Singapore; use the **internal** connection string for Render services.
- Append pool settings to `DATABASE_URL` for each service, sized against the
  plan's connection limit: the API with `connection_limit=10&pool_timeout=20`,
  the scraper with `connection_limit=5`. Prisma's default is `cpus * 2 + 1` per
  process, which can exceed a small plan's limit across API + scraper +
  migrations.
- Migrations: only `prisma migrate deploy` (the API's pre-deploy command). The
  history is `0_init` then `20261103120000_broadcast_campaigns`, which uses
  `CREATE TABLE IF NOT EXISTS` so a database that already received that table
  from the old runtime code keeps its rows. Verified on a disposable database
  with and without the pre-existing table (no drift either way).
- Do not run `prisma db push` or the seed against production. Create the first
  SUPER_ADMIN by running the seed once with `NODE_ENV=production
  SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=...` (12+ chars); it creates only
  that account and the plans, never the fixture admins.
- Backups: use a paid Postgres plan (point-in-time recovery).

## 5. Redis

- Render Key Value, **paid/persistent** plan, `maxmemory-policy noeviction`.
  OTP lockouts and throttles, token revocations, plan caches and the BullMQ
  queues live here; eviction would silently lift lockouts.
- The URL must carry a password (the API refuses to start otherwise) and may
  use `rediss://` (ioredis and BullMQ support TLS from the URL scheme).
- When Redis is unreachable the API fails closed: authenticated requests error
  (token revocation cannot be checked), OTP operations error, `/health` is 503.
  There is no in-memory substitute.
- HTTP rate limiting uses an in-process memory store (one bucket set per
  instance, reset on deploy). Run **one API instance** until a shared store is
  adopted (see §8).

## 6. Internal networking

- Render private services and the API reach each other over the private
  network by service hostname and the `PORT` each service listens on. Put the
  resulting URLs into `AI_SERVICE_URL` and `SCRAPER_API_URL` on the API.
- The scraper's control API is reachable only inside the private network; the
  API authenticates to it with `SCRAPER_API_TOKEN`.
- The AI service must never be public: keep it a Private Service.
- CORS on the API trusts exactly `FRONTEND_URL`, `ADMIN_URL` and `CORS_ORIGINS`.
  Vercel preview URLs are not trusted (no wildcards); add a stable custom
  domain instead.

## 7. Health checks

| Service | Path | Notes |
|---|---|---|
| API | `/health` | 503 only when PostgreSQL or Redis is down; `/health/live` for pure liveness |
| AI service | `/health` | public |
| Scraper | `/api/ready` | 200 only while the scheduler runs; `/api/health` is liveness |
| Notification worker | none | Render background workers have no HTTP check; watch the logs and the queue |

## 8. Known limitations

1. **Uploaded documents are stored on the local disk** (`packages/api-server/src/shared/utils/upload.ts`,
   `./uploads`). Render's filesystem is ephemeral and no route serves the files
   back. Document upload is therefore **not production-safe**; the API logs a
   warning at startup. See the Phase 3 report for the object-storage options
   that need a decision.
2. **Rate limiting is per instance and in memory.** Fine for one instance; a
   second instance halves the effective limits. A shared Redis store would need
   a new dependency (`rate-limit-redis`) and approval.
3. **Elasticsearch is off in v1.** Search uses PostgreSQL `ILIKE` queries, which
   is adequate for small tables; the index can be enabled later by setting
   `ELASTICSEARCH_ENABLED=true` and `ELASTICSEARCH_URL`.
4. **In-process workers** (tender index, alert scheduler) run inside the API.
   The alert scheduler uses a Redis lock, so a second instance is safe but
   unnecessary.
5. **Registration reveals that some account exists** (`ACCOUNT_EXISTS`); a
   verify-before-create flow is a later phase.
6. The admin password-reset endpoint returns the temporary password in its
   response (to authorised callers only); tracked for a security follow-up.
7. Google sign-in has only been verified with locally signed test tokens, not a
   real Google OAuth client.
8. The notification worker's failure path has been unit-tested but not
   exercised against a live BullMQ worker.

## 9. Manual steps before deployment

1. Generate secrets: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_SERVICE_TOKEN`,
   `SCRAPER_API_TOKEN` (random, ≥ 32 chars for the JWT pair).
2. Create the Render Postgres (Singapore) and Key Value (persistent,
   `noeviction`) instances; note their internal URLs.
3. Create the services in this order: AI service, scraper, API, notification
   worker. The API needs the internal URLs of the first two.
4. Configure one email provider on the notification worker and one SMS
   provider on the API (or accept that phone sign-in answers 503).
5. Razorpay: live keys plus a webhook pointing at
   `https://<api>/api/v1/webhooks/razorpay` with `RAZORPAY_WEBHOOK_SECRET`.
6. Google: create the OAuth client; set `GOOGLE_CLIENT_ID` on the API and
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel.
7. Run the first deploy of the API (the pre-deploy command applies the
   migrations), then seed the first SUPER_ADMIN as described in §4.
8. Enable the portals you want scraped with `PORTAL_<NAME>_ENABLED=true`.
9. Decide on object storage for uploads before enabling document upload for
   users.
