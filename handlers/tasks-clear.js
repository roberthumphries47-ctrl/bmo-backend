import { kvDel } from "../lib/kv.js";

const ISO = (d) => d.toISOString().slice(0, 10);

export async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const day = url.searchParams.get("day") || ISO(new Date());
    const key = `tasks_array:${day}`;
    await kvDel(key);
    return res.json({ ok: true, cleared: key });
  } catch (e) {
    return res.json({ ok: false, error: "clear_failed", details: e?.message || String(e) });
  }
}
