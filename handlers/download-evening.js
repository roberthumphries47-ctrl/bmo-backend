// handlers/download-evening.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";
import { ensureDay, tomorrowISO } from "../lib/utils.js";
import { labels } from "../lib/buckets.js";

export async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "use_get" });

    const today = ensureDay(req);
    const tomorrow = tomorrowISO(new Date(`${today}T08:00:00Z`)); // keep our existing convention

    const todayKey = `tasks_array:${today}`;
    const tomorrowKey = `tasks_array:${tomorrow}`;

    const items = (await kvGetArray(todayKey)) || [];
    const closed = items.filter(t => t?.done);
    const incomplete = items.filter(t => !t?.done);

    // Roll over (clone, mark open)
    if (incomplete.length) {
      const existingTomorrow = (await kvGetArray(tomorrowKey)) || [];
      const rolled = incomplete.map(t => ({ ...t, done: false }));
      await kvSetArray(tomorrowKey, [...existingTomorrow, ...rolled]);
    }

    // Build human message (Cyberpunk style)
    const lines = [];
    lines.push("📥 Evening Download");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    lines.push("Closed:");
    lines.push(
      closed.length
        ? closed.map(t => `• ${t.title}${t.bucket ? ` (${labels[t.bucket] || t.bucket})` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Loose Ends (auto-rolled to tomorrow):");
    lines.push(
      incomplete.length
        ? incomplete.map(t => `• ${t.title}${t.bucket ? ` (${labels[t.bucket] || t.bucket})` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Re-slot or scrap anything? Tell me the gig title and what to do.");

    const message = lines.join("\n");

    return res.status(200).json({
      ok: true,
      today,
      tomorrow,
      closedCount: closed.length,
      rolledCount: incomplete.length,
      message,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "evening_failed", details: err?.message || String(err) });
  }
}
