import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createTrip, listTrips } from "@/lib/notionTrips";
import { getSupabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";

export const runtime = "nodejs";

async function listUserGroupIds(userId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load group memberships: ${error.message}`);
  return ((data as Array<{ party_id: string }> | null) || []).map((r) => r.party_id);
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const groupIds = await listUserGroupIds(userId);
    // The createdBy branch covers standalone trips (empty Family ID) and
    // legacy trips (Family ID = creator's userId): both are creator-only.
    const trips = await listTrips(groupIds, userId);
    return NextResponse.json({ trips });
  } catch (err) {
    console.error("/api/trips GET error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Trip> & { groupId?: string };
    if (!body.tripName || !body.createdBy) {
      return NextResponse.json(
        { error: "tripName and createdBy are required" },
        { status: 400 },
      );
    }
    // groupId is optional: a trip linked to a group is visible to its members;
    // a standalone trip (no group) stores an empty familyId and is visible to
    // its creator only.
    if (body.groupId) {
      const supabase = getSupabase();
      const { data: member, error: memberErr } = await supabase
        .from("party_members")
        .select("party_id")
        .eq("party_id", body.groupId)
        .eq("user_id", body.createdBy)
        .maybeSingle();
      if (memberErr) {
        console.error("/api/trips POST membership lookup error", memberErr);
        return NextResponse.json({ error: "Failed to verify group membership" }, { status: 500 });
      }
      if (!member) {
        return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
      }
    }
    const trip: Trip = {
      tripId: body.tripId || uuidv4(),
      tripName: body.tripName,
      familyId: body.groupId || "",
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      baseCurrency: body.baseCurrency || "USD",
      budget: typeof body.budget === "number" ? body.budget : undefined,
      createdBy: body.createdBy,
      createdByName: body.createdByName,
      notes: body.notes,
      createdAt: new Date().toISOString(),
    };
    const notionId = await createTrip(trip);
    return NextResponse.json({ notionId, trip });
  } catch (err) {
    console.error("/api/trips POST error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
