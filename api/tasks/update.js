// api/recap/nightly.js
import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

/**
 * Nightly recap:
 * - Reads today's tasks (array) from `tasks_array:YYYY-MM-DD`
 * - Groups by bucket into completed vs incomplete
 * - Rolls all incomplete tasks into *tomorrow* (default behavior)
 * - Returns a summary payload with options (roll over / reschedule / delete)
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Use GET or POST" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const tomorrowISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const tomorrow = tomorrowISO.slice(0, 10);

  const keyToday = `tasks_array:${today}`;
  const keyTomorrow = `tasks_array:${tomorrow}`;

  const todayArr = (await kvGetJSON(keyToday)) || [];
  const tomorrowArr = (await kvGetJSON(keyTomorrow)) || [];

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
      const copy = {
        ...t,
        done: false,
        dueISO: `${tomorrow}T23:59:00Z`,
        rolledFromDay: today,
      };
      tomorrowArr.push(copy);
      rolled.push(copy);
    }
  }

  await kvSetJSON(keyTomorrow, tomorrowArr);

  // Build summary message
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
    lines.push(`Rolled ${rolled.length} item(s) forward to ${tomorrow}.`);
    lines.push("");
    lines.push("Options for rolled tasks:");
    for (const r of rolled) {
      lines.push(`- ${r.title} (bucket: ${r.bucket || "general"})`);
      lines.push(`   • Roll over (default, already done)`);
      lines.push(`   • Reschedule → POST /api/tasks/update { id: "${r.id}", action: "reschedule", newDate: "YYYY-MM-DDT23:59:00Z" }`);
      lines.push(`   • Delete → POST /api/tasks/update { id: "${r.id}", action: "delete" }`);
      lines.push("");
    }
  } else {
    lines.push("No items to roll over. Nice work!");
  }

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount: rolled.length,
    message: lines.join("\n"),
  });
}
