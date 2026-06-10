import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  let body: { userId?: string; baseCurrency?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const userId = body.userId?.trim();
  const baseCurrency = body.baseCurrency?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  // Same constraint as registration: a short currency code.
  if (!baseCurrency || baseCurrency.length > 5) {
    return NextResponse.json({ error: "baseCurrency is required (max 5 chars)" }, { status: 400 });
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("users")
      .update({ base_currency: baseCurrency })
      .eq("id", userId)
      .select("id, base_currency")
      .maybeSingle();
    if (error) {
      console.error("/api/users/me PATCH error", error);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("/api/users/me PATCH handler error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
