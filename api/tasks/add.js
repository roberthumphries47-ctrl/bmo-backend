import { kvLPush } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { title, bucket = "general", dueISO = new Date().toISOString(), done = false } = req.body || {};
  if (!title) return res.status(400).json({ error: "Missing 'title'" });

  const day = new Date(dueISO).toISOString().slice(0,10); // YYYY-MM-DD
  const key = `tasks:${day}`;

  const task = { id: `${Date.now()}`, title, bucket, dueISO, done };
  await kvLPush(key, task);
  res.status(200).json({ ok: true, task });
}
