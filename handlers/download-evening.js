// handlers/download-evening.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowISO(todayStr) {
  const d = new Date(`${todayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const labels = {
  "Solo Ops": "Solo Ops",
  "Cred Sharks": "Cred Sharks",
  "Wraiths": "Wraiths",
  "Ripperdocs": "Ripperdocs",
  "Scavs": "Scavs",
  "Ghost": "Ghost",
  "Animals": "Animals",
  "Side Gigs": "Side Gigs",
  "Safehouse": "Safehouse",
  "Gut Hacks": "Gut Hacks",
  "Lucid Studio": "Lucid Studio",
  "Debug": "Debug",
};

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const day = url.searchParams.get("day") || todayISO();
    const next = tomorrowISO(day);

    const todayKey = `tasks_array:${day}`;
    const nextKey  = `tasks_array:${next}`;

    const items = (await kvGetArray(todayKey)) || [];
    const closed = items.filter(t => t?.done);
    const incomplete = items.filter(t => !t?.done);

    if (incomplete.length) {
      const existingTomorrow = (await kvGetArray(nextKey)) || [];
      const rolled = incomplete.map(t => ({ ...t, done: false }));
      await kvSetArray(nextKey, [...existingTomorrow, ...rolled]);
    }

    // Build human message
    const lines = [];
    lines.push("📥 Evening Download");
    lines.push(`🗓️ ${day}`);
    lines.push("");

    lines.push("Closed:");
    lines.push(
      closed.length
        ? closed.map(t => `• ${t.title} ${t.bucket ? `(${labels[t.bucket] || t.bucket})` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Loose Ends (auto-queued for tomorrow):");
    lines.push(
      incomplete.length
        ? incomplete.map(t => `• ${t.title} ${t.bucket ? `(${labels[t.bucket] || t.bucket})` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Re-slot or scrap anything? Tell me the gig title and what to do.");
    const message = lines.join("\n");

    return res.status(200).json({
      ok: true,
      today: day,
      tomorrow: next,
      closedCount: closed.length,
      rolledCount: incomplete.length,
      message,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "download_evening_failed", details: err?.message || String(err) });
  }
}
