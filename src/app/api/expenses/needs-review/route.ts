import { NextRequest, NextResponse } from "next/server";
import { listExpenses } from "@/lib/notion";
import { getSupabase } from "@/lib/supabase";
import type { ExpenseRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("party_members")
      .select("party_id")
      .eq("user_id", userId);
    if (error) throw error;
    const groupIds = ((data as Array<{ party_id: string }> | null) || []).map((r) => r.party_id);
    if (groupIds.length === 0) {
      return NextResponse.json({ records: [] });
    }
    const lists = await Promise.all(
      groupIds.map((familyId) =>
        listExpenses({ familyId, status: "needs_review" }).catch((err) => {
          console.warn("/api/expenses/needs-review group fetch failed", familyId, err);
          return [] as ExpenseRecord[];
        }),
      ),
    );
    const merged = lists.flat().sort((a, b) => (a.date < b.date ? 1 : -1));
    return NextResponse.json({ records: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
