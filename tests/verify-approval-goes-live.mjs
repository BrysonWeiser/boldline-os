// Approving something makes it go live.
//
// Bryson, 2026-09-02: *"Once something is approved by whichever party needs to approve it
// the thing should instantly go live"*.
//
// 🔴 THIS WAS NOT A MISSING FEATURE, IT WAS THE PRODUCT SAYING SOMETHING UNTRUE. The
// campaign approval card in the client portal reads, in writing: "Approve to launch, or
// request changes and we'll adjust before anything spends." A client pressing Approve had
// every reason to believe their ads were now running. What actually happened was that a
// decision was recorded, Bryson got an email, and nothing ran until he went and pressed a
// second button himself, possibly hours later.
//
// The suite runs the REAL block lifted out of portal.mjs. The only thing rewritten is the
// dynamic `import(...)` specifier, swapped for an injected loader so the platform modules
// can be stubbed. Nothing else is restated, because a restated rule is a second
// implementation that agrees with the first only until one of them changes.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };
const at = async (name, fn) => { await fn(); n++; };

// ── Lift the real block ────────────────────────────────────────────────────────
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const runGoLive = (() => {
  const from = P.indexOf("        const goLive = [];");
  const to = P.indexOf("const { error: apErr } = await supabaseAdmin", from);
  assert.ok(from > 0 && to > from, "the go-live block is gone from portal.mjs");
  const src = P.slice(from, to)
    .replace(/await import\(/g, "await LOAD(")
    .replace(/console\.error\(/g, "LOG(");
  return new AsyncFunction("list", "body", "decision", "apData", "LOAD", "LOG",
    `${src}\nreturn { goLive, apData };`);
})();

const ok = () => {};
const stub = (calls, fail) => async (spec) => {
  if (String(spec).includes("meta-ads")) {
    return { activateCampaign: async (id) => { calls.push(["meta", String(id)]); if (fail) throw new Error("meta said no"); } };
  }
  return {
    getAccessToken: async () => "tok",
    activateCampaign: async (tok, cid, rn, id) => { calls.push(["google", String(id), rn]); if (fail) throw new Error("google said no"); },
  };
};

const run = async ({ approval, client = {}, decision = "approved", fail = false }) => {
  const calls = [];
  const out = await runGoLive([approval], { approval: { id: approval.id } }, decision,
    { ...client }, stub(calls, fail), ok);
  return { ...out, calls };
};

// ── Landing pages ──────────────────────────────────────────────────────────────
await at("approving a landing page publishes it", async () => {
  const r = await run({ approval: { id: "a1", kind: "landing_page" },
    client: { landingPage: { headline: "H", published: false } } });
  assert.equal(r.apData.landingPage.published, true, "the page was approved and is still not live");
  assert.equal(r.apData.landingPage.headline, "H", "publishing threw away the rest of the page");
  assert.equal(r.goLive.length, 1);
});

await at("🔴 requesting changes publishes nothing", async () => {
  const r = await run({ approval: { id: "a1", kind: "landing_page" },
    client: { landingPage: { published: false } }, decision: "changes" });
  assert.notEqual(r.apData.landingPage.published, true, "asking for changes put the page live");
  assert.equal(r.goLive.length, 0);
});

await at("a page with no landingPage yet does not crash", async () => {
  const r = await run({ approval: { id: "a1", kind: "landing_page" }, client: {} });
  assert.equal(r.apData.landingPage.published, true);
});

// ── Campaigns ──────────────────────────────────────────────────────────────────
await at("approving a Meta campaign starts it on Meta", async () => {
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "123", platform: "meta" } });
  assert.deepEqual(r.calls, [["meta", "123"]]);
  assert.match(r.goLive.join(" "), /live and spending/);
});

await at("approving a Google campaign starts it on Google, with a resource name it can use", async () => {
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "987", platform: "google" },
    client: { googleAdsCustomerId: "123-456-7890" } });
  assert.equal(r.calls.length, 1);
  const [platform, id, rn] = r.calls[0];
  assert.equal(platform, "google");
  assert.equal(id, "987");
  // 🔴 Google's activateCampaign REQUIRES a resource name and throws without one. The dashes
  // in the stored customer id have to be gone or the path is not a real resource.
  assert.equal(rn, "customers/1234567890/campaigns/987", `bad resource name: ${rn}`);
});

await at("🔴 the platform falls back to the owner's queued action", async () => {
  // Approvals created before this change carry no platform. Without the fallback any such
  // approval would refuse to launch, and the client would press Approve to no effect.
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "555" },
    client: { pendingActions: [{ exec: { campaignId: "555", platform: "meta" } }] } });
  assert.deepEqual(r.calls, [["meta", "555"]]);
});

await at("with no platform anywhere it refuses rather than guessing", async () => {
  // 🔴 Guessing would start a campaign on the wrong account, which spends somebody else's
  // money. Refusing is loud and costs nothing.
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "555" } });
  assert.equal(r.calls.length, 0, "it picked a platform out of thin air");
  assert.match(r.goLive.join(" "), /COULD NOT START/);
});

await at("a Google campaign with no customer id refuses instead of building a broken path", async () => {
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "9", platform: "google" } });
  assert.equal(r.calls.length, 0);
  assert.match(r.goLive.join(" "), /COULD NOT START/);
});

// ── 🔴 FAILURE IS CONTAINED, AND LOUD ──────────────────────────────────────────
await at("a failed launch still records the approval", async () => {
  // Losing a client's approval because Google had a bad minute would make them approve
  // twice and trust the portal less. The decision is saved either way.
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "1", platform: "meta" }, fail: true });
  assert.match(r.goLive.join(" "), /COULD NOT START THE CAMPAIGN: meta said no/);
  assert.match(r.goLive.join(" "), /by hand/, "it does not say what Bryson has to do about it");
});

await at("🔴 a failed launch does NOT clear the owner's job", async () => {
  const pending = [{ exec: { campaignId: "1", platform: "meta" } }];
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "1", platform: "meta" },
    client: { pendingActions: pending }, fail: true });
  assert.equal((r.apData.pendingActions || []).length, 1,
    "the launch failed and the reminder to launch it was deleted anyway, so nothing is left saying the campaign is dead");
});

await at("a successful launch DOES clear it", async () => {
  // Bryson, 2026-08-20, on a different leftover: "if a campaign needs approve itll give me
  // the notification but then if i delete the campaign the notification is still there."
  // Same shape: a queue item still saying "Launch this" for something already launched.
  const r = await run({ approval: { id: "a2", kind: "campaign", campaignId: "1", platform: "meta" },
    client: { pendingActions: [{ exec: { campaignId: "1", platform: "meta" } }, { exec: { campaignId: "2", platform: "meta" } }] } });
  const left = (r.apData.pendingActions || []).map((p) => p.exec.campaignId);
  assert.deepEqual(left, ["2"], "it cleared the wrong jobs, or none of them");
});

// ── The alert has to tell the truth about what happened ────────────────────────
t("🔴 a launch that failed is a RED alert, not a green tick", () => {
  const i = P.indexOf("const broke = goLive.some");
  assert.ok(i > 0, "nothing distinguishes a successful go-live from a failed one");
  const near = P.slice(i, i + 900);
  assert.match(near, /severity: broke \? "red" : "yellow"/,
    "a campaign that approved but did not launch raises the same gentle alert as one that did");
  assert.match(near, /did NOT go live/, "the alert title does not say it failed");
  assert.match(near, /goLive\.join\(" "\)/, "the alert does not say what actually happened, only what was approved");
});

// ── The OS records which platform a campaign approval belongs to ───────────────
t("a campaign approval is stamped with its platform when created", () => {
  assert.match(S, /makeApproval = \(\{kind,title,body,previewUrl,campaignId,platform\}\)/, "makeApproval cannot carry a platform");
  assert.match(S, /kind:"campaign",platform:"google"/, "the Google card does not record the platform");
  assert.match(S, /kind:"campaign",platform:"meta"/, "the Meta card does not record the platform");
});

console.log(`✓ verify-approval-goes-live: ${n} checks passed`);
