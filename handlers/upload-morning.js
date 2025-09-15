// handlers/upload-morning.js
import { kvGetArray } from "../lib/kv.js";
import { getAccessToken } from "../lib/google.js";

function isoDay(date = new Date()) { return new Date(date.toISOString().slice(0,10)); }
function fmt(d) { return d.toISOString().slice(0,10); }

async function getEventsWindow() {
  const now = new Date();
  const start = new Date(now.toISOString());             // now
  const end = new Date(now.getTime() + 24*60*60*1000);   // +24h
  const timeMin = now.toISOString();
  const timeMax = end.toISOString();

  const accessToken = await getAccessToken(["https://www.googleapis.com/auth/calendar.readonly"]);
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents","true");
  url.searchParams.set("orderBy","startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);

  const res = await fetch(url, { headers:{Authorization:`Bearer ${accessToken}`} });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "calendar_fetch_failed");

  const toDate = (s) => (s?.dateTime || s?.date || "").slice(0,16).replace("T"," ");
  return (json.items||[]).map(e => ({
    id: e.id,
    summary: e.summary || "(no title)",
    start: toDate(e.start),
    end: toDate(e.end),
    location: e.location || null
  }));
}

function pickBills(events) {
  const billWords = /(bill|due|payment|pay|invoice|\$|\d+\s?USD)/i;
  return events.filter(e => billWords.test(e.summary||""));
}

export async function handler(req, res) {
  try {
    const today = fmt(isoDay());
    const tasks = await kvGetArray(`tasks_array:${today}`);

    const events = await getEventsWindow();
    const bills = pickBills(events);

    // (Stub) subscriptions for next 30d — we’ll fill in real logic soon
    const subscriptions = [];

    // Build digest
    const lines = [];
    lines.push("🌅 Morning Digest");
    lines.push(`🗓️ ${today}`);
    lines.push("");

    // Tasks
    const byBucket = tasks.reduce((m,t)=>{ (m[t.bucket||"General"] ??= []).push(t); return m; }, {});
    lines.push("Tasks");
    if (tasks.length === 0) lines.push("• None on the board yet");
    else {
      Object.keys(byBucket).sort().forEach(b=>{
        lines.push(`• ${b}: ${byBucket[b].map(t=>t.title).join(", ")}`);
      });
    }
    lines.push("");

    // Calendar
    lines.push("Calendar (next 24h)");
    if (events.length === 0) lines.push("• No events");
    else events.forEach(e => lines.push(`• ${e.start} — ${e.summary}${e.location?` @ ${e.location}`:""}`));
    lines.push("");

    // Bills
    lines.push("Bills & Payments (found in Calendar)");
    if (bills.length === 0) lines.push("• None flagged");
    else bills.forEach(b=>lines.push(`• ${b.start} — ${b.summary}`));
    lines.push("");

    // Subscriptions (stub)
    lines.push("Finances → Subscriptions (next 30 days)");
    lines.push(subscriptions.length ? subscriptions.map(s=>`• ${s}`).join("\n") : "• None detected (scanner coming in V1.1)");
    lines.push("");
    lines.push("Add anything for today? Tell me a title (and bucket if you want).");

    return res.status(200).json({ ok:true, message: lines.join("\n") });
  } catch (err) {
    return res.status(200).json({ ok:false, error:"morning_digest_failed", details:String(err) });
  }
}

export default { handler };
