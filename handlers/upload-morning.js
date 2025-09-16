// handlers/upload-morning.js
import { kvGetArray, kvGet } from "../lib/kv.js";
import { ensureDay } from "../lib/utils.js";
import { getAccessToken, calendarListEvents } from "../lib/google.js";
import { labels } from "../lib/buckets.js";

function toISODate(d) { return new Date(d).toISOString().slice(0,10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function daysUntil(dateISO) {
  const a = new Date(toISODate(new Date()));
  const b = new Date(dateISO);
  return Math.ceil((b - a) / (24*3600*1000));
}

export async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok:false, error:"use_get" });

    const today = ensureDay(req);
    const todayKey = `tasks_array:${today}`;
    const tasks = (await kvGetArray(todayKey)) || [];

    // next-24h calendar
    const token = await getAccessToken(["https://www.googleapis.com/auth/calendar.readonly"]);
    const timeMin = new Date();
    const timeMax = addDays(timeMin, 1);
    const events = await calendarListEvents(token, {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 20,
    });

    // bills today (from calendar summary heuristics)
    const billsToday = (events.items || [])
      .filter(e => (e.summary || "").match(/\b(bill|payment|due|renew|autopay)\b/i))
      .filter(e => (e.start?.date || e.start?.dateTime || "").slice(0,10) === today);

    // subscriptions (saved by gmail-subscriptions-scan)
    const subs = (await kvGet("subs_next30")) || [];
    const subsSorted = subs
      .map(x => ({
        ...x,
        dueIn: x.renewalDate ? daysUntil(x.renewalDate) : null
      }))
      .sort((a, b) => {
        const da = a.renewalDate ? new Date(a.renewalDate).getTime() : Infinity;
        const db = b.renewalDate ? new Date(b.renewalDate).getTime() : Infinity;
        return da - db;
      });

    // Render
    const lines = [];
    lines.push("🌅 Morning Upload");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    // Tasks
    lines.push(`📋 Gigs Today (${tasks.length})`);
    if (!tasks.length) {
      lines.push("• None");
    } else {
      for (const t of tasks.slice(0, 20)) {
        const b = t.bucket ? (labels[t.bucket] || t.bucket) : null;
        lines.push(`• ${t.title}${b ? ` (${b})` : ""}`);
      }
      if (tasks.length > 20) lines.push(`• …and ${tasks.length - 20} more`);
    }
    lines.push("");

    // Appointments
    const appts = (events.items || []).filter(e => !/\b(bill|payment|due|renew|autopay)\b/i.test(e.summary || ""));
    lines.push(`📆 Time Slots (next 24h) (${appts.length})`);
    if (!appts.length) {
      lines.push("• None");
    } else {
      for (const e of appts.slice(0, 10)) {
        const start = (e.start?.date || e.start?.dateTime || "").slice(0,16).replace("T"," ");
        lines.push(`• ${start} — ${e.summary || "(no title)"}`);
      }
      if (appts.length > 10) lines.push(`• …and ${appts.length - 10} more`);
    }
    lines.push("");

    // Bills (heuristic from calendar)
    lines.push(`💸 Bills Today (${billsToday.length})`);
    if (!billsToday.length) {
      lines.push("• None");
    } else {
      for (const e of billsToday.slice(0, 10)) {
        lines.push(`• ${e.summary}`);
      }
    }
    lines.push("");

    // Subscriptions
    lines.push("**Finances → Subscriptions** (next 30 days)");
    if (!subsSorted.length) {
      lines.push("• None detected");
    } else {
      for (const s of subsSorted.slice(0, 12)) {
        const due = s.renewalDate ? ` — due ${s.renewalDate}` : " — due (date tbd)";
        const amt = (s.amount != null) ? ` for $${s.amount}` : "";
        const badge = (s.dueIn != null && s.dueIn <= 14) ? " ⚠️" : "";
        lines.push(`• ${s.service}${amt}${due}${badge}`);
      }
      if (subsSorted.length > 12) lines.push(`• …and ${subsSorted.length - 12} more`);
    }
    lines.push("");
    lines.push("Add any new gigs for today? If so, tell me:");
    lines.push("• Title (required)");
    lines.push("• Bucket (optional)");
    lines.push("• When/notes (optional)");

    return res.status(200).json({ ok:true, message: lines.join("\n") });
  } catch (err) {
    return res.status(200).json({ ok:false, error:"morning_failed", details: err?.message || String(err) });
  }
}

export default { handler };
