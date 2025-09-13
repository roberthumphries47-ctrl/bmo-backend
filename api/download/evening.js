// api/download/evening.js
import { kvGetArray, kvSetArray } from "../../lib/kv.js";
import { ensureDay, tomorrowISO } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";
import { parseGmailHighlights } from "../../lib/gmailParser.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const today = ensureDay(req);
    const tomorrow = tomorrowISO(new Date(`${today}T08:00:00Z`));

    const todayKey = `tasks_array:${today}`;
    const tomorrowKey = `tasks_array:${tomorrow}`;
    const items = (await kvGetArray(todayKey)) || [];

    // Split
    const closed = items.filter((t) => t?.done);
    const incomplete = items.filter((t) => !t?.done);

    // Roll over
    if (incomplete.length) {
      const existingTomorrow = (await kvGetArray(tomorrowKey)) || [];
      const rolled = incomplete.map((t) => ({ ...t, done: false }));
      await kvSetArray(tomorrowKey, [...existingTomorrow, ...rolled]);
    }

    // Gmail parsing (what came in today that matters)
    const gmailHighlights = await parseGmailHighlights({
      daysAhead: 2, // keep it tight for recap
      urgentWithin: 1,
    });

    const lines = [];
    lines.push("📥 Evening Download");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    // Completed
    lines.push("✅ Closed:");
    lines.push(
      closed.length
        ? closed
            .map(
              (t) =>
                `• ${t.title} ${
                  t.bucket ? `(${labels[t.bucket] || t.bucket})` : ""
                }`
            )
            .join("\n")
        : "• None"
    );
    lines.push("");

    // Rolled over
    lines.push("🔄 Loose Ends (auto-queued for tomorrow):");
    lines.push(
      incomplete.length
        ? incomplete
            .map(
              (t) =>
                `• ${t.title} ${
                  t.bucket ? `(${labels[t.bucket] || t.bucket})` : ""
                }`
            )
            .join("\n")
        : "• None"
    );
    lines.push("");

    // Gmail
    lines.push("📧 Gmail Highlights:");
    if (gmailHighlights.length) {
      gmailHighlights.forEach((g) => lines.push(`• ${g}`));
    } else {
      lines.push("• None");
    }
    lines.push("");

    lines.push("Re-slot or scrap anything? Tell me the gig title and what to do.");

    const message = lines.join("\n");

    return res.status(200).json({
      today,
      closed,
      rolledCount: incomplete.length,
      gmailHighlights,
      message,
    });
  } catch (err) {
    return res.status(200).json({
      error: "Evening Download failed",
      details: err?.message || String(err),
    });
  }
}
