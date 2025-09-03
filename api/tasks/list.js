import { kvLRange } from "../../lib/kv.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET" });
  }

  const day = new Date().toISOString().slice(0, 10);
  const key = `tasks:${day}`;

  // Fetch all tasks for today
  const tasks = await kvLRange(key, 0, -1);
  const parsed = tasks.map(t => (typeof t === "string" ? JSON.parse(t) : t));

  // Group by bucket
  const grouped = {};
  for (const task of parsed) {
    const bucket = task.bucket || "general";
    if (!grouped[bucket]) {
      grouped[bucket] = { completed: [], incomplete: [] };
    }
    if (task.done) {
      grouped[bucket].completed.push(task);
    } else {
      grouped[bucket].incomplete.push(task);
    }
  }

  res.status(200).json({
    day,
    grouped,
  });
}


