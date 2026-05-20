// Personal group helper. A user's Personal group is identified by the composite
// (created_by = userId, type = 'private', party_name = 'Personal').
// We don't add a schema flag — the existing parties table is sufficient.
//
// ensurePersonalGroup is idempotent: if a matching row already exists, the
// existing partyId is returned and no new row is created.

import type { SupabaseClient } from "@supabase/supabase-js";

const PERSONAL_NAME = "Personal";

type PartyRow = { id: string; created_at: string };

export async function findPersonalGroup(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parties")
    .select("id, created_at")
    .eq("created_by", userId)
    .eq("type", "private")
    .eq("party_name", PERSONAL_NAME)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    console.error("[personalGroup] findPersonalGroup error", error);
    return null;
  }
  const rows = (data as PartyRow[] | null) || [];
  return rows.length > 0 ? rows[0].id : null;
}

export async function ensurePersonalGroup(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const existing = await findPersonalGroup(supabase, userId);
  if (existing) return existing;

  const { data: party, error: partyError } = await supabase
    .from("parties")
    .insert({
      party_name: PERSONAL_NAME,
      type: "private",
      party_code: null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (partyError || !party) {
    // 23505 = Postgres unique_violation. A concurrent registration retry
    // already inserted the Personal group; reuse it instead of failing.
    const code = (partyError as { code?: string } | null)?.code;
    if (code === "23505") {
      const existingId = await findPersonalGroup(supabase, userId);
      if (existingId) return existingId;
    }
    console.error("[personalGroup] insert party error", partyError);
    return null;
  }

  const { error: memberError } = await supabase
    .from("party_members")
    .insert({ party_id: party.id, user_id: userId });
  if (memberError) {
    console.error("[personalGroup] insert member error", memberError);
    // The party exists but membership failed; the user wouldn't see the group
    // via /api/parties (which joins through party_members). Return null so the
    // caller treats it as a failure to provision.
    return null;
  }

  return party.id;
}

export const PERSONAL_GROUP_NAME = PERSONAL_NAME;
