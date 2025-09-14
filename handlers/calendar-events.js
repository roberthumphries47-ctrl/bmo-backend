import { getAccessToken } from "../lib/google.js";

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!resp.ok) throw new Error(`Calendar API error: ${resp.status}`);

    const data = await resp.json();
    const events = (data.items || []).map(ev => ({
      id: ev.id,
      summary: ev.summary,
      start: ev.start?.date || ev.start?.dateTime,
      end: ev.end?.date || ev.end?.dateTime,
      location: ev.location || null,
      status: ev.status,
      htmlLink: ev.htmlLink
    }));

    return res.status(200).json({ ok: true, timeMin, timeMax, count: events.length, events });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "calendar_events_failed", details: err.message });
  }
}
