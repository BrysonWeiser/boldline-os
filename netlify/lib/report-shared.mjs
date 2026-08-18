import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { pipelineProgress } from "./pipeline-shared.mjs";

export const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

export const PACKAGES_DB = {
  google: [
    { id:"g-launch",      name:"Launch System",      platform:"Google Ads",    optimizationFreq:"monthly" },
    { id:"g-growth",      name:"Growth System",      platform:"Google Ads",    optimizationFreq:"weekly"  },
    { id:"g-acquisition", name:"Acquisition System", platform:"Google Ads",    optimizationFreq:"weekly"  },
  ],
  meta: [
    { id:"m-launch",      name:"Launch System",      platform:"Meta Ads",      optimizationFreq:"monthly" },
    { id:"m-growth",      name:"Growth System",      platform:"Meta Ads",      optimizationFreq:"weekly"  },
    { id:"m-acquisition", name:"Acquisition System", platform:"Meta Ads",      optimizationFreq:"weekly"  },
  ],
  // No combined Launch tier: Google + Meta starts at $5,000/mo of ad budget, because
  // splitting less than that across two platforms means neither one learns.
  combined: [
    { id:"c-growth", name:"Full System — Growth", platform:"Google + Meta", optimizationFreq:"weekly"  },
    { id:"c-acquisition", name:"Full System — Acquisition", platform:"Google + Meta", optimizationFreq:"weekly"  },
  ],
  ecom: [
    { id:"e-launch",     name:"Store Launch",     platform:"Meta Ads",      optimizationFreq:"monthly" },
    { id:"e-growth",     name:"Store Growth",     platform:"Meta Ads",      optimizationFreq:"weekly"  },
    { id:"e-domination", name:"Store Domination", platform:"Meta + Google", optimizationFreq:"weekly"  },
  ],
};
const ALL_PKGS = Object.values(PACKAGES_DB).flat();
// The internal My Ads house account runs on a package that is not for sale, so it
// is not in PACKAGES_DB (that table feeds client-facing pickers). Without this the
// server resolves no package for the house account and every job skips it silently.
const HOUSE_PKG = { id: "bl-house", name: "Full System (House Account)", platform: "Google + Meta", optimizationFreq: "weekly" };
export const findPkg = (id) => (id === HOUSE_PKG.id ? HOUSE_PKG : ALL_PKGS.find((p) => p.id === id));

export const PER_LEAD = { Roofing:75, "Med Spa":35, "Auto Detailing":15 };
export const daysUntil = (s) => Math.ceil((new Date(s) - new Date()) / 864e5);

export const calcHealth = (cl) => {
  let score = 0;
  const days = daysUntil(cl.contractEnd);

  if (cl.contractSigned)  score += 1;
  if (cl.intakeComplete)  score += 1;

  const stageScore = {
    onboarding:0, research:0.5, building:1, review:1.5,
    active:2, optimizing:2, scaling:2, paused:0.5,
  };
  score += stageScore[cl.stage]||0;

  if (cl.leads>0)  score += 0.5;
  if (cl.leads>10) score += 0.5;
  if (cl.leads>30) score += 0.5;
  if (cl.leads>0 && cl.cpl>0) {
    const target = PER_LEAD[cl.niche]||50;
    if (cl.cpl <= target * 0.75) score += 0.5;
    else if (cl.cpl <= target)   score += 0.25;
  }

  if (cl.contractStatus==="active") score += 1;
  if (days>30)  score += 1;
  else if (days>7) score += 0.5;

  // Effective statuses, so a client's health here matches the OS screen exactly.
  score += pipelineProgress(cl).fraction * 1;

  if (!cl.intakeComplete && cl.stage!=="onboarding") score -= 0.5;
  if (cl.contractStatus==="expired") score -= 1;

  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
};

const anthropic = new Anthropic();
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const buildDataBlock = (client, pkg) => {
  const perLead = PER_LEAD[client.niche];
  const health = calcHealth(client);
  const onTarget = client.cpl > 0 && client.cpl <= (perLead || 75);
  const daysLeft = daysUntil(client.contractEnd);
  const pipeline = pipelineProgress(client);
  const botsComplete = pipeline.done;
  const botsTotal = pipeline.total;
  const pendingSteps = pipeline.pending;

  const text = `Business: ${client.name}
Contact: ${client.contactName || "Not provided"}
Niche: ${client.niche}
Package: ${(pkg && pkg.name)} on ${(pkg && pkg.platform)}
Campaign Stage: ${client.stage}
Health Score: ${health.toFixed(1)}/10
Leads Generated: ${client.leads}
Average CPL: ${client.cpl > 0 ? "$" + client.cpl : "Not yet tracked"}
Target CPL: ${perLead ? "$" + perLead + " (per-lead rate)" : "—"}
CPL Status: ${client.leads > 0 ? (onTarget ? "On target" : "Above target — needs optimization") : "No leads yet"}
Ad Budget: ${client.adBudget || "Not set"}
Contract: ${client.contractStart} → ${client.contractEnd} (${daysLeft > 0 ? daysLeft + "d remaining" : "expired"})
Intake Complete: ${client.intakeComplete ? "Yes" : "No"}
Pipeline Progress: ${botsComplete}/${botsTotal} steps complete${pendingSteps.length ? " (pending: " + pendingSteps.join(", ") + ")" : ""}
${(() => {
  // Live ad numbers from the scheduled ads-sync snapshot. Without these an owner
  // briefing can only talk about the CRM record, not what the ads actually did.
  const ap = client.adPerf || {}; const t = ap.totals || {}; const b = ap.budget || {};
  if (!ap.syncedAt) return "Live Ad Data: none yet (no ad account linked, or ads-sync has not run)";
  return `Live Ad Data (as of ${ap.syncedAt}): ${t.liveCampaigns || 0} live campaign(s), ${Number(t.impressions || 0).toLocaleString()} impressions, ${Number(t.clicks || 0).toLocaleString()} clicks, $${Number(t.spend30d || 0).toLocaleString()} spent over 30d, ${t.conversions || 0} conversions`
    + (b.monthly > 0 ? `\nBudget Pacing: $${Number(b.pacing || 0).toLocaleString()} against a $${Number(b.monthly).toLocaleString()}/mo budget (${b.pct}%, ${b.state})` : "");
})()}
Internal Notes: ${client.notes || "None"}`;

  return { text, daysLeft };
};

const buildClientPrompt = (client, period, data) => ({
  system: `You are writing the body of a performance report email that will be sent directly to a BoldLine Media client. Write in professional plain English with no emojis or decorative symbols. Never mention AI or bots.

CLIENT DATA:
${data.text}

OUTPUT FORMAT:
Do NOT include a greeting, salutation, subject line, or sign-off — those are added separately by the system. Start directly with the first section. Write each section header on its own line in bold markdown, using exactly these headers in this order:
- **Campaign Summary** — 2-3 sentences on current status
- **Performance This Period** — leads, CPL vs target, what's working
- **What We Did** — key actions taken this period
- **What's Next** — next 30 days plan
- **Recommendation** — one recommendation for the client

Use "- " for bullet points within a section where a list is clearer than prose.

Keep it concise. Write it as a finished, polished update — no placeholders, no brackets, no internal jargon.`,
  user: `Write the body of the ${period} performance report for ${client.name}. Use all the client data provided. Do not include a greeting or sign-off — start directly with the first section header.`,
});

const buildOwnerPrompt = (client, period, data) => ({
  // The house account is not a client. Calling it one produces a briefing that
  // talks about "the client" and "the contract" when the account is Bryson's own
  // money, which reads as a template rather than a read on his own advertising.
  system: `${client.internal
    ? `You are writing a private ${period} briefing for Bryson Weiser about BOLDLINE MEDIA'S OWN advertising. This is not a client account, it is his own money buying his own leads. There is no contract, no client to keep happy, and no billing to discuss. Judge it the way an owner would: is the spend producing booked calls, what is working, what should change this week. Be blunt. Never mention AI or bots.`
    : `You are writing a private internal account briefing for Bryson Weiser, owner of BoldLine Media, about one of his clients. This is for his eyes only — be direct and specific, not diplomatic. Never mention AI or bots.`}

CLIENT DATA:
${data.text}

OUTPUT FORMAT:
Do NOT include a greeting, salutation, subject line, or sign-off. Start directly with the first section. Write each section header on its own line in bold markdown, using exactly these headers in this order:
- **Account Snapshot** — one line: stage, health score, contract status
- **Performance vs Target** — leads, CPL vs target — say plainly if it's good, bad, or borderline
- **What Was Done This Period**
- **Flags** — anything needing Bryson's attention: renewal window, missed targets, incomplete intake, stalled pipeline steps, low lead volume. If nothing needs attention, say so in one line.
- **What's Next**

Use "- " for bullet points within a section where a list is clearer than prose.

Be specific with numbers. Don't soften bad news.`,
  user: `Write the internal ${period} account briefing for ${client.name}. Do not include a greeting or sign-off — start directly with the first section header.`,
});

const generateText = async (system, user) => {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: user }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
};

export const GOLD = "#C8A84B";

export const escapeHTML = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inlineMd = (s) => escapeHTML(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const firstName = (contactName) => {
  if (!contactName) return null;
  const first = contactName.trim().split(/\s+/)[0];
  return first || null;
};

// Renders the LLM's lightweight markdown (bold section headers, "- " bullets,
// plain paragraphs) into HTML matching BoldLine's branded email styling.
const markdownToHTML = (text) => {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let bullets = null;
  let firstBlock = true;

  const flushBullets = () => {
    if (bullets && bullets.length) {
      blocks.push(`<ul style="margin:0 0 16px;padding-left:18px;color:#1F2937">${bullets.map((b) => `<li style="margin-bottom:6px;line-height:1.55">${inlineMd(b)}</li>`).join("")}</ul>`);
    }
    bullets = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushBullets(); continue; }

    const headerMatch = line.match(/^\*\*(.+?)\*\*:?$/);
    if (headerMatch) {
      flushBullets();
      const topMargin = firstBlock ? "0" : "22px";
      blocks.push(`<div style="margin:${topMargin} 0 8px;padding-bottom:5px;border-bottom:1px solid #F0E6C8;font-size:11px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">${escapeHTML(headerMatch[1])}</div>`);
      firstBlock = false;
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      bullets = bullets || [];
      bullets.push(bulletMatch[1]);
      firstBlock = false;
      continue;
    }

    flushBullets();
    blocks.push(`<p style="margin:0 0 14px;line-height:1.6;color:#1F2937">${inlineMd(line)}</p>`);
    firstBlock = false;
  }
  flushBullets();
  return blocks.join("");
};

const reportToHTML = (reportText, { label, subtitle, internal, contactName }) => {
  const body = markdownToHTML(reportText);
  const banner = internal
    ? `<div style="margin-bottom:14px;padding:8px 12px;border-radius:8px;background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B;font-size:11px;font-weight:700;letter-spacing:.03em">INTERNAL — DO NOT FORWARD TO CLIENT</div>`
    : "";
  const greeting = internal
    ? ""
    : `<p style="margin:0 0 16px;line-height:1.6;color:#1F2937">Hi ${escapeHTML(firstName(contactName) || "there")},</p>`;
  const signoff = internal
    ? ""
    : `<p style="margin:20px 0 0;line-height:1.6;color:#1F2937">Best,<br><strong>The BoldLine Media Team</strong></p>`;
  const headline = subtitle ? `${label} — ${escapeHTML(subtitle)}` : label;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  ${banner}
  <div style="margin-bottom:22px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">${headline}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:26px 24px;box-shadow:0 1px 3px rgba(0,0,0,.05)">${greeting}${body}${signoff}</div>
  <div style="margin-top:18px;font-size:11px;color:#9CA3AF;text-align:center">${internal ? "Auto-generated internal briefing — not sent to the client." : "Sent automatically by BoldLine Media. Questions? Just reply to this email."}</div>
</div>
</body></html>`;
};

export const sendEmail = async ({ to, subject, html, text }) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.REPORTS_FROM_EMAIL, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error ${res.status}: ${errBody}`);
  }
};

export const appendLead = async (supabaseAdmin, row, lead) => {
  const client = row.data;
  const leadEntry = { status: "new", followUps: [], ...lead };
  const entry = {
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    note: `New lead: ${lead.name || "Unknown"}${lead.source !== "unknown" ? ` (${lead.source})` : ""}`,
    cat: "update",
    ts: Date.now(),
  };
  const nextData = {
    ...client,
    leads: (client.leads || 0) + 1,
    leadsLog: [leadEntry, ...(client.leadsLog || [])],
    commLog: [entry, ...(client.commLog || [])],
  };
  const { error } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) throw error;
  return nextData;
};

// Branded "New Lead" notification to the owner (OWNER_EMAIL). Shared by
// lead-intake (form / website leads) and voice (inbound tracking-number calls)
// so every new lead — form OR phone call — pings Bryson the same way. Fail-soft.
export const notifyOwnerOfLead = async (client, lead) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL || !process.env.OWNER_EMAIL) return;
  const rows = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Source", lead.source],
    ["Message", lead.message],
  ].filter(([, v]) => v);
  const rowsHTML = rows
    .map(([k, v]) => `<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;letter-spacing:.05em;color:#9CA3AF;text-transform:uppercase">${escapeHTML(k)}</div><div style="font-size:14px;color:#1F2937;margin-top:2px">${escapeHTML(String(v))}</div></div>`)
    .join("") || `<div style="font-size:13px;color:#6B7280">No details were sent with this lead.</div>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">New Lead — ${escapeHTML(client.name)}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:22px 22px">${rowsHTML}</div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">Lead #${client.leads} for ${escapeHTML(client.name)}. Logged automatically by BoldLine OS.</div>
</div>
</body></html>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") || "No details were sent with this lead.";
  try {
    await sendEmail({ to: process.env.OWNER_EMAIL, subject: `New Lead — ${client.name}`, html, text });
  } catch (err) {
    console.error("Lead notification email failed:", err);
  }
};

// Branded wrapper for a short transactional message sent to one of a client's
// own leads — headlined with the client's business name, not BoldLine's,
// since from the lead's perspective this email comes from the business they
// contacted.
export const leadEmailHTML = (client, bodyText) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:18px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.04em;color:#1F2937;text-transform:uppercase">${escapeHTML(client.name)}</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:22px 22px;font-size:14px;line-height:1.6;color:#1F2937">${escapeHTML(bodyText).replace(/\n/g, "<br>")}</div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">This is an automated message from ${escapeHTML(client.name)}.</div>
</div>
</body></html>`;

export const sendSMS = async ({ to, body }) => {
  // SMS is OFF by default (Bryson, 2026-07-25) — the trial Twilio account's A2P
  // block makes texts fail, so we don't attempt them. Reports + alerts still go
  // out by email + in-app. To turn SMS back on after upgrading Twilio to paid,
  // set env var SMS_ENABLED=1 in Netlify (no code change needed).
  if (process.env.SMS_ENABLED !== "1") return;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from || !to) {
    console.warn("SMS skipped: Twilio is not fully configured.");
    return;
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Twilio error ${res.status}: ${errBody}`);
  }
};

const gapOk = (dateStr, minGapDays) => {
  if (!dateStr) return true;
  const sinceDays = (Date.now() - new Date(dateStr).getTime()) / 864e5;
  return sinceDays >= minGapDays;
};

// Monthly-tier clients are anchored to their own contract date instead of the
// calendar, so "due" means 30+ days since the last CLIENT report (or since the
// contract started, for the very first one) rather than "it's the 1st."
const dueForMonthly = (client, intervalDays) => {
  const anchor = client.lastReportSent || client.contractStart;
  if (!anchor) return false;
  const sinceDays = (Date.now() - new Date(anchor).getTime()) / 864e5;
  return sinceDays >= intervalDays;
};

// Bryson gets an internal briefing on EVERY active client every week — even
// monthly-tier clients — so he stays current between the client-facing sends.
// Tracked separately from lastReportSent (which gates the client-facing email)
// so a weekly owner briefing never disturbs a monthly client's send cadence.
const OWNER_BRIEFING_GAP_DAYS = 5;

// A client is in scope for reporting at all if it's a real (non-internal),
// active account with a known package and an email on file. The internal
// "My Ads" house account is excluded — ARIA's monthly OS report covers it.
// DEMO ACCOUNTS NEVER RECEIVE ANYTHING. A demo client exists so the OS has something
// to render when there are no real clients, and it carries an active contract and an
// email precisely so the screens look alive. Without this gate the Monday 15:00 UTC
// weekly job would email a real performance report, built from invented numbers, to
// whatever address the demo carries. Checked first, before every other condition.
const isDemo = (client) => !!(client && client.demo);

// CLIENT-FACING reports: a real client, active, with somewhere to send it.
const isReportable = (client, pkg) =>
  !!pkg && !client.internal && !isDemo(client) && client.contractStatus === "active" && !!client.email;

// OWNER briefings are a different question. They go to Bryson, not to a client, so
// they need no client email and no contract — and the house account is exactly the
// one he most wants a weekly read on, since it is his own money. It qualifies once
// an ad account is linked; before that there is nothing to report.
const isOwnerBriefable = (client, pkg) => {
  if (!pkg) return false;
  if (isDemo(client)) return false;   // fake numbers must never reach a real inbox, his included
  if (client.internal) return !!(client.googleAdsCustomerId || client.metaAdAccountId);
  return client.contractStatus === "active";
};

const logEntry = (note, cat) => ({
  date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  note, cat, ts: Date.now(),
});

// WEEKLY run: a weekly internal briefing to Bryson for EVERY active client
// (so he stays current on monthly-tier clients too), plus the client-facing
// performance report for weekly-tier clients only.
const processWeekly = async (supabaseAdmin, row, testMode = false) => {
  const client = row.data;
  const pkg = findPkg(client.packageId);
  // Two independent gates. The house account gets the OWNER half and never the
  // client half, because there is no client to send anything to.
  const ownerOk = isOwnerBriefable(client, pkg);
  const clientOk = isReportable(client, pkg);
  if (!ownerOk && !clientOk) return { id: row.id, skipped: "not a reportable client" };

  const ownerDue = ownerOk && (testMode || gapOk(client.lastOwnerBriefing, OWNER_BRIEFING_GAP_DAYS));
  const clientDue = clientOk && pkg.optimizationFreq === "weekly" && (testMode || gapOk(client.lastReportSent, 5));
  if (!ownerDue && !clientDue) return { id: row.id, skipped: "nothing due this week" };

  const data = buildDataBlock(client, pkg);
  const ownerP = ownerDue ? buildOwnerPrompt(client, "weekly", data) : null;
  const clientP = clientDue ? buildClientPrompt(client, "weekly", data) : null;
  const [ownerText, clientText] = await Promise.all([
    ownerP ? generateText(ownerP.system, ownerP.user) : Promise.resolve(null),
    clientP ? generateText(clientP.system, clientP.user) : Promise.resolve(null),
  ]);

  const testPrefix = testMode ? "[TEST] " : "";

  if (ownerDue) {
    await sendEmail({
      to: process.env.OWNER_EMAIL,
      subject: `${testPrefix}[Internal] ${client.name} — Weekly Account Briefing`,
      html: reportToHTML(ownerText, { label: "Weekly Internal Briefing", subtitle: client.name, internal: true }),
      text: ownerText,
    });
  }
  if (clientDue) {
    await sendEmail({
      to: testMode ? process.env.OWNER_EMAIL : client.email,
      subject: `${testPrefix}${testMode ? `[would go to ${client.email}] ` : ""}Your Weekly Performance Report — ${client.name}`,
      html: reportToHTML(clientText, { label: "Weekly Performance Report", subtitle: client.name, internal: false, contactName: client.contactName }),
      text: clientText,
    });
  }

  if (testMode) return { id: row.id, test: true, client: client.name, ownerDue, clientDue };

  const now = new Date().toISOString();
  const nextData = { ...client };
  const logs = [];
  if (ownerDue) { nextData.lastOwnerBriefing = now; logs.push(logEntry("Weekly internal briefing sent to Bryson.", "email")); }
  if (clientDue) { nextData.lastReportSent = now; nextData.latestReport = { period: "weekly", text: clientText, sentAt: now }; logs.push(logEntry("Weekly report sent to client.", "email")); }
  nextData.commLog = [...logs, ...(client.commLog || [])];

  const { error } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: now }).eq("id", row.id);
  if (error) throw error;
  return { id: row.id, ownerBriefed: ownerDue, clientSent: clientDue ? client.name : null };
};

// MONTHLY run: the client-facing monthly performance report for monthly-tier
// clients, plus an exact copy to Bryson of what the client received (his ask:
// "I should get a copy of that report that goes to them"). Bryson's weekly
// internal briefing above is what keeps him current between these; this run
// does NOT generate a separate briefing.
const processMonthly = async (supabaseAdmin, row, testMode = false) => {
  const client = row.data;
  const pkg = findPkg(client.packageId);
  if (!isReportable(client, pkg) || pkg.optimizationFreq !== "monthly") return { id: row.id, skipped: "not a monthly client" };
  if (!testMode && !dueForMonthly(client, 30)) return { id: row.id, skipped: "not due yet this month" };

  const data = buildDataBlock(client, pkg);
  const clientP = buildClientPrompt(client, "monthly", data);
  const clientText = await generateText(clientP.system, clientP.user);
  const testPrefix = testMode ? "[TEST] " : "";

  // Owner's copy first (a duplicate on retry is harmless), then the client send.
  await sendEmail({
    to: process.env.OWNER_EMAIL,
    subject: `${testPrefix}[Copy] ${client.name} — Monthly Performance Report (sent to client)`,
    html: reportToHTML(clientText, { label: "Monthly Performance Report", subtitle: client.name, internal: false, contactName: client.contactName }),
    text: clientText,
  });
  await sendEmail({
    to: testMode ? process.env.OWNER_EMAIL : client.email,
    subject: `${testPrefix}${testMode ? `[would go to ${client.email}] ` : ""}Your Monthly Performance Report — ${client.name}`,
    html: reportToHTML(clientText, { label: "Monthly Performance Report", subtitle: client.name, internal: false, contactName: client.contactName }),
    text: clientText,
  });

  if (testMode) return { id: row.id, test: true, client: client.name };

  const now = new Date().toISOString();
  const nextData = {
    ...client,
    lastReportSent: now,
    latestReport: { period: "monthly", text: clientText, sentAt: now },
    commLog: [logEntry("Monthly report sent to client; copy sent to Bryson.", "email"), ...(client.commLog || [])],
  };
  const { error } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: now }).eq("id", row.id);
  if (error) throw error;
  return { id: row.id, clientSent: client.name };
};

export const runReportJob = async (req, { period }) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL || !process.env.OWNER_EMAIL) {
    console.error(`${titleCase(period)} report aborted: RESEND_API_KEY, REPORTS_FROM_EMAIL, or OWNER_EMAIL is not configured.`);
    return new Response("not configured", { status: 500 });
  }

  const testMode = new URL(req.url).searchParams.get("test") === "1";
  const processor = period === "monthly" ? processMonthly : processWeekly;
  const eligibleForTest = (client, pkg) =>
    isReportable(client, pkg) && (period === "monthly" ? pkg.optimizationFreq === "monthly" : true);

  let nextRun = null;
  try {
    const body = await req.json();
    nextRun = body && body.next_run;
  } catch {
    // not all invocations send a JSON body (e.g. manual "Run now" testing) — safe to ignore
  }
  console.log(`${titleCase(period)} report run starting. next_run:`, nextRun, "testMode:", testMode);

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data");
  if (error) {
    console.error("Failed to load clients:", error);
    return new Response("error loading clients", { status: 500 });
  }

  if (testMode) {
    const candidate = (data || []).find((row) => eligibleForTest(row.data, findPkg(row.data.packageId)));
    if (!candidate) {
      const need = period === "monthly" ? "a monthly-cadence package" : "any active package";
      const msg = `No eligible ${period} client found to test with (need an active contract, an email on file, and ${need}).`;
      console.log(msg);
      return new Response(JSON.stringify({ ok: false, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
    }
    try {
      const result = await processor(supabaseAdmin, candidate, true);
      const msg = `Test emails sent to ${process.env.OWNER_EMAIL} using real data from "${candidate.data.name}". No client was emailed, no data was changed.`;
      console.log(msg, result);
      return new Response(JSON.stringify({ ok: true, message: msg, result }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      console.error("Test run failed:", err);
      return new Response(JSON.stringify({ ok: false, error: String(err && err.message || err) }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  const results = await Promise.allSettled((data || []).map((row) => processor(supabaseAdmin, row)));
  const clientSentTo = [];
  let ownerBriefed = 0;
  results.forEach((r, i) => {
    const id = data[i] && data[i].id;
    if (r.status === "rejected") console.error(`Client ${id} failed:`, r.reason);
    else {
      console.log(`Client ${id}:`, r.value);
      if (r.value) {
        if (r.value.clientSent) clientSentTo.push(r.value.clientSent);
        if (r.value.ownerBriefed) ownerBriefed++;
      }
    }
  });

  const parts = [];
  if (clientSentTo.length) parts.push(`${titleCase(period)} report${clientSentTo.length > 1 ? "s" : ""} sent to ${clientSentTo.join(", ")}`);
  if (ownerBriefed) parts.push(`${ownerBriefed} internal briefing${ownerBriefed > 1 ? "s" : ""} for you`);
  if (parts.length) {
    try {
      await sendSMS({ to: process.env.OWNER_PHONE, body: `BoldLine: ${parts.join("; ")}.` });
    } catch (err) {
      console.error("SMS notification failed:", err);
    }
  }

  return new Response("ok", { status: 200 });
};

const REQUIRED_ENV_VARS = [
  "RESEND_API_KEY",
  "REPORTS_FROM_EMAIL",
  "OWNER_EMAIL",
  "ANTHROPIC_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "OWNER_PHONE",
];

const EXPECTED_GAP_DAYS = { weekly: 7, monthly: 30 };

// No dedicated logging table exists, so pipeline health is inferred from the
// same client data the reports already use: accounts past their expected
// cadence (plus slack) suggest the report job may not be reaching them.
const buildOSDataBlock = (rows) => {
  const clients = (rows || []).map((r) => r.data);
  const active = clients.filter((c) => c.contractStatus === "active");

  const healths = active.map((c) => calcHealth(c));
  const avgHealth = healths.length ? healths.reduce((a, b) => a + b, 0) / healths.length : 0;
  const lowHealth = active.filter((c) => calcHealth(c) < 5).map((c) => `${c.name} (${calcHealth(c).toFixed(1)}/10)`);

  const totalLeads = active.reduce((sum, c) => sum + (c.leads || 0), 0);
  const aboveTargetCPL = active.filter((c) => {
    const target = PER_LEAD[c.niche] || 75;
    return c.leads > 0 && c.cpl > target;
  }).map((c) => c.name);

  const renewalsSoon = active.filter((c) => {
    const days = daysUntil(c.contractEnd);
    return days > 0 && days <= 30;
  }).map((c) => `${c.name} (${daysUntil(c.contractEnd)}d)`);

  const incompleteIntake = active.filter((c) => !c.intakeComplete).map((c) => c.name);

  const stageBreakdown = {};
  active.forEach((c) => { stageBreakdown[c.stage] = (stageBreakdown[c.stage] || 0) + 1; });

  const packageMix = {};
  active.forEach((c) => {
    const pkg = findPkg(c.packageId);
    const key = pkg ? `${pkg.platform} / ${pkg.name}` : "Unknown";
    packageMix[key] = (packageMix[key] || 0) + 1;
  });

  const missingEmail = active.filter((c) => !c.email).map((c) => c.name);

  const overdue = active.filter((c) => {
    const pkg = findPkg(c.packageId);
    const expected = pkg && EXPECTED_GAP_DAYS[pkg.optimizationFreq];
    if (!expected) return false;
    const anchor = c.lastReportSent || c.contractStart;
    if (!anchor) return false;
    const sinceDays = (Date.now() - new Date(anchor).getTime()) / 864e5;
    return sinceDays >= expected + 7;
  }).map((c) => c.name);

  const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  return `PORTFOLIO OVERVIEW
Total Clients: ${clients.length}
Active Clients: ${active.length}
Average Health Score: ${avgHealth.toFixed(1)}/10
Low-Health Accounts (below 5/10): ${lowHealth.length ? lowHealth.join(", ") : "None"}
Total Leads Generated (active accounts): ${totalLeads}
Accounts Above Target CPL: ${aboveTargetCPL.length ? aboveTargetCPL.join(", ") : "None"}
Renewals Within 30 Days: ${renewalsSoon.length ? renewalsSoon.join(", ") : "None"}
Incomplete Intake: ${incompleteIntake.length ? incompleteIntake.join(", ") : "None"}
Stage Breakdown: ${Object.entries(stageBreakdown).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}
Package Mix: ${Object.entries(packageMix).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}

SYSTEM / TECHNICAL HEALTH
Active Accounts Missing Email: ${missingEmail.length ? missingEmail.join(", ") : "None"}
Accounts With Overdue Reports (possible pipeline issue): ${overdue.length ? overdue.join(", ") : "None"}
Missing Required Configuration: ${missingEnvVars.length ? missingEnvVars.join(", ") : "None — all required environment variables are set"}`;
};

const buildOSPrompt = (dataText) => ({
  system: `You are ARIA, the AI assistant built into the BoldLine Media operating system. You are writing a monthly internal health report for Bryson Weiser, the owner, covering the entire business and the system itself. This is for his eyes only — be direct and specific, not diplomatic. Never mention being an AI model or large language model; you are ARIA reporting on the system you run inside of.

PORTFOLIO & SYSTEM DATA:
${dataText}

OUTPUT FORMAT:
Do NOT include a greeting, salutation, subject line, or sign-off. Start directly with the first section. Write each section header on its own line in bold markdown, using exactly these headers in this order:
- **Overall Health** — one to two sentences on the state of the business portfolio right now
- **What's Working** — what's going well across accounts, be specific with names and numbers
- **What Needs Attention** — accounts or trends that need Bryson's attention, ranked by urgency
- **System Health** — status of the reporting pipeline and configuration based on the technical data provided
- **Recommendations** — concrete, prioritized ideas for making the BoldLine OS itself better: automations worth adding, workflow inefficiencies worth fixing, features worth building, anything that would make the system run smoother or save Bryson time — not just account follow-ups

Use "- " for bullet points within a section where a list is clearer than prose. Be specific with numbers and account names. Don't soften bad news.`,
  user: `Write this month's OS health report. Use all the portfolio and system data provided. Do not include a greeting or sign-off — start directly with the first section header.`,
});

export const runOSHealthReport = async (req) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL || !process.env.OWNER_EMAIL) {
    console.error("OS health report aborted: RESEND_API_KEY, REPORTS_FROM_EMAIL, or OWNER_EMAIL is not configured.");
    return new Response("not configured", { status: 500 });
  }

  const testMode = new URL(req.url).searchParams.get("test") === "1";
  const testPrefix = testMode ? "[TEST] " : "";

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data");
  if (error) {
    console.error("Failed to load clients for OS health report:", error);
    return new Response("error loading clients", { status: 500 });
  }

  try {
    const dataText = buildOSDataBlock(data || []);
    const prompt = buildOSPrompt(dataText);
    const reportText = await generateText(prompt.system, prompt.user);

    await sendEmail({
      to: process.env.OWNER_EMAIL,
      subject: `${testPrefix}Monthly OS Health Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      html: reportToHTML(reportText, { label: "Monthly OS Health Report", internal: true }),
      text: reportText,
    });

    if (!testMode) {
      try {
        await sendSMS({ to: process.env.OWNER_PHONE, body: "BoldLine: ARIA's monthly OS health report is ready — check your email." });
      } catch (err) {
        console.error("OS health report SMS failed:", err);
      }
    }

    const msg = `OS health report sent to ${process.env.OWNER_EMAIL}.`;
    console.log(msg);
    return new Response(JSON.stringify({ ok: true, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("OS health report failed:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err && err.message || err) }), { status: 500, headers: { "content-type": "application/json" } });
  }
};
