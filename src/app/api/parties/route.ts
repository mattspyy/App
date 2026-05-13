import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { generateCode } from "@/lib/auth";
import type { Party } from "@/lib/types";

export const runtime = "nodejs";

type PartyRow = {
  id: string;
  party_name: string;
  type: "private" | "public";
  party_code: string | null;
  created_by: string;
  created_at: string;
};

function fromRow(p: PartyRow): Party {
  return {
    partyId: p.id,
    partyName: p.party_name,
    type: p.type,
    partyCode: p.party_code ?? undefined,
    createdBy: p.created_by,
    createdAt: p.created_at,
  };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
  const supabase = getSupabase();
  const { data: rows, error } = await supabase
    .from("party_members")
    .select("party_id, parties:party_id (id, party_name, type, party_code, created_by, created_at)")
    .eq("user_id", userId);
  if (error) {
    console.error("/api/parties GET error", error);
    return NextResponse.json({ error: "Failed to load parties" }, { status: 500 });
  }
  type Row = { parties: PartyRow | PartyRow[] | null };
  const parties: Party[] = ((rows as Row[]) || [])
    .flatMap((r) => (Array.isArray(r.parties) ? r.parties : r.parties ? [r.parties] : []))
    .map(fromRow);
  return NextResponse.json({ parties });
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; partyName?: string; type?: "private" | "public" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId || !body.partyName || (body.type !== "private" && body.type !== "public")) {
    return NextResponse.json({ error: "userId, partyName, and type (private|public) are required" }, { status: 400 });
  }
  const supabase = getSupabase();
  let partyCode: string | null = null;
  if (body.type === "public") {
    partyCode = generateCode(6);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: clash } = await supabase.from("parties").select("id").eq("party_code", partyCode).maybeSingle();
      if (!clash) break;
      partyCode = generateCode(6);
    }
  }
  const { data, error } = await supabase
    .from("parties")
    .insert({
      party_name: body.partyName.slice(0, 100),
      type: body.type,
      party_code: partyCode,
      created_by: body.userId,
    })
    .select("id, party_name, type, party_code, created_by, created_at")
    .single();
  if (error || !data) {
    console.error("/api/parties POST error", error);
    return NextResponse.json({ error: "Failed to create party" }, { status: 500 });
  }
  const { error: memberError } = await supabase
    .from("party_members")
    .insert({ party_id: data.id, user_id: body.userId });
  if (memberError) {
    console.error("/api/parties POST member error", memberError);
    return NextResponse.json({ error: "Created party but failed to add owner as member" }, { status: 500 });
  }
  return NextResponse.json({ party: fromRow(data as PartyRow) });
}
