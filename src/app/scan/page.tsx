"use client";
import { useSession } from "@/lib/session";
import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UploadBox from "@/components/UploadBox";
import { Card, Button, ButtonLink, Alert, SectionHeader } from "@/components/ui";
import type { SourceType } from "@/lib/types";

type Staged = { dataUri: string; sourceType: SourceType };

const SCAN_STEPS = [
  "Uploading image",
  "Reading receipt",
  "Extracting merchant and date",
  "Extracting amount and currency",
  "Detecting categories",
  "Preparing confirmation",
] as const;

const STEP_INTERVAL_MS = 900;

function ScanPageInner() {
  const session = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const tripId = search.get("tripId") || "";
  const partyId = search.get("partyId") || "";
  const queryParts: string[] = [];
  if (tripId) queryParts.push(`tripId=${encodeURIComponent(tripId)}`);
  if (partyId) queryParts.push(`partyId=${encodeURIComponent(partyId)}`);
  const queryString = queryParts.length ? `?${queryParts.join("&")}` : "";
  const manualHref = `/scan/confirm${queryString ? `${queryString}&manual=1` : "?manual=1"}`;

  const [staged, setStaged] = useState<Staged | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [fetchDone, setFetchDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => router.push(manualHref), 1800);
    return () => clearTimeout(t);
  }, [error, router, manualHref]);

  useEffect(() => {
    if (!busy) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    intervalRef.current = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, SCAN_STEPS.length - 2));
    }, STEP_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [busy]);

  function handleFile(dataUri: string, sourceType: SourceType) {
    setError(null);
    setStaged({ dataUri, sourceType });
  }

  async function analyze() {
    if (!staged || busy) return;
    setBusy(true);
    setError(null);
    setStepIndex(0);
    setFetchDone(false);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...staged, userId: session?.userId }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        console.error("/api/analyze 429", body);
        setError("You've made several requests recently. Please wait a moment and try again.");
        setBusy(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error("/api/analyze error", data);
        setError("Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(
        "fxt.pendingExpense",
        JSON.stringify({ analysis: data.analysis, imageUrl: data.imageUrl, sourceType: staged.sourceType }),
      );
      setFetchDone(true);
      setStepIndex(SCAN_STEPS.length - 1);
      setTimeout(() => router.push(`/scan/confirm${queryString}`), 400);
    } catch (err) {
      console.error("/api/analyze network error", err);
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (busy && staged) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="fxt-eyebrow">ANALYZING WITH AI</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          Reading your receipt…
        </h1>

        <Card padding={0} tone="soft">
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              background: "var(--color-bg-soft)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Image
              src={staged.dataUri}
              alt="Selected"
              width={800}
              height={800}
              unoptimized
              style={{ maxHeight: 220, width: "auto", objectFit: "contain", display: "block" }}
            />
          </div>
        </Card>

        <Card padding={0}>
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {SCAN_STEPS.map((label, i) => {
              const isDone = fetchDone ? true : i < stepIndex;
              const isActive = !fetchDone && i === stepIndex;
              return (
                <li
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i === 0 ? "0" : "1px solid var(--color-line-soft)",
                  }}
                >
                  <StepIcon state={isDone ? "done" : isActive ? "active" : "pending"} />
                  <span
                    style={{
                      fontSize: 14,
                      color: isDone ? "var(--color-ink-3)" : isActive ? "var(--color-ink)" : "var(--color-ink-3)",
                      fontWeight: isActive ? 500 : 400,
                      textDecoration: isDone ? "line-through" : "none",
                      textDecorationColor: isDone ? "var(--color-line)" : "transparent",
                    }}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
        <p style={{ fontSize: 12, color: "var(--color-ink-3)", textAlign: "center", margin: 0 }}>
          This usually takes 5–10 seconds.
        </p>
      </div>
    );
  }

  if (staged) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="fxt-eyebrow">REVIEW IMAGE</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          Looks right?
        </h1>

        {error && <Alert tone="amber" title="Couldn't analyze that image.">{error} Redirecting to manual entry…</Alert>}

        <Card padding={0} tone="soft">
          <div
            style={{
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              background: "var(--color-bg-soft)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Image
              src={staged.dataUri}
              alt="Selected"
              width={800}
              height={800}
              unoptimized
              style={{ maxHeight: 420, width: "auto", objectFit: "contain", display: "block" }}
            />
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button onClick={analyze} disabled={busy} variant="accent" size="lg" full>
            ✨ Analyze with AI
          </Button>
          <ButtonLink href={manualHref} variant="secondary" size="lg" full>
            Skip AI — enter manually
          </ButtonLink>
          <Button
            type="button"
            onClick={() => setStaged(null)}
            disabled={busy}
            variant="ghost"
            size="md"
            full
          >
            ← Choose a different image
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <header>
        <div className="fxt-eyebrow">ADD AN EXPENSE</div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 6px", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          How would you like to add this?
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: 0, maxWidth: "56ch" }}>
          Photos and screenshots go through AI. Smart Add parses one short line. Manual lets you fill the form yourself. Either way, you confirm before saving.
        </p>
      </header>

      <SectionHeader title="From an image" meta="AI EXTRACTS THE FIELDS" />
      <div style={{ display: "grid", gap: 10 }}>
        <UploadBox
          label="📷 Scan receipt"
          hint="Take a photo or pick a paper-receipt image"
          capture="environment"
          onFile={(uri) => handleFile(uri, "receipt")}
        />
        <UploadBox
          label="🖼️ Upload screenshot"
          hint="Apple Pay, Google Pay, banking apps, Alipay, WeChat Pay, online checkout"
          onFile={(uri) => handleFile(uri, "screenshot")}
        />
      </div>

      <SectionHeader title="By text" meta="WITHOUT AN IMAGE" />
      <div style={{ display: "grid", gap: 10 }}>
        <MethodLink
          href={`/scan/smart-add${queryString}`}
          icon="✨"
          title="Smart Add"
          hint="Type one short line. AI fills merchant, amount, payer, and split."
          accent
        />
        <MethodLink
          href={manualHref}
          icon="✏️"
          title="Manual Add"
          hint="Fill in every field yourself. No AI."
        />
      </div>
    </div>
  );
}

function MethodLink({
  href,
  icon,
  title,
  hint,
  accent = false,
}: {
  href: string;
  icon: string;
  title: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="fxt-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 18,
        background: accent ? "var(--color-accent-soft)" : "var(--color-surface)",
        border: `1px solid ${
          accent ? "color-mix(in oklch, var(--color-accent) 25%, var(--color-line))" : "var(--color-line)"
        }`,
        borderRadius: "var(--radius-xl)",
        color: "var(--color-ink)",
        textDecoration: "none",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: accent ? "color-mix(in oklch, var(--color-accent) 18%, var(--color-canvas))" : "var(--color-bg-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 16, lineHeight: 1.25 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-ink-2)", marginTop: 2, lineHeight: 1.4 }}>
          {hint}
        </div>
      </div>
      <span aria-hidden style={{ color: "var(--color-ink-3)", fontSize: 18 }}>›</span>
    </Link>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "var(--color-sage)",
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        ✓
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          border: "2px solid var(--color-line)",
          borderTopColor: "var(--color-accent)",
          animation: "spin 0.9s linear infinite",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 24,
        height: 24,
        borderRadius: 999,
        border: "2px solid var(--color-line-soft)",
        flexShrink: 0,
      }}
    />
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>}>
      <ScanPageInner />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Suspense>
  );
}
