"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { Card, Button, Alert } from "@/components/ui";

const PLACEHOLDER_EXAMPLES = [
  "Coffee 42 cash",
  "Dinner 600 paid by Alex split with Ben and Chloe",
  "Hotel 1800 HKD yesterday Apple Pay",
  "Uber 28 last night",
];

function SmartAddInner() {
  const router = useRouter();
  const search = useSearchParams();
  const session = useSession();
  const tripId = search.get("tripId") || "";
  const partyId = search.get("partyId") || "";

  const queryParts: string[] = [];
  if (tripId) queryParts.push(`tripId=${encodeURIComponent(tripId)}`);
  if (partyId) queryParts.push(`partyId=${encodeURIComponent(partyId)}`);
  const confirmQuery = queryParts.length ? `?${queryParts.join("&")}` : "";

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Type a short description first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/smart-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          userId: session.userId,
          groupId: partyId || undefined,
          tripId: tripId || undefined,
          defaultCurrency: session.baseCurrency,
        }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        console.error("/api/smart-add 429", body);
        setError("You've made several requests recently. Please wait a moment and try again.");
        setBusy(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error("/api/smart-add error", data);
        setError("Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(
        "fxt.pendingExpense",
        JSON.stringify({
          analysis: data.analysis,
          hints: data.hints || undefined,
          sourceType: "smart_add",
        }),
      );
      router.push(`/scan/confirm${confirmQuery}`);
    } catch (err) {
      console.error("/api/smart-add network error", err);
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="fxt-eyebrow">PARSING WITH AI</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          Reading your line…
        </h1>
        <Card padding={18} tone="soft">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              aria-hidden
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "2px solid var(--color-line)",
                borderTopColor: "var(--color-accent)",
                animation: "spin 0.9s linear infinite",
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: 14, color: "var(--color-ink-2)" }}>
              Extracting merchant, amount, payer, and split. You&apos;ll confirm everything before saving.
            </div>
          </div>
        </Card>
        <Card padding={16}>
          <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>YOU TYPED</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--color-ink)", lineHeight: 1.5 }}>
            “{text}”
          </div>
        </Card>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
        <Link href={`/scan${confirmQuery}`} style={{ color: "var(--color-ink-2)", textDecoration: "none" }}>
          ← Add expense
        </Link>
      </div>

      <header>
        <div className="fxt-eyebrow">SMART ADD</div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 6px", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          Type one line, we&apos;ll fill the form.
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: 0, maxWidth: "56ch" }}>
          Mention merchant, amount, who paid, and who to split with. AI fills the rest — you review every field before saving.
        </p>
      </header>

      {error && <Alert tone="accent" title="That didn't work.">{error}</Alert>}

      <Card padding={18}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              Describe the spend
            </span>
            <textarea
              className="fxt-focus"
              placeholder={PLACEHOLDER_EXAMPLES[0]}
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              autoFocus
              style={{
                width: "100%",
                minHeight: "8rem",
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
              {text.length}/500
            </span>
          </div>

          <Button type="submit" disabled={busy || !text.trim()} variant="accent" size="lg" full>
            ✨ Parse and review
          </Button>
        </form>
      </Card>

      <section>
        <div className="fxt-eyebrow" style={{ marginBottom: 10 }}>EXAMPLES</div>
        <div style={{ display: "grid", gap: 8 }}>
          {PLACEHOLDER_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              disabled={busy}
              className="fxt-focus"
              style={{
                textAlign: "left",
                padding: "12px 14px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-serif)",
                fontSize: 14,
                color: "var(--color-ink)",
                cursor: "pointer",
                transition: "border-color 120ms ease, background 120ms ease",
              }}
            >
              <span style={{ color: "var(--color-ink-3)", marginRight: 8 }} aria-hidden>“</span>
              {ex}
              <span style={{ color: "var(--color-ink-3)", marginLeft: 4 }} aria-hidden>”</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function SmartAddPage() {
  return (
    <Suspense fallback={<div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>}>
      <SmartAddInner />
    </Suspense>
  );
}
