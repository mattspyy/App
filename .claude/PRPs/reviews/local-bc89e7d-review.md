# Code Review: bc89e7d — Complete localization for core UI

**Reviewed**: 2026-05-23
**Branch**: ui-redesign
**Scope**: HEAD vs HEAD~1 (34 files, +2665 / -588 lines)
**Decision**: APPROVE with comments

## Summary
Large but disciplined localization pass. 561-key parity across zh-HK / en / zh-CN, no security issues, no regressions in type-check / lint / build. Findings below are minor maintainability suggestions plus one borderline file-size issue.

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1 — src/lib/i18n.ts:1828 — File exceeds the project 800-line guideline (>2x over).**
`src/lib/i18n.ts` now bundles the i18n runtime, three full dictionaries (561 keys each), and four label helpers in a single 1,828-line file. Per `CLAUDE.md` / common coding-style: 800-line max. Three Chinese strings won't fit into a heredoc neatly so splitting requires care, but splitting per language into `src/lib/i18n/dictionaries/{zh-HK,en,zh-CN}.ts` and keeping `src/lib/i18n/index.ts` (~150 lines) for the runtime, types, and helpers would bring each file well under the limit and let future translators edit a single language file without scrolling past the other two.

**M2 — src/app/scan/confirm/page.tsx:1518 — Pre-existing 1518-line file, still over the 800-line guideline.**
Not introduced by this change, but the localization commit edited it heavily without splitting. Worth flagging since you are already touching the file. Candidate extractions: `ConfirmFormBody` form-state hooks (~500 lines), `ItemsSection`, and the helpers (`Field`, `SmallField`, `NativeSelect`, `CustomSharesSummary`) — each is naturally a standalone module.

**M3 — src/lib/i18n.ts:1810 — Import at bottom of file.**
`import type { ExpenseCategory, ... } from "@/lib/types"` sits below the `useLanguage` export. TypeScript hoists imports so the runtime is fine, but the convention is imports-at-top. Move the `import type` to the top of the file alongside the React import. Minor; a linter rule like `import/first` would catch this automatically.

**M4 — src/components/RecordsTable.tsx, ExpenseCard.tsx, MonthlyBudgetCard.tsx, RankingLists.tsx, DashboardCards.tsx and the four chart components — still use legacy Tailwind utility classes (`bg-white`, `border-zinc-200`, `text-zinc-500`) instead of FXT design tokens.**
The localization commit added `t()` calls but left these components on the old `bg-white / text-zinc-X` Tailwind palette while the rest of the app uses `var(--color-surface)` / `var(--color-ink)`. This is consistent with the pre-existing state (Phase 3 explicitly noted these stay intact), so not a regression — but worth noting that the labels are now translated while the chrome looks visibly different from the surrounding cards in dark or warm light. Cosmetic only; track for a future cleanup.

**M5 — src/app/parties/[partyId]/page.tsx:233, settlement page line 245, report page line 374 — un-translated `MEMBER` / `EXPENSE` / `EXPENSES` / `ROW` / `ROWS` literal strings in `meta` props.**
Several `SectionHeader meta` values still contain hardcoded English meta labels (e.g. ``${balances.length} ${balances.length === 1 ? "MEMBER" : "MEMBERS"}``, ``${records.length === 1 ? "ROW" : "ROWS"}``, ``${todayRecords.length === 1 ? "EXPENSE" : "EXPENSES"}``). These slipped through because the prior pattern templated a literal `S` suffix; the migration only swapped the outer wrapper. Add `meta.member / meta.members / meta.row / meta.rows / meta.expense / meta.expenses` keys (small set) or reuse `history.daySingular/daySingular` — keep the values UPPERCASE for the eyebrow-style meta typography.

### LOW

**L1 — Pluralization is done by passing `s` as a `{s}` template variable** (e.g. `t("tripDetail.expensesFmt", { n, s: n === 1 ? "" : "s" })` and `t("settlement.skippedFmt", { n, s: n === 1 ? "" : "s" })`).
This works only for English; the zh-HK / zh-CN translations either ignore the `{s}` placeholder or leave it as a literal. Confirmed harmless today because:
- zh-HK strings like `"已加入 {name}。"` drop `{s}` entirely.
- English strings render correctly with the manual `s` toggle.
But the contract is fragile: a future translator who adds `{s}` to a Chinese string will get spurious `s` characters. Either standardise on `Intl.PluralRules`-based keys (`expensesFmt.one` / `expensesFmt.other`) or drop the `{s}` placeholder and split into singular/plural keys per language. Minor — recommend tracking for a future polish pass.

**L2 — src/lib/i18n.ts:31 (`setLanguage`) writes to localStorage and mutates `document.documentElement.lang` outside React.**
The `LanguageSync` component also sets `document.documentElement.lang` from a `useEffect`. The duplicate write is harmless (idempotent), but it's worth picking one source of truth — either rely on the `useEffect` (so SSR doesn't crash because `document` was missing) or keep only the `setLanguage` write and remove `LanguageSync`. Today the `useEffect` is the safer one (it also runs on first mount, syncing the `<html lang>` to a user who comes back with `en` set in localStorage).

**L3 — src/components/ExpenseCard.tsx:43 — passing the localized `record.payerName` through `t("expenseCard.paidByFmt", { name: payer })` works, but the template uses the dictionary form `"由 {name} 付款"`.** Renders fine; just noting that names containing `{` or `}` would currently be interpolated literally. Realistic risk is zero for usernames, but the same `format` helper is used app-wide; consider passing user-supplied vars through a small escape in `format()` if you ever interpolate untrusted content.

**L4 — README.md:Changelog grows for every commit.** It is the right place to record these changes per project rules, but the changelog has 5 dated entries in two days and the file is approaching long-doc territory. Consider rolling the four redesign entries (Phase 1, 2, 3, redesign-fix) into a single squashed entry once the work is reviewed/merged.

**L5 — src/lib/i18n.ts:25-27 — `getLanguage()` swallows the localStorage exception silently and returns the default.**
Per common-style guidance ("never silently swallow errors"). The catch is intentional (private-browsing mode throws on localStorage access), so a one-line comment explaining why would document the intent and keep the silent-failure-hunter happy.

## Validation Results

| Check | Result |
|---|---|
| Type check (`npx tsc --noEmit`) | Pass |
| Lint (`npm run lint`) | Pass |
| Tests | Skipped — no test runner configured in package.json |
| Build (`npm run build`) | Pass — all 33 routes generated, no warnings |

## Files Reviewed
- **Added**: src/components/LanguageSync.tsx, src/lib/i18n.ts (new dictionaries section); +250 keys added vs prior commit
- **Modified**: 32 files — all UI page/component migrations to `useLanguage` / `t()` / label-helpers
- **Docs**: README.md (one changelog entry appended)

## Cross-cutting checks performed
- All three dictionaries have identical 561-key sets (no missing translations).
- All `category.*`, `paymentMethod.*`, `splitType.*`, `sourceType.*` keys cover every enum value in `src/lib/types.ts`.
- No new `console.log`. The 7 pre-existing `console.error`/`console.warn` calls are in API-error branches and were not introduced by this commit.
- No new `dangerouslySetInnerHTML`, `innerHTML`, or `eval(`.
- No new `process.env.*`, `API_KEY`, `SECRET`, or `TOKEN` references in changed files.
- No `pattern=` HTML validation regression (PIN inputs validate in React only).
- No new TODO/FIXME/HACK comments.
- Stored enum values (`Food`, `Cash`, `no_split`, `receipt`, …) preserved — label helpers translate display only.

## Recommended action

Approve and merge. The five MEDIUM findings are quality-of-life improvements rather than blockers; only **M5** (un-translated `MEMBER` / `EXPENSE` / `ROW` literals in `SectionHeader meta` props) reaches the threshold where users will visibly see English in zh-HK / zh-CN mode — worth addressing in a small follow-up commit before this branch is merged to main. M1 (file size) is the right architectural cleanup but does not need to gate this commit.
