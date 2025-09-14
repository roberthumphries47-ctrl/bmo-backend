// handlers/tasks-add.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function makeId() {
  return `t_${Date.now()}`;
}

export async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { title, bucket = "Solo Ops", when = null, notes = null } =
      (req.body || {});
    if (!title || typeof title !== "string") {
      return res.status(400).json({ ok: false, error: "missing_title" });
    }

    const day = today();
    const key = `tasks_array:${day}`;
    const tasks = await kvGetArray(key);

    const task = {
      id: makeId(),
      title: title.trim(),
      bucket,
      when,
      notes,
      done: false,
      createdAt: Date.now(),
    };

    tasks.unshift(task);
    await kvSetArray(key, tasks);

    return res.status(200).json({ ok: true, savedTo: key, task });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "tasks_add_failed", details: String(err) });
  }
}
