// Building a client's campaign has its own tab, and it says what to do first.
//
// Bryson, 2026-09-09: *"when I go into an individual client there is a campaign creation
// section that way I don't have to dig for it and make it very easy to use"*.
//
// Everything needed to launch a client's ads already existed and already worked. It was
// scattered down the Package tab underneath the plan, the scorecard and the trade playbook,
// which is a tab about what they BOUGHT. Building a campaign is the most common thing he
// does on a new client and it was the hardest thing on the screen to find.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S  = readFileSync(join(ROOT, "index.html"), "utf8");
const UI = S.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

// ── 1. The tab is there, and it is where he will see it ──────────────────────
{
  const literal = (/const TABS   = (\[[^\n]*\])/.exec(S) || [])[1] || "";
  const keys = [...literal.matchAll(/\["([a-z]+)","[^"]*"\]/g)].map((m) => m[1]);
  ok("there is a Campaign tab on a client", literal.includes('["campaign","Campaign"]'));
  ok("🔴 and it is second, right after Overview",
    keys[0] === "overview" && keys[1] === "campaign",
    `tab order is ${keys.slice(0, 4).join(", ")} — burying it again is the bug this fixes`);
  ok("it renders", /\{tab==="campaign"&&\(/.test(UI));
}

// ── 2. Everything needed to build lives on it, and ONLY on it ────────────────
// Two homes for one stateful card is worse than an awkward home: he presses the one that is
// not the one he was told about, and neither of us can tell which he used.
{
  const seg = (k) => {
    const a = UI.indexOf(`{tab==="${k}"&&(`);
    if (a < 0) return "";
    const b = UI.indexOf('{tab==="', a + 10);
    return UI.slice(a, b < 0 ? a + 6000 : b);
  };
  const camp = seg("campaign"), pack = seg("package");
  for (const c of ["ConversionLoopCard", "GoogleLaunchCard", "MetaLaunchCard", "LiveCampaignsCard"]) {
    ok(`${c} is on the Campaign tab`, camp.includes(`<${c}`), "this is the tab he was told to open");
    ok(`and no longer on the Package tab`, !pack.includes(`<${c}`),
      "two homes for one card means he presses the wrong one and neither of us can tell");
  }
  ok("the guide sits above the cards it is guiding",
    camp.indexOf("<CampaignStartHere") >= 0 && camp.indexOf("<CampaignStartHere") < camp.indexOf("<ConversionLoopCard"));
  ok("the house account keeps its own ad cards on the same tab",
    camp.includes("<MyAdsInsights") && !seg("package").includes("<MyAdsInsights"),
    "where the ads live should be one answer, not one per account type");
}

// ── 3. 🔴 THE HOUSE ACCOUNT USED TO RELABEL ITS PACKAGE TAB "Campaigns" ──────
// Next to a real Campaign tab that reads "Campaign | ... | Campaigns" and the second one
// no longer builds anything.
ok("🔴 the package tab is not relabelled Campaigns on the house account",
  !/client\.internal && k==="package"\) \? \[k,"Campaigns"\]/.test(UI),
  "two tabs a letter apart, and the one named Campaigns is the one that cannot build a campaign");

// ── 4. The order is the whole point, and it is computed, not ticked ──────────
{
  const src = UI.slice(UI.indexOf("function CampaignStartHere"), UI.indexOf("function LaunchChecklistCard"));
  const stepsSrc = src.slice(src.indexOf("  const steps = ["), src.indexOf("\n  ];", src.indexOf("  const steps = [")) + 5);
  const build = (client, { linked, camps }) => {
    const cs = client.campaignSetup || {}, ca = client.conversionActions || {}, lp = client.landingPage || {};
    return new Function("client", "cs", "ca", "lp", "linked", "camps", "runsGoogle",
      stepsSrc + "\nreturn steps;")(client, cs, ca, lp, linked, camps, true);
  };
  const nextOf = (client, o) => (build(client, o).find((st) => !st.done) || {}).id || null;

  // 🔴 THE ORDER IS THE PRODUCT HERE, so it is asserted as an order and not inferred from
  // which id happens to come back first.
  ok("the steps are in the only order that works",
    build({}, { linked: false, camps: [] }).map((st) => st.id).join(">") === "link>page>track>build",
    "account, then a page for the ads to point at, then tracking, then the build that needs all three");

  const READY = {
    landingPage: { published: true, headline: "H" },
    conversionId: "1", conversionActions: { form: { label: "f" }, qualified: { resourceName: "r" } },
  };
  ok("with nothing done, the first thing asked for is the ad account",
    nextOf({}, { linked: false, camps: [] }) === "link");
  ok("🔴 conversion tracking is asked for BEFORE the campaign is built",
    nextOf({ landingPage: { published: true, headline: "H" } }, { linked: true, camps: [] }) === "track",
    "Google refuses a campaign with a lead goal until tracking exists, and its error does not say so");
  ok("🔴 and the landing page before that, because the ads need somewhere to point",
    nextOf({}, { linked: true, camps: [] }) === "page");
  ok("with everything in place it asks for the build",
    nextOf(READY, { linked: true, camps: [] }) === "build");
  ok("and once a campaign exists nothing is outstanding",
    nextOf(READY, { linked: true, camps: [{ id: 1 }] }) === null);

  // 🔴 OBSERVED, NEVER TICKED. Same rule as the launch checklist and the pipeline panels.
  ok("🔴 a half-finished tracking setup does not count as done",
    nextOf({ ...READY, conversionActions: { form: { label: "f" } } }, { linked: true, camps: [] }) === "track",
    "a run that created the form action and stopped would otherwise read as finished");
  ok("a drafted but unpublished landing page does not count as done",
    nextOf({ ...READY, landingPage: { headline: "H" } }, { linked: true, camps: [] }) === "page");
  ok("nothing here is a stored flag",
    !/campaignStartDone|startHereTicked/.test(src));

  // Each instruction has to name where to go. "Link the account" is not an instruction to
  // someone who does not know where that lives.
  const steps = build({}, { linked: false, camps: [] });
  ok("every step says where to go, not just what is missing",
    steps.every((st) => /tab|Edit|card|button|below/i.test(st.todo)),
    steps.map((st) => st.id + ": " + st.todo.slice(0, 40)).join(" | "));
  ok("🔴 and the drafted-page wording differs from the nothing-yet wording",
    build({ landingPage: { headline: "H" } }, { linked: true, camps: [] })[1].todo !== steps[1].todo,
    "telling him to generate a page he has already written is how he loses the one he wrote");
}

// ── 5. IT IS COMPILED AND RENDERED, not just read ────────────────────────────
// A regex proving the steps array looks right proves nothing about what lands on screen.
// This runs the real component through Babel and a recording React, the same way
// verify-budget-editing does, and reads the words that come out.
{
  const { transform } = await import("@babel/standalone");
  const src = S.slice(S.indexOf("function CampaignStartHere"), S.indexOf("function LaunchChecklistCard"));
  const compiled = transform(src, { presets: ["react"] }).code;

  const React = { createElement: (type, props, ...kids) => ({ type, props: props || {},
    children: kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true) }) };
  const walk = (n, out = []) => { if (!n || typeof n !== "object") return out; out.push(n);
    (n.children || []).forEach((k) => walk(k, out)); return out; };
  const allText = (t) => walk(t).map((x) => (x.children || []).filter((k) => typeof k !== "object").join("")).join(" ");

  const C = new Proxy({}, { get: () => "#000" });
  const Card = (props) => ({ type: "Card", props, children: [props.children].flat(Infinity).filter(Boolean) });
  const Label = (props) => ({ type: "Label", props, children: [props.children].flat(Infinity).filter(Boolean) });
  const render = (client, pkg = { platform: "Google Ads" }) => {
    const scope = { React, C, Card, Label };
    const Fn = new Function(...Object.keys(scope), `${compiled}\nreturn CampaignStartHere;`)(...Object.values(scope));
    return allText(Fn({ client, pkg }));
  };

  const fresh = render({});
  ok("it renders, and leads with the next thing to do",
    /Do this next/.test(fresh) && /Getting Their Ads Live/.test(fresh), fresh.slice(0, 160));
  ok("🔴 on a brand new client it asks for the ad account, in words with a place in them",
    /Customer ID/.test(fresh) && /Edit/.test(fresh),
    "\"link the account\" is not an instruction to someone who does not know where that lives");
  ok("and it counts the steps so progress is visible",
    /0 of 4/.test(fresh), fresh.slice(0, 200));

  const tracking = render({ googleAdsCustomerId: "1234567890", landingPage: { published: true, headline: "H" } });
  ok("🔴 once the account and page are done it asks for tracking, and says WHY that order",
    /Conversion tracking/.test(tracking) && /refuse/i.test(tracking),
    "he learned that order from me in chat, twice, which is exactly what should not have to happen");
  ok("and the count moves with him", /2 of 4/.test(tracking));

  const done = render({ googleAdsCustomerId: "1234567890", landingPage: { published: true, headline: "H" },
    conversionId: "1", conversionActions: { form: { label: "f" }, qualified: { resourceName: "r" } },
    campaigns: [{ id: 1 }] });
  ok("🔴 with everything built it stops nagging and says what happens next instead",
    !/Do this next/.test(done) && /paused/.test(done),
    "a card that always shouts gets ignored, and campaigns arriving paused is the thing he needs to remember");
  ok("and it retitles itself, so a finished client does not read as an outstanding job",
    /Their Ads Are Built/.test(done) && !/Getting Their Ads Live/.test(done),
    "the heading is the first thing read, and a green card under a to-do heading is a contradiction");
  ok("🔴 the build step promises the campaign arrives paused, right where he is about to press it",
    /arrives paused and spends nothing/i.test(src),
    "pressing Build without knowing it spends nothing is the one thing that would stop him pressing it");
  ok("no emoji reaches this card", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(done.replace(/[✓○]/g, "")));
}

// ── 6. The OS must not send him somewhere that cannot do the job ─────────────
ok("🔴 nothing still tells him to build a campaign on the Campaigns screen",
  !/Build a (Google )?campaign on the Campaigns screen/.test(UI),
  "that screen manages campaigns, it does not build them, and it is where he was being sent");
ok("the conversion-tracking instruction names the Campaign tab",
  /their Campaign tab, and press Set this up/.test(UI));
{
  const LC = readFileSync(join(ROOT, "netlify/lib/launch-checklist.mjs"), "utf8");
  ok("and the shared checklist agrees, since it is the copy the client-side one mirrors",
    /their Campaign tab, and press Set this up/.test(LC),
    "the checklist lives in two files; changing one and not the other is the standing trap here");
}

console.log(`verify-campaign-tab: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
