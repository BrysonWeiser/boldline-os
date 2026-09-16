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
import { makeContractHTML } from "../netlify/lib/contract-shared.cjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const S = readFileSync(new URL("../index.html", import.meta.url), "utf8");
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
  for (const frag of ["RW.per", "RW.many", 'String(cl.billingResultKind || "") === "sale"']) {
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
  ok("🔴 and does not ask for view-throughs", !/VIEW_THROUGH/.test(code),
    "one of these in the payload puts the default straight back");
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

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-billing-for-sales: ${pass} checks passed`);
