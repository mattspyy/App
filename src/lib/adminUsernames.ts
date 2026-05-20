// Usernames listed in ADMIN_USERNAMES (comma-separated) bypass AI rate limits
// regardless of the per-user ai_calls_per_minute column.

export function adminUsernames(): string[] {
  const raw = process.env.ADMIN_USERNAMES || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  const target = username.trim().toLowerCase();
  if (!target) return false;
  return adminUsernames().some((u) => u.toLowerCase() === target);
}
