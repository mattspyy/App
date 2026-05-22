"use client";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ExpenseRecord } from "@/lib/types";
import { totalByPaymentMethod } from "@/lib/chartUtils";
import { useLanguage, paymentMethodLabel } from "@/lib/i18n";

const PALETTE = [
  "#3b82f6", "#22c55e", "#ef4444", "#f97316",
  "#a855f7", "#14b8a6", "#eab308", "#71717a",
];

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaymentMethodChart({
  records,
  baseCurrency,
}: {
  records: ExpenseRecord[];
  baseCurrency: string;
}) {
  const { t, language } = useLanguage();
  const data = totalByPaymentMethod(records);
  const total = data.reduce((s, d) => s + d.total, 0);

  if (data.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-4">
        <div className="text-sm font-medium mb-2">{t("charts.byPaymentMethod")}</div>
        <div className="text-xs text-zinc-500">{t("ranking.noData")}</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-sm font-medium mb-2">{t("charts.byPaymentMethod")}</div>
      <div className="grid sm:grid-cols-2 gap-3 items-center">
        <div className="h-48">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="method" outerRadius={70}>
                {data.map((d, i) => (
                  <Cell key={d.method} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${formatAmount(Number(v) || 0)} ${baseCurrency}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5 text-xs">
          {data.map((d, i) => {
            const pct = total > 0 ? (d.total / total) * 100 : 0;
            return (
              <li key={d.method} className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded shrink-0"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  aria-hidden
                />
                <span className="flex-1 truncate text-zinc-700">{paymentMethodLabel(d.method, language)}</span>
                <span className="text-zinc-500 tabular-nums">{pct.toFixed(0)}%</span>
                <span className="text-zinc-900 font-medium tabular-nums whitespace-nowrap">
                  {formatAmount(d.total)} {baseCurrency}
                </span>
                <span className="text-zinc-400 tabular-nums">×{d.count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
