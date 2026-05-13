import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { comparePin, isValidPin, isValidUsername, normalizeUsername } from "@/lib/auth";

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
