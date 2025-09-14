// api/router.js
const ACTIONS = {
  'ping':              '../handlers/ping.js',
  'upload.morning':    '../handlers/upload-morning.js',
  'download.evening':  '../handlers/download-evening.js',
  'debug.kv':          '../handlers/debug-kv.js',
  'debug.kv-probe':    '../handlers/debug-kv-probe.js',
  'tasks.add':         '../handlers/tasks-add.js',
  'tasks.list':        '../handlers/tasks-list.js',
  'gmail.labels':      '../handlers/gmail-labels.js',
  'calendar.events':   '../handlers/calendar-events.js'
};

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const raw = url.searchParams.get('action');
    if (!raw) return res.status(400).json({ ok: false, error: 'missing_action' });

    const normalized = ACTIONS[raw] ? raw : raw.replace('/', '.');
    const rel = ACTIONS[normalized];
    if (!rel) return res.status(404).json({ ok: false, error: 'unknown_action', action: raw });

    // resolve path from current module URL
    const modUrl = new URL(rel, import.meta.url).href;
    const mod = await import(modUrl).catch(e => {
      throw new Error(`import_failed for "${normalized}" -> ${modUrl}: ${e.message}`);
    });

    const fn = mod?.default || mod?.handler;
    if (typeof fn !== 'function') throw new Error(`handler_missing: ${normalized}`);

    return fn(req, res);
  } catch (err) {
    return res.status(200).json({ ok: false, error: 'router_failed', details: String(err.stack || err.message || err) });
  }
}
