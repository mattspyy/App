"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import { CURRENCIES } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { Card, Button, TextField, Alert } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<string>("HKD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError(t("register.errorInvalidPin"));
      return;
    }
    if (pin !== pinConfirm) {
      setError(t("register.errorPinMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin, baseCurrency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("register.errorGeneric"));
      setSession(data.session);
      router.push("/parties");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("register.errorUnknown"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: "min(5vh, 40px) auto 0", display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            lineHeight: 1,
            color: "var(--color-ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {t("brand.name")}
        </div>
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            color: "var(--color-ink)",
            marginTop: 10,
            lineHeight: 1.4,
          }}
        >
          {t("hero.tagline")}
        </div>
        <div style={{ fontSize: 13, color: "var(--color-ink-3)", marginTop: 4, lineHeight: 1.5 }}>
          {t("hero.subtext")}
        </div>
      </header>

      <Card padding={24}>
        <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>{t("register.eyebrow")}</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 28, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {t("register.title")}
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: "8px 0 8px" }}>
          {t("register.subtitle")}
        </p>
        <p style={{ color: "var(--color-ink-3)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
          {t("register.personalNote")}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <Alert tone="accent" title={t("register.errorTitle")}>{error}</Alert>}

          <TextField
            label={t("register.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
            helper={t("register.usernameHelper")}
          />

          <TextField
            label={t("register.pin")}
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            autoComplete="new-password"
            required
            helper={t("register.pinHelper")}
          />

          <TextField
            label={t("register.confirmPin")}
            inputMode="numeric"
            maxLength={4}
            type="password"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
            required
          />

          <div>
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
              htmlFor="register-currency"
            >
              {t("register.baseCurrency")}
            </label>
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-md)",
                padding: "0 12px",
              }}
            >
              <select
                id="register-currency"
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
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 6 }}>
              {t("register.baseCurrencyHelper")}
            </div>
          </div>

          <Button type="submit" disabled={submitting} variant="primary" size="lg" full>
            {submitting ? t("register.submitting") : t("register.submit")}
          </Button>

          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: 0, textAlign: "center" }}>
            {t("register.haveAccount")}{" "}
            <Link href="/login" style={{ color: "var(--color-accent-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              {t("register.login")}
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
