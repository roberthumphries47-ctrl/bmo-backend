// api/upload/morning.js
import { kvGetArray } from "../../lib/kv.js";
import { ensureDay, withinDays } from "../../lib/utils.js";
import { labels } from "../../lib/buckets.js";

// ---- small helpers (safe debug) ----
const mask = (v, keep = 6) =>
  typeof v === "string" && v.length > keep
    ? `${v.slice(0, keep)}…${"•".repeat(6)}`
    : v ? "set" : "missing";

function envSnapshot() {
  return {
    KV_REST_API_URL: mask(process.env.KV_REST_API_URL),
    KV_REST_API_TOKEN: mask(process.env.KV_REST_API_TOKEN),
    KV_URL: mask(process.env.KV_URL),
    REDIS_URL: mask(process.env.REDIS_URL),
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    // --- env debug (doesn't leak secrets) ---
    const env = envSnapshot();
    const env_present = Object.values(env).every(v => v && v !== "missing");

    const day = ensureDay(req);

    // pull data from KV (these keys are what we used earlier)
    const tasks = (await kvGetArray(`tasks_array:${day}`)) || [];
    const appts = (await kvGetArray(`calendar:${day}`)) || [];
    const bills = (await kvGetArray("bills")) || [];
    const subs  = (await kvGetArray("subs")) || [];

    // sections
    const incomplete = tasks.filter(t => !t?.done);
    const dueSoonBills = bills
      .filter(b => b?.dueISO)
      .filter(b => withinDays(b.dueISO, 14))
      .sort((a, b) => (a.dueISO || "").localeCompare(b.dueISO || ""));

    const subsNext30 = subs
      .filter(s => s?.renewISO && withinDays(s.renewISO, 30))
      .sort((a, b) => (a.renewISO || "").localeCompare(b.renewISO || ""));

    // human message
    const lines = [];
    lines.push("📤 Morning Upload");
    lines.push(`🗓️ ${day}`);
    lines.push("");

    // Appointments
    lines.push("Appointments (today):");
    lines.push(
      appts.length
        ? appts.map(a => `• ${a.title}${a.startISO ? ` @ ${a.startISO.slice(11,16)}` : ""}${a.location ? ` @ ${a.location}` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    // Tasks
    lines.push("Tasks (incomplete):");
    lines.push(
      incomplete.length
        ? incomplete.map(t => `• ${t.title}${t.bucket ? ` — ${labels[t.bucket] || t.bucket}` : ""}`).join("\n")
        : "• None"
    );
    lines.push("");

    // Bills
    lines.push("Bills (upcoming):");
    lines.push(
      dueSoonBills.length
        ? dueSoonBills.map(b => `• ${b.title || "Bill"} — $${b.amount ?? "?"} — due ${b.dueISO?.slice(0,10)}`).join("\n")
        : "• None detected"
    );
    lines.push("");

    // Subscriptions
    lines.push("Finances → Subscriptions (next 30 days):");
    lines.push(
      subsNext30.length
        ? subsNext30.map(s => {
            const price = s.price != null ? `$${s.price}` : (s.priceTo != null ? `$${s.priceTo}` : "unknown");
            const priceChange =
              s.priceChange && (s.priceChange.from != null || s.priceChange.to != null)
                ? ` (price change: ${s.priceChange.from != null ? `$${s.priceChange.from}` : "?"} → ${s.priceChange.to != null ? `$${s.priceChange.to}` : "?"}${s.effectiveISO ? ` on ${s.effectiveISO.slice(0,10)}` : ""})`
                : "";
            const soon = withinDays(s.renewISO, 14) ? " ⚠️" : "";
            return `• ${s.name || "Subscription"} — ${price} — renews ${s.renewISO?.slice(0,10)}${priceChange}${soon}`;
          }).join("\n")
        : "• None in the next 30 days"
    );
    lines.push("");

    lines.push("Add any new tasks for today?");

    const message = lines.join("\n");

    return res.status(200).json({
      ok: true,
      day,
      appointments: appts,
      tasksIncomplete: incomplete,
      billsDueSoon: dueSoonBills,
      subsNext30,
      message,
      env_present,
      env_sample: env, // masked
    });
  } catch (err) {
    return res.status(200).json({
      error: "Morning Upload failed",
      details: err?.message || String(err),
    });
  }
}
