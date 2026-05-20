# FXT — Group & Trip Expense Tracker

AI-powered receipt + payment-screenshot expense tracking for families and groups, with a Notion-backed database and an in-app dashboard.

## Stack
- **Next.js 16** (App Router) + TypeScript + Tailwind v4
- **Gemini 2.5 Flash** — image → JSON expense extraction
- **Notion** — records storage
- **Cloudinary** (optional) — image hosting
- **Recharts** — dashboard charts

## What's new — V2.6: Default Personal Group

**Added:**
- New users now automatically get a private "Personal" group on registration.
- Expenses fall back to the Personal group when no group is explicitly selected and the user is not inside a group or trip context.

**Changed:**
- New users can start adding expenses immediately without manually creating a group first.
- The expenses API now requires `familyId` on POST (previously allowed `tripId` alone). Any offline drafts saved before this update that contain only a `tripId` without a `groupId` will fail to sync.

**Notes:**
- Existing users are not backfilled in this task.
- Personal is implemented on top of the existing `parties` table (no schema changes) — it's a regular `type='private'` row identified by `party_name='Personal'` + `created_by=<userId>`.
- If `ensurePersonalGroup` fails on registration, the user can still proceed and create groups manually; the confirm-page fallback simply won't auto-select a Personal group.

## What's new — V2.5: Mobile Travel Experience

All twelve items from the V2.5 scope are shipped:

- ✅ §1 Mobile bottom navigation with center Scan FAB
- ✅ §2 Trip Home upgrade — gradient banner, day badge, stat cards, quick links, today/recent sections
- ✅ §3 Expenses grouped by date with mobile-friendly cards
- ✅ §4 Receipt line-item extraction (Gemini prompt + parser + storage)
- ✅ §5 Per-item category support (each line item can have its own category)
- ✅ §6 Step-by-step AI scan loading state (6 stages, with check/spinner/pending)
- ✅ §7 Payment method breakdown chart in reports
- ✅ §8 Top spending rankings — top 10 expenses, top merchants, highest days, top categories
- ✅ §9 Initials avatars with deterministic palette color
- ✅ §10 Mobile-friendly confirmation page with sticky save bar and missing-fields banner
- ✅ §11 Empty states across Groups, Trips, Group dashboard, Trip Home, History
- ✅ §12 README + project-summary docs (this section)

Terminology refresh: in the UI, **Party/Family → Group** and **Records → Expenses**. Routes (`/parties`, `/family`), types (`Party`, `partyId`), and Notion columns (`Family ID`) keep their old names for backwards compatibility — UI labels only.

## Setup

### 1. Create the Notion database

Create a Notion database named **Expenses** with these exact properties:

| Property name | Type | Notes |
|---|---|---|
| Name | Title | Used for merchant |
| Record ID | Rich text | App-generated UUID |
| Family ID | Rich text | |
| User ID | Rich text | who uploaded |
| User Name | Rich text | |
| Payer ID | Rich text | |
| Payer Name | Rich text | |
| Amount | Number | |
| Currency | Select | USD, EUR, GBP, JPY, HKD, CNY, TWD, KRW, SGD, AUD, CAD |
| Base Amount | Number | |
| Base Currency | Select | same as Currency |
| Category | Select | Food, Shopping, Transport, Accommodation, Entertainment, Electronics, Groceries, Tickets, Health, Other |
| Country | Rich text | |
| Date | Date | |
| Payment Method | Select | Cash, Card, Apple Pay, Google Pay, Alipay, WeChat Pay, Bank Transfer, Other |
| Source Type | Select | receipt, screenshot, manual |
| Image URL | URL | |
| AI Confidence | Number | |
| Notes | Rich text | |
| Created At | Created time | auto |

Then click `•••` → **Connections** → add your integration so the API can write to it. Copy the database ID from the URL (the 32-char hex segment).

### 2. API keys
- Notion integration token: <https://www.notion.so/my-integrations>
- Gemini API key: <https://aistudio.google.com/apikey>
- Cloudinary (optional): cloudinary.com → Dashboard → cloud name + API key + secret

### 3. Environment

```bash
cp .env.example .env.local
# fill in NOTION_TOKEN, NOTION_DATABASE_ID, GEMINI_API_KEY (and Cloudinary if used)
```

### 4. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. First visit redirects to `/login`; new users register at `/register`.

### 5. (V2 only) Add trip + future-feature columns

After step 4, run the V2 migration once to add new columns to your existing Expenses DB and create a Trips DB and a Category Rules DB:

```bash
node scripts/migrate-notion-v2.mjs
```

This adds (idempotently):
- **Expenses DB** — new columns: `Trip ID`, `Exchange Rate`, `Exchange Rate Date`, `Split Type`, `Split Participants`. Existing rows stay valid.
- **Trips DB** — new database with `Name`, `Trip ID`, `Family ID`, `Destination`, `Start Date`, `End Date`, `Base Currency`, `Budget`, `Created By`, `Created By Name`, `Notes`, `Created At`. ID is written into `.env.local` as `NOTION_TRIPS_DATABASE_ID`.
- **Category Rules DB** — `Name`, `Rule ID`, `Family ID`, `Merchant`, `Category`, `Created At`. ID is written into `.env.local` as `NOTION_RULES_DATABASE_ID`.

Restart `npm run dev` after migration so the new env vars are picked up.

### 6. (V3 only) Supabase auth + parties

V3 adds usernames, PINs, and a Party concept (replacing the local-storage Family ID).

1. Create a Supabase project at https://supabase.com.
2. In Settings → API, copy these into your `.env.local`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` (server-only — never expose to the browser)
3. Open SQL Editor → New query, paste the contents of `supabase/schema.sql`, and run it.
4. Restart `npm run dev`.
5. The app now starts at `/login`; create an account at `/register` and you'll get an invite code (used to be added to private parties).

**Existing Notion data**: expenses created before V3 are keyed by the old localStorage `familyId` and are orphaned in the new model. To keep them, create a new party in the app and rewrite the `Family ID` column of those records in Notion to the new party UUID.

**Trips after V3**: trips no longer belong to a family; the existing Notion `Family ID` column on the Trips DB is repurposed to store the trip creator's `userId`. Existing trips will appear orphaned to the user that didn't create them — re-set the `Family ID` column to the creator's userId to fix.

**Security profile (MVP)**: there is no signed session token. The client sends `userId` on every request; anyone with a valid `userId` (any user's UUID) can impersonate them by editing localStorage or the request body. PINs are 4 digits, hashed with bcrypt cost 10, but the login route is **not** rate-limited. Acceptable for personal MVP use; not for public deployment.

### 7. (V2.5 only) Add line items column

Re-run the V2 migration once after upgrading to V2.5:

```bash
node scripts/migrate-notion-v2.mjs
```

This adds the new `Items JSON` rich-text column on the Expenses DB (idempotent — safe to re-run). Line items extracted from receipts are stored here as JSON. If you skip this step, scans still work but per-item data won't persist.

## How it works

```
Browser ── upload ──► /api/analyze ──► Gemini 2.5 Flash (JSON extraction)
                          │
                          └──► Cloudinary (optional, image URL)
Browser ── confirm ──► /api/expenses (POST) ──► Notion DB
Browser ◄── list ──── /api/expenses?familyId=… ◄── Notion DB
```

- **Auth** is username + 4-digit PIN backed by Supabase. The session (userId, baseCurrency, invite code) lives in `localStorage` so the app feels stateless on the client.
- **Groups** (Notion column still called `Family ID` for backwards compatibility) replace the V1 family concept. Private groups admit members by invite code; public groups generate a join code anyone can use.
- **Scan** lets you upload a receipt or any payment screenshot (Apple Pay, Google Pay, banking apps, Alipay, WeChat Pay, online checkouts, anything). Image goes to `/api/analyze` which calls Gemini and (if configured) Cloudinary in parallel.
- **Confirm** shows the AI extraction; if confidence < 0.7 you'll see a warning. All fields are editable. Manual add (`/scan/confirm?manual=1`) skips the AI and uses an empty form.
- **Save** posts to `/api/expenses`, creating one page in your Notion DB.
- **Group dashboards / History / Trip Home** read from `/api/expenses?familyId=…` (or `?tripId=…`) and render with Recharts.
- **History** is grouped by date with mobile-friendly expense cards; **Trip Home** shows a banner with destination + day count, stat cards (today / total / budget / day), and recent expenses.
- **Reports** include payment-method breakdown and rankings (top expenses, top merchants, highest spending days, top categories).

## File structure

```
src/
  app/
    page.tsx                  # Dashboard
    layout.tsx
    globals.css
    onboarding/page.tsx
    scan/page.tsx
    scan/confirm/page.tsx     # AI confirm OR manual (?manual=1)
    history/page.tsx
    family/page.tsx
    settings/page.tsx
    trips/page.tsx            # Trip list
    trips/new/page.tsx        # Trip create form
    trips/[tripId]/page.tsx   # Per-trip dashboard
    api/
      analyze/route.ts        # POST: image → Gemini analysis (+ Cloudinary)
      expenses/route.ts       # GET: list by familyId (+ optional tripId), POST: create
      trips/route.ts          # GET: list trips for familyId, POST: create
      trips/[tripId]/route.ts # GET: single trip
  components/
    Nav.tsx                   # Top bar + mobile bottom-nav with center Scan FAB
    UploadBox.tsx
    DashboardCards.tsx
    CategoryPieChart.tsx
    PaymentMethodChart.tsx    # V2.5
    SpendingLineChart.tsx
    UserBarChart.tsx
    RecordsTable.tsx
    ExpenseCard.tsx           # V2.5 — mobile-friendly expense card
    RankingLists.tsx          # V2.5 — top expenses / merchants / days / categories
    Avatar.tsx                # V2.5 — initials avatar
    EmptyState.tsx            # V2.5 — shared empty-state
  lib/
    types.ts                  # All shared types + enum constants
    categories.ts             # Category list, colors, confidence threshold
    localUser.ts              # localStorage user/family helpers
    gemini.ts                 # Gemini 2.5 Flash analyzeImage()
    notion.ts                 # createExpense / listExpenses (with tripId filter)
    notionTrips.ts            # createTrip / listTrips / getTrip
    rateLimit.ts              # In-memory IP rate limiter for /api/analyze
    cloudinary.ts             # uploadImageDataUri()
    chartUtils.ts             # totalByCategory / totalByDate / totalByUser
```

## Deploy (Vercel)
- Push to GitHub, import the repo into Vercel.
- Set the same env vars in Vercel → Settings → Environment Variables.

## Out of scope (for now)
- OAuth / social login (username + PIN only)
- Server-issued session tokens (client sends `userId` per request)
- Per-group editable category list
- Push notifications
- PDF export, native mobile app
- Trip cover image upload (banner is a gradient placeholder)
- In-app calendar view
