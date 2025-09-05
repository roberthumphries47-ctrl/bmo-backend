import { kvGetJSON, kvSetJSON, kvLRange } from "../../lib/kv.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    // Parse body safely (req.body can be string on some runtimes)
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const id   = body.id;
    const day  = (body.day ? new Date(body.day) : new Date()).toISOString().slice(0,10);

    if (!id) return res.status(400).json({ error: "Missing 'id'" });

    const jsonKey = `tasks:${day}`;

    // Try canonical JSON array first
    let tasks = await kvGetJSON(jsonKey);

    // (One-time) migrate from legacy list if JSON array not present
    if (!tasks) {
      const legacyKey = `tasks:${day}`; // same name, different encoding
      const listItems = await kvLRange(legacyKey, 0, -1);
      tasks = Array.isArray(listItems) ? listItems : [];
      await kvSetJSON(jsonKey, tasks); // store as json for future
    }

    // Update
    let changed = false;
    const updated = tasks.map(t => {
      if (String(t.id) === String(id)) {
        changed = true;
        return { ...t, done: true };
      }
      return t;
    });

    if (!changed) {
      return res.status(404).json({ error: "ID_NOT_FOUND", id });
    }

    await kvSetJSON(jsonKey, updated);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "COMPLETE_FAILED", detail: String(err?.message || err) });
  }
}
