// handlers/tasks-complete.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";
import { ensureDay } from "../lib/utils.js";

export async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "use_post" });
    const { id, done = true } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const day = ensureDay(req);
    const key = `tasks_array:${day}`;
    const items = (await kvGetArray(key)) || [];
    let changed = false;

    const updated = items.map(t => {
      if (t?.id === id) { changed = true; return { ...t, done: !!done }; }
      return t;
    });

    if (!changed) return res.status(404).json({ ok: false, error: "not_found", day });

    await kvSetArray(key, updated);
    return res.status(200).json({ ok: true, day, id, done: !!done });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "complete_failed", details: err?.message || String(err) });
  }
}
