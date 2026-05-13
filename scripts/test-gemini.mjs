import { readFileSync } from "node:fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY missing in .env.local");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

console.log(`Using key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}  (length ${apiKey.length})`);
console.log("Model: gemini-2.5-flash");
console.log("Prompt: Say hello\n");

try {
  const r = await model.generateContent("Say hello");
  console.log("Response:", r.response.text());
  console.log("\n✅ API key works.");
} catch (e) {
  console.error("❌ Request failed:", e?.message || e);
  if (e?.status) console.error("HTTP status:", e.status);
  process.exit(1);
}
