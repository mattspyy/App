"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
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
import {
  Card,
  Badge,
  Alert,
  ButtonLink,
  Button,
  SectionHeader,
  StatCard,
} from "@/components/ui";

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
    return { primary: `In ${n} d`, secondary: "until trip" };
  }
  if (trip.endDate && today > trip.endDate) {
    const n = daysBetween(trip.endDate, today);
    return { primary: `${n} d ago`, secondary: "trip ended" };
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
    if (!session) router.replace("/login");
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

  useEffect(() => { load(); }, [load]);

  const { pulling, distance, refreshing, trigger } = usePullToRefresh(load);

  async function handleDelete() {
    if (!session || !trip) return;
    const ok = confirm(
      `Delete trip "${trip.tripName}"? The trip will be archived in Notion (restorable from Notion if needed). Expenses are not deleted and will reference the archived trip ID.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(trip.tripId)}?userId=${encodeURIComponent(session.userId)}`,
        { method: "DELETE" },
      );
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

  if (!session || loading) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;
  if (error) return <Alert tone="accent" title="Couldn't load this trip.">{error}</Alert>;
  if (!trip) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Trip not found.</div>;

  const dayLabel = tripDayLabel(trip);
  const scanHref = `/scan?tripId=${encodeURIComponent(trip.tripId)}`;
  const budgetUsedFrac = stats.budgetAmount && stats.budgetAmount > 0 ? stats.total / stats.budgetAmount : null;
  const budgetStatus =
    budgetUsedFrac == null ? null
    : budgetUsedFrac >= 1 ? "over"
    : budgetUsedFrac >= 0.8 ? "approaching"
    : "ontrack";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Link href="/trips" style={{ fontSize: 12, color: "var(--color-ink-2)", textDecoration: "none" }}>
          ← Trips
        </Link>
        <RefreshButton onClick={trigger} refreshing={refreshing} />
      </div>

      {/* BANNER */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-2xl)",
          background:
            "linear-gradient(135deg, color-mix(in oklch, var(--color-accent) 65%, var(--color-ink) 0%) 0%, color-mix(in oklch, var(--color-accent) 75%, var(--color-amber) 25%) 60%, color-mix(in oklch, var(--color-amber) 70%, var(--color-accent)) 100%)",
          color: "white",
          padding: "28px 24px",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(circle at 75% 85%, rgba(255,255,255,0.18), transparent 50%)",
            mixBlendMode: "overlay",
            opacity: 0.85,
          }}
        />
        <div style={{ position: "relative" }}>
          <div className="fxt-mono" style={{ fontSize: 11, letterSpacing: "0.12em", opacity: 0.85 }}>
            {trip.destination ? trip.destination.toUpperCase() : "TRIP"}
          </div>
          <h1
            className="fxt-display"
            style={{
              fontSize: "clamp(34px, 6vw, 56px)",
              margin: "6px 0 8px",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "white",
            }}
          >
            {trip.tripName}
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 13, opacity: 0.95 }}>
            <span>{formatRange(trip.startDate, trip.endDate)}</span>
            <span aria-hidden style={{ opacity: 0.5 }}>·</span>
            <span>Base <strong className="fxt-mono">{trip.baseCurrency}</strong></span>
          </div>
          <div
            style={{
              marginTop: 14,
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              background: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(6px)",
              borderRadius: 999,
              padding: "6px 14px",
              fontSize: 13,
            }}
          >
            <span aria-hidden>📅</span>
            <strong>{dayLabel.primary}</strong>
            <span style={{ opacity: 0.85 }}>· {dayLabel.secondary}</span>
          </div>
        </div>
      </section>

      {/* BUDGET PACE */}
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
        const paceTone: "amber" | "sage" | "neutral" =
          summary.pace === "over" ? "amber"
          : summary.pace === "under" ? "sage"
          : "neutral";
        return (
          <Card padding={16} tone="soft">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              <PaceCell label="Avg / day" value={summary.avgPerDay != null ? `${formatAmount(summary.avgPerDay)} ${cur}` : "—"} />
              <PaceCell label="Safe daily" value={summary.safeDaily != null ? `${formatAmount(summary.safeDaily)} ${cur}` : "—"} />
              <PaceCell label="Days left" value={String(summary.remainingDays ?? "—")} />
              <div>
                <div className="fxt-eyebrow">Pace</div>
                <div style={{ marginTop: 4 }}>
                  <Badge tone={paceTone}>{paceLabel}</Badge>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* STAT CARDS */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
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
        {stats.budgetAmount != null && stats.budgetCurrency ? (
          <StatCard
            label="Budget"
            value={`${stats.budgetPct?.toFixed(0) ?? "—"}%`}
            hint={
              stats.budgetRemaining != null
                ? `${formatAmount(stats.budgetRemaining)} ${stats.budgetCurrency} left`
                : undefined
            }
            progress={budgetUsedFrac ?? undefined}
            tone={budgetStatus === "over" ? "amber" : budgetStatus === "approaching" ? "amber" : "surface"}
          />
        ) : (
          <StatCard label="Budget" value="—" hint="not set" />
        )}
        <StatCard label={dayLabel.secondary} value={dayLabel.primary} />
      </section>

      {/* ACTIONS */}
      <section style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ButtonLink href={scanHref} variant="accent" size="lg" full={false}>
          📷 Add expense
        </ButtonLink>
        <ButtonLink
          href={`/trips/${encodeURIComponent(trip.tripId)}/settlement`}
          variant="secondary"
          size="lg"
        >
          💱 Settlement
        </ButtonLink>
        <ButtonLink
          href={`/trips/${encodeURIComponent(trip.tripId)}/report`}
          variant="secondary"
          size="lg"
        >
          📊 Report
        </ButtonLink>
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
          <section>
            <SectionHeader title="Today" meta={`${todayRecords.length} EXPENSE${todayRecords.length === 1 ? "" : "S"}`} />
            {todayRecords.length === 0 ? (
              <Card padding={16} tone="soft">
                <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>Nothing logged today yet.</div>
              </Card>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {todayRecords.map((r) => <ExpenseCard key={r.id} record={r} baseCurrency={trip.baseCurrency} />)}
              </ul>
            )}
          </section>

          {recentRecords.length > 0 && (
            <section>
              <SectionHeader
                title="Recent"
                action={
                  <Link
                    href={`/history?partyId=${encodeURIComponent(trip.familyId)}`}
                    style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    See all
                  </Link>
                }
              />
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {recentRecords.map((r) => <ExpenseCard key={r.id} record={r} baseCurrency={trip.baseCurrency} />)}
              </ul>
            </section>
          )}

          <section>
            <SectionHeader title="Breakdown" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              <CategoryPieChart records={onlyConfirmed(records)} />
              <UserBarChart records={onlyConfirmed(records)} />
            </div>
          </section>

          <section>
            <SectionHeader title="Daily trend" />
            <SpendingLineChart records={expandForDailyAnalytics(onlyConfirmed(records))} />
          </section>
        </>
      )}

      {/* DANGER ZONE */}
      <section
        style={{
          paddingTop: 24,
          marginTop: 8,
          borderTop: "1px solid var(--color-line-soft)",
        }}
      >
        <Badge tone="amber" size="sm">DANGER ZONE</Badge>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, margin: "10px 0 6px" }}>
          Delete this trip
        </h3>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.5, margin: "0 0 12px", maxWidth: "60ch" }}>
          Archives the trip in Notion. Expenses stay in the database but will reference a deleted trip ID.
        </p>
        <Button type="button" variant="danger" size="md" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete trip"}
        </Button>
      </section>
    </div>
  );
}

function PaceCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="fxt-eyebrow">{label}</div>
      <div className="fxt-mono" style={{ fontSize: 14, color: "var(--color-ink)", fontWeight: 500, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

