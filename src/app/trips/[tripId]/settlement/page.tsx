"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { calculateBalances, calculateSettlements, type Settlement } from "@/lib/settlement";
import type { ExpenseRecord, Trip } from "@/lib/types";

type SettlementPaymentApi = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  groupId: string;
  tripId?: string;
  date: string;
  status: "pending" | "paid";
  createdAt: string;
};

export default function SettlementPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId;
  const router = useRouter();
  const session = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [payments, setPayments] = useState<SettlementPaymentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingKey, setMarkingKey] = useState<string | null>(null);

  async function loadPayments(groupId: string, currentTripId: string): Promise<void> {
    try {
      const r = await fetch(`/api/settlement-payments?groupId=${encodeURIComponent(groupId)}&tripId=${encodeURIComponent(currentTripId)}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Failed to load settlement payments");
      setPayments(body.payments || []);
    } catch (err) {
      console.warn("settlement payments load failed", err);
    }
  }

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
      .then(async ([t, e]) => {
        if (!t.ok) throw new Error(t.body.error || "Trip not found");
        if (!e.ok) throw new Error(e.body.error || "Failed to load expenses");
        const tripData = t.body.trip as Trip;
        setTrip(tripData);
        setRecords(e.body.records || []);
        if (tripData.familyId) await loadPayments(tripData.familyId, tripId);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router, tripId]);

  async function markAsPaid(settlement: Settlement, currency: string): Promise<void> {
    if (!trip || !session) return;
    const key = `${settlement.fromUserId}->${settlement.toUserId}`;
    setMarkingKey(key);
    try {
      const res = await fetch("/api/settlement-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterUserId: session.userId,
          fromUserId: settlement.fromUserId,
          toUserId: settlement.toUserId,
          amount: settlement.amount,
          currency,
          groupId: trip.familyId,
          tripId: trip.tripId,
          status: "paid",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      await loadPayments(trip.familyId, trip.tripId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMarkingKey(null);
    }
  }

  const baseCurrency = session?.baseCurrency || trip?.baseCurrency || "HKD";
  const usable = useMemo(
    () => records.filter((r) => typeof r.baseAmount === "number" && r.baseCurrency === baseCurrency),
    [records, baseCurrency],
  );
  const skippedCount = records.length - usable.length;
  const balances = useMemo(() => calculateBalances(usable), [usable]);
  const rawSettlements = useMemo(() => calculateSettlements(balances), [balances]);
  const paidByPair = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== "paid") continue;
      const key = `${p.fromUserId}->${p.toUserId}`;
      map.set(key, (map.get(key) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);
  const settlements = useMemo<Settlement[]>(() => {
    return rawSettlements
      .map((s) => {
        const key = `${s.fromUserId}->${s.toUserId}`;
        const paid = paidByPair.get(key) ?? 0;
        const remaining = Number((s.amount - paid).toFixed(2));
        return { ...s, amount: remaining };
      })
      .filter((s) => s.amount > 0.01);
  }, [rawSettlements, paidByPair]);

  if (!session || loading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;
  if (!trip) return <div className="text-sm text-zinc-500">Trip not found.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="text-xs text-zinc-500">
          <Link href="/trips" className="underline">Trips</Link> /{" "}
          <Link href={`/trips/${trip.tripId}`} className="underline">{trip.tripName}</Link> /
        </div>
        <h1 className="text-2xl font-semibold">Settlement</h1>
        <p className="text-sm text-zinc-500">All amounts in {baseCurrency}. Records marked as not split are excluded.</p>
        {skippedCount > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
            {skippedCount} record{skippedCount === 1 ? "" : "s"} skipped — no conversion to {baseCurrency} available.
          </p>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Per-person balance</h2>
        {balances.length === 0 ? (
          <div className="text-sm text-zinc-500 border border-dashed border-zinc-300 rounded p-4">No splittable expenses yet.</div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="text-left px-3 py-2">Person</th>
                  <th className="text-right px-3 py-2">Paid</th>
                  <th className="text-right px-3 py-2">Share owed</th>
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
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Who owes whom</h2>
        {settlements.length === 0 ? (
          <div className="text-sm text-zinc-500 border border-dashed border-zinc-300 rounded p-4">Everyone is settled up.</div>
        ) : (
          <ul className="space-y-1">
            {settlements.map((s) => {
              const key = `${s.fromUserId}->${s.toUserId}`;
              const marking = markingKey === key;
              return (
                <li key={key} className="bg-white border border-zinc-200 rounded p-3 text-sm flex items-center justify-between gap-3">
                  <div>
                    <span className="font-medium">{s.fromUserName}</span>
                    <span className="text-zinc-500"> pays </span>
                    <span className="font-medium">{s.toUserName}</span>
                    <span className="ml-2 text-zinc-900">{s.amount.toFixed(2)} {baseCurrency}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => markAsPaid(s, baseCurrency)}
                    disabled={marking}
                    className="text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {marking ? "Recording…" : "Mark as Paid"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {payments.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Recorded payments</h2>
          <ul className="space-y-1">
            {payments.map((p) => (
              <li key={p.id} className="bg-white border border-zinc-200 rounded p-3 text-xs text-zinc-700 flex items-center justify-between gap-2">
                <span>
                  {p.amount.toFixed(2)} {p.currency} · {p.date}
                  <span className="text-zinc-500"> · {p.status}</span>
                </span>
                <span className="text-zinc-500">{p.fromUserId.slice(0, 6)} → {p.toUserId.slice(0, 6)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
