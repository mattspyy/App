import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { BUDGET_PERIOD_TYPES, EXPENSE_CATEGORIES, type Budget, type BudgetPeriodType, type ExpenseCategory } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

async function isGroupMember(
  supabase: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("user_id", userId)
    .eq("party_id", groupId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

type Row = {
  id: string;
  group_id: string;
  trip_id: string | null;
  category: string | null;
  amount: number | string;
  currency: string;
  period_type: BudgetPeriodType;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toApi(r: Row): Budget {
  return {
    id: r.id,
    groupId: r.group_id,
    tripId: r.trip_id ?? undefined,
    category: (r.category as ExpenseCategory | null) ?? null,
    amount: typeof r.amount === "string" ? Number(r.amount) : r.amount,
    currency: r.currency,
    periodType: r.period_type,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    createdBy: r.created_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const groupId = req.nextUrl.searchParams.get("groupId") || undefined;
  const tripId = req.nextUrl.searchParams.get("tripId") || undefined;
  if (!groupId && !tripId) {
    return NextResponse.json({ error: "groupId or tripId is required" }, { status: 400 });
  }
  try {
    const supabase = getSupabase();
    let query = supabase
      .from("budgets")
      .select("id, group_id, trip_id, category, amount, currency, period_type, start_date, end_date, created_by, created_at, updated_at");
    if (groupId) query = query.eq("group_id", groupId);
    if (tripId) query = query.eq("trip_id", tripId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    const budgets = (data as Row[] | null)?.map(toApi) ?? [];
    return NextResponse.json({ budgets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      groupId?: string;
      tripId?: string | null;
      amount?: number;
      currency?: string;
      periodType?: string;
      startDate?: string | null;
      endDate?: string | null;
      category?: string | null;
    };
    const groupId = body.groupId?.trim();
    const periodType = body.periodType as BudgetPeriodType | undefined;
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    const currency = body.currency?.trim();
    const userId = body.userId?.trim();
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!groupId) return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    if (!periodType || !BUDGET_PERIOD_TYPES.includes(periodType)) {
      return NextResponse.json({ error: "periodType must be monthly or trip_total" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }
    if (!currency) return NextResponse.json({ error: "currency is required" }, { status: 400 });
    const category =
      typeof body.category === "string" && body.category.trim() ? body.category.trim() : null;
    if (category && !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json({ error: "invalid category" }, { status: 400 });
    }
    if (category && periodType !== "monthly") {
      return NextResponse.json({ error: "category budgets must be monthly" }, { status: 400 });
    }
    if (periodType === "trip_total" && !body.tripId) {
      return NextResponse.json({ error: "tripId is required for trip_total budgets" }, { status: 400 });
    }
    const supabase = getSupabase();
    if (!(await isGroupMember(supabase, userId, groupId))) {
      return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
    }

    const COLS =
      "id, group_id, trip_id, category, amount, currency, period_type, start_date, end_date, created_by, created_at, updated_at";

    if (category) {
      // Per-category budgets share (group_id, trip_id, period_type) with the group-level
      // budget, so they cannot use the unique-constraint upsert. Manage them explicitly:
      // update in place when one already exists for this category, otherwise insert.
      const { data: existing, error: findErr } = await supabase
        .from("budgets")
        .select("id")
        .eq("group_id", groupId)
        .eq("period_type", periodType)
        .eq("category", category)
        .is("trip_id", null)
        .maybeSingle();
      if (findErr) throw findErr;
      const payload = {
        group_id: groupId,
        trip_id: null,
        category,
        amount,
        currency,
        period_type: periodType,
        start_date: body.startDate ?? null,
        end_date: body.endDate ?? null,
        created_by: body.userId ?? null,
        updated_at: new Date().toISOString(),
      };
      const writer = existing
        ? supabase.from("budgets").update(payload).eq("id", (existing as { id: string }).id)
        : supabase.from("budgets").insert(payload);
      const { data, error } = await writer.select(COLS).single();
      if (error) throw error;
      return NextResponse.json({ budget: toApi(data as Row) });
    }

    const { data, error } = await supabase
      .from("budgets")
      .upsert(
        {
          group_id: groupId,
          trip_id: body.tripId ?? null,
          amount,
          currency,
          period_type: periodType,
          start_date: body.startDate ?? null,
          end_date: body.endDate ?? null,
          created_by: body.userId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "group_id,trip_id,period_type" },
      )
      .select("id, group_id, trip_id, category, amount, currency, period_type, start_date, end_date, created_by, created_at, updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ budget: toApi(data as Row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const userId = req.nextUrl.searchParams.get("userId");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { data: existing, error: loadError } = await supabase
      .from("budgets")
      .select("id, group_id")
      .eq("id", id)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    if (!(await isGroupMember(supabase, userId, (existing as { group_id: string }).group_id))) {
      return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
    }
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
