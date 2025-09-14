// lib/kv.js
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
    throw new Error("KV BASE missing/invalid");
  }
  if (!TOKEN) throw new Error("KV TOKEN missing");
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
  const out = await r("GET", `/get/${encodeURIComponent(key)}`);
  const raw = out?.result;
  if (raw == null) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function kvSetArray(key, arr) {
  return r("POST", `/set/${encodeURIComponent(key)}`, JSON.stringify(arr));
}

export default { kvGetArray, kvSetArray };
