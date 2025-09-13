// lib/kv.js
// Accept either KV_* or UPSTASH_* env names.
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

function assertEnv() {
  if (!BASE || !/^https?:\/\//.test(BASE)) {
    throw new Error(`KV BASE missing/invalid. Set KV_REST_API_URL or UPSTASH_REDIS_REST_URL.`);
  }
  if (!TOKEN) throw new Error(`KV TOKEN missing. Set KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN.`);
}

async function r(method, path, body) {
  assertEnv();
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kv error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function kvGetArray(key) {
  const data = await r("GET", `/get/${encodeURIComponent(key)}`);
  // Upstash GET returns { result: "<string or null>" }
  const raw = data?.result;
  if (raw == null) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function kvSetArray(key, arr) {
  // Upstash SET expects /set/<key> and body is the JSON value itself
  return r("POST", `/set/${encodeURIComponent(key)}`, JSON.stringify(arr));
}

export default { kvGetArray, kvSetArray };
