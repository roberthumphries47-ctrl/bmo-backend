// lib/utils.js
export const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const tomorrowISO = (d = new Date()) => {
  const t = new Date(d);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

export const ensureDay = (req) => {
  const url = new URL(req.url);
  const qDay = url.searchParams.get("day");
  return qDay || isoDay();
};

export const uid = () => Date.now().toString();

// Group by bucket with sane default
export function groupByBucket(tasks = []) {
  const grouped = {};
  for (const t of tasks) {
    const bucket = (t.bucket || "general").toLowerCase();
    if (!grouped[bucket]) grouped[bucket] = { completed: [], incomplete: [] };
    (t.done ? grouped[bucket].completed : grouped[bucket].incomplete).push(t);
  }
  return grouped;
}

// Simple text highlighter for “due soon”
export const withinDays = (iso, days) => {
  try {
    const due = new Date(iso).getTime();
    const now = Date.now();
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    return diff <= days;
  } catch { return false; }
};
