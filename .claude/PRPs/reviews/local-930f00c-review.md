# Code Review: acba9eb + 930f00c (vs 70ba411)

**Reviewed**: 2026-06-10
**Scope**: Trip multi-member fix (acba9eb) + multilingual OCR & delete expense (930f00c)
**Decision**: APPROVE with comments

## Summary
Both change sets implement their specs correctly, are scoped surgically, and pass all
validation. The one HIGH finding is the codebase's systemic client-trusted-identity
model now extended to a destructive endpoint — inherited, not introduced, and only
fixable by the planned auth overhaul.

## Findings

### CRITICAL
None.

### HIGH
1. **Spoofable identity on destructive DELETE** — `src/app/api/expenses/route.ts` DELETE
   trusts the client-supplied `userId` for its 403 ownership check. Since `GET
   /api/expenses?familyId=` is unauthenticated and returns each record's `userId`, anyone
   can delete anyone's expense by replaying the owner's id. Same applies to the
   `canAccessTrip` check (`userId` is a query param). **Not introduced by this diff** —
   every route in the app uses this model (trips/parties DELETE predate this) — but
   delete is the first destructive expense operation, raising the stakes. Real fix is
   server-issued sessions (tracked as P0 #6 in the product review); no in-scope
   mitigation exists because the server has no trustworthy identity signal.

### MEDIUM
1. **Stale aggregates after delete without callback** — `ExpenseCard.tsx` hides itself
   (`removed` state) when no `onDelete` is passed (Home, History). Day-group totals and
   counts in History and the month total on Home stay stale until refetch. Suggest wiring
   `onDelete` in those two pages later or refetching on delete.
2. **Empty group picker dead-end** — `trips/new/page.tsx`: if the parties fetch fails (or
   a legacy user has zero groups), the picker is empty and submit always errors with
   "pick a group" with no recovery hint. Suggest an inline empty/error state linking to
   `/parties/new`.

### LOW
1. `notionTrips.ts` `filter: filter as any` — `any` cast (file already operates under an
   explicit-any eslint-disable; Notion SDK union types make this pattern-consistent).
2. Notion compound `or` filter supports max 100 conditions; a user in >99 groups would
   error. `page_size: 100` with no pagination cursor also truncates >100 trips
   (pre-existing behavior).
3. `parties/[partyId]/page.tsx` `handleDeleteExpense` has no in-flight guard; a fast
   double-click can fire two DELETEs (second harmlessly 404s but shows the error alert).
4. ExpenseCard discards the server's error message on delete failure in favor of a
   generic toast — fine, but logging it would aid debugging.

## Verified behaviors
- Legacy trips (familyId = creator userId): still listed via `[...groupIds, userId]`
  filter; access granted via `createdBy` check; no crashes; invisible to others (Option A
  as specified).
- Spread-across-days expenses: virtual `id::date` rows delete via stripped base id; trip
  page state filter removes the raw record so all day rows vanish.
- DELETE authorization order: 400 (bad input) → 404 (not found) → 403 (not owner) → 200.
- i18n: all 8 new keys present in zh-HK, en, zh-CN dictionaries.
- Gemini change is prompt-only in `SYSTEM_PROMPT`; `analyzeText` and parsing untouched.
- Rules of hooks: ExpenseCard's early `return null` sits after all hook calls.

## Validation Results

| Check | Result |
|---|---|
| Type check (`tsc --noEmit`) | Pass |
| Lint (`eslint src`) | Pass |
| Tests | Skipped — no test suite exists in this project |
| Build (`next build`) | Pass (34/34 pages) |

## Files Reviewed (13, all Modified)
- src/app/api/expenses/route.ts
- src/app/api/trips/route.ts
- src/app/api/trips/[tripId]/route.ts
- src/app/parties/[partyId]/page.tsx
- src/app/scan/confirm/page.tsx
- src/app/trips/[tripId]/page.tsx
- src/app/trips/new/page.tsx
- src/components/ExpenseCard.tsx
- src/components/RecordsTable.tsx
- src/lib/gemini.ts
- src/lib/i18n.ts
- src/lib/notion.ts
- src/lib/notionTrips.ts
