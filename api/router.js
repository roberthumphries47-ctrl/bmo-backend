// api/router.js
export default async function handler(req, res) {
  const action = (req.query?.action || "").toString();

  const table = {
    "ping":                "../handlers/ping.js",
    "gmail.labels":        "../handlers/gmail-labels.js",
    "calendar.events":     "../handlers/calendar-events.js",
    "tasks.add":           "../handlers/tasks-add.js",
    "tasks.list":          "../handlers/tasks-list.js",
    "tasks.complete":      "../handlers/tasks-complete.js",
    "tasks.completeByTitle":"../handlers/tasks-complete-by-title.js",
    "upload.morning":      "../handlers/upload-morning.js",
    "download.evening":    "../handlers/download-evening.js",
    "debug.kv":            "../handlers/debug-kv.js",
    "debug.kv-probe":      "../handlers/debug-kv-probe.js",
  };

  try {
    if (!action || !table[action]) {
      return res.status(400).json({ ok: false, error: "unknown_action", action });
    }
    const modPath = table[action];

    let mod;
    try {
      mod = await import(modPath);
    } catch (e) {
      return res.status(200).json({ ok: false, error: "import_failed", details: String(e) });
    }

    if (typeof mod.handler !== "function") {
      return res.status(200).json({ ok: false, error: "router_failed", details: `No exported 'handler' in ${modPath}` });
    }

    return await mod.handler(req, res);
  } catch (err) {
    return res.status(200).json({ ok: false, error: "router_failed", details: String(err) });
  }
}
