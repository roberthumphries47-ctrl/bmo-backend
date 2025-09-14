// api/ping.js
export default async function handler(req, res) {
  try {
    return res.status(200).json({
      ok: true,
      message: "pong",
      env_present: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    });
  } catch (err) {
    return res.status(200).json({ ok: false, error: "ping_failed", details: String(err) });
  }
}
