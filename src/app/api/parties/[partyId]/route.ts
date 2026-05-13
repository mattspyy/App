import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ partyId: string }> },
) {
  const { partyId } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId || !partyId) {
    return NextResponse.json({ error: "userId and partyId are required" }, { status: 400 });
  }
  const supabase = getSupabase();

  const { data: party, error: fetchErr } = await supabase
    .from("parties")
    .select("id, created_by")
    .eq("id", partyId)
    .maybeSingle();
  if (fetchErr) {
    console.error("/api/parties/[partyId] DELETE fetch error", fetchErr);
    return NextResponse.json({ error: "Failed to look up group" }, { status: 500 });
  }
  if (!party) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (party.created_by !== userId) {
    return NextResponse.json({ error: "Only the group creator can delete this group" }, { status: 403 });
  }

  const { error: delErr } = await supabase.from("parties").delete().eq("id", partyId);
  if (delErr) {
    console.error("/api/parties/[partyId] DELETE error", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: partyId });
}
