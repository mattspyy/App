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
