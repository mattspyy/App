"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Trip } from "@/lib/types";
import EmptyState from "@/components/EmptyState";

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
    const ok = confirm(`Delete trip "${trip.tripName}"? The trip will be archived in Notion (restorable from Notion if needed). Expenses are not deleted and will reference the archived trip ID.`);
    if (!ok) return;
    setDeletingId(trip.tripId);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(trip.tripId)}?userId=${encodeURIComponent(session.userId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete trip");
      setTrips((prev) => prev.filter((t) => t.tripId !== trip.tripId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeletingId(null);
    }
  }

  if (!session || loading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-semibold">Trips</h1>
        <Link href="/trips/new" className="bg-zinc-900 text-white px-3 py-2 rounded-md text-sm">+ New trip</Link>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon="✈️"
          title="No trips yet"
          description="Create your first trip to start tracking expenses on the go."
          ctaHref="/trips/new"
          ctaLabel="Create your first trip"
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {trips.map((t) => (
            <li key={t.tripId} className="relative">
              <Link
                href={`/trips/${t.tripId}`}
                className="block p-4 pr-12 rounded-xl border border-zinc-200 bg-white hover:border-zinc-400 transition"
              >
                <div className="font-medium">{t.tripName}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {t.destination ? `${t.destination} · ` : ""}
                  {t.startDate || "?"} → {t.endDate || "?"}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  Base: {t.baseCurrency}{typeof t.budget === "number" ? ` · Budget ${t.budget.toLocaleString()}` : ""}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(t)}
                disabled={deletingId === t.tripId}
                aria-label={`Delete trip ${t.tripName}`}
                className="absolute top-3 right-3 text-zinc-400 hover:text-red-600 disabled:opacity-50 text-sm px-2 py-1"
              >
                {deletingId === t.tripId ? "…" : "✕"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
