// handlers/debug-kv-probe.js
import { kvGet, kvSet } from "../lib/kv.js";

export default async function handler(req, res) {
  try {
    const key = "__probe__";
    const write = await kvSet(key, "hello");
    const read = await kvGet(key);
    return res.status(200).json({ ok: true, write, read });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "probe_failed", details: err?.message || String(err) });
  }
}
