// api/router.js
// Central JSON router + a few tiny inline actions.
// NOTE: vercel.json must include { "functions": { "api/**": { "includeFiles": ["handlers/**","lib/**"] } } }

import { kvGetArray, kvSetArray } from "../lib/kv.js";

// ----- tiny helpers -----
function json(res, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).end(JSON.stringify(obj));
}

function todayISO() {
  // YYYY-MM-DD in UTC (stable for our keys)
  return new Date().toISOString().slice(0, 10);
}

function getQuery(req) {
  const url = new URL(req.url, "http://localhost");
  return Object.fromEntries(url.searchParams.entries());
}

async function readJSON(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Map action -> dynamic import function
const table = {
  "ping":            () => import("../handlers/ping.js"),
  "gmail.labels":    () => import("../handlers/gmail-labels.js"),
  "calendar.events": () => import("../handlers/calendar-events.js"),

  "tasks.add":       () => import("../handlers/tasks-add.js"),
  "tasks.list":      () => import("../handlers/tasks-list.js"),
  "tasks.complete":  () => import("../handlers/tasks-complete.js"),
  "tasks.completeByTitle": () => import("../handlers/tasks-complete-by-title.js"),

  "upload.morning":  () => import("../handlers/upload-morning.js"),
  "download.evening":() => import("../handlers/download-evening.js"),

  "debug.kv":        () => import("../handlers/debug-kv.js"),
  "debug.kv-probe":  () => import("../handlers/debug-kv-probe.js"),
};

// Inline implementation for tasks.clear (wipe the day’s array)
async function handleTasksClear(req, res, query) {
  try {
    const day = query.day || todayISO();
    const key = `tasks_array:${day}`;
    const before = await kvGetArray(key);
    await kvSetArray(key, []);
    return json(res, { ok: true, day, clearedCount: before.length });
  } catch (err) {
    return json(res, { ok: false, error: "tasks_clear_failed", details: String(err?.message || err) });
  }
}

export default async function handler(req, res) {
  try {
    const query = getQuery(req);
    const action = query.action;

    if (!action) {
      return json(res, { ok: false, error: "missing_action" });
    }

    // Special inline route: tasks.clear
    if (action === "tasks.clear") {
      return handleTasksClear(req, res, query);
    }

    // Dynamic routes
    const loader = table[action];
    if (!loader) {
      return json(res, { ok: false, error: "unknown_action", action });
    }

    let mod;
    try {
      mod = await loader();
    } catch (e) {
      return json(res, { ok: false, error: "import_failed", details: String(e?.message || e) });
    }

    const fn = mod?.handler || mod?.default;
    if (typeof fn !== "function") {
      return json(res, { ok: false, error: "no_handler_export", details: `No exported 'handler' in loader for ${action}` });
    }

    // Some handlers expect req.body (JSON). We’ll populate it for POST/PUT/PATCH.
    if (["POST", "PUT", "PATCH"].includes(req.method || "")) {
      req.body = await readJSON(req);
    }

    // Delegate to the real handler
    return await fn(req, res);
  } catch (err) {
    return json(res, { ok: false, error: "router_failed", details: String(err?.message || err) });
  }
}
