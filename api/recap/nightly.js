// api/recap/nightly.js
import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

// YYYY-MM-DD (UTC)
function ymd(date = new Date()) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  )).toISOString().slice(0, 10);
}
function addDays(dayStr, n) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return ymd(dt);
}
function eodISO(dayStr) {
  return `${dayStr}T23:59:00Z`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Use GET or POST" });
  }

  const today = (typeof req.query.day === "string" && req.query.day) || ymd();
  const tomorrow = addDays(today, 1);

  const keyToday = `tasks_array:${today}`;
  const keyTomorrow = `tasks_array:${tomorrow}`;

  const todayArr = (await kvGetJSON(keyToday)) || [];
  const tomorrowArr = (await kvGetJSON(keyTomorrow)) || [];

  // Group by bucket; split completed/incomplete
  const grouped = {};
  const incomplete = [];
  for (const t of todayArr) {
    const bucket = t.bucket || "general";
    if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };
    if (t.done) grouped[bucket].completed.push(t);
    else {
      grouped[bucket].incomplete.push(t);
      incomplete.push(t);
    }
  }

  // Roll over all incomplete to tomorrow (no dupes)
  let rolledCount = 0;
  if (incomplete.length) {
    const existingTomorrow = new Map((tomorrowArr || [])
      .filter(x => x && x.id)
      .map(x => [String(x.id), x])
    );

    for (const t of incomplete) {
      const id = String(t.id || "");
      if (!id || existingTomorrow.has(id)) continue;
      const rolled = { ...t, done: false };
      const dueDay = t.dueISO ? String(t.dueISO).slice(0, 10) : null;
      if (!dueDay || dueDay <= today) rolled.dueISO = eodISO(tomorrow);
      tomorrowArr.push(rolled);
      existingTomorrow.set(id, rolled);
      rolledCount++;
    }
    await kvSetJSON(keyTomorrow, tomorrowArr);
  }

  // Human readable message
  const lines = [];
  lines.push(`Nightly recap for ${today}`);
  lines.push("");
  if (Object.keys(grouped).length === 0) {
    lines.push("No items today.");
  } else {
    for (const bucket of Object.keys(grouped).sort()) {
      const g = grouped[bucket];
      lines.push(`• ${bucket}: ${g.completed.length} completed, ${g.incomplete.length} incomplete`);
    }
  }
  lines.push("");
  if (rolledCount > 0) {
    lines.push(`Rolled over ${rolledCount} item${rolledCount === 1 ? "" : "s"} to ${tomorrow}.`);
    lines.push("");
    lines.push("Options for rolled tasks:");
    for (const t of incomplete) {
      lines.push(`- ${t.title} (bucket: ${t.bucket || "general"})`);
      lines.push(`   • Roll over (default, already done)`);
      lines.push(`   • Reschedule → POST /api/tasks/update { id: "${t.id}", action: "reschedule", newDate: "YYYY-MM-DDT23:59:00Z" }`);
      lines.push(`   • Delete → POST /api/tasks/update { id: "${t.id}", action: "delete" }`);
      lines.push("");
    }
  } else {
    lines.push("No items to roll. Nice work!");
  }

  return res.status(200).json({
    today,
    tomorrow,
    grouped,
    rolledCount,
    message: lines.join("\n")
  });
}
