"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { expandForDailyAnalytics, onlyConfirmed, totalAmount, totalByCategory, totalByDate, totalByUser } from "@/lib/chartUtils";
import { findTripBudget, tripBudgetSummary, tripBudgetUsage } from "@/lib/budget";
import type { Budget, ExpenseRecord, Trip } from "@/lib/types";
import CategoryPieChart from "@/components/CategoryPieChart";
import SpendingLineChart from "@/components/SpendingLineChart";
import UserBarChart from "@/components/UserBarChart";
import ExpenseCard from "@/components/ExpenseCard";
import EmptyState from "@/components/EmptyState";
import RefreshButton from "@/components/RefreshButton";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useCallback } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / DAY_MS);
}

function formatRange(start?: string, end?: string): string {
  if (start && end) return `${start} → ${end}`;
  if (start) return `${start} →`;
  if (end) return `→ ${end}`;
  return "Dates not set";
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tripDayLabel(trip: Trip): { primary: string; secondary: string } {
  const today = isoToday();
  if (trip.startDate && today < trip.startDate) {
    const n = daysBetween(today, trip.startDate);
    return { primary: `In ${n}d`, secondary: "until trip" };
  }
  if (trip.endDate && today > trip.endDate) {
    const n = daysBetween(trip.endDate, today);
    return { primary: `${n}d ago`, secondary: "trip ended" };
  }
  if (trip.startDate && trip.endDate) {
    const totalDays = daysBetween(trip.startDate, trip.endDate) + 1;
    const dayIndex = daysBetween(trip.startDate, today) + 1;
    return { primary: `Day ${dayIndex}/${totalDays}`, secondary: "in progress" };
  }
  return { primary: "—", secondary: "no dates" };
}

export default function TripDashboardPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId;
  const router = useRouter();
  const session = useSession();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [session, router]);

  const load = useCallback(async (): Promise<void> => {
    if (!session || !tripId) return;
    const uid = encodeURIComponent(session.userId);
    const tid = encodeURIComponent(tripId);
    try {
      const [t, e] = await Promise.all([
        fetch(`/api/trips/${tid}?userId=${uid}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/expenses?tripId=${tid}&baseCurrency=${encodeURIComponent(session.baseCurrency || "HKD")}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
      ]);
      if (!t.ok) throw new Error(t.body.error || "Trip not found");
      if (!e.ok) throw new Error(e.body.error || "Failed to load expenses");
      setTrip(t.body.trip);
      setRecords(e.body.records || []);
      const bRes = await fetch(`/api/budgets?tripId=${tid}`);
      if (bRes.ok) {
        const bBody = await bRes.json();
        setBudgets(bBody.budgets || []);
      } else {
        setBudgets([]);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [session, tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const { pulling, distance, refreshing, trigger } = usePullToRefresh(load);

  async function handleDelete() {
    if (!session || !trip) return;
    const ok = confirm(`Delete trip "${trip.tripName}"? The trip will be archived in Notion (restorable from Notion if needed). Expenses are not deleted and will reference the archived trip ID.`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip.tripId)}?userId=${encodeURIComponent(session.userId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete trip");
      router.replace("/trips");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setDeleting(false);
    }
  }

  const today = isoToday();

  const stats = useMemo(() => {
    const confirmed = onlyConfirmed(records);
    const total = totalAmount(confirmed);
    const expanded = expandForDailyAnalytics(confirmed);
    const todayRecords = expanded.filter((r) => r.date === today);
    const todayTotal = totalAmount(todayRecords);
    const tripBudget = trip ? findTripBudget(budgets, trip.tripId) : undefined;
    const usage = tripBudget ? tripBudgetUsage(tripBudget, records) : null;
    const legacyAmount = trip?.budget;
    const budgetAmount = usage?.amount ?? legacyAmount ?? null;
    const budgetPct = budgetAmount && budgetAmount > 0 ? Math.min(100, (total / budgetAmount) * 100) : null;
    const budgetRemaining = budgetAmount != null ? Number((budgetAmount - total).toFixed(2)) : null;
    return {
      total,
      todayTotal,
      todayCount: todayRecords.length,
      byCategory: totalByCategory(confirmed),
      byUser: totalByUser(confirmed),
      byDate: totalByDate(expanded),
      budgetAmount,
      budgetCurrency: usage?.currency ?? trip?.baseCurrency ?? null,
      budgetPct,
      budgetRemaining,
    };
  }, [records, budgets, trip, today]);

  const todayRecords = useMemo(() => {
    const expanded = expandForDailyAnalytics(onlyConfirmed(records));
    return expanded.filter((r) => r.date === today);
  }, [records, today]);
  const recentRecords = useMemo(
    () => records.filter((r) => r.date !== today).slice(0, 5),
    [records, today],
  );

  if (!session || loading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;
  if (!trip) return <div className="text-sm text-zinc-500">Trip not found.</div>;

  const dayLabel = tripDayLabel(trip);
  const scanHref = `/scan?tripId=${encodeURIComponent(trip.tripId)}`;

  return (
    <div className="space-y-5">
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-zinc-500">
          <Link href="/trips" className="underline">Trips</Link> /
        </div>
        <RefreshButton onClick={trigger} refreshing={refreshing} />
      </div>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-amber-400 text-white shadow-sm">
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" aria-hidden style={{
          backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.6), transparent 50%), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.4), transparent 50%)",
        }} />
        <div className="relative p-5 sm:p-7">
          <div className="text-xs uppercase tracking-wide opacity-80">{trip.destination || "Trip"}</div>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">{trip.tripName}</h1>
          <div className="text-sm opacity-90 mt-1">{formatRange(trip.startDate, trip.endDate)} · Base {trip.baseCurrency}</div>
          <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs">
            <span>📅</span>
            <span className="font-medium">{dayLabel.primary}</span>
            <span className="opacity-80">· {dayLabel.secondary}</span>
          </div>
        </div>
      </section>

      {(() => {
        if (!trip) return null;
        const summary = tripBudgetSummary({
          budget: stats.budgetAmount != null && stats.budgetCurrency
            ? { amount: stats.budgetAmount, currency: stats.budgetCurrency }
            : undefined,
          legacyBudget: trip.budget ?? null,
          baseCurrency: trip.baseCurrency,
          records,
          startDate: trip.startDate,
          endDate: trip.endDate,
        });
        if (!summary.hasBudget) return null;
        const cur = summary.budgetCurrency || trip.baseCurrency;
        const paceLabel =
          summary.pace === "over" ? "Over pace"
          : summary.pace === "under" ? "Under pace"
          : summary.pace === "on_track" ? "On pace"
          : "—";
        const paceTone =
          summary.pace === "over" ? "text-red-700"
          : summary.pace === "under" ? "text-emerald-700"
          : summary.pace === "on_track" ? "text-zinc-700"
          : "text-zinc-500";
        return (
          <section className="bg-white border border-zinc-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-zinc-500">Avg / day</div>
              <div className="font-medium">{summary.avgPerDay != null ? `${formatAmount(summary.avgPerDay)} ${cur}` : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Safe daily</div>
              <div className="font-medium">{summary.safeDaily != null ? `${formatAmount(summary.safeDaily)} ${cur}` : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Days left</div>
              <div className="font-medium">{summary.remainingDays ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Pace</div>
              <div className={`font-medium ${paceTone}`}>{paceLabel}</div>
            </div>
          </section>
        );
      })()}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Today"
          value={`${formatAmount(stats.todayTotal)} ${trip.baseCurrency}`}
          hint={`${stats.todayCount} expense${stats.todayCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Trip total"
          value={`${formatAmount(stats.total)} ${trip.baseCurrency}`}
          hint={`${records.length} expense${records.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Budget"
          value={stats.budgetAmount != null && stats.budgetPct != null ? `${stats.budgetPct.toFixed(0)}%` : "—"}
          hint={stats.budgetAmount != null && stats.budgetRemaining != null && stats.budgetCurrency
            ? `${formatAmount(stats.budgetRemaining)} ${stats.budgetCurrency} left`
            : "not set"}
          progress={stats.budgetPct ?? undefined}
        />
        <StatCard label={dayLabel.secondary} value={dayLabel.primary} hint="" />
      </section>

      <section className="flex flex-wrap gap-2">
        <Link
          href={scanHref}
          className="flex-1 min-w-[160px] bg-zinc-900 text-white px-4 py-3 rounded-xl text-sm text-center font-medium hover:bg-zinc-800 transition"
        >
          📷 Add expense
        </Link>
        <Link
          href={`/trips/${encodeURIComponent(trip.tripId)}/settlement`}
          className="px-4 py-3 rounded-xl text-sm border border-zinc-300 bg-white hover:bg-zinc-50 transition text-center"
        >
          💱 Settlement
        </Link>
        <Link
          href={`/trips/${encodeURIComponent(trip.tripId)}/report`}
          className="px-4 py-3 rounded-xl text-sm border border-zinc-300 bg-white hover:bg-zinc-50 transition text-center"
        >
          📊 Report
        </Link>
      </section>

      {records.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No expenses yet on this trip"
          description="Scan a receipt or add your first expense to start tracking this trip."
          ctaHref={scanHref}
          ctaLabel="Add the first expense"
        />
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-900">Today</h2>
            {todayRecords.length === 0 ? (
              <div className="text-sm text-zinc-500 border border-dashed border-zinc-300 rounded-xl p-4 bg-white">
                Nothing logged today yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {todayRecords.map((r) => <ExpenseCard key={r.id} record={r} baseCurrency={trip.baseCurrency} />)}
              </ul>
            )}
          </section>

          {recentRecords.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">Recent</h2>
                <Link href={`/history?partyId=${encodeURIComponent(trip.tripId)}`} className="text-xs text-zinc-500 underline">
                  See all
                </Link>
              </div>
              <ul className="space-y-2">
                {recentRecords.map((r) => <ExpenseCard key={r.id} record={r} baseCurrency={trip.baseCurrency} />)}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">Breakdown</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <CategoryPieChart records={onlyConfirmed(records)} />
              <UserBarChart records={onlyConfirmed(records)} />
            </div>
            <SpendingLineChart records={expandForDailyAnalytics(onlyConfirmed(records))} />
          </section>
        </>
      )}

      <section className="pt-6 border-t border-zinc-200">
        <h2 className="font-medium text-zinc-900 mb-1">Danger zone</h2>
        <p className="text-xs text-zinc-500 mb-3">
          Deleting this trip archives it in Notion. Expenses stay in the database but will reference a deleted trip ID.
        </p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm border border-red-300 text-red-700 bg-white hover:bg-red-50 px-3 py-2 rounded-md disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete trip"}
        </button>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  progress,
}: {
  label: string;
  value: string;
  hint: string;
  progress?: number;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-semibold mt-1 truncate">{value}</div>
      {typeof progress === "number" && (
        <div className="h-1.5 bg-zinc-100 rounded mt-2 overflow-hidden">
          <div
            className={`h-full ${progress >= 100 ? "bg-red-500" : progress >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {hint && <div className="text-xs text-zinc-500 mt-1 truncate">{hint}</div>}
    </div>
  );
}
