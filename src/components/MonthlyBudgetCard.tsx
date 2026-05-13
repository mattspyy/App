"use client";
import { useState } from "react";
import { CURRENCIES, type Budget } from "@/lib/types";
import { monthlyBudgetUsage } from "@/lib/budget";
import type { ExpenseRecord } from "@/lib/types";

type Props = {
  groupId: string;
  budget: Budget | undefined;
  records: ExpenseRecord[];
  baseCurrency: string;
  canEdit: boolean;
  userId: string;
  onChange: () => void;
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MonthlyBudgetCard({
  groupId,
  budget,
  records,
  baseCurrency,
  canEdit,
  userId,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(budget ? String(budget.amount) : "");
  const [currency, setCurrency] = useState(budget?.currency || baseCurrency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      setError("Amount must be a non-negative number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          groupId,
          amount: n,
          currency,
          periodType: "monthly",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setEditing(false);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const usage = budget ? monthlyBudgetUsage(budget, records) : null;
  const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });

  if (!budget && !editing) {
    if (!canEdit) return null;
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3 text-sm flex items-center justify-between">
        <span className="text-zinc-600">No monthly budget set.</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white"
        >
          Set budget
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3 space-y-2 text-sm">
        <div className="text-xs text-zinc-600">Monthly budget</div>
        {error && <div className="text-xs text-red-700">{error}</div>}
        <div className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="text-[11px] text-zinc-500">Amount</span>
            <input
              className="input"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            <span className="text-[11px] text-zinc-500">Currency</span>
            <select
              className="input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded border border-zinc-900 bg-zinc-900 text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null); }}
            className="text-xs px-3 py-1.5 rounded border border-zinc-300 bg-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!usage || !budget) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3 space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <div className="text-zinc-600">Monthly budget · {month}</div>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setAmount(String(budget.amount)); setCurrency(budget.currency); setEditing(true); }}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline"
          >
            Edit
          </button>
        )}
      </div>
      <div className="text-base font-semibold">
        {formatAmount(usage.used)} / {formatAmount(usage.amount)} {usage.currency}
      </div>
      <div className="h-1.5 bg-zinc-100 rounded overflow-hidden">
        <div
          className={`h-full ${usage.pct >= 100 ? "bg-red-500" : usage.pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${usage.pct}%` }}
        />
      </div>
      <div className="text-xs text-zinc-500">
        {usage.remaining >= 0
          ? `${formatAmount(usage.remaining)} ${usage.currency} remaining`
          : `${formatAmount(-usage.remaining)} ${usage.currency} over budget`}
      </div>
    </div>
  );
}
