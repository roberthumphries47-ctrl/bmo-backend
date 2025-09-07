import { kvGetJSON, kvLRange } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  // 1) pick the day (YYYY-MM-DD)
  const day =
    (typeof req.query.day === "string" && req.query.day) ||
    new Date().toISOString().slice(0, 10);

  // 2) try JSON-array storage first
  const jsonKey = `tasks_array:${day}`;
  let tasks = (await kvGetJSON(jsonKey)) || [];

  // 3) if not found, fall back to legacy Redis list
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const listKey = `tasks:${day}`;
    const raw = await kvLRange(listKey, 0, -1);
    tasks = raw.map((t) => (typeof t === "string" ? safeJSON(t) : t)).filter(Boolean);
  }

  // 4) normalize task shape
  const parsed = tasks
    .map((t) =>
      typeof t === "string" ? safeJSON(t) : t
    )
    .filter(Boolean)
    .map((t) => ({
      id: t.id,
      title: t.title,
      bucket: t.bucket || "general",
      dueISO: t.dueISO, // optional
      done: !!t.done,
    }));

  // 5) group by bucket and split by status
  const grouped = {};
  for (const task of parsed) {
    const b = task.bucket || "general";
    if (!grouped[b]) grouped[b] = { completed: [], incomplete: [] };
    (task.done ? grouped[b].completed : grouped[b].incomplete).push(task);
  }

  return res.status(200).json({ day, grouped });
}

// helper: safe JSON parse
function safeJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
