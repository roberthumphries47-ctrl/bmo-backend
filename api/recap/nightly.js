// api/recap/nightly.js
import { kvGetJSON, kvSetJSON, kvLRange } from "../../lib/kv.js";

const BUCKET_LABELS = {
  finances: "Cred Sharks",
  house: "Safehouse",
  autosxs: "Wraiths",
  art: "Lucidworks",
  fitness: "Animals",
  diet: "Gut Hacks",
  sidejob: "Side Gigs",
  personal: "Solo Ops",
  health: "Ripperdocs",
  junk: "Scavs",
  uncategorized: "Ghosts",
};
function labelFor(bucket) {
  return BUCKET_LABELS[bucket?.toLowerCase()] || BUCKET_LABELS.uncategorized;
}
function isoDay(d=new Date()){ return new Date(d).toISOString().slice(0,10); }

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const today = isoDay();
  const tomorrow = isoDay(new Date(Date.now() + 24*3600*1000));

  let tasks = (await kvGetJSON(`tasks_array:${today}`)) ?? [];
  if (!Array.isArray(tasks) || tasks.length === 0) {
    const legacy = await kvLRange(`tasks:${today}`, 0, -1);
    tasks = (legacy ?? []).map(v => typeof v === "string" ? safeJSON(v) : v).filter(Boolean);
  }

  const grouped = {};
  for (const t of tasks) {
    const b = (t.bucket || "uncategorized").toLowerCase();
    const key = labelFor(b);
    if (!grouped[key]) grouped[key] = { completed: [], incomplete: [] };
    (t.done ? grouped[key].completed : grouped[key].incomplete).push({
      id: t.id, title: t.title, dueISO: t.dueISO ?? null, rawBucket: b
    });
  }

  const toCarry = [];
  for (const g of Object.values(grouped)) {
    for (const q of g.incomplete) {
      toCarry.push({
        id: q.id,
        title: q.title,
        bucket: q.rawBucket,
        done: false,
        dueISO: `${tomorrow}T23:59:00Z`,
      });
    }
  }
  if (toCarry.length) {
    const tKey = `tasks_array:${tomorrow}`;
    const existing = (await kvGetJSON(tKey)) ?? [];
    const map = new Map(existing.map(t => [t.id, t]));
    for (const q of toCarry) map.set(q.id, q);
    await kvSetJSON(tKey, Array.from(map.values()));
  }

  const lines = [];
  lines.push(`[ EVENING DOWNLOAD // ${today} ]`);
  lines.push("");
  lines.push("Closed:");
  let anyClosed = false;
  for (const [display, g] of Object.entries(grouped)) {
    if (g.completed.length) {
      anyClosed = true;
      lines.push(` • ${display}:`);
      for (const q of g.completed) lines.push(`   – ${q.title}`);
    }
  }
  if (!anyClosed) lines.push(" • None");
  lines.push("");
  lines.push("Loose Ends (auto-rolled for tomorrow):");
  let anyOpen = false;
  for (const [display, g] of Object.entries(grouped)) {
    if (g.incomplete.length) {
      anyOpen = true;
      lines.push(` • ${display}:`);
      for (const q of g.incomplete) lines.push(`   – ${q.title} ↻ re-slot`);
    }
  }
  if (!anyOpen) lines.push(" • None");
  lines.push("");
  lines.push("Need to re-slot or scrap any gigs?");

  const message = lines.join("\n");

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    message,
    bucketLabels: BUCKET_LABELS,
  });
}

function safeJSON(s){ try { return JSON.parse(s); } catch { return null; } }
