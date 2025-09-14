// handlers/tasks-list.js
import { kvGetArray } from "../lib/kv.js";

/** Return tasks for a given day (defaults to today, UTC yyyy-mm-dd). */
export async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const day = url.searchParams.get("day") || new Date().toISOString().slice(0, 10);
    const key = `tasks_array:${day}`;
    const tasks = await kvGetArray(key);
    return res.status(200).json({ ok: true, day, count: tasks.length, tasks });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "list_failed", details: err?.message || String(err) });
  }
}
