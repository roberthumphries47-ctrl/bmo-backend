// handlers/tasks-list.js
import { kvGetArray } from "../lib/kv.js";

// simple helper to format YYYY-MM-DD
function fmtDay(d) {
  return d.toISOString().slice(0, 10);
}

export async function handler(req, res) {
  try {
    const day = (req.query.day || fmtDay(new Date())).toString();
    const key = `tasks_array:${day}`;
    const tasks = await kvGetArray(key);

    return res.status(200).json({
      ok: true,
      day,
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "tasks_list_failed",
      details: String(err),
    });
  }
}
