// api/digest/morning.js
import { kvGetJSON, kvLRange } from "../../lib/kv.js";

function isoDay(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}
function daysFrom(baseISO, n) {
  const d = new Date(baseISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
function withinDays(targetISO, baseISO, maxDays) {
  const t = new Date(targetISO).getTime();
  const b = new Date(baseISO + "T00:00:00Z").getTime();
  const diffDays = Math.floor((t - b) / (24 * 3600 * 1000));
  return diffDays >= 0 && diffDays <= maxDays;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const url = new URL(req.url, "http://localhost");
  const day = url.searchParams.get("day") || isoDay(); // allow ?day=YYYY-MM-DD for testing

  // ---- Appointments (seeded under key: calendar:YYYY-MM-DD)
  const appointments =
    (await kvGetJSON(`calendar:${day}`))?.value || []; // seed stores {value:[...]}

  // ---- Tasks for today (we support both storage shapes)
  // 1) array under tasks_array:YYYY-MM-DD
  // 2) list under tasks:YYYY-MM-DD (fallback)
  let tasks = (await kvGetJSON(`tasks_array:${day}`)) || null;
  if (!tasks) {
    const rr = await kvLRange(`tasks:${day}`, 0, -1);
    tasks = rr.map((t) => (typeof t === "string" ? JSON.parse(t) : t));
  }

  // ---- Bills: scan next 30 days for any bills:bYYYY-MM-DD keys (seed shape)
  const bills = [];
  for (let i = 0; i <= 30; i++) {
    const d = daysFrom(day, i);
    const b = await kvGetJSON(`bills:${d}`);
    if (b && b.name) bills.push(b);
  }
  // highlight if due within 14 days
  const highlightedBills = bills.map((b) => ({
    ...b,
    highlight: withinDays(b.dueISO, day, 14),
  }));

  // ---- Subscriptions: one array in key "subscriptions" (seed shape)
  const subsAll = (await kvGetJSON("subscriptions")) || [];
  const subsNext30 = subsAll.filter((s) => withinDays(s.renewISO, day, 30));

  // ---- Build human-friendly message
  const lines = [];
  lines.push(`Morning Digest – ${day}`);
  lines.push("");

  // Appointments
  lines.push("Appointments (today)");
  if (!appointments.length) {
    lines.push("• None");
  } else {
    for (const a of appointments) {
      // a = { title, startISO, endISO, location }
      const time = new Date(a.startISO).toISOString().slice(11, 16); // HH:MM (UTC)
      lines.push(`• ${a.title} — ${time}${a.location ? ` @ ${a.location}` : ""}`);
    }
  }
  lines.push("");

  // Tasks (incomplete only)
  const incomplete = tasks.filter((t) => !t.done);
  lines.push("Tasks (incomplete)");
  if (!incomplete.length) {
    lines.push("• None");
  } else {
    // group by bucket
    const grouped = {};
    for (const t of incomplete) {
      const b = t.bucket || "general";
      (grouped[b] ||= []).push(t);
    }
    for (const [bucket, arr] of Object.entries(grouped)) {
      lines.push(`• ${bucket}: ${arr.map((t) => t.title).join(", ")}`);
    }
  }
  lines.push("");

  // Bills
  lines.push("Bills (upcoming)");
  if (!highlightedBills.length) {
    lines.push("• None detected");
  } else {
    for (const b of highlightedBills) {
      const due = b.dueISO?.slice(0, 10);
      lines.push(
        `• ${b.name} — $${Number(b.amount).toFixed(2)} — due ${due}${
          b.highlight ? " ⚠️" : ""
        }`
      );
    }
  }
  lines.push("");

  // Subscriptions
  lines.push("Finances → Subscriptions (next 30 days)");
  if (!subsNext30.length) {
    lines.push("• None in the next 30 days");
  } else {
    for (const s of subsNext30) {
      const due = s.renewISO?.slice(0, 10);
      const price = s.price != null ? `$${Number(s.price).toFixed(2)}` : "";
      const pc =
        s.priceChange && s.priceChange.from != null && s.priceChange.to != null
          ? ` (price change: $${Number(s.priceChange.from).toFixed(2)} → $${Number(
              s.priceChange.to
            ).toFixed(2)} on ${s.priceChange.effectiveISO?.slice(0, 10)})`
          : "";
      lines.push(`• ${s.name} — ${s.plan || ""} ${price} — renews ${due}${pc}`);
    }
  }
  lines.push("");
  lines.push("Add any new tasks for today?");

  const message = lines.join("\n");

  return res.status(200).json({
    day,
    appointments,
    tasks,
    bills: highlightedBills,
    subscriptions: subsNext30,
    message,
  });
}
