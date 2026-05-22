"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getPendingExpenses,
  retryPendingSync,
  type PendingExpense,
} from "@/lib/pendingSync";
import { useLanguage } from "@/lib/i18n";

export default function PendingSyncNotice() {
  const { t } = useLanguage();
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
      const plural = (n: number) => (n === 1 ? "" : "s");
      if (r.succeeded > 0 && r.failed === 0) setMessage(t("pendingSync.syncedFmt", { n: r.succeeded, s: plural(r.succeeded) }));
      else if (r.succeeded > 0 && r.failed > 0) setMessage(t("pendingSync.partialFmt", { ok: r.succeeded, fail: r.failed }));
      else if (r.succeeded === 0 && r.failed > 0) setMessage(t("pendingSync.failedFmt", { n: r.failed, s: plural(r.failed) }));
      refresh();
    } finally {
      setRetrying(false);
    }
  }

  if (pending.length === 0) return null;
  const sSuffix = pending.length === 1 ? "" : "s";
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm flex items-center gap-3 flex-wrap">
      <span className="font-medium">
        {t("pendingSync.waitingFmt", { n: pending.length, s: sSuffix })}
      </span>
      {message && <span className="text-xs text-amber-800">{message}</span>}
      <button
        type="button"
        onClick={handleRetry}
        disabled={retrying}
        className="ml-auto text-xs px-3 py-1 rounded border border-amber-300 bg-white text-amber-900 disabled:opacity-50"
      >
        {retrying ? t("pendingSync.retrying") : t("pendingSync.retry")}
      </button>
    </div>
  );
}
