// api/tasks/list.js
import { kvGetArray } from "../../lib/kv.js";
import { ensureDay } from "../../lib/utils.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Use GET" });
    const day = ensureDay(req);
    const key = `tasks_array:${day}`;
    const items = (await kvGetArray(key)) || [];
    return res.status(200).json({ ok: true, day, count: items.length, items });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "list_failed", details: err?.message || String(err) });
  }
}
