import { kv } from "../lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { title, bucket } = req.body || {};
    if (!title || !bucket) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    const id = `task:${Date.now()}`;
    await kv.set(id, JSON.stringify({ id, title, bucket, done: false }));

    return res.status(200).json({ ok: true, id, title, bucket });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "add_failed", details: err.message });
  }
}
