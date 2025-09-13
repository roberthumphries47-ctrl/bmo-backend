// lib/kv.js
// Accept envs from either our KV_* names or Upstash defaults
const BASE =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_URL || // if you ever stored full REST URL here
  "";

const TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.KV_REST_API_READ_ONLY_TOKEN || // last-resort read
  "";

function assertEnv() {
  if (!BASE || !/^https?:\/\//.test(BASE)) {
    throw new Error(
      `KV BASE missing/invalid. Got "${BASE || "(empty)"}". ` +
      `Set KV_REST_API_URL or UPSTASH_REDIS_REST_URL.`
    );
  }
  if (!TOKEN) {
    throw new Error(
      `KV TOKEN missing. Set KV_REST_API_TOKEN or UPSTASH_REDIS_REST_TOKEN.`
    );
  }
}

async function r(method, path, body) {
  assertEnv();
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`kv error ${res.status}: ${text}`);
  }
  return res.json();
}

// Convenience helpers for array storage like before
export async function kvGetArray(key) {
  const data = await r("GET", `/get/${encodeURIComponent(key)}`);
  return Array.isArray(data?.result) ? data.result : (data?.result ?? []);
}

export async function kvSetArray(key, arr) {
  return r(
    "POST",
    "/set",
    JSON.stringify({
      key,
      value: arr,
      // upstash REST expects JSON value by default; TTL optional:
      // ex: "ex": 60
    })
  );
}

export default { r, kvGetArray, kvSetArray };
