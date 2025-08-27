export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_WEB_CLIENT_ID,
    client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET,
    redirect_uri: process.env.OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
    access_type: 'offline',
    prompt: 'consent'
  });

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await r.json();
  if (!r.ok) return res.status(500).json({ error: 'token_exchange_failed', details: data });

  res.status(200).json({
    ok: true,
    received: Object.keys(data),
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_in: data.expires_in
  });
}
