"use client";
import { useState } from "react";
import { EXPENSE_CATEGORIES, type Budget, type ExpenseCategory, type ExpenseRecord } from "@/lib/types";
import { getCategoryBudgetStatus } from "@/lib/budget";
import { useLanguage, categoryLabel } from "@/lib/i18n";

type Props = {
  groupId: string;
  budgets: Budget[];
  records: ExpenseRecord[];
  baseCurrency: string;
  canEdit: boolean;
  userId: string;
  onChange: () => void;
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function barColor(pct: number): string {
  return pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
}

export default function CategoryBudgetsCard({
  groupId,
  budgets,
  records,
  baseCurrency,
  canEdit,
  userId,
  onChange,
}: Props) {
  const { t, language } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Existing per-category budgets, keyed by category.
  const byCategory = new Map<string, Budget>();
  for (const b of budgets) {
    if (b.category && b.periodType === "monthly" && !b.tripId) byCategory.set(b.category, b);
  }

  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of EXPENSE_CATEGORIES) init[c] = byCategory.get(c) ? String(byCategory.get(c)!.amount) : "";
    return init;
  });

  function startEditing() {
    const init: Record<string, string> = {};
    for (const c of EXPENSE_CATEGORIES) init[c] = byCategory.get(c) ? String(byCategory.get(c)!.amount) : "";
    setDrafts(init);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      for (const c of EXPENSE_CATEGORIES) {
        const raw = (drafts[c] ?? "").trim();
        const existing = byCategory.get(c);
        if (raw === "") {
          // Cleared: remove an existing budget, otherwise nothing to do.
          if (existing) {
            const res = await fetch(
              `/api/budgets?id=${encodeURIComponent(existing.id)}&userId=${encodeURIComponent(userId)}`,
              { method: "DELETE" },
            );
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "Failed to remove");
            }
          }
          continue;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(t("errors.amountMustBePositive"));
        }
        if (existing && existing.amount === n) continue; // unchanged
        const res = await fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            groupId,
            amount: n,
            currency: baseCurrency,
            periodType: "monthly",
            category: c,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save");
      }
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setSaving(false);
    }
  }

  const budgeted = EXPENSE_CATEGORIES
    .map((c) => getCategoryBudgetStatus(records, budgets, c as ExpenseCategory))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Read-only viewers with no category budgets see nothing.
  if (!editing && budgeted.length === 0 && !canEdit) return null;

  if (editing) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2 text-sm mt-3">
        <div className="text-xs text-zinc-600">{t("budget.categoryTitle")}</div>
        {error && <div className="text-xs text-red-700">{error}</div>}
        <div className="space-y-1.5">
          {EXPENSE_CATEGORIES.map((c) => (
            <label key={c} className="flex items-center gap-2">
              <span className="flex-1 text-zinc-700">{categoryLabel(c, language)}</span>
              <input
                className="input"
                style={{ maxWidth: 120 }}
                inputMode="decimal"
                placeholder="—"
                value={drafts[c] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [c]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="text-[11px] text-zinc-500">{baseCurrency}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded border border-zinc-900 bg-zinc-900 text-white disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="text-xs px-3 py-1.5 rounded border border-zinc-300 bg-white"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (budgeted.length === 0) {
    // canEdit only (read-only with none returned null above).
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3 text-sm flex items-center justify-between mt-3">
        <span className="text-zinc-600">{t("budget.categoryNone")}</span>
        <button
          type="button"
          onClick={startEditing}
          className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white"
        >
          {t("budget.setCategoryBudgets")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2 mt-3">
      <div className="flex items-baseline justify-between text-sm">
        <div className="text-zinc-600">{t("budget.categoryTitle")}</div>
        {canEdit && (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline"
          >
            {t("budget.edit")}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {budgeted.map((s) => (
          <div key={s.category} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-700">{categoryLabel(s.category, language)}</span>
              <span className="text-zinc-600">
                {formatAmount(s.spent)} / {formatAmount(s.limit)} {s.currency}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded overflow-hidden">
              <div className={`h-full ${barColor(s.percentage)}`} style={{ width: `${s.percentage}%` }} />
            </div>
            <div className="text-xs text-zinc-500">
              {s.remaining >= 0
                ? t("budget.remainingFmt", { amount: formatAmount(s.remaining), cur: s.currency })
                : t("budget.overFmt", { amount: formatAmount(-s.remaining), cur: s.currency })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
