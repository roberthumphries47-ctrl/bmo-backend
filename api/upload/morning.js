// api/upload/morning.js
import { kvGetArray } from "../../lib/kv.js";
import { ensureDay } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";
import { parseGmailHighlights } from "../../lib/gmailParser.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const today = ensureDay(req);
    const todayKey = `tasks_array:${today}`;
    const items = (await kvGetArray(todayKey)) || [];

    // Gmail parsing (subscriptions, bills, travel, reservations, etc.)
    const gmailHighlights = await parseGmailHighlights({
      daysAhead: 30,
      urgentWithin: 14,
    });

    const lines = [];
    lines.push("☀️ Morning Upload");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    // Tasks
    lines.push("📋 Gigs:");
    lines.push(
      items.length
        ? items
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

    // Gmail Highlights
    lines.push("📧 Gmail Highlights:");
    if (gmailHighlights.length) {
      gmailHighlights.forEach((g) => lines.push(`• ${g}`));
    } else {
      lines.push("• None");
    }

    const message = lines.join("\n");

    return res.status(200).json({
      today,
      tasks: items,
      gmailHighlights,
      message,
    });
  } catch (err) {
    return res.status(200).json({
      error: "Morning Upload failed",
      details: err?.message || String(err),
    });
  }
}
