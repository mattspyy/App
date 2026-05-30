# Local Review — session changes (since 9404ebd)

**Reviewed**: 2026-05-30
**Scope**: commits fa32c6d, e625bbd, 2b3b19c (P0 fixes, PWA, per-category budgets, custom categories)
**Decision**: REQUEST CHANGES (1 HIGH cross-feature bug; validation green)

## Findings

### CRITICAL
None introduced. (Note: all new endpoints trust client-supplied `userId` with no session token / rate limiting — pre-existing, documented MVP posture, tracked separately.)

### HIGH
1. Custom categories break the "save category rule" action.
   - `src/app/scan/confirm/page.tsx:389` `handleSaveRule` POSTs `form.category` to `/api/category-rules`.
   - `src/app/api/category-rules/route.ts:68` rejects any non-built-in category: `!EXPENSE_CATEGORIES.includes(category)` → 400.
   - Result: selecting a custom category and saving a merchant→category rule surfaces "category must be one of the supported values". Reachable user action, enabled by this feature set.
   - Fix: extend category-rules validation to accept the user's own custom categories (mirror the budgets-route fix), or disable the save-rule control when the selected category is custom.

### MEDIUM
- `src/app/api/custom-categories/route.ts` 20-cap is count-then-insert (race). `unique(user_id,name)` still blocks dup names.
- `src/components/CategoryBudgetsCard.tsx` handleSave loops one POST per changed category; each budgets POST runs membership + custom-category + find + upsert → many sequential round-trips.
- `src/components/CategoryPieChart.tsx` self-fetches custom categories per instance (duplicate of page-level fetches).
- `public/sw.js` cache-first navigations can serve a stale shell after deploy until `CACHE_VERSION` is bumped (manual). Known PWA tradeoff.
- a11y: `src/components/CustomCategoriesSection.tsx` name input is placeholder-only (no label/aria-label).

### LOW
- `src/lib/notion.ts` pagination loop has no max-page safety cap (correct, but unbounded).
- Share target: SW caches the shared image but `/scan` never consumes it (documented limitation).
- Placeholder app icons are solid-black "F" PNGs.
- `categoryLabel` fallback now renders any unknown category string verbatim (improvement; also surfaces typos/legacy values).

## Validation
| Check | Result |
|---|---|
| Type check (tsc --noEmit) | Pass |
| Lint (eslint src) | Pass |
| Tests | Skipped (no test script) |
| Build (next build) | Pass |
