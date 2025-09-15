import { kvGetArray } from "../lib/kv.js";

// ---- helpers ----
const ISO = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
const fmt = (iso) => {
  try { const [y, m, d] = iso.split("-").map(Number); return `${m}/${d}`; }
  catch { return iso; }
};
const firstDollar = (s = "") => {
  const m = (s || "").match(/\$\s*[\d,.]+/);
  return m ? m[0].replace(/\s+/g, "") : null;
};
const looksLikeSub = (s = "") =>
  /(renew|subscription|trial|auto\s*pay|autopay|membership|plan|invoice|payment due)/i.test(s);

// Build a base URL that works on Vercel
function baseURL(req) {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const host = req?.headers?.host;
  return host ? `https://${host}` : "";
}
function todayKey(date = new Date()) { return `tasks_array:${ISO(date)}`; }

// De-duplicate by title+bucket
function dedupeTasks(arr = []) {
  const map = new Map();
  for (const t of Array.isArray(arr) ? arr : []) {
    const key = `${(t.title || "").trim().toLowerCase()}__${(t.bucket || "").trim().toLowerCase()}`;
    if (!map.has(key)) map.set(key, t);
  }
  return Array.from(map.values());
}

export async function handler(req, res) {
  const now = new Date();
  const today = ISO(now);
  const next24 = ISO(addDays(now, 1));
  const next30 = ISO(addDays(now, 30));

  // --- Tasks (today) ---
  const tasksRaw = await kvGetArray(todayKey(now));
  const tasks = dedupeTasks(tasksRaw);

  // --- Calendar (we already have a router that returns next 30 days) ---
  let allNext30 = [];
  try {
    const url = `${baseURL(req)}/api/router?action=calendar.events`;
    const r = await fetch(url);
    const data = await r.json();
    if (data?.ok && Array.isArray(data.events)) allNext30 = data.events;
  } catch { /* ignore */ }

  // --- Appointments: next 24h ---
  const appts = allNext30.filter((e) => e?.start >= today && e?.start < next24);

  // --- Bills (simple heuristic: $ in summary happening today) ---
  const billsToday = allNext30.filter(
    (e) => e?.start === today && /\$\s*[\d,.]+/.test(e?.summary || "")
  );

  // --- Subscriptions (next 30d) ---
  const subsRaw = allNext30
    .filter((e) => e?.start >= today && e?.start <= next30 && looksLikeSub(e?.summary || ""))
    .map((e) => {
      const amount = firstDollar(e.summary);
      const dueSoon = e.start <= ISO(addDays(now, 14));
      return { date: e.start, summary: e.summary || "(no title)", amount, dueSoon };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // --- Build message ---
  const lines = [];
  lines.push(`🌅 Morning Upload`);
  lines.push(`🗓️ ${today}`);
  lines.push("");

  // Tasks (de-duped)
  lines.push(`📋 Gigs Today (${tasks.length})`);
  if (tasks.length) {
    lines.push(...tasks.map((t) => `• ${t.title}${t.bucket ? ` (${t.bucket})` : ""}`));
  } else {
    lines.push("• None");
  }
  lines.push("");

  // Appointments next 24h
  lines.push(`📆 Time Slots (next 24h) (${appts.length})`);
  if (appts.length) {
    lines.push(...appts.map((e) => `• ${e.summary || "(no title)"} — ${fmt(e.start)}`));
  } else {
    lines.push("• None");
  }
  lines.push("");

  // Bills today
  lines.push(`💸 Bills Today (${billsToday.length})`);
  if (billsToday.length) {
    lines.push(...billsToday.map((b) => `• ${b.summary} — ${fmt(b.start)}`));
  } else {
    lines.push("• None");
  }
  lines.push("");

  // Subscriptions next 30d (+ highlight ≤14d)
  lines.push(`**Finances → Subscriptions** (next 30 days)`);
  if (subsRaw.length) {
    lines.push(
      ...subsRaw.map((s) =>
        `• ${s.summary} — ${fmt(s.date)}${s.amount ? ` (${s.amount})` : ""}${s.dueSoon ? "  ‼️ due ≤14d" : ""}`
      )
    );
  } else {
    lines.push("• None detected");
  }
  lines.push("");

  // Prompt
  lines.push(`Add any new gigs for today? If so, tell me:`);
  lines.push(`• Title (required)`);
  lines.push(`• Bucket (optional)`);
  lines.push(`• When/notes (optional)`);

  const message = lines.join("\n");
  return res.json({
    ok: true,
    today,
    counts: {
      tasks: tasks.length,
      appts: appts.length,
      billsToday: billsToday.length,
      subs30: subsRaw.length,
    },
    message,
  });
}
