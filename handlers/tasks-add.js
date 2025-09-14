// handlers/tasks-add.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";

function todayISO() { return new Date().toISOString().slice(0, 10); }

export async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed", hint: "Use POST" });
    }

    const day = todayISO();
    const key = `tasks_array:${day}`;

    const body = await readJson(req);
    const title = (body?.title || "").trim();
    const bucket = body?.bucket || null;
    const when = body?.when || null;
    const notes = body?.notes || null;

    if (!title) return res.status(400).json({ ok: false, error: "missing_title" });

    const task = {
      id: `t_${Date.now()}`,
      title, bucket, when, notes,
      done: false,
      createdAt: Date.now(),
    };

    const arr = (await kvGetArray(key)) || [];
    arr.unshift(task);
    await kvSetArray(key, arr);

    return res.status(200).json({ ok: true, savedTo: key, task });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "add_failed", details: err?.message || String(err) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return {}; }
}
