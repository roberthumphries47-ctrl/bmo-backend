// api/tasks/index.js
import { kvSetJSON, kvGetJSON, kvLRange } from '../../lib/kv.js';

const todayKey = () => `tasks:${new Date().toISOString().slice(0,10)}`;

// normalize storage: keep an array per day under tasks:<YYYY-MM-DD>
async function readDay(key) {
  const arr = await kvGetJSON(key);
  if (Array.isArray(arr)) return arr;
  // if we previously wrote a list via kvLRange, fold it into array
  const list = await kvLRange(key, 0, -1);
  if (Array.isArray(list) && list.length) {
    const parsed = list.map(x => (typeof x === 'string' ? JSON.parse(x) : x));
    await kvSetJSON(key, parsed);
    return parsed;
  }
  return [];
}

export default async function handler(req, res) {
  const key = todayKey();

  // GET => list today's tasks
  if (req.method === 'GET') {
    const items = await readDay(key);

    // group by bucket for convenience
    const grouped = {};
    for (const t of items) {
      const b = t.bucket || 'general';
      grouped[b] ??= { completed: [], incomplete: [] };
      (t.done ? grouped[b].completed : grouped[b].incomplete).push(t);
    }

    return res.status(200).json({
      day: key.slice('tasks:'.length),
      grouped,
    });
  }

  // POST => add or complete
  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const action = body.action || 'add';

    if (action === 'add') {
      const id = Date.now().toString();
      const task = {
        id,
        title: body.title || 'Untitled',
        bucket: body.bucket || 'general',
        dueISO: body.dueISO ?? null,
        done: false,
      };
      const items = await readDay(key);
      items.push(task);
      await kvSetJSON(key, items);
      return res.status(200).json({ ok: true, task });
    }

    if (action === 'complete') {
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const items = await readDay(key);
      const updated = items.map(t => (t.id === id ? { ...t, done: true } : t));
      await kvSetJSON(key, updated);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Use GET or POST' });
}
