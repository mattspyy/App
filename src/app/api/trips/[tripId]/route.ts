import { NextRequest, NextResponse } from "next/server";
import { deleteTrip, getTrip } from "@/lib/notionTrips";
import { getSupabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";

export const runtime = "nodejs";

// A trip is visible to its creator and to members of its group. Legacy trips
// store the creator's userId in familyId, so the membership lookup simply
// finds no row and the creator check is what grants access.
async function canAccessTrip(userId: string, trip: Trip): Promise<boolean> {
  if (trip.createdBy === userId) return true;
  if (!trip.familyId) return false;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("party_id", trip.familyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("/api/trips/[tripId] membership lookup error", error);
    return false;
  }
  return !!data;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const trip = await getTrip(tripId);
    if (!trip || !(await canAccessTrip(userId, trip))) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    return NextResponse.json({ trip });
  } catch (err) {
    console.error("/api/trips/[tripId] GET error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const trip = await getTrip(tripId);
    if (!trip || !(await canAccessTrip(userId, trip))) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    if (trip.createdBy !== userId) {
      return NextResponse.json(
        { error: "Only the trip creator can delete this trip" },
        { status: 403 },
      );
    }
    const ok = await deleteTrip(tripId);
    if (!ok) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    return NextResponse.json({ deleted: tripId });
  } catch (err) {
    console.error("/api/trips/[tripId] DELETE error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
