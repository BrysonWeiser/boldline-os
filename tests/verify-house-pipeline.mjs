// Guards three complaints about the My Ads pipeline (Bryson, 2026-08-22):
//   "Some things say running but when I press on them they say they are waiting on the
//    previous step and there are some bots that just don't make sense to have there…
//    the landing page was made a while ago and is being used but the os is still telling
//    me there isn't a landing page that's been made."
// KB `house-pipeline-honesty`.
//
// The derivation is EXTRACTED FROM index.html AND EXECUTED, never re-implemented — the
// lesson from `verify-house-leads` (KB `repo-tests`): a test that owns its own copy of the
// logic stays green while the shipped version is broken. index.html has no module system,
// so the functions cannot be imported; slicing them out and evaluating them is the closest
// honest equivalent, and it means a change to the real code shows up here.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── Pull the real functions out of the shipped file and run them ──────────────
const slice = (startRe, endRe) => {
  const i = UI.search(startRe);
  if (i < 0) throw new Error(`could not find ${startRe}`);
  const j = UI.slice(i).search(endRe);
  if (j < 0) throw new Error(`could not find the end of ${startRe}`);
  return UI.slice(i, i + j);
};

const src = [
  slice(/^const HOUSE_LANDING_URL = /m, /\n\n/),
  slice(/^const adLanding = /m, /\n};\n/) + "\n};\n",
  slice(/^const HOUSE_HIDDEN_BOTS = /m, /\n\n/),
  slice(/^const MANUAL_BOTS = /m, /\n\n/),
  slice(/^const monthlyBudgetNum = /m, /\n/),
  slice(/^const deriveBotStatuses = /m, /\n};\n/) + "\n};\n",
  slice(/^const BOT_IDS = \[/m, /\n\];\n/) + "\n];\n",
].join("\n");

// `window` is what adLanding reads for the origin of a generated page. Absent here, which
// is the branch it already guards.
const api = new Function(`${src}\nreturn { adLanding, deriveBotStatuses, HOUSE_HIDDEN_BOTS, BOT_IDS, HOUSE_LANDING_URL, MANUAL_BOTS };`)();
const { adLanding, deriveBotStatuses, HOUSE_HIDDEN_BOTS, BOT_IDS, HOUSE_LANDING_URL } = api;

const house = (over = {}) => ({
  internal: true, name: "BoldLine Media", adBudget: "$213",
  metaAdAccountId: "act_x", campaignSetup: {}, landingPage: {}, leadsLog: [],
  adPerf: { totals: { liveCampaigns: 1, spend30d: 40, conversions: 0 }, meta: { campaigns: 1, live: 1 } },
  ...over,
});
const client = (over = {}) => ({
  internal: false, name: "Cornerstone Plumbing", adBudget: "$2,500",
  googleAdsCustomerId: "123", campaignSetup: {}, landingPage: {}, leadsLog: [], ...over,
});

// ── 1. The landing page his ads actually use counts as a landing page ─────────
{
  const h = adLanding(house());
  ok("the house account reads as having a landing page", h.published === true);
  eq("and it names the page the ads really point at", h.url, HOUSE_LANDING_URL);
  eq("labelled so it is obvious WHICH page", h.label, "Live on your site");
  ok("with a reason a person can read", /get-started/.test(h.why));

  // 🔴 The regression this replaces: a client must NOT inherit the house fallback.
  // Their ads point at a page we generate for them, and pretending otherwise would
  // score every new client as finished before anything was built.
  const c = adLanding(client());
  eq("a client with nothing built still reads as not built", c.published, false);
  eq("and says so plainly", c.label, "Not built");
  const drafted = adLanding(client({ landingPage: { headline: "Fast drain repair" } }));
  eq("a drafted client page is half done", drafted.published, false);
  eq("and is described as drafted", drafted.label, "Drafted, not published");
  ok("a drafted page counts as written", drafted.written === true);
  const live = adLanding(client({ landingPage: { headline: "x", published: true }, landingSlug: "corner" }));
  eq("a published client page is published", live.published, true);
  eq("and keeps its own label", live.label, "Published");

  // A generated page he publishes for his OWN ads is the newer decision and wins.
  const own = adLanding(house({ landingPage: { headline: "x", published: true }, landingSlug: "boldline-media" }));
  eq("a published house page beats the site fallback", own.source, "os");
  ok("and does not point at /get-started", own.url !== HOUSE_LANDING_URL);
}

// ── 2. The pipeline steps that read the landing page follow it ────────────────
{
  const d = deriveBotStatuses(house());
  eq("Page Architect is done", d.architect.status, "done");
  eq("Copy Chief is done", d.copy.status, "done");
  eq("Page Builder is done", d.builder.status, "done");
  ok("and each says why, naming the real page",
    [d.architect, d.copy, d.builder].every((x) => /get-started/.test(x.why)));

  // Unchanged for a client with nothing built.
  const c = deriveBotStatuses(client());
  eq("a client's Page Architect still waits", c.architect.status, "waiting");
  eq("a client's Page Builder still waits", c.builder.status, "waiting");
  const cd = deriveBotStatuses(client({ landingPage: { headline: "h" } }));
  eq("a drafted client page puts the builder in progress", cd.builder.status, "active");
  eq("and the copy step in progress", cd.copy.status, "active");
}

// ── 3. Steps that only exist because there is a client are hidden on his own ──
{
  ok("the hidden set is exactly the three client-relationship steps",
    HOUSE_HIDDEN_BOTS.length === 3
    && ["intake", "ceo", "success"].every((id) => HOUSE_HIDDEN_BOTS.includes(id)));
  // Every hidden id must be a real step, or the filter silently does nothing.
  ok("every hidden id is a real step", HOUSE_HIDDEN_BOTS.every((id) => BOT_IDS.includes(id)));
  // And nothing that is genuine work on his own ads may be hidden.
  const REAL_WORK = ["offer", "architect", "copy", "builder", "keywords", "ads", "tracking",
                     "automation", "qc", "budget", "terms", "leads", "perf"];
  ok("no real ad-work step is hidden", REAL_WORK.every((id) => !HOUSE_HIDDEN_BOTS.includes(id)));

  ok("the screen filters them for the house account",
    /const bots\s+= botsFor\(client,pkg\)/.test(UI));
  ok("botsFor only filters the internal account",
    /\(cl && cl\.internal\) \? all\.filter\(\(b\) => !HOUSE_HIDDEN_BOTS\.includes\(b\.id\)\) : all/.test(UI));
  ok("the progress rollup counts the same steps the screen shows",
    /BOT_IDS\.filter\(\(id\) => !HOUSE_HIDDEN_BOTS\.includes\(id\)\) : BOT_IDS/.test(UI));
}

// ── 4. A step's detail panel can no longer contradict the row ─────────────────
// The reported symptom: a row reads Running, the panel reads "has not started yet".
// The panel was not looking at the status at all — it printed that whenever
// `getBotLogs` had no canned entry, and TEN of the twenty steps have none.
{
  ok("the false empty state is gone",
    !/This bot has not started yet/.test(UI));
  const worklog = UI.match(/\{botTab==="worklog"&&\([\s\S]*?\n      \)\}/);
  ok("the work log tab still exists", !!worklog);
  const body = worklog ? worklog[0] : "";
  ok("it leads with the same badge the row showed", /<Label>\{sc\.label\}<\/Label>/.test(body));
  ok("and with the derived reason behind it", /\{bot\.why\|\|bot\.description\}/.test(body));
  ok("a hand-tracked step says so instead of guessing", /no automatic signal for this step/.test(body));

  // The heart of it: the steps with no canned log are precisely the ones that go live
  // off real signals, so they were the most likely to claim they had not begun.
  const logs = UI.slice(UI.indexOf("const getBotLogs"), UI.indexOf("// Grouped niche catalog"));
  const withLog = [...logs.matchAll(/^ {4}(\w+):\{$/gm)].map((m) => m[1]);
  const noLog = BOT_IDS.filter((id) => !withLog.includes(id));
  ok("there really are steps with no canned log", noLog.length > 0, `found ${noLog.length}`);
  const d = deriveBotStatuses(house({ leadsLog: [{ receivedAt: new Date().toISOString() }] }));
  const liveButLogless = noLog.filter((id) => d[id] && d[id].status !== "waiting");
  ok("and at least one of them is live on his account right now",
    liveButLogless.length > 0, `logless steps: ${noLog.join(", ")}`);
  // Whatever those are, they all carry a reason, which is what the panel now renders.
  ok("every live logless step has a reason to show",
    liveButLogless.every((id) => typeof d[id].why === "string" && d[id].why.length > 0));
}

// ── 5. The Overview, the health score and the setup list use the one helper ───
// Three screens disagreed about the same page. They now cannot.
{
  ok("the Overview tile reads the helper", /\{l:"Landing Page",v:adLanding\(client\)\.label\}/.test(UI));
  ok("the health score reads the helper",
    /f\("Landing page published", land\.published \? 1 : land\.written \? 0\.5 : 0, 1, land\.why\)/.test(UI));
  ok("the setup checklist reads the helper", /done:adLanding\(client\)\.published/.test(UI));
  ok("the pipeline reads the helper", /const land\s+= adLanding\(cl\);/.test(UI));
  // ONE literal in the whole file: the constant's own definition. The launch cards, the
  // Preview link, the Copy button and the displayed text all read it, so the page his ads
  // point at and the page the OS scores cannot drift apart.
  eq("the landing URL is written out exactly once",
    (UI.match(/https:\/\/boldlinemedia\.com\/get-started/g) || []).length, 1);
  ok("that one occurrence is the constant itself",
    /^const HOUSE_LANDING_URL = "https:\/\/boldlinemedia\.com\/get-started";$/m.test(UI));
  ok("both launch cards default to the constant",
    (UI.match(/client\.internal \? HOUSE_LANDING_URL/g) || []).length === 2);
  ok("the Preview link and Copy button use it too",
    /<a href=\{HOUSE_LANDING_URL\}/.test(UI) && /writeText\(HOUSE_LANDING_URL\)/.test(UI));
}

console.log(`verify-house-pipeline: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
