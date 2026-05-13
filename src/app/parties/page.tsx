"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Party } from "@/lib/types";
import EmptyState from "@/components/EmptyState";

export default function PartiesPage() {
  const router = useRouter();
  const session = useSession();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    fetch(`/api/parties?userId=${encodeURIComponent(session.userId)}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Failed to load groups");
        setParties(body.parties || []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !joinCode.trim()) return;
    setJoining(true);
    setJoinMsg(null);
    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, partyCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      setJoinMsg(`Joined "${data.party.partyName}"`);
      setJoinCode("");
      setParties((prev) => (prev.find((p) => p.partyId === data.party.partyId) ? prev : [...prev, data.party]));
    } catch (err) {
      setJoinMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setJoining(false);
    }
  }

  if (!session || loading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Your groups</h1>
          <p className="text-sm text-zinc-500">Hi {session.username} · Invite code <code className="bg-zinc-100 px-1.5 py-0.5 rounded">{session.inviteCode}</code></p>
        </div>
        <Link href="/parties/new" className="bg-zinc-900 text-white px-3 py-2 rounded-md text-sm">+ New group</Link>
      </div>

      {parties.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No groups yet"
          description="Create your first group to start tracking shared expenses, or join a public group below."
          ctaHref="/parties/new"
          ctaLabel="Create your first group"
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {parties.map((p) => (
            <li key={p.partyId}>
              <Link href={`/parties/${p.partyId}`} className="block p-4 rounded-xl border border-zinc-200 bg-white hover:border-zinc-400 transition">
                <div className="font-medium">{p.partyName}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {p.type === "public" ? `Public · code ${p.partyCode}` : "Private"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleJoin} className="space-y-2 max-w-sm">
        <h2 className="font-medium">Join a public group</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="Group code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={12} />
          <button type="submit" disabled={joining || !joinCode.trim()} className="px-3 py-2 rounded-md border border-zinc-300 bg-white disabled:opacity-50">
            {joining ? "Joining…" : "Join"}
          </button>
        </div>
        {joinMsg && <div className="text-xs text-zinc-600">{joinMsg}</div>}
      </form>
    </div>
  );
}
