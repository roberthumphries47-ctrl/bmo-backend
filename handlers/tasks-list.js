import { kv } from "../lib/kv.js";

export default async function handler(req, res) {
  try {
    const keys = await kv.keys("task:*");
    const results = [];

    for (const key of keys) {
      const val = await kv.get(key);
      if (val) results.push(JSON.parse(val));
    }

    return res.status(200).json({ ok: true, count: results.length, tasks: results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "list_failed", details: err.message });
  }
}
