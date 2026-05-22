"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/i18n";
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
  const { t } = useLanguage();
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

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("common.loading")}</div>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError(t("smartAdd.empty"));
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
        setError(t("scan.tooManyRequests"));
        setBusy(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error("/api/smart-add error", data);
        setError(t("scan.somethingWrong"));
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
      setError(t("scan.somethingWrong"));
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="fxt-eyebrow">{t("smartAdd.parsingEyebrow")}</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {t("smartAdd.parsingTitle")}
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
              {t("smartAdd.parsingDesc")}
            </div>
          </div>
        </Card>
        <Card padding={16}>
          <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>{t("smartAdd.youTyped")}</div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--color-ink)", lineHeight: 1.5 }}>
            \u201C{text}\u201D
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
          {t("smartAdd.backToAdd")}
        </Link>
      </div>

      <header>
        <div className="fxt-eyebrow">{t("smartAdd.eyebrow")}</div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 6px", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {t("smartAdd.title")}
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: 0, maxWidth: "56ch" }}>
          {t("smartAdd.description")}
        </p>
      </header>

      {error && <Alert tone="accent" title={t("smartAdd.errorTitle")}>{error}</Alert>}

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
              {t("smartAdd.describe")}
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
            {t("smartAdd.parse")}
          </Button>
        </form>
      </Card>

      <section>
        <div className="fxt-eyebrow" style={{ marginBottom: 10 }}>{t("smartAdd.examples")}</div>
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
              <span style={{ color: "var(--color-ink-3)", marginRight: 8 }} aria-hidden>\u201C</span>
              {ex}
              <span style={{ color: "var(--color-ink-3)", marginLeft: 4 }} aria-hidden>\u201D</span>
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
