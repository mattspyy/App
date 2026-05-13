"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import UploadBox from "@/components/UploadBox";
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
        body: JSON.stringify(staged),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      sessionStorage.setItem(
        "fxt.pendingExpense",
        JSON.stringify({ analysis: data.analysis, imageUrl: data.imageUrl, sourceType: staged.sourceType }),
      );
      setFetchDone(true);
      setStepIndex(SCAN_STEPS.length - 1);
      setTimeout(() => router.push(`/scan/confirm${queryString}`), 400);
    } catch {
      setError("AI analysis failed. Please fill in manually.");
      setBusy(false);
    }
  }

  if (busy && staged) {
    return (
      <div className="space-y-5 max-w-xl">
        <h1 className="text-xl font-semibold">Analyzing with AI…</h1>
        <div className="border rounded-xl overflow-hidden bg-zinc-50 flex justify-center">
          <Image
            src={staged.dataUri}
            alt="Selected"
            width={800}
            height={800}
            unoptimized
            className="max-h-56 w-auto object-contain"
          />
        </div>
        <ol className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 text-sm">
          {SCAN_STEPS.map((label, i) => {
            const isDone = fetchDone ? true : i < stepIndex;
            const isActive = !fetchDone && i === stepIndex;
            return (
              <li key={label} className="flex items-center gap-3 px-4 py-3">
                <StepIcon state={isDone ? "done" : isActive ? "active" : "pending"} />
                <span className={isDone ? "text-zinc-500 line-through decoration-zinc-300" : isActive ? "text-zinc-900 font-medium" : "text-zinc-400"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-xs text-zinc-500 text-center">This usually takes 5–10 seconds.</p>
      </div>
    );
  }

  if (staged) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Review image</h1>
        {error && (
          <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded border border-amber-200">
            {error} Redirecting to manual entry…
          </div>
        )}
        <div className="border rounded-xl overflow-hidden bg-zinc-50 flex justify-center">
          <Image
            src={staged.dataUri}
            alt="Selected"
            width={800}
            height={800}
            unoptimized
            className="max-h-96 w-auto object-contain"
          />
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={analyze}
            disabled={busy}
            className="w-full p-4 rounded-xl bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition disabled:opacity-50"
          >
            ✨ Analyze with AI
          </button>
          <Link
            href={manualHref}
            className="w-full p-4 rounded-xl border border-zinc-300 bg-white text-center font-medium hover:bg-zinc-50 transition"
          >
            Skip AI — enter manually
          </Link>
          <button
            type="button"
            onClick={() => setStaged(null)}
            disabled={busy}
            className="w-full p-3 text-sm text-zinc-600 hover:text-zinc-900 transition disabled:opacity-50"
          >
            ← Choose a different image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">Add expense</h1>
      <p className="text-sm text-zinc-500">Pick an image, then choose to analyze with AI or enter manually.</p>
      <div className="grid gap-3">
        <UploadBox
          label="📷 Scan receipt"
          hint="Take a photo or pick a paper-receipt image"
          capture="environment"
          onFile={(uri) => handleFile(uri, "receipt")}
        />
        <UploadBox
          label="🖼️ Upload screenshot / payment image"
          hint="Apple Pay, Google Pay, banking app, Alipay, WeChat Pay, online checkout — anything"
          onFile={(uri) => handleFile(uri, "screenshot")}
        />
        <Link
          href={manualHref}
          className="block w-full p-6 border-2 border-zinc-300 rounded-xl text-center bg-white hover:bg-zinc-50 transition"
        >
          <div className="text-base font-medium">✏️ Manual add</div>
          <div className="text-xs text-zinc-500 mt-1">Enter expense details by hand</div>
        </Link>
      </div>
    </div>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs shrink-0">
        ✓
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin shrink-0" aria-hidden />
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-zinc-200 text-zinc-300 text-xs shrink-0">
      ○
    </span>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
      <ScanPageInner />
    </Suspense>
  );
}
