"use client";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { ExpenseRecord } from "@/lib/types";
import { totalByCategory } from "@/lib/chartUtils";
import { CATEGORY_COLORS } from "@/lib/categories";
import { useLanguage, categoryLabel } from "@/lib/i18n";

export default function CategoryPieChart({ records }: { records: ExpenseRecord[] }) {
  const { t, language } = useLanguage();
  const raw = totalByCategory(records);
  const data = raw.map((d) => ({ ...d, label: categoryLabel(d.category, language) }));
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-sm font-medium mb-2">{t("charts.byCategory")}</div>
      <div className="h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="label" outerRadius={80} label>
              {data.map((d) => (
                <Cell key={d.category} fill={CATEGORY_COLORS[d.category] || "#71717a"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
