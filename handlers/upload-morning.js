// api/upload/morning.js
import { kvGetArray } from "../../lib/kv.js";
import { ensureDay, withinDays, tomorrowISO } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    // ----- Day context
    const day = ensureDay(req);               // e.g. "2025-09-13"
    const tomorrow = tomorrowISO(new Date(`${day}T08:00:00Z`));

    // ----- KV tasks for today
    const key = `tasks_array:${day}`;
    const items = (await kvGetArray(key)) || [];
    const incomplete = items.filter(t => !t?.done);
    const closed = items.filter(t => t?.done);

    // ----- Live Google Calendar: only today's events
    const base = `https://${req.headers.host}`;
    const cal = await fetch(`${base}/api/calendar/events`).then(r => r.json()).catch(() => ({ ok:false, events:[] }));
    const todaysEvents = (cal?.events || []).filter(ev => ev?.start === day);

    // ----- Finances → Subscriptions (placeholder list from KV if you already keep any)
    // If you already store subscriptions in KV (array of {name, amount, renewISO, priceChange?}):
    const subs = (await kvGetArray("subs")) || [];
    const next30 = subs.filter(s => withinDays(s?.renewISO, day, 30));
    const due14  = next30.filter(s => withinDays(s?.renewISO, day, 14));

    // ----- Human message
    const lines = [];
    lines.push("☀️ Morning Upload");
    lines.push(`🗓️ ${day}`);
    lines.push("");

    // Appointments (today)
    lines.push("Appointments (today):");
    lines.push(
      todaysEvents.length
        ? todaysEvents
            .map(e => {
              const label = e.summary || "(no title)";
              return `• ${label}${e.location ? ` @ ${e.location}` : ""}`;
            })
            .join("\n")
        : "• None"
    );
    lines.push("");

    // Tasks (incomplete)
    lines.push("Tasks (incomplete):");
    lines.push(
      incomplete.length
        ? incomplete
            .map(t => `• ${t.title}${t.bucket ? ` (${labels[t.bucket] || t.bucket})` : ""}`)
            .join("\n")
        : "• None"
    );
    lines.push("");

    // Finances → Subscriptions
    lines.push("Finances → Subscriptions (next 30 days):");
    lines.push(
      next30.length
        ? next30
            .map(s => {
              const due = s.renewISO?.slice?.(0, 10) || "unknown";
              const amt = s.amount != null ? `$${s.amount}` : "amount N/A";
              const bump = s.priceChange ? " ⚠️ price change" : "";
              const soon = withinDays(s.renewISO, day, 14) ? " ⏰ due <14d" : "";
              return `• ${s.name} — ${amt} — renews ${due}${bump}${soon}`;
            })
            .join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Anything new to add for today? Tell me the task title and bucket.");

    const message = lines.join("\n");

    return res.status(200).json({
      ok: true,
      day,
      tomorrow,
      appointments: todaysEvents,
      tasksIncomplete: incomplete,
      tasksClosed: closed,
      subsNext30: next30,
      message,
    });
  } catch (err) {
    return res.status(200).json({
      error: "Morning Upload failed",
      details: err?.message || String(err),
    });
  }
}
