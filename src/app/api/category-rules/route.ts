import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";

export const runtime = "nodejs";

type Row = {
  id: string;
  user_id: string;
  group_id: string | null;
  merchant_keyword: string;
  category: string;
  created_at: string;
};

export type CategoryRuleApi = {
  id: string;
  userId: string;
  groupId?: string;
  merchantKeyword: string;
  category: ExpenseCategory;
  createdAt: string;
};

function toApi(r: Row): CategoryRuleApi {
  return {
    id: r.id,
    userId: r.user_id,
    groupId: r.group_id ?? undefined,
    merchantKeyword: r.merchant_keyword,
    category: r.category as ExpenseCategory,
    createdAt: r.created_at,
  };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("category_rules")
      .select("id, user_id, group_id, merchant_keyword, category, created_at")
      .eq("user_id", userId)
      .order("merchant_keyword", { ascending: true });
    if (error) throw error;
    const rules = (data as Row[] | null)?.map(toApi) ?? [];
    return NextResponse.json({ rules });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      groupId?: string | null;
      merchantKeyword?: string;
      category?: string;
    };
    const userId = body.userId?.trim();
    const keyword = body.merchantKeyword?.trim();
    const category =
      typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!keyword) return NextResponse.json({ error: "merchantKeyword is required" }, { status: 400 });
    if (!category) {
      return NextResponse.json({ error: "category must be one of the supported values" }, { status: 400 });
    }
    const supabase = getSupabase();
    // Accept a built-in category, or one of this user's own custom categories.
    if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
      const { data: cc, error: ccErr } = await supabase
        .from("custom_categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", category)
        .maybeSingle();
      if (ccErr) throw ccErr;
      if (!cc) {
        return NextResponse.json({ error: "category must be one of the supported values" }, { status: 400 });
      }
    }
    const { data, error } = await supabase
      .from("category_rules")
      .upsert(
        {
          user_id: userId,
          group_id: body.groupId ?? null,
          merchant_keyword: keyword,
          category,
        },
        { onConflict: "user_id,group_id,merchant_keyword" },
      )
      .select("id, user_id, group_id, merchant_keyword, category, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ rule: toApi(data as Row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
