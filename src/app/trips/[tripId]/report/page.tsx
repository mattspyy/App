"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import {
  expandForDailyAnalytics,
  onlyConfirmed,
  totalAmount,
  totalByCategory,
  totalByDate,
  totalByUser,
} from "@/lib/chartUtils";
import { calculateBalances, calculateSettlements } from "@/lib/settlement";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { ExpenseRecord, Trip } from "@/lib/types";
import SpendingLineChart from "@/components/SpendingLineChart";
import PaymentMethodChart from "@/components/PaymentMethodChart";
import RankingLists from "@/components/RankingLists";

function topMerchant(records: ExpenseRecord[]): { merchant: string; total: number } | null {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = (r.merchant || "—").trim() || "—";
    map.set(key, (map.get(key) ?? 0) + (r.baseAmount ?? r.amount));
  }
  let best: { merchant: string; total: number } | null = null;
  for (const [merchant, total] of map) {
    if (!best || total > best.total) best = { merchant, total };
  }
  return best;
}

function inRange(date: string, start: string, end: string): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

export default function ReportPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId;
  const router = useRouter();
  const session = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [allRecords, setAllRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!tripId) return;
    const uid = encodeURIComponent(session.userId);
    const tid = encodeURIComponent(tripId);
    const base = encodeURIComponent(session.baseCurrency || "HKD");
    Promise.all([
      fetch(`/api/trips/${tid}?userId=${uid}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
      fetch(`/api/expenses?tripId=${tid}&baseCurrency=${base}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
    ])
      .then(([t, e]) => {
        if (!t.ok) throw new Error(t.body.error || "Trip not found");
        if (!e.ok) throw new Error(e.body.error || "Failed to load expenses");
        setTrip(t.body.trip);
        setAllRecords(e.body.records || []);
        const tr = t.body.trip as Trip;
        if (tr.startDate) setStartDate(tr.startDate);
        if (tr.endDate) setEndDate(tr.endDate);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router, tripId]);

  const records = useMemo(
    () => onlyConfirmed(allRecords).filter((r) => inRange(r.date, startDate, endDate)),
    [allRecords, startDate, endDate],
  );

  const summary = useMemo(() => {
    const total = totalAmount(records);
    const expanded = expandForDailyAnalytics(records);
    const byCategory = totalByCategory(records);
    const byUser = totalByUser(records);
    const byDate = totalByDate(expanded);
    const days = byDate.length || 1;
    return {
      total,
      byCategory,
      byUser,
      byDate,
      averageDaily: total / days,
      topCategory: byCategory[0] ?? null,
      topMerchant: topMerchant(records),
      topDay: byDate.reduce((best, cur) => (!best || cur.total > best.total ? cur : best), null as null | { date: string; total: number }),
    };
  }, [records]);

  function handleExport() {
    if (!trip) return;
    const headers = ["Date", "Merchant", "Category", "Amount", "Currency", "Base Amount", "Base Currency", "Payer", "Split Type", "Notes"];
    const rows = records.map((r) => [
      r.date,
      r.merchant ?? "",
      r.category,
      r.amount,
      r.currency,
      r.baseAmount ?? "",
      r.baseCurrency ?? "",
      r.payerName || r.userName || "",
      r.splitType ?? "",
      r.notes ?? "",
    ]);
    const safeName = trip.tripName.replace(/[^a-z0-9-_]+/gi, "_");
    downloadCsv(`${safeName}_${startDate || "all"}_${endDate || "all"}.csv`, toCsv(headers, rows));
  }

  if (!session || loading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;
  if (!trip) return <div className="text-sm text-zinc-500">Trip not found.</div>;

  const baseCurrency = trip.baseCurrency || session.baseCurrency || "HKD";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="text-xs text-zinc-500">
          <Link href="/trips" className="underline">Trips</Link> /{" "}
          <Link href={`/trips/${trip.tripId}`} className="underline">{trip.tripName}</Link> /
        </div>
        <h1 className="text-2xl font-semibold">Report</h1>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <label className="block">
            <div className="text-xs text-zinc-600 mb-1">From</div>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-xs text-zinc-600 mb-1">To</div>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <button
            type="button"
            onClick={handleExport}
            disabled={records.length === 0}
            className="bg-zinc-900 text-white px-3 py-2 rounded-md text-sm disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <SummaryCard label="Total spending" value={`${summary.total.toFixed(2)} ${baseCurrency}`} />
        <SummaryCard label="Records" value={String(records.length)} />
        <SummaryCard label="Avg / day" value={`${summary.averageDaily.toFixed(2)} ${baseCurrency}`} />
        <SummaryCard label="Top category" value={summary.topCategory ? `${summary.topCategory.category} (${summary.topCategory.total.toFixed(2)})` : "—"} />
        <SummaryCard label="Top merchant" value={summary.topMerchant ? `${summary.topMerchant.merchant} (${summary.topMerchant.total.toFixed(2)})` : "—"} />
        <SummaryCard label="Highest day" value={summary.topDay ? `${summary.topDay.date} (${summary.topDay.total.toFixed(2)})` : "—"} />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <TwoColTable
          title="By category"
          rows={summary.byCategory.map((c) => [c.category, c.total.toFixed(2)])}
        />
        <TwoColTable
          title="By user"
          rows={summary.byUser.map((u) => [u.userName, u.total.toFixed(2)])}
        />
      </section>

      {records.length > 0 && (
        <>
          <SpendingLineChart records={expandForDailyAnalytics(records)} />
          <PaymentMethodChart records={records} baseCurrency={baseCurrency} />
          <section className="space-y-2">
            <h2 className="font-medium">Rankings</h2>
            <RankingLists records={records} baseCurrency={baseCurrency} />
          </section>
          <SettlementSummarySection records={records} baseCurrency={baseCurrency} />
        </>
      )}

      <section>
        <h2 className="font-medium mb-2">Expense records ({records.length})</h2>
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Merchant</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Payer</th>
                <th className="text-left px-3 py-2">Split</th>
                <th className="text-right px-3 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2">{r.merchant || "—"}</td>
                  <td className="px-3 py-2">{r.category}</td>
                  <td className="px-3 py-2">{r.payerName || r.userName}</td>
                  <td className="px-3 py-2">{r.splitType ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div>{r.amount.toFixed(2)} {r.currency}</div>
                    {typeof r.baseAmount === "number" && r.baseCurrency && r.baseCurrency !== r.currency && (
                      <div className="text-xs text-zinc-500">~{r.baseAmount.toFixed(2)} {r.baseCurrency}</div>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={6} className="text-center text-zinc-500 py-6">No records in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SettlementSummarySection({ records, baseCurrency }: { records: ExpenseRecord[]; baseCurrency: string }) {
  const usable = records.filter((r) => typeof r.baseAmount === "number" && r.baseCurrency === baseCurrency);
  const balances = calculateBalances(usable);
  const settlements = calculateSettlements(balances);
  if (balances.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="font-medium">Settlement summary</h2>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="text-left px-3 py-2">Person</th>
              <th className="text-right px-3 py-2">Paid</th>
              <th className="text-right px-3 py-2">Share</th>
              <th className="text-right px-3 py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.userId} className="border-t border-zinc-100">
                <td className="px-3 py-2">{b.userName}</td>
                <td className="px-3 py-2 text-right">{b.totalPaid.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{b.totalOwed.toFixed(2)}</td>
                <td className={`px-3 py-2 text-right font-medium ${b.net > 0 ? "text-emerald-700" : b.net < 0 ? "text-red-700" : "text-zinc-500"}`}>
                  {b.net > 0 ? "+" : ""}{b.net.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {settlements.length > 0 && (
        <ul className="space-y-1">
          {settlements.map((s) => (
            <li key={`${s.fromUserId}->${s.toUserId}`} className="bg-white border border-zinc-200 rounded p-2 text-sm">
              <span className="font-medium">{s.fromUserName}</span>
              <span className="text-zinc-500"> pays </span>
              <span className="font-medium">{s.toUserName}</span>
              <span className="ml-2 text-zinc-900">{s.amount.toFixed(2)} {baseCurrency}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function TwoColTable({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h2 className="font-medium mb-2">{title}</h2>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([k, v], i) => (
              <tr key={k + i} className={i === 0 ? "" : "border-t border-zinc-100"}>
                <td className="px-3 py-2">{k}</td>
                <td className="px-3 py-2 text-right">{v}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={2} className="text-center text-zinc-500 py-4">No data.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
