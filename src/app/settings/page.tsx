"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, setSession, useSession } from "@/lib/session";
import { CURRENCIES } from "@/lib/types";
import { useLanguage, SUPPORTED_LANGUAGES, type Language } from "@/lib/i18n";
import { PageHeader, Card, Button, SectionHeader, Badge } from "@/components/ui";
import CustomCategoriesSection from "@/components/CustomCategoriesSection";

const ADMIN_USERNAMES = (process.env.NEXT_PUBLIC_ADMIN_USERNAMES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default function SettingsPage() {
  const router = useRouter();
  const session = useSession();
  const { t, language, setLanguage } = useLanguage();
  const [baseCurrency, setBaseCurrency] = useState<string>(() => session?.baseCurrency ?? "HKD");
  const [savedTick, setSavedTick] = useState(false);
  const [langSavedTick, setLangSavedTick] = useState(false);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  const isAdmin = useMemo(
    () => !!session && ADMIN_USERNAMES.includes(session.username.toLowerCase()),
    [session],
  );

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("common.loading")}</div>;

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

  function handleLanguageChange(value: Language) {
    setLanguage(value);
    setLangSavedTick(true);
    setTimeout(() => setLangSavedTick(false), 1400);
  }

  const dirty = baseCurrency !== session.baseCurrency;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 560, margin: "0 auto" }}>
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={<>{t("settings.title")}</>}
        description={t("settings.description")}
      />

      <section>
        <SectionHeader title={t("settings.account")} />
        <Card padding={18}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <Row label={t("settings.usernameLabel")} value={session.username} />
            <Row
              label={t("settings.inviteCodeLabel")}
              value={<code className="fxt-mono" style={codeStyle()}>{session.inviteCode}</code>}
              hint={t("settings.inviteCodeHint")}
            />
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader title={t("settings.language")} meta={t("settings.languageMeta")} />
        <Card padding={18}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            {t("settings.languageDesc")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SUPPORTED_LANGUAGES.map((opt) => {
              const active = opt.code === language;
              return (
                <label
                  key={opt.code}
                  className="fxt-focus"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${active ? "color-mix(in oklch, var(--color-accent) 35%, var(--color-line))" : "var(--color-line)"}`,
                    background: active ? "var(--color-accent-soft)" : "var(--color-surface)",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--color-ink)",
                  }}
                >
                  <input
                    type="radio"
                    name="fxt-language"
                    value={opt.code}
                    checked={active}
                    onChange={() => handleLanguageChange(opt.code)}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 15 }}>{opt.label}</span>
                  <span className="fxt-mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-ink-3)" }}>
                    {opt.code}
                  </span>
                </label>
              );
            })}
          </div>
          {langSavedTick && (
            <div style={{ marginTop: 12 }}>
              <Badge tone="sage" size="sm">{t("common.saved")}</Badge>
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionHeader title={t("settings.displayCurrency")} meta={dirty ? t("common.unsaved") : undefined} />
        <Card padding={18}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            {t("settings.displayCurrencyDesc")}
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
            {t("settings.baseCurrency")}
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
              {t("common.save")}
            </Button>
            {savedTick && <Badge tone="sage" size="sm">{t("common.saved")}</Badge>}
          </div>
        </Card>
      </section>

      {isAdmin && (
        <section>
          <SectionHeader title={t("settings.adminTitle")} meta={t("settings.adminMeta")} />
          <Card padding={18}>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
              {t("settings.adminDesc")}
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
              {t("settings.openAdmin")}
            </Link>
          </Card>
        </section>
      )}

      <CustomCategoriesSection userId={session.userId} />

      <section>
        <SectionHeader title={t("settings.sessionTitle")} />
        <Card padding={18}>
          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
            {t("settings.sessionDesc")}
          </p>
          <Button variant="danger" size="md" onClick={handleLogout}>
            {t("common.logout")}
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
