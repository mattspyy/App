"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { calculateBalances, calculateSettlements, type Settlement } from "@/lib/settlement";
import type { ExpenseRecord, Trip } from "@/lib/types";
import {
  Card,
  Alert,
  Badge,
  Button,
  ButtonLink,
  SectionHeader,
} from "@/components/ui";
import { useLanguage } from "@/lib/i18n";

type SettlementPaymentApi = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  groupId: string;
  tripId?: string;
  date: string;
  status: "pending" | "paid";
  createdAt: string;
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SettlementPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId;
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [payments, setPayments] = useState<SettlementPaymentApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingKey, setMarkingKey] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function loadPayments(groupId: string, currentTripId: string): Promise<void> {
    try {
      const r = await fetch(
        `/api/settlement-payments?groupId=${encodeURIComponent(groupId)}&tripId=${encodeURIComponent(currentTripId)}`,
      );
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || "Failed to load settlement payments");
      setPayments(body.payments || []);
    } catch (err) {
      console.warn("settlement payments load failed", err);
    }
  }

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!tripId) return;
    const uid = encodeURIComponent(session.userId);
    const tid = encodeURIComponent(tripId);
    const base = encodeURIComponent(session.baseCurrency || "HKD");
    Promise.all([
      fetch(`/api/trips/${tid}?userId=${uid}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
      fetch(`/api/expenses?tripId=${tid}&baseCurrency=${base}`).then(async (r) => ({ ok: r.ok, body: await r.json() })),
    ])
      .then(async ([t, e]) => {
        if (!t.ok) throw new Error(t.body.error || "Trip not found");
        if (!e.ok) throw new Error(e.body.error || "Failed to load expenses");
        const tripData = t.body.trip as Trip;
        setTrip(tripData);
        setRecords(e.body.records || []);
        if (tripData.familyId) await loadPayments(tripData.familyId, tripId);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router, tripId]);

  async function markAsPaid(settlement: Settlement, currency: string): Promise<void> {
    if (!trip || !session) return;
    const key = `${settlement.fromUserId}->${settlement.toUserId}`;
    setMarkingKey(key);
    try {
      const res = await fetch("/api/settlement-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterUserId: session.userId,
          fromUserId: settlement.fromUserId,
          toUserId: settlement.toUserId,
          amount: settlement.amount,
          currency,
          groupId: trip.familyId,
          tripId: trip.tripId,
          status: "paid",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      await loadPayments(trip.familyId, trip.tripId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMarkingKey(null);
    }
  }

  const baseCurrency = session?.baseCurrency || trip?.baseCurrency || "HKD";
  const usable = useMemo(
    () => records.filter((r) => typeof r.baseAmount === "number" && r.baseCurrency === baseCurrency),
    [records, baseCurrency],
  );
  const skippedCount = records.length - usable.length;
  const balances = useMemo(() => calculateBalances(usable), [usable]);
  const rawSettlements = useMemo(() => calculateSettlements(balances), [balances]);
  const paidByPair = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== "paid") continue;
      const key = `${p.fromUserId}->${p.toUserId}`;
      map.set(key, (map.get(key) ?? 0) + p.amount);
    }
    return map;
  }, [payments]);
  const settlements = useMemo<Settlement[]>(() => {
    return rawSettlements
      .map((s) => {
        const key = `${s.fromUserId}->${s.toUserId}`;
        const paid = paidByPair.get(key) ?? 0;
        const remaining = Number((s.amount - paid).toFixed(2));
        return { ...s, amount: remaining };
      })
      .filter((s) => s.amount > 0.01);
  }, [rawSettlements, paidByPair]);

  // Build a userId → userName map from balances so we can show names on the
  // recorded-payments list (which only stores IDs).
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of balances) m.set(b.userId, b.userName);
    return m;
  }, [balances]);

  async function handleCopySummary() {
    if (!trip) return;
    const lines: string[] = [];
    lines.push(`${trip.tripName} \u2014 ${t("settlement.copy.tripSuffix")}`);
    if (trip.startDate || trip.endDate) {
      lines.push(`${trip.startDate || "?"} \u2192 ${trip.endDate || "?"}`);
    }
    lines.push("");
    if (balances.length > 0) {
      lines.push(t("settlement.copy.balances"));
      for (const b of balances) {
        const sign = b.net > 0 ? "+" : "";
        lines.push(`  ${b.userName}: ${sign}${b.net.toFixed(2)} ${baseCurrency}`);
      }
      lines.push("");
    }
    if (settlements.length === 0) {
      lines.push(t("settlement.copy.allSettled"));
    } else {
      lines.push(t("settlement.copy.whoPaysWhom"));
      for (const s of settlements) {
        lines.push(t("settlement.copy.paysFmt", { from: s.fromUserName, to: s.toUserName, amount: s.amount.toFixed(2), cur: baseCurrency }));
      }
    }
    const text = lines.join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyStatus("copied");
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      setCopyStatus("failed");
    } finally {
      setTimeout(() => setCopyStatus("idle"), 1800);
    }
  }

  if (!session || loading) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("states.loading")}</div>;
  if (error) return <Alert tone="accent" title={t("errors.couldntLoadSettlement")}>{error}</Alert>;
  if (!trip) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("common.notFound")}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
        <Link href="/trips" style={{ color: "var(--color-ink-2)", textDecoration: "none" }}>{t("settlement.breadcrumbTrips")}</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href={`/trips/${trip.tripId}`} style={{ color: "var(--color-ink-2)", textDecoration: "none" }}>
          {trip.tripName}
        </Link>
      </div>

      <header>
        <div className="fxt-eyebrow">{t("settlement.eyebrow")}</div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 6px", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {settlements.length === 0 && balances.length > 0
            ? <>{t("settlement.titleSettled")} <em style={{ fontStyle: "italic", color: "var(--color-sage)" }}>{t("settlement.titleSettledAccent")}</em></>
            : <>{t("settlement.titleQuestion")} <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>{t("settlement.titleQuestionAccent")}</em></>}
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 13, margin: 0, maxWidth: "56ch" }}>
          {t("settlement.subtitleFmt", { cur: baseCurrency })}
        </p>
      </header>

      {skippedCount > 0 && (
        <Alert tone="amber" title={t("settlement.skippedFmt", { n: skippedCount, s: skippedCount === 1 ? "" : "s" })}>
          {t("settlement.skippedDescFmt", { cur: baseCurrency })}
        </Alert>
      )}

      {/* SUGGESTED SETTLEMENTS */}
      <section>
        <SectionHeader
          title={t("settlement.suggested")}
          meta={settlements.length === 0 ? t("settlement.allDone") : t("settlement.toGoFmt", { n: settlements.length })}
          action={
            balances.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleCopySummary}>
                {copyStatus === "copied" ? t("common.copied") : copyStatus === "failed" ? t("common.copyFailed") : t("actions.copySummary")}
              </Button>
            ) : undefined
          }
        />
        {settlements.length === 0 ? (
          <Card padding={20} tone="sage">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span aria-hidden style={{ fontSize: 24 }}>🎉</span>
              <div>
                <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 16, color: "var(--color-sage-ink)" }}>
                  {t("settlement.allSettledTitle")}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-ink-2)", marginTop: 2 }}>
                  {t("settlement.allSettledDesc")}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {settlements.map((s) => {
              const key = `${s.fromUserId}->${s.toUserId}`;
              const marking = markingKey === key;
              return (
                <li key={key}>
                  <Card padding={16}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--color-ink)", lineHeight: 1.4 }}>
                          <strong>{s.fromUserName}</strong>
                          <span style={{ color: "var(--color-ink-3)", fontStyle: "italic" }}>{t("settlement.pays")}</span>
                          <strong>{s.toUserName}</strong>
                        </div>
                        <div className="fxt-mono" style={{ fontSize: 18, color: "var(--color-ink)", marginTop: 4, fontWeight: 500 }}>
                          {formatAmount(s.amount)} {baseCurrency}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="sage"
                        size="md"
                        onClick={() => markAsPaid(s, baseCurrency)}
                        disabled={marking}
                      >
                        {marking ? t("settlement.recording") : t("settlement.markAsPaid")}
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* BALANCES TABLE */}
      <section>
        <SectionHeader title={t("settlement.perPersonBalance")} meta={`${balances.length} ${balances.length === 1 ? "MEMBER" : "MEMBERS"}`} />
        {balances.length === 0 ? (
          <Card padding={20} tone="soft">
            <div style={{ fontSize: 13, color: "var(--color-ink-3)" }}>{t("settlement.noSplittable")}</div>
          </Card>
        ) : (
          <Card padding={0}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {balances.map((b, i) => (
                <li
                  key={b.userId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    columnGap: 12,
                    rowGap: 6,
                    alignItems: "center",
                    padding: "14px 18px",
                    borderTop: i === 0 ? "0" : "1px solid var(--color-line-soft)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--color-ink)" }}>
                    {b.userName}
                  </span>
                  <span className="fxt-mono" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                    {t("settlement.paidLabel")} {b.totalPaid.toFixed(2)} · {t("settlement.owedLabel")} {b.totalOwed.toFixed(2)}
                  </span>
                  <span
                    className="fxt-mono"
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color:
                        b.net > 0
                          ? "var(--color-sage-ink)"
                          : b.net < 0
                            ? "var(--color-accent-ink)"
                            : "var(--color-ink-3)",
                      minWidth: 84,
                      textAlign: "right",
                    }}
                  >
                    {b.net > 0 ? "+" : ""}
                    {b.net.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* RECORDED PAYMENTS */}
      {payments.length > 0 && (
        <section>
          <SectionHeader title={t("settlement.recordedPayments")} meta={`${payments.length} ${t("settlement.totalSuffix")}`} />
          <Card padding={0}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {payments.map((p, i) => {
                const from = nameById.get(p.fromUserId) || p.fromUserId.slice(0, 6);
                const to = nameById.get(p.toUserId) || p.toUserId.slice(0, 6);
                return (
                  <li
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 16px",
                      borderTop: i === 0 ? "0" : "1px solid var(--color-line-soft)",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--color-ink)" }}>
                        <strong>{from}</strong>
                        <span style={{ color: "var(--color-ink-3)", fontStyle: "italic" }}>{t("settlement.paid")}</span>
                        <strong>{to}</strong>
                      </div>
                      <div className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
                        {p.date}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className="fxt-mono" style={{ fontSize: 14, color: "var(--color-ink)", fontWeight: 500 }}>
                        {p.amount.toFixed(2)} {p.currency}
                      </span>
                      <Badge tone={p.status === "paid" ? "sage" : "amber"} size="sm">
                        {p.status === "paid" ? t("settlement.statusPaid") : t("settlement.statusPending")}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <div style={{ marginTop: 4 }}>
        <ButtonLink href={`/trips/${trip.tripId}/report`} variant="ghost" size="md">
          {t("settlement.seeFullReport")}
        </ButtonLink>
      </div>
    </div>
  );
}
