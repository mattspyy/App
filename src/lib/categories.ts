import { EXPENSE_CATEGORIES, type ExpenseCategory } from "./types";

export const DEFAULT_CATEGORIES: readonly ExpenseCategory[] = EXPENSE_CATEGORIES;

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: "#ef4444",
  Shopping: "#f97316",
  Transport: "#eab308",
  Accommodation: "#22c55e",
  Entertainment: "#06b6d4",
  Electronics: "#3b82f6",
  Groceries: "#8b5cf6",
  Tickets: "#ec4899",
  Health: "#14b8a6",
  Other: "#71717a",
};

export const CONFIDENCE_THRESHOLD = 0.7;

import type { CategoryOption, CustomCategory } from "./types";

export const DEFAULT_CATEGORY_COLOR = "#6B7280";

// Merge the hardcoded defaults with a user's custom categories.
// Defaults come first; customs are appended (case-insensitive duplicates of a default dropped).
export function mergeCategoryOptions(custom: CustomCategory[] = []): CategoryOption[] {
  const defaults: CategoryOption[] = DEFAULT_CATEGORIES.map((name) => ({
    name,
    color: CATEGORY_COLORS[name],
    isCustom: false,
  }));
  const defaultLower = new Set(DEFAULT_CATEGORIES.map((c) => c.toLowerCase()));
  const seen = new Set<string>();
  const customOptions: CategoryOption[] = [];
  for (const c of custom) {
    const name = (c.name || "").trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (defaultLower.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    customOptions.push({ name, color: c.color || DEFAULT_CATEGORY_COLOR, isCustom: true });
  }
  return [...defaults, ...customOptions];
}

// Resolve a display color for any category name (hardcoded or custom), gray when unknown.
export function colorForCategory(name: string, custom: CustomCategory[] = []): string {
  if ((DEFAULT_CATEGORIES as readonly string[]).includes(name)) {
    return CATEGORY_COLORS[name as ExpenseCategory];
  }
  const found = custom.find((c) => c.name === name);
  return found?.color || DEFAULT_CATEGORY_COLOR;
}
