// Per-user AI rate limiter. Tracks calls per userId in a sliding 60-second window.
// Limit is supplied by the caller (typically read from users.ai_calls_per_minute).
// A limit of 0 means unlimited (admin bypass).

import { getSupabase } from "./supabase";

type Bucket = { count: number; windowStart: number };

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 2;
const buckets = new Map<string, Bucket>();

export type AiRateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  unlimited: boolean;
};

export function checkAiRateLimit(userId: string, limit: number): AiRateLimitResult {
  const now = Date.now();
  if (limit <= 0) {
    return { ok: true, limit: 0, remaining: Infinity, resetAt: now, unlimited: true };
  }
  const existing = buckets.get(userId);
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    if (buckets.size > 1000) {
      for (const [k, v] of buckets) {
        if (now - v.windowStart >= WINDOW_MS) buckets.delete(k);
      }
    }
    const bucket: Bucket = { count: 1, windowStart: now };
    buckets.set(userId, bucket);
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: bucket.windowStart + WINDOW_MS,
      unlimited: false,
    };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: existing.windowStart + WINDOW_MS,
      unlimited: false,
    };
  }
  existing.count += 1;
  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.windowStart + WINDOW_MS,
    unlimited: false,
  };
}

// Fetches the user's configured limit. Returns 0 (unlimited) for admin
// usernames listed in ADMIN_USERNAMES. Returns DEFAULT_LIMIT on any Supabase
// error so a missing column or transient failure doesn't break AI calls.
export async function fetchUserAiLimit(userId: string): Promise<number> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("ai_calls_per_minute")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return DEFAULT_LIMIT;
    const value = (data as { ai_calls_per_minute?: number | null }).ai_calls_per_minute;
    if (value == null) return DEFAULT_LIMIT;
    if (!Number.isFinite(value) || value < 0) return DEFAULT_LIMIT;
    return Math.floor(value);
  } catch (err) {
    console.error("[aiRateLimit] fetchUserAiLimit failed", err);
    return DEFAULT_LIMIT;
  }
}

// Convenience wrapper: fetch limit then check.
export async function enforceAiRateLimit(userId: string): Promise<AiRateLimitResult> {
  const limit = await fetchUserAiLimit(userId);
  return checkAiRateLimit(userId, limit);
}
