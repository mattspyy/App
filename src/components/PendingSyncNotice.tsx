"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getPendingExpenses,
  retryPendingSync,
  type PendingExpense,
} from "@/lib/pendingSync";

export default function PendingSyncNotice() {
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback((): void => {
    setPending(getPendingExpenses());
  }, []);

  useEffect(() => {
    refresh();
    function onStorage(e: StorageEvent) {
      if (e.key === "fxt.pendingExpenses") refresh();
    }
    function onFocus() {
      refresh();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function handleRetry(): Promise<void> {
    setRetrying(true);
    setMessage(null);
    try {
      const r = await retryPendingSync();
      if (r.succeeded > 0 && r.failed === 0) setMessage(`Synced ${r.succeeded} expense${r.succeeded === 1 ? "" : "s"}.`);
      else if (r.succeeded > 0 && r.failed > 0) setMessage(`Synced ${r.succeeded}, ${r.failed} still failing.`);
      else if (r.succeeded === 0 && r.failed > 0) setMessage(`Could not sync — ${r.failed} expense${r.failed === 1 ? "" : "s"} still pending.`);
      refresh();
    } finally {
      setRetrying(false);
    }
  }

  if (pending.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm flex items-center gap-3 flex-wrap">
      <span className="font-medium">
        {pending.length} expense{pending.length === 1 ? "" : "s"} waiting to sync
      </span>
      {message && <span className="text-xs text-amber-800">{message}</span>}
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="ml-auto text-xs px-3 py-1 rounded border border-amber-300 bg-white text-amber-900 disabled:opacity-50"
      >
        {retrying ? "Retrying…" : "Retry sync"}
      </button>
    </div>
  );
}
