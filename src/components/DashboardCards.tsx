import { useState } from "react";
import type { ExpenseRecord } from "@/lib/types";
import { totalAmount, topCategory, topSpender } from "@/lib/chartUtils";

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

export default function DashboardCards({
  records,
  baseCurrency,
}: {
  records: ExpenseRecord[];
  baseCurrency: string;
}) {
  const [renderedAt] = useState(() => Date.now());
  const total = totalAmount(records);
  const recent7 = records.filter((r) => {
    const t = new Date(r.date).getTime();
    if (Number.isNaN(t)) return false;
    return renderedAt - t < SEVEN_DAYS_MS;
  });
  const recentTotal = totalAmount(recent7);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card label="Total" value={`${total.toFixed(2)} ${baseCurrency}`} />
      <Card label="Expenses" value={String(records.length)} />
      <Card label="Top category" value={topCategory(records) || "—"} />
      <Card label="Top spender" value={topSpender(records) || "—"} />
      <Card label="Last 7 days" value={`${recentTotal.toFixed(2)} ${baseCurrency}`} />
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold mt-1 truncate">{value}</div>
    </div>
  );
}
