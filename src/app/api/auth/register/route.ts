import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateCode, hashPin, isValidPin, isValidUsername, normalizeUsername } from "@/lib/auth";

export const runtime = "nodejs";

type PostgrestError = { message?: string; code?: string; details?: string; hint?: string };

function describe(prefix: string, err: unknown): { error: string; supabase?: PostgrestError } {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as PostgrestError;
    return {
      error: `${prefix}: ${e.message || "unknown"}${e.code ? ` (code ${e.code})` : ""}`,
      supabase: { message: e.message, code: e.code, details: e.details, hint: e.hint },
    };
  }
  return { error: `${prefix}: ${err instanceof Error ? err.message : String(err)}` };
}

export async function POST(req: NextRequest) {
  try {
    let body: { username?: string; pin?: string; baseCurrency?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!isValidUsername(body.username)) {
      return NextResponse.json({ error: "Username must be 3-30 alphanumeric/underscore chars" }, { status: 400 });
    }
    if (!isValidPin(body.pin)) {
      return NextResponse.json({ error: "PIN must be 4 digits" }, { status: 400 });
    }

    const username = normalizeUsername(body.username);
    const supabase = getSupabase();

    const existingRes = await supabase.from("users").select("id").eq("username", username).maybeSingle();
    if (existingRes.error) {
      console.error("[register] username lookup error", existingRes.error);
      return NextResponse.json(describe("Lookup failed", existingRes.error), { status: 500 });
    }
    if (existingRes.data) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const pinHash = await hashPin(body.pin);
    let inviteCode = generateCode(6);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clashRes = await supabase.from("users").select("id").eq("invite_code", inviteCode).maybeSingle();
      if (clashRes.error) {
        console.error("[register] invite-code lookup error", clashRes.error);
        return NextResponse.json(describe("Invite-code lookup failed", clashRes.error), { status: 500 });
      }
      if (!clashRes.data) break;
      inviteCode = generateCode(6);
    }

    const baseCurrency = typeof body.baseCurrency === "string" && body.baseCurrency.length <= 5 ? body.baseCurrency : "HKD";

    const insertRes = await supabase
      .from("users")
      .insert({ username, pin_hash: pinHash, invite_code: inviteCode, base_currency: baseCurrency })
      .select("id, username, invite_code, base_currency")
      .single();
    if (insertRes.error || !insertRes.data) {
      console.error("[register] insert error", insertRes.error);
      return NextResponse.json(describe("Failed to create account", insertRes.error), { status: 500 });
    }
    const data = insertRes.data;
    return NextResponse.json({
      session: {
        userId: data.id,
        username: data.username,
        inviteCode: data.invite_code,
        baseCurrency: data.base_currency,
      },
    });
  } catch (err) {
    console.error("[register] unhandled error", err);
    return NextResponse.json(describe("Register handler threw", err), { status: 500 });
  }
}
