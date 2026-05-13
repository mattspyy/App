"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";

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
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <h1 className="text-2xl font-semibold">Log in</h1>
      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}
      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">Username</div>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label className="block">
        <div className="text-xs text-zinc-600 mb-1">PIN (4 digits)</div>
        <input className="input" inputMode="numeric" pattern="\d{4}" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={submitting} className="bg-zinc-900 text-white px-4 py-2 rounded-md disabled:opacity-50 w-full">
        {submitting ? "Logging in…" : "Log in"}
      </button>
      <p className="text-sm text-zinc-500">No account? <Link href="/register" className="underline">Create one</Link>.</p>
    </form>
  );
}
