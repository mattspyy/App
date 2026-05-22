"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ExpenseRecord } from "@/lib/types";
import { totalByDate } from "@/lib/chartUtils";
import { useLanguage } from "@/lib/i18n";

export default function SpendingLineChart({ records }: { records: ExpenseRecord[] }) {
  const { t } = useLanguage();
  const data = totalByDate(records);
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-sm font-medium mb-2">{t("charts.daily")}</div>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
