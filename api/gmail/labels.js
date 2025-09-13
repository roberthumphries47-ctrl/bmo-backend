import { google } from "googleapis";

export default async function handler(req, res) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_SECRET,
      process.env.REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const response = await gmail.users.labels.list({ userId: "me" });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Gmail Labels Error:", error);
    res.status(500).json({ error: error.message });
  }
}
