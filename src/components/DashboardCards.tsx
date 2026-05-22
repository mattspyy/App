"use client";
import { useState } from "react";
import type { ExpenseRecord } from "@/lib/types";
import { totalAmount, topCategory, topSpender } from "@/lib/chartUtils";
import { useLanguage, categoryLabel } from "@/lib/i18n";

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;

export default function DashboardCards({
  records,
  baseCurrency,
}: {
  records: ExpenseRecord[];
  baseCurrency: string;
}) {
  const { t, language } = useLanguage();
  const [renderedAt] = useState(() => Date.now());
  const total = totalAmount(records);
  const recent7 = records.filter((r) => {
    const tm = new Date(r.date).getTime();
    if (Number.isNaN(tm)) return false;
    return renderedAt - tm < SEVEN_DAYS_MS;
  });
  const recentTotal = totalAmount(recent7);
  const topCat = topCategory(records);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card label={t("dashboard.total")} value={`${total.toFixed(2)} ${baseCurrency}`} />
      <Card label={t("dashboard.expenses")} value={String(records.length)} />
      <Card label={t("dashboard.topCategory")} value={topCat ? categoryLabel(topCat, language) : t("common.dash")} />
      <Card label={t("dashboard.topSpender")} value={topSpender(records) || t("common.dash")} />
      <Card label={t("dashboard.last7Days")} value={`${recentTotal.toFixed(2)} ${baseCurrency}`} />
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
