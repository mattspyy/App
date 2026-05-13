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
