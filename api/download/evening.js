// api/download/evening.js
const BASE = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(cmdPath) {
  if (!BASE || !TOKEN) throw new Error("Missing KV_REST_API_URL or KV_REST_API_TOKEN");
  const url = `${BASE}${cmdPath}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.result ?? text;
  } catch {
    return text;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

    // --- Redis health tests ---
    const ping = await redis("/PING");                 // expect "PONG"
    const stamp = String(Date.now());
    await redis(`/SET/health:evening:${stamp}/${stamp}`);
    const echo = await redis(`/GET/health:evening:${stamp}`);

    const env_present = Boolean(BASE && TOKEN);
    const redis_ok = ping === "PONG" && echo === stamp;

    const lines = [];
    lines.push("📥 Evening Download");
    lines.push("");
    lines.push(`Redis PING: ${ping}`);
    lines.push(`Write/Read OK: ${redis_ok ? "yes" : "no"}`);

    return res.status(200).json({
      ok: redis_ok,
      env_present,
      redis_ok,
      ping,
      echo,
      message: lines.join("\n"),
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "Evening Download failed",
      details: err?.message || String(err),
    });
  }
}
