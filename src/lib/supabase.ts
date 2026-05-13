import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let logged = false;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url) throw new Error("SUPABASE_URL is not set in .env.local");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY is not set in .env.local");
  if (!logged) {
    console.log(
      `[supabase] init url=${url} service_key=${serviceKey.slice(0, 8)}…${serviceKey.slice(-4)} (len=${serviceKey.length})`,
    );
    logged = true;
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
