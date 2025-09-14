// api/router.js
const table = {
  "ping":            () => import("../handlers/ping.js"),
  "upload.morning":  () => import("../handlers/upload-morning.js"),
  "download.evening":() => import("../handlers/download-evening.js"),
  "debug.kv":        () => import("../handlers/debug-kv.js"),
  "debug.kv-probe":  () => import("../handlers/debug-kv-probe.js"),
  "tasks.add":       () => import("../handlers/tasks-add.js"),
  "tasks.list":      () => import("../handlers/tasks-list.js"),
  "gmail.labels":    () => import("../handlers/gmail-labels.js"),
  "calendar.events": () => import("../handlers/calendar-events.js"),
};

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const action = url.searchParams.get("action");

    const loader = table[action];
    if (!loader) {
      return res.status(404).json({ ok: false, error: "unknown_action", action });
    }

    // dynamic import inside try/catch so any import-time error becomes JSON
    const mod = await loader();
    const fn = mod.default || mod.handler || mod;
    if (typeof fn !== "function") {
      return res.status(500).json({ ok: false, error: "invalid_handler", action });
    }
    return await fn(req, res);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "router_failed",
      details: String(err?.stack || err),
    });
  }
}
