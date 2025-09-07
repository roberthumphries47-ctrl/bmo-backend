// Simple bearer token auth (for dev/admin-only endpoints)
export function requireAdmin(req, res) {
  const token = process.env.ADMIN_TOKEN || "";
  const hdr = req.headers["x-admin-token"] || req.headers["authorization"] || "";
  const incoming = String(hdr).startsWith("Bearer ") ? String(hdr).slice(7) : String(hdr);
  if (!token || incoming !== token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return true;
}
