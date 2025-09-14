import { kv } from "../lib/kv.js";

export default async function handler(req, res) {
  try {
    await kv.set("__probe__", "hello");
    const val = await kv.get("__probe__");
    return res.status(200).json({ ok: true, probe: val });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "kv_probe_failed", details: err.message });
  }
}
