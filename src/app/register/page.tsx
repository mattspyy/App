"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import { CURRENCIES } from "@/lib/types";
import { Card, Button, TextField, Alert } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<string>("HKD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin !== pinConfirm) {
      setError("PIN entries don't match.");
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
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setSession(data.session);
      router.push("/parties");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 460, margin: "min(5vh, 40px) auto 0" }}>
      <Card padding={28}>
        <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>GET STARTED</div>
        <h1
          className="fxt-display"
          style={{ fontSize: 32, margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          Create your account
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 14, margin: "8px 0 20px" }}>
          We&apos;ll set up a private <strong style={{ color: "var(--color-ink)" }}>Personal</strong> group for you so you can start adding expenses right away.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && <Alert tone="accent" title="Couldn't create your account.">{error}</Alert>}

          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
            helper="3–30 characters: letters, digits, underscore."
          />

          <TextField
            label="PIN"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoComplete="new-password"
            required
            helper="4 digits — you&rsquo;ll use this to log in."
          />

          <TextField
            label="Confirm PIN"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            type="password"
            value={pinConfirm}
            onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
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
              Base currency
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
              Dashboards convert other currencies to this one.
            </div>
          </div>

          <Button type="submit" disabled={submitting} variant="primary" size="lg" full>
            {submitting ? "Creating account…" : "Create account"}
          </Button>

          <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: 0, textAlign: "center" }}>
            Already have one?{" "}
            <Link href="/login" style={{ color: "var(--color-accent-ink)", textDecoration: "underline", textUnderlineOffset: 3 }}>
              Log in
            </Link>
          </p>
        </form>
      </Card>
    </div>
  );
}
