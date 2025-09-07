// api/upload/morning.js
import { kvGetArray } from '../../lib/kv.js';
import { ensureDay, withinDays } from '../../lib/utils.js';
import { labels } from '../../lib/buckets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Use GET' });
  }

  try {
    const day = ensureDay(req);

    // Safe reads: fall back to [] if key is missing or null
    const tasks = (await kvGetArray(`tasks_array:${day}`)) || [];
    const appts = (await kvGetArray(`calendar:${day}`)) || [];
    const bills = (await kvGetArray(`bills:${day}`)) || [];
    const subs  = (await kvGetArray('subs')) || [];

    const incomplete = tasks.filter(t => !t?.done);
    const dueSoonBills = bills
      .filter(b => withinDays(b?.dueISO, 14))
      .sort((a, b) => (a?.dueISO || '').localeCompare(b?.dueISO || ''));

    const subsNext30 = subs
      .filter(s => withinDays(s?.renewISO, 30))
      .sort((a, b) => (a?.renewISO || '').localeCompare(b?.renewISO || ''));

    // Human message
    const lines = [];
    lines.push(`Morning Upload — ${day}`);
    lines.push('');
    lines.push('Appointments (today)');
    lines.push(appts.length ? appts.map(a =>
      `• ${a.title} — ${a.startISO?.slice(11,16)}${a.location ? ` @ ${a.location}` : ''}`
    ).join('\n') : '• None');
    lines.push('');
    lines.push('Tasks (incomplete)');
    lines.push(incomplete.length
      ? incomplete.map(t => `• ${t.title}  (${labels[t.bucket] || t.bucket || 'general'})`).join('\n')
      : '• None');
    lines.push('');
    lines.push('Bills (upcoming)');
    lines.push(dueSoonBills.length
      ? dueSoonBills.map(b => `• ${b.title} — $${b.amount?.toFixed ? b.amount.toFixed(2) : b.amount} — due ${b.dueISO?.slice(0,10)} ⚠️`).join('\n')
      : '• None detected');
    lines.push('');
    lines.push('Finances • Subscriptions (next 30 days)');
    lines.push(subsNext30.length
      ? subsNext30.map(s => {
          const pc = s.priceChange ? ` (was $${s.priceChange.from} → $${s.priceChange.to})` : '';
          const soon = withinDays(s.renewISO, 14) ? ' ⚠️' : '';
          return `• ${s.name} — $${s.price} — renews ${s.renewISO?.slice(0,10)}${pc}${soon}`;
        }).join('\n')
      : '• None in the next 30 days');
    lines.push('');
    lines.push('Add any new tasks for today?');

    const message = lines.join('\n');

    return res.status(200).json({
      day,
      appointments: appts,
      tasksIncomplete: incomplete,
      billsDueSoon: dueSoonBills,
      subsNext30,
      message,
    });
  } catch (err) {
    console.error('Morning Upload failed:', err);
    return res.status(500).json({ error: 'Morning Upload failed', details: err?.message });
  }
}
