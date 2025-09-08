// TEMP DEBUG: Morning Upload -> dump env + ping Upstash KV
export default async function handler(req, res) {
  const env = {
    KV_URL: process.env.KV_URL ?? null,                        // old name (just in case)
    KV_REST_API_URL: process.env.KV_REST_API_URL ?? null,      // ✅ expected
    KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN ? "set" : null, // don't echo tokens
    REDIS_URL: process.env.REDIS_URL ?? null,                  // sometimes present
  };

  // Try a safe ping to Upstash REST if URL+TOKEN exist
  let ping = { tried: false };
  try {
    const base = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (base && token) {
      ping.tried = true;
      // GET a non-existent key is harmless; we only want status reachability
      const resp = await fetch(`${base}/get/__healthcheck__`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      ping.status = resp.status;
      ping.ok = resp.ok;
      ping.sampleText = await resp.text(); // often: {"result":null}
    }
  } catch (e) {
    ping.error = e.message;
  }

  return res.status(200).json({
    ok: true,
    where: "morning-debug",
    env,
    ping
  });
}
