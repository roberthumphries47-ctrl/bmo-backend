// api/download/evening.js
import { kvGetArray, kvSetArray } from "../../lib/kv.js";
import { ensureDay, tomorrowISO } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";

// ---- small helpers (safe debug) ----
const mask = (v, keep = 6) =>
  typeof v === "string" && v.length > keep
    ? `${v.slice(0, keep)}…${"•".repeat(6)}`
    : v ? "set" : "missing";

function envSnapshot() {
  return {
    KV_REST_API_URL: mask(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: mask(process.env.KV_REST_API_TOKEN),
    KV_URL: mask(process.env.KV_URL),
    REDIS_URL: mask(process.env.REDIS_URL),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    // --- env debug (doesn't leak secrets) ---
    const env = envSnapshot();
    const env_present = Object.values(env).every(v => v && v !== "missing");

    const today = ensureDay(req);
    const tomorrow = tomorrowISO(new Date(`${today}T08:00:00Z`));

    const todayKey = `tasks_array:${today}`;
    const tomorrowKey = `tasks_array:${tomorrow}`;

    const items = (await kvGetArray(todayKey)) || [];

    const closed = items.filter(t => t?.done);
    const incomplete = items.filter(t => !t?.done);

    // roll incomplete → tomorrow
    if (incomplete.length) {
      const existing = (await kvGetArray(tomorrowKey)) || [];
      const rolled = incomplete.map(t => ({ ...t, done: false }));
      await kvSetArray(tomorrowKey, [...existing, ...rolled]);
    }

    // human message
    const lines = [];
    lines.push("📥 Evening Download");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    lines.push("Closed:");
    lines.push(
      closed.length
        ? closed.map(t => `• ${t.title}${t.bucket ? ` — ${labels[t.bucket] || t.bucket}` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Loose Ends (auto-queued for tomorrow):");
    lines.push(
      incomplete.length
        ? incomplete.map(t => `• ${t.title}${t.bucket ? ` — ${labels[t.bucket] || t.bucket}` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Re-slot or scrap anything? Tell me the gig title and what to do.");
    const message = lines.join("\n");

    return res.status(200).json({
      ok: true,
      today,
      tomorrow,
      closed,
      rolledCount: incomplete.length,
      message,
      env_present,
      env_sample: env, // masked
    });
  } catch (err) {
    return res.status(200).json({
      error: "Evening Download failed",
      details: err?.message || String(err),
    });
  }
}
