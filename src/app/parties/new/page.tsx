"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Party } from "@/lib/types";

export default function NewPartyPage() {
  const router = useRouter();
  const session = useSession();
  const [partyName, setPartyName] = useState("");
  const [type, setType] = useState<"private" | "public">("private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, partyName: partyName.trim(), type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      const party = data.party as Party;
      router.push(`/parties/${party.partyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return <div className="text-sm text-zinc-500">Loading…</div>;

  const templates: Array<{ icon: string; label: string; name: string }> = [
    { icon: "👤", label: "Personal", name: "Personal" },
    { icon: "👨‍👩‍👧", label: "Family", name: "My Family" },
    { icon: "👫", label: "Friends", name: "Friends" },
    { icon: "✈️", label: "Travel", name: "Travel Group" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <h1 className="text-2xl font-semibold">New group</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}

      <section>
        <div className="text-xs text-zinc-600 mb-2">Quick start</div>
        <div className="grid grid-cols-2 gap-2">
          {templates.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setPartyName(t.name)}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50 text-sm text-left"
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">Group name</div>
        <input className="input" value={partyName} onChange={(e) => setPartyName(e.target.value)} required />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs text-zinc-600 mb-1">Type</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="type" value="private" checked={type === "private"} onChange={() => setType("private")} className="mt-1" />
          <span><span className="font-medium">Private.</span> Only you (admin) can add members by entering their invite code.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="type" value="public" checked={type === "public"} onChange={() => setType("public")} className="mt-1" />
          <span><span className="font-medium">Public.</span> Generates a group code; anyone with the code can join.</span>
        </label>
      </fieldset>

      <button type="submit" disabled={submitting || !partyName.trim()} className="bg-zinc-900 text-white px-4 py-2 rounded-md disabled:opacity-50">
        {submitting ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
