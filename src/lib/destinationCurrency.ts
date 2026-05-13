const MAP: Record<string, string> = {
  // East Asia
  "japan": "JPY", "tokyo": "JPY", "osaka": "JPY", "kyoto": "JPY", "okinawa": "JPY", "sapporo": "JPY", "hokkaido": "JPY", "nagoya": "JPY", "fukuoka": "JPY",
  "south korea": "KRW", "korea": "KRW", "seoul": "KRW", "busan": "KRW", "jeju": "KRW",
  "china": "CNY", "beijing": "CNY", "shanghai": "CNY", "shenzhen": "CNY", "guangzhou": "CNY", "chengdu": "CNY", "hangzhou": "CNY",
  "hong kong": "HKD", "hk": "HKD",
  "taiwan": "TWD", "taipei": "TWD", "kaohsiung": "TWD", "taichung": "TWD",

  // Southeast Asia
  "thailand": "THB", "bangkok": "THB", "phuket": "THB", "chiang mai": "THB", "krabi": "THB", "pattaya": "THB",
  "vietnam": "VND", "hanoi": "VND", "ho chi minh": "VND", "saigon": "VND", "da nang": "VND", "danang": "VND",
  "malaysia": "MYR", "kuala lumpur": "MYR", "kl": "MYR", "penang": "MYR", "langkawi": "MYR", "kota kinabalu": "MYR",
  "indonesia": "IDR", "bali": "IDR", "jakarta": "IDR", "yogyakarta": "IDR", "lombok": "IDR",
  "philippines": "PHP", "manila": "PHP", "cebu": "PHP", "boracay": "PHP", "palawan": "PHP",
  "singapore": "SGD", "sg": "SGD",

  // South Asia
  "india": "INR", "mumbai": "INR", "delhi": "INR", "new delhi": "INR", "bangalore": "INR", "bengaluru": "INR", "goa": "INR", "jaipur": "INR",

  // Oceania
  "australia": "AUD", "sydney": "AUD", "melbourne": "AUD", "brisbane": "AUD", "perth": "AUD", "gold coast": "AUD",
  "new zealand": "NZD", "auckland": "NZD", "wellington": "NZD", "queenstown": "NZD", "christchurch": "NZD",

  // North America
  "united states": "USD", "usa": "USD", "us": "USD", "america": "USD",
  "new york": "USD", "los angeles": "USD", "san francisco": "USD", "chicago": "USD", "miami": "USD", "las vegas": "USD", "hawaii": "USD", "seattle": "USD", "boston": "USD",
  "canada": "CAD", "toronto": "CAD", "vancouver": "CAD", "montreal": "CAD", "calgary": "CAD", "ottawa": "CAD",

  // UK / Europe
  "united kingdom": "GBP", "uk": "GBP", "britain": "GBP", "england": "GBP", "scotland": "GBP", "wales": "GBP",
  "london": "GBP", "manchester": "GBP", "edinburgh": "GBP", "glasgow": "GBP",
  "switzerland": "CHF", "zurich": "CHF", "geneva": "CHF", "bern": "CHF",
  // Eurozone (a subset)
  "france": "EUR", "paris": "EUR", "nice": "EUR", "lyon": "EUR", "marseille": "EUR",
  "germany": "EUR", "berlin": "EUR", "munich": "EUR", "frankfurt": "EUR", "hamburg": "EUR",
  "italy": "EUR", "rome": "EUR", "milan": "EUR", "venice": "EUR", "florence": "EUR", "naples": "EUR",
  "spain": "EUR", "madrid": "EUR", "barcelona": "EUR", "seville": "EUR", "valencia": "EUR",
  "portugal": "EUR", "lisbon": "EUR", "porto": "EUR",
  "netherlands": "EUR", "amsterdam": "EUR",
  "belgium": "EUR", "brussels": "EUR",
  "ireland": "EUR", "dublin": "EUR",
  "austria": "EUR", "vienna": "EUR",
  "greece": "EUR", "athens": "EUR", "santorini": "EUR", "mykonos": "EUR",
  "finland": "EUR", "helsinki": "EUR",
};

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

export function detectCurrency(destination: string): string | null {
  if (!destination) return null;
  const norm = normalize(destination);
  if (!norm) return null;

  if (MAP[norm]) return MAP[norm];

  const parts = norm.split(/\s*[,/]\s*|\s+-\s+/);
  for (const part of parts) {
    const key = part.trim();
    if (key && MAP[key]) return MAP[key];
  }

  return null;
}
