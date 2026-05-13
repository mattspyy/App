import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ENV_FILE = path.resolve(".env.local");

function parseDotenv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function upsertEnv(text, key, value) {
  const line = `${key}=${value}`;
  if (new RegExp(`^${key}=.*$`, "m").test(text)) {
    return text.replace(new RegExp(`^${key}=.*$`, "m"), line);
  }
  return `${text.trimEnd()}\n${line}\n`;
}

if (!fs.existsSync(ENV_FILE)) {
  console.error("Missing .env.local");
  process.exit(1);
}
let envText = fs.readFileSync(ENV_FILE, "utf8");
const env = parseDotenv(envText);

const TOKEN = env.NOTION_TOKEN || process.env.NOTION_TOKEN;
if (!TOKEN) {
  console.error("NOTION_TOKEN missing in .env.local");
  process.exit(1);
}
const EXPENSES_DB_ID = env.NOTION_DATABASE_ID || process.env.NOTION_DATABASE_ID;
if (!EXPENSES_DB_ID) {
  console.error("NOTION_DATABASE_ID missing in .env.local (run setup-notion-db.mjs first)");
  process.exit(1);
}

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

async function notion(pathname, body, method = "POST") {
  const res = await fetch(`https://api.notion.com/v1${pathname}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Notion ${method} ${pathname} → ${res.status}: ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

const CURRENCY_OPTIONS = ["USD","EUR","GBP","JPY","HKD","CNY","TWD","KRW","SGD","AUD","CAD"].map((name) => ({ name }));
const CATEGORY_OPTIONS = ["Food","Shopping","Transport","Accommodation","Entertainment","Electronics","Groceries","Tickets","Health","Other"].map((name) => ({ name }));
const SPLIT_TYPE_OPTIONS = ["no_split","equal_split","custom_amount","equal","not_split","custom_percentage"].map((name) => ({ name }));
const STATUS_OPTIONS = ["draft","needs_review","confirmed"].map((name) => ({ name }));
const DUPLICATE_CHECK_OPTIONS = ["none","possible_duplicate","confirmed_not_duplicate"].map((name) => ({ name }));
const EXPENSE_TYPE_OPTIONS = ["one_time","spread_across_days"].map((name) => ({ name }));

console.log("→ Reading existing Expenses DB schema…");
const existingDb = await notion(`/databases/${EXPENSES_DB_ID}`, null, "GET");
const existing = new Set(Object.keys(existingDb.properties || {}));

const newProps = {
  "Trip ID":             { rich_text: {} },
  "Exchange Rate":       { number: { format: "number" } },
  "Exchange Rate Date":  { date: {} },
  "Split Type":          { select: { options: SPLIT_TYPE_OPTIONS } },
  "Split Participants":  { rich_text: {} },
  "Items JSON":          { rich_text: {} },
  "Status":              { select: { options: STATUS_OPTIONS } },
  "Duplicate Check Status": { select: { options: DUPLICATE_CHECK_OPTIONS } },
  "Missing Fields":      { rich_text: {} },
  "Expense Type":        { select: { options: EXPENSE_TYPE_OPTIONS } },
  "Spread Start Date":   { date: {} },
  "Spread End Date":     { date: {} },
  "Daily Allocated Amount": { number: { format: "number" } },
};

const toAdd = {};
for (const [name, spec] of Object.entries(newProps)) {
  if (!existing.has(name)) toAdd[name] = spec;
}

if (Object.keys(toAdd).length === 0) {
  console.log("  All expense columns already present.");
} else {
  console.log(`→ Adding ${Object.keys(toAdd).length} column(s) to Expenses: ${Object.keys(toAdd).join(", ")}`);
  await notion(`/databases/${EXPENSES_DB_ID}`, { properties: toAdd }, "PATCH");
  console.log("✓ Expenses schema updated.");
}

// Find a parent page for new DBs (reuse the same parent the Expenses DB sits in if accessible).
let parentPageId;
const expensesParent = existingDb.parent;
if (expensesParent?.type === "page_id" && expensesParent.page_id) {
  parentPageId = expensesParent.page_id;
  console.log(`→ Using Expenses DB's parent page for new DBs: ${parentPageId}`);
} else {
  console.log("→ Expenses DB is not under a page parent. Searching for any connected page…");
  const search = await notion("/search", { filter: { value: "page", property: "object" }, page_size: 10 });
  const pages = (search.results || []).filter((r) => r.object === "page" && !r.archived);
  if (pages.length === 0) {
    console.error("❌ No accessible parent page. Open a Notion page and add your integration via ••• → Connections.");
    process.exit(1);
  }
  parentPageId = pages[0].id;
  console.log(`→ Using "${pages[0].properties?.title?.title?.[0]?.plain_text || "(untitled)"}" as parent.`);
}

async function ensureDatabase(envKey, title, properties) {
  if (env[envKey]) {
    try {
      await notion(`/databases/${env[envKey]}`, null, "GET");
      console.log(`  ${title}: already exists (${envKey}=${env[envKey]}).`);
      return env[envKey];
    } catch {
      console.log(`  ${envKey} set but DB not reachable, creating a new one…`);
    }
  }
  console.log(`→ Creating "${title}" database…`);
  const db = await notion("/databases", {
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: title } }],
    properties,
  });
  console.log(`✓ "${title}" created: ${db.id}`);
  envText = upsertEnv(envText, envKey, db.id);
  fs.writeFileSync(ENV_FILE, envText);
  console.log(`  Wrote ${envKey}=${db.id} to .env.local`);
  return db.id;
}

await ensureDatabase("NOTION_TRIPS_DATABASE_ID", "Trips", {
  "Name":             { title: {} },
  "Trip ID":          { rich_text: {} },
  "Family ID":        { rich_text: {} },
  "Destination":      { rich_text: {} },
  "Start Date":       { date: {} },
  "End Date":         { date: {} },
  "Base Currency":    { select: { options: CURRENCY_OPTIONS } },
  "Budget":           { number: { format: "number" } },
  "Created By":       { rich_text: {} },
  "Created By Name":  { rich_text: {} },
  "Notes":            { rich_text: {} },
  "Created At":       { created_time: {} },
});

await ensureDatabase("NOTION_RULES_DATABASE_ID", "Category Rules", {
  "Name":         { title: {} },
  "Rule ID":      { rich_text: {} },
  "Family ID":    { rich_text: {} },
  "Merchant":     { rich_text: {} },
  "Category":     { select: { options: CATEGORY_OPTIONS } },
  "Created At":   { created_time: {} },
});

console.log("\nDone. Restart your dev server so the new env vars are picked up.");
