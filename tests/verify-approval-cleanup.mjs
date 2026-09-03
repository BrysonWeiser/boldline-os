// Deleting a campaign must take its approval requests with it.
// Run: node tests/verify-approval-cleanup.mjs
//
// Bryson, 2026-08-20: "if a campaign needs approve itll give me the notification but then
// if i delete the campaign the notification is still there. It needs to be where if i
// delete a campaign the notification for it also dissapears."
//
// WHY THIS IS WORSE THAN UNTIDY. The leftover notification still shows an Approve button.
// Pressing it re-reads the ad account, cannot find the campaign, and fails. So the queue
// holds an item that can never be cleared by doing what it asks, and the bell count is
// permanently wrong — which is exactly how a real approval gets ignored.
//
// The pruning helper is EXTRACTED FROM index.html and executed, not re-implemented here.
// A re-implementation would keep passing while the shipped version broke.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// Pull the real helper out and run it.
const from = os.indexOf("const withoutCampaign = (client, campaignId");
const to = os.indexOf("\n};", from) + 3;
ok("the pruning helper exists", from > 0 && to > from);
const { withoutCampaign } = new Function(
  "const fmt=(d)=>String(d);\n" + os.slice(from, to) + "\nreturn { withoutCampaign };")();

const client = () => ({
  id: "c1", name: "Acme Roofing",
  pendingActions: [
    { id: "launch-m-111", title: 'Launch Meta campaign "Roof Repair"', exec: { platform: "meta", campaignId: "111", kind: "enable_campaign" } },
    { id: "launch-g-222", title: 'Launch Google campaign "Roof Replace"', exec: { platform: "google", campaignId: "222", kind: "enable_campaign" } },
    { id: "other", title: "Send the monthly report", category: "report" },
  ],
  approvals: [
    { id: "ap-1", kind: "campaign", campaignId: "111", status: "pending", title: "Your Meta ad campaign is ready to launch" },
    { id: "ap-2", kind: "campaign", campaignId: "222", status: "approved", title: "Your Google ad campaign is ready to launch" },
    { id: "ap-3", kind: "landing", status: "pending", title: "Your landing page" },
  ],
  commLog: [],
});

// ── The reported bug ────────────────────────────────────────────────────────
{
  const r = withoutCampaign(client(), "111");
  ok("the deleted campaign's approval request is gone",
    !r.pendingActions.some((a) => a.exec && a.exec.campaignId === "111"));
  eq("the other campaign's request survives", r.pendingActions.filter((a) => a.exec).length, 1);
  ok("unrelated pending work is untouched", r.pendingActions.some((a) => a.id === "other"));
  ok("the client's matching approval request goes too",
    !r.approvals.some((a) => a.id === "ap-1"),
    "leaving it asks the client to approve a campaign that no longer exists");
  ok("a non-campaign approval is untouched", r.approvals.some((a) => a.id === "ap-3"));
  ok("it is written to the log", r.commLog.length === 1 && /Campaign deleted/.test(r.commLog[0].note));
}

// 🔴 An ANSWERED approval is a record of a decision, not an outstanding request.
{
  const r = withoutCampaign(client(), "222");
  ok("an already-approved item is kept as a record",
    r.approvals.some((a) => a.id === "ap-2" && a.status === "approved"),
    "deleting it would erase what the client actually decided");
  ok("but its pending action still goes",
    !r.pendingActions.some((a) => a.exec && a.exec.campaignId === "222"));
}

// ── Nothing to do must change nothing ──────────────────────────────────────
// Identity matters: the caller only saves when the object actually changed, so returning
// a fresh copy every time would write to the database on every screen load.
{
  const c = client();
  eq("an unknown campaign id is a no-op", withoutCampaign(c, "999"), c);
  eq("an empty id is a no-op", withoutCampaign(c, ""), c);
  eq("a null id is a no-op", withoutCampaign(c, null), c);
  eq("no log line is added when nothing was removed", withoutCampaign(c, "999").commLog.length, 0);
}

// Ids arrive as numbers from one API and strings from the other.
{
  const r = withoutCampaign(client(), 111);
  ok("a numeric campaign id still matches", !r.pendingActions.some((a) => a.exec && a.exec.campaignId === "111"));
}

// A client with no arrays at all must not crash.
{
  const bare = withoutCampaign({ id: "x" }, "111");
  eq("a client with no approvals is safe", bare.id, "x");
}

// ── The wiring ─────────────────────────────────────────────────────────────
{
  ok("the delete path clears the approvals", /withoutCampaign\(r\.client,r\.c\.id\)/.test(os));
  ok("and only saves when something changed", /if\(next!==r\.client\) onUpdate\(next\)/.test(os));
  // 🔴 Pins that it RECEIVES onUpdate, not the exact prop list. The old pattern spelled
  // every prop out and broke the day `focusKey` was added for opening one campaign, which
  // is not a regression at all: it reported "the Campaign Manager can save" as broken while
  // saving worked perfectly. A signature match fails on every future prop too.
  ok("the Campaign Manager can save",
    /function CampaignManagerScreen\(\{[^}]*\bonUpdate\b[^}]*\}\)/.test(os));
  // Not [^>]* — the props contain arrow functions, whose "=>" ends the character class
  // early and makes this fail on correct code. The tail is generous for the same reason as
  // above: props added after onUpdate must not break it.
  ok("and is given a save function",
    /<CampaignManagerScreen[\s\S]{0,400}?onUpdate=\{updateClient\}[\s\S]{0,200}?\/>/.test(os));

  // The approval item has to carry the id, or nothing can match it later.
  ok("campaign approvals are stamped with the campaign id", /campaignId\?\{campaignId:String\(campaignId\)\}/.test(os));
  // 🔴 Matched with the platform between the two, not without it. Approving a campaign now
  // STARTS it (2026-09-02), and the portal needs to know which account to start it on, so
  // both cards stamp the platform alongside the id. The old pattern required the id to sit
  // immediately after the kind and broke the moment that field was added, which would have
  // read as "the cards stopped stamping the id" when they had not.
  eq("both launch cards stamp it", (os.match(/makeApproval\(\{kind:"campaign",platform:"(?:google|meta)",campaignId:/g) || []).length, 2);
}

// ── 🔴 The self-heal must never fire on a failed API call ──────────────────
// A campaign deleted straight from Ads Manager leaves the same dead notification, and so
// do any orphaned before this fix. Both are swept on load. But treating a failed load as
// "this account has no campaigns" would wipe every pending approval the moment the ads API
// had a bad minute, and those items authorise real spend.
{
  const load = os.slice(os.indexOf("  const load=async"), os.indexOf("  const isOn=(r)=>"));
  ok("the sweep records which accounts answered", /loaded\[`\$\{cl\.id\}\|google`\]=1/.test(load) && /loaded\[`\$\{cl\.id\}\|meta`\]=1/.test(load));
  ok("success is recorded only after the call returns", /\(d\.campaigns\|\|\[\]\)\.forEach[\s\S]{0,200}loaded\[/.test(load));
  ok("a non-answering account is skipped", /if\(!loaded\[`\$\{cl\.id\}\|\$\{plat\}`\]\) return false/.test(load),
    "otherwise an API blip deletes approvals that authorise spend");
  ok("only campaigns absent from a live list are pruned", /return !seen\[`\$\{cl\.id\}\|\$\{plat\}\|\$\{ex\.campaignId\}`\]/.test(load));
  ok("it matches the platform, not just the id", /ex\.platform==="meta"\?"meta":"google"/.test(load),
    "two platforms can hand out the same campaign id");
  ok("an action with no exec payload is never pruned", /if\(!ex\|\|!ex\.campaignId\) return false/.test(load));
  ok("the sweep says why it cleared something", /no longer exists on the ad account/.test(load));

  // The failure path must not mark the account as loaded.
  const gBlock = load.slice(load.indexOf("if(cl.googleAdsCustomerId)"), load.indexOf("if(cl.metaAdAccountId)"));
  ok("a Google load error does not mark it answered", /catch\(e\)\{ errs\.push/.test(gBlock) && !/catch[\s\S]{0,120}loaded\[/.test(gBlock));
}


// ══════════════════════════════════════════════════════════════════════════════
// THE APPROVAL CARD MUST NAME THE RIGHT PLATFORM (2026-08-20)
// ══════════════════════════════════════════════════════════════════════════════
// Bryson: "i just approved my campaign and i have it set to run meta only but why when i
// pressed approve it said google ads".
//
// The EXECUTION was correct — it branches on exec.platform and called Meta. Three LABELS
// were wrong, and the third was not merely cosmetic: the footer told him Meta approvals
// are only logged for him to do by hand, which flatly contradicted what the button had
// just done. A UI that lies about what it did is worse than one that says nothing, because
// he would reasonably have gone into Ads Manager and started the campaign a second time.
{
  const helpers = os.slice(os.indexOf("const CATEGORY_LABELS ="), os.indexOf("// ─── WEB PUSH"));
  const { execPlatformLabel, approvalCategory, approvalSource, CATEGORY_LABELS } =
    new Function(helpers + "\nreturn { execPlatformLabel, approvalCategory, approvalSource, CATEGORY_LABELS };")();

  eq("a Meta action is labelled Meta", execPlatformLabel({ exec: { platform: "meta" } }), "Meta Ads");
  eq("a Google action is labelled Google", execPlatformLabel({ exec: { platform: "google" } }), "Google Ads");
  eq("an action that executes nothing names no platform", execPlatformLabel({ title: "x" }), "");
  eq("a null action is safe", execPlatformLabel(null), "");

  // The launch cards write `cat`; ARIA writes `category`. Reading one labelled every
  // campaign launch "Other".
  eq("a launch approval is categorised as a launch", approvalCategory({ cat: "launch" }), "launch");
  eq("an ARIA proposal keeps its own category", approvalCategory({ category: "budget" }), "budget");
  eq("an uncategorised item falls back", approvalCategory({}), "other");
  ok("the launch category has a label", !!CATEGORY_LABELS.launch);

  // Crediting a campaign the owner built himself to ARIA is simply untrue.
  eq("a launch is not credited to ARIA", approvalSource({ cat: "launch" }), "You built this");
  eq("an ARIA proposal still is", approvalSource({ category: "budget" }), "ARIA proposal");

  // The button.
  ok("the button names the action's own platform",
    /Executing in \$\{execPlatformLabel\(action\)\|\|"the ad account"\}/.test(os));
  ok("and no longer hardcodes one", !/Executing in Google Ads…/.test(os));

  // The footer.
  const footer = os.slice(os.indexOf("Approving an item marked"), os.indexOf("Approving an item marked") + 420);
  ok("the footer is platform-neutral", /on whichever platform the item names/.test(footer));
  ok("the footer no longer claims Meta is manual-only",
    !/all Meta changes until Meta's API is verified/.test(os),
    "that was false and contradicted what the button had just done");
}

// The execution itself was never wrong. Pin it so a label fix cannot disturb the routing.
{
  const d = os.slice(os.indexOf("const decideAction=async"));
  const body = d.slice(0, d.indexOf("\n  const "));
  ok("approval routes on the action's platform", /ex\.platform==="meta"\?"meta":"google"/.test(body));
  ok("Meta approvals call Meta", /if\(platform==="meta"\)\{[\s\S]{0,200}metaCall\(/.test(body));
  ok("and check the right linked account", /platform==="meta"\?cl\.metaAdAccountId:cl\.googleAdsCustomerId/.test(body));
}


console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-approval-cleanup: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
