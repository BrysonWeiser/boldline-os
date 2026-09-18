// What the client is actually billed FOR, when it is not a lead.
// Run: node tests/verify-billing-for-sales.mjs
//
// 🔴 Bryson, 2026-09-16, on Air Suds: the customers *"just buy through website no forms or
// contacting him"*. The agreement defines a Qualified Lead as a form submission, a tracked call
// of thirty seconds, or a chat. **Not one of those can ever happen on that account.** Sending
// that contract would have had a client sign a document in which the billable event is
// impossible — and Bryson had already told the owner "you only pay for results", so the fee has
// to sit on a real result. For a shop that is a SALE.
//
// 🔴 A RENAME, NOT A THIRD PRICING MODEL, AND THAT IS THE DESIGN. The mechanic is identical: a
// count multiplied by a rate, billed in arrears, floor absorbed. Only the NAME of the counted
// thing and its DEFINITION change. A third `pricingModel` would have meant a new branch at
// fifteen call sites and fifteen chances to get one wrong.
//
// 🔴 AND THE DEFINITION IS THE CLIENT'S OWN. BoldLine's Qualified Lead wording is the same on
// every lead-gen agreement and can never be missing. What counts as a sale worth paying for is
// the client's commercial question (Air Suds: a subscription or a bulk order, never a single
// bottle), so the contract quotes the sentence Bryson wrote — which means it can be MISSING,
// and a blank where the billable event belongs is exactly what `contractGaps` exists to stop.

import { readFileSync } from "node:fs";
import { makeContractHTML, resultWords } from "../netlify/lib/contract-shared.cjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const S = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const PIPE   = readFileSync(new URL("../netlify/lib/pipeline-shared.mjs", import.meta.url), "utf8");
const PORTAL = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
const LAND   = readFileSync(new URL("../netlify/functions/generate-landing.mjs", import.meta.url), "utf8");
const SRV = readFileSync(new URL("../netlify/lib/contract-shared.cjs", import.meta.url), "utf8");

const PKG = { id: "m-launch", name: "Launch System", platform: "Meta Ads", price: 400, setup: 750,
  pricingModel: "per_lead", leadFee: true, optimizationFreq: "monthly", adSpend: "$500 to $2,500/mo" };
const BASE = { id: "abc12345", name: "Air Suds", contactName: "Constantine", niche: "Auto Detailing",
  billingMonthly: 0, billingSetup: 0, billingPerLead: 25,
  contractStart: "Sep 20, 2026", contractEnd: "Dec 20, 2026" };
const DEFN = "a new monthly subscription, or a single order of 25 bottles or more";
const saleClient = (o = {}) => ({ ...BASE, billingResultKind: "sale", billingSaleDefinition: DEFN, ...o });

const lead = makeContractHTML(BASE, PKG, "");
const sale = makeContractHTML(saleClient(), PKG, "");

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE DOCUMENT CANNOT MIX THE TWO
// ══════════════════════════════════════════════════════════════════════════════
ok("🔴 a shop's agreement never mentions a Qualified Lead", !/Qualified Lead/.test(sale),
  "the billable event would be a form submission on an account that has no forms");
ok("🔴 and never mentions a lead form, a tracked call or a chat",
  !/lead form|tracked telephone call|chat conversation/i.test(sale),
  "that is the definition that cannot happen here, wherever it is hiding");
ok("🔴 a lead client's agreement is untouched", /Qualified Lead/.test(lead) && !/Qualified Sale/.test(lead),
  "changing the shop case must not change the ordinary one");

// ── What the shop's agreement actually says ───────────────────────────────────
ok("the key terms quote the fee per sale", /\$25 per qualified sale/.test(sale.replace(/<[^>]+>/g, "")),
  "the headline figure still reads 'per qualified lead'");
ok("🔴 clause 4.2 quotes Bryson's own sentence, word for word", sale.includes(DEFN),
  "the client would sign a definition nobody wrote");
ok("and ties it to the campaigns rather than to all sales",
  /reached Client&rsquo;s website as a result of the Campaigns/.test(sale),
  "without this BoldLine is billing for sales it had nothing to do with");

// ── 🔴 THE FOUR THINGS THAT DECIDE THE ARGUMENT, NOT THE PRINCIPLE ────────────
//
// Added 2026-09-16 after Bryson asked what else to think about. Every one of these is a
// sentence somebody would otherwise have to win in month two, from memory, against a client
// who remembers it differently.
ok("🔴 the attribution window is stated, not left to argue",
  /within thirty \(30\) days of clicking one of them/.test(sale),
  "a click today and a purchase in six weeks is arguable either way, forever");
ok("🔴 the CLIENT'S own numbers are the source of truth",
  /Counts are taken from Client&rsquo;s own order records, which govern if they differ/.test(sale),
  "the platform grades its own homework and the client believes their own till");
ok("and the disputes clause names the same source",
  /Sale counts are calculated from Client&rsquo;s own order records/.test(sale),
  "two clauses in one document naming different numbers is the argument, written down");
ok("🔴 a view-through is not a sale", /did not click an advertisement is not a Qualified Sale/.test(sale),
  "Meta counts people who scrolled past and bought later, by default");
ok("🔴 an existing customer is not a new sale",
  /already a customer of the advertised business before the Campaigns began is not a Qualified Sale/.test(sale),
  "BoldLine would be paid for people the client already had");

// The lead agreement keeps its own source and gains none of the store wording.
ok("a lead client's counts still come from campaign tracking",
  /Lead counts are calculated from campaign tracking data/.test(lead));
ok("and a lead client's agreement gained none of this",
  !/order records|view-through|did not click an advertisement/.test(lead),
  "the ordinary case was widened while fixing the store one");
ok("🔴 a refund or chargeback is not a billable sale", /Refunded, cancelled, and chargeback orders are not Qualified Sales/.test(sale),
  "the client pays a fee on money they gave back");
ok("and a fee already taken on one is credited", /credited back on the next invoice/.test(sale));
ok("repeat buyers are counted once", /Repeat purchases by the same customer within thirty \(30\) days are counted once/.test(sale));
ok("the warranty does not promise a margin", /does not warrant any particular level of sales/.test(sale),
  "an $11 product with $5 of margin is exactly where this argument starts");

// ── The rest of the document follows the same word ────────────────────────────
for (const [what, re] of [
  ["the results-only clause", /produce no Qualified Sales in a month/],
  ["the Stripe charging clause", /A month that produces no Qualified Sales produces no charge/],
  ["the disputes clause", /Sale counts are calculated from/],
]) {
  ok(`${what} says sales too`, re.test(sale), "one clause still says leads, in the same document");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 A MISSING DEFINITION IS VISIBLE, AND BLOCKED
// ══════════════════════════════════════════════════════════════════════════════
{
  const blank = makeContractHTML(saleClient({ billingSaleDefinition: "" }), PKG, "");
  ok("🔴 an unset definition renders as [NOT SET], not as nothing", /\[NOT SET\]/.test(blank),
    "a silently empty sentence is a signed agreement with no billable event in it");
  ok("and it is impossible to miss", /<strong>\[NOT SET\]<\/strong>/.test(blank));
}

// contractGaps, lifted out of the OS and run.
const gapsSrc = S.slice(S.indexOf("function contractGaps(cl, pkg)"), S.indexOf("\nconst makeContractHTML="));
ok("contractGaps was extracted", /billingSaleDefinition/.test(gapsSrc), `got ${gapsSrc.length} chars`);
const contractGaps = new Function("PER_LEAD", `${gapsSrc}\nreturn contractGaps;`)({ "Auto Detailing": 15 });
const gapList = (cl) => contractGaps(cl, PKG).map((g) => g.what);
const contractGapsEcom = (cl) => contractGaps(cl, ECOM);

{
  ok("🔴 a shop with no definition cannot send the agreement",
    gapList(saleClient({ billingSaleDefinition: "" })).some((g) => /which purchases count/i.test(g)),
    "the send button would let a blank billable event go out for signature");
  ok("whitespace is not a definition",
    gapList(saleClient({ billingSaleDefinition: "   " })).some((g) => /which purchases count/i.test(g)));
  eq("a shop WITH one has no gap about it",
    gapList(saleClient()).filter((g) => /which purchases count/i.test(g)), []);
  eq("🔴 and an ordinary lead client is never asked for one",
    gapList(BASE).filter((g) => /which purchases count/i.test(g)), [],
    "every existing client would suddenly be unsendable");
  ok("the missing-price gap is worded for sales too",
    gapList(saleClient({ billingPerLead: 0, niche: "Nothing" })).some((g) => /per qualified sale/i.test(g)),
    "it would tell him to set a price per lead on an account that has no leads");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2b. 🔴 A STORE PACKAGE CAN BE BILLED EITHER WAY, AND ONLY ONE FEE EVER RENDERS
//
// Bryson: *"for e-commerce ... falls to a % of the ad spend instead of per sale so how will we
// make that work?"* The answer is that the basis is a CHOICE at the same tier, the same monthly
// minimum and the same setup — the way platform is already a choice and not a price.
//
// 🔴 Before this, flipping the switch on a Store package produced a contract that charged 15% of
// ad spend in 4.2, promised in 4.1 that nothing was owed in a month with no Qualified Sales, and
// explained in 4.4 how sale COUNTS were tallied for a fee not based on counts. Three clauses,
// three different deals, in one document somebody signs.
// ══════════════════════════════════════════════════════════════════════════════
const ECOM = { id:"e-launch", name:"Store Launch", platform:"Meta Ads (ecom)", price:400, setup:800,
  pricingModel:"ad_spend_pct", adSpendPct:15, optimizationFreq:"monthly", adSpend:"$500 to $2,500/mo" };
{
  const onSales = makeContractHTML(saleClient(), ECOM, "");
  // Collapse whitespace: stripping tags leaves runs of spaces between the label and the
  // figure, and a single-space pattern then matches nothing and reports zero fee rows.
  const plain = onSales.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  ok("🔴 a store billed per sale is charged per sale", /Performance Fee \(per qualified sale\)/.test(plain));
  ok("🔴 and the percentage does NOT also appear", !/15% of/.test(plain),
    "two performance fees in one agreement is the worst thing this file can produce");
  ok("the sale definition is there", onSales.includes(DEFN));
  // 🔴 Matched on the VALUE, not on the label. "Performance Fee" also appears as the section
  // heading (followed by "4.1"), so a looser pattern counted the heading as a second fee and
  // reported a contradiction that was not there. Both possible value shapes are listed, so a
  // percentage row reappearing beside the per-sale row still fails.
  const feeRows = plain.match(/Performance Fee (\$[0-9][^A-Z]{0,30}|[0-9]+% of monthly ad spend)/g) || [];
  eq("🔴 exactly one performance fee row in the key terms", feeRows, ["Performance Fee $25 per qualified sale "]);

  // And the ordinary store is untouched.
  const ordinary = makeContractHTML({ ...BASE, billingMonthly: 400, billingSetup: 800 }, ECOM, "");
  const op = ordinary.replace(/<[^>]+>/g, " ");
  ok("🔴 an ordinary store is still billed 15% of ad spend", /15% of monthly ad spend/.test(op));
  ok("and its agreement says nothing about sales", !/Qualified Sale/.test(ordinary),
    "the standard store case was changed while adding the choice");
  ok("nor about leads", !/Qualified Lead/.test(ordinary));
}
{
  // The send gate follows the basis, not the package.
  const gaps = (cl) => contractGapsEcom(cl).map((g) => g.what);
  ok("🔴 a store on sales with no description is blocked",
    gaps(saleClient({ billingSaleDefinition: "" })).some((g) => /which purchases count/i.test(g)));
  ok("and a store on sales with no rate is blocked",
    gaps(saleClient({ billingPerLead: 0 })).some((g) => /per qualified sale/i.test(g)));
  eq("a store on sales is NOT asked for a percentage",
    gaps(saleClient()).filter((g) => /percentage of ad spend/i.test(g)), [],
    "he would be sent to fill in a field his agreement does not use");
  eq("and a store on the percentage is not asked for a sale description",
    gaps({ ...BASE, billingMonthly: 400 }).filter((g) => /which purchases count/i.test(g)), []);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. 🔴 THE DEFINITION GOES INTO A LEGAL DOCUMENT, SO IT IS ESCAPED
// ══════════════════════════════════════════════════════════════════════════════
{
  const nasty = makeContractHTML(saleClient({ billingSaleDefinition: 'a <b>bulk</b> order & "more"' }), PKG, "");
  ok("🔴 markup typed into the box cannot re-shape the agreement", !/a <b>bulk<\/b> order/.test(nasty),
    "a stray tag could hide or bold a term in a document someone signs");
  ok("and it still reads correctly", /a &lt;b&gt;bulk&lt;\/b&gt; order &amp; &quot;more&quot;/.test(nasty));
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. 🔴 THE TWO COPIES OF THE VOCABULARY AGREE
//
// The OS cannot import the server file, so `resultWords` exists twice. Both are RUN and
// deep-compared, rather than eyeballed — the habit that has caught four drifts in this repo.
// ══════════════════════════════════════════════════════════════════════════════
{
  const lift = (src) => {
    const i = src.indexOf("const resultWords = (cl) => {");
    return new Function(src.slice(i, src.indexOf("\n};", i) + 3) + "\nreturn resultWords;")();
  };
  const osW = lift(S), srvW = lift(SRV);
  // Compared FIELD BY FIELD, and reported as the field name plus a short excerpt. A whole-object
  // deepEqual on these prints two four-thousand-character clauses per failure and buries every
  // other result in the run.
  const clip = (v) => { const t = String(v); return t.length > 70 ? t.slice(0, 70) + "…" : t; };
  for (const cl of [BASE, saleClient(), saleClient({ billingSaleDefinition: "" }),
                    saleClient({ billingSaleDefinition: '<i>x</i> & "y"' }),
                    { billingResultKind: "SALE" }, {}, null]) {
    const who = `${JSON.stringify(cl && cl.billingResultKind)}/${JSON.stringify(clip(cl && cl.billingSaleDefinition))}`;
    const a = osW(cl), b = srvW(cl);
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    const bad = keys.filter((k) => a[k] !== b[k]);
    ok(`🔴 both copies agree for ${who}`, bad.length === 0,
      bad.map((k) => `${k}: OS "${clip(a[k])}" vs server "${clip(b[k])}"`).join(" | "));
  }
  // And the comparison can fail, so it is not comparing two identical nothings.
  ok("🔴 the comparison is capable of failing", JSON.stringify(osW(BASE)) !== JSON.stringify(osW(saleClient())),
    "lead and sale produce the same words, so this check proves nothing");
  // An unrecognised value is a LEAD. Anything else would silently reword a real agreement.
  eq("only the exact word 'sale' switches it", osW({ billingResultKind: "SALE" }).kind, "lead");
  eq("and no client at all is a lead", osW(null).kind, "lead");
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. THE CLIENT'S PORTAL SAYS THE SAME WORD AS THEIR CONTRACT
// ══════════════════════════════════════════════════════════════════════════════
{
  const { _internal } = await import("../netlify/functions/portal.mjs");
  const port = (o) => _internal.makePortalHTML({ ...saleClient(o), packageId: "m-launch",
    portalToken: "t", leadToken: "l", leadsLog: [], commLog: [], mediaLibrary: [],
    campaignSetup: {}, brandVoice: {}, adBudget: "$1,000/mo", stage: "onboarding" },
    _internal.findPkg("m-launch"), o && o.notice);
  const shop = port({});
  ok("🔴 a shop's portal does not say they pay per qualified lead", !/per qualified lead/i.test(shop),
    "the portal would contradict the agreement they signed");
  const lead2 = _internal.makePortalHTML({ ...BASE, packageId: "m-launch", portalToken: "t",
    leadToken: "l", leadsLog: [], commLog: [], mediaLibrary: [], campaignSetup: {}, brandVoice: {},
    adBudget: "$1,000/mo", stage: "onboarding" }, _internal.findPkg("m-launch"));
  ok("and a lead client's portal still does", /per qualified lead/i.test(lead2),
    "the ordinary case was broken while fixing the new one");

  // 🔴 Dual copy: the OS preview is a second implementation of this page.
  // 🔴 The end anchor is searched FROM the start. contractGaps sits ABOVE makePortalHTML in
  // this file, so an unanchored search returned an index before the start and sliced nothing —
  // a dual-copy check that silently compared an empty string against the server.
  const pStart = S.indexOf("const makePortalHTML=(cl,pkg,notice)=>{");
  const osPortal = S.slice(pStart, S.indexOf("function LandingOptionsCard(", pStart));
  ok("the OS copy of the portal was found", osPortal.length > 5000, `got ${osPortal.length} chars`);
  const srvPortal = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
  // 🔴 The portal stopped carrying a private three-word copy on 2026-09-17 and now asks the same
  // `resultWords` the agreement asks, so the fragments pinned here are the shared ones. Every
  // other line in the portal that names the billable thing had gone on saying "lead" to a client
  // billed per sale, because the small copy only covered three of them.
  for (const frag of ["RW.per", "RW.many", "const W = resultWords(cl);",
                      'const noun = W.itNoun, nouns = W.itNoun + "s";']) {
    ok(`🔴 the OS preview carries "${frag}"`, osPortal.includes(frag) && srvPortal.includes(frag),
      "the Live Client View is a second copy of this page and must not drift");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5b. 🔴 AN EXISTING CLIENT'S AGREEMENT DID NOT MOVE A SINGLE BYTE
//
// Bryson asked whether any of this touched the current packages or pricing. It should not have,
// and one thing HAD: genericising clause 4.2 so it would read for sales changed "the
// Per-Qualified-Lead Fee stated above" into "the fee stated above" on EVERY lead agreement,
// including ones already signed. A contract renders fresh every time it is opened, so a signed
// agreement would have started showing wording nobody signed — the exact thing the terms
// versioning exists to prevent (KB `contract-terms-versioning`).
//
// Caught by rendering the OLD file against the NEW one, which is the only way to see it: every
// assertion in this suite passed the whole time, because none of them was looking at the
// sentence that moved.
// ══════════════════════════════════════════════════════════════════════════════
{
  eq("🔴 a lead agreement still names the per-lead fee exactly",
    /The Performance Fee for a month is the ([^.]+?) stated above/.exec(lead.replace(/<[^>]+>/g, ""))[1],
    "Per-Qualified-Lead Fee");
  eq("and a sale agreement names its own", 
    /The Performance Fee for a month is the ([^.]+?) stated above/.exec(sale.replace(/<[^>]+>/g, ""))[1],
    "Per-Qualified-Sale Fee");
  // The whole-document version of the same guard: every clause of a lead agreement, compared
  // against the text that shipped before any of this existed.
  const FROZEN = [
    "Performance Fee (per qualified lead)",
    "the Per-Qualified-Lead Fee stated above multiplied by the number of Qualified Leads",
    "(a) submits a lead form, (b) places a tracked telephone call lasting thirty (30) seconds or longer, or (c) initiates a text or chat conversation",
    "Lead counts are calculated from campaign tracking data",
    "Agency does not warrant that any lead will become a paying customer",
    "A month that produces no Qualified Leads produces no charge",
  ];
  const plain = lead.replace(/&rsquo;/g, "\u2019").replace(/<[^>]+>/g, "");
  for (const f of FROZEN) {
    ok(`🔴 unchanged for existing clients: "${f.slice(0, 44)}…"`, plain.includes(f),
      "a signed agreement renders fresh every time it is opened, so this is wording nobody signed");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. 🔴 THE AD SET IS BUILT TO MATCH THE AGREEMENT
//
// The contract says a purchase by someone who did not click is not a Qualified Sale. Meta's
// DEFAULT is 7-day click plus 1-day view, so without this the platform reports a number the
// agreement does not recognise — and, worse, optimises toward people who look rather than
// people who buy, because the attribution setting is the signal delivery learns from.
// ══════════════════════════════════════════════════════════════════════════════
{
  const META = readFileSync(new URL("../netlify/functions/meta-ads.mjs", import.meta.url), "utf8");
  const code = META.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
  const i = code.indexOf("optimization_goal: chaseLeads");
  const adset = code.slice(i, i + 1800);
  ok("🔴 the ad set asks for clicks only", /attribution_spec: JSON\.stringify\(\[\{ event_type: "CLICK_THROUGH"/.test(adset),
    "Meta's default counts a scroll-past as a conversion, which the agreement says is not a sale");
  // 🔴 Scoped to the ad set CREATION payload, which is what this guards. A file-wide ban was
  // wrong and broke the moment the reader learned to DETECT view-throughs on an existing ad set
  // so the OS could offer to turn them off. Banning the word everywhere bans the fix as well as
  // the bug.
  ok("🔴 and does not ask for view-throughs", !/VIEW_THROUGH/.test(adset),
    "one of these in the creation payload puts Meta's default straight back");
  ok("🔴 while an EXISTING ad set can still be spotted and fixed", /countsViewThrough/.test(code) && /setAttributionClicksOnly/.test(code),
    "campaigns built before this, by hand, or inherited with a client keep the default forever");
  ok("it is set on the AD SET, where Meta reads it", i > 0 && adset.includes("attribution_spec"),
    "attribution lives on the ad set; anywhere else is ignored");
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. 🔴 HE IS TOLD, ON THE SCREEN HE READS BEFORE THE CALL
//
// The per-sale basis is deliberately NOT on the public site: it depends on the shop being able
// to track purchases, which cannot be known before the call, and advertising it means
// withdrawing it from shops that cannot. So the two things that make it usable are (a) a
// question on the call that settles it, and (b) a note where he actually looks. Without both,
// the feature exists and is never offered.
// ══════════════════════════════════════════════════════════════════════════════
{
  // The question, run out of the real list.
  const qsrc = S.slice(S.indexOf("const MEETING_QUESTIONS = ["), S.indexOf("\n];", S.indexOf("const MEETING_QUESTIONS = [")) + 3);
  const QS = new Function(qsrc + "\nreturn MEETING_QUESTIONS;")();
  const q = QS.find((x) => x.id === "salesTracking");
  ok("🔴 the call asks whether they can track their own sales", !!q,
    "without it the per-sale offer is never made, and the whole feature sits unused");
  if (q) {
    ok("it is asked on the FIRST call, not buried in intake", q.ask === "first",
      "the answer decides how they are billed, so it cannot wait until after they sign");
    ok("🔴 and the answer lands somewhere on the client", /^[a-zA-Z]+(\.[a-zA-Z]+)*$/.test(String(q.path || "")),
      "a question with no path is typed on a call and thrown away");
    ok("it asks about sales from the ads, not sales in general", /which sales came from the ads/i.test(q.q),
      "a shop can always see its own orders; the question is whether it can attribute them");
    ok("and it says what it decides", /per sale/i.test(q.feeds || ""));
  }
  // The note, scoped to the Deal Prep screen and to the shop group only.
  const dp = S.slice(S.indexOf("function DealPrepScreen("), S.indexOf("function LeadScoutScreen("));
  ok("🔴 the reminder is on the Deal Prep screen", /Only you see this/.test(dp),
    "it landed in another component, or nowhere");
  ok("🔴 and only on the E-Commerce group", /\{key==="ecom"&&\(/.test(dp),
    "a shop-only note shown on every package is noise he will learn to skip");
  ok("it names where to set it afterwards", /Billing for &rarr; Sales/.test(dp));
  // 🔴 The public site must NOT carry it. This is the deliberate half of the decision.
  const SITE = readFileSync(new URL("../marketing-site/index.html", import.meta.url), "utf8");
  ok("🔴 the per-sale option is still not advertised publicly", !/per qualified sale|per sale/i.test(SITE),
    "it depends on the shop's tracking, so promising it in public means withdrawing it on the call");
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. 🔴 FIXING AN AD SET THAT IS ALREADY RUNNING
//
// Bryson: *"is there a way we can add that new update for the clicks without having to build a
// whole new campaign?"* Everything the OS builds from 2026-09-16 is click-only, but his own
// first campaign, anything built by hand in Ads Manager, and anything inherited with a new
// client still carries Meta's default of 7-day click PLUS 1-day view.
// ══════════════════════════════════════════════════════════════════════════════
{
  const META = readFileSync(new URL("../netlify/functions/meta-ads.mjs", import.meta.url), "utf8");
  const code = META.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  ok("🔴 the reader asks Meta for the attribution it is using", /attribution_spec/.test(code) && /fields: "id,name,status,effective_status,daily_budget[^"]*attribution_spec"/.test(code),
    "without the field the OS cannot know which ad sets need fixing, so the warning never appears");
  ok("and reports it per ad set", /countsViewThrough: \(set\.attribution_spec \|\| \[\]\)/.test(code));

  const i = code.indexOf("async function setAttributionClicksOnly");
  const fn = code.slice(i, i + 900);
  ok("🔴 the write exists", i > 0);
  ok("🔴 and writes CLICK_THROUGH only", /event_type: "CLICK_THROUGH"/.test(fn) && !/VIEW_THROUGH/.test(fn),
    "a fix that leaves the view window on is not a fix");
  ok("🔴 it touches nothing that spends", !/(daily_budget|status|targeting|bid_amount)/.test(fn),
    "attribution is a measurement setting; a write that also changed budget or status could not be offered as one tap");
  ok("the window is validated, not passed through", /\[1, 7\]\.includes/.test(fn),
    "Meta accepts 1 or 7 and rejects the rest, so an unchecked number fails at the API instead of here");
  ok("a missing ad set id is refused", /adSetId required/.test(fn));
  ok("it is reachable over HTTP", /action === "setAttribution"/.test(code));

  // The OS side: the warning only shows when true, and says what it costs.
  const screen = S.slice(S.indexOf("function CampaignManagerScreen("), S.indexOf("\nfunction ", S.indexOf("function CampaignManagerScreen(") + 40));
  ok("🔴 the warning is shown only for an ad set that really counts view-throughs",
    /\{!isG&&g\.countsViewThrough&&\(/.test(S),
    "a warning on every ad set is a warning he learns to ignore");
  ok("and only on Meta", /!isG&&g\.countsViewThrough/.test(S),
    "Google has no such setting, so the row would be nonsense there");
  ok("🔴 it warns that Meta has to re-learn before the press, not after",
    /re-learn who to show the ad to/.test(S),
    "narrowing the window resets the learning phase, which is cheap on a new campaign and not on an old one");
  ok("and says plainly that nothing else changes", /Nothing else changes: no budget, no targeting/.test(S));
  ok("the press calls the real action", /metaCall\(\{action:"setAttribution",adSetId:g\.id\}\)/.test(S));
  ok("🔴 and it re-reads afterwards, so the warning clears itself",
    /pieceAction\(r,g\.id,\(\)=>metaCall\(\{action:"setAttribution"/.test(S),
    "pieceAction force-reloads the campaign; without it the amber note sits there after it is fixed");
}

// ── 🔴 THE RENAME HAS TO REACH EVERY SCREEN, NOT JUST THE AGREEMENT ──────────
//
// Bryson, 2026-09-17, looking at a client switched to Sales: *"make sure everything has the
// correct terminology"*. The switch renamed the contract and the portal on the day it was built,
// and left the OS around it saying "lead" in fifteen places, including the summary line directly
// above the switch itself. A screen that contradicts the document it prints is how someone stops
// trusting either.
{
  // The Billing card takes its words from the SAME helper the contract asks, so the two cannot
  // drift: flip the switch and both move together.
  const at = S.indexOf("function BillingCard");
  const card = S.slice(at, S.indexOf("\nfunction ", at + 20));
  ok("🔴 the Billing card uses the contract's own vocabulary",
    /const W = resultWords\(client\);/.test(card)
    && /const itNoun = W\.itNoun, itPlural = W\.itNoun \+ "s";/.test(card),
    "a second vocabulary in the OS is a second thing to forget when the switch is flipped");

  const stillHard = [
    "Approve some leads first.",
    "No billable leads right now.",
    "You approve qualified leads, and each approved batch",
    "Each approved batch of qualified leads is invoiced",
    "No new leads to bill. Delivered leads show up here",
  ].filter((d) => card.includes(d));
  ok("and the lines a per-sale client would read are no longer hardcoded",
    stillHard.length === 0, stillHard.join(" | "));

  // 🔴 A STORE PACKAGE BILLS A PERCENTAGE BY DEFAULT, and the client's own Package tab quoted
  // that percentage beside an agreement saying $25 per sale. The client's basis has to override
  // the package's model, or the two screens disagree about the same deal.
  const at2 = S.indexOf("const pkgPerfLabel = ");
  const fn = S.slice(at2, S.indexOf("\n};", at2) + 3);
  ok("🔴 the package fee label can follow the client, not just the package",
    /resultKind/.test(fn) && /per qualified sale/.test(fn),
    "it cannot know what this client actually agreed");
  ok("🔴 and the sale branch wins over the percentage",
    fn.indexOf('=== "sale"') > 0 && fn.indexOf('=== "sale"') < fn.indexOf('"ad_spend_pct"'),
    "the percentage branch returning first leaves a per-sale store client reading as a percentage");
  // 🔴 EVERY SCREEN THAT NAMES THE BILLABLE THING, not just the one he happened to be looking
  // at. Found by rendering each client tab in a browser as a per-sale client and scanning the
  // TEXT ON SCREEN, which is how the scorecard and the overview revenue line turned up after
  // the Billing card was already fixed.
  ok("🔴 the scorecard counts this client's own unit",
    /\[`Qualified \$\{SW\.itNoun\}s`, String\(qual\)\]/.test(S)
    && /\[`Cost per qualified \$\{SW\.itNoun\}`/.test(S)
    && /const SW = resultWords\(client\);/.test(S),
    "a store client was shown Qualified leads and Cost per qualified lead on the same screen as "
    + "an agreement that never uses the word");
  ok("🔴 the overview revenue line does too",
    /\/qualified \{client\.billingResultKind==="sale"\?"sale":"lead"\}<\/span>/.test(S));
  // 🔴 THE FEE FINDER IS HIDDEN RATHER THAN RENAMED. It works from job value and close rate to
  // price a LEAD. Relabelling it would dress lead-to-customer arithmetic up as something it is
  // not: a sale is already the customer, so there is no close rate left to apply.
  ok("🔴 the lead fee finder is not offered on a per-sale client",
    /\{W\.kind==="lead"&&<button onClick=\{\(\)=>setShowFeeFinder/.test(S),
    "renaming it would be worse than hiding it, because the arithmetic underneath is about leads");

  // 🔴 THE PORTAL MUST NOT PROMISE A COUNT THE OS CANNOT PRODUCE. Bryson, 2026-09-17: *"are we
  // able to track the sales even though it will go through his shopify when they actually buy"*.
  // No. Leads arrive through OUR form so the OS sees every one; a sale happens on the client's
  // own store, which the OS has no connection to, and the agreement says counts come from the
  // client's own order records. So the empty state cannot say a sale will appear here the moment
  // it arrives, on the one page the client can check.
  const PORTAL_SRC = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
  ok("🔴 a sale client's portal does not promise automatic sale tracking",
    /counted from your own order records, not from ours/.test(PORTAL_SRC)
    && /W\.kind === "sale"\s*\n?\s*\? "Sales are counted from your own order records/.test(PORTAL_SRC),
    "an empty list under a promise that it fills itself is a lie the client is best placed to spot");
  ok("and a lead client still gets the real promise",
    /Every enquiry your ads bring in will appear here/.test(PORTAL_SRC));

  // 🔴 THE INVOICE IS THE ONE EMAIL WHERE THE WRONG WORD IS A WRONG BILL. A client billed per
  // Qualified Sale was being invoiced for "Qualified leads": a line item naming something their
  // agreement never mentions, sent to the person paying it.
  {
    const EM = readFileSync(new URL("../netlify/lib/client-emails-shared.mjs", import.meta.url), "utf8");
    const AUTO = readFileSync(new URL("../netlify/lib/client-email-auto.mjs", import.meta.url), "utf8");
    ok("🔴 the invoice names the unit this client is billed for",
      /const sale = String\(c\.resultKind \|\| ""\) === "sale";/.test(EM)
      && /rows\.push\(\[`\$\{unitMany\}/.test(EM),
      "an invoice for Qualified leads under a per-sale agreement is a charge for something the "
      + "contract does not mention");
    ok("and the zero-fee version too", /did not produce any \$\{unitLower\}/.test(EM));
    ok("🔴 and the sender actually passes the client's basis",
      /resultKind: cl\.billingResultKind \|\| "",/.test(AUTO),
      "the template can tell the difference but never learns which one this client is");
    ok("an unset basis is a lead, which is every existing client",
      /String\(c\.resultKind \|\| ""\) === "sale"/.test(EM));
  }

  // ── 🔴 SALES ARE ENTERED, NOT DETECTED ──────────────────────────────────────
  // Bryson, 2026-09-17: *"are we able to track the sales even though it will go through his
  // shopify when they actually buy"*. No. A lead arrives through OUR form so the OS sees every
  // one; a purchase happens on the client's own store, which the OS cannot see at all. The
  // agreement already names the mechanism: counts come from the client's own order records, and
  // those records govern. So the number is agreed and then recorded.
  {
    const bat = S.indexOf("function BillingCard");
    const bcard = S.slice(bat, S.indexOf("\nfunction ", bat + 20));
    ok("🔴 there is somewhere to record an agreed sale count",
      /Record the sales you agreed/.test(bcard) && /setSalesCount/.test(bcard),
      "without it a per-sale client can never be billed at all, because nothing counts for them");
    ok("and it says why the OS cannot do it by itself",
      /their own store, so the OS cannot see sales by itself/.test(bcard));

    // 🔴 ROWS IN leadsLog, not a parallel list. The fee is per sale and the queue, the invoice,
    // the whichever-is-higher arithmetic and the pre-invoice reminder all price per ROW. A
    // separate list is a second source of truth none of them read.
    ok("🔴 recorded sales feed the same machinery that bills leads",
      /leadsLog:\[\.\.\.rows,\.\.\.\(client\.leadsLog\|\|\[\]\)\]/.test(bcard),
      "a parallel salesLog is how a number reaches a screen and never a bill");
    ok("and each one records where it came from",
      /source:"client_records"/.test(bcard) && /name:"Sale from their records"/.test(bcard),
      "nothing may later mistake a recorded sale for an enquiry that arrived through a form");
    ok("it is written into the client's history too",
      /Recorded \$\{n\} qualified sale/.test(bcard));

    // 🔴 THIS BILLS MONEY, so a slipped keystroke must not become an invoice.
    ok("🔴 a zero or empty count is refused", /if\(!\(n>0\)\)\{ setSalesMsg/.test(bcard));

    // 🔴 IT ASKS, IT DOES NOT REFUSE. Bryson, 2026-09-17: *"instead of not letting me put more
    // than 50 make it so instead when i press record sales if its over a certain number have the
    // os tell me and confirm that is correct"*. The first version was a ceiling, which is the
    // lazy shape: it turns a real month into a dead end and teaches him to work around his own
    // OS, while the thing it guarded against, 3 mistyped as 33, sails straight under it.
    ok("🔴 an unusual count asks rather than refuses",
      /setSalesConfirm\(\{n,note:salesNote\.trim\(\),amount:total\}\)/.test(bcard)
      && !/setSalesMsg\("That is a lot at once/.test(bcard),
      "a hard ceiling is a dead end on a real month and does not catch the typo it was aimed at");
    ok("and the question names the MONEY, not just the count",
      /at \{money\(perLeadRate\)\} each, so/.test(bcard) && /money\(salesConfirm\.amount\)/.test(bcard),
      "a typo is obvious the moment it is priced and invisible as a bare number");
    ok("🔴 it asks on an unusual count OR an unusual bill",
      /if\(n>SALES_CONFIRM_COUNT\|\|total>SALES_CONFIRM_AMOUNT\)/.test(bcard),
      "either alone misses a case: 40 sales at $5 is routine, 8 at $400 is not");
    ok("both thresholds are real numbers",
      /const SALES_CONFIRM_COUNT = \d+;/.test(S) && /const SALES_CONFIRM_AMOUNT = \d+;/.test(S));
    ok("saying no records nothing", /onClick=\{\(\)=>setSalesConfirm\(null\)\}/.test(bcard));
    ok("🔴 and saying yes records exactly what was shown",
      /const c=salesConfirm; setSalesConfirm\(null\); recordSales\(c\.n,c\.note\);/.test(bcard),
      "re-reading the input box here would record whatever he typed AFTER being asked");
    ok("🔴 both paths go through one recorder",
      (bcard.match(/recordSales\(/g) || []).length === 2 && /const recordSales=\(n,note\)=>\{/.test(bcard),
      "the quick path and the confirmed path both call it; two copies of the write is how a fix "
      + "lands on only one of them");
    ok("the box only appears for a client billed that way",
      bcard.indexOf('client.billingResultKind==="sale"&&(') < bcard.indexOf("Record the sales you agreed"),
      "a lead client has no use for it and every extra control is a chance to misread the screen");
  }

  ok("the client's own package card passes it",
    /pkgPerfLabel\(pkg,perLead,client&&client\.billingResultKind\)/.test(S),
    "the override exists but the one screen that needs it does not use it");
}


// ── 🔴 AND EVERY TAB OF HIS, NOT JUST THE ONE HE WAS LOOKING AT ──────────────
//
// Bryson, 2026-09-17, sending a screenshot of Air Suds' Overview and then the tab strip:
// *"make sure the over view is correct as well in the os for him"* / *"make sure these tabs are
// good as well"*. Found by DRIVING the OS in a browser as a per-sale client and reading the
// words on every tab, which is the only way this gets found: the tiles, the tab name, the health
// rows, the pipeline steps and the report prompt are five different files' worth of hardcoded
// nouns, and grep for "lead" returns nine hundred hits.
//
// After the sweep the only tab that still says "lead" is the Contract tab, which says it on the
// **Billing for: Leads / Sales** switch itself. That one is correct: it is the control that
// decides the word everything else uses.
{
  ok("🔴 the tab strip itself follows the client",
    /\["leads",resultWords\(client\)\.kind==="sale"\?"Sales":"Leads"\]/.test(S),
    "a tab called Leads on a shop account is on every screen of theirs");

  // The Overview tiles. These read the lead LOG, which for a store client holds the sales
  // recorded from their own order records, so the label is the only thing that was ever wrong.
  ok("🔴 the overview counts sales for a store client",
    /\{l:sale\?"Sales":"Leads",v:st\.leadsTotal\}/.test(S));
  ok("🔴 and names the cost per sale",
    /\{l:sale\?"Avg cost per sale":"Avg CPL",v:st\.cpl!=null/.test(S));

  // The health score rows, and the target they are judged against.
  ok("🔴 the health rows do too",
    /resultWords\(client\)\.kind==="sale"\?"Sales coming in":"Leads coming in"/.test(S)
    && /resultWords\(client\)\.kind==="sale"\?"Cost per sale on target":"CPL on target"/.test(S));
  ok("🔴 and a store client is judged against their OWN rate, not the per-lead niche table",
    /const t=resultWords\(client\)\.kind==="sale"\?\(client\.billingPerLead!=null\?client\.billingPerLead:0\):\(PER_LEAD\[client\.niche\]\|\|50\)/.test(S),
    "the niche table prices LEADS and has no row for a shop, so this would tick a $25 sale "
    + "against a $50 lead and call it on target");

  // The tab's own contents.
  {
    const at = S.indexOf("function LeadsTabContent");
    const tab = S.slice(at, S.indexOf("\nfunction ", at + 20));
    ok("the tab knows which it is holding", /const RW = resultWords\(client\);/.test(tab) && /const isSale = RW\.kind === "sale";/.test(tab));
    ok("its heading follows", /\{isSale\?"Sales":"Leads"\} \(\{leads\.length\}\)/.test(tab));
    // 🔴 THE EMPTY STATE CANNOT JUST SWAP THE NOUN. A lead arrives here on its own; a sale is
    // typed in from the client's order records, because the purchase happens on their store and
    // the OS has no connection to it. "Sales will show up here automatically" would have him
    // waiting for something that is never coming.
    ok("🔴 the store empty state says where sales actually come from",
      /Sales are counted from \{client\.name\}'s own order records/.test(tab)
      && /Record them on the Contract tab, under Billing/.test(tab));
    ok("🔴 and never promises they arrive on their own",
      !/Sales from \{client\.name\}'s landing page/.test(tab) && !/sales.{0,40}will show up here automatically/i.test(tab));
    ok("the lead-gen empty state is untouched",
      /Leads from \{client\.name\}'s landing page and tracking number will show up here automatically/.test(tab));
    ok("and the row controls follow too", /Delete \{isSale\?"sale":"lead"\}/.test(tab));
  }

  // The live performance card's caption, which divides spend by whichever it counted.
  ok("🔴 the performance card names what it divided by",
    /leadLabel: resultWords\(client\)\.kind==="sale"\?"Sales":"Leads"/.test(S)
    && /cplSub: resultWords\(client\)\.kind==="sale"\?"spend ÷ sales":"spend ÷ leads"/.test(S));
}


// ── 🔴 THE PIPELINE DESCRIBES WORK A SHOP ACCOUNT CANNOT HAVE ────────────────
//
// Two of the twenty steps are lead-gen only: the quality analyst scores leads, and the
// automation engineer answers enquiries nobody sends, because a store client's customer clicks
// through and buys. The Pipeline tab was reporting "Lead capture and auto-reply are live" as
// DONE for a client with no form anywhere. That is not a wording slip, it is a step reported
// complete that was never possible.
{
  ok("🔴 the quality analyst is renamed for a store client",
    /const botName = \(id, cl\) => \(id === "leads" && isSaleClient\(cl\)\)\s*\n?\s*\? "Sale Quality Analyst"/.test(S),
    "a report listing 'Lead Quality Analyst' among a shop's pending steps describes impossible work");
  ok("and the pipeline summary uses the renamer rather than the raw map",
    /name: botName\(id, client\)/.test(S));
  ok("🔴 the automation step stops claiming auto-reply is live",
    /saleClient \? "Click tracking runs through to their store" : "Lead capture and auto-reply are live"/.test(S));
  ok("and the quality step counts sales", /`Scoring \$\{leads\} \$\{saleClient \? "sale" : "lead"\}/.test(S));
  ok("the step list itself is renamed where it is given a client",
    /name:"Sale Quality Analyst"/.test(S) && /There is no enquiry form and no auto-reply on a shop account/.test(S));

  // 🔴 BOTH COPIES. The server has its own BOT_NAMES and its own pipelineProgress, and the
  // report quotes the pending step names, so a rename in one place only is a report that
  // disagrees with the screen it describes.
  ok("🔴 the server copy renames it too",
    /export const botName = \(id, cl\) => \(id === "leads" && isSaleClient\(cl\)\)/.test(PIPE)
    && /name: botName\(id, client\)/.test(PIPE));

  // 🔴 `isSaleClient` writes the rule out instead of calling resultWords, because the pipeline
  // suite pulls these helpers out of index.html and runs them alone. Pinned so the two cannot
  // drift into disagreeing about the same client.
  const isSale = new Function("return " + (S.match(/const isSaleClient = \(cl\) => [^;]+;/) || [""])[0].replace(/^const isSaleClient = /, "").replace(/;$/, ""))();
  for (const cl of [{ billingResultKind: "sale" }, { billingResultKind: "lead" }, {}, null, { billingResultKind: "" }]) {
    ok(`🔴 isSaleClient agrees with resultWords for ${JSON.stringify(cl)}`,
      isSale(cl) === (resultWords(cl).kind === "sale"));
  }
}


// ── 🔴 THE REPORT THE OS ITSELF GENERATES ────────────────────────────────────
//
// There are two report prompts: the scheduled one in report-shared.mjs and this one, behind the
// Generate button on the Reports tab. Both are read to the same client. A data block headed
// "Leads Generated" makes the writer invent lead-quality commentary for a business with no
// leads, and hands it the platform's conversion figure to quote as a sale nobody counted.
{
  ok("🔴 the OS report names sales for a store client",
    /\$\{isSale\?"Sales Recorded":"Leads Generated"\}: \$\{st\.leadsTotal\}/.test(S)
    && /Average Cost Per \$\{Unit\}/.test(S));
  ok("🔴 and tells the writer where the count came from",
    /from the client's own order records, recorded by hand/.test(S)
    && /never quote a conversion figure from the ad platforms as a sale count/.test(S));
  ok("🔴 and the OUTPUT FORMAT asks for the same thing",
    /2\. Performance This Period \(\$\{unit\}s, cost per \$\{unit\} vs target, what's working\)/.test(S),
    "a data block naming sales under an instruction saying 'leads, CPL vs target' loses to the "
    + "instruction, which is the more specific of the two");
  ok("the on-screen data tiles agree with the prompt",
    /\{l:isSale\?"Sales":"Leads", v:st\.leadsTotal/.test(S)
    && /\{l:isSale\?"Cost\/sale":"CPL"/.test(S));
}


// ── 🔴 THE ONE QUESTION HE IS NOT GOING TO ASK ───────────────────────────────
//
// Bryson, 2026-09-17: *"im not going to ask him where his product is made instead put that as a
// question for e-commerce brands in the os that they can fill out if they want"*. Where a thing
// is made is one of the strongest lines on a page selling it, so it is worth a box. It is worth
// nothing as a question he has to put to a client who may not want to answer it. So it lives in
// the list, the client can type it themselves, and blank means we never mention it.
{
  const q = (S.match(/\{ id:"madeIn",[\s\S]{0,400}?\},/) || [""])[0];
  ok("🔴 the question exists and is asked at intake, not on the sales call", /ask:"intake"/.test(q), q.slice(0, 120));
  ok("and it lands where the copy writers already read", /path:"brandVoice\.madeIn"/.test(q));
  ok("🔴 and it says out loud that it is optional", /[Oo]ptional/.test(q), q);

  // 🔴 BOTH COPIES OF THE PORTAL FORM. The OS carries a preview copy of the client's onboarding
  // form, and a box added to one and not the other is a box that appears in the preview and not
  // in the thing the client actually fills in, or the reverse.
  for (const [where, src] of [["the client's portal", PORTAL], ["the OS preview of it", S]]) {
    ok(`🔴 ${where} offers the box`, /data-key="brandVoice\.madeIn"/.test(src));
    ok(`and ${where} says it is optional and may be left blank`,
      /Where it is made \(optional\)/.test(src) && /Leave it blank and we simply will not mention it/.test(src));
  }
  // It sits under the card that asks where people buy, so it is only in front of a client who
  // sells a product in the first place.
  ok("🔴 it is asked beside the shop link, not of every client",
    PORTAL.indexOf("If People Buy Straight From Your Website") < PORTAL.indexOf('data-key="brandVoice.madeIn"')
    && PORTAL.indexOf('data-key="brandVoice.madeIn"') < PORTAL.indexOf('<div class="lbl">Your Website</div>'));

  // 🔴 A QUESTION NOTHING READS IS A QUESTION NOT WORTH ASKING.
  ok("🔴 and the landing page writer is actually given the answer",
    /Where the product is made/.test(LAND) && /\$\{bv\.madeIn \?/.test(LAND),
    "a field nobody reads is a box that wastes the one bit of goodwill a client spends on it");
  ok("and is told not to embroider it",
    /NEVER invent or extend it/.test(LAND));
  ok("🔴 and it is omitted entirely when blank",
    /\$\{bv\.madeIn \? `[\s\S]{0,260}?` : ""\}/.test(LAND),
    "an empty 'Where the product is made: Not specified' invites the writer to fill the gap");
}

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-billing-for-sales: ${pass} checks passed`);
