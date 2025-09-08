// api/download/evening.js
import { kvGetArray, kvSetArray } from "../../lib/kv.js";
import { ensureDay, tomorrowISO } from "../../lib/utils.js";
import { groupByBucket, labels, terms } from "../../lib/buckets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const today = ensureDay(req);
  const tomorrow = tomorrowISO(new Date(`${today}T00:00:00Z`)).slice(0,10);

  console.log("[Evening] start", { today, tomorrow });
  console.log("[Evening] env check", {
    KV_REST_API_URL: process.env.KV_REST_API_URL ? "present" : "MISSING",
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "present" : "MISSING",
  });

  const todayKey = `tasks_array:${today}`;
  const tomorrowKey = `tasks_array:${tomorrow}`;

  let items = [];
  try {
    console.log("[Evening] fetching", todayKey);
    items = await kvGetArray(todayKey);
    console.log("[Evening] tasks today", items?.length ?? 0);
  } catch (e) {
    console.error("[Evening] fetch today failed", { key: todayKey, error: e?.message });
    return res.status(500).json({ error: "Evening Download failed", details: e?.message });
  }

  const incomplete = (items || []).filter(t => !t.done);
  let rolled = [];

  if (incomplete.length) {
    try {
      console.log("[Evening] rolling to", tomorrowKey, "count", incomplete.length);
      const tmr = (await kvGetArray(tomorrowKey)) || [];
      rolled = incomplete.map(t => ({ ...t, done: false }));
      await kvSetArray(tomorrowKey, [...tmr, ...rolled]);
      console.log("[Evening] roll complete", { wrote: rolled.length });
    } catch (e) {
      console.error("[Evening] roll failed", { key: tomorrowKey, error: e?.message });
      return res.status(500).json({ error: "Evening Download failed", details: `roll: ${e?.message}` });
    }
  }

  const grouped = groupByBucket(items);
  const closed = items.filter(t => t.done);

  const lines = [];
  lines.push(`[ AFTER-ACTION LOG // ${today} ]`);
  lines.push("");
  lines.push("Closed:");
  lines.push(closed.length ? closed.map(t => `• ${t.title}  [${labels[t.bucket]||t.bucket}]`).join("\n") : "• None");
  lines.push("");
  lines.push("Loose Ends (auto-queued for tomorrow):");
  lines.push(rolled.length ? rolled.map(t => `• ${t.title} → roll over`).join("\n") : "• None");
  lines.push("");
  lines.push("Reslot or scrap anything? Tell me the gig title and what to do.");

  const message = lines.join("\n");

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount: rolled.length,
    message,
  });
}
