"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { CURRENCIES, type Trip } from "@/lib/types";
import { detectCurrency } from "@/lib/destinationCurrency";
import { Card, Button, TextField, Alert, SectionHeader, Badge } from "@/components/ui";

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
      setBaseCurrency((cur) => (cur === "USD" ? session.baseCurrency || "USD" : cur));
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

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;

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
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 640, margin: "0 auto" }}>
      <header>
        <div className="fxt-eyebrow">NEW TRIP</div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 6px", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          A new place to <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>track</em> things.
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: 0, maxWidth: "56ch" }}>
          Give your trip a name and dates. The rest is optional — fill in budget and currency now or later.
        </p>
      </header>

      {error && <Alert tone="accent" title="Couldn't create the trip.">{error}</Alert>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section>
          <SectionHeader title="The basics" />
          <Card padding={18}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <TextField
                label="Trip name"
                placeholder="e.g. Kyoto weekend"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                required
                autoFocus
              />
              <TextField
                label="Destination"
                placeholder="e.g. Tokyo, Japan"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onBlur={handleDestinationBlur}
                helper={detectedHint ? `Detected currency: ${detectedHint}.` : undefined}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <DateField label="Start date" value={startDate} onChange={setStartDate} />
                <DateField label="End date" value={endDate} onChange={setEndDate} />
              </div>
            </div>
          </Card>
        </section>

        <section>
          <SectionHeader title="Money" meta="OPTIONAL" />
          <Card padding={18}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  htmlFor="trip-currency"
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-ink-3)",
                    marginBottom: 6,
                  }}
                >
                  Base currency
                </label>
                <div
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "var(--radius-md)",
                    padding: "0 12px",
                  }}
                >
                  <select
                    id="trip-currency"
                    className="fxt-focus"
                    value={baseCurrency}
                    onChange={(e) => {
                      setBaseCurrency(e.target.value);
                      setCurrencyTouched(true);
                      setDetectedHint(null);
                    }}
                    style={{
                      appearance: "none",
                      width: "100%",
                      background: "transparent",
                      border: 0,
                      padding: "12px 0",
                      fontSize: 15,
                      fontFamily: "var(--font-sans)",
                      color: "var(--color-ink)",
                      outline: "none",
                    }}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {detectedHint && (
                  <div style={{ marginTop: 8 }}>
                    <Badge tone="sage" size="sm">Detected {detectedHint}</Badge>
                  </div>
                )}
              </div>
              <TextField
                label="Budget"
                placeholder="e.g. 2000"
                inputMode="decimal"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                helper={`In ${baseCurrency}. Leave empty if you don't want one.`}
              />
            </div>
          </Card>
        </section>

        <section>
          <SectionHeader title="Notes" meta="OPTIONAL" />
          <Card padding={18}>
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-3)",
                  marginBottom: 6,
                }}
              >
                Anything to remember
              </span>
              <textarea
                className="fxt-focus"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hotel booking ref, meeting points, etc."
                style={{
                  width: "100%",
                  minHeight: 88,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  fontSize: 15,
                  lineHeight: 1.5,
                  fontFamily: "var(--font-sans)",
                  color: "var(--color-ink)",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </label>
          </Card>
        </section>

        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <Button type="submit" disabled={submitting} variant="accent" size="lg">
            {submitting ? "Creating…" : "Create trip"}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <input
        className="fxt-focus"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          display: "block",
          width: "100%",
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-md)",
          padding: "10px 12px",
          fontSize: 14,
          fontFamily: "var(--font-sans)",
          color: "var(--color-ink)",
          outline: "none",
        }}
      />
    </label>
  );
}
