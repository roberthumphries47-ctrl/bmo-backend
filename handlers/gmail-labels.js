// api/gmail/labels.js
import { getAccessToken } from "../../lib/google.js";

export default async function handler(req, res) {
  try {
    // 1) Get Access Token
    const tok = await getAccessToken();
    if (!tok.ok) {
      return res.status(200).json({ ok: false, stage: "getAccessToken", ...tok });
    }

    // 2) Call Gmail Labels
    const gRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });

    if (!gRes.ok) {
      const text = await gRes.text().catch(() => "");
      return res.status(200).json({
        ok: false,
        stage: "gmail_labels_fetch",
        status: gRes.status,
        details: text,
      });
    }

    const data = await gRes.json();
    return res.status(200).json({
      ok: true,
      count: Array.isArray(data.labels) ? data.labels.length : 0,
      labels: data.labels || [],
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "handler_exception",
      details: err?.message || String(err),
    });
  }
}
