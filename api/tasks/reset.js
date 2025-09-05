// api/tasks/reset.js
import { kvDel } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const day = (req.query.day || new Date().toISOString().slice(0, 10));

  const keys = [
    `tasks:${day}`,
    `tasks_array:${day}`,
  ];

  let deleted = [];
  for (const k of keys) {
    try {
      await kvDel(k);
      deleted.push(k);
    } catch (e) {
      // ignore missing keys
    }
  }

  return res.status(200).json({ ok: true, day, deleted });
}
