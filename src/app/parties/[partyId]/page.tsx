"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import type { Budget, ExpenseRecord, Party, PartyMember, Trip } from "@/lib/types";
import { onlyConfirmed } from "@/lib/chartUtils";
import { findMonthlyBudget } from "@/lib/budget";
import MonthlyBudgetCard from "@/components/MonthlyBudgetCard";
import CategoryBudgetsCard from "@/components/CategoryBudgetsCard";
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
import {
  PageHeader,
  ButtonLink,
  Button,
  Card,
  Badge,
  Alert,
  SectionHeader,
  TextField,
} from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

export default function PartyDashboardPage() {
  const params = useParams<{ partyId: string }>();
  const partyId = params?.partyId;
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();
  const [party, setParty] = useState<Party | null>(null);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ tone: "sage" | "accent"; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  const load = useCallback(async (): Promise<void> => {
    if (!session || !partyId) return;
    const family = encodeURIComponent(partyId);
    const base = encodeURIComponent(session.baseCurrency || "HKD");
    const uid = encodeURIComponent(session.userId);
    try {
      const [p, e, m, b, t] = await Promise.all([
        fetch(`/api/parties?userId=${uid}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/expenses?familyId=${family}&baseCurrency=${base}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/parties/${encodeURIComponent(partyId)}/members?userId=${uid}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/budgets?groupId=${family}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
        fetch(`/api/trips?userId=${uid}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
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
      if (t.ok) {
        const allTrips = (t.body.trips as Trip[]) || [];
        setTrips(allTrips.filter((x) => x.familyId === partyId));
      }
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
  const isAdmin = useMemo(
    () => !!(party && session && party.createdBy === session.userId),
    [party, session],
  );
  const isPersonal = useMemo(
    () => !!(party && session && party.type === "private" && party.createdBy === session.userId && party.partyName === "Personal"),
    [party, session],
  );

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !party) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          partyId: party.partyId,
          inviteCode: inviteCode.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setInviteMsg({ tone: "sage", text: t("groups.detail.invitedFmt", { name: data.added.username }) });
      setInviteCode("");
      const m = await fetch(
        `/api/parties/${encodeURIComponent(party.partyId)}/members?userId=${encodeURIComponent(session.userId)}`,
      );
      if (m.ok) {
        const body = await m.json();
        setMembers(body.members || []);
      }
    } catch (err) {
      setInviteMsg({ tone: "accent", text: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setInviting(false);
    }
  }

  async function handleDeleteExpense(rec: ExpenseRecord) {
    if (!session) return;
    if (!confirm(t("expenseCard.deleteConfirm"))) return;
    try {
      const res = await fetch("/api/expenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: rec.id, userId: session.userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRecords((prev) => prev.filter((r) => r.id !== rec.id));
    } catch (err) {
      console.error("delete expense failed", err);
      alert(t("expenseCard.deleteFailed"));
    }
  }

  async function handleDelete() {
    if (!session || !party) return;
    const ok = confirm(
      t("groups.detail.deleteConfirmFmt", { name: party.partyName }),
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/parties/${encodeURIComponent(party.partyId)}?userId=${encodeURIComponent(session.userId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete group");
      router.replace("/parties");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setDeleting(false);
    }
  }

  if (!session || loading) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("states.loading")}</div>;
  if (error) return <Alert tone="accent" title={t("errors.couldntLoadGroup")}>{error}</Alert>;
  if (!party) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("common.notFound")}</div>;

  const confirmed = onlyConfirmed(records);
  const monthlyBudget = findMonthlyBudget(budgets, party.partyId);

  const headerEyebrow = isPersonal
    ? t("groups.detail.eyebrowPersonal")
    : party.type === "public"
      ? `${t("groups.detail.eyebrowPublicPrefix")} ${party.partyCode || ""}`
      : t("groups.detail.eyebrowPrivate");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />

      <div>
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginBottom: 10 }}>
          <Link href="/parties" style={{ color: "var(--color-ink-2)", textDecoration: "none" }}>
            {t("groups.detail.backToGroups")}
          </Link>
        </div>
        <PageHeader
          eyebrow={headerEyebrow}
          title={party.partyName}
          actions={
            <>
              <RefreshButton onClick={trigger} refreshing={refreshing} />
              <ButtonLink
                href={`/scan?partyId=${encodeURIComponent(party.partyId)}`}
                variant="accent"
                size="md"
              >
                {t("actions.addExpense")}
              </ButtonLink>
            </>
          }
        />
      </div>

      {/* MEMBERS */}
      <section>
        <SectionHeader
          title={`${t("groups.detail.membersTitle")} (${members.length})`}
          meta={party.type === "private" ? t("groups.detail.metaPrivate") : t("groups.detail.metaPublic")}
        />
        <Card padding={0}>
          {members.length === 0 ? (
            <div style={{ padding: 18, fontSize: 13, color: "var(--color-ink-3)" }}>
              {t("groups.detail.noMembers")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {members.map((m, i) => (
                <li
                  key={m.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i === 0 ? "0" : "1px solid var(--color-line-soft)",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={m.username} size={30} />
                    <span style={{ fontSize: 14, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.username}
                    </span>
                  </span>
                  <code className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.04em" }}>
                    {m.inviteCode}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {isAdmin && party.type === "private" && (
          <Card padding={16} tone="soft" className="mt-3" >
            <form onSubmit={handleInvite} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
              <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                <TextField
                  label={t("groups.detail.inviteLabel")}
                  placeholder={t("groups.detail.invitePlaceholder")}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  helper={t("groups.detail.inviteHelper")}
                />
              </div>
              <Button type="submit" variant="primary" size="md" disabled={inviting || !inviteCode.trim()}>
                {inviting ? t("actions.adding") : t("actions.invite")}
              </Button>
            </form>
            {inviteMsg && (
              <div style={{ marginTop: 12 }}>
                <Alert tone={inviteMsg.tone}>{inviteMsg.text}</Alert>
              </div>
            )}
          </Card>
        )}
      </section>

      {/* BUDGET — keeps existing MonthlyBudgetCard component intact */}
      <section>
        <SectionHeader title={t("groups.detail.monthlyBudget")} meta={monthlyBudget ? t("groups.detail.budgetSet") : t("groups.detail.budgetNotSet")} />
        <MonthlyBudgetCard
          groupId={party.partyId}
          budget={monthlyBudget}
          records={records}
          baseCurrency={baseCurrency}
          canEdit={isAdmin}
          userId={session.userId}
          onChange={load}
        />
        <CategoryBudgetsCard
          groupId={party.partyId}
          budgets={budgets}
          records={records}
          baseCurrency={baseCurrency}
          canEdit={isAdmin}
          userId={session.userId}
          onChange={load}
        />
      </section>

      {/* TRIPS IN THIS GROUP */}
      {trips.length > 0 && (
        <section>
          <SectionHeader
            title={t("groups.detail.tripsTitle")}
            meta={`${trips.length} ${t("trips.tripsSuffix").replace("{s}", trips.length === 1 ? "" : "S")}`}
            action={
              <Link
                href="/trips"
                style={{ fontSize: 12, color: "var(--color-ink-3)", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {t("common.seeAll")}
              </Link>
            }
          />
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {trips.slice(0, 6).map((t) => (
              <li key={t.tripId}>
                <Link
                  href={`/trips/${t.tripId}`}
                  className="fxt-focus"
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "var(--color-ink)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "var(--radius-lg)",
                    padding: 14,
                  }}
                >
                  <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                    {t.tripName}
                  </div>
                  <div className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 4, letterSpacing: "0.04em" }}>
                    {t.destination ? `${t.destination.toUpperCase()} · ` : ""}{(t.startDate || "?")} → {(t.endDate || "?")}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* DASHBOARD — keeps existing charts intact */}
      {records.length === 0 ? (
        <EmptyState
          icon="🧾"
          title={t("groups.detail.emptyTitle")}
          description={t("groups.detail.emptyDesc")}
          ctaHref={`/scan?partyId=${encodeURIComponent(party.partyId)}`}
          ctaLabel={t("actions.addFirstExpense")}
        />
      ) : (
        <>
          <section>
            <SectionHeader title={t("groups.detail.glance")} />
            <DashboardCards records={confirmed} baseCurrency={baseCurrency} />
          </section>

          <section>
            <SectionHeader title={t("groups.detail.breakdown")} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              <CategoryPieChart records={confirmed} />
              <UserBarChart records={confirmed} />
            </div>
          </section>

          <section>
            <SectionHeader title={t("groups.detail.dailyTrend")} />
            <SpendingLineChart records={confirmed} />
          </section>

          <section>
            <SectionHeader
              title={t("groups.detail.recentExpenses")}
              meta={t("groups.detail.showingOfFmt", { shown: Math.min(records.length, 20), total: records.length })}
            />
            <RecordsTable records={records.slice(0, 20)} baseCurrency={baseCurrency} onDelete={handleDeleteExpense} />
          </section>
        </>
      )}

      {isAdmin && (
        <section
          style={{
            paddingTop: 24,
            marginTop: 8,
            borderTop: "1px solid var(--color-line-soft)",
          }}
        >
          <Badge tone="amber" size="sm">{t("groups.detail.dangerZone")}</Badge>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600, margin: "10px 0 6px" }}>
            {t("groups.detail.deleteTitle")}
          </h3>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.5, margin: "0 0 12px", maxWidth: "60ch" }}>
            {t("groups.detail.deleteDesc")}
          </p>
          <Button type="button" variant="danger" size="md" onClick={handleDelete} disabled={deleting}>
            {deleting ? t("common.deleting") : t("groups.detail.deleteButton")}
          </Button>
        </section>
      )}
    </div>
  );
}
