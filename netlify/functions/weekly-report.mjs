import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const PACKAGES_DB = {
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
const findPkg = (id) => ALL_PKGS.find((p) => p.id === id);

const PER_LEAD = { Roofing:75, "Med Spa":35, "Auto Detailing":15 };
const daysUntil = (s) => Math.ceil((new Date(s) - new Date()) / 864e5);

const calcHealth = (cl) => {
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

const buildReportPrompt = (client, pkg) => {
  const perLead = PER_LEAD[client.niche];
  const health = calcHealth(client);
  const onTarget = client.cpl > 0 && client.cpl <= (perLead || 75);
  const daysLeft = daysUntil(client.contractEnd);
  const botsComplete = Object.values(client.botStatuses || {}).filter((s) => s === "done").length;
  const botsTotal = Object.values(client.botStatuses || {}).length;

  const system = `You are generating a client performance report for Bryson Weiser at BoldLine Media. Write in professional plain English. Never mention AI or bots.

CLIENT DATA:
Business: ${client.name}
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
Pipeline Progress: ${botsComplete}/${botsTotal} steps complete
Internal Notes: ${client.notes || "None"}

REPORT STRUCTURE:
1. Campaign Summary (2-3 sentences on current status)
2. Performance This Period (leads, CPL vs target, what's working)
3. What We Did (key actions taken this period)
4. What's Next (next 30 days plan)
5. One recommendation for the client

Keep it concise. This will be emailed directly to the client, so write it as a finished, polished update — no placeholders, no brackets, no internal jargon.`;

  const user = `Write the weekly performance report email for ${client.name}. Use all the client data provided. Sign off as "The BoldLine Media Team".`;

  return { system, user };
};

const generateReportText = async (client, pkg) => {
  const { system, user } = buildReportPrompt(client, pkg);
  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: user }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
};

const reportToHTML = (client, reportText) => {
  const paragraphs = reportText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:#1F2937">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:20px">
    <div style="font-size:13px;font-weight:700;letter-spacing:.04em;color:#C8A84B;text-transform:uppercase">BoldLine Media</div>
    <div style="font-size:11px;color:#6B7280;margin-top:2px">Weekly Performance Report — ${client.name}</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:24px">${body}</div>
  <div style="margin-top:18px;font-size:11px;color:#9CA3AF;text-align:center">Sent automatically by BoldLine Media. Questions? Just reply to this email.</div>
</div>
</body></html>`;
};

const sendReportEmail = async (client, html, reportText) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.REPORTS_FROM_EMAIL,
      to: [client.email],
      subject: `Your Weekly Performance Report — ${client.name}`,
      html,
      text: reportText,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend error ${res.status}: ${errBody}`);
  }
};

const shouldSend = (client) => {
  if (!client.lastReportSent) return true;
  const sinceDays = (Date.now() - new Date(client.lastReportSent).getTime()) / 864e5;
  return sinceDays >= 5;
};

const processClient = async (supabaseAdmin, row) => {
  const client = row.data;
  const pkg = findPkg(client.packageId);
  if (!pkg || pkg.optimizationFreq !== "weekly") return { id: row.id, skipped: "not on a weekly package" };
  if (client.contractStatus !== "active") return { id: row.id, skipped: "contract not active" };
  if (!client.email) return { id: row.id, skipped: "no email on file" };
  if (!shouldSend(client)) return { id: row.id, skipped: "already sent this week" };

  const reportText = await generateReportText(client, pkg);
  const html = reportToHTML(client, reportText);
  await sendReportEmail(client, html, reportText);

  const entry = {
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    note: "Weekly performance report auto-sent.",
    cat: "email",
    ts: Date.now(),
  };
  const nextData = { ...client, lastReportSent: new Date().toISOString(), commLog: [entry, ...(client.commLog || [])] };

  const { error } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) throw error;

  return { id: row.id, sent: true };
};

export default async (req) => {
  if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL) {
    console.error("Weekly report aborted: RESEND_API_KEY or REPORTS_FROM_EMAIL is not configured.");
    return new Response("not configured", { status: 500 });
  }

  let nextRun = null;
  try {
    const body = await req.json();
    nextRun = body && body.next_run;
  } catch {
    // not all invocations send a JSON body (e.g. manual "Run now" testing) — safe to ignore
  }
  console.log("Weekly report run starting. next_run:", nextRun);

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data");
  if (error) {
    console.error("Failed to load clients:", error);
    return new Response("error loading clients", { status: 500 });
  }

  const results = await Promise.allSettled((data || []).map((row) => processClient(supabaseAdmin, row)));
  results.forEach((r, i) => {
    const id = data[i] && data[i].id;
    if (r.status === "rejected") console.error(`Client ${id} failed:`, r.reason);
    else console.log(`Client ${id}:`, r.value);
  });

  return new Response("ok", { status: 200 });
};
