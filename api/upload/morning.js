// api/upload/morning.js
import { ensureDay } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";
import { kvGetArray } from "../../lib/kv.js";
import { parseGmailHighlights } from "../../lib/gmailParser.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Use GET" });
    }

    const today = ensureDay(req);
    const key = `tasks_array:${today}`;
    const tasks = (await kvGetArray(key)) || [];

    // Split closed vs open
    const closed = tasks.filter(t => t?.done);
    const open = tasks.filter(t => !t?.done);

    // Gmail highlights
    const gmail = await parseGmailHighlights();

    // Build digest message
    const lines = [];
    lines.push("📤 Morning Upload");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    if (open.length) {
      lines.push("⚡ Active Gigs:");
      open.forEach(t =>
        lines.push(`• ${t.title} ${t.bucket ? `(${labels[t.bucket] || t.bucket})` : ""}`)
      );
    } else {
      lines.push("⚡ Active Gigs: none");
    }

    lines.push("");
    lines.push("📧 Gmail Highlights:");
    if (gmail.length) {
      gmail.forEach(g => lines.push(`• ${g}`));
    } else {
      lines.push("• None found");
    }

    return res.status(200).json({
      today,
      openCount: open.length,
      closedCount: closed.length,
      gmailHighlights: gmail,
      message: lines.join("\n"),
    });
  } catch (err) {
    return res.status(500).json({
      error: "Morning Upload failed",
      details: err?.message || String(err),
    });
  }
}
