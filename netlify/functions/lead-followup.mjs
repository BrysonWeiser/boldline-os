import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, sendSMS, leadEmailHTML, handoffIsFinished } from "../lib/report-shared.mjs";

const DAY = 864e5;

// Touches stop the moment a client/owner marks the lead as anything other
// than "new" in the dashboard, so this only ever nurtures leads nobody has
// acted on yet.
const STEPS = [
  { id: "day1", afterDays: 1 },
  { id: "day3", afterDays: 3 },
  { id: "day7", afterDays: 7 },
  { id: "day14", afterDays: 14 },
];

const findDueStep = (lead) => {
  if ((lead.status || "new") !== "new" || !lead.receivedAt) return null;
  const ageDays = (Date.now() - new Date(lead.receivedAt).getTime()) / DAY;
  const sentSteps = new Set((lead.followUps || []).map((f) => f.step));
  return STEPS.find((s) => ageDays >= s.afterDays && !sentSteps.has(s.id)) || null;
};

const buildFollowUp = (client, lead, stepId) => {
  const firstName = lead.name ? lead.name.trim().split(/\s+/)[0] : "";
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const reachedOut = lead.source === "call_tracking" ? `you called ${client.name} recently` : `you reached out to ${client.name} recently`;
  const phoneLine = client.businessPhone ? ` You can also call us anytime at ${client.businessPhone}.` : "";

  const BODIES = {
    day1:  `${greeting} just following up — ${reachedOut} and we don't want you to slip through the cracks. Reply here anytime and we'll take care of you.${phoneLine}`,
    day3:  `${greeting} circling back — ${reachedOut}, and we'd still love to help. A quick reply is all it takes and we'll get you sorted.${phoneLine}`,
    day7:  `${greeting} still thinking it over? No rush — ${reachedOut}, and whenever the timing's right we're ready to jump in. Just reply or call.${phoneLine}`,
    day14: `${greeting} last check-in from us — we don't want to crowd your inbox. Since ${reachedOut}, our door stays open: reply anytime down the road and we'll pick right up.${phoneLine}`,
  };
  const SUBJECTS = {
    day1:  `Following up — ${client.name}`,
    day3:  `Circling back — ${client.name}`,
    day7:  `Still here when you're ready — ${client.name}`,
    day14: `One last note — ${client.name}`,
  };
  return { body: BODIES[stepId] || BODIES.day1, subject: SUBJECTS[stepId] || SUBJECTS.day1 };
};

const sendFollowUp = async (client, lead, due) => {
  const { body, subject } = buildFollowUp(client, lead, due.id);
  if (lead.phone) {
    try {
      await sendSMS({ to: lead.phone, body: body.slice(0, 320) });
    } catch (err) {
      console.error(`Follow-up SMS failed (${due.id}):`, err);
    }
  }
  if (lead.email) {
    try {
      await sendEmail({ to: lead.email, subject, html: leadEmailHTML(client, body), text: body });
    } catch (err) {
      console.error(`Follow-up email failed (${due.id}):`, err);
    }
  }
};

const processClient = async (supabaseAdmin, row) => {
  const client = row.data;
  // A demo client carries sample leads so the OS has something to render. Those leads
  // are invented, but this job does not care — it would text and email whatever contact
  // details they hold. Nothing outbound may ever fire for a demo account.
  if (client && client.demo) return { id: row.id, skipped: "demo client" };
  // Hand-off clients run their own follow-up after settle-in. Ours chasing their
  // leads would put BoldLine's name in front of a customer it no longer represents.
  if (handoffIsFinished(client)) return { id: row.id, skipped: "handed off" };
  const leadsLog = client.leadsLog || [];
  if (!leadsLog.length) return { id: row.id, skipped: "no leads" };

  let sentCount = 0;
  const nextLeads = [];
  for (const lead of leadsLog) {
    const due = findDueStep(lead);
    if (!due) {
      nextLeads.push(lead);
      continue;
    }
    await sendFollowUp(client, lead, due);
    nextLeads.push({ ...lead, followUps: [...(lead.followUps || []), { step: due.id, sentAt: new Date().toISOString() }] });
    sentCount++;
  }
  if (!sentCount) return { id: row.id, skipped: "nothing due" };

  const entry = {
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    note: `Sent ${sentCount} automated lead follow-up${sentCount === 1 ? "" : "s"}.`,
    cat: "update",
    ts: Date.now(),
  };
  const nextData = { ...client, leadsLog: nextLeads, commLog: [entry, ...(client.commLog || [])] };
  const { error } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) throw error;
  return { id: row.id, sent: sentCount, client: client.name };
};

export default async (req) => {
  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data");
  if (error) {
    console.error("Failed to load clients for lead follow-up:", error);
    return new Response("error loading clients", { status: 500 });
  }

  const testMode = new URL(req.url).searchParams.get("test") === "1";

  if (testMode) {
    let candidate = null;
    for (const row of data || []) {
      const client = row.data;
      if (client && client.demo) continue;   // same rule in test mode, so a demo lead is never the sample
      if (handoffIsFinished(client)) continue;
      const lead = (client.leadsLog || []).find((l) => findDueStep(l));
      if (lead) {
        candidate = { client, lead, due: findDueStep(lead) };
        break;
      }
    }
    if (!candidate) {
      const msg = `No lead is currently due for a follow-up to test with (need a lead with status "new" that's at least 1 day old).`;
      console.log(msg);
      return new Response(JSON.stringify({ ok: false, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const { client, lead, due } = candidate;
    const { body, subject } = buildFollowUp(client, lead, due.id);
    try {
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: `[TEST] ${subject}`,
        html: leadEmailHTML(client, `(Would go to ${lead.phone || lead.email || "no contact info on file"})\n\n${body}`),
        text: `(Would go to ${lead.phone || lead.email || "no contact info on file"})\n\n${body}`,
      });
    } catch (err) {
      console.error("Lead follow-up test failed:", err);
      return new Response(JSON.stringify({ ok: false, error: String((err && err.message) || err) }), { status: 500, headers: { "content-type": "application/json" } });
    }
    try {
      await sendSMS({ to: process.env.OWNER_PHONE, body: `[TEST] ${body}` });
    } catch (err) {
      console.error("Lead follow-up test SMS failed:", err);
    }
    const msg = `Test follow-up (${due.id}, "${client.name}") sent to ${process.env.OWNER_EMAIL} using a real lead. No lead was contacted, no data was changed.`;
    console.log(msg);
    return new Response(JSON.stringify({ ok: true, message: msg }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const results = await Promise.allSettled((data || []).map((row) => processClient(supabaseAdmin, row)));
  results.forEach((r, i) => {
    const id = data[i] && data[i].id;
    if (r.status === "rejected") console.error(`Client ${id} follow-up failed:`, r.reason);
    else console.log(`Client ${id}:`, r.value);
  });

  return new Response("ok", { status: 200 });
};
