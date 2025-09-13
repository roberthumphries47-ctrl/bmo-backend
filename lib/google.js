// lib/google.js
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Exchanges a Refresh Token for an Access Token.
 * Requires env:
 *  - GOOGLE_WEB_CLIENT_ID
 *  - GOOGLE_WEB_CLIENT_SECRET
 *  - GOOGLE_REFRESH_TOKEN
 */
export async function getAccessToken() {
  const {
    GOOGLE_WEB_CLIENT_ID,
    GOOGLE_WEB_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
  } = process.env;

  const missing = [];
  if (!GOOGLE_WEB_CLIENT_ID) missing.push("GOOGLE_WEB_CLIENT_ID");
  if (!GOOGLE_WEB_CLIENT_SECRET) missing.push("GOOGLE_WEB_CLIENT_SECRET");
  if (!GOOGLE_REFRESH_TOKEN) missing.push("GOOGLE_REFRESH_TOKEN");
  if (missing.length) {
    return { ok: false, error: "missing_env", details: missing.join(", ") };
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID,
    client_secret: GOOGLE_WEB_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: "token_exchange_failed",
      status: res.status,
      details: text,
    };
  }

  const json = await res.json();
  return { ok: true, access_token: json.access_token, expires_in: json.expires_in };
}
