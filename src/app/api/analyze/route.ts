import { NextRequest, NextResponse } from "next/server";
import { analyzeImage } from "@/lib/gemini";
import { isCloudinaryConfigured, uploadImageDataUri } from "@/lib/cloudinary";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import type { SourceType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const limit = rateLimit(clientKey(req));
  if (!limit.ok) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  try {
    const body = (await req.json()) as { dataUri?: string; sourceType?: SourceType };
    const dataUri = body.dataUri;
    const sourceType: SourceType = body.sourceType ?? "receipt";

    if (!dataUri || !dataUri.startsWith("data:")) {
      return NextResponse.json({ error: "dataUri (data URL) is required" }, { status: 400 });
    }

    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Invalid data URI" }, { status: 400 });
    }
    const mimeType = match[1];
    const base64 = match[2];
    if (base64.length * 0.75 > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large (>8MB)" }, { status: 413 });
    }

    const [analysis, imageUrl] = await Promise.all([
      analyzeImage(base64, mimeType, sourceType),
      isCloudinaryConfigured()
        ? uploadImageDataUri(dataUri).catch((e) => {
            console.error("Cloudinary upload failed", e);
            return undefined;
          })
        : Promise.resolve(undefined),
    ]);

    return NextResponse.json({ analysis, imageUrl });
  } catch (err) {
    console.error("/api/analyze error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
