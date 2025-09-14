// handlers/tasks-list.js
import { kvGetArray } from "../lib/kv.js";

export default async function handler(req, res) {
  try {
    const day = (req.query?.day && String(req.query.day)) || new Date().toISOString().slice(0, 10);
    const key = `tasks_array:${day}`;
    const arr = (await kvGetArray(key)) || [];
    return res.status(200).json({ ok: true, day, count: arr.length, tasks: arr });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "list_failed", details: err?.message || String(err) });
  }
}
