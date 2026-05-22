"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Trip } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import { PageHeader, ButtonLink, Badge, Alert, SectionHeader } from "@/components/ui";

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

function dayBadge(t: Trip): { label: string; tone: "accent" | "sage" | "amber" | "neutral" } {
  const today = todayIso();
  if (t.startDate && today < t.startDate) {
    return { label: `In ${daysBetween(today, t.startDate)} d`, tone: "amber" };
  }
  if (t.endDate && today > t.endDate) {
    return { label: `${daysBetween(t.endDate, today)} d ago`, tone: "neutral" };
  }
  if (t.startDate && t.endDate) {
    const totalDays = daysBetween(t.startDate, t.endDate) + 1;
    const dayIndex = daysBetween(t.startDate, today) + 1;
    return { label: `Day ${dayIndex}/${totalDays}`, tone: "sage" };
  }
  return { label: "No dates", tone: "neutral" };
}

function formatRange(start?: string, end?: string): string {
  if (start && end) return `${start} → ${end}`;
  if (start) return `${start} →`;
  if (end) return `→ ${end}`;
  return "Dates not set";
}

export default function TripsPage() {
  const router = useRouter();
  const session = useSession();
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
      `Delete trip "${trip.tripName}"? The trip will be archived in Notion (restorable from Notion if needed). Expenses are not deleted and will reference the archived trip ID.`,
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

  if (!session || loading) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;
  if (error) return <Alert tone="accent" title="Couldn't load trips.">{error}</Alert>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="TRAVEL · SHARED HOUSE · WEEKEND"
        title={<>Your <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>trips</em></>}
        description="A trip is a travel-specific space inside a group — same expenses, different bucket."
        actions={
          <ButtonLink href="/trips/new" variant="accent" size="md">
            + New trip
          </ButtonLink>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          icon="✈️"
          title="No trips yet"
          description="Create your first trip to start tracking expenses on the go."
          ctaHref="/trips/new"
          ctaLabel="Create your first trip"
        />
      ) : (
        <>
          {grouped.active.length > 0 && (
            <Section label="Active now" meta={`${grouped.active.length} TRIP${grouped.active.length === 1 ? "" : "S"}`}>
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
            <Section label="Upcoming" meta={`${grouped.upcoming.length} TRIP${grouped.upcoming.length === 1 ? "" : "S"}`}>
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
            <Section label="Past" meta={`${grouped.past.length} TRIP${grouped.past.length === 1 ? "" : "S"}`}>
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
            <Section label="No dates" meta={`${grouped.undated.length} TRIP${grouped.undated.length === 1 ? "" : "S"}`}>
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
  const day = dayBadge(trip);
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
              {trip.destination ? trip.destination.toUpperCase() : "TRIP"}
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
              {formatRange(trip.startDate, trip.endDate).toUpperCase()}
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
          <span>Base <strong className="fxt-mono" style={{ color: "var(--color-ink)" }}>{trip.baseCurrency}</strong></span>
          {typeof trip.budget === "number" ? (
            <span className="fxt-mono" style={{ color: "var(--color-ink-3)" }}>
              BUDGET {trip.budget.toLocaleString()}
            </span>
          ) : (
            <span style={{ color: "var(--color-ink-3)" }}>No budget</span>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label={`Delete trip ${trip.tripName}`}
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
        title="Delete trip"
      >
        {deleting ? "…" : "✕"}
      </button>
    </li>
  );
}
