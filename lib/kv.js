// lib/kv.js
const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function r(method, path, body) {
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
  return res.json();
}

// JSON helpers
export async function kvSetJSON(key, value) {
  return r("POST", `/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}`, null);
}

export async function kvGetJSON(key) {
  const data = await r("GET", `/get/${encodeURIComponent(key)}`, null);
  if (!data || data.result == null) return null;
  try { return JSON.parse(data.result); } catch { return data.result; }
}

// List helpers (stored as JSON array under a single key)
export async function kvGetArray(key) {
  return (await kvGetJSON(key)) || [];
}

export async function kvSetArray(key, arr) {
  return kvSetJSON(key, arr || []);
}

export async function kvDel(key) {
  return r("POST", `/del/${encodeURIComponent(key)}`, null);
}
