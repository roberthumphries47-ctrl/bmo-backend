import { kvLRange, kvSetJSON } from "../../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { id } = req.body || {};
  const day = new Date().toISOString().slice(0, 10);
  if (!id) return res.status(400).json({ error: "Missing 'id'" });

  const key = `tasks:${day}`;
  const items = await kvLRange(key, 0, -1);

  const updated = items.map(t => {
    const parsed = typeof t === "string" ? JSON.parse(t) : t;
    if (String(parsed.id) === String(id)) {
      return { ...parsed, done: true };
    }
    return parsed;
  });

  await kvSetJSON(`tasks_array:${day}`, updated);

  res.status(200).json({ ok: true });
}
