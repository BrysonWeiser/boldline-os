// Build a new client's landing page and campaign for them, then ask Bryson to approve.
//
// Bryson, 2026-08-31: *"the whole point of the bots is for them to build the campaign
// landing page etc. without me having to do anything and then they send it to me for
// approval."* Every builder already existed. None of them started on their own, and
// `intakeComplete` was read only by the pipeline display and the health score. This is the
// missing trigger.
//
// 🔴 PREPARES ANYTHING, PUBLISHES NOTHING. The landing page is saved as a DRAFT and the
// campaign is created PAUSED, which is what `createCampaign` already does. Both raise an
// approval. The worst case of a bug here is work Bryson throws away, never an unapproved ad
// spending a client's money. That is the same inversion `ads-autopilot` is built on.
//
// ONE STEP PER CLIENT PER RUN. Each step is a model call or an ad-account write, so doing
// them one at a time means a failure in the second never leaves the first half-saved, and a
// broken client cannot burn the whole run's budget.
//
// Env: SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, Google Ads credentials.
//      CLIENT_AUTOBUILD=off -> kill switch, checked first, every run.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, loadAllClients } from "../lib/report-shared.mjs";
import { dispatchAlert } from "../lib/alerts-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";
import { nextStep, successPatch, failurePatch } from "../lib/autobuild-decide.mjs";
import landingHandler from "./generate-landing.mjs";
import { getAccessToken, createCampaign } from "./google-ads.mjs";
import { runTool, TOOL_FOR, MAX_TOKENS_FOR, systemFor, cleanGoogle, brief } from "../lib/ad-gen-shared.mjs";

// ── The outside edges, injected so the orchestration can be tested without a network ──
// Same shape as docusign-watch's runWatch, for the same reason: the decisions and the
// sequencing are where the bugs are, and neither needs a real model to exercise.
export async function runAutobuild({ loadClients, buildLanding, buildCampaign, saveClient, alert, now = () => new Date() }) {
  const clients = await loadClients();
  const out = { checked: 0, built: [], skipped: [], failed: [] };

  for (const row of clients || []) {
    const cl = (row && row.data) || {};
    const id = row && row.id;
    out.checked++;
    const { step, why } = nextStep(cl);
    if (!step) { out.skipped.push({ name: cl.name, why }); continue; }

    const at = now().toISOString();
    try {
      const patch = step === "landing" ? await buildLanding(cl) : await buildCampaign(cl);
      // 🔴 A BUILDER THAT RETURNS NOTHING MUST NOT COUNT AS A SUCCESS. Marking the step done
      // on an empty result would set the idempotency key and guarantee it never runs again,
      // which is the quietest possible way to never build a client's page.
      if (!patch || typeof patch !== "object") throw new Error(`${step} builder returned nothing`);
      // 🔴 THE OS BELL READS `pendingActions`, NOT the alert dispatcher. Bryson, 2026-08-31:
      // *"I got the email and phone notification which is good but I didnt get an alert in
      // the os which I want the alert as well"*. `dispatchAlert` is email, SMS and push;
      // the in-app bell, its count and the Notifications panel all come from this array on
      // the client record. Sending one without the other is a half-delivered notification.
      const actionId = `autobuild-${step}-${at.slice(0, 10)}`;
      const already = (cl.pendingActions || []).some((a) => a && a.id === actionId);
      const pending = already ? (cl.pendingActions || []) : [{
        id: actionId,
        title: step === "landing"
          ? `Review ${cl.name}'s landing page`
          : `Approve ${cl.name}'s campaign`,
        detail: step === "landing"
          ? "Written and saved as a draft. Read it on the Assets tab, then publish it when you are happy. Nothing is live yet."
          : "Built and paused. Read it on the Campaigns screen (More, then Campaigns), then approve it to make it live. Nothing is spending yet.",
        cat: step === "landing" ? "build" : "launch", ts: Date.now(),
      }, ...(cl.pendingActions || [])];

      await saveClient(id, { ...cl, ...patch, ...successPatch(step, cl, at), pendingActions: pending });
      out.built.push({ name: cl.name, step });
      await alert({
        title: step === "landing"
          ? `Landing page drafted for ${cl.name}`
          : `Campaign built for ${cl.name}`,
        body: step === "landing"
          ? `A landing page has been written for ${cl.name} and is waiting for you to read and publish it. Nothing is live yet.`
          : `A paused campaign has been built for ${cl.name}. Read it over and approve it to make it live. Nothing is spending yet.`,
        severity: "yellow",
      });
    } catch (e) {
      const msg = (e && e.message) || String(e);
      console.error(`client-autobuild: ${cl.name} ${step} failed:`, msg);
      out.failed.push({ name: cl.name, step, error: msg });
      // Record the failure so it is visible and so the attempt budget can stop the retries.
      try { await saveClient(id, { ...cl, ...failurePatch(cl, msg, at) }); } catch (_) { /* fail soft */ }
    }
  }
  return out;
}

// ── The real edges ────────────────────────────────────────────────────────────
const realLanding = async (cl) => {
  // Called directly rather than over HTTP: it is a plain handler with no auth, so building a
  // Request avoids a network hop and any site-URL configuration to get wrong.
  const res = await landingHandler(new Request("http://autobuild.local/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: cl.name, niche: cl.niche, campaignSetup: cl.campaignSetup,
      brandVoice: cl.brandVoice, mediaLibrary: cl.mediaLibrary, website: cl.website,
    }),
  }));
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.ok || !d.landingPage) throw new Error(d.error || `generate-landing returned ${res.status}`);
  // 🔴 published:false, ALWAYS. This job drafts; Bryson publishes.
  return { landingPage: { ...d.landingPage, published: false, generatedAt: new Date().toISOString() } };
};

const realCampaign = async (cl) => {
  const cs = cl.campaignSetup || {};
  const budget = Number(String(cl.adBudget || "").replace(/[^\d.]/g, "")) || 0;
  if (!(budget > 0)) throw new Error("no monthly ad budget on the client, so no daily budget can be set");
  const landing = cl.landingPage || {};
  const url = cs.landingDomain
    ? `https://${String(cs.landingDomain).replace(/^https?:\/\//, "")}`
    : `https://boldlinemedia.netlify.app/lp/${cl.landingSlug || ""}`;

  const { data } = await runTool({
    tool: TOOL_FOR.google, maxTokens: MAX_TOKENS_FOR.google, system: systemFor(!!cl.internal),
    prompt: `Write a Google Search campaign for this business.\n\n${brief(cl)}\n\n`
      + `Their landing page says: "${landing.headline || ""}" ${landing.subheadline || ""}\n\n`
      + `Build 3 tightly themed ad groups, each with its own keywords and its own ad.`,
  });
  const clean = cleanGoogle(data);
  if (!clean || !(clean.adGroups || []).length) throw new Error("the model returned no ad groups");

  const token = await getAccessToken();
  // Created PAUSED by createCampaign itself, and the existing approval path raises the
  // pendingAction + owner email from there.
  const built = await createCampaign(token, {
    customerId: cl.googleAdsCustomerId,
    landingUrl: url,
    dailyBudgetDollars: Math.max(1, budget / 30.4),
    name: `${cl.name} — Search`,
    adGroups: clean.adGroups,
    locations: cs.targetLocations,
    negatives: cs.excludedKeywords,
    // 🔴 "traffic" (Maximise Clicks), CHOSEN, and deliberately not "leads". Bryson,
    // 2026-09-02, on whether to move these off the old manual CPC: *"Do what you think
    // would be best"*.
    //
    // Manual CPC with nobody adjusting bids is the worst of the three. Google bids exactly
    // what it was told, forever, and learns nothing, so a campaign nobody is watching
    // slowly drifts out of the auction. These are built and left alone by definition.
    //
    // But NOT conversion bidding either, and this is the part that is easy to get wrong.
    // `maximizeConversions` needs conversion history to bid against. A brand new campaign
    // on a brand new account has none, so Google bids timidly, under-spends the budget and
    // takes far longer to learn anything. The right order is clicks first, conversions once
    // the account has real conversions in it, which is why the picker on the launch card
    // exists: this is the automatic starting point, and Bryson moves it when there is data.
    goal: "traffic",
  });
  return { campaigns: [...(Array.isArray(cl.campaigns) ? cl.campaigns : []), built] };
};

export default withFailureAlert("client-autobuild", async () => {
  if (String(process.env.CLIENT_AUTOBUILD || "").toLowerCase() === "off") {
    console.log("client-autobuild: kill switch on, doing nothing.");
    return new Response("off");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("client-autobuild aborted: SUPABASE_SERVICE_ROLE_KEY missing.");
    return new Response("missing key", { status: 500 });
  }
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const result = await runAutobuild({
    loadClients: () => loadAllClients(supabase, "client-autobuild"),
    buildLanding: realLanding,
    buildCampaign: realCampaign,
    saveClient: async (id, data) => {
      const { error } = await supabase.from("clients").update({ data }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    alert: dispatchAlert,
  });
  console.log("client-autobuild:", JSON.stringify(result));
  return new Response(JSON.stringify(result), { headers: { "content-type": "application/json" } });
});
