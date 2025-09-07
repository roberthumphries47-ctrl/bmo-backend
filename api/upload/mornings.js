// api/upload/morning.js
import { kvGetArray } from "../../../lib/kv.js";
import { ensureDay, withinDays } from "../../../lib/utils.js";
import { labels, terms } from "../../../lib/buckets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
  const day = ensureDay(req);

  // data
  const tasks = await kvGetArray(`tasks_array:${day}`);
  const appts = await kvGetArray(`calendar:${day}`);
  const bills = await kvGetArray(`bills:`) || []; // all bills (we’ll filter)
  const subs = await kvGetArray(`subs:`) || [];

  const incomplete = tasks.filter(t => !t.done);
  const dueSoonBills = bills
    .filter(b => withinDays(b.dueISO, 14))
    .sort((a,b)=> (a.dueISO||"").localeCompare(b.dueISO||""));
  const subs30 = subs
    .filter(s => withinDays(s.renewISO, 30))
    .sort((a,b)=> (a.renewISO||"").localeCompare(b.renewISO||""));

  // Human message
  const lines = [];
  lines.push(`${terms.morning} — ${day}`);
  lines.push("");
  lines.push(`Appointments (today)`);
  lines.push(appts.length ? appts.map(a=>`• ${a.title} — ${a.startISO?.slice(11,16)} @ ${a.location||"—"}`).join("\n") : "• None");
  lines.push("");
  lines.push(`Tasks (incomplete)`);
  lines.push(incomplete.length ? incomplete.map(t=>`• ${t.title} [${labels[t.bucket]||t.bucket}]`).join("\n") : "• None");
  lines.push("");
  lines.push(`Bills (upcoming)`);
  lines.push(dueSoonBills.length ? dueSoonBills.map(b=>`• ${b.name} — ₡${b.amount} — due ${b.dueISO?.slice(0,10)} ${withinDays(b.dueISO,14)?"⚠️":""}`).join("\n") : "• None detected");
  lines.push("");
  lines.push(`Finances → Subscriptions (next 30 days)`);
  lines.push(subs30.length ? subs30.map(s=>`• ${s.name} (${s.plan||"—"}) — ₡${s.price} — renews ${s.renewISO?.slice(0,10)}${s.priceChange?` (was ₡${s.priceChange.from} → ₡${s.priceChange.to})`:""}`).join("\n") : "• None in the next 30 days");
  lines.push("");
  lines.push(`Add any new ${terms.task.toLowerCase()}s for today?`);

  const message = lines.join("\n");

  return res.status(200).json({
    day,
    sections: {
      appointments: appts,
      tasksIncomplete: incomplete,
      billsDueSoon: dueSoonBills,
      subsNext30: subs30
    },
    message
  });
}
