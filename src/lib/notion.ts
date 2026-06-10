/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from "@notionhq/client";
import type {
  ExpenseCategory,
  ExpenseItem,
  DuplicateCheckStatus,
  ExpenseRecord,
  ExpenseStatus,
  ExpenseType,
  SourceType,
  SplitParticipant,
  SplitType,
} from "./types";

function getClient(): Client {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("NOTION_TOKEN is not set");
  return new Client({ auth: token });
}

function getDatabaseId(): string {
  const id = process.env.NOTION_DATABASE_ID;
  if (!id) throw new Error("NOTION_DATABASE_ID is not set");
  return id;
}

function richText(value: string | undefined | null) {
  if (!value) return { rich_text: [] as any[] };
  return { rich_text: [{ text: { content: String(value).slice(0, 1900) } }] };
}

function title(value: string | undefined | null) {
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

function urlValue(value: string | undefined | null) {
  return { url: value || null };
}

function jsonRichText(value: unknown) {
  if (value === undefined || value === null) return { rich_text: [] as any[] };
  return richText(JSON.stringify(value));
}

function buildExpenseProperties(rec: ExpenseRecord): Record<string, any> {
  return {
    "Name": title(rec.merchant || "Untitled"),
    "Record ID": richText(rec.id),
    "Family ID": richText(rec.familyId),
    "Trip ID": richText(rec.tripId),
    "User ID": richText(rec.userId),
    "User Name": richText(rec.userName),
    "Payer ID": richText(rec.payerId),
    "Payer Name": richText(rec.payerName),
    "Amount": numberValue(rec.amount),
    "Currency": selectOption(rec.currency),
    "Base Amount": numberValue(rec.baseAmount),
    "Base Currency": selectOption(rec.baseCurrency),
    "Exchange Rate": numberValue(rec.exchangeRate),
    "Exchange Rate Date": dateValue(rec.exchangeRateDate),
    "Category": selectOption(rec.category),
    "Country": richText(rec.country),
    "Date": dateValue(rec.date),
    "Payment Method": selectOption(rec.paymentMethod),
    "Source Type": selectOption(rec.sourceType),
    "Status": selectOption(rec.status || "confirmed"),
    "Duplicate Check Status": selectOption(rec.duplicateCheckStatus || "none"),
    "Missing Fields": jsonRichText(rec.missingFields),
    "Expense Type": selectOption(rec.expenseType || "one_time"),
    "Spread Start Date": dateValue(rec.spreadStartDate),
    "Spread End Date": dateValue(rec.spreadEndDate),
    "Daily Allocated Amount": numberValue(rec.dailyAllocatedAmount),
    "Split Type": selectOption(rec.splitType),
    "Split Participants": jsonRichText(rec.participants),
    "Items JSON": jsonRichText(rec.items),
    "Image URL": urlValue(rec.imageUrl),
    "AI Confidence": numberValue(rec.aiConfidence),
    "Notes": richText(rec.notes),
  };
}

export async function createExpense(rec: ExpenseRecord): Promise<string> {
  const notion = getClient();
  const res = await notion.pages.create({
    parent: { database_id: getDatabaseId() },
    properties: buildExpenseProperties(rec),
  });
  return res.id;
}

export async function updateExpense(pageId: string, rec: ExpenseRecord): Promise<void> {
  const notion = getClient();
  await notion.pages.update({
    page_id: pageId,
    properties: buildExpenseProperties(rec),
  });
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
function readUrl(prop: any): string | undefined {
  return prop?.url || undefined;
}
function readCreatedTime(prop: any): string {
  return prop?.created_time || "";
}
function normalizeSplitType(value: string | undefined): SplitType | undefined {
  if (!value) return undefined;
  if (value === "equal") return "equal_split";
  if (value === "not_split") return "no_split";
  if (value === "custom_percentage") return "custom_amount";
  if (value === "equal_split" || value === "no_split" || value === "custom_amount") return value;
  return undefined;
}

function readJsonRichText<T>(prop: any): T | undefined {
  const raw = readRichText(prop);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export type ListExpensesOptions = {
  familyId?: string;
  tripId?: string;
  /** When true, restrict to expenses with no Trip ID. Useful for "group-only" views. */
  excludeTripExpenses?: boolean;
  /** Restrict to a specific Status value (e.g. "needs_review"). */
  status?: ExpenseStatus;
  /** Inclusive lower bound on Date (YYYY-MM-DD). */
  dateOnOrAfter?: string;
  /** Inclusive upper bound on Date (YYYY-MM-DD). */
  dateOnOrBefore?: string;
};

export async function listExpenses(opts: ListExpensesOptions): Promise<ExpenseRecord[]> {
  if (!opts.familyId && !opts.tripId) {
    throw new Error("listExpenses requires familyId or tripId");
  }
  const notion = getClient();
  const filters: any[] = [];
  if (opts.familyId) filters.push({ property: "Family ID", rich_text: { equals: opts.familyId } });
  if (opts.tripId) filters.push({ property: "Trip ID", rich_text: { equals: opts.tripId } });
  if (opts.excludeTripExpenses && !opts.tripId) {
    filters.push({ property: "Trip ID", rich_text: { is_empty: true } });
  }
  if (opts.status) {
    filters.push({ property: "Status", select: { equals: opts.status } });
  }
  if (opts.dateOnOrAfter) {
    filters.push({ property: "Date", date: { on_or_after: opts.dateOnOrAfter } });
  }
  if (opts.dateOnOrBefore) {
    filters.push({ property: "Date", date: { on_or_before: opts.dateOnOrBefore } });
  }
  const filter = filters.length === 1 ? filters[0] : { and: filters };
  const allResults: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await notion.databases.query({
      database_id: getDatabaseId(),
      filter,
      sorts: [{ property: "Date", direction: "descending" }],
      page_size: 100,
      start_cursor: cursor,
    });
    allResults.push(...res.results);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return allResults
    .filter((p: any) => p.object === "page" && p.properties)
    .map((p: any): ExpenseRecord => mapPageToRecord(p));
}

function mapPageToRecord(p: any): ExpenseRecord {
  const props = p.properties;
  return {
        id: readRichText(props["Record ID"]) || p.id,
        familyId: readRichText(props["Family ID"]),
        tripId: readRichText(props["Trip ID"]) || undefined,
        userId: readRichText(props["User ID"]),
        userName: readRichText(props["User Name"]),
        payerId: readRichText(props["Payer ID"]) || undefined,
        payerName: readRichText(props["Payer Name"]) || undefined,
        merchant: readTitle(props["Name"]) || undefined,
        amount: readNumber(props["Amount"]) ?? 0,
        currency: readSelect(props["Currency"]) || "USD",
        baseAmount: readNumber(props["Base Amount"]),
        baseCurrency: readSelect(props["Base Currency"]),
        exchangeRate: readNumber(props["Exchange Rate"]),
        exchangeRateDate: readDate(props["Exchange Rate Date"]) || undefined,
        category: (readSelect(props["Category"]) as ExpenseCategory) || "Other",
        country: readRichText(props["Country"]) || undefined,
        date: readDate(props["Date"]),
        paymentMethod: readSelect(props["Payment Method"]),
        sourceType: (readSelect(props["Source Type"]) as SourceType) || "manual",
        status: (readSelect(props["Status"]) as ExpenseStatus) || "confirmed",
        duplicateCheckStatus: (readSelect(props["Duplicate Check Status"]) as DuplicateCheckStatus) || "none",
        missingFields: readJsonRichText<string[]>(props["Missing Fields"]),
        expenseType: (readSelect(props["Expense Type"]) as ExpenseType) || "one_time",
        spreadStartDate: readDate(props["Spread Start Date"]) || undefined,
        spreadEndDate: readDate(props["Spread End Date"]) || undefined,
        dailyAllocatedAmount: readNumber(props["Daily Allocated Amount"]),
        splitType: normalizeSplitType(readSelect(props["Split Type"])),
        participants: readJsonRichText<SplitParticipant[]>(props["Split Participants"]),
        items: readJsonRichText<ExpenseItem[]>(props["Items JSON"]),
        imageUrl: readUrl(props["Image URL"]),
        aiConfidence: readNumber(props["AI Confidence"]),
        notes: readRichText(props["Notes"]) || undefined,
        createdAt: readCreatedTime(props["Created At"]) || p.created_time,
  };
}

export async function findExpensePage(
  recordId: string,
): Promise<{ pageId: string; record: ExpenseRecord } | null> {
  if (!recordId) return null;
  const notion = getClient();
  const res = await notion.databases.query({
    database_id: getDatabaseId(),
    filter: { property: "Record ID", rich_text: { equals: recordId } },
    page_size: 1,
  });
  const page = res.results.find((pp: any) => pp.object === "page" && pp.properties);
  if (!page) return null;
  return { pageId: (page as any).id, record: mapPageToRecord(page) };
}
