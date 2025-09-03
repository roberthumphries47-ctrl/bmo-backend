// lib/kv.js
// Thin helpers around the Upstash Redis REST API

const BASE  = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function r(method, path, body) {
  if (!BASE || !TOKEN) {
    throw new Error("KV env vars missing: KV_REST_API_URL / KV_REST_API_TOKEN");
  }

  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
    body
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`KV error ${res.status}: ${text}`);
  }
  return res.json(); // Upstash returns { result: ... }
}

/* -----------------------------
 * JSON convenience helpers
 * ----------------------------- */

/** Set a JSON value under key (stored as string on the Redis side). */
export async function kvSetJSON(key, value) {
  return r(
    "POST",
    `/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`
  );
}

/** Get a JSON value previously written with kvSetJSON (or null if missing). */
export async function kvGetJSON(key) {
  const data = await r("GET", `/get/${encodeURIComponent(key)}`);
  if (!data || data.result == null) return null;
  try {
    return JSON.parse(data.result);
  } catch {
    // If someone wrote a raw string to this key, just return that string
    return data.result;
  }
}

/* -----------------------------
 * List helpers (legacy support)
 * ----------------------------- */

/** LPUSH a value (string or object) to a Redis List. Objects are stringified. */
export async function kvLPush(key, value) {
  const payload =
    typeof value === "string" ? value : JSON.stringify(value);
  return r(
    "POST",
    `/lpush/${encodeURIComponent(key)}/${encodeURIComponent(payload)}`
  );
}

/** LRANGE for a List; attempts to JSON.parse each item, returns raw on failure. */
export async function kvLRange(key, start = 0, stop = -1) {
  const data = await r(
    "GET",
    `/lrange/${encodeURIComponent(key)}/${start}/${stop}`
  );
  return (data.result || []).map((x) => {
    try { return JSON.parse(x); } catch { return x; }
  });
}

/** DEL a key. */
export async function kvDel(key) {
  return r("POST", `/del/${encodeURIComponent(key)}`);
}

/* -----------------------------
 * (Optional) raw string helpers
 * Uncomment if you ever need them.
 * -----------------------------
export async function kvSetString(key, value) {
  return r("POST", `/set/${encodeURIComponent(key)}/${encodeURIComponent(String(value))}`);
}

export async function kvGetString(key) {
  const data = await r("GET", `/get/${encodeURIComponent(key)}`);
  return data?.result ?? null;
}
*/
