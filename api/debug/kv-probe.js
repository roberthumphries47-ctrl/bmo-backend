// api/debug/kv-probe.js
import { kvGetArray, kvSetArray } from "../../lib/kv.js";

export default async function handler(req, res) {
  try {
    const key = "__probe_array__";
    // Write a tiny array
    await kvSetArray(key, ["hello", Date.now()]);
    const got = await kvGetArray(key);
    return res.status(200).json({
      ok: true,
      route: "/api/debug/kv-probe",
      wrote: 2,
      readCount: got.length,
      sample: got.slice(0, 2),
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      route: "/api/debug/kv-probe",
      error: err?.message || String(err),
    });
  }
}
