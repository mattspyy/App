"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, setSession, useSession } from "@/lib/session";
import { CURRENCIES } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const session = useSession();
  const [baseCurrency, setBaseCurrency] = useState<string>(() => session?.baseCurrency ?? "HKD");

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  if (!session) return <div className="text-sm text-zinc-500">Loading…</div>;

  function handleSave() {
    if (!session) return;
    setSession({ ...session, baseCurrency });
  }

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="space-y-5 max-w-sm">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="space-y-2">
        <h2 className="font-medium">Account</h2>
        <div className="bg-white border border-zinc-200 rounded-xl p-4 text-sm space-y-1">
          <div>Username: <span className="font-medium">{session.username}</span></div>
          <div>Invite code: <code className="bg-zinc-100 px-1.5 py-0.5 rounded">{session.inviteCode}</code></div>
        </div>
        <p className="text-xs text-zinc-500">Share your invite code with a private-group admin to be added.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Display currency</h2>
        <p className="text-xs text-zinc-500">Conversions on the dashboards are shown in this currency. Stored locally; doesn&apos;t change anyone else&apos;s view.</p>
        <select className="input" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={handleSave} className="bg-zinc-900 text-white px-4 py-2 rounded-md text-sm">Save</button>
      </section>

      <section className="pt-3 border-t border-zinc-200">
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Log out</button>
      </section>
    </div>
  );
}
