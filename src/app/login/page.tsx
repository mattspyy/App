"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import { useLanguage } from "@/lib/i18n";
import { Card, Button, TextField, Alert } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError(t("login.errorInvalidPin"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("login.errorGeneric"));
      setSession(data.session);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.errorUnknown"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "min(6vh, 48px) auto 0",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
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

      <Card padding={24} className="login-card">
        <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>{t("login.eyebrow")}</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 28, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {t("login.title")}
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: "8px 0 20px" }}>
          {t("login.subtitle")}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <Alert tone="accent" title={t("login.errorTitle")}>{error}</Alert>}

          <TextField
            label={t("login.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />

          <TextField
            label={t("login.pin")}
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            autoComplete="current-password"
            type="password"
            required
            helper={t("login.pinHelper")}
          />

          <Button type="submit" disabled={submitting} variant="primary" size="lg" full>
            {submitting ? t("login.submitting") : t("login.submit")}
          </Button>

          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: 0, textAlign: "center" }}>
            {t("login.newHere")}{" "}
            <Link href="/register" style={{ color: "var(--color-accent-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              {t("login.createAccount")}
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
