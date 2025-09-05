// api/digest/morning.js
import { kvGetJSON } from "../../lib/kv.js";

function ymd(date = new Date()) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )).toISOString().slice(0, 10);
}
function withinDays(iso, days = 14) {
  try {
    const now = Date.now();
    const dt = new Date(iso).getTime();
    const diff = (dt - now) / (1000 * 60 * 60 * 24);
    return diff <= days;
  } catch { return false; }
}
function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0,10);
  } catch { return iso; }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  const today = (typeof req.query.day === "string" && req.query.day) || ymd();

  // Load sections from KV (all optional)
  const tasks = (await kvGetJSON(`tasks_array:${today}`)) || [];
  const events = (await kvGetJSON(`calendar:${today}`)) || [];
  const billsUpcoming = (await kvGetJSON(`bills:upcoming`)) || [];
  const subsUpcoming  = (await kvGetJSON(`subscriptions:upcoming`)) || [];

  // Group tasks by bucket, split incomplete
  const buckets = {};
  for (const t of tasks) {
    const b = t.bucket || "general";
    if (!buckets[b]) buckets[b] = { completed: [], incomplete: [] };
    (t.done ? buckets[b].completed : buckets[b].incomplete).push(t);
  }

  // Build Finances → Subscriptions with 30-day window and 14-day highlight
  const now = Date.now();
  const in30d = subsUpcoming.filter(s => {
    try {
      const dt = new Date(s.renewISO).getTime();
      const diff = (dt - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    } catch { return false; }
  }).sort((a,b)=> String(a.renewISO).localeCompare(String(b.renewISO)));

  // Build message
  const lines = [];
  lines.push(`Morning Digest — ${today}`);
  lines.push("");

  // Appointments
  lines.push("Appointments (today)");
  if (events.length === 0) lines.push("• None");
  else {
    for (const ev of events) {
      const time = ev.startISO ? new Date(ev.startISO).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
      lines.push(`• ${ev.title}${time ? " — " + time : ""}${ev.location ? " @ " + ev.location : ""}`);
    }
  }
  lines.push("");

  // Tasks (incomplete only)
  lines.push("Tasks (incomplete)");
  const anyIncomplete = Object.values(buckets).some(g => g.incomplete.length > 0);
  if (!anyIncomplete) lines.push("• None");
  else {
    for (const bucket of Object.keys(buckets).sort()) {
      const g = buckets[bucket];
      if (!g.incomplete.length) continue;
      lines.push(`• ${bucket}`);
      for (const t of g.incomplete) {
        const due = t.dueISO ? ` (due ${fmtDate(t.dueISO)})` : "";
        lines.push(`   - ${t.title}${due}`);
      }
    }
  }
  lines.push("");

  // Bills (from upcoming list if present)
  lines.push("Bills (upcoming)");
  if (billsUpcoming.length === 0) lines.push("• None detected");
  else {
    for (const b of billsUpcoming.sort((a,b)=> String(a.dueISO).localeCompare(String(b.dueISO)))) {
      const soon = withinDays(b.dueISO, 14) ? " ⚠️" : "";
      lines.push(`• ${b.name}${b.amount ? ` — $${b.amount}` : ""} — due ${fmtDate(b.dueISO)}${soon}`);
    }
  }
  lines.push("");

  // Finances → Subscriptions (30 days; highlight <= 14d)
  lines.push("Finances → Subscriptions (next 30 days)");
  if (in30d.length === 0) lines.push("• None in the next 30 days");
  else {
    for (const s of in30d) {
      const soon = withinDays(s.renewISO, 14) ? " ⚠️" : "";
      const amt = s.amount ? ` — $${s.amount}` : "";
      const note = s.note ? ` (${s.note})` : "";
      lines.push(`• ${s.name}${amt} — renews ${fmtDate(s.renewISO)}${soon}${note}`);
    }
  }
  lines.push("");
  lines.push("Add any new tasks for today?");

  // Return both message and structured data
  return res.status(200).json({
    day: today,
    message: lines.join("\n"),
    data: {
      appointments: events,
      tasksByBucket: buckets,
      billsUpcoming,
      subscriptionsNext30: in30d
    }
  });
}
