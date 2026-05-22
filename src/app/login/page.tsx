"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import { Card, Button, TextField, Alert } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setSession(data.session);
      router.push("/parties");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 24,
        gridTemplateColumns: "1fr",
        alignItems: "center",
        maxWidth: 980,
        margin: "min(6vh, 48px) auto 0",
      }}
      className="login-grid"
    >
      <section style={{ display: "none" }} className="login-hero" aria-hidden>
        <div className="fxt-eyebrow" style={{ marginBottom: 14 }}>FXT · GROUP & TRIP EXPENSES</div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(36px, 5vw, 60px)", lineHeight: 1.04, margin: 0, letterSpacing: "-0.02em" }}
        >
          A calm, warm <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>travel companion</em> for everyday expenses.
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 15, lineHeight: 1.6, marginTop: 18, maxWidth: "44ch" }}>
          Scan, split, and settle. Personal, family, friends, or a six-day trip to Kyoto — one place for it all.
        </p>
      </section>

      <Card padding={28} className="login-card">
        <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>WELCOME BACK</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          Log in
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: "8px 0 24px" }}>
          Username and your 4-digit PIN.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <Alert tone="accent" title="We couldn't sign you in.">{error}</Alert>}

          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />

          <TextField
            label="PIN"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="current-password"
            type="password"
            required
            helper="4 digits, numeric only."
          />

          <Button type="submit" disabled={submitting} variant="primary" size="lg" full>
            {submitting ? "Signing in…" : "Log in"}
          </Button>

          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: 0, textAlign: "center" }}>
            New here?{" "}
            <Link href="/register" style={{ color: "var(--color-accent-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Create an account
            </Link>
          </p>
        </form>
      </Card>

      <style>{`
        @media (min-width: 860px) {
          .login-grid { grid-template-columns: 1.05fr 1fr; gap: 56px; }
          .login-hero { display: block !important; }
        }
      `}</style>
    </div>
  );
}
