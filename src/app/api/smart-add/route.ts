import { NextRequest, NextResponse } from "next/server";
import { analyzeText } from "@/lib/gemini";
import { enforceAiRateLimit } from "@/lib/aiRateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TEXT_LENGTH = 500;

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      text?: string;
      userId?: string;
      groupId?: string;
      tripId?: string;
      defaultCurrency?: string;
    };
    const text = body.text?.trim();
    const userId = body.userId?.trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    const limit = await enforceAiRateLimit(userId);
    if (!limit.ok) {
      const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        {
          error: `AI call limit reached (${limit.limit}/min). Try again in ${retryAfter}s.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `text must be ${MAX_TEXT_LENGTH} characters or fewer` }, { status: 400 });
    }
    const { analysis, hints } = await analyzeText(text, {
      today: todayIso(),
      defaultCurrency: body.defaultCurrency?.trim() || undefined,
    });
    return NextResponse.json({ analysis, hints, sourceType: "smart_add" });
  } catch (err) {
    console.error("/api/smart-add error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
