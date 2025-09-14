// api/router.js
import ping from "../handlers/ping.js";
import uploadMorning from "../handlers/upload-morning.js";
import downloadEvening from "../handlers/download-evening.js";
import debugKv from "../handlers/debug-kv.js";
import debugKvProbe from "../handlers/debug-kv-probe.js";
import tasksAdd from "../handlers/tasks-add.js";
import tasksList from "../handlers/tasks-list.js";
import gmailLabels from "../handlers/gmail-labels.js";
import calendarEvents from "../handlers/calendar-events.js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const action = url.searchParams.get("action");

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
    if (!fn) return res.status(404).json({ ok: false, error: "unknown_action", action });
    return await fn(req, res);
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "router_failed", details: String(err?.stack || err) });
  }
}
