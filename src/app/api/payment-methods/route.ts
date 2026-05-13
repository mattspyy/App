import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_NAME_LEN = 40;

type Row = { id: string; user_id: string; name: string; created_at: string };

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("custom_payment_methods")
      .select("id, user_id, name, created_at")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw error;
    const names = (data as Row[] | null)?.map((r) => r.name) ?? [];
    return NextResponse.json({ methods: names });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { userId?: string; name?: string };
    const userId = body.userId?.trim();
    const name = body.name?.trim();
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (name.length > MAX_NAME_LEN) {
      return NextResponse.json({ error: `name must be ${MAX_NAME_LEN} chars or fewer` }, { status: 400 });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("custom_payment_methods")
      .upsert({ user_id: userId, name }, { onConflict: "user_id,name" })
      .select("id, user_id, name, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ method: (data as Row).name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
