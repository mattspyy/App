import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { archiveExpense, createExpense, findExpensePage, listExpenses, updateExpense } from "@/lib/notion";
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
    // baseAmount is persisted at write time; only records missing it need FX recomputation.
    const enriched = await Promise.all(
      records.map((r) => (typeof r.baseAmount === "number" ? r : fillBaseAmount(r, baseCurrency))),
    );
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
    if (!body.userId || typeof body.amount !== "number" || !body.familyId) {
      return NextResponse.json(
        { error: "userId, amount, and familyId are required (tripId is optional)" },
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


export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ExpenseRecord>;
    const recordId = body.id;
    const requesterId = body.userId;
    if (!recordId || !requesterId) {
      return NextResponse.json({ error: "id and userId are required" }, { status: 400 });
    }

    const existing = await findExpensePage(recordId);
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    // Only the original creator may edit their own expense.
    if (existing.record.userId !== requesterId) {
      return NextResponse.json({ error: "You can only edit your own expenses" }, { status: 403 });
    }

    const prev = existing.record;
    const amount = typeof body.amount === "number" ? body.amount : prev.amount;
    const currency = body.currency || prev.currency;
    const baseCurrency = body.baseCurrency || prev.baseCurrency || DEFAULT_BASE;
    const date = body.date || prev.date;

    // Recompute base amount unless the client supplied explicit conversion values.
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
        } else {
          exchangeRate = undefined;
          baseAmount = undefined;
          exchangeRateDate = undefined;
        }
      }
    }

    // Editable fields are body-authoritative: the confirm form submits a full
    // snapshot, so a missing/empty value means the user cleared the field. Only
    // identity/ownership and creation time are preserved from the stored record.
    const record: ExpenseRecord = {
      id: prev.id,
      userId: prev.userId,
      createdAt: prev.createdAt,
      familyId: body.familyId || prev.familyId,
      tripId: body.tripId || undefined,
      userName: body.userName || prev.userName,
      payerId: body.payerId || prev.payerId,
      payerName: body.payerName || prev.payerName,
      merchant: body.merchant,
      amount,
      currency,
      baseAmount,
      baseCurrency,
      exchangeRate,
      exchangeRateDate,
      category: (body.category as ExpenseCategory) || prev.category,
      country: body.country,
      date,
      paymentMethod: body.paymentMethod,
      sourceType: (body.sourceType as SourceType) || prev.sourceType,
      status: deriveStatus({ ...body, familyId: body.familyId || prev.familyId, amount, date }),
      duplicateCheckStatus: prev.duplicateCheckStatus || "none",
      expenseType: (body.expenseType as ExpenseType) || "one_time",
      spreadStartDate: body.spreadStartDate,
      spreadEndDate: body.spreadEndDate,
      dailyAllocatedAmount: undefined,
      splitType: body.splitType as SplitType | undefined,
      participants: body.participants,
      imageUrl: body.imageUrl,
      aiConfidence: body.aiConfidence,
      notes: body.notes,
      items: body.items,
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

    const missing = computeMissingFields(record);
    record.missingFields = missing.length > 0 ? missing : undefined;

    await updateExpense(existing.pageId, record);
    return NextResponse.json({ record });
  } catch (err) {
    console.error("/api/expenses PATCH error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let body: { recordId?: string; userId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const recordId = body.recordId?.trim();
    const userId = body.userId?.trim();
    if (!recordId || !userId) {
      return NextResponse.json({ error: "recordId and userId are required" }, { status: 400 });
    }
    const existing = await findExpensePage(recordId);
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }
    // Only the original creator may delete their own expense.
    if (existing.record.userId !== userId) {
      return NextResponse.json({ error: "You can only delete your own expenses" }, { status: 403 });
    }
    await archiveExpense(existing.pageId);
    return NextResponse.json({ deleted: recordId });
  } catch (err) {
    console.error("/api/expenses DELETE error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
