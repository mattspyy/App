import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

// Reports whether key env vars are present and their first/last few chars.
// Requires X-Admin-Password (same gate as /api/admin/users). Never returns full secret values.
function mask(value: string | undefined): { present: boolean; length?: number; preview?: string } {
  if (!value) return { present: false };
  if (value.length <= 12) return { present: true, length: value.length, preview: "…" };
  return {
    present: true,
    length: value.length,
    preview: `${value.slice(0, 6)}…${value.slice(-4)}`,
  };
}

export function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    SUPABASE_URL: process.env.SUPABASE_URL || null,
    SUPABASE_SERVICE_KEY: mask(process.env.SUPABASE_SERVICE_KEY),
    SUPABASE_ANON_KEY: mask(process.env.SUPABASE_ANON_KEY),
    NOTION_TOKEN: mask(process.env.NOTION_TOKEN),
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID || null,
    GEMINI_API_KEY: mask(process.env.GEMINI_API_KEY),
  });
}
