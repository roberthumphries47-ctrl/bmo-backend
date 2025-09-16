// api/router.js
import gmailLabels from "../handlers/gmail-labels.js";
import calendarEvents from "../handlers/calendar-events.js";
import tasksAdd from "../handlers/tasks-add.js";
import tasksList from "../handlers/tasks-list.js";
import tasksComplete from "../handlers/tasks-complete.js";
import tasksClear from "../handlers/tasks-clear.js";
import uploadMorning from "../handlers/upload-morning.js";
import downloadEvening from "../handlers/download-evening.js";
import debugKv from "../handlers/debug-kv.js";
import debugKvProbe from "../handlers/debug-kv-probe.js";

export default async function handler(req, res) {
  try {
    const { action } = req.query;

    switch (action) {
      case "ping":
        return res.json({ ok: true, message: "pong", env_present: true });

      case "gmail.labels":
        return gmailLabels(req, res);

      case "calendar.events":
        return calendarEvents(req, res);

      case "tasks.add":
        return tasksAdd(req, res);

      case "tasks.list":
        return tasksList(req, res);

      case "tasks.complete":
        return tasksComplete(req, res);

      case "tasks.clear":
        return tasksClear(req, res);

      case "upload.morning":
        return uploadMorning(req, res);

      case "download.evening":
        return downloadEvening(req, res);

      case "debug.kv":
        return debugKv(req, res);

      case "debug.kv-probe":
        return debugKvProbe(req, res);

      default:
        return res.status(400).json({ ok: false, error: "unknown_action", action });
    }
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "router_failed",
      details: err.message,
    });
  }
}
