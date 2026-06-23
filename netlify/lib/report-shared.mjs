import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

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
  combined: [
    { id:"c-launch", name:"Full System — Launch", platform:"Google + Meta", optimizationFreq:"monthly" },
    { id:"c-growth", name:"Full System — Growth", platform:"Google + Meta", optimizationFreq:"weekly"  },
  ],
  ecom: [
    { id:"e-launch",     name:"Store Launch",     platform:"Meta Ads",      optimizationFreq:"monthly" },
    { id:"e-growth",     name:"Store Growth",     platform:"Meta + Google", optimizationFreq:"weekly"  },
    { id:"e-domination", name:"Store Domination", platform:"Meta + Google", optimizationFreq:"weekly"  },
  ],
};
const ALL_PKGS = Object.values(PACKAGES_DB).flat();
export const findPkg = (id) => ALL_PKGS.find((p) => p.id === id);

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

  const statuses = Object.values(cl.botStatuses||{});
  const done = statuses.filter(s=>s==="done").length;
  const total = statuses.length||1;
  score += (done/total) * 1;

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
  const botsComplete = Object.values(client.botStatuses || {}).filter((s) => s === "done").length;
  const botsTotal = Object.values(client.botStatuses || {}).length;
  const pendingSteps = Object.entries(client.botStatuses || {}).filter(([, s]) => s !== "done").map(([k]) => k);

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
Internal Notes: ${client.notes || "None"}`;

  return { text, daysLeft };
};

const buildClientPrompt = (client, period, data) => ({
  system: `You are writing the body of a performance report email that will be sent directly to a BoldLine Media client. Write in professional plain English. Never mention AI or bots.

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
  system: `You are writing a private internal account briefing for Bryson Weiser, owner of BoldLine Media, about one of his clients. This is for his eyes only — be direct and specific, not diplomatic. Never mention AI or bots.

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

const GOLD = "#C8A84B";

const escapeHTML = (s) =>
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

const reportToHTML = (client, reportText, { label, internal }) => {
  const body = markdownToHTML(reportText);
  const banner = internal
    ? `<div style="margin-bottom:14px;padding:8px 12px;border-radius:8px;background:#FEF2F2;border:1px solid #FCA5A5;color:#991B1B;font-size:11px;font-weight:700;letter-spacing:.03em">INTERNAL — DO NOT FORWARD TO CLIENT</div>`
    : "";
  const greeting = internal
    ? ""
    : `<p style="margin:0 0 16px;line-height:1.6;color:#1F2937">Hi ${escapeHTML(firstName(client.contactName) || "there")},</p>`;
  const signoff = internal
    ? ""
    : `<p style="margin:20px 0 0;line-height:1.6;color:#1F2937">Best,<br><strong>The BoldLine Media Team</strong></p>`;
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  ${banner}
  <div style="margin-bottom:22px;text-align:center">
    <div style="font-size:16px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="margin:6px auto 0;height:2px;width:34px;background:${GOLD}"></div>
    <div style="font-size:11px;color:#6B7280;margin-top:10px">${label} — ${escapeHTML(client.name)}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-top:3px solid ${GOLD};border-radius:14px;padding:26px 24px;box-shadow:0 1px 3px rgba(0,0,0,.05)">${greeting}${body}${signoff}</div>
  <div style="margin-top:18px;font-size:11px;color:#9CA3AF;text-align:center">${internal ? "Auto-generated internal briefing — not sent to the client." : "Sent automatically by BoldLine Media. Questions? Just reply to this email."}</div>
</div>
</body></html>`;
};

const sendEmail = async ({ to, subject, html, text }) => {
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

const shouldSend = (client, minGapDays) => {
  if (!client.lastReportSent) return true;
  const sinceDays = (Date.now() - new Date(client.lastReportSent).getTime()) / 864e5;
  return sinceDays >= minGapDays;
};

const isEligible = (client, pkg, period) => {
  if (!pkg || pkg.optimizationFreq !== period) return false;
  if (client.contractStatus !== "active") return false;
  if (!client.email) return false;
  return true;
};

const processClient = async (supabaseAdmin, row, period, minGapDays, testMode = false) => {
  const client = row.data;
  const pkg = findPkg(client.packageId);
  if (!isEligible(client, pkg, period)) return { id: row.id, skipped: `not an eligible ${period} client` };
  if (!testMode && !shouldSend(client, minGapDays)) return { id: row.id, skipped: `already sent this ${period === "weekly" ? "week" : "month"}` };

  const periodLabel = titleCase(period);
  const data = buildDataBlock(client, pkg);

  const clientPrompt = buildClientPrompt(client, period, data);
  const ownerPrompt = buildOwnerPrompt(client, period, data);
  const [clientText, ownerText] = await Promise.all([
    generateText(clientPrompt.system, clientPrompt.user),
    generateText(ownerPrompt.system, ownerPrompt.user),
  ]);

  const testPrefix = testMode ? "[TEST] " : "";

  // Owner copy first: if the client send below fails and this run is retried,
  // a duplicate internal email is harmless but a duplicate client email is not.
  await sendEmail({
    to: process.env.OWNER_EMAIL,
    subject: `${testPrefix}[Internal] ${client.name} — ${periodLabel} Account Briefing`,
    html: reportToHTML(client, ownerText, { label: `${periodLabel} Internal Briefing`, internal: true }),
    text: ownerText,
  });

  await sendEmail({
    to: testMode ? process.env.OWNER_EMAIL : client.email,
    subject: `${testPrefix}${testMode ? `[would go to ${client.email}] ` : ""}Your ${periodLabel} Performance Report — ${client.name}`,
    html: reportToHTML(client, clientText, { label: `${periodLabel} Performance Report`, internal: false }),
    text: clientText,
  });

  if (testMode) return { id: row.id, test: true, client: client.name };

  const entry = {
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    note: `${periodLabel} report sent to client; internal briefing sent to Bryson.`,
    cat: "email",
    ts: Date.now(),
  };
  const nextData = {
    ...client,
    lastReportSent: new Date().toISOString(),
    latestReport: { period, text: clientText, sentAt: new Date().toISOString() },
    commLog: [entry, ...(client.commLog || [])],
  };

  const { error } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) throw error;

  return { id: row.id, sent: true };
};

export const runReportJob = async (req, { period, minGapDays }) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL || !process.env.OWNER_EMAIL) {
    console.error(`${titleCase(period)} report aborted: RESEND_API_KEY, REPORTS_FROM_EMAIL, or OWNER_EMAIL is not configured.`);
    return new Response("not configured", { status: 500 });
  }

  const testMode = new URL(req.url).searchParams.get("test") === "1";

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
    const candidate = (data || []).find((row) => isEligible(row.data, findPkg(row.data.packageId), period));
    if (!candidate) {
      const msg = `No eligible ${period} client found to test with (need an active contract, an email on file, and a ${period}-cadence package).`;
      console.log(msg);
      return new Response(JSON.stringify({ ok: false, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
    }
    try {
      const result = await processClient(supabaseAdmin, candidate, period, minGapDays, true);
      const msg = `Test emails sent to ${process.env.OWNER_EMAIL} using real data from "${candidate.data.name}". No client was emailed, no data was changed.`;
      console.log(msg, result);
      return new Response(JSON.stringify({ ok: true, message: msg, result }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (err) {
      console.error("Test run failed:", err);
      return new Response(JSON.stringify({ ok: false, error: String(err && err.message || err) }), { status: 500, headers: { "content-type": "application/json" } });
    }
  }

  const results = await Promise.allSettled((data || []).map((row) => processClient(supabaseAdmin, row, period, minGapDays)));
  results.forEach((r, i) => {
    const id = data[i] && data[i].id;
    if (r.status === "rejected") console.error(`Client ${id} failed:`, r.reason);
    else console.log(`Client ${id}:`, r.value);
  });

  return new Response("ok", { status: 200 });
};
