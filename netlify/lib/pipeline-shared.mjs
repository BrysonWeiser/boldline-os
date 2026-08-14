// Delivery-pipeline status, shared by the OS UI and every server-side job.
//
// The 20-bot pipeline used to be advanced entirely by hand — every writer of
// `botStatuses` was a creation default, a seed row, or a button in Edit → Pipeline.
// It now derives from facts the record actually carries (see KB
// pipeline-auto-advance). This module is the single definition of that derivation
// so a scheduled report can never quote a different number from the screen Bryson
// is looking at.
//
// ⚠ `index.html` carries a byte-identical copy of `MANUAL_BOTS`,
// `deriveBotStatuses` and `effectiveBotStatus` (the OS is a single static file with
// no bundler, so it cannot import this). The OS's own test suite asserts the two
// copies match character for character — if you edit one, edit both, or that test
// fails and tells you exactly which function drifted.

// Every package builds the same 20 steps in the same order; only the descriptions
// differ by tier, and those live in the UI. Server-side only the ids matter.
export const BOT_IDS = [
  "intake", "ceo", "research", "avatar", "offer", "funnel", "architect", "copy",
  "builder", "keywords", "ads", "tracking", "automation", "qc", "budget", "terms",
  "leads", "perf", "scaling", "success",
];

export const BOT_NAMES = {
  intake: "Client Intake", ceo: "CEO Director", research: "Market Research",
  avatar: "Customer Avatar", offer: "Offer Creation", funnel: "Funnel Director",
  architect: "Page Architect", copy: "Copy Chief", builder: "Page Builder",
  keywords: "Keyword Research", ads: "Ads Builder", tracking: "Tracking Engineer",
  automation: "Automation Engineer", qc: "Quality Control", budget: "Budget Manager",
  terms: "Search Term Analyst", leads: "Lead Quality Analyst", perf: "Performance Analyst",
  scaling: "Scaling Specialist", success: "Client Success",
};

// ─── COPY BELOW MUST MATCH index.html EXACTLY ────────────────────────────────
const MANUAL_BOTS = ["research", "avatar", "funnel", "scaling", "success"];

const monthlyBudgetNum = (cl) => Number(String((cl && cl.adBudget) || "").replace(/[^0-9.]/g, "")) || 0;

const deriveBotStatuses = (cl) => {
  if (!cl) return {};
  const cs   = cl.campaignSetup || {};
  const lp   = cl.landingPage || {};
  const perf = cl.adPerf || {};                      // written by the scheduled ads-sync job
  const camps = Array.isArray(perf.campaigns) ? perf.campaigns : [];
  const anyCampaign = camps.length > 0;
  const anyLive     = camps.some((c) => c && (c.live || String(c.status || "").toUpperCase() === "ENABLED" || String(c.effectiveStatus || "").toUpperCase() === "ACTIVE"));
  const spend       = Number(perf.spend30 || perf.spend || 0);
  const convs       = camps.reduce((n, c) => n + Number((c && c.conversions) || 0), 0);
  const linked      = !!(cl.googleAdsCustomerId || cl.metaAdAccountId);
  const leads       = Number(cl.leads || 0);
  const s = (status, why) => ({ status, why });

  const out = {
    intake:    cl.intakeComplete ? s("done", "Intake marked complete")
               : (cs.mainOffer || cs.serviceArea || cs.targetLocations) ? s("active", "Campaign details partly filled in")
               : s("waiting", "No intake details yet"),
    ceo:       cl.intakeComplete ? s("done", "Brief is complete, so the plan is set")
               : s("waiting", "Waiting on a complete intake"),
    offer:     cs.mainOffer ? s("done", `Main offer set: ${cs.mainOffer}`)
               : s("waiting", "No main offer set"),
    architect: lp.headline ? s("done", "Landing page structure exists")
               : s("waiting", "No landing page started"),
    copy:      (lp.subheadline && (lp.bullets || []).length) ? s("done", "Landing page copy written")
               : lp.headline ? s("active", "Headline written, rest of the copy pending")
               : s("waiting", "No copy yet"),
    builder:   lp.published ? s("done", "Landing page is published")
               : lp.headline ? s("active", "Page drafted, not published")
               : s("waiting", "Nothing to build yet"),
    keywords:  anyCampaign ? s("done", "Keywords shipped with the built campaign")
               : s("waiting", "No campaign built yet"),
    ads:       anyLive ? s("done", "Campaign is live")
               : anyCampaign ? s("active", "Campaign built, awaiting launch")
               : s("waiting", "No campaign built yet"),
    tracking:  convs > 0 ? s("done", "Conversions are being recorded")
               : linked ? s("active", "Ad account linked, no conversion recorded yet")
               : s("waiting", "No ad account linked"),
    automation: cl.leadToken ? s("done", "Lead capture and auto-reply are live")
               : s("waiting", "No lead pipeline yet"),
    qc:        anyLive ? s("done", "Signed off and live")
               : anyCampaign ? s("active", "Built and paused, awaiting sign-off")
               : s("waiting", "Nothing to check yet"),
    budget:    (anyLive && monthlyBudgetNum(cl) > 0) ? s("active", "Watching spend against the monthly budget")
               : monthlyBudgetNum(cl) > 0 ? s("waiting", "Budget set, nothing running yet")
               : s("waiting", "No monthly budget set"),
    terms:     spend > 0 ? s("active", "Reviewing search terms as clicks come in")
               : s("waiting", "No spend to review yet"),
    leads:     leads > 0 ? s("active", `Scoring ${leads} lead${leads === 1 ? "" : "s"}`)
               : s("waiting", "No leads yet"),
    perf:      spend > 0 ? s("active", "Reporting on live campaign data")
               : s("waiting", "No campaign data yet"),
  };
  for (const id of MANUAL_BOTS) delete out[id];
  return out;
};

const effectiveBotStatus = (cl, botId, derived) => {
  const manual = (cl && cl.botStatusManual) || {};
  const stored = (cl && cl.botStatuses) || {};
  if (manual[botId]) return { status: stored[botId] || "waiting", why: "Set by hand", manual: true };
  const d = (derived || {})[botId];
  if (d) return { status: d.status, why: d.why, auto: true };
  return { status: stored[botId] || "waiting", why: "Tracked by hand (no automatic signal for this step)", manual: true };
};
// ─── END OF THE MIRRORED BLOCK ───────────────────────────────────────────────

export { MANUAL_BOTS, deriveBotStatuses, effectiveBotStatus };

// One call for every server-side consumer: the effective status of all 20 steps
// plus the counts reports quote. `pending` names the steps in human words rather
// than bot ids, because it gets read aloud on client calls.
export function pipelineProgress(client) {
  const derived = deriveBotStatuses(client);
  const steps = BOT_IDS.map((id) => {
    const e = effectiveBotStatus(client, id, derived);
    return { id, name: BOT_NAMES[id] || id, status: e.status, why: e.why, auto: !!e.auto };
  });
  const done = steps.filter((s) => s.status === "done");
  return {
    steps,
    done: done.length,
    total: steps.length,
    active: steps.filter((s) => s.status === "active").length,
    pending: steps.filter((s) => s.status !== "done").map((s) => s.name),
    fraction: steps.length ? done.length / steps.length : 0,
  };
}
