// api/router.js
export default async function handler(req, res) {
  try {
    // 1) Parse ?action=
    const url = new URL(req.url, `https://${req.headers.host}`);
    const action = url.searchParams.get("action");

    // 2) Map actions -> handler module file under /handlers
    const actionMap = {
      "ping":               "ping.js",
      "gmail.labels":       "gmail-labels.js",
      "calendar.events":    "calendar-events.js",

      "tasks.add":          "tasks-add.js",
      "tasks.list":         "tasks-list.js",
      "tasks.complete":     "tasks-complete.js",   // <-- NEW

      "upload.morning":     "upload-morning.js",
      "download.evening":   "download-evening.js", // <-- NEW

      "debug.kv":           "debug-kv.js",
      "debug.kv-probe":     "debug-kv-probe.js",
    };

    if (!action || !actionMap[action]) {
      return res.status(400).json({ ok: false, error: "unknown_action", action });
    }

    // 3) Dynamic import of the handler module
    let mod;
    try {
      mod = await import(`../handlers/${actionMap[action]}`);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "router_failed",
        details: `import_failed for "${action}" -> ../handlers/${actionMap[action]}: ${e?.message || e}`
      });
    }

    if (!mod?.handler || typeof mod.handler !== "function") {
      return res.status(500).json({
        ok: false,
        error: "router_failed",
        details: `No exported 'handler' in ../handlers/${actionMap[action]}`
      });
    }

    // 4) Delegate to the action handler
    return await mod.handler(req, res);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "router_failed",
      details: err?.message || String(err),
    });
  }
}
