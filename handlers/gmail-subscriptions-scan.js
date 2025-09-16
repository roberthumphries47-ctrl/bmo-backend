// handlers/gmail-subscriptions-scan.js
import { getAccessToken } from "../lib/google.js";
import { kvGet, kvSet } from "../lib/kv.js";

// quick date helpers
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toISODate(d) { return new Date(d).toISOString().slice(0,10); }
function inNextNDays(dt, n) {
  const d = new Date(dt);
  const now = new Date();
  const lim = addDays(now, n);
  return d >= now && d <= lim;
}

// naive parsers
const AMOUNT_RE = /\$ ?(\d+(?:\.\d{2})?)/i;
// e.g., Sep 30, 2025 | September 30 | 2025-09-30 | 09/30/2025 | 9/30
const DATE_RE = /\b(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i;

function tryParseDate(str) {
  const m = str?.match?.(DATE_RE);
  if (!m) return null;
  const raw = m[0];
  // handle formats
  // 1) 2025-09-30
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // 2) 9/30 or 09/30/2025
  if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(raw)) {
    const [mm, dd, yy] = raw.split("/");
    const year = yy ? (yy.length === 2 ? 2000 + Number(yy) : Number(yy)) : new Date().getFullYear();
    const d = new Date(year, Number(mm)-1, Number(dd));
    return toISODate(d);
  }
  // 3) Sep 30, 2025 | Sep 30
  const d2 = new Date(raw);
  if (!isNaN(d2)) return toISODate(d2);
  return null;
}

function serviceFrom(headers) {
  const subj = headers.subject || "";
  const from = headers.from || "";
  // favor Subject tokens, fallback to sender domain
  const svc = subj.replace(/\[.*?\]/g, "").split(/[-:|]/)[0].trim();
  if (svc && svc.length >= 2) return svc;
  const m = from.match(/@([a-z0-9.-]+)/i);
  return m ? m[1] : (from || "Unknown");
}

async function gmailList(token, q, maxResults = 50) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", String(maxResults));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
  if (!res.ok) throw new Error(`gmail list failed: ${res.status}`);
  return res.json();
}

async function gmailGet(token, id) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.set("metadataHeaders", "Subject");
  url.searchParams.set("metadataHeaders", "From");
  url.searchParams.set("metadataHeaders", "Date");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
  if (!res.ok) throw new Error(`gmail get failed: ${res.status}`);
  return res.json();
}

function headersFromPayload(payload = {}) {
  const h = payload.headers || [];
  const find = (name) => h.find(x => x.name?.toLowerCase() === name.toLowerCase())?.value || null;
  return {
    subject: find("Subject"),
    from: find("From"),
    date: find("Date"),
  };
}

export async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok:false, error:"use_get" });

    // Search terms (broad): renewals, trials ending, price change, etc.
    // Limit to newer mail to keep it cheap.
    const query = [
      "newer_than:90d",
      '(' +
        'renew OR renewal OR "renews on" OR "auto-renew" OR ' +
        '"trial end" OR "trial ending" OR "trial expires" OR ' +
        '"price increase" OR "going up" OR "your price" OR "price is changing" OR ' +
        "subscription OR billing" +
      ')'
    ].join(" ");

    const token = await getAccessToken(["https://www.googleapis.com/auth/gmail.readonly"]);
    const list = await gmailList(token, query, 50);
    const ids = (list.messages || []).map(m => m.id);

    const now = new Date();
    const within30 = addDays(now, 30);

    const items = [];
    for (const id of ids) {
      try {
        const msg = await gmailGet(token, id);
        const h = headersFromPayload(msg.payload);
        const subj = h.subject || "";
        const snippet = msg.snippet || "";
        const blob = `${subj}\n${snippet}\n${h.from || ""}`;

        const amountMatch = blob.match(AMOUNT_RE);
        const amount = amountMatch ? Number(amountMatch[1]) : null;

        const dateISO = tryParseDate(blob);
        // only keep if date in next 30 days; if no date, we keep but mark unknown
        const keep = dateISO ? inNextNDays(dateISO, 30) : true;

        if (!keep) continue;

        items.push({
          id,
          service: serviceFrom(h),
          subject: subj,
          from: h.from,
          snippet,
          amount,
          renewalDate: dateISO, // may be null (unknown)
          capturedAt: new Date().toISOString(),
        });
      } catch (e) {
        // ignore a single bad message
      }
    }

    // Save to KV for Morning Upload to read
    await kvSet("subs_next30", items);

    return res.status(200).json({
      ok: true,
      scanned: ids.length,
      saved: items.length,
      window: { from: toISODate(now), to: toISODate(within30) },
      sample: items.slice(0, 5),
    });
  } catch (err) {
    return res.status(200).json({ ok:false, error:"subs_scan_failed", details: err?.message || String(err) });
  }
}

export default { handler };
