export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send('<h2>BMO OAuth Callback</h2><p>Callback received. You can close this tab.</p>');
}
