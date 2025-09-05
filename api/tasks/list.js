import { kvGetJSON, kvLRange } from "../../lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Use GET" });
    }

    const day = new Date().toISOString().slice(0,10);
    const key = `tasks:${day}`;

    // Prefer JSON array; fall back to legacy list if not present
    let tasks = await kvGetJSON(key);
    if (!Array.isArray(tasks)) {
      const listItems = await kvLRange(key, 0, -1);
      tasks = Array.isArray(listItems) ? listItems : [];
    }

    const grouped = {};
    for (const t of tasks) {
      const bucket = t.bucket || "general";
      if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };
      (t.done ? grouped[bucket].completed : grouped[bucket].incomplete).push(t);
    }

    res.status(200).json({ day, grouped });
  } catch (err) {
    res.status(500).json({ error: "LIST_FAILED", detail: String(err?.message || err) });
  }
}
