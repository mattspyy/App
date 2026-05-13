import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createTrip, listTrips } from "@/lib/notionTrips";
import type { Trip } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  try {
    const trips = await listTrips(userId);
    return NextResponse.json({ trips });
  } catch (err) {
    console.error("/api/trips GET error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Trip>;
    if (!body.tripName || !body.createdBy) {
      return NextResponse.json(
        { error: "tripName and createdBy are required" },
        { status: 400 },
      );
    }
    const trip: Trip = {
      tripId: body.tripId || uuidv4(),
      tripName: body.tripName,
      familyId: body.createdBy,
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
