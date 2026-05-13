"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { EXPENSE_CATEGORIES, type ExpenseRecord, type Party } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import ExpenseCard from "@/components/ExpenseCard";
import RefreshButton from "@/components/RefreshButton";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useCallback } from "react";

type DayGroup = {
  date: string;
  records: ExpenseRecord[];
  count: number;
  totalsByCurrency: Record<string, number>;
  baseTotal: number;
  baseCurrency: string | null;
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDayHeading(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

function groupByDate(records: ExpenseRecord[], baseCurrency: string): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const r of records) {
    const key = r.date || "—";
    let g = map.get(key);
    if (!g) {
      g = { date: key, records: [], count: 0, totalsByCurrency: {}, baseTotal: 0, baseCurrency };
      map.set(key, g);
    }
    g.records.push(r);
    g.count += 1;
    g.totalsByCurrency[r.currency] = (g.totalsByCurrency[r.currency] || 0) + r.amount;
    if (typeof r.baseAmount === "number" && r.baseCurrency === baseCurrency) {
      g.baseTotal += r.baseAmount;
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function HistoryInner() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [partyId, setPartyId] = useState<string>(params.get("partyId") || "");
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [user, setUser] = useState<string>("");

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    fetch(`/api/parties?userId=${encodeURIComponent(session.userId)}`)
      .then((r) => (r.ok ? r.json() : { parties: [] }))
      .then((b) => {
        const list = (b.parties as Party[]) || [];
        setParties(list);
        if (!partyId && list[0]) setPartyId(list[0].partyId);
      })
      .catch(() => {});
  }, [session, router, partyId]);

  const loadExpenses = useCallback(async (): Promise<void> => {
    if (!session || !partyId) return;
    try {
      const r = await fetch(`/api/expenses?familyId=${encodeURIComponent(partyId)}&baseCurrency=${encodeURIComponent(session.baseCurrency || "HKD")}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Failed to load");
      setRecords(body.records || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [session, partyId]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const { pulling, distance, refreshing, trigger } = usePullToRefresh(loadExpenses);

  const users = useMemo(
    () => Array.from(new Set(records.map((r) => r.payerName || r.userName))).filter(Boolean),
    [records],
  );

  const baseCurrency = session?.baseCurrency || "HKD";

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (category && r.category !== category) return false;
      if (user && (r.payerName || r.userName) !== user) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.merchant || ""} ${r.category} ${r.notes || ""} ${r.country || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, category, user, search]);

  const groups = useMemo(() => groupByDate(filtered, baseCurrency), [filtered, baseCurrency]);

  if (!session) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (error) return <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>;

  const hasAnyRecords = records.length > 0;
  const noMatch = hasAnyRecords && filtered.length === 0;

  return (
    <div className="space-y-4">
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <RefreshButton onClick={trigger} refreshing={refreshing} />
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input max-w-[14rem]" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
          <option value="">— Pick a group —</option>
          {parties.map((p) => <option key={p.partyId} value={p.partyId}>{p.partyName}</option>)}
        </select>
        <input className="input max-w-xs" placeholder="Search merchant / notes" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input max-w-[12rem]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-[12rem]" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">All members</option>
          {users.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {!hasAnyRecords ? (
        <EmptyState
          icon="📋"
          title="No expenses yet"
          description="Scan a receipt or add your first expense to see it grouped by day here."
          ctaHref="/scan"
          ctaLabel="Add an expense"
        />
      ) : noMatch ? (
        <EmptyState
          icon="🔍"
          title="No expenses match"
          description="Try clearing a filter or searching for a different merchant."
        />
      ) : (
        <ul className="space-y-4">
          {groups.map((g) => (
            <li key={g.date}>
              <DayHeader group={g} />
              <ul className="space-y-2 mt-2">
                {g.records.map((r) => <ExpenseCard key={r.id} record={r} baseCurrency={baseCurrency} />)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayHeader({ group }: { group: DayGroup }) {
  const currencyParts = Object.entries(group.totalsByCurrency);
  const primary = currencyParts.length === 1
    ? `${formatAmount(currencyParts[0][1])} ${currencyParts[0][0]}`
    : currencyParts.map(([cur, amt]) => `${formatAmount(amt)} ${cur}`).join(" · ");
  const showBase = group.baseTotal > 0 &&
    !(currencyParts.length === 1 && currencyParts[0][0] === group.baseCurrency);
  return (
    <div className="flex items-baseline justify-between gap-3 px-1">
      <div>
        <div className="text-sm font-semibold text-zinc-900">{formatDayHeading(group.date)}</div>
        <div className="text-xs text-zinc-500">{group.count} expense{group.count === 1 ? "" : "s"}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-zinc-900">{primary}</div>
        {showBase && group.baseCurrency && (
          <div className="text-xs text-zinc-500">≈ {formatAmount(group.baseTotal)} {group.baseCurrency}</div>
        )}
      </div>
    </div>
  );
}

export default function History() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
      <HistoryInner />
    </Suspense>
  );
}
