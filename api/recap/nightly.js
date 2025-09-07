// api/recap/nightly.js
import { kvGetJSON, kvSetJSON, kvLRange } from "../../lib/kv.js";

/**
 * Nightly recap:
 * - Reads today's tasks (array form: tasks_array:YYYY-MM-DD; falls back to legacy list)
 * - Rolls incomplete quests into tomorrow (same id/title/bucket, done:false, dueISO set to tomorrow 23:59)
 * - Returns structured data + an RPG-flavored human message
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);

  // --- Read today's quests (prefer array storage; fallback to legacy list) ---
  let tasks = (await kvGetJSON(`tasks_array:${today}`)) ?? [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const legacy = await kvLRange(`tasks:${today}`, 0, -1);
    tasks = (legacy ?? []).map((t) => (typeof t === "string" ? JSON.parse(t) : t));
  }

  // Group by guild (bucket)
  const grouped = {};
  for (const t of tasks) {
    const bucket = t.bucket || "general";
    if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };
    (t.done ? grouped[bucket].completed : grouped[bucket].incomplete).push(t);
  }

  // --- Roll over incomplete to tomorrow ---
  const carry = [];
  for (const [bucket, g] of Object.entries(grouped)) {
    for (const t of g.incomplete) {
      carry.push({
        id: t.id,
        title: t.title,
        bucket,
        done: false,
        dueISO: `${tomorrow}T23:59:00Z`,
      });
    }
  }

  let rolledCount = 0;
  if (carry.length) {
    const tomorrowKey = `tasks_array:${tomorrow}`;
    const existingTomorrow = (await kvGetJSON(tomorrowKey)) ?? [];
    await kvSetJSON(tomorrowKey, mergeById(existingTomorrow, carry));
    rolledCount = carry.length;
  }

  // Build RPG-flavored human text
  const human = buildRPGNightly(grouped, today, rolledCount);

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount,
    message: human,
  });
}

function mergeById(existing, incoming) {
  const map = new Map(existing.map((t) => [t.id, t]));
  for (const t of incoming) map.set(t.id, t);
  return Array.from(map.values());
}

function buildRPGNightly(grouped, day, rolledCount) {
  const lines = [];
  lines.push(`🧭 Adventurer’s Log — ${day}`);
  lines.push("");

  // Completed quests
  lines.push("✅ Quests Completed:");
  let anyCompleted = false;
  for (const [bucket, g] of Object.entries(grouped)) {
    if (g.completed.length) {
      anyCompleted = true;
      lines.push(`  • ${prettyGuild(bucket)}:`);
      for (const q of g.completed) lines.push(`     - ${q.title}`);
    }
  }
  if (!anyCompleted) lines.push("  • None");

  lines.push("");

  // Active quests (not completed)
  lines.push("🗺️  Active Quests (not completed):");
  let anyActive = false;
  for (const [bucket, g] of Object.entries(grouped)) {
    if (g.incomplete.length) {
      anyActive = true;
      lines.push(`  • ${prettyGuild(bucket)}:`);
      for (const q of g.incomplete) lines.push(`     - ${q.title}`);
    }
  }
  if (!anyActive) lines.push("  • None");

  lines.push("");

  // Roll-over note
  if (rolledCount > 0) {
    lines.push(`➡️  ${rolledCount} quest(s) will **roll over** to tomorrow’s board automatically.`);
  } else {
    lines.push("✨ No quests to roll over. Nicely done!");
  }
  lines.push("");
  lines.push("Need to reschedule or delete any rolled quests? Tell me which one (by title) and what to do.");
  lines.push("Want to add a new quest for tomorrow? Just say the title and guild (bucket).");
  return lines.join("\n");
}

function prettyGuild(bucket) {
  return bucket === "general" ? "General Guild" : capitalize(bucket) + " Guild";
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
