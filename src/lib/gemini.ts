import { GoogleGenerativeAI } from "@google/generative-ai";
import { EXPENSE_CATEGORIES, type AIAnalysisResult, type ExpenseCategory, type SourceType } from "./types";
import { CONFIDENCE_THRESHOLD } from "./categories";

const MODEL_ID = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are an expense extraction assistant. Given an image — a receipt OR a payment screenshot from any app such as Apple Pay, Google Pay, banking apps, Alipay, WeChat Pay, online checkouts — extract spending information.

Return ONLY a single JSON object with these keys:
{
  "merchant": string | null,
  "amount": number | null,
  "currency": string | null,
  "date": string | null,
  "country": string | null,
  "category": one of [${EXPENSE_CATEGORIES.join(", ")}],
  "paymentMethod": string | null,
  "confidence": number,
  "items": [
    {
      "name": string,
      "quantity": number | null,
      "unitPrice": number | null,
      "totalPrice": number,
      "category": one of [${EXPENSE_CATEGORIES.join(", ")}] | null
    }
  ] | null
}

Rules:
- currency must be a 3-letter ISO 4217 code if possible (USD, EUR, GBP, JPY, HKD, CNY, TWD, KRW, etc.). Translate symbols if unambiguous.
- date must be ISO 8601 (YYYY-MM-DD). If unsure, return null.
- paymentMethod examples: Cash, Card, Apple Pay, Google Pay, Alipay, WeChat Pay, Bank Transfer, Other.
- If a field cannot be confidently identified, return null (except category — default to "Other").
- Do NOT invent values. Prefer null over guessing.
- confidence is a single number between 0 and 1 reflecting overall extraction reliability.
- For receipts, list each line item separately in "items". Item name should be human-readable (translate transliterations if helpful).
- Per-item category should reflect what the item actually is (e.g. Coffee → Food, Charger → Electronics, Medicine → Health). Null if unsure.
- For payment screenshots without itemized data, return "items": null.
- Sum of item totalPrice should approximately match the receipt amount; do not invent items if they are not visible.
- Output strict JSON only, no markdown fences, no commentary.`;

function parseJson(text: string): Record<string, unknown> | null {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  sourceType: SourceType,
): Promise<AIAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT },
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const text = result.response.text();
  const parsed = parseJson(text);

  if (!parsed) {
    return {
      merchant: null,
      amount: null,
      currency: null,
      date: null,
      country: null,
      category: "Other",
      paymentMethod: null,
      sourceType,
      confidence: 0,
      needsManualInput: true,
      notes: "Unable to parse AI response",
    };
  }

  const confidence =
    typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;

  const categoryRaw = typeof parsed.category === "string" ? parsed.category : "Other";
  const category: ExpenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as ExpenseCategory)
    : "Other";

  const amount =
    typeof parsed.amount === "number" && Number.isFinite(parsed.amount)
      ? parsed.amount
      : null;

  type ParsedItem = NonNullable<AIAnalysisResult["items"]>[number];
  const rawItems = Array.isArray(parsed.items) ? parsed.items : null;
  const items: ParsedItem[] | undefined = rawItems
    ? rawItems
        .map((raw): ParsedItem => {
          const r = raw as Record<string, unknown>;
          const name = typeof r.name === "string" ? r.name : "";
          const totalPrice = typeof r.totalPrice === "number" && Number.isFinite(r.totalPrice) ? r.totalPrice : NaN;
          const quantity = typeof r.quantity === "number" && Number.isFinite(r.quantity) ? r.quantity : null;
          const unitPrice = typeof r.unitPrice === "number" && Number.isFinite(r.unitPrice) ? r.unitPrice : null;
          const catRaw = typeof r.category === "string" ? r.category : null;
          const itemCategory: ExpenseCategory | null = catRaw && (EXPENSE_CATEGORIES as readonly string[]).includes(catRaw)
            ? (catRaw as ExpenseCategory)
            : null;
          return { name, quantity, unitPrice, totalPrice, category: itemCategory };
        })
        .filter((it) => it.name && Number.isFinite(it.totalPrice))
    : undefined;

  return {
    merchant: typeof parsed.merchant === "string" ? parsed.merchant : null,
    amount,
    currency: typeof parsed.currency === "string" ? parsed.currency : null,
    date: typeof parsed.date === "string" ? parsed.date : null,
    country: typeof parsed.country === "string" ? parsed.country : null,
    category,
    paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : null,
    sourceType,
    confidence,
    needsManualInput: confidence < CONFIDENCE_THRESHOLD,
    items: items && items.length > 0 ? items : undefined,
  };
}

const TEXT_SYSTEM_PROMPT = `You are an expense parser. Given a short natural-language sentence describing a spend, extract structured expense fields.

Return ONLY a single JSON object with these keys:
{
  "merchant": string | null,
  "amount": number | null,
  "currency": string | null,
  "date": string | null,
  "country": string | null,
  "category": one of [${EXPENSE_CATEGORIES.join(", ")}],
  "paymentMethod": string | null,
  "payerName": string | null,
  "splitType": one of ["no_split", "equal_split", "custom_amount"] | null,
  "splitParticipants": string[] | null,
  "notes": string | null,
  "confidence": number
}

Rules:
- currency must be a 3-letter ISO 4217 code (USD, EUR, GBP, JPY, HKD, CNY, etc.) when identifiable; otherwise null.
- date must be ISO 8601 (YYYY-MM-DD). Resolve relative words ("today", "yesterday", "last night", "this morning", "tonight") against TODAY supplied below. "last night" and "yesterday" → yesterday. Return null only when no time reference can be inferred.
- paymentMethod examples: Cash, Credit Card, Debit Card, Bank Transfer, Apple Pay, Google Pay, Octopus, PayMe, AlipayHK, WeChat Pay, Other.
- payerName: the person who paid, if explicitly named. Null if not mentioned (caller will default to the current user).
- splitType: choose based on what the user said. Phrases like "split with X and Y" → "equal_split". Specific amounts per person → "custom_amount". No sharing mentioned → "no_split".
- splitParticipants: the names of people the spend is shared with (excluding the payer when separately identified). Null when no split is implied.
- notes: any extra context that doesn't fit other fields (e.g. "team lunch", "birthday gift"). Keep short.
- If a field cannot be confidently identified, return null. Do NOT guess random values.
- confidence is a single number between 0 and 1 reflecting overall extraction reliability.
- Output strict JSON only, no markdown fences, no commentary.`;

export type SmartAddHints = {
  payerName?: string | null;
  splitType?: "no_split" | "equal_split" | "custom_amount" | null;
  participantNames?: string[];
};

export type AnalyzeTextDefaults = {
  today: string; // ISO YYYY-MM-DD
  defaultCurrency?: string;
};

export async function analyzeText(
  rawText: string,
  defaults: AnalyzeTextDefaults,
): Promise<{ analysis: AIAnalysisResult; hints: SmartAddHints }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const text = rawText.trim();
  if (!text) {
    throw new Error("text is required");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const lines: string[] = [TEXT_SYSTEM_PROMPT];
  lines.push("");
  lines.push("TODAY: " + defaults.today);
  if (defaults.defaultCurrency) lines.push("DEFAULT_CURRENCY: " + defaults.defaultCurrency);
  lines.push("USER_INPUT: " + text);
  const promptParts = lines.join("\n");

  const result = await model.generateContent([{ text: promptParts }]);
  const responseText = result.response.text();
  const parsed = parseJson(responseText);

  if (!parsed) {
    return {
      analysis: {
        merchant: null,
        amount: null,
        currency: null,
        date: null,
        country: null,
        category: "Other",
        paymentMethod: null,
        sourceType: "smart_add",
        confidence: 0,
        needsManualInput: true,
        notes: "Unable to parse AI response",
      },
      hints: {},
    };
  }

  const confidence =
    typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0;

  const categoryRaw = typeof parsed.category === "string" ? parsed.category : "Other";
  const category: ExpenseCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? (categoryRaw as ExpenseCategory)
    : "Other";

  const amount =
    typeof parsed.amount === "number" && Number.isFinite(parsed.amount) ? parsed.amount : null;

  // Smart Add doesn't surface line items.
  const merchant = typeof parsed.merchant === "string" ? parsed.merchant : null;
  const currency = typeof parsed.currency === "string"
    ? parsed.currency
    : (defaults.defaultCurrency || null);
  const date = typeof parsed.date === "string" ? parsed.date : null;
  const paymentMethod = typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : null;
  const country = typeof parsed.country === "string" ? parsed.country : null;

  // Notes carries only the AI's own notes; payer/split info travels in `hints`
  // so the confirm page can resolve names to IDs after members load.
  const baseNotes = typeof parsed.notes === "string" ? parsed.notes.trim() : "";

  const payerName =
    typeof parsed.payerName === "string" && parsed.payerName.trim()
      ? parsed.payerName.trim()
      : null;
  const splitTypeRaw =
    typeof parsed.splitType === "string" ? parsed.splitType : null;
  const splitType: SmartAddHints["splitType"] =
    splitTypeRaw === "no_split" || splitTypeRaw === "equal_split" || splitTypeRaw === "custom_amount"
      ? splitTypeRaw
      : null;
  const participantNames = Array.isArray(parsed.splitParticipants)
    ? parsed.splitParticipants
        .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n) => n.trim())
    : [];

  const hints: SmartAddHints = {};
  if (payerName) hints.payerName = payerName;
  if (splitType) hints.splitType = splitType;
  if (participantNames.length > 0) hints.participantNames = participantNames;

  const analysis: AIAnalysisResult = {
    merchant,
    amount,
    currency,
    date,
    country,
    category,
    paymentMethod,
    sourceType: "smart_add",
    confidence,
    needsManualInput: confidence < CONFIDENCE_THRESHOLD,
    notes: baseNotes || undefined,
  };
  return { analysis, hints };
}
