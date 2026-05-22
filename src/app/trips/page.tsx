"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Trip } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { PageHeader, ButtonLink, Badge, Alert, SectionHeader } from "@/components/ui";
import { useLanguage, type TranslateFn } from "@/lib/i18n";

const DAY_MS = 24 * 60 * 60 * 1000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / DAY_MS);
}

type Bucket = "upcoming" | "active" | "past" | "undated";

function bucketFor(t: Trip): Bucket {
  if (!t.startDate && !t.endDate) return "undated";
  const today = todayIso();
  if (t.startDate && today < t.startDate) return "upcoming";
  if (t.endDate && today > t.endDate) return "past";
  return "active";
}

function dayBadge(trip: Trip, t: TranslateFn): { label: string; tone: "accent" | "sage" | "amber" | "neutral" } {
  const today = todayIso();
  if (trip.startDate && today < trip.startDate) {
    return { label: t("trips.dayInFmt", { n: daysBetween(today, trip.startDate) }), tone: "amber" };
  }
  if (trip.endDate && today > trip.endDate) {
    return { label: t("trips.dayAgoFmt", { n: daysBetween(trip.endDate, today) }), tone: "neutral" };
  }
  if (trip.startDate && trip.endDate) {
    const totalDays = daysBetween(trip.startDate, trip.endDate) + 1;
    const dayIndex = daysBetween(trip.startDate, today) + 1;
    return { label: t("trips.dayProgressFmt", { index: dayIndex, total: totalDays }), tone: "sage" };
  }
  return { label: t("trips.noDates"), tone: "neutral" };
}

function formatRange(start: string | undefined, end: string | undefined, t: TranslateFn): string {
  if (start && end) return `${start} → ${end}`;
  if (start) return `${start} →`;
  if (end) return `→ ${end}`;
  return t("trips.datesNotSet");
}

export default function TripsPage() {
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    fetch(`/api/trips?userId=${encodeURIComponent(session.userId)}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Failed to load");
        setTrips(body.trips || []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router]);

  async function handleDelete(trip: Trip) {
    if (!session) return;
    const ok = confirm(
      t("trips.deleteConfirmFmt", { name: trip.tripName }),
    );
    if (!ok) return;
    setDeletingId(trip.tripId);
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(trip.tripId)}?userId=${encodeURIComponent(session.userId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete trip");
      setTrips((prev) => prev.filter((t) => t.tripId !== trip.tripId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<Bucket, Trip[]> = { active: [], upcoming: [], past: [], undated: [] };
    for (const t of trips) map[bucketFor(t)].push(t);
    return map;
  }, [trips]);

  if (!session || loading) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("states.loading")}</div>;
  if (error) return <Alert tone="accent" title={t("errors.couldntLoadTrips")}>{error}</Alert>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow={t("trips.eyebrow")}
        title={<>{t("trips.title")} <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>{t("trips.titleAccent")}</em></>}
        description={t("trips.description")}
        actions={
          <ButtonLink href="/trips/new" variant="accent" size="md">
            {t("trips.newTrip")}
          </ButtonLink>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          icon="✈️"
          title={t("trips.emptyTitle")}
          description={t("trips.emptyDesc")}
          ctaHref="/trips/new"
          ctaLabel={t("actions.createFirstTrip")}
        />
      ) : (
        <>
          {grouped.active.length > 0 && (
            <Section label={t("trips.bucketActive")} meta={`${grouped.active.length} TRIP${grouped.active.length === 1 ? "" : "S"}`}>
              {grouped.active.map((t) => (
                <TripCard
                  key={t.tripId}
                  trip={t}
                  onDelete={() => handleDelete(t)}
                  deleting={deletingId === t.tripId}
                />
              ))}
            </Section>
          )}
          {grouped.upcoming.length > 0 && (
            <Section label={t("trips.bucketUpcoming")} meta={`${grouped.upcoming.length} TRIP${grouped.upcoming.length === 1 ? "" : "S"}`}>
              {grouped.upcoming.map((t) => (
                <TripCard
                  key={t.tripId}
                  trip={t}
                  onDelete={() => handleDelete(t)}
                  deleting={deletingId === t.tripId}
                />
              ))}
            </Section>
          )}
          {grouped.past.length > 0 && (
            <Section label={t("trips.bucketPast")} meta={`${grouped.past.length} TRIP${grouped.past.length === 1 ? "" : "S"}`}>
              {grouped.past.map((t) => (
                <TripCard
                  key={t.tripId}
                  trip={t}
                  onDelete={() => handleDelete(t)}
                  deleting={deletingId === t.tripId}
                />
              ))}
            </Section>
          )}
          {grouped.undated.length > 0 && (
            <Section label={t("trips.bucketUndated")} meta={`${grouped.undated.length} TRIP${grouped.undated.length === 1 ? "" : "S"}`}>
              {grouped.undated.map((t) => (
                <TripCard
                  key={t.tripId}
                  trip={t}
                  onDelete={() => handleDelete(t)}
                  deleting={deletingId === t.tripId}
                />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, meta, children }: { label: string; meta?: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionHeader title={label} meta={meta} />
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {children}
      </ul>
    </section>
  );
}

function TripCard({ trip, onDelete, deleting }: { trip: Trip; onDelete: () => void; deleting: boolean }) {
  const { t } = useLanguage();
  const day = dayBadge(trip, t);
  return (
    <li style={{ position: "relative" }}>
      <Link
        href={`/trips/${trip.tripId}`}
        className="fxt-focus"
        style={{
          display: "block",
          textDecoration: "none",
          color: "var(--color-ink)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-xl)",
          padding: 18,
          paddingRight: 44,
          transition: "border-color 120ms ease, transform 120ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="fxt-eyebrow" style={{ marginBottom: 6 }}>
              {trip.destination ? trip.destination.toUpperCase() : ""}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                lineHeight: 1.15,
                color: "var(--color-ink)",
                letterSpacing: "-0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {trip.tripName}
            </div>
            <div className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 6, letterSpacing: "0.04em" }}>
              {formatRange(trip.startDate, trip.endDate, t).toUpperCase()}
            </div>
          </div>
          <Badge tone={day.tone} size="sm">{day.label}</Badge>
        </div>
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--color-line-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            fontSize: 12,
            color: "var(--color-ink-2)",
          }}
        >
          <span>{t("trips.base")} <strong className="fxt-mono" style={{ color: "var(--color-ink)" }}>{trip.baseCurrency}</strong></span>
          {typeof trip.budget === "number" ? (
            <span className="fxt-mono" style={{ color: "var(--color-ink-3)" }}>
              {t("trips.budgetPrefix")} {trip.budget.toLocaleString()}
            </span>
          ) : (
            <span style={{ color: "var(--color-ink-3)" }}>{t("trips.noBudget")}</span>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={t("trips.deleteAria", { name: trip.tripName })}
        className="fxt-focus"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--color-ink-3)",
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={t("trips.deleteTitle")}
      >
        {deleting ? "…" : "✕"}
      </button>
    </li>
  );
}
