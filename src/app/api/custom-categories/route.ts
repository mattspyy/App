import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES, type CustomCategory } from "@/lib/types";

export const runtime = "nodejs";

const MAX_CUSTOM_CATEGORIES = 20;
const DEFAULT_COLOR = "#6B7280";

type Row = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
};

function toApi(r: Row): CustomCategory {
  return { id: r.id, name: r.name, color: r.color, createdAt: r.created_at };
}

function isHardcoded(name: string): boolean {
  const lower = name.toLowerCase();
  return (EXPENSE_CATEGORIES as readonly string[]).some((c) => c.toLowerCase() === lower);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("custom_categories")
      .select("id, user_id, name, color, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const categories = (data as Row[] | null)?.map(toApi) ?? [];
    return NextResponse.json({ categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { userId?: string; name?: string; color?: string };
    const userId = body.userId?.trim();
    const name = body.name?.trim();
    const color = body.color?.trim() || DEFAULT_COLOR;
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (isHardcoded(name)) {
      return NextResponse.json({ error: "Name matches a built-in category" }, { status: 400 });
    }
    const supabase = getSupabase();
    const { count, error: countErr } = await supabase
      .from("custom_categories")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countErr) throw countErr;
    if ((count ?? 0) >= MAX_CUSTOM_CATEGORIES) {
      return NextResponse.json(
        { error: `Limit reached (${MAX_CUSTOM_CATEGORIES} custom categories)` },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("custom_categories")
      .insert({ user_id: userId, name, color })
      .select("id, user_id, name, color, created_at")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Category already exists" }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ category: toApi(data as Row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const name = req.nextUrl.searchParams.get("name");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("custom_categories")
      .delete()
      .eq("user_id", userId)
      .eq("name", name);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
