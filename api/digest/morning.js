// api/digest/morning.js
import { kvGetJSON, kvLRange } from "../../lib/kv.js";

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
  return BUCKET_LABELS[bucket?.toLowerCase()] || BUCKET_LABELS.uncategorized;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const day = (req.query.day && String(req.query.day)) || todayISO();

  let tasks = (await kvGetJSON(`tasks_array:${day}`)) ?? [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const legacy = await kvLRange(`tasks:${day}`, 0, -1);
    tasks = (legacy ?? []).map(v => typeof v === "string" ? safeJSON(v) : v).filter(Boolean);
  }

  const grouped = {};
  for (const t of tasks) {
    const bucket = (t.bucket || "uncategorized").toLowerCase();
    const k = labelFor(bucket);
    if (!grouped[k]) grouped[k] = { completed: [], incomplete: [] };
    (t.done ? grouped[k].completed : grouped[k].incomplete).push({
      id: t.id, title: t.title, dueISO: t.dueISO ?? null, rawBucket: bucket
    });
  }

  const calendar = (await kvGetJSON(`calendar:${day}`)) ?? [];
  const bills = (await kvGetJSON("bills")) ?? [];
  const subs  = (await kvGetJSON("subscriptions")) ?? [];

  const lines = [];
  lines.push(`[ MORNING UPLOAD // ${day} ]`);
  lines.push("");
  lines.push("Time Slots:");
  if (!calendar.length) {
    lines.push(" • None");
  } else {
    for (const e of calendar) {
      lines.push(` • ${e.title} — ${hhmm(e.startISO)} @ ${e.location || "unknown block"}`);
    }
  }
  lines.push("");
  lines.push("Active Gigs:");
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
  lines.push("Queue any new gigs for today?");

  const message = lines.join("\n");

  return res.status(200).json({
    day,
    grouped,
    calendar,
    bills: upcomingBills,
    subscriptions: upcomingSubs,
    message,
    bucketLabels: BUCKET_LABELS,
  });
}

function safeJSON(s){ try { return JSON.parse(s); } catch { return null; } }
