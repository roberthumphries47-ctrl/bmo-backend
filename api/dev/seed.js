// api/dev/seed.js
import { kvSetJSON, kvGetJSON, kvDel } from "../../lib/kv.js";

export default async function handler(req, res) {
  const token = req.headers["x-admin-token"];
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    if (req.method === "POST") {
      // Body: { key: "subscriptions:upcoming", value: [...] }
      const { key, value } = req.body || {};
      if (!key) return res.status(400).json({ error: "Missing 'key'" });
      await kvSetJSON(key, value);
      return res.status(200).json({ ok: true, wrote: key });
    }

    if (req.method === "GET") {
      // Query: ?key=...
      const key = req.query.key;
      if (!key) return res.status(400).json({ error: "Missing 'key'" });
      const value = await kvGetJSON(key);
      return res.status(200).json({ key, value });
    }

    if (req.method === "DELETE") {
      // Body: { key: "..." }
      const { key } = req.body || {};
      if (!key) return res.status(400).json({ error: "Missing 'key'" });
      await kvDel(key);
      return res.status(200).json({ ok: true, deleted: key });
    }

    res.status(405).json({ error: "Use POST / GET / DELETE" });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
