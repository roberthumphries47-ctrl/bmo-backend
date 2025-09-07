// api/digest/morning.js
import { kvGetJSON, kvLRange } from "../../lib/kv.js";

/**
 * Morning digest:
 * - Reads today's tasks (array/fallback) and shows active quests by guild
 * - Reads seeded calendar/bills/subscriptions (same keys you already used)
 * - Returns structured data + RPG-flavored human message
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const day = (req.query.day || new Date().toISOString().slice(0, 10));

  // Quests today
  let tasks = (await kvGetJSON(`tasks_array:${day}`)) ?? [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const legacy = await kvLRange(`tasks:${day}`, 0, -1);
    tasks = (legacy ?? []).map((t) => (typeof t === "string" ? JSON.parse(t) : t));
  }
  const grouped = {};
  for (const t of tasks) {
    const bucket = t.bucket || "general";
    if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };
    (t.done ? grouped[bucket].completed : grouped[bucket].incomplete).push(t);
  }

  // Calendar / Bills / Subscriptions (from your dev seed or future integrations)
  const calendar = (await kvGetJSON(`calendar:${day}`)) ?? [];              // [{title,startISO,endISO,location}]
  const bills = (await kvGetJSON("bills")) ?? [];                           // [{name,amount,dueISO}]
  const subs = (await kvGetJSON("subscriptions")) ?? [];                    // [{name,plan,price,renewISO,priceChange?}]

  const human = buildRPGMorning(day, grouped, calendar, bills, subs);

  return res.status(200).json({
    day,
    grouped,
    calendar,
    bills,
    subscriptions: subs,
    message: human,
  });
}

function buildRPGMorning(day, grouped, calendar, bills, subs) {
  const lines = [];
  lines.push(`📜 Quest Board — ${day}`);
  lines.push("");

  // Appointments
  lines.push("🏰 Appointments (today)");
  if (calendar.length === 0) {
    lines.push("• None");
  } else {
    for (const e of calendar) lines.push(`• ${briefTime(e.startISO)} — ${e.title}${e.location ? ` @ ${e.location}` : ""}`);
  }
  lines.push("");

  // Active quests
  lines.push("🗺️  Active Quests (incomplete)");
  let anyActive = false;
  for (const [bucket, g] of Object.entries(grouped)) {
    const inc = g.incomplete;
    if (inc.length) {
      anyActive = true;
      lines.push(`• ${prettyGuild(bucket)}:`);
      for (const q of inc) lines.push(`   - ${q.title}`);
    }
  }
  if (!anyActive) lines.push("• None");
  lines.push("");

  // Bills (next 30 days) with 14-day highlight
  lines.push("💰 Bills (upcoming)");
  if (bills.length === 0) {
    lines.push("• None detected");
  } else {
    const now = Date.now();
    const in30 = now + 30 * 24 * 3600 * 1000;
    const in14 = now + 14 * 24 * 3600 * 1000;
    const upcoming = bills
      .map((b) => ({ ...b, ts: Date.parse(b.dueISO) }))
      .filter((b) => !Number.isNaN(b.ts) && b.ts <= in30)
      .sort((a, b) => a.ts - b.ts);
    if (upcoming.length === 0) {
      lines.push("• None in the next 30 days");
    } else {
      for (const b of upcoming) {
        const urgent = b.ts <= in14 ? " ⚠️" : "";
        lines.push(`• ${b.name} — $${Number(b.amount ?? 0).toFixed(2)} — due ${b.dueISO.slice(0, 10)}${urgent}`);
      }
    }
  }
  lines.push("");

  // Subscriptions (next 30 days) + price changes
  lines.push("🏷️  Finances → Subscriptions (next 30 days)");
  if (subs.length === 0) {
    lines.push("• None in the next 30 days");
  } else {
    const now = Date.now();
    const in30 = now + 30 * 24 * 3600 * 1000;
    const upcoming = subs
      .map((s) => ({ ...s, ts: Date.parse(s.renewISO) }))
      .filter((s) => !Number.isNaN(s.ts) && s.ts <= in30)
      .sort((a, b) => a.ts - b.ts);

    if (upcoming.length === 0) {
      lines.push("• None in the next 30 days");
    } else {
      for (const s of upcoming) {
        const price = s.price != null ? `$${Number(s.price).toFixed(2)}` : "—";
        const pc = s.priceChange ? ` (price change: ${fmtPriceChange(s.priceChange)})` : "";
        lines.push(`• ${s.name} — ${s.plan ?? "plan"} — ${price} — renews ${s.renewISO.slice(0, 10)}${pc}`);
      }
    }
  }
  lines.push("");
  lines.push("Anything to add to today’s quest list? Tell me the title (and optional guild/bucket).");
  return lines.join("\n");
}

function prettyGuild(bucket) {
  return bucket === "general" ? "General Guild" : capitalize(bucket) + " Guild";
}
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function briefTime(iso) { return iso?.slice(11, 16) ?? ""; }
function fmtPriceChange(pc) {
  if (typeof pc === "string") return pc;
  if (pc && typeof pc === "object" && pc.from != null && pc.to != null) {
    return `$${Number(pc.from).toFixed(2)} → $${Number(pc.to).toFixed(2)}`;
  }
  return "updated";
}
