// api/recap/nightly.js
import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";

function isoDay(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10);
}
function daysFrom(baseISO, n) {
  const d = new Date(baseISO + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const today = isoDay();
  const tomorrow = daysFrom(today, 1);

  // Load today's task array
  const tasks = (await kvGetJSON(`tasks_array:${today}`)) || [];

  // Split into completed and incomplete
  const completed = tasks.filter((t) => t.done);
  const incomplete = tasks.filter((t) => !t.done);

  // Roll incomplete forward automatically
  if (incomplete.length > 0) {
    const tomorrowTasks = (await kvGetJSON(`tasks_array:${tomorrow}`)) || [];
    const rolled = [
      ...tomorrowTasks,
      ...incomplete.map((t) => ({ ...t, rolled: true })),
    ];
    await kvSetJSON(`tasks_array:${tomorrow}`, rolled);
  }

  // Build human-friendly message
  const lines = [];
  lines.push(`Nightly Recap for ${today}`);
  lines.push("");

  lines.push("Completed:");
  if (!completed.length) {
    lines.push("• None");
  } else {
    for (const t of completed) {
      lines.push(`• ${t.title} (${t.bucket || "general"})`);
    }
  }
  lines.push("");

  lines.push("Incomplete (rolled to tomorrow):");
  if (!incomplete.length) {
    lines.push("• None");
  } else {
    for (const t of incomplete) {
      lines.push(`• ${t.title} (${t.bucket || "general"})`);
    }
  }
  lines.push("");
  lines.push("Need to reschedule or delete any rolled tasks?");

  const message = lines.join("\n");

  return res.status(200).json({
    today,
    tomorrow,
    completed,
    rolled: incomplete,
    rolledCount: incomplete.length,
    message,
  });
}
