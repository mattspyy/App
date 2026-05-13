import type { ExpenseRecord, ExpenseCategory } from "./types";

export function isConfirmed(r: ExpenseRecord): boolean {
  return !r.status || r.status === "confirmed";
}

export function onlyConfirmed(records: ExpenseRecord[]): ExpenseRecord[] {
  return records.filter(isConfirmed);
}

export type CategoryTotal = { category: ExpenseCategory; total: number };
export type DateTotal = { date: string; total: number };
export type UserTotal = { userName: string; total: number };

function recordTotal(r: ExpenseRecord): number {
  return r.baseAmount ?? r.amount;
}

export function totalByCategory(records: ExpenseRecord[]): CategoryTotal[] {
  const map = new Map<ExpenseCategory, number>();
  for (const r of records) {
    map.set(r.category, (map.get(r.category) ?? 0) + recordTotal(r));
  }
  return Array.from(map, ([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export function totalByDate(records: ExpenseRecord[]): DateTotal[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const d = (r.date || "").slice(0, 10) || "unknown";
    map.set(d, (map.get(d) ?? 0) + recordTotal(r));
  }
  return Array.from(map, ([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
}

export function totalByUser(records: ExpenseRecord[]): UserTotal[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const name = r.payerName || r.userName || "Unknown";
    map.set(name, (map.get(name) ?? 0) + recordTotal(r));
  }
  return Array.from(map, ([userName, total]) => ({ userName, total })).sort((a, b) => b.total - a.total);
}

export function topCategory(records: ExpenseRecord[]): string | null {
  return totalByCategory(records)[0]?.category ?? null;
}

export function topSpender(records: ExpenseRecord[]): string | null {
  return totalByUser(records)[0]?.userName ?? null;
}

export function totalAmount(records: ExpenseRecord[]): number {
  return records.reduce((s, r) => s + recordTotal(r), 0);
}


export type PaymentMethodTotal = { method: string; total: number; count: number };
export function totalByPaymentMethod(records: ExpenseRecord[]): PaymentMethodTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of records) {
    const key = r.paymentMethod || "Other";
    const cur = map.get(key) || { total: 0, count: 0 };
    cur.total += recordTotal(r);
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map, ([method, v]) => ({ method, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);
}

export type MerchantTotal = { merchant: string; total: number; count: number };
export function topMerchants(records: ExpenseRecord[], limit = 5): MerchantTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of records) {
    const key = (r.merchant || "").trim();
    if (!key) continue;
    const cur = map.get(key) || { total: 0, count: 0 };
    cur.total += recordTotal(r);
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map, ([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function topExpenses(records: ExpenseRecord[], limit = 10): ExpenseRecord[] {
  return [...records]
    .sort((a, b) => recordTotal(b) - recordTotal(a))
    .slice(0, limit);
}

export function topSpendingDays(records: ExpenseRecord[], limit = 5): DateTotal[] {
  return totalByDate(records)
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * Expand spread-across-days expenses into a series of single-day records so
 * daily charts and per-day stats use the allocated amount instead of dumping
 * the full total onto a single day. The original record is preserved unchanged
 * when not spread.
 */
export function expandForDailyAnalytics(records: ExpenseRecord[]): ExpenseRecord[] {
  const out: ExpenseRecord[] = [];
  for (const r of records) {
    if (
      r.expenseType === "spread_across_days"
      && r.spreadStartDate
      && r.spreadEndDate
      && typeof r.dailyAllocatedAmount === "number"
    ) {
      const start = new Date(r.spreadStartDate);
      const end = new Date(r.spreadEndDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        out.push(r);
        continue;
      }
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        const isoDate = `${y}-${m}-${d}`;
        const ratio = r.amount > 0 ? r.dailyAllocatedAmount / r.amount : 0;
        const baseAmount = typeof r.baseAmount === "number" ? r.baseAmount * ratio : undefined;
        out.push({
          ...r,
          id: `${r.id}::${isoDate}`,
          amount: r.dailyAllocatedAmount,
          baseAmount: typeof baseAmount === "number" ? Number(baseAmount.toFixed(2)) : undefined,
          date: isoDate,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      out.push(r);
    }
  }
  return out;
}
