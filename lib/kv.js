const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function r(method, path, body) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` }
    , body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV error ${res.status}: ${text}`);
  }
  return res.json();
}

// Basic helpers using Upstash Redis REST endpoints
export async function kvSetJSON(key, value) {
  return r("POST", `/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`);
}

export async function kvGetJSON(key) {
  const data = await r("GET", `/get/${encodeURIComponent(key)}`);
  if (!data || data.result == null) return null;
  try { return JSON.parse(data.result); } catch { return data.result; }
}

export async function kvLPush(key, value) {
  return r("POST", `/lpush/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`);
}

export async function kvLRange(key, start = 0, stop = -1) {
  const data = await r("GET", `/lrange/${encodeURIComponent(key)}/${start}/${stop}`);
  return (data.result || []).map((x) => {
    try { return JSON.parse(x); } catch { return x; }
  });
}

export async function kvDel(key) {
  return r("POST", `/del/${encodeURIComponent(key)}`);
}
