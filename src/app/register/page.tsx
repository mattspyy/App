"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import { CURRENCIES } from "@/lib/types";

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
      setError("PIN entries don't match");
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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <h1 className="text-2xl font-semibold">Create account</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}
      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">Username (3-30 chars, letters/digits/underscore)</div>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">PIN (4 digits)</div>
        <input className="input" inputMode="numeric" pattern="\d{4}" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" required />
      </label>
      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">Confirm PIN</div>
        <input className="input" inputMode="numeric" pattern="\d{4}" maxLength={4} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))} required />
      </label>
      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">Base currency</div>
        <select className="input" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <button type="submit" disabled={submitting} className="bg-zinc-900 text-white px-4 py-2 rounded-md disabled:opacity-50 w-full">
        {submitting ? "Creating…" : "Create account"}
      </button>
      <p className="text-sm text-zinc-500">Already have an account? <Link href="/login" className="underline">Log in</Link>.</p>
    </form>
  );
}
