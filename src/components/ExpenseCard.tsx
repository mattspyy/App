"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import { useSession } from "@/lib/session";
import { useLanguage, categoryLabel, paymentMethodLabel } from "@/lib/i18n";
import type { ExpenseRecord } from "@/lib/types";

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Tag({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "emerald" | "blue" | "amber" | "rose" }) {
  const toneClass =
    tone === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : tone === "blue" ? "bg-blue-50 text-blue-700 border-blue-200"
    : tone === "amber" ? "bg-amber-50 text-amber-800 border-amber-200"
    : tone === "rose" ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-zinc-100 text-zinc-700 border-zinc-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${toneClass}`}>
      {children}
    </span>
  );
}

type Props = {
  record: ExpenseRecord;
  baseCurrency: string;
  onDelete?: (id: string) => void;
};

export default function ExpenseCard({ record, baseCurrency, onDelete }: Props) {
  const { t, language } = useLanguage();
  const session = useSession();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [removed, setRemoved] = useState(false);
  const canEdit = !!session && session.userId === record.userId;
  // Spread expenses are expanded into virtual per-day rows whose ids carry a
  // "::date" suffix; edit/delete must target the underlying record.
  const baseId = record.id.split("::")[0];
  function handleEdit() {
    try {
      sessionStorage.setItem("fxt.editExpense", JSON.stringify(record));
    } catch {
      // sessionStorage may be unavailable; the confirm page handles a missing prefill.
    }
    router.push(`/scan/confirm?edit=${encodeURIComponent(record.id)}`);
  }
  async function handleDelete() {
    if (!session || deleting) return;
    if (!confirm(t("expenseCard.deleteConfirm"))) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: baseId, userId: session.userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (onDelete) onDelete(baseId);
      else setRemoved(true);
    } catch {
      setDeleteError(true);
      setTimeout(() => setDeleteError(false), 2500);
    } finally {
      setDeleting(false);
    }
  }
  if (removed) return null;
  const payer = record.payerName || record.userName;
  const showConverted = typeof record.baseAmount === "number"
    && record.baseCurrency
    && record.baseCurrency !== record.currency
    && record.baseCurrency === baseCurrency;
  return (
    <li className="bg-white border border-zinc-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Tag>{categoryLabel(record.category, language)}</Tag>
            {record.paymentMethod && <Tag tone="blue">{paymentMethodLabel(record.paymentMethod, language)}</Tag>}
            {record.status === "needs_review" && <Tag tone="amber">{t("expenseCard.needsReview")}</Tag>}
            {record.status === "draft" && <Tag tone="rose">{t("expenseCard.draft")}</Tag>}
          </div>
          <div className="font-medium text-zinc-900 truncate">{record.merchant || t("common.dash")}</div>
          {record.notes && <div className="text-xs text-zinc-500 truncate mt-0.5">{record.notes}</div>}
          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-600">
            <Avatar name={payer} size={20} />
            <span className="truncate">{t("expenseCard.paidByFmt", { name: payer })}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-zinc-900 whitespace-nowrap">{formatAmount(record.amount)} {record.currency}</div>
          {showConverted && (
            <div className="text-xs text-zinc-500 whitespace-nowrap">≈ {formatAmount(record.baseAmount!)} {record.baseCurrency}</div>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="mt-2 pt-2 border-t border-zinc-100 flex justify-end items-center gap-3">
          {deleteError && (
            <span className="text-xs text-rose-600 mr-auto">{t("expenseCard.deleteFailed")}</span>
          )}
          <button
            type="button"
            onClick={handleEdit}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline"
          >
            {t("expenseCard.edit")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-rose-600 hover:text-rose-800 underline disabled:opacity-50"
          >
            {deleting ? t("expenseCard.deleting") : t("expenseCard.delete")}
          </button>
        </div>
      )}
    </li>
  );
}
