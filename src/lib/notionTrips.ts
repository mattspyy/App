/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "@notionhq/client";
import type { Trip } from "./types";

function getClient(): Client {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");
  return new Client({ auth: token });
}

function getTripsDbId(): string {
  const id = process.env.NOTION_TRIPS_DATABASE_ID;
  if (!id) throw new Error("NOTION_TRIPS_DATABASE_ID is not set (run scripts/migrate-notion-v2.mjs)");
  return id;
}

function richText(value: string | undefined | null) {
  if (!value) return { rich_text: [] as any[] };
  return { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] };
}
function title(value: string) {
  return { title: [{ text: { content: (value || "Untitled").slice(0, 1900) } }] };
}
function selectOption(value: string | undefined | null) {
  if (!value) return { select: null };
  return { select: { name: String(value).slice(0, 100) } };
}
function numberValue(value: number | undefined | null) {
  return { number: typeof value === "number" && Number.isFinite(value) ? value : null };
}
function dateValue(value: string | undefined | null) {
  if (!value) return { date: null };
  return { date: { start: value } };
}

function readRichText(prop: any): string {
  if (!prop || !Array.isArray(prop.rich_text)) return "";
  return prop.rich_text.map((t: any) => t.plain_text || "").join("");
}
function readTitle(prop: any): string {
  if (!prop || !Array.isArray(prop.title)) return "";
  return prop.title.map((t: any) => t.plain_text || "").join("");
}
function readSelect(prop: any): string | undefined {
  return prop?.select?.name ?? undefined;
}
function readNumber(prop: any): number | undefined {
  return typeof prop?.number === "number" ? prop.number : undefined;
}
function readDate(prop: any): string {
  return prop?.date?.start || "";
}
function readCreatedTime(prop: any): string {
  return prop?.created_time || "";
}

function fromPage(p: any): Trip {
  const props = p.properties || {};
  return {
    tripId: readRichText(props["Trip ID"]) || p.id,
    tripName: readTitle(props["Name"]) || "Untitled trip",
    familyId: readRichText(props["Family ID"]),
    destination: readRichText(props["Destination"]) || undefined,
    startDate: readDate(props["Start Date"]) || undefined,
    endDate: readDate(props["End Date"]) || undefined,
    baseCurrency: readSelect(props["Base Currency"]) || "USD",
    budget: readNumber(props["Budget"]),
    createdBy: readRichText(props["Created By"]),
    createdByName: readRichText(props["Created By Name"]) || undefined,
    notes: readRichText(props["Notes"]) || undefined,
    createdAt: readCreatedTime(props["Created At"]) || p.created_time,
  };
}

export async function createTrip(trip: Trip): Promise<string> {
  const notion = getClient();
  const res = await notion.pages.create({
    parent: { database_id: getTripsDbId() },
    properties: {
      "Name": title(trip.tripName),
      "Trip ID": richText(trip.tripId),
      "Family ID": richText(trip.familyId),
      "Destination": richText(trip.destination),
      "Start Date": dateValue(trip.startDate),
      "End Date": dateValue(trip.endDate),
      "Base Currency": selectOption(trip.baseCurrency),
      "Budget": numberValue(trip.budget),
      "Created By": richText(trip.createdBy),
      "Created By Name": richText(trip.createdByName),
      "Notes": richText(trip.notes),
    },
  });
  return res.id;
}

// Lists trips whose Family ID matches any of the given ids. Callers pass the
// user's group partyIds (plus the userId itself so legacy trips, which stored
// the creator's userId in Family ID, stay visible to their creator).
export async function listTrips(familyIds: string[]): Promise<Trip[]> {
  const ids = Array.from(new Set(familyIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const notion = getClient();
  const filters = ids.map((id) => ({ property: "Family ID", rich_text: { equals: id } }));
  const filter = filters.length === 1 ? filters[0] : { or: filters };
  const res = await notion.databases.query({
    database_id: getTripsDbId(),
    filter: filter as any,
    sorts: [{ property: "Start Date", direction: "descending" }],
    page_size: 100,
  });
  return res.results
    .filter((p: any) => p.object === "page" && p.properties)
    .map(fromPage);
}

// Looks a trip up by Trip ID alone; authorization (creator or group member)
// is the caller's responsibility.
export async function getTrip(tripId: string): Promise<Trip | null> {
  if (!tripId) return null;
  const notion = getClient();
  const res = await notion.databases.query({
    database_id: getTripsDbId(),
    filter: { property: "Trip ID", rich_text: { equals: tripId } },
    page_size: 1,
  });
  const page = res.results[0];
  if (!page) return null;
  return fromPage(page);
}


export async function deleteTrip(tripId: string): Promise<boolean> {
  if (!tripId) return false;
  const notion = getClient();
  const res = await notion.databases.query({
    database_id: getTripsDbId(),
    filter: { property: "Trip ID", rich_text: { equals: tripId } },
    page_size: 1,
  });
  const page = res.results[0];
  if (!page) return false;
  await notion.pages.update({ page_id: (page as any).id, archived: true });
  return true;
}
