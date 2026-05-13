"use client";
import type { ExpenseRecord } from "./types";

export type SyncStatus = "synced" | "pending_sync" | "failed";

const STORAGE_KEY = "fxt.pendingExpenses";

export type PendingExpense = {
  localId: string;
  payload: Partial<ExpenseRecord>;
  status: Exclude<SyncStatus, "synced">;
  lastError?: string;
  createdAt: string;
  lastAttemptAt?: string;
};

function safeRead(): PendingExpense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingExpense[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(list: PendingExpense[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage may be full; nothing we can do here.
  }
}

export function getPendingExpenses(): PendingExpense[] {
  return safeRead();
}

export function queuePendingExpense(payload: Partial<ExpenseRecord>, error?: string): PendingExpense {
  const localId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: PendingExpense = {
    localId,
    payload,
    status: error ? "failed" : "pending_sync",
    lastError: error,
    createdAt: new Date().toISOString(),
  };
  const list = safeRead();
  list.push(entry);
  safeWrite(list);
  return entry;
}

export function removePendingExpense(localId: string): void {
  const list = safeRead().filter((e) => e.localId !== localId);
  safeWrite(list);
}

export function updatePendingExpense(localId: string, patch: Partial<PendingExpense>): void {
  const list = safeRead().map((e) => (e.localId === localId ? { ...e, ...patch } : e));
  safeWrite(list);
}

export function clearPendingExpenses(): void {
  safeWrite([]);
}

export type SaveExpenseResult =
  | { ok: true; data: unknown }
  | { ok: false; queued: PendingExpense; reason: string };

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /network|fetch|offline/i.test(err.message)) return true;
  return false;
}

/**
 * Try to POST an expense; on network failure, queue it as pending_sync and
 * return a result describing the failure so the caller can show a notice.
 */
export async function saveExpenseWithOfflineFallback(payload: Partial<ExpenseRecord>): Promise<SaveExpenseResult> {
  try {
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string")
        ? (data as { error: string }).error
        : "Failed to save";
      throw new Error(message);
    }
    return { ok: true, data };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const reason = err instanceof Error ? err.message : "Network error";
    const queued = queuePendingExpense(payload, reason);
    return { ok: false, queued, reason };
  }
}

export type RetryResult = {
  succeeded: number;
  failed: number;
  remaining: PendingExpense[];
};

export async function retryPendingSync(): Promise<RetryResult> {
  const list = safeRead();
  let succeeded = 0;
  let failed = 0;
  const remaining: PendingExpense[] = [];
  for (const entry of list) {
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data && typeof data === "object" && "error" in data && typeof (data as { error?: string }).error === "string")
          ? (data as { error: string }).error
          : `HTTP ${res.status}`;
        failed += 1;
        remaining.push({
          ...entry,
          status: "failed",
          lastError: message,
          lastAttemptAt: new Date().toISOString(),
        });
      } else {
        succeeded += 1;
      }
    } catch (err) {
      failed += 1;
      remaining.push({
        ...entry,
        status: "failed",
        lastError: err instanceof Error ? err.message : "Network error",
        lastAttemptAt: new Date().toISOString(),
      });
    }
  }
  safeWrite(remaining);
  return { succeeded, failed, remaining };
}
