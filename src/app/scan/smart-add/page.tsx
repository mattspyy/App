"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";

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

  if (!session) return <div className="text-sm text-zinc-500">Loading…</div>;

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Smart Add failed");
      sessionStorage.setItem(
        "fxt.pendingExpense",
        JSON.stringify({
          analysis: data.analysis,
          sourceType: "smart_add",
        }),
      );
      router.push(`/scan/confirm${confirmQuery}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <div className="text-xs text-zinc-500">
        <Link href={`/scan${confirmQuery}`} className="underline">Add expense</Link> /
      </div>
      <h1 className="text-2xl font-semibold">Smart Add</h1>
      <p className="text-sm text-zinc-500">
        Type one short line — merchant, amount, who paid, and who to split with.
        AI fills the rest; you review before saving.
      </p>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}

      <label className="block">
        <span className="text-xs text-zinc-600">Describe the spend</span>
        <textarea
          className="input mt-1 min-h-[7rem]"
          placeholder={PLACEHOLDER_EXAMPLES[0]}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          autoFocus
        />
      </label>

      <div className="text-xs text-zinc-500 space-y-1">
        <div className="font-medium text-zinc-600">Examples</div>
        <ul className="list-disc pl-4 space-y-0.5">
          {PLACEHOLDER_EXAMPLES.map((ex) => (
            <li key={ex}>
              <button
                type="button"
                onClick={() => setText(ex)}
                disabled={busy}
                className="text-left hover:text-zinc-900 underline decoration-dotted"
              >
                {ex}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="w-full p-4 rounded-xl bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition disabled:opacity-50"
      >
        {busy ? "Parsing with AI…" : "✨ Parse and review"}
      </button>
    </form>
  );
}

export default function SmartAddPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
      <SmartAddInner />
    </Suspense>
  );
}
