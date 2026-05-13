"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ExpenseRecord } from "@/lib/types";
import { totalByUser } from "@/lib/chartUtils";

export default function UserBarChart({ records }: { records: ExpenseRecord[] }) {
  const data = totalByUser(records);
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-sm font-medium mb-2">By payer</div>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="userName" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="total" fill="#22c55e" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
