import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { PartyMember } from "@/lib/types";

export const runtime = "nodejs";

type UserRow = { id: string; username: string; invite_code: string };
type MemberRow = { user_id: string; joined_at: string; users: UserRow | UserRow[] | null };

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partyId: string }> },
) {
  const { partyId } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const supabase = getSupabase();

  const { data: caller } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("party_id", partyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!caller) return NextResponse.json({ error: "Not a member of this party" }, { status: 403 });

  const { data, error } = await supabase
    .from("party_members")
    .select("user_id, joined_at, users:user_id (id, username, invite_code)")
    .eq("party_id", partyId)
    .order("joined_at", { ascending: true });
  if (error) {
    console.error("/api/parties/[partyId]/members error", error);
    return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
  }
  const members: PartyMember[] = ((data as MemberRow[]) || [])
    .map((row) => {
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!u) return null;
      return { userId: u.id, username: u.username, inviteCode: u.invite_code, joinedAt: row.joined_at };
    })
    .filter((m): m is PartyMember => m !== null);
  return NextResponse.json({ members });
}
