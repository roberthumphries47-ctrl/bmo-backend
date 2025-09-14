// handlers/tasks-complete.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";

/** Toggle/mark a task done by id for today (or ?day=yyyy-mm-dd) */
export async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed", hint: "Use POST" });
    }

    const url = new URL(req.url, `https://${req.headers.host}`);
    const day = url.searchParams.get("day") || new Date().toISOString().slice(0, 10);
    const key = `tasks_array:${day}`;

    const body = await readJson(req);
    const id = body?.id;
    const done = body?.done === true;

    if (!id) return res.status(400).json({ ok: false, error: "missing_id" });

    const tasks = await kvGetArray(key);
    let found = false;
    const updated = tasks.map(t => {
      if (t?.id === id) {
        found = true;
        return { ...t, done };
      }
      return t;
    });

    if (!found) return res.status(404).json({ ok: false, error: "not_found", day, id });

    await kvSetArray(key, updated);
    return res.status(200).json({ ok: true, day, id, done });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "complete_failed", details: err?.message || String(err) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return {}; }
}
