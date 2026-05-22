"use client";
import Avatar from "./Avatar";
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
};

export default function ExpenseCard({ record, baseCurrency }: Props) {
  const { t, language } = useLanguage();
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
    </li>
  );
}
