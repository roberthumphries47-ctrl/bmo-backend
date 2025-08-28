import { kvLRange } from "../../lib/kv.js";

export default async function handler(req, res) {
  const day = (req.query.day || new Date().toISOString().slice(0,10));
  const key = `tasks:${day}`;
  const tasks = await kvLRange(key, 0, -1);
  res.status(200).json({ day, tasks });
}
