import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Two modes:
// 1. Public join:  body = { userId, partyCode }       → caller joins the public party.
// 2. Private invite: body = { userId, partyId, inviteCode } → admin (=userId, must be createdBy of partyId) adds the user whose invite_code matches inviteCode.
export async function POST(req: NextRequest) {
  let body: { userId?: string; partyCode?: string; partyId?: string; inviteCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const supabase = getSupabase();

  if (body.partyCode) {
    const code = body.partyCode.trim().toUpperCase();
    const { data: party } = await supabase
      .from("parties")
      .select("id, type, party_name, party_code, created_by, created_at")
      .eq("party_code", code)
      .maybeSingle();
    if (!party) return NextResponse.json({ error: "Party code not found" }, { status: 404 });
    if (party.type !== "public") return NextResponse.json({ error: "This party is private" }, { status: 403 });
    const { error } = await supabase
      .from("party_members")
      .upsert({ party_id: party.id, user_id: body.userId }, { onConflict: "party_id,user_id" });
    if (error) {
      console.error("/api/parties/join public error", error);
      return NextResponse.json({ error: "Failed to join party" }, { status: 500 });
    }
    return NextResponse.json({
      party: {
        partyId: party.id,
        partyName: party.party_name,
        type: party.type,
        partyCode: party.party_code ?? undefined,
        createdBy: party.created_by,
        createdAt: party.created_at,
      },
    });
  }

  if (body.partyId && body.inviteCode) {
    const { data: party } = await supabase
      .from("parties")
      .select("id, created_by, type")
      .eq("id", body.partyId)
      .maybeSingle();
    if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
    if (party.created_by !== body.userId) {
      return NextResponse.json({ error: "Only the party admin can invite members" }, { status: 403 });
    }
    const invite = body.inviteCode.trim().toUpperCase();
    const { data: target } = await supabase
      .from("users")
      .select("id, username")
      .eq("invite_code", invite)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "Invite code not found" }, { status: 404 });
    const { error } = await supabase
      .from("party_members")
      .upsert({ party_id: party.id, user_id: target.id }, { onConflict: "party_id,user_id" });
    if (error) {
      console.error("/api/parties/join private error", error);
      return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
    }
    return NextResponse.json({ added: { userId: target.id, username: target.username } });
  }

  return NextResponse.json(
    { error: "Provide either { partyCode } to join a public party, or { partyId, inviteCode } to invite a user." },
    { status: 400 },
  );
}
