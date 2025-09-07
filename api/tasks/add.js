import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const day =
    (typeof req.query.day === "string" && req.query.day) ||
    new Date().toISOString().slice(0, 10);

  const { title, bucket, dueISO, done } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: "Missing title" });
  }

  const task = {
    id: Date.now().toString(),
    title,
    bucket: bucket || "general",
    dueISO: dueISO || null,
    done: !!done,
  };

  const key = `tasks_array:${day}`;
  const existing = (await kvGetJSON(key)) || [];
  existing.push(task);
  await kvSetJSON(key, existing);

  return res.status(200).json({ ok: true, task });
}
