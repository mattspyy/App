import type { ExpenseRecord } from "@/lib/types";
import { topExpenses, topMerchants, topSpendingDays, totalByCategory } from "@/lib/chartUtils";

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  records: ExpenseRecord[];
  baseCurrency: string;
};

export default function RankingLists({ records, baseCurrency }: Props) {
  const expenses = topExpenses(records, 10);
  const merchants = topMerchants(records, 5);
  const days = topSpendingDays(records, 5);
  const categories = totalByCategory(records).slice(0, 5);

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <RankCard title="Top expenses">
        {expenses.length === 0 ? (
          <Empty />
        ) : (
          <ol className="divide-y divide-zinc-100">
            {expenses.map((r, i) => {
              const amt = r.baseAmount ?? r.amount;
              const cur = r.baseAmount != null ? r.baseCurrency || baseCurrency : r.currency;
              return (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-xs text-zinc-400 tabular-nums w-5">{i + 1}</span>
                  <span className="flex-1 min-w-0">
                    <div className="truncate text-zinc-900">{r.merchant || r.category}</div>
                    <div className="text-[11px] text-zinc-500">{r.date} · {r.category}</div>
                  </span>
                  <span className="font-medium tabular-nums whitespace-nowrap">{formatAmount(amt)} {cur}</span>
                </li>
              );
            })}
          </ol>
        )}
      </RankCard>

      <RankCard title="Top merchants">
        {merchants.length === 0 ? (
          <Empty />
        ) : (
          <ol className="divide-y divide-zinc-100">
            {merchants.map((m, i) => (
              <li key={m.merchant} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="text-xs text-zinc-400 tabular-nums w-5">{i + 1}</span>
                <span className="flex-1 truncate text-zinc-900">{m.merchant}</span>
                <span className="text-xs text-zinc-400 tabular-nums">×{m.count}</span>
                <span className="font-medium tabular-nums whitespace-nowrap">{formatAmount(m.total)} {baseCurrency}</span>
              </li>
            ))}
          </ol>
        )}
      </RankCard>

      <RankCard title="Highest spending days">
        {days.length === 0 ? (
          <Empty />
        ) : (
          <ol className="divide-y divide-zinc-100">
            {days.map((d, i) => (
              <li key={d.date} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="text-xs text-zinc-400 tabular-nums w-5">{i + 1}</span>
                <span className="flex-1 truncate text-zinc-900">{d.date}</span>
                <span className="font-medium tabular-nums whitespace-nowrap">{formatAmount(d.total)} {baseCurrency}</span>
              </li>
            ))}
          </ol>
        )}
      </RankCard>

      <RankCard title="Top categories">
        {categories.length === 0 ? (
          <Empty />
        ) : (
          <ol className="divide-y divide-zinc-100">
            {categories.map((c, i) => (
              <li key={c.category} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="text-xs text-zinc-400 tabular-nums w-5">{i + 1}</span>
                <span className="flex-1 truncate text-zinc-900">{c.category}</span>
                <span className="font-medium tabular-nums whitespace-nowrap">{formatAmount(c.total)} {baseCurrency}</span>
              </li>
            ))}
          </ol>
        )}
      </RankCard>
    </div>
  );
}

function RankCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="text-sm font-medium px-4 py-2.5 border-b border-zinc-200">{title}</div>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-xs text-zinc-500 px-4 py-4">No data.</div>;
}
