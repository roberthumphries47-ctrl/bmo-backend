export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "pong",
    env_present: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  });
}
