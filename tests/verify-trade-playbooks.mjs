// Guards the two things that turn the first client's time into a permanent asset: the
// per-trade playbook of what to block and what to ask, and the launch checklist.
//
// Bryson, 2026-08-25: *"there will be a lot of testing and building things from working
// with him and I don't want that time to be wasted."*
//
// 🔴 TWO INVARIANTS, AND THEY ARE BOTH ABOUT HONESTY RATHER THAN FEATURES.
//
// 1. A SEEDED TERM IS A GUESS. A LEARNED ONE IS EVIDENCE. They must never be shown as the
//    same thing. A plausible-sounding guess that blocks a profitable search costs money
//    silently, forever, and nobody ever finds out, because a blocked search leaves no
//    trace. So provenance travels with every entry and a real client can overrule a guess.
//
// 2. A CHECKLIST STEP IS OBSERVED, NEVER TICKED. Same rule that fixed the pipeline panels
//    (KB `house-pipeline-honesty`): a hand-ticked box drifts the moment anything changes
//    underneath it, and a checklist that lies is worse than none because it gets trusted.
//
// 🔴 AND A THIRD THING THIS SUITE EXISTS FOR. The OS is one file running Babel in the
// browser, so it cannot import from netlify/lib and both modules are MIRRORED by hand.
// This suite slices the browser copies out of index.html, executes them, and compares the
// OUTPUT of both against the same inputs. A change to one that the other did not get is a
// failing test rather than a slow drift nobody notices until a campaign is built wrong.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as PB from "../netlify/lib/trade-playbooks.mjs";
import { launchChecklist as serverChecklist, OWNERS } from "../netlify/lib/launch-checklist.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const UI_CODE = strip(UI);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);
const same = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b),
  `\n        server: ${JSON.stringify(a)}\n        browser: ${JSON.stringify(b)}`);

// ── Pull the browser copies out and run them for real ─────────────────────────
const slice = (startRe, endRe) => {
  const i = UI.search(startRe);
  if (i < 0) throw new Error(`could not find ${startRe} in index.html`);
  const j = UI.slice(i).search(endRe);
  if (j < 0) throw new Error(`could not find the end of ${startRe}`);
  return UI.slice(i, i + j);
};
const browserSrc = [
  // Stops before the React context, which is the only part of the mirrored block the
  // plain-Node runner cannot evaluate.
  slice(/^const UNIVERSAL_NEGATIVES = \[/m, /\n\/\/ The learned half of the trade playbooks/),
  slice(/^const OWNERS = \{ you:/m, /\n\/\/ ─── SHARED STYLE SHORTCUTS/),
].join("\n");
const B = new Function(`${browserSrc}
  return { playbookFor, negativeTerms, recordLearning, tradeFor, launchChecklist, OWNERS,
           UNIVERSAL_NEGATIVES, UNIVERSAL_QUESTIONS, TRADES };`)();

// ── 1. 🔴 THE TWO COPIES MUST AGREE, PROVEN BY RUNNING BOTH ───────────────────
{
  const store = {
    apparel: { negative: [{ term: "sublimation", why: "They do not offer it", client: "Stencil & Thread", at: "2026-08-26" }] },
    universal: { negative: [{ term: "template", keep: true, client: "Someone", at: "2026-08-26" }] },
  };
  const niches = ["Screen Printing", "Custom Apparel", "Roofing", "HVAC", "Law Firm", "Dog Grooming", "", null];
  for (const n of niches) {
    same(`the playbook matches for "${n}"`, PB.playbookFor(n, store), B.playbookFor(n, store));
  }
  same("the negative list matches", PB.negativeTerms("Screen Printing", store), B.negativeTerms("Screen Printing", store));
  same("recording a lesson matches",
    PB.recordLearning(store, { tradeId: "apparel", term: "etsy shop", why: "marketplace", client: "X", at: "2026-08-26" }),
    B.recordLearning(store, { tradeId: "apparel", term: "etsy shop", why: "marketplace", client: "X", at: "2026-08-26" }));

  // 🔴 THIS FIXTURE LIST DID NOT DISCRIMINATE ON ITS FIRST DRAFT, and a deliberate break
  // proved it: changing one step's rule from "offer AND locations" to "offer" alone passed,
  // because every hand-written client either had both fields or neither. An equivalence
  // test only proves agreement on the inputs it is given. So each field is now varied
  // INDEPENDENTLY, which is the only way a rule that reads two of them can be caught.
  const FIELDS = [
    // 🔴 ADDED 2026-08-30, AND THE COMMENT ABOVE PREDICTED WHY IT WAS NEEDED. The "signed"
    // step's owner now flips on this field, and desyncing the two copies deliberately still
    // PASSED, because not one fixture here set it: both copies took the same branch and
    // agreed on the wrong thing. A field a rule reads has to appear in this list or the
    // equivalence proves nothing about it. Anyone adding a rule that reads a new field must
    // add that field here in the same commit.
    ["docusignEnvelopeId", "env-1"],
    ["contractSigned", true],
    ["stripeCustomerId", "cus_1"],
    ["googleAdsCustomerId", "123"],
    ["conversionId", "AW-1"],
    ["conversionActions", { form: { label: "L" }, qualified: { resourceName: "r" } }],
    ["campaigns", [{ id: 1 }]],
    ["landingPage", { published: true, headline: "H" }],
    ["adPerf", { totals: { liveCampaigns: 1 } }],
  ];
  const CS_FIELDS = [
    ["mainOffer", "shirts"], ["targetLocations", "Eugene"], ["landingDomain", "quote.x.com"],
    ["crmWebhook", "https://x/y"], ["excludedKeywords", "cheap"], ["keywordNotes", "notes"],
  ];
  const clients = [{}];
  // One at a time, so a rule reading two fields sees them apart.
  for (const [k, v] of FIELDS) clients.push({ name: k, [k]: v });
  for (const [k, v] of CS_FIELDS) clients.push({ name: `cs.${k}`, campaignSetup: { [k]: v } });
  // Then cumulatively, so every partly-finished shape on the way to launch is covered.
  let acc = { name: "cumulative", campaignSetup: {} };
  for (const [k, v] of FIELDS) { acc = { ...acc, [k]: v }; clients.push({ ...acc }); }
  for (const [k, v] of CS_FIELDS) { acc = { ...acc, campaignSetup: { ...acc.campaignSetup, [k]: v } }; clients.push({ ...acc }); }
  ok("the fixtures actually cover a spread of shapes", clients.length > 25, String(clients.length));
  let mismatches = 0;
  for (const c of clients) {
    if (JSON.stringify(serverChecklist(c)) !== JSON.stringify(B.launchChecklist(c))) mismatches++;
  }
  eq("🔴 the two checklist copies agree on every one of them", mismatches, 0);
  same("the owner labels match", OWNERS, B.OWNERS);
  same("the universal block list matches", PB.UNIVERSAL_NEGATIVES, B.UNIVERSAL_NEGATIVES);
  same("the universal questions match", PB.UNIVERSAL_QUESTIONS, B.UNIVERSAL_QUESTIONS);
  eq("and the same trades are known", PB.TRADES.length, B.TRADES.length);
}

// ── 2. 🔴 A GUESS AND A FACT ARE NEVER THE SAME THING ─────────────────────────
{
  const store = { apparel: { negative: [{ term: "sublimation", why: "They do not offer it", client: "Stencil & Thread", at: "2026-08-26" }] } };
  const pb = PB.playbookFor("Screen Printing", store);

  const learned = pb.negatives.filter((n) => n.source === "learned");
  const seeded = pb.negatives.filter((n) => n.source === "seed");
  eq("what a client taught us is marked as learned", learned.length, 1);
  ok("and carries who said it", learned[0].client === "Stencil & Thread", JSON.stringify(learned[0]));
  ok("and when", !!learned[0].at);
  ok("and why, which is what makes it useful in a year", !!learned[0].why);
  ok("while a starting guess is marked as a guess", seeded.length > 5);
  ok("every single entry says where it came from",
    pb.negatives.every((n) => n.source === "seed" || n.source === "learned"));
  ok("and the two are counted separately", pb.counts.learned === 1 && pb.counts.seeded > 5);

  // 🔴 The person who runs the business knows their market better than this file does.
  const keepStore = { apparel: { negative: [{ term: "cricut", keep: true, why: "They sell to craft shops", client: "Someone", at: "x" }] } };
  const kept = PB.playbookFor("Screen Printing", keepStore);
  ok("a client can overrule a guess we made", !kept.negatives.some((n) => n.term === "cricut"),
    JSON.stringify(kept.negatives.filter((n) => /cricut/.test(n.term))));
  ok("and it is not re-added as a learned term either",
    !kept.negatives.some((n) => n.source === "learned" && n.term === "cricut"));

  // A term we guessed at and a client later explained keeps the explanation.
  const both = PB.playbookFor("Screen Printing", { apparel: { negative: [{ term: "etsy", why: "Marketplace shoppers never call", client: "S&T", at: "x" }] } });
  const etsy = both.negatives.filter((n) => /^etsy$/i.test(n.term));
  eq("a term is never listed twice", etsy.length, 1);
  eq("and the client's reason wins over the guess", etsy[0].source, "learned");
}

// ── 3. What a trade actually gets ─────────────────────────────────────────────
{
  eq("a screen printer is recognised", PB.tradeFor("Custom Screen Printing").id, "apparel");
  eq("so is an embroidery shop", PB.tradeFor("Embroidery & Uniforms").id, "apparel");
  eq("a roofer is recognised", PB.tradeFor("Roofing").id, "home-services");
  eq("and a law firm", PB.tradeFor("Family Law Attorney").id, "professional");
  ok("a trade we have never seen gets no playbook", PB.tradeFor("Alpaca Farming") === null);

  // 🔴 THE HONEST OUTCOME FOR AN UNKNOWN TRADE. It still gets the searches nobody should
  // ever pay for, and an EMPTY trade list rather than an invented one.
  const unknown = PB.playbookFor("Alpaca Farming", {});
  ok("but they still block the universal wasters", unknown.negatives.length === PB.UNIVERSAL_NEGATIVES.length);
  ok("with nothing invented for their trade", unknown.trade === null);
  ok("and only the questions every business needs", unknown.questions.every((q) => q.source === "universal"));

  const apparel = PB.playbookFor("Screen Printing", {});
  ok("a known trade gets its own blocks on top", apparel.negatives.length > unknown.negatives.length);
  ok("including the people printing at home", apparel.negatives.some((n) => n.term === "cricut"));
  ok("and the one-off buyers", apparel.negatives.some((n) => /1 shirt/.test(n.term)));
  ok("and its own qualifying questions", apparel.questions.some((q) => q.key === "quantity"));
  ok("each with a reason attached", apparel.questions.filter((q) => q.source === "seed").every((q) => !!q.why));

  // 🔴 There is no honest way to guess what a bad lead looks like in someone else's
  // business, and guessing would be the most damaging invention here.
  eq("nothing is invented about what a bad lead looks like", apparel.disqualifiers.length, 0);
  const taught = PB.playbookFor("Screen Printing", { apparel: { disqualifier: [{ term: "Asks price before saying what they need", why: "Every one was a headache", client: "S&T", at: "x" }] } });
  eq("until a client says so", taught.disqualifiers.length, 1);
  eq("and then it is theirs, attributed", taught.disqualifiers[0].client, "S&T");
}

// ── 4. Writing a lesson in ────────────────────────────────────────────────────
{
  let store = {};
  store = PB.recordLearning(store, { tradeId: "apparel", term: "sublimation", why: "not offered", client: "S&T", at: "2026-08-26" });
  eq("a lesson is stored under its trade", store.apparel.negative.length, 1);
  // Re-teaching the same term must UPDATE it, or the list fills with near-duplicates and
  // an old wrong reason sits beside the corrected one.
  store = PB.recordLearning(store, { tradeId: "apparel", term: "Sublimation", why: "corrected reason", client: "S&T", at: "2026-08-27" });
  eq("saying it again does not stack a duplicate", store.apparel.negative.length, 1);
  eq("it replaces the reason", store.apparel.negative[0].why, "corrected reason");
  ok("blank input changes nothing", JSON.stringify(PB.recordLearning(store, { term: "  " })) === JSON.stringify(store));
  // The original object must not be mutated: React state elsewhere is holding it.
  const before = { apparel: { negative: [] } };
  const after = PB.recordLearning(before, { tradeId: "apparel", term: "x" });
  eq("the original store is left alone", before.apparel.negative.length, 0);
  eq("and the new one has it", after.apparel.negative.length, 1);
  const q = PB.recordLearning({}, { tradeId: "apparel", kind: "question", term: "How many pieces?", required: true });
  ok("a question gets a usable field name", /^how_many_pieces/.test(q.apparel.question[0].key), q.apparel.question[0].key);
}

// ── 5. 🔴 THE CHECKLIST IS OBSERVED, NEVER TICKED ─────────────────────────────
{
  const empty = serverChecklist({});
  eq("a brand new client has nothing done", empty.done, 0);
  eq("and is not ready", empty.ready, false);
  eq("the first thing named is getting it signed", empty.next.id, "signed");
  eq("which is yours", empty.next.owner, "you");

  // Each step flips because the REAL thing became true, not because anyone ticked it.
  const withTracking = serverChecklist({
    conversionId: "AW-1", conversionActions: { form: { label: "L" }, qualified: { resourceName: "r" } } });
  ok("tracking counts as done only when the tag really exists",
    withTracking.steps.find((s) => s.id === "tracking").done);
  ok("a half-finished setup does not count",
    !serverChecklist({ conversionId: "AW-1" }).steps.find((s) => s.id === "tracking").done);
  ok("live means a campaign is actually serving",
    serverChecklist({ adPerf: { totals: { liveCampaigns: 1 } } }).steps.find((s) => s.id === "live").done);
  ok("a built but paused campaign is not live",
    !serverChecklist({ campaigns: [{ id: 1 }] }).steps.find((s) => s.id === "live").done);

  // The one step the OS genuinely cannot see says so, rather than pretending to know.
  // 🔴 "signed" USED TO BE ON THIS LIST and no longer is: the DocuSign watcher polls the
  // envelope and sets `contractSigned` itself. The step still claimed to be hand-tracked,
  // and still told him to email a PDF and take acceptance by reply, on the morning his
  // first real client actually signed. Whoever adds a watcher for the DNS record should
  // take "domain" off this list in the same commit.
  const manual = empty.steps.filter((s) => s.manual).map((s) => s.id).sort();
  same("only the unobservable steps are hand-tracked", manual, ["domain"]);

  // 🔴 AND THE OWNER FLIPS ONCE IT IS SENT. An unsigned contract sitting in someone's
  // inbox is not work Bryson can do, it is someone he is waiting on, and those are
  // different lists. He spent four days on exactly that with his first client while this
  // said the job was his. Both directions asserted, so neither half can rot.
  const unsent = empty.steps.find((s) => s.id === "signed");
  eq("before it is sent, signing is his job", unsent.owner, "you");
  ok("and it tells him to send it", /Contract tab/i.test(unsent.next), unsent.next);
  ok("nothing tells him to chase a signature by email any more",
    !/PDF|by reply/i.test(unsent.next), unsent.next);

  const sent = serverChecklist({ docusignEnvelopeId: "env-1" });
  const sentSigned = sent.steps.find((s) => s.id === "signed");
  eq("once sent, he is waiting on the client", sentSigned.owner, "client");
  ok("so it lands in the chase list rather than the do list",
    sent.waitingOnThem.some((s) => s.id === "signed"));
  ok("and it says the OS is watching for the signature",
    /ticks this itself|fifteen minutes/i.test(sentSigned.next), sentSigned.next);
  ok("a signed contract is not something to chase",
    !serverChecklist({ docusignEnvelopeId: "env-1", contractSigned: true })
      .waitingOnThem.some((s) => s.id === "signed"));

  // A CRM is genuinely optional, so it must never block a launch.
  const noCrm = serverChecklist({
    contractSigned: true, stripeCustomerId: "c", googleAdsCustomerId: "1",
    conversionId: "AW-1", conversionActions: { form: { label: "L" }, qualified: { resourceName: "r" } },
    campaignSetup: { mainOffer: "o", targetLocations: "t", landingDomain: "d", excludedKeywords: "k" },
    landingPage: { published: true, headline: "h" }, campaigns: [{ id: 1 }],
    adPerf: { totals: { liveCampaigns: 1 } } });
  eq("a client with no CRM is still ready to launch", noCrm.ready, true);
  eq("and reads as complete", noCrm.percent, 100);
  ok("the optional step is still listed, just not blocking",
    noCrm.steps.some((s) => s.id === "crm" && s.optional && !s.done));

  // 🔴 THE FIRST VERSION OF THIS COULD NOT FAIL. It claimed to guard the rounding, but
  // with ten required steps every fraction lands on a whole percent, so floor and ceil are
  // identical and the assertion was guaranteed by arithmetic. What is worth guarding is
  // that the percentage counts the REQUIRED steps, which a real bug could get wrong by
  // counting all of them, or by counting the optional one as done.
  const oneShort = { contractSigned: true, stripeCustomerId: "c", googleAdsCustomerId: "1",
    conversionId: "AW-1", conversionActions: { form: { label: "L" }, qualified: { resourceName: "r" } },
    campaignSetup: { mainOffer: "o", targetLocations: "t", landingDomain: "d", excludedKeywords: "k" },
    landingPage: { published: true, headline: "h" }, campaigns: [{ id: 1 }] };   // not live yet
  const nearly = serverChecklist(oneShort);
  eq("nine of ten reads as nine of ten", `${nearly.done}/${nearly.total}`, "9/10");
  eq("and as 90 percent, not 100", nearly.percent, 90);
  eq("and is not ready", nearly.ready, false);
  eq("with the last step named", nearly.next.id, "live");
  // The optional CRM step is absent here, so it must not be counted in either number.
  eq("the optional step is excluded from the total", nearly.total, 10);

  // Waiting on someone else needs chasing, not doing, and the two get confused in one list.
  const waiting = serverChecklist({ contractSigned: true, stripeCustomerId: "c" });
  ok("what you are waiting on someone else for is separated",
    waiting.waitingOnThem.some((s) => s.id === "adaccount"));
  ok("and your own jobs are not in that list",
    !waiting.waitingOnThem.some((s) => s.owner === "you"));
  ok("every step names who has to move", empty.steps.every((s) => !!OWNERS[s.owner]));
  ok("and every unfinished one says what to actually do", empty.steps.every((s) => !!s.next));
}

// ── 6. Wired into the OS, and into the thing that spends money ────────────────
{
  ok("the checklist card exists", /function LaunchChecklistCard/.test(UI_CODE));
  ok("and is on the overview, where a new account is opened", /<LaunchChecklistCard client=\{client\}\/>/.test(UI_CODE));
  ok("it hides itself once the launch is finished", /if\(cl\.ready&&!open\) return null;/.test(UI_CODE));
  ok("BoldLine does not onboard itself", /if\(client\.internal\) return null;/.test(UI_CODE));
  ok("it names one next thing rather than showing eleven boxes", /Next up · \{OWNERS\[cl\.next\.owner\]\}/.test(UI));
  ok("and says which steps it cannot actually see", /The OS cannot see this one/.test(UI));

  ok("the playbook card exists", /function TradePlaybookCard/.test(UI_CODE));
  ok("learned entries are shown apart from guesses", /Learned from real clients/.test(UI));
  ok("with who taught us", /From \{n\.client\}/.test(UI_CODE));
  ok("a lesson can be recorded from the OS", /recordLearning\(store,\{tradeId,kind,term/.test(UI_CODE));
  ok("all three kinds can be taught", /\["disqualifier","A sign of a bad lead"\]/.test(UI_CODE));
  ok("and the reason is asked for, not optional in spirit",
    /This is what makes it useful in a year/.test(UI));

  // 🔴 THE POINT OF ALL OF IT: the playbook has to reach the thing that spends money.
  ok("the campaign builder seeds its blocks from the trade playbook",
    /negativeTerms\(client\.niche, playbooks\.store\)/.test(UI_CODE));
  ok("and no hardcoded list survives beside it",
    !/const negativeDefault = \[\s*"free","cheap"/.test(UI_CODE));

  // Global, not per client: the whole point is that it carries to the NEXT client.
  ok("the store lives on the house account", /tradePlaybooks: next/.test(UI_CODE));
  ok("and is shared rather than threaded through props", /PlaybookCtx\.Provider/.test(UI_CODE));
  // With no house account there is nothing to save into, and that must not throw at the
  // moment somebody presses the button.
  ok("with no house account, saving is disabled rather than broken",
    /save: myAccount \? \(next\) =>/.test(UI_CODE));
  ok("and the card disables its own button", /disabled=\{!save\}/.test(UI_CODE));
}


// ── A seeded trade nobody can select is dead code ─────────────────────────────
// 🔴 THE NICHE STRING IS THE ONLY KEY INTO THE PLAYBOOK. If the dropdown offers no niche
// that matches a trade's pattern, that trade's whole block list silently never applies and
// the campaign launches with the universal list only. Found for real on 2026-08-26: the
// first client is a screen printer and the closest option was "Clothing & Apparel Brand",
// which matches nothing, so 17 apparel-specific blocked searches would have been lost
// without a single error anywhere.
{
  const i = UI.indexOf("const NICHE_GROUPS = {");
  const list = UI.slice(i, UI.indexOf("\n};", i));
  const niches = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  ok("the niche list was found and is not empty", niches.length > 20, `found ${niches.length}`);
  for (const t of PB.TRADES) {
    const reachable = niches.filter((n) => t.match.test(n));
    ok(`🔴 the ${t.id} playbook is reachable from the niche list`, reachable.length > 0,
      `nothing in the dropdown matches ${t.match}, so its blocked searches can never apply`);
  }
  // And the specific one that shipped with the first client.
  const pb = PB.playbookFor("Custom Apparel & Screen Printing", {});
  ok("a screen printer selects into the apparel playbook", pb.trade && pb.trade.id === "apparel");
  ok("and gets meaningfully more blocked searches than the universal list alone",
    pb.negatives.length > PB.playbookFor("Something Unlisted", {}).negatives.length + 10);
}

console.log(`verify-trade-playbooks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
