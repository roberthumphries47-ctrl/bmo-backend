// api/tasks/complete.js
import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

/**
 * POST /api/tasks/complete
 * Body: { id: "123", day?: "YYYY-MM-DD" }
 *
 * Marks a task done=true inside the day’s array. If "day" is omitted,
 * it searches today then yesterday and updates the first match.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { id, day } = req.body || {};
  if (!id) return res.status(400).json({ error: "Missing 'id'" });

  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const daysToCheck = Array.isArray(day) ? day : day ? [day] : [today, y];

  for (const d of daysToCheck) {
    const key = `tasks_array:${d}`;
    const arr = (await kvGetJSON(key)) || [];
    const idx = arr.findIndex((t) => t.id === id);
    if (idx !== -1) {
      // Mark done
      const updated = { ...arr[idx], done: true };
      arr[idx] = updated;
      await kvSetJSON(key, arr);
      return res.status(200).json({ ok: true, day: d, task: updated });
    }
  }

  return res.status(404).json({ error: "ID_NOT_FOUND", id });
}
