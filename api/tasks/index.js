// api/tasks/index.js
import { kvGetArray, kvSetArray } from "../../../lib/kv.js";
import { ensureDay, uid, groupByBucket } from "../../../lib/utils.js";
import { labels } from "../../../lib/buckets.js";

export default async function handler(req, res) {
  const day = ensureDay(req);

  // GET -> list tasks (optionally by day)
  if (req.method === "GET") {
    const items = await kvGetArray(`tasks_array:${day}`);
    const grouped = groupByBucket(items);
    return res.status(200).json({ day, grouped, raw: items });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use GET or POST" });
  }

  let body = {};
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch {}
  const action = (body.action || "add").toLowerCase();

  // Load today's list
  const key = `tasks_array:${day}`;
  const items = await kvGetArray(key);

  if (action === "add") {
    // { title, bucket, dueISO }
    const task = {
      id: uid(),
      title: body.title || "Untitled",
      bucket: (body.bucket || "general").toLowerCase(),
      dueISO: body.dueISO || null,
      done: false
    };
    items.push(task);
    await kvSetArray(key, items);
    return res.status(200).json({ ok: true, task });
  }

  if (action === "complete") {
    // { id }
    const idx = items.findIndex(t => t.id === body.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    items[idx] = { ...items[idx], done: true };
    await kvSetArray(key, items);
    return res.status(200).json({ ok: true, id: body.id });
  }

  if (action === "update") {
    // { id, ...fields }
    const idx = items.findIndex(t => t.id === body.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    items[idx] = { ...items[idx], ...body };
    await kvSetArray(key, items);
    return res.status(200).json({ ok: true, task: items[idx] });
  }

  if (action === "reset") {
    await kvSetArray(key, []);
    return res.status(200).json({ ok: true, cleared: day });
  }

  // Optional: list via POST
  if (action === "list") {
    const grouped = groupByBucket(items);
    return res.status(200).json({ day, grouped, raw: items });
  }

  return res.status(400).json({ error: "Unknown action" });
}
