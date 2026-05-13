import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

type Row = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number | string;
  currency: string;
  group_id: string;
  trip_id: string | null;
  date: string;
  status: "pending" | "paid";
  created_at: string;
};

export type SettlementPaymentApi = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  groupId: string;
  tripId?: string;
  date: string;
  status: "pending" | "paid";
  createdAt: string;
};

function toApi(r: Row): SettlementPaymentApi {
  return {
    id: r.id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    amount: typeof r.amount === "string" ? Number(r.amount) : r.amount,
    currency: r.currency,
    groupId: r.group_id,
    tripId: r.trip_id ?? undefined,
    date: r.date,
    status: r.status,
    createdAt: r.created_at,
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
      .from("settlement_payments")
      .select("id, from_user_id, to_user_id, amount, currency, group_id, trip_id, date, status, created_at");
    if (groupId) query = query.eq("group_id", groupId);
    if (tripId) query = query.eq("trip_id", tripId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    const payments = (data as Row[] | null)?.map(toApi) ?? [];
    return NextResponse.json({ payments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fromUserId?: string;
      toUserId?: string;
      amount?: number;
      currency?: string;
      groupId?: string;
      tripId?: string | null;
      date?: string;
      status?: "pending" | "paid";
    };
    const fromUserId = body.fromUserId?.trim();
    const toUserId = body.toUserId?.trim();
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
    const currency = body.currency?.trim();
    const groupId = body.groupId?.trim();
    if (!fromUserId || !toUserId) {
      return NextResponse.json({ error: "fromUserId and toUserId are required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    if (!currency) return NextResponse.json({ error: "currency is required" }, { status: 400 });
    if (!groupId) return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    const status = body.status === "pending" ? "pending" : "paid";
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("settlement_payments")
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        currency,
        group_id: groupId,
        trip_id: body.tripId ?? null,
        date: body.date || new Date().toISOString().slice(0, 10),
        status,
      })
      .select("id, from_user_id, to_user_id, amount, currency, group_id, trip_id, date, status, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ payment: toApi(data as Row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
