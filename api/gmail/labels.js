// api/gmail/labels.js
export default async function handler(req, res) {
  try {
    return res.status(200).json({
      ok: true,
      route: "/api/gmail/labels",
      now: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "handler-failed",
      details: err?.message || String(err),
    });
  }
}
