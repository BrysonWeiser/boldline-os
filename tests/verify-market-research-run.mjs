// Runs the REAL Market Research function, start to finish, with the outside world stubbed.
//
// 🔴 WHY THIS SUITE EXISTS. Bryson, 2026-08-24, from the OS: the Market Research card said
// "The research could not finish. Try again." on every attempt. The cause was one word on
// the last line of the happy path — a variable that had been renamed when the search went
// parallel across markets, and one leftover reference to the old name. It threw AFTER the
// Places lookups, AFTER the competitor site reads and AFTER the model call, so every run
// burned two minutes of real work and then reported failure.
//
// verify-market-research.mjs has 144 assertions and every one of them passed. So did the
// syntax check. They all test the PURE modules and the SOURCE TEXT; nothing had ever
// executed the function body, which is where the glue lives. That is the gap this closes:
// the handler is imported and called for real, with Supabase, Anthropic and Google Places
// swapped for recorders (tests/helpers/), so a crash anywhere in it is a failing test.
//
// It also pins the thing the whole feature is built around: a completed run stores a
// PROPOSAL and never writes brandVoice. That is asserted here against what the code
// actually tried to save, not against the source text.

import { register } from "node:module";

register("./helpers/stub-hooks.mjs", import.meta.url);

process.env.ANTHROPIC_API_KEY = "test-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

const handler = (await import("../netlify/functions/market-research-background.mjs")).default;
const { MR_TOOL, NATIONAL_MARKETS } = await import("../netlify/lib/market-research-shared.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

// ── The world the function runs in ────────────────────────────────────────────
const HOUSE = {
  internal: true,
  name: "BoldLine Media",
  niche: "Marketing Agency",
  website: "https://boldlinemedia.com",
  campaignSetup: { serviceArea: "Gilbert, Arizona", mainOffer: "Google Ads plus a landing page" },
  brandVoice: { tone: "direct" },
};

const REPORT = {
  competitorsLine: "Adfire, Northline Digital, Cactus Media",
  landscape: "Most agencies in this space sell retainers and keep the ad account in their own name.",
  commonClaims: ["Data driven", "Certified partner"],
  gaps: [{ gap: "Nobody says the client owns the ad account", why: "None of the six sites mention account ownership" }],
  differentiators: [
    { text: "You own your ad account, always", basis: "record", evidence: "BoldLine only takes manager access", why: "Every competitor holds the account" },
    { text: "Every campaign gets its own landing page", basis: "observed", evidence: "Seen on boldlinemedia.com", why: "The others point ads at a homepage" },
    { text: "Answers in under an hour", basis: "gap", evidence: "", why: "Reviews complain about slow replies" }, // no evidence: must be dropped
  ],
};

const aiReport = (input = REPORT) => ({ content: [{ type: "tool_use", name: MR_TOOL.name, input }] });

const PLACES = (n) => ({
  ok: true,
  results: Array.from({ length: n }, (_, i) => ({
    name: `Agency ${i + 1}`, website: `https://agency${i + 1}.com`,
    rating: "4.6", reviewCount: 100 - i, city: "Somewhere",
  })),
});

const setup = (over = {}) => {
  globalThis.__STUB = {
    row: { data: { ...HOUSE, ...(over.cl || {}) } },
    writes: [], calls: [], places: [], inspected: [],
    placesResult: over.placesResult || (() => PLACES(3)),
    adTechResult: over.adTechResult || (() => ({ reachable: true, googleAds: "yes", metaAds: "no" })),
    ai: "ai" in over ? over.ai : aiReport(),
    aiThrows: over.aiThrows || "",
    auth: over.auth,
  };
  return globalThis.__STUB;
};

const req = (body = { clientId: "c1" }, { auth = "Bearer token", method = "POST" } = {}) =>
  new Request("https://boldlinemedia.netlify.app/.netlify/functions/market-research-background", {
    method,
    headers: auth ? { authorization: auth, "content-type": "application/json" } : { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

// What the function last tried to save, read the way the OS reads it.
const stored = (S) => {
  const last = S.writes[S.writes.length - 1];
  return last && last.patch && last.patch.data ? last.patch.data : {};
};
const research = (S) => stored(S).marketResearch || {};

const runAll = [];   // every stub used, for the cross-cutting brandVoice check
const go = async (over, reqArgs) => {
  const S = setup(over);
  runAll.push(S);
  const res = await handler(reqArgs || req());
  return { S, res, body: await res.json() };
};

// ── 1. 🔴 THE REGRESSION: a run that works must SAY it worked ─────────────────
{
  const { S, body } = await go();
  const r = research(S);
  eq("a good run finishes", r.status, "done");
  eq("and stores no error", r.error, "");
  ok("the card is never told to try again after a successful run",
    !/could not finish/i.test(JSON.stringify(r)), JSON.stringify(r.error));
  eq("the function reports success", body.ok, true);

  // The exact line that broke: reporting where the competitor list came from.
  eq("it records that the business listings answered", (r.sources || {}).places, "ok");
  eq("and how many markets were searched", (r.sources || {}).markets, 7);
  ok("with competitors to show for it", (r.competitors || []).length > 0);
}

// ── 2. It searched the whole country, own market first ────────────────────────
{
  const { S } = await go();
  const areas = S.places.map((p) => p.area);
  eq("every market was searched", areas.length, 7);
  eq("his own first", areas[0], "Gilbert, Arizona");
  for (const m of NATIONAL_MARKETS) ok(`and ${m}`, areas.includes(m));
  ok("looking for his actual niche", S.places.every((p) => /marketing agency/i.test(p.niche)));
  ok("competitor sites were opened to see who is buying ads", S.inspected.length > 0);
  const withAds = (research(S).competitors || []).filter((c) => c.runningAds === true);
  ok("and the ones running ads are marked", withAds.length > 0);
  ok("with the platform named", withAds.every((c) => /Google/.test(c.adsNote)));
}

// ── 3. 🔴 IT PROPOSES. IT NEVER APPLIES. ──────────────────────────────────────
// The differentiator goes into every ad and every landing page the OS writes. A run must
// leave that field exactly as it found it and wait for a person to press Use.
{
  const { S } = await go();
  const saved = stored(S);
  eq("brand voice is left completely alone", JSON.stringify(saved.brandVoice), JSON.stringify(HOUSE.brandVoice));
  ok("no differentiator is written onto the account",
    !saved.brandVoice.differentiator, JSON.stringify(saved.brandVoice));
  ok("and no competitor list either", !saved.brandVoice.competitors);

  const d = research(S).differentiators || [];
  eq("the unevidenced proposal was dropped, not shown with a warning", d.length, 2);
  ok("nothing about answering in under an hour survived",
    !d.some((x) => /under an hour/i.test(x.text)), JSON.stringify(d));
  eq("what he already told us is safe to use as written", d[0].needsConfirmation, false);
  eq("what was merely observed has to be checked first", d[1].needsConfirmation, true);
}

// ── 4. A thin report looks thin, not like an empty market ─────────────────────
{
  const off = await go({ placesResult: () => ({ ok: false, off: true, results: [] }) });
  eq("no Places key says so plainly", (research(off.S).sources || {}).places, "off");
  ok("in words, on the card", /web search only/i.test((research(off.S).sources || {}).placesNote || ""));
  eq("and the run still finishes", research(off.S).status, "done");

  const bad = await go({ placesResult: () => ({ ok: false, error: "quota", results: [] }) });
  eq("listings that failed are not reported as off", (research(bad.S).sources || {}).places, "failed");
  eq("and that run finishes too", research(bad.S).status, "done");
}

// ── 5. Every failure says something a person can act on ───────────────────────
{
  const none = await go({ ai: { content: [{ type: "text", text: "here you go" }] } });
  eq("a report that came back unusable is an error", research(none.S).status, "error");
  ok("and says to run it again", /run(ning)? it again/i.test(research(none.S).error));

  const busy = await go({ aiThrows: "Error: overloaded_error" });
  ok("a busy model says wait a minute", /busy/i.test(research(busy.S).error), research(busy.S).error);

  const broke = await go({ aiThrows: "socket hang up" });
  eq("anything else is the general message", research(broke.S).error, "The research could not finish. Try again.");

  // No area means nowhere to look, and searching the wrong city is worse than stopping.
  const noArea = await go({ cl: { internal: false, campaignSetup: { mainOffer: "x" }, businessAddress: "" } });
  eq("no service area stops before spending anything", research(noArea.S).status, "error");
  ok("and says where to add one", /Edit/.test(research(noArea.S).error));
  eq("without calling the model at all", noArea.S.calls.length, 0);
  eq("or searching anywhere", noArea.S.places.length, 0);
}

// ── 6. It is not open to the internet ─────────────────────────────────────────
{
  const S1 = setup();
  const r1 = await handler(req({ clientId: "c1" }, { auth: "" }));
  eq("no session, no research", r1.status, 401);
  eq("and nothing was written", S1.writes.length, 0);
  eq("nor searched", S1.places.length, 0);

  const S2 = setup();
  S2.auth = { data: null, error: { message: "bad jwt" } };
  eq("a rejected session is refused", (await handler(req())).status, 401);
  eq("still nothing written", S2.writes.length, 0);

  const S3 = setup();
  eq("a GET is refused", (await handler(req({}, { method: "GET" }))).status, 405);
  eq("nothing written for that either", S3.writes.length, 0);

  const S4 = setup();
  S4.row = null;
  eq("an unknown client is a 404", (await handler(req())).status, 404);
  eq("and writes nothing", S4.writes.length, 0);
}

// ── 7. The model was actually asked the right question ────────────────────────
{
  const { S } = await go();
  const call = S.calls[0];
  ok("it was given the reporting tool", (call.tools || []).some((t) => t.name === MR_TOOL.name));
  ok("and real web search", (call.tools || []).some((t) => /web_search/.test(t.type || "")));
  ok("told the business has no clients yet, so nothing can be invented",
    /NO CLIENTS YET/.test(call.system));
  ok("and never to call his customers local businesses", /local businesses/i.test(call.system));
  const prompt = call.messages[0].content;
  ok("the verified competitors were handed over as facts", /VERIFIED COMPETITORS/.test(prompt));
  ok("with a note that this business has no local market", /DOES NOT HAVE A LOCAL MARKET/.test(prompt));
}

// ── 8. Across every run above, nothing ever touched the live ad fields ────────
{
  const touched = runAll.flatMap((S) => S.writes)
    .filter((w) => w.patch && w.patch.data && w.patch.data.brandVoice)
    .filter((w) => {
      const b = w.patch.data.brandVoice;
      return b.differentiator || b.competitors;
    });
  eq("no run, successful or failed, ever set the ad fields itself", touched.length, 0);
}

console.log(`verify-market-research-run: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
