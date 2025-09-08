// api/upload/morning.js
import { kvGetArray } from "../../lib/kv.js";
import { ensureDay, withinDays } from "../../lib/utils.js";
import { labels, terms } from "../../lib/buckets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  // figure out day from query (?day=YYYY-MM-DD) or today
  const day = ensureDay(req);
  console.log("[Morning] start", { day });

  // Keys we’ll read
  const tasksKey = `tasks_array:${day}`;
  const calKey   = `calendar:${day}`;
  const billsKey = `bills:${day}`;          // all bills (we’ll filter soon)
  const subsKey  = `subs:${day}`;           // subscriptions cache (optional)

  // ---- DEBUG: show env that the KV client relies on
  console.log("[Morning] env check", {
    KV_REST_API_URL: process.env.KV_REST_API_URL ? "present" : "MISSING",
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "present" : "MISSING",
  });

  let tasks = [], appts = [], bills = [], subs = [];
  try {
    console.log("[Morning] fetching", tasksKey);
    tasks = await kvGetArray(tasksKey);
    console.log("[Morning] tasks count", tasks?.length ?? 0);
  } catch (e) {
    console.error("[Morning] fetch tasks failed", { key: tasksKey, error: e?.message });
    return res.status(500).json({ error: "Morning Upload failed", details: `tasks: ${e?.message}` });
  }

  try {
    console.log("[Morning] fetching", calKey);
    appts = await kvGetArray(calKey);
    console.log("[Morning] appts count", appts?.length ?? 0);
  } catch (e) {
    console.error("[Morning] fetch calendar failed", { key: calKey, error: e?.message });
    return res.status(500).json({ error: "Morning Upload failed", details: `calendar: ${e?.message}` });
  }

  try {
    console.log("[Morning] fetching", billsKey);
    bills = await kvGetArray(billsKey);
    console.log("[Morning] bills count", bills?.length ?? 0);
  } catch (e) {
    console.error("[Morning] fetch bills failed", { key: billsKey, error: e?.message });
    return res.status(500).json({ error: "Morning Upload failed", details: `bills: ${e?.message}` });
  }

  try {
    console.log("[Morning] fetching", subsKey);
    subs = await kvGetArray(subsKey);
    console.log("[Morning] subs count", subs?.length ?? 0);
  } catch (e) {
    // subs are optional — don’t fail the whole request
    console.warn("[Morning] fetch subs failed (continuing)", { key: subsKey, error: e?.message });
    subs = [];
  }

  // derive sections
  const incomplete = tasks.filter(t => !t.done);
  const dueSoonBills = (bills || [])
    .filter(b => withinDays(b.dueISO, 14));
  const subsNext30 = (subs || [])
    .filter(s => withinDays(s.renewISO, 30))
    .sort((a, b) => a.renewISO.localeCompare(b.renewISO));

  // compose human message
  const lines = [];
  lines.push(`${terms.morning} – ${day}`);
  lines.push("");
  lines.push("Appointments (today)");
  lines.push(appts.length ? appts.map(a => `• ${a.title} – ${a.startISO?.slice(11,16)} @ ${a.location||"—"}`).join("\n") : "• None");
  lines.push("");
  lines.push("Tasks (incomplete)");
  lines.push(incomplete.length ? incomplete.map(t => `• ${t.title}  [${labels[t.bucket]||t.bucket}]`).join("\n") : "• None");
  lines.push("");
  lines.push("Bills (upcoming)");
  lines.push(dueSoonBills.length
    ? dueSoonBills.map(b => `• ${b.title} — $${b.amount} – due ${b.dueISO?.slice(0,10)} ⚠`).join("\n")
    : "• None detected");
  lines.push("");
  lines.push("Finances • Subscriptions (next 30 days)");
  lines.push(subsNext30.length
    ? subsNext30.map(s => {
        const price = s.price ? `$${s.price}` : "—";
        const delta = s.priceChange ? ` (was $${s.priceChange.from} → $${s.priceChange.to})` : "";
        return `• ${s.name} — ${price}${delta} — renews ${s.renewISO?.slice(0,10)}`;
      }).join("\n")
    : "• None in the next 30 days");
  lines.push("");
  lines.push("Add any new tasks for today?");

  const message = lines.join("\n");

  return res.status(200).json({
    day,
    appointments: appts,
    tasksIncomplete: incomplete,
    billsDueSoon: dueSoonBills,
    subsNext30,
    message,
  });
}
