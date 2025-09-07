// api/oauth/index.js
export default async function handler(req, res) {
  // Placeholder so we keep a stable route for future Google integrations.
  // For now, this just returns 200.
  return res.status(200).json({ ok: true, note: "OAuth wiring TBD in V1" });
}
