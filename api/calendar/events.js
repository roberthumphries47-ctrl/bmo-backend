// api/calendar/events.js
import { getAccessToken } from "../../lib/google.js";

function iso(daysFromNow = 0, hour = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export default async function handler(req, res) {
  try {
    // Window: now .. +30 days, ordered by start time
    const timeMin = new Date().toISOString();
    const timeMax = iso(30, 23);

    const tok = await getAccessToken();
    if (!tok.ok) {
      return res.status(200).json({ ok: false, stage: "getAccessToken", ...tok });
    }

    const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    // Optional: only show not-cancelled
    url.searchParams.set("showDeleted", "false");
    // Reduce payload
    url.searchParams.set("maxResults", "100");

    const cRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });

    if (!cRes.ok) {
      const text = await cRes.text().catch(() => "");
      return res.status(200).json({
        ok: false,
        stage: "calendar_events_fetch",
        status: cRes.status,
        details: text,
      });
    }

    const data = await cRes.json();
    const items = Array.isArray(data.items) ? data.items : [];

    // Map a compact shape
    const events = items.map((e) => ({
      id: e.id,
      summary: e.summary || "",
      start: e.start?.dateTime || e.start?.date || null,
      end: e.end?.dateTime || e.end?.date || null,
      location: e.location || null,
      status: e.status,
      htmlLink: e.htmlLink,
    }));

    return res.status(200).json({
      ok: true,
      timeMin,
      timeMax,
      count: events.length,
      events,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "handler_exception",
      details: err?.message || String(err),
    });
  }
}
