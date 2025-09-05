import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    // Be defensive about body parsing on serverless
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const day  = (body.dueISO ? new Date(body.dueISO) : new Date()).toISOString().slice(0,10);

    const task = {
      id: String(Date.now()),
      title: body.title || "Untitled",
      bucket: body.bucket || "general",
      dueISO: body.dueISO || new Date().toISOString(),
      done: false
    };

    // Use one canonical JSON array per-day
    const key = `tasks:${day}`;
    const arr = (await kvGetJSON(key)) || [];
    arr.push(task);
    await kvSetJSON(key, arr);

    res.status(200).json({ ok: true, task });
  } catch (err) {
    res.status(500).json({ error: "ADD_FAILED", detail: String(err?.message || err) });
  }
}
