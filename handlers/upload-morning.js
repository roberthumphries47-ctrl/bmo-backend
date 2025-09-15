import { kvGetArray } from "../lib/kv.js";

function todayKey(date = new Date()) {
  return `tasks_array:${date.toISOString().slice(0, 10)}`;
}

export async function handler(req, res) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // --- Tasks ---
  const tasks = await kvGetArray(todayKey(now));

  // --- Calendar ---
  let events = [];
  try {
    const calResp = await fetch(
      `${process.env.VERCEL_URL}/api/router?action=calendar.events`
    );
    const data = await calResp.json();
    if (data?.ok) {
      events = (data.events || []).filter(
        (e) => e.start >= today && e.start < tomorrow
      );
    }
  } catch {
    // swallow errors
  }

  // --- Bills (simple: calendar items w/ $) ---
  const bills = events.filter((e) => /\$\d+/.test(e.summary || ""));

  // --- Build message ---
  let msg = `🌅 Morning Digest\n🗓️ ${today}\n\n`;

  msg += `📋 Tasks (${tasks.length})\n`;
  msg += tasks.length
    ? tasks.map((t) => `• ${t.title} (${t.bucket})`).join("\n")
    : "• None\n";

  msg += `\n\n📆 Appointments (${events.length})\n`;
  msg += events.length
    ? events.map((e) => `• ${e.summary}`).join("\n")
    : "• None\n";

  msg += `\n\n💸 Bills (${bills.length})\n`;
  msg += bills.length
    ? bills.map((b) => `• ${b.summary}`).join("\n")
    : "• None\n";

  return res.json({ ok: true, message: msg });
}
