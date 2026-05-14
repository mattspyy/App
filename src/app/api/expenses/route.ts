import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createExpense, listExpenses } from "@/lib/notion";
import { convertAmount } from "@/lib/exchangeRate";
import type { DuplicateCheckStatus, ExpenseCategory, ExpenseRecord, ExpenseStatus, ExpenseType, SourceType, SplitType } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULT_BASE = "HKD";

function deriveStatus(body: Partial<ExpenseRecord>): ExpenseStatus {
  if (body.status === "draft" || body.status === "needs_review" || body.status === "confirmed") {
    return body.status;
  }
  const hasAmount = typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0;
  const hasDate = !!body.date;
  const hasTarget = !!(body.familyId || body.tripId);
  if (!hasAmount || !hasDate || !hasTarget) return "draft";
  return "confirmed";
}

function normalizeMerchant(value: string | undefined | null): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function merchantsSimilar(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = normalizeMerchant(a);
  const nb = normalizeMerchant(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.includes(na)) return true;
  if (nb.length >= 3 && na.includes(nb)) return true;
  return false;
}

function amountsSimilar(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const diff = Math.abs(a - b);
  if (diff <= 0.5) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  return denom > 0 && diff / denom <= 0.02;
}

function datesWithinOneDay(a: string, b: string): boolean {
  if (!a || !b) return false;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return false;
  return Math.abs(da - db) <= 24 * 60 * 60 * 1000;
}

function computeMissingFields(record: ExpenseRecord): string[] {
  const missing: string[] = [];
  if (!record.merchant || !record.merchant.trim()) missing.push("merchant");
  if (!Number.isFinite(record.amount) || record.amount <= 0) missing.push("amount");
  if (!record.date) missing.push("date");
  if (!record.currency) missing.push("currency");
  if (!record.category) missing.push("category");
  return missing;
}

const DUPLICATE_SCAN_WINDOW_DAYS = 3;

function shiftIso(date: string, days: number): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function findPossibleDuplicates(record: ExpenseRecord): Promise<ExpenseRecord[]> {
  if (!record.familyId || !record.date) return [];
  try {
    const existing = await listExpenses({
      familyId: record.familyId,
      dateOnOrAfter: shiftIso(record.date, -DUPLICATE_SCAN_WINDOW_DAYS),
      dateOnOrBefore: shiftIso(record.date, DUPLICATE_SCAN_WINDOW_DAYS),
    });
    return existing.filter((r) =>
      r.id !== record.id
      && r.currency === record.currency
      && amountsSimilar(r.amount, record.amount)
      && datesWithinOneDay(r.date, record.date)
      && merchantsSimilar(r.merchant, record.merchant),
    );
  } catch (err) {
    console.warn("/api/expenses duplicate scan failed", err);
    return [];
  }
}

async function fillBaseAmount(record: ExpenseRecord, baseCurrency: string): Promise<ExpenseRecord> {
  if (
    record.baseCurrency === baseCurrency &&
    typeof record.baseAmount === "number" &&
    typeof record.exchangeRate === "number"
  ) {
    return record;
  }
  if (record.currency === baseCurrency) {
    return { ...record, baseCurrency, baseAmount: record.amount, exchangeRate: 1 };
  }
  const converted = await convertAmount(record.amount, record.currency, baseCurrency, record.date);
  if (!converted) {
    return { ...record, baseCurrency };
  }
  return {
    ...record,
    baseCurrency,
    exchangeRate: converted.rate,
    exchangeRateDate: record.date,
    baseAmount: Number(converted.baseAmount.toFixed(2)),
  };
}

export async function GET(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get("familyId") || undefined;
  const tripId = req.nextUrl.searchParams.get("tripId") || undefined;
  const baseCurrency = req.nextUrl.searchParams.get("baseCurrency") || DEFAULT_BASE;
  const excludeTripExpenses = req.nextUrl.searchParams.get("excludeTripExpenses") === "1";
  if (!familyId && !tripId) {
    return NextResponse.json({ error: "familyId or tripId is required" }, { status: 400 });
  }
  try {
    const records = await listExpenses({ familyId, tripId, excludeTripExpenses });
    const enriched = await Promise.all(records.map((r) => fillBaseAmount(r, baseCurrency)));
    return NextResponse.json({ records: enriched, baseCurrency });
  } catch (err) {
    console.error("/api/expenses GET error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ExpenseRecord>;
    if (!body.userId || typeof body.amount !== "number" || (!body.familyId && !body.tripId)) {
      return NextResponse.json(
        { error: "userId, amount, and one of (familyId | tripId) are required" },
        { status: 400 },
      );
    }
    const amount = body.amount;
    const currency = body.currency || "USD";
    const baseCurrency = body.baseCurrency || DEFAULT_BASE;
    const date = body.date || new Date().toISOString().slice(0, 10);

    let exchangeRate = body.exchangeRate;
    let baseAmount = body.baseAmount;
    let exchangeRateDate = body.exchangeRateDate;
    if (typeof baseAmount !== "number" || typeof exchangeRate !== "number") {
      if (currency === baseCurrency) {
        exchangeRate = 1;
        baseAmount = amount;
        exchangeRateDate = date;
      } else {
        const converted = await convertAmount(amount, currency, baseCurrency, date);
        if (converted) {
          exchangeRate = converted.rate;
          baseAmount = Number(converted.baseAmount.toFixed(2));
          exchangeRateDate = date;
        }
      }
    }

    const record: ExpenseRecord = {
      id: body.id || uuidv4(),
      familyId: body.familyId || "",
      tripId: body.tripId,
      userId: body.userId,
      userName: body.userName || "",
      payerId: body.payerId,
      payerName: body.payerName,
      merchant: body.merchant,
      amount,
      currency,
      baseAmount,
      baseCurrency,
      exchangeRate,
      exchangeRateDate,
      category: (body.category as ExpenseCategory) || "Other",
      country: body.country,
      date,
      paymentMethod: body.paymentMethod,
      sourceType: (body.sourceType as SourceType) || "manual",
      status: deriveStatus(body),
      duplicateCheckStatus: "none",
      missingFields: undefined,
      expenseType: (body.expenseType as ExpenseType) || "one_time",
      spreadStartDate: body.spreadStartDate,
      spreadEndDate: body.spreadEndDate,
      dailyAllocatedAmount: typeof body.dailyAllocatedAmount === "number" ? body.dailyAllocatedAmount : undefined,
      splitType: body.splitType as SplitType | undefined,
      participants: body.participants,
      imageUrl: body.imageUrl,
      aiConfidence: body.aiConfidence,
      notes: body.notes,
      items: body.items,
      createdAt: new Date().toISOString(),
    };

    if (record.expenseType === "spread_across_days" && record.spreadStartDate && record.spreadEndDate) {
      const start = new Date(record.spreadStartDate);
      const end = new Date(record.spreadEndDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
        const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        if (days > 0) {
          record.dailyAllocatedAmount = Number((amount / days).toFixed(2));
        }
      }
    } else {
      record.dailyAllocatedAmount = undefined;
    }

    const duplicates = await findPossibleDuplicates(record);
    let dupStatus: DuplicateCheckStatus = "none";
    if (body.duplicateCheckStatus === "confirmed_not_duplicate") {
      dupStatus = "confirmed_not_duplicate";
    } else if (duplicates.length > 0) {
      dupStatus = "possible_duplicate";
    }
    record.duplicateCheckStatus = dupStatus;
    const missing = computeMissingFields(record);
    record.missingFields = missing.length > 0 ? missing : undefined;

    const notionId = await createExpense(record);
    return NextResponse.json({
      notionId,
      record,
      duplicates: duplicates.map((d) => ({
        id: d.id,
        merchant: d.merchant,
        amount: d.amount,
        currency: d.currency,
        date: d.date,
      })),
    });
  } catch (err) {
    console.error("/api/expenses POST error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
