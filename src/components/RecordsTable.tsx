import type { ExpenseRecord } from "@/lib/types";
import Avatar from "./Avatar";

type Props = {
  records: ExpenseRecord[];
  baseCurrency?: string;
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RecordsTable({ records, baseCurrency }: Props) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="text-sm font-medium p-4 border-b border-zinc-200">Recent expenses</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Merchant</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Payer</th>
              <th className="text-right px-3 py-2">Amount</th>
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
                  <td className="px-3 py-2">{r.merchant || "—"}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><Avatar name={r.payerName || r.userName} size={22} />{r.payerName || r.userName}</span></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div>{formatAmount(r.amount)} {r.currency}</div>
                    {showConverted && (
                      <div className="text-xs text-zinc-500">~{formatAmount(r.baseAmount!)} {r.baseCurrency}</div>
                    )}
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr><td colSpan={5} className="text-center text-zinc-500 py-6">No expenses.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
