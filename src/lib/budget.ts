import type { Budget, ExpenseCategory, ExpenseRecord } from "./types";
import { isConfirmed } from "./chartUtils";

function recordBaseFor(r: ExpenseRecord, currency: string): number | null {
  if (r.baseCurrency === currency && typeof r.baseAmount === "number") return r.baseAmount;
  if (r.currency === currency) return r.amount;
  return null;
}

export function sumConfirmedForMonth(
  records: ExpenseRecord[],
  currency: string,
  year: number,
  monthZeroBased: number,
): number {
  let total = 0;
  for (const r of records) {
    if (!isConfirmed(r)) continue;
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== year || d.getMonth() !== monthZeroBased) continue;
    const v = recordBaseFor(r, currency);
    if (v != null) total += v;
  }
  return total;
}

export function sumConfirmedTotal(records: ExpenseRecord[], currency: string): number {
  let total = 0;
  for (const r of records) {
    if (!isConfirmed(r)) continue;
    const v = recordBaseFor(r, currency);
    if (v != null) total += v;
  }
  return total;
}

export function findMonthlyBudget(budgets: Budget[], groupId: string): Budget | undefined {
  return budgets.find((b) => b.groupId === groupId && b.periodType === "monthly" && !b.tripId && !b.category);
}

export type CategoryBudgetStatus = {
  category: ExpenseCategory;
  spent: number;
  limit: number;
  remaining: number;
  percentage: number;
  currency: string;
};

// Per-category budget status for the current month. Returns null when no budget is set
// for the category. Mirrors the monthly group-budget computation (confirmed records only,
// same calendar month, base-currency aware) but scoped to a single category.
export function getCategoryBudgetStatus(
  expenses: ExpenseRecord[],
  budgets: Budget[],
  category: ExpenseCategory,
  refDate: Date = new Date(),
): CategoryBudgetStatus | null {
  const budget = budgets.find(
    (b) => b.category === category && b.periodType === "monthly" && !b.tripId,
  );
  if (!budget) return null;
  let spent = 0;
  for (const r of expenses) {
    if (!isConfirmed(r)) continue;
    if (r.category !== category) continue;
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== refDate.getFullYear() || d.getMonth() !== refDate.getMonth()) continue;
    const v = recordBaseFor(r, budget.currency);
    if (v != null) spent += v;
  }
  spent = Number(spent.toFixed(2));
  const remaining = Number((budget.amount - spent).toFixed(2));
  const percentage = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
  return { category, spent, limit: budget.amount, remaining, percentage, currency: budget.currency };
}

export function findTripBudget(budgets: Budget[], tripId: string): Budget | undefined {
  return budgets.find((b) => b.tripId === tripId && b.periodType === "trip_total");
}

export type BudgetUsage = {
  amount: number;
  currency: string;
  used: number;
  remaining: number;
  pct: number;
};

export function monthlyBudgetUsage(
  budget: Budget,
  records: ExpenseRecord[],
  refDate: Date = new Date(),
): BudgetUsage {
  const used = sumConfirmedForMonth(records, budget.currency, refDate.getFullYear(), refDate.getMonth());
  return {
    amount: budget.amount,
    currency: budget.currency,
    used,
    remaining: Number((budget.amount - used).toFixed(2)),
    pct: budget.amount > 0 ? Math.min(100, (used / budget.amount) * 100) : 0,
  };
}

export function tripBudgetUsage(budget: Budget, records: ExpenseRecord[]): BudgetUsage {
  const used = sumConfirmedTotal(records, budget.currency);
  return {
    amount: budget.amount,
    currency: budget.currency,
    used,
    remaining: Number((budget.amount - used).toFixed(2)),
    pct: budget.amount > 0 ? Math.min(100, (used / budget.amount) * 100) : 0,
  };
}

export type TripBudgetSummary = {
  hasBudget: boolean;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  totalSpent: number;
  remaining: number | null;
  totalDays: number | null;
  currentDay: number | null;
  remainingDays: number | null;
  avgPerDay: number | null;
  safeDaily: number | null;
  pace: "under" | "on_track" | "over" | "unknown";
  percentUsed: number | null;
};

function parseIso(date: string | undefined): Date | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysInclusive(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000))) + 1;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function tripBudgetSummary(args: {
  budget?: { amount: number; currency: string };
  legacyBudget?: number | null;
  baseCurrency: string;
  records: ExpenseRecord[];
  startDate?: string;
  endDate?: string;
  refDate?: Date;
}): TripBudgetSummary {
  const ref = args.refDate ?? new Date();
  const currency = args.budget?.currency ?? args.baseCurrency;
  const amount = args.budget?.amount ?? args.legacyBudget ?? null;
  const totalSpent = sumConfirmedTotal(args.records, currency);
  const start = parseIso(args.startDate);
  const end = parseIso(args.endDate);

  let totalDays: number | null = null;
  let currentDay: number | null = null;
  let remainingDays: number | null = null;
  if (start && end) {
    totalDays = daysInclusive(start, end);
    const fromStart = Math.floor((ref.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    currentDay = clampInt(fromStart, 1, totalDays);
    remainingDays = Math.max(0, totalDays - currentDay + 1);
  }

  const daysSoFar = currentDay ?? null;
  const avgPerDay = daysSoFar && daysSoFar > 0 ? Number((totalSpent / daysSoFar).toFixed(2)) : null;
  const remaining = amount != null ? Number((amount - totalSpent).toFixed(2)) : null;
  const safeDaily = amount != null && remainingDays && remainingDays > 0
    ? Number(((amount - totalSpent) / remainingDays).toFixed(2))
    : null;

  let pace: TripBudgetSummary["pace"] = "unknown";
  if (amount != null && totalDays && currentDay) {
    const expectedSoFar = (amount / totalDays) * currentDay;
    if (totalSpent > expectedSoFar * 1.05) pace = "over";
    else if (totalSpent < expectedSoFar * 0.95) pace = "under";
    else pace = "on_track";
  }

  return {
    hasBudget: amount != null,
    budgetAmount: amount,
    budgetCurrency: currency,
    totalSpent,
    remaining,
    totalDays,
    currentDay,
    remainingDays,
    avgPerDay,
    safeDaily,
    pace,
    percentUsed: amount != null && amount > 0 ? Math.min(999, (totalSpent / amount) * 100) : null,
  };
}
