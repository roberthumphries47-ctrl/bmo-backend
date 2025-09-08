// api/upload/morning.js
import { kvGetArray } from '../../lib/kv.js';
import { ensureDay, withinDays, localeCompare } from '../../lib/utils.js';
import { labels, terms } from '../../lib/buckets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET' });

    const day = ensureDay(req);

    // Read data safely (empty arrays if missing)
    const tasks = (await kvGetArray(`tasks_array:${day}`)) || [];
    const appts = (await kvGetArray(`calendar:${day}`)) || [];
    const bills = (await kvGetArray('bills')) || [];
    const subs = (await kvGetArray('subs')) || [];

    // Derive sections
    const incomplete = tasks.filter(t => !t.done);

    const billsDueSoon = bills
      .filter(b => withinDays(b.dueISO, 30))
      .sort((a, b) => localeCompare(a.dueISO, b.dueISO));

    const subsNext30 = subs
      .filter(s => withinDays(s.renewISO, 30))
      .sort((a, b) => localeCompare(a.renewISO, b.renewISO))
      .map(s => ({
        ...s,
        priceChange:
          typeof s.priceChange === 'number' ? s.priceChange : undefined,
      }));

    // Human message
    const lines = [];
    lines.push(`${terms.morning} – ${day}`);
    lines.push('');

    lines.push(`${labels.appointments} (today)`);
    lines.push(
      appts.length
        ? appts.map(a =>
            `• ${a.title} — ${a.startISO?.slice(11,16)}${a.location ? ` @ ${a.location}` : ''}`
          ).join('\n')
        : '• None'
    );
    lines.push('');

    lines.push(`${labels.tasks} (incomplete)`);
    lines.push(
      incomplete.length
        ? incomplete.map(t => `• ${t.title} ${t.bucket ? `(${labels[t.bucket]||t.bucket})` : ''}`).join('\n')
        : '• None'
    );
    lines.push('');

    lines.push(`${labels.bills} (upcoming)`);
    lines.push(
      billsDueSoon.length
        ? billsDueSoon.map(b =>
            `• ${b.title} — $${b.amount?.toFixed?.(2) ?? b.amount} — due ${b.dueISO.slice(0,10)}${withinDays(b.dueISO,14) ? ' ⚠️' : ''}`
          ).join('\n')
        : '• None detected'
    );
    lines.push('');

    lines.push(`${labels.finances} → ${labels.subscriptions} (next 30 days)`);
    lines.push(
      subsNext30.length
        ? subsNext30.map(s =>
            `• ${s.name} — ${s.plan || ''} $${s.price} — renews ${s.renewISO.slice(0,10)}${s.priceChange ? ` (was $${s.price - s.priceChange}, +$${s.priceChange})` : ''}`
          ).join('\n')
        : '• None in the next 30 days'
    );
    lines.push('');
    lines.push('Add any new tasks for today?');

    const message = lines.join('\n');

    return res.status(200).json({
      day,
      appointments: appts,
      tasksIncomplete: incomplete,
      billsDueSoon,
      subsNext30,
      message,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Morning Upload failed', details: String(err?.message || err) });
  }
}
