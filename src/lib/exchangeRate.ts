type CacheValue = number | null;

const cache = new Map<string, CacheValue>();
const inflight = new Map<string, Promise<CacheValue>>();

function cacheKey(date: string, from: string, to: string): string {
  return `${date}|${from}|${to}`;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function fetchRate(date: string, from: string, to: string): Promise<CacheValue> {
  const url = `https://api.frankfurter.app/${date}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[to];
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}

// Fallback for currency pairs Frankfurter/ECB doesn't publish (e.g. TWD, VND).
// open.er-api.com is free and keyless but only serves CURRENT rates, so
// historical dates get today's rate; better than dropping the conversion.
async function fetchFallbackRate(from: string, to: string): Promise<CacheValue> {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[to];
    return typeof rate === "number" && Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}

export async function getRate(from: string, to: string, isoDate: string): Promise<number | null> {
  if (!from || !to) return null;
  if (from === to) return 1;
  const date = isIsoDate(isoDate) ? isoDate : new Date().toISOString().slice(0, 10);
  const key = cacheKey(date, from, to);
  if (cache.has(key)) return cache.get(key) ?? null;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetchRate(date, from, to)
    .then((rate) => (rate != null ? rate : fetchFallbackRate(from, to)))
    .then((rate) => {
      if (rate != null) cache.set(key, rate);
      inflight.delete(key);
      return rate;
    });
  inflight.set(key, p);
  return p;
}

export async function convertAmount(
  amount: number,
  from: string,
  to: string,
  isoDate: string,
): Promise<{ rate: number; baseAmount: number } | null> {
  const rate = await getRate(from, to, isoDate);
  if (rate == null) return null;
  return { rate, baseAmount: amount * rate };
}
