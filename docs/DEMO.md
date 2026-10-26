# TenderBazaar demo

There are two ways to run the demo:

| Mode | Files | Use it for |
|---|---|---|
| **Isolated local demo** (recommended) | `docker-compose.yml` + `docker-compose.demo.yml` + `docker-compose.demo-local.yml` | A complete demo with its own database, search index and synthetic tenders, running **next to** your normal stack without touching it |
| Demo-scraper overlay only | `docker-compose.yml` + `docker-compose.prod.yml` (or `.override.yml`) + `docker-compose.demo.yml` | Swapping in the demo scraper on an existing stack. **This shares that stack's containers and database.** |

The rest of this guide covers the isolated local demo.

## What's in it

- **The real app, unchanged:** web, admin, api-server, Postgres, Redis, Elasticsearch, ai-service and notification-service.
- **The demo scraper** replaces the real scraper. It has no browser, contacts no portal and writes no tenders. Runs are simulated:
  - **PENDING** when you press "Run now";
  - **RUNNING**, with pages and items found increasing every few seconds;
  - **COMPLETED** after roughly 15–60 seconds.
- **100 synthetic tenders** with 256 documents and 8 award results, covering 4 categories, 5 statuses, 6 demo portals, 11 states and about 30 days of history.
- **One demo admin account** (optional).

**The real scraper isn't included**, isn't built, and its source, Dockerfile and production configuration are unchanged.

### How you can tell the data is synthetic

| Where | Marker |
|---|---|
| Source portal | `GeM-Demo`, `CPPP-Demo`, `eProcure-Demo`, `Maharashtra-Demo`, `Gujarat-Demo`, `Rajasthan-Demo` |
| Reference number / source id | `DEMO/<PORTAL>/<FY>/<NNNN>` / `DEMO-<PORTAL>-<NNN>` |
| Source and document links | `demo://tenderbazaar/...`. The detail page shows its built-in disabled **Source unavailable** button instead of a link |
| Description | Ends with: *"Synthetic demonstration record … not a real tender and was not obtained from any procurement portal."* |
| AI summary | Ends with "Demo record." |
| Organisations / winners | Generic body types plus a city; winners carry the suffix "(Demo)" |
| Scraper runs | `triggeredBy = 'demo'`, `metadata.simulated = true`, `*-Demo` portals only |
| Admin panel | A demo-mode notice on the Scrapers page; Settings → Test Engine reports "Demo scraper" |

## How it's isolated (verified)

| Resource | Demo | Your normal stack (`tenderbazaarcopy`) |
|---|---|---|
| Compose project | `tenderbazaar-demo` | `tenderbazaarcopy` |
| Containers | `tenderbazaar-demo-<service>-1`. The base file's fixed names are reset with `!reset` | `tenderbazaar-<service>` |
| Network | `tenderbazaar-demo_default` | `tenderbazaarcopy_default` |
| Volumes | `tenderbazaar-demo_postgres-data`, `_redis-data`, `_elasticsearch-data` | `tenderbazaarcopy_*` |
| Database | `tenderbazaar_demo` on the demo's own Postgres | `tenderbazaar` |
| Search index | `tenders` inside the demo's own Elasticsearch | its own Elasticsearch |
| Images | `tenderbazaar-demo-<service>` | `tenderbazaarcopy-<service>` |
| Host ports | `127.0.0.1:3100` web, `127.0.0.1:3101` admin, `127.0.0.1:4100` API | 3000/3001/3002/4000/4001/5050/5432/9200 |
| Settings and secrets | `.env.demo.local` only, passed with `--env-file`. No container loads an `env_file` | `.env` |

Postgres, Redis, Elasticsearch, ai-service and the demo scraper publish **no** host ports.

## Prerequisites

- Docker Desktop with Compose v2.24 or later, which `!reset` and `!override` need. Check with `docker compose version`.
- About 1.5 GB of free RAM for Docker and about 4 GB of disk for images.
- Ports 3100, 3101 and 4100 free on 127.0.0.1.

## Setup (once)

1. Copy `.env.demo.example` to `.env.demo.local`. The new file is git-ignored.
2. Fill in random values. Generate each one with `openssl rand -hex 24`:
   - `POSTGRES_PASSWORD`, using only URL-safe characters;
   - `SCRAPER_API_TOKEN`, at least 16 characters;
   - optionally `DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` (at least 12 characters) for the admin panel.

## Commands

Always use **all** of these flags. `-p tenderbazaar-demo` and `--env-file .env.demo.local` are what keep the demo away from your normal stack.

Check isolation before the first start:

```bash
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml config --format json > demo-local.json
python scripts/check-demo-isolation.py demo-local.json
python scripts/check-demo-compose.py demo-local.json
```

Then delete `demo-local.json`, because it contains your demo values.

Start, or rebuild after code changes:

```bash
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml up -d --build
```

Startup runs in this order:
1. Postgres, Redis and Elasticsearch become healthy.
2. `db-init` applies migrations, upserts the subscription plans, and creates the demo admin if it's set and missing.
3. `demo-seed` upserts the synthetic dataset.
4. `api-server` starts and indexes every tender into the demo Elasticsearch.
5. web, admin and the demo scraper start.

Then open:

- **Web app:** <http://localhost:3100>. Tenders are at <http://localhost:3100/tenders>.
- **Admin panel:** <http://localhost:3101>. The login page looks the same as the normal app.
  - **Super Admin tab** fills `DEMO_ADMIN_EMAIL`. **Admin tab** fills `DEMO_STAFF_ADMIN_EMAIL`, an ADMIN-role account.
  - Each tab then moves to the password field. Type the matching password from `.env.demo.local`; open that file in your editor to read it.
  - **Passwords are never built into the page.**
  - The development accounts (`superadmin@tenderbazaar.com`, `admin@tenderbazaar.com`) don't exist in the demo. That's why the demo's tabs fill the demo emails instead, using the build arguments `NEXT_PUBLIC_DEMO_SUPER_ADMIN_EMAIL` / `NEXT_PUBLIC_DEMO_ADMIN_EMAIL`. When those arguments are empty, the normal app keeps its original tabs.
  - If you type the email yourself, type it **exactly**. The API's email lookup is case-sensitive.
  - "Cannot reach the TenderBazaar API" means a connectivity problem, not bad credentials.
  - The theme, font and colours are saved per browser origin. A preference you saved at `localhost:3001` doesn't carry over to `localhost:3101`. Use the toggle at the top right to set it again.
  - The admin session token lasts 15 minutes. The admin app has no token refresh, so after that the next admin request signs you out. This is the same as in the normal app.
- **API health:** <http://localhost:4100/health>

Check status:

```bash
docker compose -p tenderbazaar-demo ps
```

## Seeding demo data safely

- **Automatic on every start:** `demo-seed` runs on every `up` and is idempotent. Tenders are upserted on `(sourceId, sourcePortal)`, and documents and results on fixed ids, so it never creates duplicates or deletes anything.
- **Dates move forward on each run.** ACTIVE deadlines stay 4–45 days ahead. Otherwise the app's `GET /tenders/stats` turns past-deadline ACTIVE tenders into CLOSED.
- **The seed refuses to run** unless `DEMO_SEED_TARGET=tenderbazaar-demo` **and** the connected database is literally `tenderbazaar_demo`. That check is made against the server, not just the URL, so it can't run against your normal database.

To refresh the dates before a presentation:

```bash
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml run --rm --no-deps demo-seed
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml restart api-server
```

The restart makes api-server re-index into the demo Elasticsearch.

The general seed (`prisma/seed.ts`) runs inside `db-init` in its production mode only, which upserts plans and the optional admin. Its sample tenders, which use real portal names, are switched off with `SEED_DEMO_DATA=false`.

## Checking that demo-scraper mode is active

- **Admin panel:**
  - Scrapers shows six `*-Demo` portals and a "Demo mode" notice.
  - Settings → Test Engine reports "Demo scraper is running".
- **From a terminal:**
  - `docker compose -p tenderbazaar-demo ps` lists `demo-scraper`, and there's no `scraper` service.
  - `docker compose -p tenderbazaar-demo exec demo-scraper wget -qO- http://127.0.0.1:4001/api/health` reports `"mode":"demo","simulated":true`.
  - `docker top tenderbazaar-demo-demo-scraper-1` shows a single `node` process.
- **Run history:** each run in the admin run log shows "Triggered: demo".

## Stopping and cleaning up (demo only)

Stop the demo, keeping its data:

```bash
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml stop
```

Remove the demo containers and network, keeping its volumes and data:

```bash
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml down
```

**Reset the demo completely, deleting only the `tenderbazaar-demo_*` volumes.** It's re-seeded on the next `up`.

```bash
docker compose -p tenderbazaar-demo --env-file .env.demo.local -f docker-compose.yml -f docker-compose.demo.yml -f docker-compose.demo-local.yml down -v
```

Notes for these commands:
- **Before running `down -v`,** check that the command contains `-p tenderbazaar-demo`. These commands act only on the `tenderbazaar-demo` project.
- **To keep demo data across resets,** use `down` without `-v`. Back up first with `docker compose -p tenderbazaar-demo exec postgres pg_dump -U postgres tenderbazaar_demo > demo-backup.sql`.
- **Images are left behind.** Remove them with `docker image rm $(docker images -q 'tenderbazaar-demo-*')` if you want.

**Never** run `docker compose up` or `down` in this folder **without** `-p tenderbazaar-demo`. The folder's default project is your normal stack, `tenderbazaarcopy`.

## Demo settings

| Variable (`.env.demo.local`) | Default | Purpose |
|---|---|---|
| `POSTGRES_PASSWORD` | required | Password for the demo Postgres |
| `SCRAPER_API_TOKEN` | required | api-server ↔ demo-scraper secret; at least 16 characters |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` / `DEMO_ADMIN_NAME` | empty | SUPER_ADMIN demo account, used by the Super Admin tab. Created only if missing and never changed afterwards |
| `DEMO_STAFF_ADMIN_EMAIL` / `DEMO_STAFF_ADMIN_PASSWORD` | empty | ADMIN-role demo account, used by the Admin tab. Created by `demo-seed` only if missing and never changed afterwards |
| `DEMO_SCHEDULE_ENABLED` | `false` | Also run simulated jobs on a schedule (cron, UTC) |
| `DEMO_CONCURRENCY`, `DEMO_PAGE_DELAY_MIN_MS` / `_MAX_MS` | 2, 1800 / 4200 | How fast simulated runs go |

## Known limitations

- **Trending reflects page views.** "Trending" lists tenders viewed in the last 7 days. The list fills up as tenders are opened during the demo, and until then it falls back to the highest view counts.
- **What the tender tabs count:** **Active** means open for bidding, which is ACTIVE plus CORRIGENDUM. **Closed** is CLOSED, AWARDED and CANCELLED. So Active + Closed always equals All. When a tender's deadline passes, both open statuses become CLOSED.
- **Anonymous visitors see only page 1** of results (20 tenders), by the app's own design. Sign in to page further.
- **Demo documents can't be downloaded.** They're listed, but their `demo://` links don't open.
- **AI and notifications run without credentials.** The demo has no Anthropic or messaging keys, so the AI service gives its fallback results, and emails or SMS are only logged inside the notification-service container, never sent.
- **No regular user account is seeded.** Register one in the web app if you want to show the user dashboard.
- **The real scraper image is fixed in source, but your running image isn't.** The image is now `playwright:v1.64.1-jammy`, matching the lockfile. Images built before this change, including the one your normal stack is running now, still can't launch Chromium until they're rebuilt.
- **On a server:** the demo-scraper overlay can also be layered onto `docker-compose.prod.yml`, as described at the top. `docker-compose.demo-local.yml` is for local use; it uses `NODE_ENV=development` for api-server and binds to 127.0.0.1.

## Going back to the real scraper

1. Rebuild the real scraper image. Its Playwright version is now fixed in the Dockerfile.
2. Run your normal stack as before. It doesn't use any demo file.
3. Optionally remove the demo: `down -v` as shown above, then delete `src/demo/`, `Dockerfile.demo`, `docker-compose.demo*.yml`, `prisma/demo*`, `.env.demo.example`, the `demo-*` tests, the check scripts and this file. No other code depends on them.
