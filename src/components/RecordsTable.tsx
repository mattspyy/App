"use client";
import type { ExpenseRecord } from "@/lib/types";
import Avatar from "./Avatar";
import { useSession } from "@/lib/session";
import { useLanguage, categoryLabel } from "@/lib/i18n";

type Props = {
  records: ExpenseRecord[];
  baseCurrency?: string;
  /** When provided, rows owned by the current user get a delete button. */
  onDelete?: (record: ExpenseRecord) => void;
  /** tripId → trip name; rows with both a trip and a group get a small trip tag. */
  tripNames?: Record<string, string>;
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RecordsTable({ records, baseCurrency, onDelete, tripNames }: Props) {
  const { t, language } = useLanguage();
  const session = useSession();
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="text-sm font-medium p-4 border-b border-zinc-200">{t("records.recentExpenses")}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="text-left px-3 py-2">{t("records.thDate")}</th>
              <th className="text-left px-3 py-2">{t("records.thMerchant")}</th>
              <th className="text-left px-3 py-2">{t("records.thCategory")}</th>
              <th className="text-left px-3 py-2">{t("records.thPayer")}</th>
              <th className="text-right px-3 py-2">{t("records.thAmount")}</th>
              {onDelete && <th className="px-3 py-2" aria-label={t("expenseCard.delete")} />}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const showConverted =
                typeof r.baseAmount === "number" &&
                r.baseCurrency &&
                r.baseCurrency !== r.currency &&
                (!baseCurrency || r.baseCurrency === baseCurrency);
              return (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2">
                    {r.merchant || t("common.dash")}
                    {tripNames && r.tripId && r.familyId && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap">
                        {"\u2708"}{tripNames[r.tripId] ? ` ${tripNames[r.tripId]}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{categoryLabel(r.category, language)}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><Avatar name={r.payerName || r.userName} size={22} />{r.payerName || r.userName}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div>{formatAmount(r.amount)} {r.currency}</div>
                    {showConverted && (
                      <div className="text-xs text-zinc-500">~{formatAmount(r.baseAmount!)} {r.baseCurrency}</div>
                    )}
                  </td>
                  {onDelete && (
                    <td className="px-3 py-2 text-right">
                      {session?.userId === r.userId && (
                        <button
                          type="button"
                          onClick={() => onDelete(r)}
                          className="text-xs text-rose-600 hover:text-rose-800 underline"
                        >
                          {t("expenseCard.delete")}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr><td colSpan={onDelete ? 6 : 5} className="text-center text-zinc-500 py-6">{t("records.empty")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
