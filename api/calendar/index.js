import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

export default async function handler(req, res) {
  const key = "calendar:events";
  if (req.method === "GET") {
    const items = (await kvGetJSON(key)) || [];
    return res.status(200).json({ items });
  }
  if (req.method === "POST") {
    const { title, startISO, endISO, location } = req.body || {};
    const events = (await kvGetJSON(key)) || [];
    events.push({ id: String(Date.now()), title, startISO, endISO, location });
    await kvSetJSON(key, events);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Use GET or POST" });
}
