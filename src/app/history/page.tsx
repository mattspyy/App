"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { EXPENSE_CATEGORIES, type ExpenseRecord, type Party } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import ExpenseCard from "@/components/ExpenseCard";
import RefreshButton from "@/components/RefreshButton";
import PullToRefreshIndicator from "@/components/PullToRefreshIndicator";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PageHeader, SelectChip, TextField, Card, Alert, Badge } from "@/components/ui";
import { useLanguage, categoryLabel } from "@/lib/i18n";

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
  return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
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
  const { t, language } = useLanguage();
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
      const r = await fetch(
        `/api/expenses?familyId=${encodeURIComponent(partyId)}&baseCurrency=${encodeURIComponent(session.baseCurrency || "HKD")}`,
      );
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

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("states.loading")}</div>;
  if (error)
    return (
      <Alert tone="accent" title={t("errors.couldntLoadExpenses")}>
        {error}
      </Alert>
    );

  const hasAnyRecords = records.length > 0;
  const noMatch = hasAnyRecords && filtered.length === 0;

  const filteredTotal = filtered.reduce((s, r) => {
    if (typeof r.baseAmount === "number" && r.baseCurrency === baseCurrency) return s + r.baseAmount;
    return s;
  }, 0);

  const currentGroupName = parties.find((p) => p.partyId === partyId)?.partyName;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />

      <PageHeader
        eyebrow={currentGroupName ? t("history.headerInGroupFmt", { name: currentGroupName.toUpperCase() }) : t("history.headerEyebrow")}
        title={<>{t("history.title")} <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>{t("history.titleAccent")}</em></>}
        description={t("history.description")}
        actions={<RefreshButton onClick={trigger} refreshing={refreshing} />}
      />

      <Card padding={16} tone="soft">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 220px", minWidth: 220 }}>
            <TextField
              label={t("common.search")}
              placeholder={t("history.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <SelectChip label={t("history.filterGroup")} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">{t("history.pickGroup")}</option>
              {parties.map((p) => (
                <option key={p.partyId} value={p.partyId}>
                  {p.partyName}
                </option>
              ))}
            </SelectChip>
            <SelectChip label={t("history.filterCategory")} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t("history.allCategories")}</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, language)}
                </option>
              ))}
            </SelectChip>
            <SelectChip label={t("history.filterPayer")} value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="">{t("history.allMembers")}</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </SelectChip>
          </div>
        </div>

        {hasAnyRecords && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid var(--color-line-soft)",
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "center",
              fontSize: 13,
              color: "var(--color-ink-2)",
            }}
          >
            <Badge tone="neutral" size="sm">
              {t("history.filteredOfFmt", { shown: filtered.length, total: records.length })}
            </Badge>
            {filteredTotal > 0 && (
              <span className="fxt-mono" style={{ color: "var(--color-ink-2)" }}>
                ≈ {formatAmount(filteredTotal)} {baseCurrency}
              </span>
            )}
          </div>
        )}
      </Card>

      {!hasAnyRecords ? (
        <EmptyState
          icon="📋"
          title={t("history.emptyTitle")}
          description={t("history.emptyDesc")}
          ctaHref="/scan"
          ctaLabel={t("actions.addExpense")}
        />
      ) : noMatch ? (
        <EmptyState
          icon="🔍"
          title={t("history.noMatchTitle")}
          description={t("history.noMatchDesc")}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 22 }}>
          {groups.map((g) => (
            <li key={g.date}>
              <DayHeader group={g} />
              <ul
                style={{
                  listStyle: "none",
                  margin: "10px 0 0",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {g.records.map((r) => (
                  <ExpenseCard key={r.id} record={r} baseCurrency={baseCurrency} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayHeader({ group }: { group: DayGroup }) {
  const { t } = useLanguage();
  const currencyParts = Object.entries(group.totalsByCurrency);
  const primary =
    currencyParts.length === 1
      ? `${formatAmount(currencyParts[0][1])} ${currencyParts[0][0]}`
      : currencyParts.map(([cur, amt]) => `${formatAmount(amt)} ${cur}`).join(" · ");
  const showBase =
    group.baseTotal > 0 && !(currencyParts.length === 1 && currencyParts[0][0] === group.baseCurrency);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "0 4px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--color-ink)",
            lineHeight: 1.3,
          }}
        >
          {formatDayHeading(group.date)}
        </div>
        <div
          className="fxt-mono"
          style={{ fontSize: 10.5, color: "var(--color-ink-3)", letterSpacing: "0.08em", marginTop: 2 }}
        >
          {group.count} {group.count === 1 ? t("history.daySingular") : t("history.dayPlural")}
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 0 }}>
        <div
          className="fxt-mono"
          style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500 }}
        >
          {primary}
        </div>
        {showBase && group.baseCurrency && (
          <div
            className="fxt-mono"
            style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}
          >
            ≈ {formatAmount(group.baseTotal)} {group.baseCurrency}
          </div>
        )}
      </div>
    </div>
  );
}

export default function History() {
  return (
    <Suspense fallback={<div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>}>
      <HistoryInner />
    </Suspense>
  );
}
