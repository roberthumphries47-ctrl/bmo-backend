// api/router.js
// Dynamic router that imports handlers at runtime so errors are caught and returned as JSON.

const ACTIONS = {
  'ping':              '../handlers/ping.js',
  'upload.morning':    '../handlers/upload-morning.js',
  'download.evening':  '../handlers/download-evening.js',
  'debug.kv':          '../handlers/debug-kv.js',
  'debug.kv-probe':    '../handlers/debug-kv-probe.js',
  'tasks.add':         '../handlers/tasks-add.js',
  'tasks.list':        '../handlers/tasks-list.js',
  'gmail.labels':      '../handlers/gmail-labels.js',
  'calendar.events':   '../handlers/calendar-events.js',
};

export default async function handler(req, res) {
  try {
    // Parse query (?action=foo or ?action=foo/bar)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const raw = url.searchParams.get('action');
    if (!raw) {
      return res.status(400).json({ ok: false, error: 'missing_action' });
    }

    // allow slash or dot
    const normalized = ACTIONS[raw] ? raw : raw.replace('/', '.');
    const importPath = ACTIONS[normalized];
    if (!importPath) {
      return res.status(404).json({ ok: false, error: 'unknown_action', action: raw });
    }

    // Dynamic import so module errors are caught here
    const mod = await import(importPath).catch((e) => {
      throw new Error(`import_failed for "${normalized}" -> ${importPath}: ${e.message}`);
    });

    const fn = mod?.default || mod?.handler;
    if (typeof fn !== 'function') {
      throw new Error(`handler_missing: ${normalized} did not export a function`);
    }

    // Delegate – each handler should send its own JSON
    return fn(req, res);
  } catch (err) {
    // Always reply JSON on failure
    const details = (err && (err.stack || err.message || String(err))).toString();
    return res.status(200).json({ ok: false, error: 'router_failed', details });
  }
}
