import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("users")
      .select("id, username, invite_code, base_currency, ai_calls_per_minute, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/users] list error", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    return NextResponse.json({ users: data || [] });
  } catch (err) {
    console.error("[admin/users] handler error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
