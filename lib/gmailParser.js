// lib/gmailParser.js
// Fake parser for now — later we’ll connect it to Gmail API properly.
// This gives you a working structure so your Morning Upload & Evening Download won’t break.

export async function parseGmailHighlights({ daysAhead = 30, urgentWithin = 14 }) {
  // 🔹 Placeholder data for now
  // Later this will come from Gmail API
  const mockEmails = [
    {
      subject: "Netflix Renewal",
      service: "Netflix",
      date: "2025-09-18",
      amount: "$15.99",
      type: "subscription",
    },
    {
      subject: "Doctor’s Appointment",
      service: "Austin Family Clinic",
      date: "2025-09-15",
      type: "appointment",
    },
    {
      subject: "Amazon Delivery Scheduled",
      service: "Amazon",
      date: "2025-09-14",
      type: "delivery",
    },
    {
      subject: "Southwest Airlines Flight Confirmation",
      service: "Southwest Airlines",
      date: "2025-09-29",
      type: "travel",
    },
    {
      subject: "Adobe Creative Cloud Price Increase",
      service: "Adobe Creative Cloud",
      date: "2025-09-20",
      amount: "$22.99",
      type: "subscription",
    },
  ];

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const highlights = mockEmails
    .filter((m) => {
      const d = new Date(m.date);
      return d >= now && d <= cutoff;
    })
    .map((m) => {
      const d = new Date(m.date);
      const daysAway = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
      const urgent = daysAway <= urgentWithin ? "⚠️ " : "";

      if (m.type === "subscription") {
        return `${urgent}${m.service} renewal on ${m.date} (${m.amount || "amount N/A"})`;
      }
      if (m.type === "appointment") {
        return `${urgent}Appointment at ${m.service} on ${m.date}`;
      }
      if (m.type === "delivery") {
        return `${urgent}Delivery from ${m.service} scheduled ${m.date}`;
      }
      if (m.type === "travel") {
        return `${urgent}Travel: ${m.service} on ${m.date}`;
      }
      return `${urgent}${m.subject} (${m.date})`;
    });

  return highlights;
}
