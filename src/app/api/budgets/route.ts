import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { BUDGET_PERIOD_TYPES, type Budget, type BudgetPeriodType } from "@/lib/types";

export const runtime = "nodejs";

type Row = {
  id: string;
  group_id: string;
  trip_id: string | null;
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
      .select("id, group_id, trip_id, amount, currency, period_type, start_date, end_date, created_by, created_at, updated_at");
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
    };
    const groupId = body.groupId?.trim();
    const periodType = body.periodType as BudgetPeriodType | undefined;
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    const currency = body.currency?.trim();
    if (!groupId) return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    if (!periodType || !BUDGET_PERIOD_TYPES.includes(periodType)) {
      return NextResponse.json({ error: "periodType must be monthly or trip_total" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount must be a non-negative number" }, { status: 400 });
    }
    if (!currency) return NextResponse.json({ error: "currency is required" }, { status: 400 });
    if (periodType === "trip_total" && !body.tripId) {
      return NextResponse.json({ error: "tripId is required for trip_total budgets" }, { status: 400 });
    }
    const supabase = getSupabase();
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
      .select("id, group_id, trip_id, amount, currency, period_type, start_date, end_date, created_by, created_at, updated_at")
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
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
