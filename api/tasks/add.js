// api/tasks/add.js
import { kvGetArray, kvSetArray } from "../../lib/kv.js";
import { ensureDay } from "../../lib/utils.js";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

async function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "Use POST (or GET for quick test)" });
    }

    const today = ensureDay(req); // "YYYY-MM-DD"
    const key = `tasks_array:${today}`;

    // accept POST JSON or GET query params for quick testing
    const payload = req.method === "POST"
      ? await readJson(req)
      : { title: req.query.title, bucket: req.query.bucket, when: req.query.when };

    const title = (payload.title || "").trim();
    const bucket = (payload.bucket || "Personal").trim();
    const when = (payload.when || "").trim();
    const notes = (payload.notes || "").trim();

    if (!title) {
      return res.status(200).json({ ok: false, error: "missing_title" });
    }

    const items = (await kvGetArray(key)) || [];
    const task = {
      id: uid(),
      title,
      bucket,
      when: when || undefined,
      notes: notes || undefined,
      done: false,
      createdAt: Date.now(),
    };

    await kvSetArray(key, [task, ...items]);

    return res.status(200).json({ ok: true, day: today, added: task, count: items.length + 1 });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "add_failed", details: err?.message || String(err) });
  }
}
