"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/i18n";
import type { Budget, ExpenseRecord, Party, Trip } from "@/lib/types";
import { sumConfirmedForMonth, findMonthlyBudget } from "@/lib/budget";
import { isConfirmed } from "@/lib/chartUtils";
import ExpenseCard from "@/components/ExpenseCard";
import MonthlyBudgetCard from "@/components/MonthlyBudgetCard";
import EmptyState from "@/components/EmptyState";
import { PageHeader, StatCard, ButtonLink, SectionHeader, Alert } from "@/components/ui";

const DEFAULT_BASE = "HKD";
const RECENT_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function isPersonalGroup(p: Party, userId: string): boolean {
  return p.type === "private" && p.createdBy === userId && p.partyName === "Personal";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isActiveTrip(tr: Trip, today: string): boolean {
  if (!tr.startDate && !tr.endDate) return false;
  if (tr.startDate && today < tr.startDate) return false;
  if (tr.endDate && today > tr.endDate) return false;
  return true;
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / DAY_MS);
}

// Recent ordering: newest expense date first, breaking ties by record creation time.
function byRecency(a: ExpenseRecord, b: ExpenseRecord): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const ca = a.createdAt || "";
  const cb = b.createdAt || "";
  return ca < cb ? 1 : ca > cb ? -1 : 0;
}

type GroupRecords = { groupId: string; records: ExpenseRecord[] };

export default function Dashboard() {
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<ExpenseRecord[]>([]);
  const [personalGroupId, setPersonalGroupId] = useState<string | null>(null);
  const [personalRecords, setPersonalRecords] = useState<ExpenseRecord[]>([]);
  const [personalBudget, setPersonalBudget] = useState<Budget | undefined>(undefined);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  const base = session?.baseCurrency || DEFAULT_BASE;

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.userId;
    setLoading(true);
    setError(null);
    try {
      const baseEnc = encodeURIComponent(base);
      // 1) Groups the user belongs to.
      const partiesRes = await fetch(`/api/parties?userId=${encodeURIComponent(uid)}`);
      const partiesBody = await partiesRes.json();
      if (!partiesRes.ok) throw new Error(partiesBody.error || "Failed to load groups");
      const groups: Party[] = partiesBody.parties || [];

      // 2) Expenses per group, fetched in parallel (client fan-out).
      const perGroup: GroupRecords[] = await Promise.all(
        groups.map((g) =>
          fetch(`/api/expenses?familyId=${encodeURIComponent(g.partyId)}&baseCurrency=${baseEnc}`)
            .then((r) => (r.ok ? r.json() : { records: [] }))
            .then((b) => ({ groupId: g.partyId, records: (b.records || []) as ExpenseRecord[] }))
            .catch(() => ({ groupId: g.partyId, records: [] as ExpenseRecord[] })),
        ),
      );
      setAllRecords(perGroup.flatMap((p) => p.records));

      // 3) Personal group: its records + monthly budget feed the budget bar.
      const personal = groups.find((g) => isPersonalGroup(g, uid)) || null;
      setPersonalGroupId(personal?.partyId ?? null);
      setPersonalRecords(
        personal ? perGroup.find((p) => p.groupId === personal.partyId)?.records || [] : [],
      );
      if (personal) {
        try {
          const bRes = await fetch(`/api/budgets?groupId=${encodeURIComponent(personal.partyId)}`);
          if (bRes.ok) {
            const bBody = await bRes.json();
            setPersonalBudget(findMonthlyBudget(bBody.budgets || [], personal.partyId));
          }
        } catch {
          // Budget is optional; ignore failures and render without the bar.
        }
      } else {
        setPersonalBudget(undefined);
      }

      // 4) Active trip (today within its date range).
      try {
        const tRes = await fetch(`/api/trips?userId=${encodeURIComponent(uid)}`);
        if (tRes.ok) {
          const tBody = await tRes.json();
          const trips: Trip[] = tBody.trips || [];
          const today = todayIso();
          setActiveTrip(trips.find((tr) => isActiveTrip(tr, today)) || null);
        }
      } catch {
        // Active trip is optional context; ignore failures.
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [session, base]);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    load();
  }, [session, router, load]);

  // "My" spending = expenses this user paid for, aggregated across all groups.
  const myRecords = useMemo(() => {
    if (!session) return [];
    return allRecords.filter((r) => (r.payerId ?? r.userId) === session.userId);
  }, [allRecords, session]);

  const now = useMemo(() => new Date(), []);
  const monthTotal = useMemo(
    () => sumConfirmedForMonth(myRecords, base, now.getFullYear(), now.getMonth()),
    [myRecords, base, now],
  );
  const monthCount = useMemo(
    () =>
      myRecords.filter((r) => {
        if (!isConfirmed(r)) return false;
        const d = new Date(r.date);
        return (
          !Number.isNaN(d.getTime()) &&
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      }).length,
    [myRecords, now],
  );
  const recent = useMemo(() => [...myRecords].sort(byRecency).slice(0, RECENT_LIMIT), [myRecords]);

  if (!session) {
    return <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>{t("states.loading")}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader eyebrow={t("home.eyebrow")} title={t("home.title")} description={t("home.subtitle")} />

      {error && <Alert tone="accent" title={t("common.unknownError")}>{error}</Alert>}

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>{t("states.loading")}</div>
      ) : (
        <>
          {/* SECTION 1 — This month total + monthly budget bar (personal group). */}
          <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <StatCard
              label={t("home.thisMonth")}
              value={`${monthTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${base}`}
              hint={t("home.expensesCountFmt", { count: monthCount })}
              tone="accent"
            />
            {personalGroupId && (
              <MonthlyBudgetCard
                groupId={personalGroupId}
                budget={personalBudget}
                records={personalRecords}
                baseCurrency={base}
                canEdit={false}
                userId={session.userId}
                onChange={load}
              />
            )}
          </section>

          {/* SECTION 2 — Recent expenses across all groups (last 5). */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionHeader
              title={t("home.recent")}
              action={
                <Link href="/history" style={{ color: "var(--color-ink-2)", textDecoration: "none", fontSize: 13 }}>
                  {t("home.viewAll")}
                </Link>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                title={t("home.recentEmptyTitle")}
                description={t("home.recentEmptyDesc")}
                ctaHref="/scan"
                ctaLabel={t("home.addExpense")}
              />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {recent.map((r) => (
                  <ExpenseCard key={r.id} record={r} baseCurrency={base} />
                ))}
              </ul>
            )}
          </section>

          {/* SECTION 3 — Active trip card (only when a trip is currently in range). */}
          {activeTrip && (
            <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <SectionHeader title={t("home.activeTrip")} />
              <ActiveTripCard trip={activeTrip} t={t} />
            </section>
          )}

          {/* SECTION 4 — Quick access to add an expense. */}
          <section>
            <ButtonLink href="/scan" variant="accent" size="lg" full>
              + {t("home.addExpense")}
            </ButtonLink>
          </section>

          {/* PLACEHOLDER — Balances / who-owes-what (proposal B1). Not implemented yet. */}
          {/* PLACEHOLDER — Quick Add inline entry (proposal A1). Not implemented yet. */}
        </>
      )}
    </div>
  );
}

function ActiveTripCard({ trip, t }: { trip: Trip; t: (k: string, v?: Record<string, string | number>) => string }) {
  const today = todayIso();
  let badge = "";
  if (trip.startDate && trip.endDate) {
    const total = daysBetween(trip.startDate, trip.endDate) + 1;
    const index = daysBetween(trip.startDate, today) + 1;
    badge = t("trips.dayProgressFmt", { index, total });
  }
  const range =
    trip.startDate && trip.endDate
      ? `${trip.startDate} → ${trip.endDate}`
      : trip.startDate || trip.endDate || "";
  return (
    <Link
      href={`/trips/${encodeURIComponent(trip.tripId)}`}
      className="fxt-focus"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: 18,
        background: "var(--color-sage-soft)",
        border: "1px solid color-mix(in oklch, var(--color-sage) 25%, var(--color-line))",
        borderRadius: "var(--radius-xl)",
        color: "var(--color-ink)",
        textDecoration: "none",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 17, lineHeight: 1.25 }}>
          {trip.destination || trip.tripName}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-ink-2)", marginTop: 2 }}>
          {trip.destination ? trip.tripName : range}
        </div>
        {badge && (
          <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
            {badge}
          </div>
        )}
      </div>
      <span aria-hidden style={{ color: "var(--color-ink-3)", fontSize: 18, flexShrink: 0 }}>
        {"›"}
      </span>
    </Link>
  );
}
