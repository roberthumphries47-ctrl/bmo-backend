// api/recap/nightly.js
import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

/**
 * Helper: YYYY-MM-DD (UTC) from a Date or string
 */
function ymdUTC(d) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

/**
 * Helper: add days to a YYYY-MM-DD string (UTC)
 */
function addDays(dayStr, n) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return ymdUTC(dt);
}

/**
 * Helper: end-of-day ISO (UTC) for a given YYYY-MM-DD
 */
function eodISO(dayStr) {
  return `${dayStr}T23:59:00Z`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  // Allow ?day=YYYY-MM-DD to run for a specific date (defaults to today UTC)
  const today = (req.query.day && String(req.query.day)) || ymdUTC(new Date());
  const tomorrow = addDays(today, 1);

  // Load today's tasks (single JSON array storage)
  const todayKey = `tasks_array:${today}`;
  const tomorrowKey = `tasks_array:${tomorrow}`;

  const todaysArray = (await kvGetJSON(todayKey)) || [];
  const tomorrowsArray = (await kvGetJSON(tomorrowKey)) || [];

  // Normalize (defensive: ensure objects)
  const tasks = todaysArray.map((t) => (typeof t === "string" ? JSON.parse(t) : t));

  // Group by bucket and split completed/incomplete
  const grouped = {};
  let incompleteToRoll = [];

  for (const task of tasks) {
    const bucket = task.bucket || "general";
    if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };

    if (task.done) {
      grouped[bucket].completed.push(task);
    } else {
      grouped[bucket].incomplete.push(task);
      incompleteToRoll.push(task);
    }
  }

  // Roll forward all incomplete tasks into tomorrow (no duplicates)
  let rolledCount = 0;
  if (incompleteToRoll.length > 0) {
    // Build a map of tomorrow by id to avoid duplicates
    const tomorrowById = new Map(
      tomorrowsArray
        .map((t) => (typeof t === "string" ? JSON.parse(t) : t))
        .filter((t) => t && t.id)
        .map((t) => [String(t.id), t])
    );

    for (const t of incompleteToRoll) {
      const id = String(t.id || "");
      if (!id || tomorrowById.has(id)) continue;

      // Clone & normalize for tomorrow
      const rolled = { ...t, done: false };

      // If the due date is today or in the past, bump to tomorrow EOD
      try {
        const dueDay = t.dueISO ? t.dueISO.slice(0, 10) : null;
        if (!dueDay || dueDay <= today) {
          rolled.dueISO = eodISO(tomorrow);
        }
      } catch {
        rolled.dueISO = eodISO(tomorrow);
      }

      tomorrowsArray.push(rolled);
      tomorrowById.set(id, rolled);
      rolledCount++;
    }

    // Persist updated tomorrow array
    await kvSetJSON(tomorrowKey, tomorrowsArray);
  }

  // Compose a friendly message
  const lines = [];
  lines.push(`Nightly recap for ${today}`);
  lines.push("");
  if (Object.keys(grouped).length === 0) {
    lines.push("No items today.");
  } else {
    for (const bucket of Object.keys(grouped).sort()) {
      const c = grouped[bucket].completed.length;
      const i = grouped[bucket].incomplete.length;
      lines.push(`• ${bucket}: ${c} completed, ${i} incomplete`);
    }
  }
  lines.push("");
  if (rolledCount > 0) {
    lines.push(
      `Rolled over ${rolledCount} item${rolledCount === 1 ? "" : "s"} to ${tomorrow}.`
    );
    lines.push(
      "Need to reschedule or delete any rolled items? Tell me which one (by title) and what you want to do."
    );
  } else {
    lines.push("No items to roll. Nice work!");
    lines.push(
      "Need to reschedule or delete any rolled items? Tell me which one (by title) and what you want to do."
    );
  }

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount,
    message: lines.join("\n"),
  });
}
