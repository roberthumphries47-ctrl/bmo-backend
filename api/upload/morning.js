// api/upload/morning.js
import { kvGetArray } from "../../lib/kv.js";
import { ensureDay, withinDays } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    const day = ensureDay(req);

    // Read from KV (all reads are safe-fallback)
    const tasks = (await kvGetArray(`tasks_array:${day}`)) || [];
    const appts = (await kvGetArray(`calendar@${day}`)) || [];
    const bills = (await kvGetArray(`bills@${day}`)) || [];
    const subs  = (await kvGetArray(`subs`)) || [];

    // Derive slices
    const incomplete = tasks.filter(t => !t?.done);
    const dueSoonBills = bills
      .filter(b => b?.dueISO)
      .filter(b => withinDays(b.dueISO, 14));

    const subsNext30 = subs
      .filter(s => s?.renewISO)
      .filter(s => withinDays(s.renewISO, 30))
      .sort((a, b) => a.renewISO.localeCompare(b.renewISO));

    // Human message (Cyberpunk “Morning Upload”)
    const lines = [];
    lines.push("✨ Morning Upload");
    lines.push(`📅 ${day}`);
    lines.push("");

    lines.push("Appointments (today):");
    lines.push(
      appts.length
        ? appts.map(a => `• ${a.title}${a.startISO ? ` @ ${a.startISO.slice(11,16)}` : ""}${a.location ? ` (${a.location})` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Tasks (incomplete):");
    lines.push(
      incomplete.length
        ? incomplete.map(t => `• ${t.title} ${t.bucket ? `(${labels[t.bucket] || t.bucket})` : ""}` ).join("\n")
        : "• None"
    );
    lines.push("");

    lines.push("Bills (upcoming)");
    lines.push(
      dueSoonBills.length
        ? dueSoonBills.map(b => `• ${b.title} — $${b.amount ?? "?"} — due ${b.dueISO?.slice(0,10)} ${withinDays(b.dueISO,14) ? "⚠️" : ""}`).join("\n")
        : "• None detected"
    );
    lines.push("");

    lines.push("Finances → Subscriptions (next 30 days)");
    lines.push(
      subsNext30.length
        ? subsNext30.map(s => {
            const change = s.priceChange ? ` (⇧ from ${s.priceChange.from} ➜ ${s.priceChange.to})` : "";
            return `• ${s.name}${s.plan ? ` – ${s.plan}` : ""}: $${s.price}${change} — renews ${s.renewISO.slice(0,10)}`;
          }).join("\n")
        : "• None in the next 30 days"
    );
    lines.push("");
    lines.push("Add any new tasks for today?");

    const message = lines.join("\n");

    return res.status(200).json({
      day,
      appointments: appts,
      tasksIncomplete: incomplete,
      billsDueSoon: dueSoonBills,
      subsNext30,
      message
    });
  } catch (err) {
    return res.status(200).json({
      error: "Morning Upload failed",
      details: err?.message || String(err)
    });
  }
}
