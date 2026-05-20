import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ userId: string }> },
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { userId } = await ctx.params;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  let body: { aiCallsPerMinute?: number } = {};
  try {
    body = (await req.json()) as { aiCallsPerMinute?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const value = body.aiCallsPerMinute;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000) {
    return NextResponse.json(
      { error: "aiCallsPerMinute must be a non-negative integer (0 = unlimited)" },
      { status: 400 },
    );
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("users")
      .update({ ai_calls_per_minute: Math.floor(value) })
      .eq("id", userId)
      .select("id, username, ai_calls_per_minute")
      .maybeSingle();
    if (error) {
      console.error("[admin/users/rate-limit] update error", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user: data });
  } catch (err) {
    console.error("[admin/users/rate-limit] handler error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
