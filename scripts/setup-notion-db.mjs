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

if (!fs.existsSync(ENV_FILE)) {
  console.error("Missing .env.local");
  process.exit(1);
}
const envText = fs.readFileSync(ENV_FILE, "utf8");
const env = parseDotenv(envText);

const TOKEN = env.NOTION_TOKEN || process.env.NOTION_TOKEN;
if (!TOKEN || TOKEN === "secret_xxx") {
  console.error("NOTION_TOKEN missing in .env.local");
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
    const err = new Error(`Notion ${method} ${pathname} → ${res.status}: ${json.message || JSON.stringify(json)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function pageTitle(page) {
  const props = page.properties || {};
  for (const v of Object.values(props)) {
    if (v?.type === "title" && Array.isArray(v.title)) {
      return v.title.map((t) => t.plain_text).join("") || "(untitled)";
    }
  }
  if (Array.isArray(page.title)) return page.title.map((t) => t.plain_text).join("");
  return "(untitled)";
}

console.log("→ Searching for pages your integration can see…");
const search = await notion("/search", {
  filter: { value: "page", property: "object" },
  page_size: 50,
});

const pages = (search.results || []).filter((r) => r.object === "page" && !r.archived);
if (pages.length === 0) {
  console.error("\n❌ Your integration is not connected to any page yet.");
  console.error("Open ANY Notion page where you want the database to live, click ••• → Connections → add your integration.");
  console.error("Then re-run this script.\n");
  process.exit(1);
}

let parent;
if (process.env.PARENT_PAGE_ID) {
  parent = pages.find((p) => p.id === process.env.PARENT_PAGE_ID) || { id: process.env.PARENT_PAGE_ID };
  console.log(`→ Using parent from PARENT_PAGE_ID env: ${parent.id}`);
} else {
  parent = pages[0];
  console.log(`→ Using first connected page as parent:`);
  console.log(`   "${pageTitle(parent)}"  (id: ${parent.id})`);
  if (pages.length > 1) {
    console.log(`   (set PARENT_PAGE_ID=<id> to choose a different one. Other pages: ${pages.slice(1, 5).map((p) => `"${pageTitle(p)}"`).join(", ")})`);
  }
}

const CURRENCY_OPTIONS = ["USD","EUR","GBP","JPY","HKD","CNY","TWD","KRW","SGD","AUD","CAD"]
  .map((name) => ({ name }));
const CATEGORY_OPTIONS = ["Food","Shopping","Transport","Accommodation","Entertainment","Electronics","Groceries","Tickets","Health","Other"]
  .map((name) => ({ name }));
const PAYMENT_OPTIONS = ["Cash","Card","Apple Pay","Google Pay","Alipay","WeChat Pay","Bank Transfer","Other"]
  .map((name) => ({ name }));
const SOURCE_OPTIONS = ["receipt","screenshot","manual"].map((name) => ({ name }));

const properties = {
  "Name":           { title: {} },
  "Record ID":      { rich_text: {} },
  "Family ID":      { rich_text: {} },
  "User ID":        { rich_text: {} },
  "User Name":      { rich_text: {} },
  "Payer ID":       { rich_text: {} },
  "Payer Name":     { rich_text: {} },
  "Amount":         { number: { format: "number" } },
  "Currency":       { select: { options: CURRENCY_OPTIONS } },
  "Base Amount":    { number: { format: "number" } },
  "Base Currency":  { select: { options: CURRENCY_OPTIONS } },
  "Category":       { select: { options: CATEGORY_OPTIONS } },
  "Country":        { rich_text: {} },
  "Date":           { date: {} },
  "Payment Method": { select: { options: PAYMENT_OPTIONS } },
  "Source Type":    { select: { options: SOURCE_OPTIONS } },
  "Image URL":      { url: {} },
  "AI Confidence":  { number: { format: "number" } },
  "Notes":          { rich_text: {} },
  "Created At":     { created_time: {} },
};

console.log("→ Creating database 'Expenses' …");
const db = await notion("/databases", {
  parent: { type: "page_id", page_id: parent.id },
  title: [{ type: "text", text: { content: "Expenses" } }],
  properties,
});

const databaseId = db.id;
const dbUrl = db.url;
console.log(`✓ Database created.`);
console.log(`  id:  ${databaseId}`);
console.log(`  url: ${dbUrl}`);

const newEnv = envText.replace(/^NOTION_DATABASE_ID=.*$/m, `NOTION_DATABASE_ID=${databaseId}`);
const finalEnv = newEnv.includes("NOTION_DATABASE_ID=") ? newEnv : `${envText.trimEnd()}\nNOTION_DATABASE_ID=${databaseId}\n`;
fs.writeFileSync(ENV_FILE, finalEnv);
console.log(`✓ Updated .env.local: NOTION_DATABASE_ID=${databaseId}`);

console.log("\nDone. Restart your dev server so the new env is picked up.");
