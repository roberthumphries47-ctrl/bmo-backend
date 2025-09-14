// handlers/tasks-add.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "use_post" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { title, bucket = "Solo Ops", when = null, notes = null } = body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ ok: false, error: "missing_title" });
    }

    const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `tasks_array:${todayISO}`;

    const arr = (await kvGetArray(key)) || [];
    const task = {
      id: `t_${Date.now()}`,
      title,
      bucket,
      when,
      notes,
      done: false,
      createdAt: Date.now()
    };

    await kvSetArray(key, [task, ...arr]);

    return res.status(200).json({ ok: true, savedTo: key, task });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "add_failed", details: err?.message || String(err) });
  }
}
