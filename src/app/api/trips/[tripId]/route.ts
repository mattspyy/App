import { NextRequest, NextResponse } from "next/server";
import { deleteTrip, getTrip } from "@/lib/notionTrips";

export const runtime = "nodejs";

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
    const trip = await getTrip(userId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
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
    const ok = await deleteTrip(userId, tripId);
    if (!ok) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    return NextResponse.json({ deleted: tripId });
  } catch (err) {
    console.error("/api/trips/[tripId] DELETE error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
