"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { CURRENCIES, type Trip } from "@/lib/types";
import { detectCurrency } from "@/lib/destinationCurrency";

export default function NewTripPage() {
  const router = useRouter();
  const session = useSession();
  const [tripName, setTripName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<string>(() => session?.baseCurrency || "USD");
  const [detectedHint, setDetectedHint] = useState<string | null>(null);
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  useEffect(() => {
    if (session && !currencyTouched) {
      setBaseCurrency((cur) => cur === "USD" ? session.baseCurrency || "USD" : cur);
    }
  }, [session, currencyTouched]);

  function handleDestinationBlur() {
    if (currencyTouched) return;
    const detected = detectCurrency(destination);
    if (detected && detected !== baseCurrency) {
      setBaseCurrency(detected);
      setDetectedHint(detected);
    } else if (detected) {
      setDetectedHint(detected);
    } else {
      setDetectedHint(null);
    }
  }

  if (!session) return <div className="text-sm text-zinc-500">Loading…</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (!tripName.trim()) {
      setError("Trip name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Partial<Trip> = {
        tripName: tripName.trim(),
        destination: destination.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        baseCurrency,
        budget: budget ? Number(budget) : undefined,
        createdBy: session.userId,
        createdByName: session.username,
        notes: notes.trim() || undefined,
      };
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create trip");
      router.push(`/trips/${data.trip.tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">New trip</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}

      <Field label="Trip name"><input className="input" value={tripName} onChange={(e) => setTripName(e.target.value)} required /></Field>
      <Field label="Destination"><input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} onBlur={handleDestinationBlur} placeholder="e.g. Tokyo, Japan" /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start date"><input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
        <Field label="End date"><input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Base currency">
          <select
            className="input"
            value={baseCurrency}
            onChange={(e) => { setBaseCurrency(e.target.value); setCurrencyTouched(true); setDetectedHint(null); }}
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {detectedHint && (
            <div className="text-xs text-emerald-700 mt-1">Detected: {detectedHint}</div>
          )}
        </Field>
        <Field label="Budget (optional)"><input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 2000" /></Field>
      </div>

      <Field label="Notes"><textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>

      <button type="submit" disabled={submitting} className="bg-zinc-900 text-white px-4 py-2 rounded-md disabled:opacity-50">
        {submitting ? "Creating…" : "Create trip"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-600 mb-1">{label}</div>
      {children}
    </label>
  );
}
