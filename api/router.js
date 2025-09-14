// api/router.js
import { URL } from 'url';

// import handlers
import ping from '../handlers/ping.js';
import uploadMorning from '../handlers/upload-morning.js';
import downloadEvening from '../handlers/download-evening.js';
import debugKv from '../handlers/debug-kv.js';
import debugKvProbe from '../handlers/debug-kv-probe.js';
import tasksAdd from '../handlers/tasks-add.js';
import tasksList from '../handlers/tasks-list.js';
import gmailLabels from '../handlers/gmail-labels.js';
import calendarEvents from '../handlers/calendar-events.js';

// map action -> handler
const routes = {
  ping,
  'upload.morning': uploadMorning,
  'download.evening': downloadEvening,
  'debug.kv': debugKv,
  'debug.kv-probe': debugKvProbe,
  'tasks.add': tasksAdd,
  'tasks.list': tasksList,
  'gmail.labels': gmailLabels,
  'calendar.events': calendarEvents,
};

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');

    if (!action) {
      return res.status(400).json({ ok: false, error: 'missing_action' });
    }

    // allow action with / or . (e.g. upload/morning or upload.morning)
    const key = routes[action] ? action : action.replace('/', '.');
    const fn = routes[key];

    if (!fn) {
      return res.status(404).json({ ok: false, error: 'unknown_action', action });
    }

    // delegate to the selected handler (each returns JSON)
    return fn(req, res);
  } catch (err) {
    return res
      .status(200)
      .json({ ok: false, error: 'router_failed', details: String(err) });
  }
}
