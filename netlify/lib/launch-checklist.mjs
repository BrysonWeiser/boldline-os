// The eleven steps between "they said yes" and "the ads are running", derived from the
// client record rather than ticked off by hand.
//
// Bryson, 2026-08-25, before his first launch: he wanted one list of what is automated,
// what he does, and what the client owes him. This is that list, living on the account and
// answering from real data.
//
// 🔴 EVERY STEP'S STATE IS OBSERVED, NEVER STORED. This is the same rule that fixed the
// pipeline panels (KB `house-pipeline-honesty`): a hand-ticked checkbox drifts from reality
// the moment anything changes underneath it, and a checklist that lies is worse than no
// checklist, because it is trusted. So a step is done when the thing it describes is
// actually true on the record.
//
// The one exception is the two steps nothing in the OS can see: whether the contract came
// back signed, and whether the client's developer added the DNS record. Those carry a
// stored flag AND say plainly that they are hand-tracked, so nobody mistakes a tick for an
// observation.

const has = (v) => !!String(v == null ? "" : v).trim();

// Who has to move for a step to complete. This is the column Bryson actually reads: it
// separates "I am blocked on me" from "I am waiting on someone else", and the second kind
// needs chasing rather than doing.
export const OWNERS = { you: "You", client: "The client", dev: "Their web person", os: "Automatic" };

export function launchChecklist(client) {
  const c = client || {};
  const cs = c.campaignSetup || {};
  const ca = c.conversionActions || {};
  const lp = c.landingPage || {};
  const camps = Array.isArray(c.campaigns) ? c.campaigns : [];
  const liveCount = Number(((c.adPerf || {}).totals || {}).liveCampaigns || 0);

  const steps = [
    {
      id: "signed",
      // 🔴 THE OWNER FLIPS ONCE IT IS SENT, AND THAT IS THE WHOLE POINT OF THIS STEP.
      // Before an envelope exists, the person who has to move is Bryson. After it is sent,
      // he is waiting on the client, which puts this in `waitingOnThem` where the things
      // that need chasing live. Observed from the envelope id, never stored, same rule as
      // every other step here.
      //
      // This step used to be `manual: true` and told him to email a PDF and take acceptance
      // by reply. That was true the day it was written and stopped being true two days
      // later when the DocuSign watcher shipped (KB `docusign-signature-watch`): a job now
      // polls the envelope every 15 minutes, sets `contractSigned` itself, alerts him and
      // emails the client. Caught on the morning his first real client signed, after four
      // days of an unsigned contract that this list was calling his job to chase by email.
      owner: has(c.docusignEnvelopeId) ? "client" : "you",
      label: "Agreement signed",
      done: !!c.contractSigned,
      next: has(c.docusignEnvelopeId)
        ? "Sent and waiting on their signature. The OS checks every fifteen minutes and ticks this itself, so there is nothing to mark off by hand."
        : "Build it on the Contract tab and send it for signature.",
    },
    // 🔴 THIS WAS ONE STEP DOING TWO PEOPLE'S JOBS. Bryson, 2026-09-02: *"the cost per lead
    // is 50 which is in the contract so that's done but he needs to connect his card still."*
    // "Billing set up" was owned by HIM and ticked off a Stripe id, so it sat unticked and
    // told him to go and do something when the only outstanding half belonged to the client.
    // A checklist that hands him a job that is not his is worse than no checklist: it is a
    // to-do he cannot clear, sitting above the one he can.
    //
    // Split by OWNER, which is what the whole file is organised around. Setting the rates is
    // his and takes a minute. Putting a card on file is the client's and is a chase, so it
    // belongs in the "waiting on them" bucket the banner reads from, not in his pile.
    {
      id: "rates", owner: "you", label: "Their rates set",
      done: c.billingMonthly != null && c.billingPerLead != null,
      next: "Set the monthly minimum and the per-lead rate on the Billing card. If they are in the signed agreement already, copy them across so the OS bills the same numbers.",
    },
    {
      // 🔴 Subscription, not customer. A Stripe CUSTOMER exists the moment a record is made
      // and proves nothing about a card, so the old `|| stripeCustomerId` would tick this
      // while there was still no way to charge them.
      id: "card", owner: "client", label: "Their card on file",
      done: has(c.stripeSubscriptionId),
      next: "Send them the payment link from the Billing card. They enter their own card, and the subscription starts the moment they do.",
    },
    {
      id: "adaccount", owner: "client", label: "Their ad account linked",
      done: has(c.googleAdsCustomerId) || has(c.metaAdAccountId),
      next: "They open Google Ads in their own name on their own card, accept your manager invite, then you paste the customer ID into Edit and Campaign.",
    },
    {
      id: "details", owner: "you", label: "Campaign details filled in",
      // The fields every ad and page the OS writes is built from. Without the offer there
      // is nothing to write from, and without a margin the scorecard cannot show profit.
      done: has(cs.mainOffer) && has(cs.targetLocations),
      next: "Edit, then Campaign. Where they are based, where the ads run, the main offer, average job value and profit margin.",
    },
    {
      id: "tracking", owner: "you", label: "Conversion tracking created",
      // Observed from the record the setup writes, so a half-finished run reads as not done.
      done: has(c.conversionId) && !!(ca.form && ca.form.label) && !!(ca.qualified && ca.qualified.resourceName),
      next: "Press Set this up in the ad account on the Campaigns screen (More, then Campaigns). One button.",
      why: "Until this exists the campaign is bidding blind, so it comes before anything goes live.",
    },
    {
      id: "domain", owner: "dev", label: "Their subdomain pointed at us",
      done: has(cs.landingDomain),
      manual: true,
      next: "Their web person adds one DNS record, then you add that hostname in Netlify so the certificate is issued.",
      why: "Google shows the address the ad points to, so the ad has to display their domain and not ours.",
    },
    {
      id: "crm", owner: "dev", label: "Leads forwarded to their system",
      done: has(cs.crmWebhook),
      // Genuinely optional: plenty of businesses have no CRM, and the OS is a perfectly
      // good home for their leads. Marked so it never blocks a launch.
      optional: true,
      next: "Ask their developer for the endpoint and the field names it expects. Skip it if they have no CRM.",
    },
    {
      // 🔴 BLANK IS NOT AN ANSWER HERE, WHICH IS WHY THIS STEP EXISTS. Blank means "we send
      // it", and we cannot: our own texting is not registered with the phone companies yet.
      // So a client left on the default gets NO first text and nothing anywhere says so.
      // Requiring an explicit value forces the decision once per client. Optional, so it
      // never blocks a launch. Kept identical to the copy in index.html.
      id: "textback", owner: "you", label: "Who texts the lead first",
      done: has(cs.smsSender),
      optional: true,
      next: "Edit, then Campaign, under Who texts the lead first. Type their if the client's own system sends it. Leaving it with us needs our texting registered with the phone companies first, which is not done yet.",
      why: "Two systems both texting a new lead is invisible when it goes wrong, and neither one texting costs the fastest follow-up there is.",
    },
    {
      id: "research", owner: "you", label: "Keywords and negatives researched",
      done: has(cs.keywordNotes) || has(cs.excludedKeywords),
      next: "The searches to buy and the ones to block. Start from their trade playbook, then add what this client teaches you.",
      why: "The highest-value hour on a new account, and the one thing worth keeping by hand.",
    },
    {
      id: "page", owner: "you", label: "Landing page built",
      done: !!(lp.published && lp.headline),
      next: "Generate it on the Assets tab, read it, then publish.",
    },
    {
      id: "campaign", owner: "you", label: "Campaign built",
      done: camps.length > 0,
      next: "Build it from the Campaigns tab. It is created paused, so nothing spends yet.",
    },
    {
      id: "live", owner: "you", label: "Approved and live",
      done: liveCount > 0,
      next: "Approve it in Alerts or on the campaign card. This is the moment money starts moving.",
      why: "Nothing ever spends without this press, on any account.",
    },
  ];

  // 🔴 "NEXT" IS THE FIRST INCOMPLETE STEP THAT IS NOT OPTIONAL. A checklist that just
  // shows eleven boxes makes you scan for the gap yourself; naming one thing is what makes
  // it useful at seven in the morning.
  const blocking = steps.filter((s) => !s.done && !s.optional);
  const next = blocking[0] || null;
  const required = steps.filter((s) => !s.optional);

  return {
    steps,
    next,
    done: required.filter((s) => s.done).length,
    total: required.length,
    // Rounded down, so 10 of 11 never reads as 100% finished.
    percent: required.length ? Math.floor((required.filter((s) => s.done).length / required.length) * 100) : 0,
    ready: blocking.length === 0,
    // Split by who has to move, because waiting on someone else needs chasing rather than
    // doing, and the two get confused when they sit in one list.
    waitingOnThem: blocking.filter((s) => s.owner === "client" || s.owner === "dev"),
  };
}
