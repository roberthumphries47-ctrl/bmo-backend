import { getAccessToken } from "../lib/google.js";

export default async function handler(req, res) {
  try {
    const token = await getAccessToken();
    const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!resp.ok) {
      throw new Error(`Gmail API error: ${resp.status}`);
    }

    const data = await resp.json();
    return res.status(200).json({ ok: true, count: data.labels?.length, labels: data.labels });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "gmail_labels_failed", details: err.message });
  }
}
