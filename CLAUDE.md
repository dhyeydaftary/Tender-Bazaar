# TenderBazaar — AI-Powered Tender Aggregation Platform for India

## Project Overview
TenderBazaar is a SaaS platform that aggregates government tenders from 50+ Indian portals (GeM, CPPP, state e-procurement sites), provides AI-powered eligibility checking, smart alerts, and document management for businesses bidding on government contracts.

## Tech Stack
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend (Web)**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Frontend (Mobile)**: React Native + Expo Router, NativeWind
- **Admin Dashboard**: Next.js 14+
- **API Server**: Express.js + TypeScript
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Cache/Queue**: Redis 7 (ioredis, BullMQ)
- **Search**: Elasticsearch 8.12
- **AI Service**: Python FastAPI + Anthropic Claude API
- **Scraping**: Playwright + Cheerio
- **Payments**: Razorpay
- **Notifications**: Email (AWS SES), WhatsApp (WATI), Push (FCM), SMS (MSG91)

## Brand Colors
- Primary: #FF6B35 (Saffron Orange)
- Secondary: #1B2845 (Deep Navy)
- Accent: #00D4AA (Teal Green)
- Font: Plus Jakarta Sans

## Workspace Structure
```
apps/
  web/          — Next.js 14+ main web app (port 3000)
  admin/        — Next.js 14+ admin dashboard (port 3001)
  mobile/       — React Native Expo app
packages/
  api-server/   — Express.js API (port 4000)
  shared/       — Shared types, constants, validators
  scraper-engine/ — Tender scraping infrastructure
  notification-service/ — Multi-channel notification system
  ai-service/   — Python FastAPI AI microservice (port 5000)
prisma/         — Database schema and migrations
```

## Commands
- `pnpm dev` — Start all apps in development
- `pnpm build` — Build all apps
- `pnpm db:generate` — Generate Prisma client
- `pnpm db:push` — Push schema to database
- `pnpm db:seed` — Seed subscription plans
- `pnpm db:studio` — Open Prisma Studio
- `docker compose up -d` — Start postgres, redis, elasticsearch

## Subscription Plans (₹ INR)
| Plan | Monthly | Yearly | Views/Day | Alerts | AI Checks/Mo |
|------|---------|--------|-----------|--------|--------------|
| Free | ₹0 | ₹0 | 5 | 1 | 1 (total) |
| Starter | ₹1,499 | ₹14,999 | 50 | 5 | 5 |
| Professional | ₹4,999 | ₹49,999 | Unlimited | 20 | 50 |
| Enterprise | ₹14,999 | ₹1,49,999 | Unlimited | Unlimited | Unlimited |

## API Routes Pattern
All API routes follow: `/api/v1/{module}/{action}`
Response format: `{ success: boolean, data?: T, error?: { code, message }, meta?: { page, limit, total } }`

## Key Conventions
- Use Zod for all input validation
- Use AppError class for error handling
- Use planGuard middleware for plan-based access control
- Track usage in Redis with daily/monthly TTL keys
- All dates stored in UTC, displayed in IST
- Currency values stored in INR (not paise)
- Tender values: -1 means unlimited in plan limits
