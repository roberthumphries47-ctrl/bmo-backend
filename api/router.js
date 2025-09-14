// api/router.js
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const action = url.searchParams.get("action");

    // ---- static imports (bundled automatically) ----
    const ping = (await import("../handlers/ping.js")).default;
    const uploadMorning = (await import("../handlers/upload-morning.js")).default;
    const downloadEvening = (await import("../handlers/download-evening.js")).default;
    const debugKv = (await import("../handlers/debug-kv.js")).default;
    const debugKvProbe = (await import("../handlers/debug-kv-probe.js")).default;
    const tasksAdd = (await import("../handlers/tasks-add.js")).default;
    const tasksList = (await import("../handlers/tasks-list.js")).default;
    const gmailLabels = (await import("../handlers/gmail-labels.js")).default;
    const calendarEvents = (await import("../handlers/calendar-events.js")).default;
    // -------------------------------------------------

    const map = {
      "ping": ping,
      "upload.morning": uploadMorning,
      "download.evening": downloadEvening,
      "debug.kv": debugKv,
      "debug.kv-probe": debugKvProbe,
      "tasks.add": tasksAdd,
      "tasks.list": tasksList,
      "gmail.labels": gmailLabels,
      "calendar.events": calendarEvents,
    };

    const fn = map[action];
    if (!fn) {
      return res.status(404).json({ ok: false, error: "unknown_action", action });
    }
    return await fn(req, res);
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "router_failed", details: String(err?.stack || err) });
  }
}
