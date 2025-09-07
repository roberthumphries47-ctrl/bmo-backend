// api/calendar/index.js
import { kvGetArray, kvSetArray } from "../../../lib/kv.js";
import { ensureDay } from "../../../lib/utils.js";

export default async function handler(req, res) {
  const day = ensureDay(req);
  const key = `calendar:${day}`;

  if (req.method === "GET") {
    const events = await kvGetArray(key);
    return res.status(200).json({ day, events });
  }

  if (req.method === "POST") {
    // { title, startISO, endISO, location }
    let body={};
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch {}
    const events = await kvGetArray(key);
    events.push({
      title: body.title || "Untitled",
      startISO: body.startISO || `${day}T15:00:00Z`,
      endISO: body.endISO || `${day}T16:00:00Z`,
      location: body.location || ""
    });
    await kvSetArray(key, events);
    return res.status(200).json({ ok: true, count: events.length });
  }

  return res.status(405).json({ error: "Use GET or POST" });
}
