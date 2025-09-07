// api/digest/morning.js
import { kvGetJSON, kvLRange } from "../../lib/kv.js";

// Canonical bucket slugs in storage -> display names (Cyberpunk streetkid skin)
const BUCKET_LABELS = {
  finances: "Cred Sharks",
  house: "Safehouse",
  autosxs: "Wraiths",
  art: "Lucidworks",          // placeholder; swap anytime
  fitness: "Animals",
  diet: "Gut Hacks",
  sidejob: "Side Gigs",
  personal: "Solo Ops",
  health: "Ripperdocs",
  junk: "Scavs",
  uncategorized: "Ghosts",
};

function todayISO() { return new Date().toISOString().slice(0,10); }
function hhmm(iso) { return iso?.slice(11,16) ?? ""; }
function labelFor(bucket) {
  // fall back to “Ghosts” if someone invents a new bucket on the fly
  return BUCKET_LABELS[bucket?.toLowerCase()] || BUCKET_LABELS.uncategorized;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const day = (req.query.day && String(req.query.day)) || todayISO();

  // Tasks for the day (array first; fallback to legacy list)
  let tasks = (await kvGetJSON(`tasks_array:${day}`)) ?? [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const legacy = await kvLRange(`tasks:${day}`, 0, -1);
    tasks = (legacy ?? []).map(v => typeof v === "string" ? safeJSON(v) : v).filter(Boolean);
  }

  // Group by bucket and split status
  const grouped = {};
  for (const t of tasks) {
    const bucket = (t.bucket || "uncategorized").toLowerCase();
    const k = labelFor(bucket);
    if (!grouped[k]) grouped[k] = { completed: [], incomplete: [] };
    (t.done ? grouped[k].completed : grouped[k].incomplete).push({
      id: t.id, title: t.title, dueISO: t.dueISO ?? null, rawBucket: bucket
    });
  }

  // Calendar / bills / subscriptions use your existing seed keys
  const calendar = (await kvGetJSON(`calendar:${day}`)) ?? []; // [{title,startISO,endISO,location}]
  const bills = (await kvGetJSON("bills")) ?? [];              // [{name,amount,dueISO}]
  const subs  = (await kvGetJSON("subscriptions")) ?? [];      // [{name,plan,price,renewISO,priceChange?}]

  // Build message (streetkid cyberpunk)
  const lines = [];
  lines.push(`[ OPERATOR’S FEED // ${day} ]`);
  lines.push("");
  lines.push("Meets:");
  if (!calendar.length) {
    lines.push(" • None");
  } else {
    for (const e of calendar) {
      lines.push(` • ${e.title} — ${hhmm(e.startISO)} @ ${e.location || "unknown block"}`);
    }
  }
  lines.push("");
  lines.push("Gigs by Division:");
  const hasAnyGig = Object.values(grouped).some(g => g.incomplete.length > 0);
  if (!hasAnyGig) {
    lines.push(" • None");
  } else {
    for (const [display, g] of Object.entries(grouped)) {
      if (!g.incomplete.length) continue;
      lines.push(` • ${display}:`);
      for (const q of g.incomplete) {
        const due = q.dueISO ? ` (due ${q.dueISO.slice(5,10)})` : "";
        lines.push(`   – ${q.title}${due}`);
      }
    }
  }
  lines.push("");
  // Bills within 30 days, flag <=14 days
  lines.push("Cred Tabs (upcoming):");
  const now = Date.now();
  const in30 = now + 30*24*3600*1000;
  const in14 = now + 14*24*3600*1000;
  const upcomingBills = bills
    .map(b => ({...b, ts: Date.parse(b.dueISO)}))
    .filter(b => !Number.isNaN(b.ts) && b.ts <= in30)
    .sort((a,b) => a.ts - b.ts);
  if (!upcomingBills.length) {
    lines.push(" • None detected");
  } else {
    for (const b of upcomingBills) {
      const urgent = b.ts <= in14 ? " ⚠" : "";
      const amt = b.amount != null ? `${Number(b.amount).toFixed(2)} eddies` : "eddies";
      lines.push(` • ${b.name} — ${amt} — due ${new Date(b.ts).toISOString().slice(0,10)}${urgent}`);
    }
  }
  lines.push("");
  // Subscriptions next 30 days
  lines.push("Fixer Retainers (next 30 days):");
  const upcomingSubs = subs
    .map(s => ({...s, ts: Date.parse(s.renewISO)}))
    .filter(s => !Number.isNaN(s.ts) && s.ts <= in30)
    .sort((a,b) => a.ts - b.ts);
  if (!upcomingSubs.length) {
    lines.push(" • None in window");
  } else {
    for (const s of upcomingSubs) {
      const price = s.price != null ? `${Number(s.price).toFixed(2)} eddies` : "eddies";
      const change = s.priceChange && s.priceChange.from != null && s.priceChange.to != null
        ? ` ↑ ${Number(s.priceChange.from).toFixed(2)}→${Number(s.priceChange.to).toFixed(2)} eddies`
        : "";
      lines.push(` • ${s.name} — ${s.plan || "plan"} — ${price} — renews ${s.renewISO.slice(0,10)}${change}`);
    }
  }
  lines.push("");
  lines.push("New gig for today? Say: “New Gig: <title> in <division> due <date>”");

  const message = lines.join("\n");

  return res.status(200).json({
    day,
    grouped,          // with display names as keys
    calendar,
    bills: upcomingBills,
    subscriptions: upcomingSubs,
    message,
    bucketLabels: BUCKET_LABELS, // expose mapping for the app UI
  });
}

function safeJSON(s){ try { return JSON.parse(s); } catch { return null; } }
