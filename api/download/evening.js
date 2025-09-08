// TEMP DEBUG: Evening Download -> dump env + ping Upstash KV
export default async function handler(req, res) {
  const env = {
    KV_URL: process.env.KV_URL ?? null,
    KV_REST_API_URL: process.env.KV_REST_API_URL ?? null,
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "set" : null,
    REDIS_URL: process.env.REDIS_URL ?? null,
  };

  let ping = { tried: false };
  try {
    const base = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (base && token) {
      ping.tried = true;
      const resp = await fetch(`${base}/get/__healthcheck__`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      ping.status = resp.status;
      ping.ok = resp.ok;
      ping.sampleText = await resp.text();
    }
  } catch (e) {
    ping.error = e.message;
  }

  return res.status(200).json({
    ok: true,
    where: "evening-debug",
    env,
    ping
  });
}
