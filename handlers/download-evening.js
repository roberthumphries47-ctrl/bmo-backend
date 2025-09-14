// api/download/evening.js
import { kvGetArray, kvSetArray } from "../../lib/kv.js";
import { ensureDay, tomorrowISO } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const today = ensureDay(req);
    const tomorrow = tomorrowISO(new Date(`${today}T08:00:00Z`));

    const todayKey = `tasks_array:${today}`;
    const tomorrowKey = `tasks_array:${tomorrow}`;

    const items = (await kvGetArray(todayKey)) || [];

    // Split
    const closed = items.filter(t => t?.done);
    const incomplete = items.filter(t => !t?.done);

    // Roll over into tomorrow (preserve order, ensure done=false)
    if (incomplete.length) {
      const existingTomorrow = (await kvGetArray(tomorrowKey)) || [];
      const rolled = incomplete.map(t => ({ ...t, done: false }));
      await kvSetArray(tomorrowKey, [...existingTomorrow, ...rolled]);
    }

    // Human recap
    const lines = [];
    lines.push("🌙 Evening Download");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    lines.push("Closed:");
    lines.push(
      closed.length
        ? closed
            .map(t => `• ${t.title}${t.bucket ? ` (${labels[t.bucket] || t.bucket})` : ""}`)
            .join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Loose Ends (auto-queued for tomorrow):");
    lines.push(
      incomplete.length
        ? incomplete
            .map(t => `• ${t.title}${t.bucket ? ` (${labels[t.bucket] || t.bucket})` : ""}`)
            .join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Need to re-slot or delete anything? Tell me the task title and what to do.");
    lines.push("Also—any new tasks to add for tomorrow?");

    const message = lines.join("\n");

    return res.status(200).json({
      ok: true,
      today,
      tomorrow,
      closed,
      rolledCount: incomplete.length,
      message,
    });
  } catch (err) {
    return res.status(200).json({
      error: "Evening Download failed",
      details: err?.message || String(err),
    });
  }
}
