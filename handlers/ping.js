export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "pong",
    env_present: !!process.env.KV_REST_API_URL
  });
}
