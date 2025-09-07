import { kvGetJSON, kvSetJSON } from "../../lib/kv.js";
import { clampDay } from "../../lib/utils.js";

export default async function handler(req, res) {
  const key = "finances:subs_and_bills";
  if (req.method === "GET") {
    const data = (await kvGetJSON(key)) || { bills: [], subscriptions: [] };
    return res.status(200).json(data);
  }
  if (req.method === "POST") {
    const { kind, item } = req.body || {}; // kind: "bill" | "subscription"
    const data = (await kvGetJSON(key)) || { bills: [], subscriptions: [] };
    if (kind === "bill") data.bills.push(item);
    else if (kind === "subscription") data.subscriptions.push(item);
    await kvSetJSON(key, data);
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: "Use GET or POST" });
}
