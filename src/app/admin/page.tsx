"use client";
import { useEffect, useState } from "react";
import { ADMIN_HEADER } from "@/lib/adminAuth";

type AdminUser = {
  id: string;
  username: string;
  invite_code: string;
  base_currency: string;
  ai_calls_per_minute: number | null;
  created_at: string;
};

const RATE_LIMIT_PRESETS = [2, 5, 10, 0] as const;
const ADMIN_USERNAMES = (process.env.NEXT_PUBLIC_ADMIN_USERNAMES || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAdminUsername(name: string): boolean {
  return ADMIN_USERNAMES.includes(name.trim().toLowerCase());
}

const PASS_KEY = "fxt.adminPassword";

export default function AdminPage() {
  const [password, setPassword] = useState<string>(() =>
    typeof window === "undefined" ? "" : sessionStorage.getItem(PASS_KEY) || "",
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingLimit, setSavingLimit] = useState<string | null>(null);

  useEffect(() => {
    if (password && !authenticated) void load(password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(pw: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { headers: { [ADMIN_HEADER]: pw } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data.users || []);
      setAuthenticated(true);
      sessionStorage.setItem(PASS_KEY, pw);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setAuthenticated(false);
      sessionStorage.removeItem(PASS_KEY);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    void load(password);
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`Delete user "${user.username}"? Their parties and party memberships will be removed from Supabase. Their expenses and trips in Notion will NOT be deleted — they'll remain as orphans referencing the deleted IDs.`)) {
      return;
    }
    setDeleting(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
        headers: { [ADMIN_HEADER]: password },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleUpdateLimit(user: AdminUser, value: number) {
    setSavingLimit(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/rate-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_HEADER]: password },
        body: JSON.stringify({ aiCallsPerMinute: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update rate limit");
      const updated = data.user as { id: string; ai_calls_per_minute: number };
      setUsers((prev) =>
        prev.map((u) =>
          u.id === updated.id ? { ...u, ai_calls_per_minute: updated.ai_calls_per_minute } : u,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingLimit(null);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(PASS_KEY);
    setPassword("");
    setAuthenticated(false);
    setUsers([]);
  }

  if (!authenticated) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <h1 className="text-2xl font-semibold">Admin</h1>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}
        <label className="block">
          <div className="text-xs text-zinc-600 mb-1">Admin password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={loading || !password} className="bg-zinc-900 text-white px-4 py-2 rounded-md disabled:opacity-50 w-full">
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin · Users</h1>
          <p className="text-sm text-zinc-500">Total: {users.length}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-zinc-600 hover:text-zinc-900">Lock</button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">User Rate Limits</h2>
        <p className="text-xs text-zinc-500">
          AI calls per minute per user. 0 = unlimited. Admins listed in
          ADMIN_USERNAMES are always unlimited.
        </p>
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left px-3 py-2">Username</th>
                <th className="text-left px-3 py-2">AI calls / min</th>
                <th className="text-left px-3 py-2">Quick presets</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const adminBypass = isAdminUsername(u.username);
                const current =
                  u.ai_calls_per_minute == null ? 0 : u.ai_calls_per_minute;
                return (
                  <tr key={u.id} className="border-t border-zinc-100">
                    <td className="px-3 py-2 font-medium">{u.username}</td>
                    <td className="px-3 py-2">
                      {adminBypass ? (
                        <span className="text-emerald-700 text-xs font-medium">
                          Unlimited (ADMIN_USERNAMES)
                        </span>
                      ) : (
                        <span className="text-xs">
                          {current === 0 ? "Unlimited" : `${current}/min`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {RATE_LIMIT_PRESETS.map((preset) => {
                          const active = current === preset;
                          const disabled =
                            adminBypass || savingLimit === u.id || active;
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleUpdateLimit(u, preset)}
                              disabled={disabled}
                              className={`px-2 py-1 rounded-md border text-xs ${
                                active
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {preset === 0 ? "Unlimited" : `${preset}/min`}
                            </button>
                          );
                        })}
                        {savingLimit === u.id && (
                          <span className="text-xs text-zinc-500 self-center">Saving…</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={3} className="text-center text-zinc-500 py-6">No users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="text-left px-3 py-2">Username</th>
              <th className="text-left px-3 py-2">Invite code</th>
              <th className="text-left px-3 py-2">Base currency</th>
              <th className="text-left px-3 py-2">Created</th>
              <th className="text-right px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-100">
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2"><code className="bg-zinc-100 px-1.5 py-0.5 rounded text-xs">{u.invite_code}</code></td>
                <td className="px-3 py-2">{u.base_currency}</td>
                <td className="px-3 py-2 text-zinc-500 text-xs">{new Date(u.created_at).toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={deleting === u.id}
                    className="text-red-600 hover:underline disabled:opacity-50 text-xs"
                  >
                    {deleting === u.id ? "Deleting…" : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={5} className="text-center text-zinc-500 py-6">No users.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
