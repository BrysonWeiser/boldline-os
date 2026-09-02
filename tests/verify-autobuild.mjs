// The bot that builds a new client's page and campaign, and asks Bryson to approve.
//
// Bryson, 2026-08-31: *"the whole point of the bots is for them to build the campaign
// landing page etc. without me having to do anything and then they send it to me for
// approval."* Before this, nothing did. Every builder waited for a button and
// `intakeComplete` was read only by a status display.
//
// 🔴 WHAT THIS SUITE IS REALLY GUARDING. This is the first job allowed to spend money on
// model calls and write to a client's ad account off a schedule, with nobody watching. So
// the tests that matter are the ones about NOT acting: not building twice, not building
// before the agreement is signed, not looping forever on a client it can never finish, and
// never publishing anything. A bug that builds nothing is an annoyance. A bug that builds
// repeatedly, or publishes, costs real money on someone else's card.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nextStep, readiness, successPatch, failurePatch, MAX_ATTEMPTS } from "../netlify/lib/autobuild-decide.mjs";
import { runAutobuild } from "../netlify/functions/client-autobuild.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// A client with everything the job needs and nothing built yet.
const READY = {
  name: "Stencil & Thread", contractSigned: true, googleAdsCustomerId: "123-456-7890",
  adBudget: "$500/mo", landingSlug: "stencil",
  campaignSetup: { mainOffer: "Custom screen printed apparel", targetLocations: "Lane County, Oregon" },
  landingPage: {}, campaigns: [], autoBuild: {},
};

// ── 1. Who is ready, and every reason someone is not ─────────────────────────
{
  eq("a ready client's first step is the landing page", nextStep(READY).step, "landing");

  // 🔴 Each of these is a way a bot could act when it must not. They are asserted one at a
  // time, because a gate that only works when combined with another gate is not a gate.
  const not = (patch, label) => {
    const r = nextStep({ ...READY, ...patch });
    ok(`does not build ${label}`, r.step === null, `got step ${r.step}`);
    ok(`  and says why: ${label}`, !!r.why && r.why.length > 8, JSON.stringify(r.why));
  };
  not({ contractSigned: false }, "before the agreement is signed");
  not({ internal: true }, "for the house account");
  not({ autoBuild: { off: true } }, "when switched off for that client");
  not({ campaignSetup: { targetLocations: "Lane County" } }, "with no main offer");
  not({ campaignSetup: { mainOffer: "Shirts" } }, "with no target location");
  not({ autoBuild: { attempts: MAX_ATTEMPTS } }, "after too many failures");

  // The reason has to be useful, not just present: a client sitting untouched with no
  // explanation is the exact complaint that produced the pipeline-honesty work.
  ok("the unsigned reason names the agreement",
    /agreement/i.test(nextStep({ ...READY, contractSigned: false }).why));
  ok("the no-offer reason says there is nothing to write from",
    /nothing to write from/i.test(nextStep({ ...READY, campaignSetup: {} }).why));
}

// ── 2. 🔴 IDEMPOTENCY. The single most expensive way this could go wrong ─────
{
  const afterLanding = { ...READY, landingPage: { headline: "Bulk shirts, fast" }, autoBuild: { landingAt: "t" } };
  eq("once a page exists the next step is the campaign", nextStep(afterLanding).step, "campaign");

  eq("a built page is never regenerated",
    nextStep({ ...afterLanding, autoBuild: { landingAt: "t" } }).step, "campaign");

  // 🔴 EVEN IF BRYSON DELETES THE COPY. The timestamp is the key, not the presence of a
  // headline, because a bot quietly rewriting his edits is worse than doing nothing.
  eq("and not even if the copy is later cleared",
    nextStep({ ...READY, landingPage: {}, autoBuild: { landingAt: "t" } }).step, null);

  const afterBoth = { ...afterLanding, campaigns: [{ id: 1 }], autoBuild: { landingAt: "t", campaignAt: "t" } };
  eq("a client with both built is left alone", nextStep(afterBoth).step, null);
  ok("and says so plainly", /has been built/i.test(nextStep(afterBoth).why));

  // A campaign that exists but was built by hand still counts.
  eq("a hand-built campaign stops the bot too",
    nextStep({ ...afterLanding, campaigns: [{ id: 9 }] }).step, null);
}

// ── 3. The campaign waits for the ad account, and says so ───────────────────
{
  const noAccount = { ...READY, googleAdsCustomerId: "", landingPage: { headline: "H" }, autoBuild: { landingAt: "t" } };
  eq("no campaign without a linked ad account", nextStep(noAccount).step, null);
  ok("and the reason names it", /Google Ads account/i.test(nextStep(noAccount).why), nextStep(noAccount).why);
}

// ── 4. The patches ───────────────────────────────────────────────────────────
{
  const p = successPatch("landing", { autoBuild: { attempts: 2, error: "boom" } }, "2026-08-31T00:00:00Z");
  eq("success stamps the step", p.autoBuild.landingAt, "2026-08-31T00:00:00Z");
  eq("and clears the attempt count", p.autoBuild.attempts, 0);
  ok("and clears the last error", !("error" in p.autoBuild));

  const f = failurePatch({ autoBuild: { attempts: 1 } }, "the model returned no ad groups", "t");
  eq("a failure counts", f.autoBuild.attempts, 2);
  ok("and records why", /no ad groups/.test(f.autoBuild.error));
}

// ── 5. 🔴 THE ORCHESTRATION, WITH THE OUTSIDE EDGES REPLACED ─────────────────
const runWith = async (clients, over = {}) => {
  const saved = [], alerts = [], calls = [];
  const res = await runAutobuild({
    loadClients: async () => clients,
    buildLanding: async (cl) => { calls.push(["landing", cl.name]); return { landingPage: { headline: "H", published: false } }; },
    buildCampaign: async (cl) => { calls.push(["campaign", cl.name]); return { campaigns: [{ id: "c1" }] }; },
    saveClient: async (id, data) => { saved.push({ id, data }); },
    alert: async (a) => { alerts.push(a); },
    now: () => new Date("2026-08-31T12:00:00Z"),
    ...over,
  });
  return { res, saved, alerts, calls };
};

{
  const { res, saved, alerts, calls } = await runWith([{ id: "1", data: READY }]);
  eq("one ready client is built", res.built.length, 1);
  eq("and only the landing page this run", calls.length, 1);
  eq("the step was the landing page", calls[0][0], "landing");
  eq("the client was saved once", saved.length, 1);
  eq("the stamp was written", saved[0].data.autoBuild.landingAt, "2026-08-31T12:00:00.000Z");

  // 🔴 THE DRAFT RULE. This job prepares; Bryson publishes.
  eq("🔴 the page is saved UNPUBLISHED", saved[0].data.landingPage.published, false);

  eq("Bryson is told", alerts.length, 1);
  ok("and the alert says nothing is live", /Nothing is live yet/i.test(alerts[0].body), alerts[0].body);
  ok("and names the client", /Stencil & Thread/.test(alerts[0].title));
}

{
  // Running again must do the SECOND step, not repeat the first.
  const after = { ...READY, landingPage: { headline: "H" }, autoBuild: { landingAt: "t" } };
  const { calls, alerts } = await runWith([{ id: "1", data: after }]);
  eq("the second run builds the campaign", calls[0][0], "campaign");
  ok("and the alert says nothing is spending", /nothing is spending/i.test(alerts[0].body), alerts[0].body);
}

{
  // 🔴 A BUILDER THAT SILENTLY RETURNS NOTHING MUST NOT COUNT AS DONE. Stamping the step on
  // an empty result sets the idempotency key and guarantees the client is never built —
  // the quietest possible failure.
  const { res, saved } = await runWith([{ id: "1", data: READY }], { buildLanding: async () => null });
  eq("an empty result is a failure", res.failed.length, 1);
  eq("nothing was marked built", res.built.length, 0);
  ok("the step was NOT stamped", !saved[0].data.autoBuild.landingAt, JSON.stringify(saved[0].data.autoBuild));
  eq("and the attempt was counted", saved[0].data.autoBuild.attempts, 1);
}

{
  // A thrown builder is recorded, counted, and does not stop the rest of the run.
  const clients = [
    { id: "1", data: { ...READY, name: "Breaks" } },
    { id: "2", data: { ...READY, name: "Fine" } },
  ];
  let n = 0;
  const { res } = await runWith(clients, {
    buildLanding: async (cl) => { if (cl.name === "Breaks") throw new Error("model timed out"); n++; return { landingPage: { headline: "H" } }; },
  });
  eq("the broken client is recorded as failed", res.failed.length, 1);
  ok("with the reason", /model timed out/.test(res.failed[0].error));
  eq("🔴 and the next client is still built", res.built.length, 1);
  eq("the good builder really ran", n, 1);
}

{
  // Skips are reported with their reason rather than vanishing.
  const { res } = await runWith([{ id: "1", data: { ...READY, contractSigned: false } }]);
  eq("nothing built", res.built.length, 0);
  eq("one skip reported", res.skipped.length, 1);
  ok("with a readable reason", /agreement/i.test(res.skipped[0].why));
}

// ── 🔴 6. THE OS BELL, NOT JUST THE EMAIL ────────────────────────────────────
//
// Bryson, 2026-08-31, after the first automatic build: *"I got the email and phone
// notification which is good but I didnt get an alert in the os which I want the alert as
// well"*. `dispatchAlert` is email, SMS and push. The in-app bell, its count and the
// Notifications panel all read `pendingActions` on the CLIENT RECORD. Writing one without
// the other is a half-delivered notification, and the half that goes missing is the one he
// is looking at while he works.
{
  const { saved, alerts } = await runWith([{ id: "1", data: READY }]);
  const pa = saved[0].data.pendingActions || [];
  eq("🔴 a pendingAction is written so the OS bell fires", pa.length, 1);
  ok("it names the client and the job", /Review Stencil & Thread's landing page/.test(pa[0].title), pa[0].title);
  ok("and says nothing is live yet", /Nothing is live yet/i.test(pa[0].detail), pa[0].detail);
  ok("it carries a category the panel can group on", !!pa[0].cat);
  ok("and a timestamp", !!pa[0].ts);
  eq("the email and push still go too", alerts.length, 1);

  // 🔴 Not duplicated on a re-run. An hourly job that stacks a fresh bell entry every hour
  // turns the notification panel into noise, which is the fastest way to make him stop
  // reading it.
  const withAction = { ...READY, pendingActions: pa };
  const second = await runWith([{ id: "1", data: withAction }]);
  const pa2 = second.saved[0].data.pendingActions || [];
  eq("a repeat run does not stack a second copy", pa2.length, 1);

  // An existing unrelated action must survive.
  const withOther = { ...READY, pendingActions: [{ id: "other", title: "Something else", ts: 1 }] };
  const third = await runWith([{ id: "1", data: withOther }]);
  const pa3 = third.saved[0].data.pendingActions || [];
  eq("an unrelated pending action is kept", pa3.length, 2);
  ok("and the new one is on top", /landing page/.test(pa3[0].title));
}

// ── 🔴 7. THE PAGE IS REBUILT WHEN THE CLIENT'S ASSETS CHANGE ────────────────
//
// Bryson: *"once he puts in the assets he wants to use will the landing page automatically
// be recreated"*. A page written before the client uploaded anything picks no hero, takes no
// brand colour from their photos and shows no gallery. It is a generic page until it is
// rebuilt from their actual work.
{
  const built = { ...READY, landingPage: { headline: "H" }, autoBuild: { landingAt: "t", landingMediaKey: "" } };
  eq("with no assets it moves on to the campaign", nextStep(built).step, "campaign");

  const added = { ...built, mediaLibrary: [{ path: "a.jpg" }, { path: "b.jpg" }] };
  eq("🔴 adding assets rebuilds the page", nextStep(added).step, "landing");

  const recorded = { ...added, autoBuild: { landingAt: "t", landingMediaKey: "a.jpg|b.jpg" } };
  eq("and once rebuilt it stops", nextStep(recorded).step, "campaign");

  // 🔴 The count is not the key. Swapping one photo for another leaves it identical and is
  // exactly the change worth catching.
  eq("swapping one photo for another still rebuilds",
    nextStep({ ...recorded, mediaLibrary: [{ path: "a.jpg" }, { path: "c.jpg" }] }).step, "landing");

  // And the order files come back in must not cause a pointless rebuild every hour.
  eq("the same assets in a different order do not",
    nextStep({ ...recorded, mediaLibrary: [{ path: "b.jpg" }, { path: "a.jpg" }] }).step, "campaign");

  // Deleting everything must not throw away a working page.
  eq("deleting every asset does not rebuild",
    nextStep({ ...recorded, mediaLibrary: [] }).step, "campaign");

  // The key is only stamped by the landing step, so the rebuild fires on the NEXT change.
  const p = successPatch("landing", { mediaLibrary: [{ path: "z.jpg" }] }, "t");
  eq("the landing step records which assets it used", p.autoBuild.landingMediaKey, "z.jpg");

// ── 🔴 A PUBLISHED PAGE IS OFF LIMITS TO THE REBUILD ────────────────────────────
// Bryson, 2026-09-02: *"make sure the os isn't continuously pumping out landing pages
// and sending for approval, I just got another one for approval when we already
// published one, I'm not sure if it's because images got added tho"*. It was exactly
// that, and the extra approval email was the least of it.
//
// The builder returns `published: false` by design. So on a LIVE page the media rebuild
// did not just redraft: it replaced his published copy with a draft, took the page
// offline, invalidated the approval the client had already given, and would have left a
// running ad pointing at the coming-soon placeholder while still being paid for.
//
// Both halves are asserted, because either one alone would let this back in: the rebuild
// must still fire before publish (or new photos never reach a page that needs them), and
// must never fire after (or a bot unpublishes a client's live page).
{
  const withPhotos = { ...READY, mediaLibrary: [{ path: "new.jpg" }],
    autoBuild: { landingAt: "t", landingMediaKey: "old.jpg" } };

  const draft = nextStep({ ...withPhotos, landingPage: { headline: "H", published: false } });
  eq("new assets still redraft a page that has NOT been published", draft.step, "landing");

  const live = nextStep({ ...withPhotos, landingPage: { headline: "H", published: true } });
  eq("🔴 new assets never rebuild a page that IS published", live.step, null);
  ok("and it says why, rather than going quiet", /already published/i.test(live.why), live.why);

  // The signal is not swallowed: the reason names the button that does the job on purpose.
  ok("it points at the manual way to do it", /regenerate/i.test(live.why), live.why);

  // 🔴 The guard must be the PUBLISHED flag, not the presence of a headline. A drafted page
  // has a headline too, and gating on that would switch the rebuild off for everyone.
  const drafted = nextStep({ ...withPhotos, landingPage: { headline: "H" } });
  eq("a page with a headline but no publish still redrafts", drafted.step, "landing");
}


  const c = successPatch("campaign", { mediaLibrary: [{ path: "z.jpg" }] }, "t");
  ok("the campaign step does not touch that key", !("landingMediaKey" in c.autoBuild));
}

// ── 8. The safety properties, asserted against the real source ──────────────
{
  const src = readFileSync(join(ROOT, "netlify/functions/client-autobuild.mjs"), "utf8");
  const body = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  ok("🔴 the landing page is always saved unpublished",
    /published: false/.test(body),
    "publishing without Bryson reading it is the one thing this job must never do");
  ok("there is a kill switch", /CLIENT_AUTOBUILD/.test(body));
  // 🔴 Measured INSIDE the handler. The first version compared against `loadAllClients`,
  // which also appears in the import line at the top of the file, so it was comparing the
  // switch against an import and would have passed no matter where the check sat.
  const handler = body.slice(body.indexOf("export default withFailureAlert"));
  ok("and it is checked before anything else happens",
    handler.indexOf("CLIENT_AUTOBUILD") < handler.indexOf("SUPABASE_SERVICE_ROLE_KEY"),
    "a kill switch checked after the work has started is not a kill switch");
  ok("and it returns before loading any clients",
    handler.indexOf("CLIENT_AUTOBUILD") < handler.indexOf("runAutobuild"));
  ok("it never enables or unpauses anything",
    !/status:\s*['\"]ENABLED|unpause|setLive/i.test(body),
    "createCampaign creates paused, and this job must leave it that way");
  ok("every client is wrapped so one failure cannot end the run", /catch \(e\)/.test(body));
  ok("the job is scheduled, not something Bryson has to trigger",
    /client-autobuild/.test(readFileSync(join(ROOT, "netlify.toml"), "utf8")),
    "an automatic build that needs a button press is the thing this replaces");
}

console.log(`verify-autobuild: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
