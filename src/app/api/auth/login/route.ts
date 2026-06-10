import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { comparePin, isValidPin, isValidUsername, normalizeUsername } from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { username?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isValidUsername(body.username) || !isValidPin(body.pin)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const username = normalizeUsername(body.username);
  // Brute-force protection: limit attempts per IP + username pair.
  const limit = rateLimit(`login:${clientKey(req)}:${username}`);
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, pin_hash, invite_code, base_currency")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    console.error("login query error", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await comparePin(body.pin, data.pin_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  return NextResponse.json({
    session: {
      userId: data.id,
      username: data.username,
      inviteCode: data.invite_code,
      baseCurrency: data.base_currency,
    },
  });
}
