// api/download/evening.js
import { kvGetArray, kvSetArray } from "../../../lib/kv.js";
import { ensureDay, tomorrowISO } from "../../../lib/utils.js";
import { groupByBucket } from "../../../lib/utils.js";
import { labels, terms } from "../../../lib/buckets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  const today = ensureDay(req);
  const tomorrow = tomorrowISO(new Date(`${today}T00:00:00Z`));

  const todayKey = `tasks_array:${today}`;
  const tomorrowKey = `tasks_array:${tomorrow}`;
  const items = await kvGetArray(todayKey);
  const grouped = groupByBucket(items);
  const incomplete = items.filter(t => !t.done);

  // auto roll to tomorrow
  if (incomplete.length) {
    const tmr = await kvGetArray(tomorrowKey);
    const rolled = incomplete.map(t => ({ ...t, done: false })); // ensure undone
    await kvSetArray(tomorrowKey, [...tmr, ...rolled]);
  }

  const closed = items.filter(t => t.done);
  const lines = [];
  lines.push(`[ AFTER-ACTION LOG // ${today} ]`);
  lines.push("");
  lines.push(`Closed:`);
  lines.push(closed.length ? closed.map(t=>`• ${t.title} [${labels[t.bucket]||t.bucket}]`).join("\n") : "• None");
  lines.push("");
  lines.push(`Loose Ends (auto-queued for tomorrow):`);
  lines.push(incomplete.length ? incomplete.map(t=>`• ${t.title} [${labels[t.bucket]||t.bucket}] → roll over`).join("\n") : "• None");
  lines.push("");
  lines.push(`Re-slot or scrap anything? Tell me the ${terms.task.toLowerCase()} title and what to do.`);

  const message = lines.join("\n");

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount: incomplete.length,
    message
  });
}
