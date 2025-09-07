// api/download/evening.js
import { kvGetArray, kvSetArray } from '../../lib/kv.js';
import { ensureDay, tomorrowISO } from '../../lib/utils.js';
import { groupByBucket, labels } from '../../lib/buckets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const today = ensureDay(req);
    const tomorrow = tomorrowISO(new Date(`${today}T00:00:00Z`)).slice(0,10);

    const todayKey = `tasks_array:${today}`;
    const tomorrowKey = `tasks_array:${tomorrow}`;

    const items = (await kvGetArray(todayKey)) || [];

    // group for structured payload
    const grouped = groupByBucket(items);

    // roll over any incomplete
    const incomplete = items.filter(t => !t?.done);
    if (incomplete.length) {
      const tm = (await kvGetArray(tomorrowKey)) || [];
      const rolled = incomplete.map(t => ({ ...t, done: false }));
      await kvSetArray(tomorrowKey, [...tm, ...rolled]);
    }

    const closed = items.filter(t => !!t?.done);

    // Human message
    const lines = [];
    lines.push(`[ AFTER-ACTION LOG // ${today} ]`);
    lines.push('');
    lines.push('Closed:');
    lines.push(closed.length
      ? closed.map(t => `• ${t.title} (${labels[t.bucket] || t.bucket || 'general'})`).join('\n')
      : '• None');
    lines.push('');
    lines.push('Loose Ends (auto-queued for tomorrow):');
    lines.push(incomplete.length
      ? incomplete.map(t => `• ${t.title}  → roll over`).join('\n')
      : '• None');
    lines.push('');
    lines.push('Re-slot or scrap anything? Tell me the gig title and what to do.');

    const message = lines.join('\n');

    return res.status(200).json({
      today,
      tomorrow,
      grouped,
      rolledCount: incomplete.length,
      message,
    });
  } catch (err) {
    console.error('Evening Download failed:', err);
    return res.status(500).json({ error: 'Evening Download failed', details: err?.message });
  }
}
