# ═══════════════════════════════════════════════════════════════════════
# TENDERBAZAAR — CLAUDE CODE PROMPTS (Phase-wise)
# ═══════════════════════════════════════════════════════════════════════
#
# HOW TO USE:
# 1. Place CLAUDE.md in your project root (already created)
# 2. Place all reference docs in /docs folder
# 3. Open Claude Code: cd tenderbazaar && claude
# 4. Copy-paste ONE phase prompt at a time
# 5. Let Claude Code complete each phase before moving to next
# 6. Test each phase before proceeding
#
# IMPORTANT: Don't paste all phases at once. Go one by one.
# After each phase, test everything, commit to git, then move forward.
# ═══════════════════════════════════════════════════════════════════════


# ─────────────────────────────────────────────────────────────────────
# PHASE 1: PROJECT FOUNDATION & MONOREPO SETUP
# Estimated time: 2-3 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 1: Project Foundation

Read CLAUDE.md and docs/TenderBazaar_Development_Blueprint.md for full context. This is a tender aggregation SaaS platform for India called "TenderBazaar".

Set up the complete Turborepo monorepo with this exact structure:

1. MONOREPO INITIALIZATION:
   - Initialize Turborepo with pnpm workspaces
   - Create turbo.json with build, dev, lint, test pipelines
   - Set up root package.json with shared scripts
   - Set up root tsconfig.json with path aliases
   - Add .gitignore, .env.example, .nvmrc (Node 20 LTS)

2. CREATE ALL WORKSPACE PACKAGES:

   apps/web/ — Next.js 14+ with App Router:
   - Use TypeScript, Tailwind CSS, shadcn/ui
   - Set up app/ directory with route groups: (auth), (dashboard), (marketing)
   - Install: next, react, tailwindcss, @shadcn/ui, zustand, axios, date-fns, lucide-react
   - Create tailwind.config.ts with the brand color palette from CLAUDE.md:
     Primary: #FF6B35 (Saffron Orange), Secondary: #1B2845 (Deep Navy), Accent: #00D4AA (Teal Green)
   - Add Plus Jakarta Sans font from Google Fonts
   - Set up dark mode with next-themes
   - Create globals.css with all CSS variables for light/dark mode

   apps/mobile/ — React Native with Expo:
   - Initialize with: npx create-expo-app@latest mobile --template tabs
   - Use Expo Router (file-based routing)
   - Install: expo-router, nativewind, expo-notifications, expo-secure-store, react-native-reanimated
   - Set up app/ directory with (tabs) layout: index, search, saved, alerts, profile
   - Configure NativeWind with same brand colors

   apps/admin/ — Next.js 14+ Admin Dashboard:
   - Simpler setup, same stack as web
   - Route structure: dashboard, users, tenders, scrapers, subscriptions, analytics, notifications

   packages/api-server/ — Express.js + TypeScript:
   - Set up with express, cors, helmet, morgan, compression, express-rate-limit
   - Module-based structure: modules/auth, modules/tenders, modules/users, modules/subscriptions, modules/payments, modules/notifications, modules/alerts, modules/eligibility, modules/analytics
   - Each module has: controller.ts, service.ts, routes.ts, validation.ts (using zod)
   - Shared: middleware/ (auth, rateLimiter, planGuard, errorHandler), utils/, types/
   - Config: database.ts (Prisma), redis.ts (ioredis), elasticsearch.ts (@elastic/elasticsearch), env.ts (dotenv + zod validation)

   packages/shared/ — Shared types and utilities:
   - types/tender.ts, user.ts, subscription.ts, notification.ts, api.ts
   - constants/categories.ts, states.ts, plans.ts
   - validators/common.ts
   - Export everything from index.ts

   packages/scraper-engine/ — Scraping infrastructure (placeholder):
   - Create folder structure: scrapers/, pipeline/, scheduler/
   - Add placeholder files for: cppp.ts, gem.ts, states/gujarat.ts
   - Install: playwright, axios, cheerio, p-queue, node-cron

   packages/notification-service/ — Notification system (placeholder):
   - Create folder structure: providers/, templates/, queue/
   - Add placeholder files for: email.ts, whatsapp.ts, push.ts, sms.ts

   packages/ai-service/ — Python FastAPI (placeholder):
   - Create: app/main.py, app/eligibility/engine.py, app/categorizer/nlp_classifier.py
   - Create requirements.txt with: fastapi, uvicorn, anthropic, pydantic
   - Create Dockerfile

3. DATABASE SETUP:
   - Initialize Prisma in root: prisma/schema.prisma
   - Create the COMPLETE schema from CLAUDE.md (all models: User, CompanyProfile, Session, Tender, TenderDocument, TenderResult, SavedTender, Alert, EligibilityCheck, SubscriptionPlan, Subscription, Payment, Notification, SearchHistory)
   - Include ALL enums: UserRole, TenderType, TenderCategory, TenderStatus, AlertFrequency, SubscriptionStatus, BillingCycle, PaymentStatus, NotificationType, NotificationChannel
   - Add all indexes and unique constraints as specified
   - Create seed file: prisma/seed.ts with 4 subscription plans (Free, Starter, Professional, Enterprise) with exact pricing and limits from CLAUDE.md

4. DOCKER SETUP:
   - Create docker-compose.yml with: postgres:16, redis:7, elasticsearch:8.12
   - Add volume mounts for data persistence
   - Add proper health checks
   - Create docker-compose.override.yml for development

5. ENVIRONMENT SETUP:
   - Create comprehensive .env.example with ALL required variables:
     DATABASE_URL, REDIS_URL, ELASTICSEARCH_URL,
     JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRY,
     RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
     AWS_S3_BUCKET, AWS_ACCESS_KEY, AWS_SECRET_KEY,
     ANTHROPIC_API_KEY,
     WHATSAPP_API_KEY, WHATSAPP_API_URL,
     EMAIL_FROM, AWS_SES_REGION,
     SMS_API_KEY,
     FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY,
     NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_NAME

After setup, verify:
- `pnpm install` works
- `docker compose up -d` starts postgres, redis, elasticsearch
- `pnpm prisma generate` works
- `pnpm prisma db push` creates all tables
- `pnpm prisma db seed` seeds subscription plans
- `pnpm dev` starts all apps simultaneously

Create a README.md with setup instructions for new developers.
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 2: AUTHENTICATION SYSTEM
# Estimated time: 2-3 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 2: Complete Authentication System

Read CLAUDE.md for full context. Build the complete auth system across API, web, and mobile.

1. BACKEND AUTH MODULE (packages/api-server/src/modules/auth/):

   auth.service.ts:
   - Register with email + password (bcrypt hash, 12 rounds)
   - Register with phone + OTP
   - Login with email/password → return JWT access token (15min) + refresh token (7 days)
   - Login with phone/OTP
   - Google OAuth2 login (using google-auth-library)
   - OTP generation (6-digit, stored in Redis with 5min TTL)
   - OTP verification
   - Refresh token rotation (invalidate old, issue new)
   - Forgot password (send reset link via email)
   - Reset password (verify token, update password)
   - Logout (invalidate session in DB + Redis blacklist)

   auth.middleware.ts:
   - JWT verification middleware (checks Authorization: Bearer header)
   - Extract user from token, attach to req.user
   - Check token blacklist in Redis
   - Optional auth middleware (doesn't fail for unauthenticated, but attaches user if token present)
   - Role-based guard: requireRole('ADMIN')

   auth.controller.ts:
   - POST /api/v1/auth/register
   - POST /api/v1/auth/login
   - POST /api/v1/auth/send-otp
   - POST /api/v1/auth/verify-otp
   - POST /api/v1/auth/refresh-token
   - POST /api/v1/auth/google
   - POST /api/v1/auth/forgot-password
   - POST /api/v1/auth/reset-password
   - DELETE /api/v1/auth/logout

   auth.validation.ts (using zod):
   - registerSchema: email (valid email), password (min 8, 1 uppercase, 1 number), name (min 2), phone (optional, Indian format)
   - loginSchema: email + password
   - otpSchema: phone + otp (6 digits)
   - All schemas with proper error messages

2. WEB AUTH PAGES (apps/web/):

   Create a beautiful, branded auth experience:
   
   app/(auth)/layout.tsx:
   - Split layout: left side = auth form, right side = branding panel with gradient (#FF6B35 → #1B2845)
   - Right panel shows: logo, tagline "India's Smartest Tender Platform", stats ("50,000+ Tenders | 28 States"), testimonial quote
   - Responsive: on mobile, hide right panel, show just the form

   app/(auth)/login/page.tsx:
   - Email + password form with validation
   - "Login with Phone OTP" toggle option
   - Google OAuth button
   - "Forgot password?" link
   - "Don't have an account? Register" link
   - Loading states, error handling with toast notifications (sonner)

   app/(auth)/register/page.tsx:
   - Name, email, phone, password, confirm password
   - Password strength indicator
   - Terms & conditions checkbox
   - Google OAuth button
   - "Already have account? Login" link

   app/(auth)/forgot-password/page.tsx:
   - Email input → sends reset link
   - Success state with "Check your email" message

   app/(auth)/verify-otp/page.tsx:
   - 6-digit OTP input (individual boxes, auto-focus next)
   - Countdown timer (60s) with "Resend OTP" button
   - Auto-submit on 6th digit

   Create auth store (stores/auth-store.ts) using Zustand:
   - user, token, isAuthenticated, isLoading states
   - login(), register(), logout(), refreshToken() actions
   - Persist token in cookies (httpOnly for web)
   - Auto-refresh token before expiry

   Create API client (lib/api.ts):
   - Axios instance with baseURL from env
   - Request interceptor: attach Bearer token
   - Response interceptor: on 401, try refresh token, retry original request
   - If refresh fails, logout and redirect to /login

   Create auth middleware for Next.js (middleware.ts):
   - Protect /dashboard/* routes — redirect to /login if no token
   - Redirect /login, /register to /dashboard if already authenticated

3. MOBILE AUTH (apps/mobile/):

   app/login.tsx:
   - Clean mobile login form (email + password)
   - Phone OTP option
   - Google Sign-In (expo-auth-session)
   - Biometric login option (expo-local-authentication) for returning users
   - Store tokens in expo-secure-store

   app/register.tsx:
   - Registration form optimized for mobile
   - Phone number with country code picker
   
   services/auth.ts:
   - API calls matching the web auth store
   - Token storage in SecureStore
   - Auto-refresh logic

4. SHARED ERROR HANDLER (packages/api-server/):
   - Create AppError class with statusCode, message, code
   - Global error handler middleware
   - Standardized error response format: { success: false, error: { code, message, details } }
   - Handle Prisma errors (unique constraint, not found, etc.)
   - Handle Zod validation errors
   - Handle JWT errors (expired, invalid, malformed)

Test the complete flow: Register → Login → Access protected route → Refresh token → Logout
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 3: TENDER DATA MODULE & SEARCH ENGINE
# Estimated time: 3-4 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 3: Tender Module + Elasticsearch Search Engine

Read CLAUDE.md for context. Build the tender data layer, Elasticsearch integration, and search UI.

1. ELASTICSEARCH SETUP (packages/api-server/src/config/elasticsearch.ts):

   Create tender index with this mapping:
   - title: text with hindi_english_analyzer (custom analyzer with Hindi stemmer, English stemmer, and synonym filter for Indian tender terms like road/highway/sadak/marg, construction/nirman, supply/delivery/aapoort, IT/software/information technology, medical/chikitsa/hospital)
   - description: text with same analyzer
   - organization: keyword + text subfield
   - state, district, city: keyword
   - category, tenderType, status, sourcePortal: keyword
   - estimatedValue, emdAmount: float
   - publishedDate, bidSubmissionDeadline: date
   - aiKeywords: keyword array
   - referenceNumber: keyword

   Create index management functions:
   - createIndex() — create with mapping if not exists
   - indexTender(tender) — add/update single tender
   - bulkIndexTenders(tenders[]) — bulk index
   - deleteTender(id) — remove from index
   - Sync service: on DB write, also index to Elasticsearch

2. TENDER API MODULE (packages/api-server/src/modules/tenders/):

   tender.service.ts:
   - searchTenders(filters) — Elasticsearch query with:
     * Full-text search across title, description, organization, keywords
     * Filters: category, state, tenderType, status, organization, sourcePortal
     * Range filters: estimatedValue (min/max), publishedDate (from/to), deadline (from/to)
     * Sorting: by publishedDate, estimatedValue, deadline, relevance
     * Pagination: page + limit (default 20, max 100)
     * Aggregations: categories count, states count, value ranges (Under 10L, 10L-1Cr, 1Cr-10Cr, 10Cr-100Cr, Above 100Cr), organizations top 20
     * Highlighting on title and description with <mark> tags
   - getTenderById(id) — from PostgreSQL with documents, include view count increment
   - getSimilarTenders(tenderId) — Elasticsearch more_like_this query
   - getTrendingTenders() — most viewed in last 7 days (Redis sorted set for view counts)
   - getTenderStats() — aggregate stats: total active, new today, by category, by state
   - getAutocompleteSuggestions(query) — Elasticsearch suggest API for search-as-you-type

   tender.controller.ts:
   - GET /api/v1/tenders — search with all filters (pass through to searchTenders)
   - GET /api/v1/tenders/:id — single tender with documents
   - GET /api/v1/tenders/:id/similar — similar tenders
   - GET /api/v1/tenders/:id/documents — list documents
   - GET /api/v1/tenders/:id/download/:docId — download document (check plan: only Starter+ can download)
   - GET /api/v1/tenders/stats — dashboard statistics
   - GET /api/v1/tenders/trending — trending tenders
   - GET /api/v1/search/suggestions?q= — autocomplete

   Plan-based access control middleware (planGuard.ts):
   - Free plan: 5 tender views per day (track in Redis with TTL 24h)
   - Starter: 50 views/day
   - Professional/Enterprise: unlimited
   - Document download: Starter+ only
   - Return 403 with { code: 'PLAN_LIMIT_EXCEEDED', upgradeUrl: '/subscription' }

3. WEB — TENDER LISTING & DETAIL (apps/web/):

   app/(dashboard)/tenders/page.tsx — Tender Search & Listing:
   - Top search bar with search icon and placeholder "Search tenders by keyword, organization, or location..."
   - Filter bar with category chips (All, Works, Goods, Services, Consultancy), state dropdown (all 28 states + 8 UTs), value range slider, tender type multiselect, date range picker
   - Filter sidebar (collapsible on mobile) showing aggregation counts from Elasticsearch
   - Tender card grid/list view toggle
   - Each tender card shows:
     * Category badge (color-coded: Works=coral, Goods=blue, Services=teal, Consultancy=purple)
     * Title (2 lines max, truncated)
     * Organization name + State
     * Published date + Deadline with days remaining (color: green >7d, amber 3-7d, red <3d)
     * Estimated value (formatted: ₹X.X Cr / ₹X.X L)
     * AI eligibility score badge (if user has company profile)
     * Save/bookmark button
   - Infinite scroll pagination OR "Load more" button
   - Empty state with illustration when no results
   - Active filter tags with X to remove each filter
   - "Clear all filters" button
   - Results count: "Showing 1-20 of 12,438 tenders"
   - Sort dropdown: Newest first, Deadline soon, Value high-low, Value low-high, Relevance

   app/(dashboard)/tenders/[id]/page.tsx — Tender Detail:
   - Breadcrumb: Dashboard > Tenders > {Tender Title}
   - Header section: Reference number, title, status badge (ACTIVE/CLOSED/AWARDED), save + share buttons
   - 4 metric cards in a row: Estimated Value, EMD Amount, Deadline (with countdown), AI Eligibility Score
   - Tab navigation: Overview, Eligibility, Documents, Similar, Results
   - Overview tab:
     * AI-generated summary (if available)
     * Full description
     * Key details table: Organization, Department, State, District, Category, Tender Type, Published Date, Submission Deadline, Pre-bid Meeting Date
     * Eligibility requirements (parsed from tender): Min Turnover, Min Experience, Required Certifications, MSME reservation, etc.
   - Documents tab: List of downloadable documents with file type icon, name, size, download button (gated by plan)
   - Similar tab: Grid of similar tender cards (from Elasticsearch)
   - Results tab: If tender is awarded, show winner name, company, awarded value, date
   - Source link: "View on original portal →" linking to sourceUrl
   - Sticky bottom bar on mobile: [Save] [Check Eligibility] [Download Docs]

4. MOBILE — TENDER SCREENS (apps/mobile/):

   app/(tabs)/index.tsx — Home Feed:
   - "Good morning, {name}" greeting
   - Quick stats cards row (scrollable): New Today, Active, Saved, Avg AI Score
   - "Recommended for you" section (based on alerts keywords, or trending if no profile)
   - Tender card list with pull-to-refresh
   - Bottom sheet filter on long-press

   app/(tabs)/search.tsx — Search:
   - Search bar at top (auto-focus)
   - Recent searches (stored locally)
   - Category quick-select chips
   - Tender results with FlatList + infinite scroll
   - Filter bottom sheet with all filter options

   app/tender/[id].tsx — Tender Detail:
   - Collapsible header with title
   - Swipeable tabs: Overview, Eligibility, Documents
   - Floating action buttons: Save, Share, Check Eligibility

5. SAVED TENDERS MODULE:
   - POST /api/v1/saved/:tenderId — save/bookmark
   - DELETE /api/v1/saved/:tenderId — unsave
   - GET /api/v1/saved — list all saved (with pagination + search)
   - PATCH /api/v1/saved/:tenderId/notes — add/update personal notes
   - Web: app/(dashboard)/saved/page.tsx — grid of saved tenders with notes, sort by saved date or deadline
   - Mobile: app/(tabs)/saved.tsx — saved tenders list

Create sample data: Seed 50-100 realistic Indian tender records across different categories, states, organizations, and value ranges for development and testing. Include mix of NHAI, GeM, PWD, Municipal Corporation, DRDO tenders.
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 4: USER PROFILE & COMPANY PROFILE
# Estimated time: 2 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 4: User Profile & Company Profile System

Read CLAUDE.md for context. Build the complete user and company profile system that powers the AI eligibility engine.

1. PROFILE API MODULE (packages/api-server/src/modules/users/):

   user.service.ts:
   - getProfile(userId) — user + companyProfile + subscription + stats (total saved, total eligibility checks)
   - updateProfile(userId, data) — update name, email, phone, avatar
   - updateCompanyProfile(userId, data) — upsert company profile with ALL fields from CompanyProfile model:
     * companyType (Pvt Ltd, LLP, Proprietorship, Partnership, Society, Trust, Government)
     * registrationNumber, incorporationDate
     * annualTurnover, netWorth, employeeCount, yearsInBusiness
     * msmeRegistration (Udyam number), msmeCategory (Micro/Small/Medium)
     * isoRegistered, isoCertificates (multi-select: ISO 9001, ISO 14001, ISO 27001, ISO 45001, etc.)
     * startupDpiit, gemRegistered, epfRegistered, gstRegistered
     * workCategories (multi-select: Construction, IT & Software, Medical Equipment, Electrical, Supply, Consultancy, etc.)
     * specializations (free-text tags)
     * statesOperated (multi-select from 28 states + 8 UTs)
     * pastProjectValues (array of numbers)
     * maxProjectCapacity
   - uploadDocument(userId, file, type) — upload to S3, save URL to CompanyProfile
   - deleteDocument(userId, documentId)
   - getProfileCompletionPercentage(userId) — calculate how complete the profile is (for onboarding nudges)

   user.controller.ts:
   - GET /api/v1/profile
   - PATCH /api/v1/profile (basic info)
   - PATCH /api/v1/profile/company (company details)
   - POST /api/v1/profile/documents (multipart upload via multer + S3)
   - DELETE /api/v1/profile/documents/:id
   - GET /api/v1/profile/completion

2. FILE UPLOAD SERVICE (packages/api-server/src/shared/utils/upload.ts):
   - Configure multer with S3 storage (aws-sdk v3 @aws-sdk/client-s3)
   - File type validation: only pdf, jpg, png, doc, docx (max 10MB)
   - Generate unique file keys: `users/{userId}/documents/{uuid}.{ext}`
   - Return S3 URL after upload
   - Delete file from S3 on document deletion

3. WEB — PROFILE PAGES (apps/web/):

   app/(dashboard)/settings/page.tsx — Settings/Profile:
   - Tabs: Personal Info, Company Profile, Documents, Notification Preferences, Subscription

   Personal Info tab:
   - Avatar upload (circular crop)
   - Name, email (verified badge), phone (verified badge), password change

   Company Profile tab (THIS IS CRITICAL for AI eligibility):
   - Multi-step form OR single scrollable form with sections:
   - Section 1: Basic Info — Company name, GSTIN, PAN, company type dropdown, registration number, incorporation date
   - Section 2: Financial — Annual turnover (₹ input with Cr/L selector), net worth, employee count, years in business
   - Section 3: Registrations — MSME toggle + Udyam number + category, GEM registration toggle, Startup DPIIT toggle, EPF toggle, GST toggle
   - Section 4: Certifications — ISO multi-select checkboxes with certificate number fields
   - Section 5: Capabilities — Work categories (checkbox grid), specializations (tag input), states operated (multi-select with "Select All" option)
   - Section 6: Past Experience — Add past projects: project name, value, completion date, client name (dynamic list, add/remove rows)
   - Profile completion progress bar at top (e.g., "Your profile is 65% complete. Complete it to get accurate AI eligibility scores.")
   - Save as draft + Submit button
   - Success toast: "Profile updated! AI eligibility scores will now be more accurate."

   Documents tab:
   - Upload area (drag & drop) for: PAN Card, GST Certificate, MSME Certificate, Balance Sheet, Bank Statement, Experience Certificates
   - File list with: icon, name, type, upload date, view/download/delete actions
   - Max 10 documents

4. MOBILE — PROFILE (apps/mobile/):
   app/(tabs)/profile.tsx:
   - User info card at top (avatar, name, email, plan badge)
   - Menu list: Edit Profile, Company Profile, Documents, Subscription, Notification Settings, Help, Logout
   - Profile completion banner if incomplete

5. ONBOARDING FLOW (new user experience):
   - After first login, show a 3-step onboarding modal:
     Step 1: "Tell us about your company" — company name, type, GSTIN
     Step 2: "Your capabilities" — work categories, states, MSME status
     Step 3: "Set up your first alert" — keywords, category, state
   - "Skip for now" option on each step
   - Show profile completion nudge on dashboard if <60% complete
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 5: AI ELIGIBILITY ENGINE
# Estimated time: 3-4 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 5: AI-Powered Eligibility Engine

Read CLAUDE.md and docs/TenderBazaar_Development_Blueprint.md (Section 5: AI Integration) for the complete eligibility engine design.

Build the two-layer AI eligibility system: fast rule-based checks + LLM parsing for complex criteria.

1. PYTHON AI MICROSERVICE (packages/ai-service/):

   app/main.py — FastAPI app:
   - CORS enabled for API server origin
   - Routes: /health, /eligibility/check, /eligibility/bulk, /ai/summary, /ai/categorize
   - Error handling middleware

   app/eligibility/engine.py — Core eligibility logic (IMPLEMENT FULLY from the blueprint):
   
   Rule-based checks (fast, deterministic):
   - Turnover check: company.annualTurnover >= tender.minTurnover
   - Net worth check: company.netWorth >= tender.minNetWorth
   - Experience check: company.yearsInBusiness >= tender.minExperience
   - MSME reservation check: if tender.reservedForMSME, company must be MSME registered
   - EMD exemption: if tender.emdExemptMSME and company is MSME, flag EMD savings
   - Certification check: for each required cert, check if company has it
   - Geographic check: tender.state in company.statesOperated
   - Category match: tender.category matches company.workCategories
   - Project capacity: company.maxProjectCapacity >= tender.estimatedValue
   - Past project experience: max(company.pastProjectValues) >= some threshold relative to tender value (typically 40-50% of tender value needed as single past project)
   - Startup DPIIT reservation: if tender.reservedForStartups, check company.startupDpiit

   Each check produces:
   - criterion: name of the criterion
   - status: MET / NOT_MET / PARTIALLY_MET / UNCLEAR
   - detail: human-readable explanation with actual numbers
   - importance: CRITICAL / IMPORTANT / OPTIONAL

   LLM-based analysis (for raw eligibility text from tender documents):
   - Send company profile + tender's raw eligibility text to Claude API (anthropic SDK)
   - Prompt asks Claude to identify additional criteria NOT covered by rule-based checks:
     * Specific technical qualifications
     * Specific past project type requirements (e.g., "must have completed 2 bridge projects >10Cr")
     * Blacklisting/debarment clauses
     * Joint venture requirements
     * Specific manpower requirements (e.g., "must have 5 civil engineers on rolls")
     * Registration with specific bodies
   - Parse Claude's JSON response into CriterionResult objects
   - Use claude-sonnet-4-20250514 model, max_tokens 1000

   Score calculation:
   - Count MET, NOT_MET, PARTIALLY_MET
   - Weight CRITICAL criteria higher (if ANY critical is NOT_MET, cap score at 40)
   - Overall score = (met + partial*0.5) / total * 100
   - is_eligible = score >= 60 AND no critical NOT_MET

   Suggestion generator:
   - For each NOT_MET criterion, generate actionable suggestion:
     * Low turnover → "Consider MSME loan or form JV with larger partner"
     * No MSME → "Register on udyamregistration.gov.in for MSME benefits including EMD exemption"
     * Missing cert → "Obtain {cert} certification to qualify"
     * Low experience → "Document all past projects, get completion certificates"
     * No past project match → "Participate in smaller tenders first to build experience"

   app/summarizer/tender_summary.py — AI Tender Summary:
   - Send tender title + description to Claude API
   - Generate: 2-3 sentence summary, key requirements bullet points, suggested bidder profile
   - Cache summaries in Redis (TTL 7 days)

   app/categorizer/nlp_classifier.py — Auto-categorization:
   - Classify tender into category (Works/Goods/Services/Consultancy) from title + description
   - Extract keywords for search indexing
   - Tag with relevant industries (Construction, IT, Medical, etc.)

2. NODE.JS ELIGIBILITY MODULE (packages/api-server/src/modules/eligibility/):

   eligibility.service.ts:
   - checkEligibility(userId, tenderId):
     * Fetch user's CompanyProfile
     * Fetch Tender with parsed eligibility fields
     * Call Python AI service via HTTP (axios to localhost:5000/eligibility/check)
     * Save EligibilityCheck to DB (upsert on userId+tenderId)
     * Return result
   - getBulkEligibility(userId, tenderIds[]):
     * Check multiple tenders, return array of scores (limit 10 per request)
   - getEligibilityHistory(userId):
     * Past eligibility checks with tender info

   eligibility.controller.ts:
   - POST /api/v1/eligibility/check { tenderId } — check single tender (requires Starter+ plan OR 1 free check)
   - POST /api/v1/eligibility/bulk { tenderIds[] } — bulk check (Professional+ only)
   - GET /api/v1/eligibility/history — past checks
   
   Plan limits:
   - Free: 1 eligibility check total (ever, as a trial)
   - Starter: 5 checks per month
   - Professional: 50 checks per month
   - Enterprise: unlimited
   - Track in Redis: `eligibility:count:{userId}:{month}` with expiry

3. WEB — ELIGIBILITY UI (apps/web/):

   Eligibility check on tender detail page (new tab):
   - If user has no company profile: show CTA "Complete your company profile to check eligibility" with link to /settings
   - If profile exists: show "Check Eligibility" button
   - Loading state: animated progress bar with "Analyzing tender requirements..."
   - Result display:
     * Large circular score gauge (0-100) with color: green ≥70, amber 40-69, red <40
     * "Eligible" / "Partially Eligible" / "Not Eligible" badge
     * Criteria breakdown list:
       - Each criterion as a row: ✅/❌/⚠️ icon, criterion name, detail text, importance badge
       - Green row for MET, red for NOT_MET, amber for PARTIALLY_MET
     * Suggestions section: numbered list of actionable improvements
     * "Save this analysis" button (saves to eligibility history)
   - If plan limit reached: show upgrade CTA overlay

   app/(dashboard)/eligibility/page.tsx — Eligibility Dashboard:
   - History of past eligibility checks
   - Filter by: score range, eligible/not eligible, date
   - Aggregate stats: total checks, average score, most common NOT_MET criteria

4. MOBILE — ELIGIBILITY:
   - "Check Eligibility" button on tender detail screen
   - Bottom sheet result with score ring, criteria list, suggestions
   - Share eligibility report via WhatsApp/email

5. AI TENDER MATCHING (packages/api-server/src/modules/eligibility/):
   - POST /api/v1/ai/match — Find best-matching tenders for user:
     * Get user's company profile
     * Query Elasticsearch for tenders matching user's categories, states, value range
     * Run quick eligibility pre-check (rules-only, no LLM) on top 50 results
     * Return top 20 sorted by eligibility score
   - This powers the "Recommended for you" section on dashboard

Update Docker Compose to include the Python AI service container.
Make sure the AI service starts with: uvicorn app.main:app --host 0.0.0.0 --port 5000
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 6: ALERT SYSTEM & NOTIFICATIONS
# Estimated time: 3-4 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 6: Alert System + Multi-Channel Notifications (Push, Email, WhatsApp, SMS)

Read CLAUDE.md for context.

1. ALERT MODULE (packages/api-server/src/modules/alerts/):

   alert.service.ts:
   - createAlert(userId, data): create alert with keywords, categories, states, value range, organizations, tender types, frequency (INSTANT/DAILY/WEEKLY), channel preferences (email, push, whatsapp, sms)
   - updateAlert(userId, alertId, data)
   - deleteAlert(userId, alertId)
   - toggleAlert(userId, alertId, isActive)
   - getAlerts(userId): list all user alerts
   - matchTendersToAlerts(): THE CORE MATCHING ENGINE:
     * Runs periodically (every 30 minutes for INSTANT, daily at 8 AM IST for DAILY, weekly Monday 8 AM for WEEKLY)
     * For each active alert:
       - Query Elasticsearch with alert's keywords + filters
       - Filter to only NEW tenders (published since last match run)
       - Deduplicate against previously notified tenders (track in Redis set per alert)
       - Queue notifications via BullMQ for matched tenders
   - testAlert(userId, alertId): run match without sending notifications, return preview

   alert.controller.ts:
   - POST /api/v1/alerts — create (check plan limit: Free=1, Starter=5, Pro=20, Enterprise=unlimited)
   - GET /api/v1/alerts — list all
   - PATCH /api/v1/alerts/:id — update
   - DELETE /api/v1/alerts/:id — delete
   - PATCH /api/v1/alerts/:id/toggle — enable/disable
   - POST /api/v1/alerts/:id/test — test run with preview results

2. NOTIFICATION SERVICE (packages/notification-service/):

   Queue setup (src/queue/notification-queue.ts):
   - BullMQ queue named 'notifications' with Redis connection
   - Job types: TENDER_ALERT, DEADLINE_REMINDER, SUBSCRIPTION_EXPIRY, NEW_CORRIGENDUM, TENDER_RESULT, ELIGIBILITY_RESULT
   - Worker processes jobs and dispatches to correct provider
   - Concurrency: 5 workers
   - Retry: 3 attempts with exponential backoff
   - Dead letter queue for failed notifications

   Email provider (src/providers/email.ts):
   - Use AWS SES (or Resend as alternative)
   - HTML email templates using React Email (npm: @react-email/components):
     * tender-alert.tsx: "X new tenders match your alert '{alertName}'" with tender cards, CTA button
     * deadline-reminder.tsx: "Tender deadline in 48 hours" with tender details
     * subscription-expiry.tsx: "Your {plan} plan expires in 7 days" with renewal CTA
     * welcome.tsx: Welcome email after registration
     * otp.tsx: OTP verification email
   - All templates: branded header with TenderBazaar logo, responsive layout, unsubscribe link

   WhatsApp provider (src/providers/whatsapp.ts):
   - Integrate with WATI (wati.io) OR Gupshup WhatsApp Business API
   - Pre-approved template messages (must be approved by Meta):
     * tender_alert_v1: "🔔 {count} new tenders match '{alert_name}'!\n\n1. {title1} - ₹{value1}\n📅 Deadline: {date1}\n\n2. {title2} - ₹{value2}\n📅 Deadline: {date2}\n\nView all: {url}"
     * deadline_reminder_v1: "⏰ Reminder: Tender deadline in {hours} hours!\n\n{title}\nOrg: {org}\nValue: ₹{value}\n\nView: {url}"
     * subscription_expiry_v1: "Your TenderBazaar {plan} plan expires on {date}.\n\nRenew now to keep getting alerts: {url}"
   - WhatsApp only for Professional+ plans
   - Respect opt-in: only send if user has whatsappEnabled=true on the alert AND has verified their WhatsApp number

   Push notification provider (src/providers/push.ts):
   - Firebase Cloud Messaging (FCM) for Android
   - Apple Push Notification Service (APNs) via FCM
   - Use firebase-admin SDK
   - Store FCM tokens in Session model (fcmToken field)
   - Handle token refresh
   - Notification payload: { title, body, data: { tenderId, type, url } }
   - Android notification channels: 'tender-alerts' (high), 'deadlines' (max), 'general' (default)

   SMS provider (src/providers/sms.ts):
   - Integrate with MSG91 (popular in India, DLT registered)
   - Use for: OTP delivery, critical deadline reminders (last 24h)
   - SMS only for Enterprise plan (except OTP which is for all)
   - Template: "TenderBazaar: {count} new tenders match your search. Deadline: {date}. View: {shortUrl}"

3. NOTIFICATION API (packages/api-server/src/modules/notifications/):

   notification.service.ts:
   - getNotifications(userId, { page, limit, unreadOnly })
   - markAsRead(userId, notificationId)
   - markAllAsRead(userId)
   - getUnreadCount(userId) — cached in Redis, invalidated on new notification
   - updateNotificationPreferences(userId, preferences):
     * emailEnabled, pushEnabled, whatsappEnabled, smsEnabled
     * quietHours: { start: '22:00', end: '07:00' } — don't send during these hours
     * digestMode: boolean — batch notifications into single daily digest

   notification.controller.ts:
   - GET /api/v1/notifications?page=1&unreadOnly=false
   - PATCH /api/v1/notifications/:id/read
   - POST /api/v1/notifications/read-all
   - GET /api/v1/notifications/unread-count
   - PATCH /api/v1/notifications/settings

4. AUTOMATED TRIGGERS:
   Set up cron jobs or BullMQ repeatable jobs:
   - Every 30 min: matchTendersToAlerts() for INSTANT alerts
   - Every day 8 AM IST: matchTendersToAlerts() for DAILY alerts
   - Every Monday 8 AM IST: matchTendersToAlerts() for WEEKLY alerts
   - Every day 9 AM IST: Check saved tenders with deadline in 48h → send DEADLINE_REMINDER
   - Every day: Check subscriptions expiring in 7 days → send SUBSCRIPTION_EXPIRY
   - On new corrigendum detection by scraper → send NEW_CORRIGENDUM to users who saved that tender

5. WEB — NOTIFICATIONS UI:
   - Notification bell icon in top nav with unread count badge (real-time via polling every 30s or WebSocket)
   - Dropdown panel showing latest 10 notifications, "View all" link
   - app/(dashboard)/alerts/page.tsx — Alert management:
     * List of user's alerts with: name, keywords, frequency, channels, match count, toggle, edit, delete
     * "Create Alert" button → modal/page with form:
       - Alert name (e.g., "Gujarat IT Tenders")
       - Keywords (tag input, comma-separated)
       - Categories (multi-select checkboxes)
       - States (multi-select dropdown)
       - Value range (min/max inputs)
       - Organizations (tag input)
       - Tender types (multi-select)
       - Frequency: Instant / Daily / Weekly (radio buttons)
       - Channels: Email ✓, Push ✓, WhatsApp (Pro+ badge), SMS (Enterprise badge)
     * Plan limit indicator: "Using 3 of 5 alerts (Starter plan)"

6. MOBILE — NOTIFICATIONS:
   - Register FCM token on app launch (services/notifications.ts from blueprint)
   - Handle notification tap → navigate to tender detail
   - app/(tabs)/alerts.tsx:
     * Two sections: "Notifications" (list) and "My Alerts" (manage)
     * Swipe to dismiss notification
     * Badge count on tab icon
   - Deep linking: notification data contains tenderId → opens tender/[id] screen

7. WEBSOCKET FOR REAL-TIME (optional, can use polling initially):
   - Socket.io server in api-server for real-time notification delivery
   - Client connects after auth, joins user-specific room
   - On new notification → emit to user's room
   - Web: useSocket hook for real-time unread count updates
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 7: SUBSCRIPTION & PAYMENTS (Razorpay)
# Estimated time: 2-3 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 7: Subscription System with Razorpay Payments

Read CLAUDE.md for context.

1. PAYMENT MODULE (packages/api-server/src/modules/payments/):

   payment.service.ts:
   - Use razorpay npm package
   - createOrder(userId, planSlug, billingCycle):
     * Look up plan, calculate amount (monthly or yearly with discount)
     * Create Razorpay order via razorpay.orders.create()
     * Save pending Payment record to DB
     * Return: orderId, amount (in paise), currency, razorpayKeyId
   - verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature):
     * Verify HMAC SHA256 signature
     * Update Payment status to SUCCESS
     * Create/update Subscription (upsert): set plan, status=ACTIVE, calculate endDate
     * Send confirmation email + push notification
   - cancelSubscription(userId):
     * Set autoRenew=false, status will change to EXPIRED at endDate
   - handleWebhook(event):
     * Razorpay sends webhooks for: payment.captured, payment.failed, subscription.charged, subscription.cancelled
     * Verify webhook signature
     * Update payment/subscription status accordingly
   - getInvoices(userId): list past payments with invoice URLs
   - generateInvoice(paymentId): generate PDF invoice (use the PDF skill if needed)

   subscription.service.ts:
   - getCurrentSubscription(userId): return active subscription with plan details + usage stats
   - checkPlanLimit(userId, feature): check if user has exceeded limit for a feature
     * Features: dailyTenderViews, maxAlerts, maxKeywords, maxSavedTenders, documentDownload, aiEligibility, whatsappAlerts, apiAccess
     * Track daily counters in Redis with TTL
   - getUsageStats(userId): return current usage vs plan limits for all features
   - handleExpiry(): cron job to check and expire subscriptions past endDate
   - sendRenewalReminder(): 7 days, 3 days, 1 day before expiry

   payment.controller.ts:
   - GET /api/v1/plans — list all active plans with features
   - GET /api/v1/subscription — current subscription + usage stats
   - POST /api/v1/subscription/checkout { planSlug, billingCycle } — create Razorpay order
   - POST /api/v1/subscription/verify { razorpayOrderId, razorpayPaymentId, razorpaySignature }
   - POST /api/v1/subscription/cancel
   - GET /api/v1/subscription/invoices
   - POST /api/v1/webhooks/razorpay — webhook handler (no auth, verify signature)

2. WEB — PRICING & SUBSCRIPTION:

   app/(marketing)/pricing/page.tsx — Public Pricing Page:
   - Monthly/Yearly toggle (yearly shows "Save 17%")
   - 4-column pricing cards:
     * Free: ₹0 — basic features listed, "Start Free" button
     * Starter: ₹1,499/mo — features listed, "Get Started" button
     * Professional: ₹4,999/mo — "Most Popular" badge with accent border, "Start 7-day Trial" button
     * Enterprise: ₹14,999/mo — "Contact Sales" button + all features
   - Feature comparison table below cards (checkmarks and x's for each feature per plan)
   - FAQ section: billing, cancellation, upgrades, GST invoice
   - Trust signals: "Used by 15,000+ businesses", payment logos, SSL badge

   app/(dashboard)/subscription/page.tsx — Subscription Management:
   - Current plan card with: plan name, price, billing cycle, next renewal date, auto-renew toggle
   - Usage meters for each limited feature: "Tender views: 32/50 today", "AI checks: 3/5 this month", "Alerts: 4/5 used"
   - "Upgrade Plan" button → shows plan comparison with current plan highlighted
   - Payment history table: date, amount, status, invoice download link
   - Cancel subscription section (with confirmation modal and reason dropdown)

   Razorpay checkout integration (apps/web/):
   - Load Razorpay checkout.js script
   - On "Pay" click: call POST /subscription/checkout → get orderId → open Razorpay modal
   - Razorpay modal prefilled with user's name, email, phone
   - On success: call POST /subscription/verify with payment details
   - Show success page with confetti animation
   - On failure: show error, option to retry

3. MOBILE — SUBSCRIPTION:
   app/subscription.tsx:
   - Plan cards (horizontal scrollable on mobile)
   - Razorpay React Native SDK integration (react-native-razorpay)
   - Same checkout flow as web

4. PLAN GUARD MIDDLEWARE (already outlined, now implement fully):
   - Middleware factory: planGuard(feature: string)
   - Applied to routes that need plan checking
   - Returns 403 with upgrade prompt if limit exceeded
   - Free plan users see tasteful upgrade CTAs throughout the app (not annoying popups):
     * "🔒 Upgrade to download documents" on download buttons
     * "⚡ 2 views left today. Upgrade for unlimited" banner
     * "🤖 Try AI Eligibility — 1 free check" on first visit

5. AUTO-RENEWAL CRON:
   - Daily check for subscriptions expiring today with autoRenew=true
   - Attempt to charge saved payment method (Razorpay recurring payments)
   - On failure: retry next day, send email notification
   - After 3 failures: expire subscription, downgrade to Free plan
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 8: SCRAPING ENGINE (PRODUCTION)
# Estimated time: 5-7 days (ongoing maintenance)
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 8: Production Scraping Engine

Read CLAUDE.md and docs/gem-scraper-complete-guide.ts for the complete scraping architecture and code patterns.

Build the production scraping system that fetches tenders from government portals daily.

1. SCRAPER FRAMEWORK (packages/scraper-engine/):

   Base scraper class (scrapers/base-scraper.ts):
   - Abstract class with: name, sourcePortal, baseUrl, schedule
   - Methods: scrape(), parse(), save(), getSessionCookie()
   - Built-in: retry logic (3 attempts, exponential backoff), polite delays (randomized 2-5s), error logging, metrics (total scraped, new, updated, errors)
   - HTTP client factory with realistic browser headers, cookie handling, proxy support
   - Rate limiter per portal (configurable requests/minute)

   Implement scrapers for these 10 portals (start with these, expand later):

   scrapers/gem.ts — GeM Portal (bidplus.gem.gov.in):
   - Method A: Direct HTTP to AJAX pagination endpoint
   - Fetch bid listing pages, parse HTML with cheerio
   - Extract: bid number, title, category, department, start/end dates, quantity, estimated value
   - Optionally fetch detail page for each bid (full description, documents, eligibility)
   - Schedule: every 4 hours

   scrapers/cppp.ts — Central Public Procurement Portal (eprocure.gov.in):
   - Method B: Playwright headless browser (Java-based rendering)
   - Navigate to active tenders listing
   - Handle CAPTCHA (integrate 2Captcha service as optional, log and skip if no service configured)
   - Extract: tender ID, title, organization, estimated value, EMD, dates, document links
   - Schedule: every 6 hours

   scrapers/states/gujarat.ts — Gujarat (nprocure.com):
   - Method B: Playwright (JavaScript-heavy)
   - Navigate with session management
   - Schedule: every 6 hours

   scrapers/states/maharashtra.ts — Maharashtra (mahatenders.gov.in):
   - Method A with ASP.NET __VIEWSTATE handling
   - Extract ViewState, EventValidation from each page, include in POST
   - Schedule: every 6 hours

   scrapers/states/rajasthan.ts — Rajasthan (eproc.rajasthan.gov.in):
   - Method A: jQuery AJAX endpoint
   - Schedule: every 6 hours

   scrapers/states/karnataka.ts — Karnataka (eproc.karnataka.gov.in)
   scrapers/states/tamilnadu.ts — Tamil Nadu (tntenders.gov.in)
   scrapers/states/up.ts — Uttar Pradesh (etender.up.nic.in) — Playwright
   scrapers/states/mp.ts — Madhya Pradesh (mptenders.gov.in)
   scrapers/states/delhi.ts — Delhi (govtprocurement.delhi.gov.in)

2. DATA PIPELINE (packages/scraper-engine/pipeline/):

   parser.ts:
   - Normalize field names across different portal formats
   - Parse dates (handle multiple Indian date formats: DD/MM/YYYY, DD-MMM-YYYY, etc.)
   - Parse monetary values (handle: "Rs. 1,23,456", "₹ 5.00 Crore", "INR 2,45,000.00", "Refer Document")
   - Clean HTML from descriptions (strip tags, decode entities)
   - Extract state/district from location strings

   normalizer.ts:
   - Map organization names to standardized names (e.g., "Natl Highway Auth of India" → "National Highways Authority of India")
   - Map categories: parse from tender type/nature fields into TenderCategory enum
   - Normalize state names (handle abbreviations: GJ→Gujarat, MH→Maharashtra)

   deduplicator.ts:
   - Check sourceId + sourcePortal uniqueness (primary key)
   - For tenders appearing on multiple portals, detect by: title similarity (fuzzy match) + organization + similar value + similar dates
   - Merge: keep the most complete record, link as corrigendum if dates differ

   categorizer.ts:
   - Rule-based first: keyword matching for category classification
   - Fallback to AI service for ambiguous tenders
   - Tag with AI-generated keywords for better search

3. SCHEDULER & ORCHESTRATION (packages/scraper-engine/scheduler/):

   scheduler.ts:
   - Use node-cron for each scraper's schedule
   - BullMQ job queue for scraper runs (so they don't overlap)
   - On each run:
     1. Log start time, scraper name
     2. Run scraper
     3. Pipe results through parser → normalizer → deduplicator → categorizer
     4. Upsert to PostgreSQL (prisma.tender.upsert)
     5. Index to Elasticsearch (bulk index)
     6. Log: total fetched, new, updated, errors, duration
     7. Trigger alert matching for new tenders (publish event to notification queue)
   - Health monitoring: if any scraper returns 0 results 3 times in a row, send alert to admin

   monitor.ts:
   - Track scraper health metrics in Redis
   - Expose GET /api/v1/admin/scrapers endpoint:
     * For each scraper: name, last run time, status (healthy/warning/error), tenders fetched, next scheduled run
   - Alert admin via email if scraper fails repeatedly

4. PROXY & ANTI-DETECTION:
   - Support proxy rotation via environment variable PROXY_LIST (comma-separated)
   - Rotate User-Agent strings from a list of 20+ real browser UAs
   - Random delays between requests
   - Playwright stealth mode (disable webdriver flag, randomize viewport)

5. ADMIN SCRAPER DASHBOARD (apps/admin/):
   - Table of all scrapers with status, last run, metrics
   - "Run Now" button to manually trigger any scraper
   - Logs viewer for each scraper (last 100 runs)
   - Charts: tenders scraped per day, by portal, error rate
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 9: ADMIN DASHBOARD & ANALYTICS
# Estimated time: 2-3 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 9: Admin Dashboard + Analytics

Build the admin panel and analytics system.

1. ADMIN API (packages/api-server/src/modules/admin/):
   All admin routes protected by requireRole('ADMIN') middleware.

   admin.service.ts:
   - getDashboardStats():
     * Total users (with trend: +X this week)
     * Active subscriptions by plan (pie chart data)
     * Total revenue this month / this year
     * Total tenders in database
     * Tenders added today / this week
     * Active scrapers / errored scrapers
     * Top 10 searched keywords
     * Most active users
   - getUserList(filters): paginated user list with search, filter by plan, sort by join date / last active
   - getUserDetail(userId): full user info + subscription + activity log
   - updateUser(userId, data): change role, activate/deactivate, override plan
   - getTenderManagement(filters): tender list with source portal filter, ability to edit/delete
   - getRevenueReport(dateRange): daily/monthly revenue, MRR, churn rate, LTV
   - getScraperStatus(): all scrapers with health, metrics, logs
   - triggerScraper(scraperId): manually run a scraper
   - sendBroadcastNotification(message, channel, filters): send to all users or filtered segment

2. ADMIN DASHBOARD (apps/admin/):

   app/dashboard/page.tsx — Overview:
   - Stats cards: Total Users, Active Subscriptions, MRR, Total Tenders, Today's Tenders
   - Revenue chart (line chart, last 30 days)
   - New users chart (bar chart, last 7 days)
   - Subscription distribution (donut chart)
   - Scraper health status cards (green/amber/red)
   - Recent user signups list

   app/users/page.tsx — User Management:
   - Searchable, sortable table: name, email, phone, plan, joined date, last active, status
   - Click to view user detail
   - Bulk actions: export CSV, send notification

   app/tenders/page.tsx — Tender Management:
   - Searchable table of all tenders with portal source
   - Edit tender metadata
   - Delete duplicate/incorrect tenders
   - View scraping source and raw data

   app/scrapers/page.tsx — Scraper Monitoring:
   - Card per scraper: name, status (live dot), last run, tenders fetched, error count
   - "Run Now" button per scraper
   - Expandable log viewer
   - Schedule editor

   app/subscriptions/page.tsx — Subscription Analytics:
   - Active subscribers count by plan
   - Churn rate (monthly)
   - Upgrade/downgrade tracking
   - Revenue per plan
   - Expiring soon list

   app/analytics/page.tsx — Platform Analytics:
   - Popular search queries (word cloud or bar chart)
   - Most viewed tenders
   - Most saved tenders
   - User activity heatmap (by hour of day)
   - Geographic distribution of users (by state)
   - Tender volume by state/category over time

   Use Recharts for all charts. Use shadcn/ui data table for all tables.

3. USER-FACING ANALYTICS (apps/web/):

   app/(dashboard)/analytics/page.tsx — User's Analytics:
   - Tenders viewed over time (line chart)
   - Saved tenders by category (pie chart)
   - Alert match rate (how many tenders matched each alert)
   - Eligibility score trend (if they've done multiple checks)
   - Recommended actions: "Complete your profile to improve match accuracy"
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 10: LANDING PAGE & SEO & MARKETING
# Estimated time: 2-3 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 10: Pro-Level Landing Page + SEO + Marketing Pages

Read the frontend-design SKILL.md for design guidelines. The landing page must be STUNNING — this is the first impression. Design direction: bold, modern, data-driven aesthetic with saffron orange (#FF6B35) as hero accent against deep navy (#1B2845).

1. LANDING PAGE (apps/web/app/(marketing)/page.tsx):

   Build a conversion-optimized landing page with these sections:

   HERO:
   - Full-width section with deep navy background
   - Large headline: "India's Smartest Tender Platform" (Plus Jakarta Sans, 48-56px, white)
   - Subheadline: "AI-powered eligibility checking. 50,000+ tenders from 28 states. Never miss an opportunity." (18px, gray-300)
   - Centered search bar: "Search tenders by keyword, organization, or state..." — functional, actually searches and shows 3 preview results below
   - Two CTAs: "Start Free" (saffron orange solid button) and "View Demo" (outline button)
   - Stats bar below: animated counters "52,438 Active Tenders • 28 States • 100+ Organizations • 15,000+ Users"
   - Subtle background: animated grid of faint tender card outlines scrolling slowly

   LIVE TICKER:
   - Horizontal scrolling banner showing real tenders being added: "🔔 New: Supply of Medical Equipment — AIIMS Delhi — ₹2.4 Cr" (builds trust that data is live)

   FEATURES (6 cards in 3x2 grid):
   - "AI Eligibility Check" — Know if you qualify before you bid. AI analyzes tender requirements against your profile.
   - "Smart Alerts" — Get notified via Email, Push, WhatsApp the moment a matching tender is published.
   - "50+ Portal Coverage" — GeM, CPPP, all 28 state portals, PSUs, Railways, Defence — all in one place.
   - "Tender Results" — Track who won past tenders. Analyze competitors' winning patterns.
   - "Document Download" — Instantly download tender documents, BOQ, corrigendums without visiting multiple portals.
   - "Mobile App" — Full-featured Android & iOS app. Search, save, and get alerts on the go.
   Each card with a lucide-react icon, title, 2-line description, subtle hover effect.

   AI ELIGIBILITY DEMO (interactive section):
   - Split layout: left shows a sample tender card, right shows the eligibility result with animated score ring going from 0 to 82%, criteria list appearing one by one with ✅/❌ animations
   - CTA: "Check your eligibility — it's free for your first tender"

   HOW IT WORKS (3 steps):
   - Step 1: "Set up your company profile" — with profile form illustration
   - Step 2: "Create alerts for your industry" — with alert config illustration  
   - Step 3: "Get matched tenders daily" — with notification illustration
   - Connecting line/arrow between steps

   PRICING (embedded from pricing page):
   - 4 plan cards, yearly toggle, highlight Professional as "Most Popular"

   TESTIMONIALS:
   - 3 testimonial cards with: quote, name, company, location, star rating
   - Auto-rotate carousel on mobile

   TRUSTED BY (logo bar):
   - "Trusted by businesses across India" with placeholder company logos

   STATE COVERAGE MAP:
   - Stylized India map showing covered states (highlighted in saffron orange)
   - Click state → shows count of active tenders

   FINAL CTA:
   - Dark section: "Stop searching 50 websites. Start winning tenders."
   - Email input + "Get Started Free" button
   - "No credit card required • Free forever plan • Cancel anytime"

   FOOTER:
   - 4 columns: Product (features, pricing, API), Company (about, careers, contact), Resources (blog, help center, API docs), Legal (terms, privacy, refund policy)
   - Social icons, "Made with ❤️ in Ahmedabad, India"

2. SEO PAGES (programmatic, for organic traffic):

   app/(marketing)/tenders/[state]/page.tsx — State-wise tender pages:
   - "Latest {State} Government Tenders 2026"
   - Pre-rendered (SSG) list of recent tenders for that state
   - Meta tags optimized for "Gujarat government tenders", "Maharashtra tenders 2026" etc.
   - Create for all 28 states + 8 UTs (generateStaticParams)

   app/(marketing)/tenders/[state]/[category]/page.tsx — State + Category:
   - "Construction Tenders in Gujarat 2026"
   - Further narrows SEO targeting

   app/(marketing)/tenders/organization/[slug]/page.tsx — Organization pages:
   - "NHAI Tenders 2026", "Indian Railways Tenders", "GeM Tenders"

   app/(marketing)/blog/[slug]/page.tsx — Blog:
   - MDX-based blog for content marketing
   - Topics: "How to bid on government tenders", "MSME benefits in tendering", "Understanding EMD"

3. SEO SETUP:
   - next-sitemap for auto-generated sitemap.xml
   - robots.txt allowing search engines
   - Structured data (JSON-LD) for tender listings
   - Open Graph + Twitter Card meta tags on all pages
   - Canonical URLs
   - next/head with proper title, description for each page
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 11: ADDITIONAL FEATURES & COMPETITIVE EDGE
# Estimated time: 5-7 days (can be done incrementally)
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 11: Advanced Features for Competitive Edge

These features differentiate TenderBazaar from all competitors. Implement as many as possible.

1. TENDER RESULT TRACKING:
   - Scrape tender results (winning bidder, amount) from portals
   - Model: TenderResult (already in schema)
   - Show on tender detail page under "Results" tab
   - Allow users to search "Who won tenders from NHAI in Gujarat?"
   - Competitor analysis: "Companies that won tenders similar to yours"

2. CORRIGENDUM / AMENDMENT ALERTS:
   - When scraper detects a corrigendum for an existing tender:
     * Update original tender, link corrigendum
     * Notify ALL users who have saved that tender
     * Show "Updated" badge on tender card with changelog

3. BID DOCUMENT PREPARATION ASSISTANT (AI):
   - POST /api/v1/ai/bid-assistant
   - User uploads tender document (PDF)
   - AI extracts: all requirements, eligibility criteria, required documents checklist, important dates, submission instructions
   - Generates: personalized document checklist based on user's company profile
   - Shows: "You need to prepare these 12 documents. You already have 7 uploaded. Missing: EMD Bank Guarantee, Solvency Certificate, ..."
   - Enterprise plan only

4. TENDER COMPARISON:
   - Select 2-3 tenders → side-by-side comparison table
   - Compare: value, EMD, deadline, eligibility requirements, your eligibility score
   - "Which tender should I bid on?" AI recommendation

5. MULTI-LANGUAGE SUPPORT:
   - Use next-intl for web internationalization
   - Support: English (default), Hindi, Gujarati, Tamil, Telugu, Marathi, Kannada, Bengali
   - Translate: UI labels, navigation, buttons, error messages
   - Tender content stays in original language (mostly English/Hindi)
   - Language selector in header and settings

6. API ACCESS FOR ENTERPRISE:
   - Public API with API key authentication
   - Rate limit: 100 requests/hour
   - Endpoints: search tenders, get tender by ID, get tender results
   - API documentation page (using Swagger/OpenAPI)
   - API key management in user settings
   - Webhook configuration: send POST to user's URL when new tender matches

7. REFERRAL SYSTEM:
   - Unique referral code per user
   - Reward: Both referrer and referee get 1 month free Starter plan (or ₹500 credit)
   - Referral dashboard showing: total referrals, successful conversions, rewards earned
   - Shareable referral link + WhatsApp/email share buttons

8. TENDER CALENDAR VIEW:
   - Calendar showing tender deadlines
   - Color-coded by category
   - Click date → see tenders with that deadline
   - Export to Google Calendar / iCal

9. SAVED SEARCH & RECENT SEARCHES:
   - Save frequently used search queries with all filters
   - Quick access from dashboard sidebar
   - Recent searches dropdown in search bar (last 10)

10. EXPORT DATA:
    - Download saved tenders as Excel/CSV
    - Download eligibility reports as PDF
    - Download tender details as PDF (professional format)
    - Bulk export for Enterprise users

11. HELP & SUPPORT:
    - In-app chat widget (Crisp.chat or Tawk.to integration)
    - Help center with searchable FAQs (MDX-based, same as blog)
    - Video tutorials (embedded YouTube)
    - Contact form

12. PWA SUPPORT:
    - Make the web app installable as PWA (next-pwa)
    - Offline support for saved tenders
    - Push notifications via service worker (in addition to FCM)

After implementing these features, run through the entire user journey:
Register → Complete profile → Set alerts → Search tenders → Check eligibility → Save tenders → Get notifications → Subscribe to paid plan → Download documents → View results
"""


# ─────────────────────────────────────────────────────────────────────
# PHASE 12: DEPLOYMENT & GO LIVE
# Estimated time: 2-3 days
# ─────────────────────────────────────────────────────────────────────

"""
PROMPT — PHASE 12: Production Deployment & Launch

1. INFRASTRUCTURE:
   - Web (apps/web): Deploy to Vercel (connect GitHub repo, auto-deploy on push to main)
   - API (packages/api-server): Dockerize and deploy to AWS ECS Fargate (or Railway/Render for MVP)
   - AI Service (packages/ai-service): Dockerize and deploy alongside API
   - Scraper (packages/scraper-engine): Deploy as background worker on same infrastructure
   - Notification Service: Deploy as background worker
   - Database: AWS RDS PostgreSQL (or Supabase for MVP)
   - Redis: AWS ElastiCache (or Upstash for MVP)
   - Elasticsearch: Elastic Cloud (or Bonsai.io for MVP)
   - S3: AWS S3 for document storage
   - Domain: Set up domain, SSL, DNS

2. CI/CD:
   - GitHub Actions workflow:
     * On PR: lint, type-check, test
     * On merge to main: build + deploy
   - Separate workflows for: web, api, scraper, admin
   - Environment variables in GitHub Secrets

3. MONITORING & LOGGING:
   - Application monitoring: Sentry for error tracking (web + API + mobile)
   - Uptime monitoring: BetterUptime or UptimeRobot
   - Log aggregation: Grafana Cloud Loki (or Papertrail for MVP)
   - Metrics: Custom dashboard tracking: API response times, scraper health, user signups, revenue

4. SECURITY:
   - Rate limiting on all API endpoints (express-rate-limit)
   - CORS configured for web domain only
   - Helmet.js security headers
   - Input sanitization (DOMPurify for any HTML, zod for all inputs)
   - SQL injection prevention (Prisma handles this)
   - XSS prevention (React handles this)
   - CSRF protection (SameSite cookies)
   - API key hashing (don't store raw keys)
   - Regular dependency audit (npm audit, Snyk)

5. PERFORMANCE:
   - Next.js ISR for tender listing pages (revalidate every 5 min)
   - Redis caching for: plan details, user subscription, trending tenders, search suggestions
   - CDN for static assets (Vercel/Cloudflare)
   - Image optimization (next/image)
   - Database query optimization: check Prisma query logs, add indexes where needed
   - Elasticsearch query performance: monitor slow queries

6. PRE-LAUNCH CHECKLIST:
   - [ ] All scrapers running and collecting data
   - [ ] At least 10,000 tenders in database
   - [ ] User registration and login working
   - [ ] Subscription and payment flow tested with Razorpay test mode
   - [ ] Email notifications sending
   - [ ] Push notifications working on Android/iOS
   - [ ] WhatsApp templates approved by Meta
   - [ ] Mobile app submitted to Play Store and App Store
   - [ ] SEO meta tags on all pages
   - [ ] Google Analytics / Plausible analytics installed
   - [ ] Terms of Service and Privacy Policy pages
   - [ ] Cookie consent banner (GDPR-style, good practice)
   - [ ] Error pages: 404, 500
   - [ ] Favicon, OG images, app icons
   - [ ] Load testing: API handles 100 concurrent users
   - [ ] Backup strategy: daily DB backups to S3

Switch Razorpay from test mode to live mode. Launch! 🚀
"""


# ═══════════════════════════════════════════════════════════════════════
# DONE! 12 PHASES. COMPLETE PLATFORM.
#
# TIPS FOR USING THESE PROMPTS:
# 1. Always have CLAUDE.md in your project root — Claude Code reads it automatically
# 2. Go one phase at a time. Don't rush.
# 3. After each phase: test, fix bugs, commit to git
# 4. If Claude Code's response is too long and gets cut off, say "continue"
# 5. If something doesn't work, paste the error and ask Claude Code to fix it
# 6. Commit after every working feature, not after entire phases
# 7. Start with Phase 1-3 for a working MVP you can show people
# 8. Phases 4-7 make it a real product
# 9. Phases 8-12 make it competitive
# ═══════════════════════════════════════════════════════════════════════
