import { requireAdmin } from "../../lib/auth.js";
export default async function handler(req, res) {
  if (requireAdmin(req, res) !== true) return; // responded 401
  return res.status(200).json({ ok: true });
}
