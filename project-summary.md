# FXT — Project Summary

A group / trip expense tracker that turns receipt photos and payment screenshots into structured spending records. Built incrementally from V1 (single-family MVP) to V2.5 (mobile-first multi-group app).

## Stack at a glance
- **Next.js 16** App Router · TypeScript · Tailwind v4 · React 19
- **Gemini 2.5 Flash** — vision → JSON extraction (now with line items)
- **Notion** — primary database for expenses, trips, and category rules
- **Supabase** — auth (username + 4-digit PIN), users, groups, group members
- **Frankfurter** — historical FX rates
- **Recharts** — pies, bars, line charts
- **Cloudinary** — optional image hosting

## Release timeline

| Release | Focus |
|---|---|
| **V1** | Single-family MVP — onboarding via localStorage, scan → confirm → Notion |
| **V2.1** | Trips — trip CRUD, per-trip dashboards, trip-scoped expense filter |
| **V2.2** | Currency conversion — Frankfurter historical rates, base-currency totals |
| **V2.3** | Splits & settlement — per-expense participants, greedy debt minimization, CSV export, per-trip reports |
| **V3** | Supabase auth — usernames, PIN login, private / public **groups** (in code: parties), invite codes, admin page |
| **V2.5** | Mobile travel experience upgrade — see below |

## V2.5 — Mobile Travel Experience Upgrade

The phase that turned the V3 desktop-leaning UI into a mobile-first product.

### Phase A — Foundation (terminology + nav + primitives)

- **Terminology relabel (UI only)** — Party/Family → Group, Records → Expenses across:
  - [src/app/layout.tsx](src/app/layout.tsx) metadata
  - [src/app/parties/page.tsx](src/app/parties/page.tsx), [src/app/parties/new/page.tsx](src/app/parties/new/page.tsx), [src/app/parties/[partyId]/page.tsx](src/app/parties/[partyId]/page.tsx)
  - [src/app/history/page.tsx](src/app/history/page.tsx), [src/app/settings/page.tsx](src/app/settings/page.tsx), [src/app/scan/confirm/page.tsx](src/app/scan/confirm/page.tsx)
  - [src/components/RecordsTable.tsx](src/components/RecordsTable.tsx), [src/components/DashboardCards.tsx](src/components/DashboardCards.tsx)
  - Routes (`/parties`, `/family`), types (`Party`, `partyId`), and DB column names kept as-is for backwards compatibility.

- **[src/components/Nav.tsx](src/components/Nav.tsx)** — desktop top bar (`md:flex` only) + mobile bottom navigation:
  - Four tabs (Groups, Trips, Expenses, Settings) plus a raised **Scan FAB** in the center.
  - `pb-[env(safe-area-inset-bottom)]` for iOS notch.
  - Active state pill on desktop, font-medium underline on mobile.

- **[src/components/Avatar.tsx](src/components/Avatar.tsx)** — initials avatar with deterministic palette color. Wired into [RecordsTable.tsx](src/components/RecordsTable.tsx) payer cell and the [Group members list](src/app/parties/[partyId]/page.tsx).

- **[src/components/EmptyState.tsx](src/components/EmptyState.tsx)** — shared icon + title + description + CTA. Used on Groups, Trips, Group dashboard, Trip Home, History.

### Phase B — Page upgrades

- **[src/components/ExpenseCard.tsx](src/components/ExpenseCard.tsx)** (new shared component) — category + payment-method tags, merchant title, notes, payer with avatar, original amount, converted base amount.

- **[src/app/history/page.tsx](src/app/history/page.tsx)** — flat table replaced with sections **grouped by date**:
  - Each day header shows weekday + date, expense count, and the day total (multi-currency aware).
  - Two empty states: no expenses yet (with CTA) and no expenses match (filter mismatch).
  - Filters above the list unchanged.

- **[src/app/trips/[tripId]/page.tsx](src/app/trips/[tripId]/page.tsx)** — Trip Home upgrade:
  - **Gradient banner** with destination, trip name, date range, day badge (`Day 5/10`, `In 3d until trip`, `2d ago trip ended`).
  - **Stat cards** (2×2 mobile, 4-up desktop): Today, Trip total, Budget (with progress bar + remaining), Day status.
  - **Action row**: prominent Add expense + Settlement + Report quick links.
  - **Today section** + **Recent section** (top 5 non-today, with "See all").
  - Breakdown charts moved below the fold so the action area is the focus.

### Phase C — Scan flow

- **[src/app/scan/page.tsx](src/app/scan/page.tsx)** — six-step loading state:
  - `Uploading image → Reading receipt → Extracting merchant and date → Extracting amount and currency → Detecting categories → Preparing confirmation`
  - Green ✓ for completed, spinning ring for active, dim ○ for pending. Auto-advances every ~900 ms; jumps to "done" the instant the Gemini fetch resolves. Staged image stays visible above.

- **Line items end-to-end:**
  - [src/lib/types.ts](src/lib/types.ts) — `ExpenseItem { id, name, quantity?, unitPrice?, totalPrice, category?, notes? }`; `items?` on `ExpenseRecord` and `AIAnalysisResult`.
  - [src/lib/gemini.ts](src/lib/gemini.ts) — prompt asks for itemized array with per-item category hints (Coffee → Food, Charger → Electronics, etc.); parser validates and drops malformed rows.
  - [src/lib/notion.ts](src/lib/notion.ts) — items serialized to/from a new `Items JSON` rich-text column.
  - [scripts/migrate-notion-v2.mjs](scripts/migrate-notion-v2.mjs) — idempotent column-add for `Items JSON`.
  - [src/app/api/expenses/route.ts](src/app/api/expenses/route.ts) — `items` passed through POST.

- **[src/app/scan/confirm/page.tsx](src/app/scan/confirm/page.tsx)** — mobile-friendly confirmation:
  - Items seeded from AI extraction into an editable list: name, qty, unit, total, per-item category (or "same as receipt").
  - "Receipt items (N)" section with add/remove, items sum shown, mismatch warning if items don't add up to the expense amount (±0.5).
  - Empty-state copy when no items detected.
  - Missing-fields banner: "AI couldn't fill: merchant, date" highlighted in amber.
  - **Sticky save bar on mobile** (`bottom-[calc(4rem+env(safe-area-inset-bottom))]`) sits above the bottom nav; inline row on desktop.
  - Save label changed from "Save to Notion" to "Save expense".

### Phase D — Stats

- **[src/lib/chartUtils.ts](src/lib/chartUtils.ts)** — new helpers: `totalByPaymentMethod` (with count), `topMerchants(limit)`, `topExpenses(limit)`, `topSpendingDays(limit)`.

- **[src/components/PaymentMethodChart.tsx](src/components/PaymentMethodChart.tsx)** — pie chart + legend with colored swatch, method name, percentage, total in base currency, and expense count per method. Empty state when no data.

- **[src/components/RankingLists.tsx](src/components/RankingLists.tsx)** — four ranked cards in a 2-col grid:
  - **Top expenses** (10, with merchant + date + category)
  - **Top merchants** (5, with count and total)
  - **Highest spending days** (5)
  - **Top categories** (5)

- **[src/app/trips/[tripId]/report/page.tsx](src/app/trips/[tripId]/report/page.tsx)** — wired both new components into the existing report layout between the line chart and the records table.

## V2.5 deliverables vs. spec (§1–§12)

| §  | Item                                       | Status |
|----|--------------------------------------------|--------|
| 1  | Mobile bottom navigation with Scan FAB     | ✅ |
| 2  | Trip Home upgrade                          | ✅ |
| 3  | Expenses grouped by date                   | ✅ |
| 4  | Receipt item review                        | ✅ |
| 5  | Item-level category support                | ✅ |
| 6  | Better AI scan loading state               | ✅ |
| 7  | Payment method analytics                   | ✅ |
| 8  | Top spending rankings                      | ✅ |
| 9  | Simple user avatar                         | ✅ |
| 10 | Better mobile confirmation page            | ✅ |
| 11 | Empty states                               | ✅ |
| 12 | Implementation notes (docs)                | ✅ |

## What this phase intentionally did **not** do
- No backend rename — routes (`/parties`, `/family`), API params (`familyId`), TypeScript types (`Party`, `partyId`), and Notion column names are unchanged. UI labels only, per agreed plan.
- No full visual redesign — colors, typography, and component primitives kept consistent with the V3 baseline.
- No member/permissions system beyond what V3 already provides (admin can invite to private groups; public groups admit anyone with the code).
- No login security improvements (rate limiting, session tokens) — flagged in README as out-of-scope MVP trade-offs.
- No image upload for trip covers — banner is a gradient placeholder.
- No in-app calendar view (was sketched in §2 but deferred).

## Required follow-up for users on existing data

After pulling V2.5, run the migration once to add the `Items JSON` column:

```bash
node scripts/migrate-notion-v2.mjs
```

Idempotent — safe to re-run. Without it, line items still render in the UI during scan/confirm but won't persist.
