// api/tasks/complete.js
import { kvLRange, kvSetJSON } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { id, day } = req.body || {};
  const targetDay = (day || new Date().toISOString().slice(0,10)); // YYYY-MM-DD
  if (!id) return res.status(400).json({ error: "Missing 'id'" });

  const listKey = `tasks:${targetDay}`;
  const arrKey  = `tasks_array:${targetDay}`;

  // Load list snapshot
  const items = await kvLRange(listKey, 0, -1);

  if (!items.length) return res.status(404).json({ error: "No tasks found for day" });

  const updated = items.map(t => t.id === id ? { ...t, done: true, doneAt: Date.now() } : t);

  // Save authoritative array for the day
  await kvSetJSON(arrKey, updated);

  return res.status(200).json({ ok: true, day: targetDay, id });
}

