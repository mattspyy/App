"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, setSession, useSession } from "@/lib/session";
import { CURRENCIES } from "@/lib/types";
import { PageHeader, Card, Button, SectionHeader, Badge } from "@/components/ui";

const ADMIN_USERNAMES = (process.env.NEXT_PUBLIC_ADMIN_USERNAMES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function SettingsPage() {
  const router = useRouter();
  const session = useSession();
  const [baseCurrency, setBaseCurrency] = useState<string>(() => session?.baseCurrency ?? "HKD");
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  const isAdmin = useMemo(
    () => !!session && ADMIN_USERNAMES.includes(session.username.toLowerCase()),
    [session],
  );

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;

  function handleSave() {
    if (!session) return;
    setSession({ ...session, baseCurrency });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1400);
  }

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const dirty = baseCurrency !== session.baseCurrency;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 560, margin: "0 auto" }}>
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title={<>Settings</>}
        description="A handful of preferences. Nothing to overthink."
      />

      <section>
        <SectionHeader title="Account" />
        <Card padding={18}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <Row label="Username" value={session.username} />
            <Row
              label="Invite code"
              value={<code className="fxt-mono" style={codeStyle()}>{session.inviteCode}</code>}
              hint="Share this with a private-group admin to be added as a member."
            />
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title="Display currency" meta={dirty ? "UNSAVED" : undefined} />
        <Card padding={18}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Dashboards convert other currencies to this one. Stored locally; doesn&apos;t change anyone else&apos;s view.
          </p>
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-ink-3)",
              marginBottom: 6,
            }}
            htmlFor="settings-currency"
          >
            Base currency
          </label>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-md)",
              padding: "0 12px",
              marginBottom: 14,
            }}
          >
            <select
              id="settings-currency"
              className="fxt-focus"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              style={{
                appearance: "none",
                width: "100%",
                background: "transparent",
                border: 0,
                padding: "12px 0",
                fontSize: 15,
                fontFamily: "var(--font-sans)",
                color: "var(--color-ink)",
                outline: "none",
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button variant="primary" size="md" onClick={handleSave} disabled={!dirty}>
              Save
            </Button>
            {savedTick && <Badge tone="sage" size="sm">Saved ✓</Badge>}
          </div>
        </Card>
      </section>

      {isAdmin && (
        <section>
          <SectionHeader title="Admin" meta="ADMIN ONLY" />
          <Card padding={18}>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
              Operator tools: per-user AI rate limits and account deletion. Password-gated separately.
            </p>
            <Link
              href="/admin"
              className="fxt-focus"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Open admin →
            </Link>
          </Card>
        </section>
      )}

      <section>
        <SectionHeader title="Session" />
        <Card padding={18}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            Logging out clears your session on this device. Your data stays in Notion and Supabase.
          </p>
          <Button variant="danger" size="md" onClick={handleLogout}>
            Log out
          </Button>
        </Card>
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <li style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--color-ink)" }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--color-ink-3)", lineHeight: 1.4 }}>{hint}</div>
      )}
    </li>
  );
}

function codeStyle(): React.CSSProperties {
  return {
    background: "var(--color-bg-soft)",
    border: "1px solid var(--color-line-soft)",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 13,
    color: "var(--color-ink)",
  };
}
