"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Budget, ExpenseRecord, Party, PartyMember } from "@/lib/types";
import { onlyConfirmed } from "@/lib/chartUtils";
import { findMonthlyBudget } from "@/lib/budget";
import MonthlyBudgetCard from "@/components/MonthlyBudgetCard";
import DashboardCards from "@/components/DashboardCards";
import CategoryPieChart from "@/components/CategoryPieChart";
import SpendingLineChart from "@/components/SpendingLineChart";
import UserBarChart from "@/components/UserBarChart";
import RecordsTable from "@/components/RecordsTable";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import RefreshButton from "@/components/RefreshButton";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useCallback } from "react";

export default function PartyDashboardPage() {
  const params = useParams<{ partyId: string }>();
  const partyId = params?.partyId;
  const router = useRouter();
  const session = useSession();
  const [party, setParty] = useState<Party | null>(null);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  const load = useCallback(async (): Promise<void> => {
    if (!session || !partyId) return;
    const family = encodeURIComponent(partyId);
    const base = encodeURIComponent(session.baseCurrency || "HKD");
    try {
      const [p, e, m, b] = await Promise.all([
        fetch(`/api/parties?userId=${encodeURIComponent(session.userId)}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/expenses?familyId=${family}&baseCurrency=${base}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/parties/${encodeURIComponent(partyId)}/members?userId=${encodeURIComponent(session.userId)}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/budgets?groupId=${family}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
      ]);
      if (!p.ok) throw new Error(p.body.error || "Failed to load groups");
      const list = (p.body.parties as Party[]) || [];
      const me = list.find((q) => q.partyId === partyId) || null;
      if (!me) throw new Error("Group not found or you are not a member");
      setParty(me);
      if (!e.ok) throw new Error(e.body.error || "Failed to load expenses");
      setRecords(e.body.records || []);
      if (m.ok) setMembers(m.body.members || []);
      if (b.ok) setBudgets(b.body.budgets || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [session, partyId]);

  useEffect(() => {
    load();
  }, [load]);

  const { pulling, distance, refreshing, trigger } = usePullToRefresh(load);

  const baseCurrency = session?.baseCurrency || "HKD";
  const isAdmin = useMemo(() => !!(party && session && party.createdBy === session.userId), [party, session]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !party) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, partyId: party.partyId, inviteCode: inviteCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setInviteMsg(`Added ${data.added.username}`);
      setInviteCode("");
      const m = await fetch(`/api/parties/${encodeURIComponent(party.partyId)}/members?userId=${encodeURIComponent(session.userId)}`);
      if (m.ok) {
        const body = await m.json();
        setMembers(body.members || []);
      }
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete() {
    if (!session || !party) return;
    const ok = confirm(`Delete group "${party.partyName}"? Member list will be removed from Supabase. Expenses in Notion are not deleted and will remain referencing this group ID. This cannot be undone.`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/parties/${encodeURIComponent(party.partyId)}?userId=${encodeURIComponent(session.userId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete group");
      router.replace("/parties");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setDeleting(false);
    }
  }

  if (!session || loading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;
  if (!party) return <div className="text-sm text-zinc-500">Group not found.</div>;

  return (
    <div className="space-y-6">
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-zinc-500">
            <Link href="/parties" className="underline">Groups</Link> /
          </div>
          <h1 className="text-2xl font-semibold">{party.partyName}</h1>
          <p className="text-sm text-zinc-500">
            {party.type === "public" ? `Public · code ${party.partyCode}` : "Private"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onClick={trigger} refreshing={refreshing} />
          <Link
            href={`/scan?partyId=${encodeURIComponent(party.partyId)}`}
            className="bg-zinc-900 text-white px-3 py-2 rounded-md text-sm"
          >
            + Add expense
          </Link>
        </div>
      </div>

      <section>
        <h2 className="font-medium mb-2">Members ({members.length})</h2>
        <ul className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100 text-sm">
          {members.map((m) => (
            <li key={m.userId} className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 min-w-0">
                <Avatar name={m.username} size={26} />
                <span className="truncate">{m.username}</span>
              </span>
              <code className="text-xs text-zinc-500 shrink-0">{m.inviteCode}</code>
            </li>
          ))}
        </ul>
        {isAdmin && party.type === "private" && (
          <form onSubmit={handleInvite} className="flex gap-2 mt-3 max-w-sm">
            <input className="input" placeholder="Invite code (6 chars)" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} maxLength={12} />
            <button type="submit" disabled={inviting || !inviteCode.trim()} className="px-3 py-2 rounded-md border border-zinc-300 bg-white disabled:opacity-50">
              {inviting ? "Adding…" : "Invite"}
            </button>
          </form>
        )}
        {inviteMsg && <div className="text-xs text-zinc-600 mt-2">{inviteMsg}</div>}
      </section>

      <MonthlyBudgetCard
        groupId={party.partyId}
        budget={findMonthlyBudget(budgets, party.partyId)}
        records={records}
        baseCurrency={baseCurrency}
        canEdit={isAdmin}
        userId={session.userId}
        onChange={load}
      />

      {records.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No expenses yet"
          description="Scan a receipt or add your first expense to this group."
          ctaHref={`/scan?partyId=${encodeURIComponent(party.partyId)}`}
          ctaLabel="Add the first expense"
        />
      ) : (
        <>
          <DashboardCards records={onlyConfirmed(records)} baseCurrency={baseCurrency} />
          <div className="grid md:grid-cols-2 gap-4">
            <CategoryPieChart records={onlyConfirmed(records)} />
            <UserBarChart records={onlyConfirmed(records)} />
          </div>
          <SpendingLineChart records={onlyConfirmed(records)} />
          <RecordsTable records={records.slice(0, 20)} baseCurrency={baseCurrency} />
        </>
      )}

      {isAdmin && (
        <section className="pt-6 border-t border-zinc-200">
          <h2 className="font-medium text-zinc-900 mb-1">Danger zone</h2>
          <p className="text-xs text-zinc-500 mb-3">
            Deleting this group removes it from Supabase. Expenses in Notion stay but will reference a deleted group ID.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm border border-red-300 text-red-700 bg-white hover:bg-red-50 px-3 py-2 rounded-md disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete group"}
          </button>
        </section>
      )}
    </div>
  );
}
