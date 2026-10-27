// Smoke test for the Meta Model API key: node --env-file=.env.local scripts/check-meta.mjs
// Prints model ids and one short reply, never the key.

const BASE_URL = process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1";
const key = process.env.META_API_KEY;
if (!key) {
  console.error("META_API_KEY is not set (expected in .env.local)");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const models = await fetch(`${BASE_URL}/models`, { headers });
console.log(`GET /models -> ${models.status}`);
if (models.ok) {
  const { data = [] } = await models.json();
  console.log(`  ${data.map((m) => m.id).sort().join(", ")}`);
}

const started = Date.now();
const reply = await fetch(`${BASE_URL}/responses`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    model: "muse-spark-1.3",
    reasoning: { effort: "low" },
    input: "ตอบสั้นๆ หนึ่งประโยคเป็นภาษาไทย: 7 คูณ 8 เท่ากับเท่าไร",
  }),
});
console.log(`POST /responses (muse-spark-1.3, effort low) -> ${reply.status} in ${Date.now() - started} ms`);
const json = await reply.json();
if (!reply.ok) {
  console.error(JSON.stringify(json).slice(0, 400));
  process.exit(1);
}
const text = (json.output ?? [])
  .flatMap((item) => item.content ?? [])
  .filter((part) => part.type === "output_text")
  .map((part) => part.text)
  .join("");
console.log(`  reply: ${text.trim()}`);
console.log(`  usage: ${JSON.stringify(json.usage)}`);
