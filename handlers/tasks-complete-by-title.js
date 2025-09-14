// handlers/tasks-complete-by-title.js
import { kvGetArray, kvSetArray } from "../lib/kv.js";

// YYYY-MM-DD in UTC
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function ensureDay(req) {
  const q = req.query || {};
  const day = typeof q.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.day) ? q.day : todayISO();
  return day;
}

export async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "use_post" });
    }

    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const titleRaw = (body.title || "").trim();
    const markDone = body.done !== false; // default true
    const day = ensureDay(req);

    if (!titleRaw) {
      return res.status(400).json({ ok: false, error: "missing_title" });
    }

    const key = `tasks_array:${day}`;
    const items = (await kvGetArray(key)) || [];

    // Case-insensitive substring match
    const needle = titleRaw.toLowerCase();
    const candidates = items.filter(t =>
      !t?.done &&
      typeof t?.title === "string" &&
      t.title.toLowerCase().includes(needle)
    );

    if (candidates.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "no_match",
        day,
        sought: titleRaw,
        suggestions: items
          .filter(t => typeof t?.title === "string")
          .slice(0, 10)
          .map(t => t.title),
      });
    }

    if (candidates.length > 1) {
      return res.status(409).json({
        ok: false,
        error: "ambiguous",
        day,
        sought: titleRaw,
        matches: candidates.map(t => ({ id: t.id, title: t.title })),
        hint: "Refine the title or pass ?day=YYYY-MM-DD",
      });
    }

    const match = candidates[0];
    const updated = items.map(t =>
      t.id === match.id ? { ...t, done: !!markDone } : t
    );
    await kvSetArray(key, updated);

    return res.status(200).json({
      ok: true,
      day,
      id: match.id,
      title: match.title,
      done: !!markDone,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "complete_by_title_failed", details: err?.message || String(err) });
  }
}
