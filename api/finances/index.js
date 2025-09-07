// api/finances/index.js
import { kvGetArray, kvSetArray } from "../../../lib/kv.js";

export default async function handler(req, res) {
  // Keys:
  //  bills:  [{ name, amount, dueISO }]
  //  subs:   [{ name, plan, price, renewISO, priceChange?:{from,to} }]
  if (req.method === "GET") {
    const bills = await kvGetArray("bills:");
    const subs  = await kvGetArray("subs:");
    return res.status(200).json({ bills, subscriptions: subs });
  }

  if (req.method === "POST") {
    let body = {};
    try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body; } catch {}
    if (Array.isArray(body.bills)) await kvSetArray("bills:", body.bills);
    if (Array.isArray(body.subscriptions)) await kvSetArray("subs:", body.subscriptions);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Use GET or POST" });
}
