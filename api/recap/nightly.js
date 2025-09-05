// api/recap/nightly.js
import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

/**
 * Nightly recap:
 * - Reads today's tasks (array) from `tasks_array:YYYY-MM-DD`
 * - Groups by bucket into completed vs incomplete
 * - Copies all incomplete tasks into *tomorrow* (keeps same id, sets dueISO to tomorrow 23:59:00Z)
 * - Writes tomorrow's array back
 * - Returns a summary payload you can show in-app
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Use GET or POST" });
  }

  // ISO-only date (YYYY-MM-DD)
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = tomorrowISO.slice(0, 10);

  // Where we store arrays:
  const keyToday = `tasks_array:${today}`;
  const keyTomorrow = `tasks_array:${tomorrow}`;

  // Load arrays (or empty)
  const todayArr = (await kvGetJSON(keyToday)) || [];
  const tomorrowArr = (await kvGetJSON(keyTomorrow)) || [];

  // Group today by bucket + completion
  const grouped = {};
  for (const t of todayArr) {
    const bucket = (t.bucket || "general").toLowerCase();
    if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };
    if (t.done) grouped[bucket].completed.push(t);
    else grouped[bucket].incomplete.push(t);
  }

  // Roll all incomplete to tomorrow
  const rolled = [];
  for (const bucket of Object.keys(grouped)) {
    for (const t of grouped[bucket].incomplete) {
      // Copy the task; keep same id; update dueISO to tomorrow end-of-day
      const copy = {
        ...t,
        done: false,
        // Tomorrow 23:59:00Z
        dueISO: `${tomorrow}T23:59:00Z`,
        rolledFromDay: today,
      };
      tomorrowArr.push(copy);
      rolled.push(copy);
    }
  }

  // Save tomorrow’s array (today remains as historical record)
  await kvSetJSON(keyTomorrow, tomorrowArr);

  // Build a small, readable summary string (handy to display or send)
  const lines = [];
  lines.push(`Nightly recap for ${today}`);
  lines.push("");
  for (const bucket of Object.keys(grouped).sort()) {
    const g = grouped[bucket];
    lines.push(`• ${bucket.toUpperCase()}`);
    lines.push(`   ✓ Completed (${g.completed.length}): ${g.completed.map(x => x.title).join(", ") || "—"}`);
    lines.push(`   ○ Incomplete (${g.incomplete.length}): ${g.incomplete.map(x => x.title).join(", ") || "—"}`);
    lines.push("");
  }
  if (rolled.length > 0) {
    lines.push(`Rolled ${rolled.length} item(s) to ${tomorrow}.`);
  } else {
    lines.push("No items to roll. Nice work!");
  }
  lines.push("");
  lines.push(
    "Need to reschedule or delete any rolled items? Tell me which one (by title) and what you want to do."
  );

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount: rolled.length,
    message: lines.join("\n"),
  });
}
