"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import {
  expandForDailyAnalytics,
  onlyConfirmed,
  totalAmount,
  totalByCategory,
  totalByDate,
  totalByUser,
} from "@/lib/chartUtils";
import { calculateBalances, calculateSettlements } from "@/lib/settlement";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { ExpenseRecord, Trip } from "@/lib/types";
import SpendingLineChart from "@/components/SpendingLineChart";
import PaymentMethodChart from "@/components/PaymentMethodChart";
import RankingLists from "@/components/RankingLists";
import {
  Card,
  Alert,
  Button,
  ButtonLink,
  SectionHeader,
  StatCard,
} from "@/components/ui";
import { useLanguage, categoryLabel, splitTypeLabel } from "@/lib/i18n";

function topMerchant(records: ExpenseRecord[]): { merchant: string; total: number } | null {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = (r.merchant || "—").trim() || "—";
    map.set(key, (map.get(key) ?? 0) + (r.baseAmount ?? r.amount));
  }
  let best: { merchant: string; total: number } | null = null;
  for (const [merchant, total] of map) {
    if (!best || total > best.total) best = { merchant, total };
  }
  return best;
}

function inRange(date: string, start: string, end: string): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReportPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params?.tripId;
  const router = useRouter();
  const session = useSession();
  const { t, language } = useLanguage();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [allRecords, setAllRecords] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
      .then(([t, e]) => {
        if (!t.ok) throw new Error(t.body.error || "Trip not found");
        if (!e.ok) throw new Error(e.body.error || "Failed to load expenses");
        setTrip(t.body.trip);
        setAllRecords(e.body.records || []);
        const tr = t.body.trip as Trip;
        if (tr.startDate) setStartDate(tr.startDate);
        if (tr.endDate) setEndDate(tr.endDate);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router, tripId]);

  const records = useMemo(
    () => onlyConfirmed(allRecords).filter((r) => inRange(r.date, startDate, endDate)),
    [allRecords, startDate, endDate],
  );

  const summary = useMemo(() => {
    const total = totalAmount(records);
    const expanded = expandForDailyAnalytics(records);
    const byCategory = totalByCategory(records);
    const byUser = totalByUser(records);
    const byDate = totalByDate(expanded);
    const days = byDate.length || 1;
    return {
      total,
      byCategory,
      byUser,
      byDate,
      averageDaily: total / days,
      topCategory: byCategory[0] ?? null,
      topMerchant: topMerchant(records),
      topDay: byDate.reduce(
        (best, cur) => (!best || cur.total > best.total ? cur : best),
        null as null | { date: string; total: number },
      ),
    };
  }, [records]);

  function handleExport() {
    if (!trip) return;
    const headers = [
      "Date", "Merchant", "Category", "Amount", "Currency",
      "Base Amount", "Base Currency", "Payer", "Split Type", "Notes",
    ];
    const rows = records.map((r) => [
      r.date,
      r.merchant ?? "",
      r.category,
      r.amount,
      r.currency,
      r.baseAmount ?? "",
      r.baseCurrency ?? "",
      r.payerName || r.userName || "",
      r.splitType ?? "",
      r.notes ?? "",
    ]);
    const safeName = trip.tripName.replace(/[^a-z0-9-_]+/gi, "_");
    downloadCsv(`${safeName}_${startDate || "all"}_${endDate || "all"}.csv`, toCsv(headers, rows));
  }

  if (!session || loading) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("states.loading")}</div>;
  if (error) return <Alert tone="accent" title={t("errors.couldntLoadReport")}>{error}</Alert>;
  if (!trip) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("common.notFound")}</div>;

  const baseCurrency = trip.baseCurrency || session.baseCurrency || "HKD";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
        <Link href="/trips" style={{ color: "var(--color-ink-2)", textDecoration: "none" }}>{t("report.breadcrumbTrips")}</Link>
        <span style={{ margin: "0 6px" }}>/</span>
        <Link href={`/trips/${trip.tripId}`} style={{ color: "var(--color-ink-2)", textDecoration: "none" }}>
          {trip.tripName}
        </Link>
      </div>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="fxt-eyebrow">{t("report.eyebrow")}</div>
          <h1
            className="fxt-display"
            style={{ fontSize: "clamp(28px, 4.6vw, 40px)", margin: "8px 0 0", lineHeight: 1.1, letterSpacing: "-0.015em" }}
          >
            {trip.tripName}
          </h1>
        </div>
        <ButtonLink href={`/trips/${trip.tripId}/settlement`} variant="ghost" size="md">
          {t("report.actionSettlement")}
        </ButtonLink>
      </header>

      {/* RANGE + EXPORT */}
      <Card padding={16} tone="soft">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <DateField label={t("report.dateFrom")} value={startDate} onChange={setStartDate} />
          <DateField label={t("report.dateTo")} value={endDate} onChange={setEndDate} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleExport}
              disabled={records.length === 0}
            >
              {t("report.exportCsv")}
            </Button>
          </div>
        </div>
      </Card>

      {/* SUMMARY */}
      <section>
        <SectionHeader title={t("report.summary")} meta={t("report.expensesFmt", { n: records.length, s: records.length === 1 ? "" : "S", cur: baseCurrency })} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <StatCard label={t("report.totalSpending")} value={`${formatAmount(summary.total)} ${baseCurrency}`} />
          <StatCard label={t("report.avgPerDay")} value={`${formatAmount(summary.averageDaily)} ${baseCurrency}`} />
          <StatCard
            label={t("report.topCategory")}
            value={summary.topCategory ? categoryLabel(summary.topCategory.category, language) : "—"}
            hint={summary.topCategory ? `${formatAmount(summary.topCategory.total)} ${baseCurrency}` : undefined}
          />
          <StatCard
            label={t("report.topMerchant")}
            value={summary.topMerchant ? summary.topMerchant.merchant : "—"}
            hint={summary.topMerchant ? `${formatAmount(summary.topMerchant.total)} ${baseCurrency}` : undefined}
          />
          <StatCard
            label={t("report.highestDay")}
            value={summary.topDay ? summary.topDay.date : "—"}
            hint={summary.topDay ? `${formatAmount(summary.topDay.total)} ${baseCurrency}` : undefined}
          />
          <StatCard label={t("report.expensesCount")} value={String(records.length)} />
        </div>
      </section>

      {/* CHARTS */}
      {records.length > 0 && (
        <section>
          <SectionHeader title={t("report.charts")} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SpendingLineChart records={expandForDailyAnalytics(records)} />
            <PaymentMethodChart records={records} baseCurrency={baseCurrency} />
          </div>
        </section>
      )}

      {/* BREAKDOWNS */}
      <section>
        <SectionHeader title={t("report.breakdown")} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <BreakdownTable
            title={t("report.byCategory")}
            rows={summary.byCategory.map((c) => [categoryLabel(c.category, language), c.total.toFixed(2)])}
          />
          <BreakdownTable
            title={t("report.byPerson")}
            rows={summary.byUser.map((u) => [u.userName, u.total.toFixed(2)])}
          />
        </div>
      </section>

      {/* RANKINGS */}
      {records.length > 0 && (
        <section>
          <SectionHeader title={t("report.rankings")} meta={t("report.top10")} />
          <RankingLists records={records} baseCurrency={baseCurrency} />
        </section>
      )}

      {/* SETTLEMENT SUMMARY */}
      {records.length > 0 && (
        <SettlementSummarySection records={records} baseCurrency={baseCurrency} />
      )}

      {/* RECORDS TABLE */}
      <section>
        <SectionHeader title={t("report.allExpenses")} meta={`${records.length} ${records.length === 1 ? t("meta.row") : t("meta.rows")}`} />
        <Card padding={0}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-bg-soft)", color: "var(--color-ink-2)" }}>
                  <Th>{t("report.thDate")}</Th>
                  <Th>{t("report.thMerchant")}</Th>
                  <Th>{t("report.thCategory")}</Th>
                  <Th>{t("report.thPayer")}</Th>
                  <Th>{t("report.thSplit")}</Th>
                  <Th align="right">{t("report.thAmount")}</Th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--color-line-soft)" }}>
                    <Td className="fxt-mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{r.date}</Td>
                    <Td>{r.merchant || "—"}</Td>
                    <Td>{categoryLabel(r.category, language)}</Td>
                    <Td>{r.payerName || r.userName}</Td>
                    <Td><SplitLabel value={r.splitType} language={language} /></Td>
                    <Td align="right">
                      <div className="fxt-mono" style={{ fontWeight: 500 }}>
                        {r.amount.toFixed(2)} {r.currency}
                      </div>
                      {typeof r.baseAmount === "number" && r.baseCurrency && r.baseCurrency !== r.currency && (
                        <div className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)" }}>
                          ≈ {r.baseAmount.toFixed(2)} {r.baseCurrency}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--color-ink-3)" }}>
                      {t("report.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

function SettlementSummarySection({ records, baseCurrency }: { records: ExpenseRecord[]; baseCurrency: string }) {
  const { t } = useLanguage();
  const usable = records.filter((r) => typeof r.baseAmount === "number" && r.baseCurrency === baseCurrency);
  const balances = calculateBalances(usable);
  const settlements = calculateSettlements(balances);
  if (balances.length === 0) return null;
  return (
    <section>
      <SectionHeader title={t("report.settlementSummary")} meta={`${baseCurrency}`} />
      <Card padding={0}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {balances.map((b, i) => (
            <li
              key={b.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderTop: i === 0 ? "0" : "1px solid var(--color-line-soft)",
              }}
            >
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 14 }}>{b.userName}</span>
              <span className="fxt-mono" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                {t("settlement.paidLabel")} {b.totalPaid.toFixed(2)} · {t("settlement.owedLabel")} {b.totalOwed.toFixed(2)}
              </span>
              <span
                className="fxt-mono"
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color:
                    b.net > 0
                      ? "var(--color-sage-ink)"
                      : b.net < 0
                        ? "var(--color-accent-ink)"
                        : "var(--color-ink-3)",
                  minWidth: 80,
                  textAlign: "right",
                }}
              >
                {b.net > 0 ? "+" : ""}{b.net.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {settlements.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "10px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {settlements.map((s) => (
            <li
              key={`${s.fromUserId}->${s.toUserId}`}
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                fontSize: 14,
                fontFamily: "var(--font-serif)",
                color: "var(--color-ink)",
              }}
            >
              <strong>{s.fromUserName}</strong>
              <span style={{ color: "var(--color-ink-3)", fontStyle: "italic" }}>{t("settlement.pays")}</span>
              <strong>{s.toUserName}</strong>
              <span className="fxt-mono" style={{ marginLeft: 10, fontSize: 13 }}>
                {s.amount.toFixed(2)} {baseCurrency}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  const { t } = useLanguage();
  return (
    <div>
      <div
        className="fxt-mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        {title}
      </div>
      <Card padding={0}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map(([k, v], i) => (
            <li
              key={k + i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderTop: i === 0 ? "0" : "1px solid var(--color-line-soft)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--color-ink)" }}>{k}</span>
              <span className="fxt-mono" style={{ fontSize: 13, color: "var(--color-ink-2)" }}>{v}</span>
            </li>
          ))}
          {rows.length === 0 && (
            <li style={{ padding: 16, textAlign: "center", color: "var(--color-ink-3)", fontSize: 13 }}>
              {t("ranking.noData")}
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "block", minWidth: 140 }}>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <input
        className="fxt-focus"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-md)",
          padding: "8px 12px",
          fontSize: 13,
          fontFamily: "var(--font-sans)",
          color: "var(--color-ink)",
          outline: "none",
        }}
      />
    </label>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 14px",
        fontWeight: 500,
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--color-ink-3)",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <td
      className={className}
      style={{
        textAlign: align,
        padding: "10px 14px",
        color: "var(--color-ink)",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function SplitLabel({ value, language }: { value?: string; language: import("@/lib/i18n").Language }) {
  if (!value) return <span style={{ color: "var(--color-ink-3)" }}>—</span>;
  const label = splitTypeLabel(value, language);
  return <span style={{ fontSize: 12, color: "var(--color-ink-2)" }}>{label}</span>;
}
