// api/download/evening.js
import { kvGetArray, kvSetArray } from '../../lib/kv.js';
import { ensureDay, tomorrowISO, groupByBucket } from '../../lib/utils.js';
import { labels, terms } from '../../lib/buckets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

    const today = ensureDay(req);
    const tomorrow = tomorrowISO(new Date(`${today}T00:00:00Z`)).slice(0,10);

    const todayKey = `tasks_array:${today}`;
    const tomorrowKey = `tasks_array:${tomorrow}`;

    const items = (await kvGetArray(todayKey)) || [];

    // Roll over any incomplete tasks into tomorrow (non-destructive: we append)
    const incomplete = items.filter(t => !t.done);
    let rolledCount = 0;
    if (incomplete.length) {
      const tomorrowItems = (await kvGetArray(tomorrowKey)) || [];
      const rolled = incomplete.map(t => ({ ...t, done: false })); // ensure still undone
      await kvSetArray(tomorrowKey, [...tomorrowItems, ...rolled]);
      rolledCount = rolled.length;
    }

    // Group (for the structured payload)
    const grouped = groupByBucket(items);

    // Human message
    const closed = items.filter(t => t.done);
    const lines = [];
    lines.push(`${terms.evening} // ${today}`);
    lines.push('');
    lines.push('Closed:');
    lines.push(closed.length ? closed.map(t => `• ${t.title} [${labels[t.bucket]||t.bucket||'general'}]`).join('\n') : '• None');
    lines.push('');
    lines.push('Loose Ends (auto-queued for tomorrow):');
    lines.push(incomplete.length ? incomplete.map(t => `• ${t.title} → roll over`).join('\n') : '• None');
    lines.push('');
    lines.push('Re-slot or scrap anything? Tell me the gig title and what to do.');

    const message = lines.join('\n');

    return res.status(200).json({
      today,
      tomorrow,
      grouped,
      rolledCount,
      message,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Evening Download failed', details: String(err?.message || err) });
  }
}
