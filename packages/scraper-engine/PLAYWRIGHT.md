# Playwright in the scraper engine — current status

**Playwright is present but unused. Nothing in the engine launches a browser.**

This is documented rather than silently left in place, because the dependency
looks load-bearing (the Docker image is built `FROM
mcr.microsoft.com/playwright:v1.44.0-jammy`, which carries about a gigabyte of
browsers) and because it currently *cannot* work.

## What exists

| Thing | Where | Used? |
|---|---|---|
| `fetchWithPlaywright()` | `src/scrapers/base-scraper.ts` | **No call sites** |
| `closeBrowser()` | `src/scrapers/base-scraper.ts` | Called defensively from `main.ts` after each run; a no-op because no browser is ever opened |
| `usePlaywright: true` on Gujarat, Maharashtra, TamilNadu | `src/config/index.ts` | **Never read** by any code path |
| `playwright` dependency | `package.json` | Installed, never imported at run time except the unused helper |
| `playwright:v1.44.0-jammy` base image | `Dockerfile` | Provides Node + browsers; only Node is used |

All 13 portal scrapers fetch with **axios + cheerio** through
`BaseScraper.fetchPage()`.

## Why it would fail if switched on today

`pnpm-lock.yaml` resolves **`playwright@1.59.1`**, while the base image ships
the browser revisions that match **1.44.0** under `/ms-playwright`
(`PLAYWRIGHT_BROWSERS_PATH`). A Playwright build expects an exact browser
revision, and the Dockerfile never runs `playwright install`. The first
`chromium.launch()` would therefore fail with:

```
browserType.launch: Executable doesn't exist at /ms-playwright/chromium-<rev>/chrome-linux/chrome
```

So the integration is not merely unused, it is broken. That is latent rather
than live only because nothing calls it.

## If you need Playwright (a portal starts requiring JavaScript)

Pick **one** of these and do it deliberately:

1. **Align the image with the package** — change the base image tag to the
   Playwright release matching the resolved package version
   (`mcr.microsoft.com/playwright:v1.59.1-jammy`), and keep them in lockstep
   whenever the dependency is upgraded. Cheapest and least surprising.
2. **Install browsers in the build** — keep any Node base image and run
   `pnpm exec playwright install --with-deps chromium` in the Dockerfile. Adds
   build time and image size but removes the version coupling entirely.

Then wire it up: have the state scrapers that need it call
`fetchWithPlaywright()` instead of `fetchPage()`, and make `usePlaywright`
actually select between them. Add a test that launches a browser, so a future
version drift fails the build instead of the scrape.

Note that the container now runs as the unprivileged `pwuser`, which is the
user the Playwright image intends browsers to run as.

## If you want it gone

Removal is safe today — nothing calls it — and would drop roughly a gigabyte
from the image:

1. delete `fetchWithPlaywright()`, `closeBrowser()`, the `browser`/`PlaywrightOptions`
   members in `base-scraper.ts`, and the `closeBrowser` call in `main.ts`;
2. remove `usePlaywright` from `PortalConfig` and the 13 portal entries;
3. remove the `playwright` dependency and the `PLAYWRIGHT_*` config block;
4. change the base image to `node:20-alpine` (the engine is axios + cheerio, so
   nothing else in the image is needed) and drop `PLAYWRIGHT_BROWSERS_PATH`.

This was **not** done as part of the deployment-hardening work: it is a
behavioural change to the scraping layer rather than a deployment fix, and it
removes the only ready path to JavaScript-rendered portals. The decision
belongs with whoever owns the scraping roadmap.
