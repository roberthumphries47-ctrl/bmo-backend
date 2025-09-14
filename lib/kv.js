// lib/kv.js

// Prefer Vercel KV vars; fall back to raw Upstash if present.
const BASE =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_URL ||
  "";

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_READ_ONLY_TOKEN ||
  "";

// ---- internals ----
function assertEnv() {
  if (!BASE || !/^https?:\/\//.test(BASE)) throw new Error("KV BASE missing/invalid");
  if (!TOKEN) throw new Error("KV TOKEN missing");
}

async function req(method, path, body) {
  assertEnv();
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined
      ? undefined
      : (typeof body === "string" ? body : JSON.stringify(body)),
    cache: "no-store",
  });

  // Upstash returns JSON like: { result: "OK" } or { result: "<stored-value>" }
  const text = await res.text().catch(() => "");
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok) {
    throw new Error(`kv ${res.status}: ${json?.error || json?.message || text || "unknown error"}`);
  }
  return json; // usually { result: ... }
}

// ---- primitives ----
export async function kvSet(key, value, ttlSeconds) {
  // TTL is optional; Upstash supports ?EX=<seconds>
  const q = ttlSeconds ? `?EX=${encodeURIComponent(ttlSeconds)}` : "";
  const out = await req("POST", `/set/${encodeURIComponent(key)}${q}`, value);
  return out?.result ?? out;
}

export async function kvGet(key) {
  const out = await req("GET", `/get/${encodeURIComponent(key)}`);
  const raw = out?.result;
  if (raw === null || raw === undefined) return null;
  // Try to parse JSON values; fall back to raw string
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

export async function kvDel(key) {
  const out = await req("POST", `/del/${encodeURIComponent(key)}`);
  return out?.result ?? out; // typically an integer delete count
}

// ---- array helpers (compat with your existing handlers) ----
export async function kvGetArray(key) {
  const val = await kvGet(key);
  if (val == null) return [];
  return Array.isArray(val) ? val : [];
}

export async function kvSetArray(key, arr, ttlSeconds) {
  if (!Array.isArray(arr)) throw new Error("kvSetArray expects an array");
  return kvSet(key, arr, ttlSeconds);
}

// Optional default export for convenience
export default { kvGet, kvSet, kvDel, kvGetArray, kvSetArray };
