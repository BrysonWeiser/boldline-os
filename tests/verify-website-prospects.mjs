// Website prospects: the free website check, website mode in Lead Scout, and the Ads / Website / Both label
// in Outreach. Run: node tests/verify-website-prospects.mjs
//
// Bryson, 2026-10-12: "for the lead scout section I want to make a category for companies that need websites
// and or need better websites and then I also want to be able to categorize them in outreach if I want to".
//
// 🔴 THE RULE THAT MATTERS MOST IS THE ONE ABOUT ABSENCE. Every line the website check produces is something
// Bryson may say to the owner on a cold call. "Your website is down" said to somebody whose site is fine ends
// the call, so a timeout, a block, or an address only the research came up with must never come back as
// "broken", and a page that builds itself in the browser must never be accused of having no call button.
// Those are tested by RUNNING the check against fake websites, not by reading its source.
//
// KB `website-prospects`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { analyzeSite, checkWebsite, siteNeed, siteRank, copyrightYear, visibleText, SITE_OK_CAP } from "../netlify/lib/site-check.mjs";
import { pitchOf, matchesPitch, pitchCounts, cleanPitch } from "../netlify/lib/pitch.mjs";
import { assessAffordability, buildScore } from "../netlify/lib/scout-scoring.mjs";
import { enrichSystem, discoverySystem } from "../netlify/lib/scout-shared.mjs";
import { painPoints, buildManualProspect } from "../netlify/lib/outreach.mjs";
import { researchLines } from "../netlify/functions/outreach-draft.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const BG = readFileSync(join(ROOT, "netlify/functions/lead-scout-background.mjs"), "utf8");
const SCOUT = readFileSync(join(ROOT, "netlify/functions/lead-scout.mjs"), "utf8");
const OUT = readFileSync(join(ROOT, "netlify/functions/outreach.mjs"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const NOW = Date.UTC(2026, 9, 12, 20, 0, 0);
const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const ids = (c) => (c.problems || []).map((p) => p.id);

// ── 1. Reading a page that arrived ─────────────────────────────────────────
const GOOD = `<!doctype html><html><head><title>Summit Roofing | Mesa</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Roof repair in Mesa.">
  </head><body><a href="tel:+16025550123">Call</a><form action="/quote"><input name="n"></form>
  <p>${words(300)}</p><footer>© 2026 Summit Roofing</footer></body></html>`;
const OLD = `<html><head><title>Bob's Plumbing</title></head><body><center><font face="Arial">Welcome to Bob's Plumbing</font></center>
  <table bgcolor="#ffffff"><tr><td>${words(200)}</td></tr></table><p>Copyright &copy; 2016 Bob's Plumbing. All rights reserved.</p>
  <a href="tel:6025550123">Call us</a><form></form></body></html>`;
const SHELL = `<!doctype html><html><head><title>Apex HVAC</title><meta content="width=device-width" name="viewport">
  <meta name="description" content="HVAC"></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
{
  const g = analyzeSite(GOOD, { url: "https://summit.com", ms: 900, now: NOW });
  eq("a modern site with everything passes", g.state, "ok");
  eq("and has no problems listed", ids(g), []);
  ok("it records that the page was readable", g.readable === true && g.words > 250);

  const o = analyzeSite(OLD, { url: "https://bobs.com", ms: 1200, now: NOW });
  eq("an old site is marked as needing work", o.state, "weak");
  ok("no viewport tag means not built for phones", ids(o).includes("no_mobile"));
  ok("a footer stuck in 2016 is caught, through &copy;", ids(o).includes("old_copyright") && o.problems.find((p) => p.id === "old_copyright").says.includes("2016"));
  ok("font, center and bgcolor together read as very old code", ids(o).includes("old_tech"));
  ok("strong problems are listed first", o.problems.findIndex((p) => !p.strong) === -1 || o.problems.findIndex((p) => !p.strong) > o.problems.findLastIndex((p) => p.strong));
  ok("every problem carries its own words, so every screen says the same thing", o.problems.every((p) => p.label && p.says));

  // 🔴 THE ABSENCE RULE ON THE PAGE ITSELF.
  const sh = analyzeSite(SHELL, { url: "https://apex.com", ms: 700, now: NOW });
  ok("🔴 a page that builds itself in the browser is NOT accused of missing a call button", !ids(sh).includes("no_call_link"));
  ok("🔴 nor of missing a quote form", !ids(sh).includes("no_quote_path"));
  eq("🔴 with nothing it can judge wrong, it says unknown rather than fine", sh.state, "unknown");
  ok("and says why, with what to do", /builds itself in the browser/.test(sh.note) && /phone/.test(sh.note));

  const noViewShell = analyzeSite(SHELL.replace(/<meta content="width=device-width" name="viewport">/, ""), { now: NOW });
  ok("a shell with no viewport still gets the phone problem, because that tag is in the head", ids(noViewShell).includes("no_mobile"));

  eq("a parked domain is broken", analyzeSite(`<html><body>This domain is for sale! Buy this domain today.</body></html>`, { now: NOW }).state, "broken");
  eq("so is a suspended host", analyzeSite(`<html><head><title>Account Suspended</title></head><body>This account has been suspended.</body></html>`, { now: NOW }).state, "broken");
  eq("so is a bare server page", analyzeSite(`<html><head><title>Welcome to nginx!</title></head><body>If you see this page, the nginx web server is successfully installed.</body></html>`, { now: NOW }).state, "broken");
  eq("so is a short coming soon page", analyzeSite(`<html><head><title>Coming Soon</title><meta name="viewport" content="x"></head><body>Our new website is coming soon.</body></html>`, { now: NOW }).state, "broken");
  ok("🔴 but a real page that mentions 'coming soon' somewhere is not",
    analyzeSite(GOOD.replace("<p>", "<p>New location coming soon. "), { now: NOW }).state === "ok");

  eq("a range ending this year is current", copyrightYear("<p>© 2015-2026 Acme</p>"), 2026);
  eq("no year in the footer means nothing to say", copyrightYear("<p>© <span id=y></span> Acme</p>"), 0);
  ok("a year only three years old is flagged, two is not",
    ids(analyzeSite(GOOD.replace("© 2026", "© 2023"), { now: NOW })).includes("old_copyright")
    && !ids(analyzeSite(GOOD.replace("© 2026", "© 2024"), { now: NOW })).includes("old_copyright"));
  const slow = analyzeSite(GOOD, { ms: 7400, now: NOW });
  ok("a slow page is noted with its time", ids(slow).includes("slow") && /7 seconds/.test(slow.problems[0].label));
  eq("but one minor problem alone does not make a site worth replacing", slow.state, "ok");
  eq("two minor ones do", analyzeSite(GOOD.replace(/<a href="tel:[^"]+">Call<\/a>/, ""), { ms: 7400, now: NOW }).state, "weak");
  ok("insecure and broken-certificate findings come from how it loaded",
    ids(analyzeSite(GOOD, { insecure: true, now: NOW })).includes("no_https") && ids(analyzeSite(GOOD, { certBroken: true, now: NOW })).includes("bad_cert"));
  ok("visible text ignores scripts and styles", visibleText("<style>a{}</style><script>var x=1</script><p>Hello there</p>") === "Hello there");
}

// ── 2. Fetching it, against fake websites ──────────────────────────────────
const fakeFetch = (routes) => {
  const seen = [];
  const f = async (url) => {
    seen.push(url);
    const r = routes(url);
    if (r instanceof Error) throw r;
    return { ok: r.status >= 200 && r.status < 300, status: r.status, url: r.url || url, text: async () => r.body || "" };
  };
  f.seen = seen;
  return f;
};
const netErr = (code) => { const e = new TypeError("fetch failed"); e.cause = { code }; return e; };
const abortErr = () => { const e = new Error("aborted"); e.name = "AbortError"; return e; };
{
  eq("an empty website on a Google listing is a FACT: no website", (await checkWebsite("", { from: "places", now: NOW })).state, "none");
  ok("and is said as exactly that", /Google listing has no website/.test((await checkWebsite("", { from: "places", now: NOW })).reason));
  eq("🔴 an empty website from the research is unknown, never 'none'", (await checkWebsite("", { from: "research", now: NOW })).state, "unknown");
  eq("the research saying 'none' outright is none", (await checkWebsite("none", { now: NOW })).state, "none");
  const fb = await checkWebsite("https://www.facebook.com/bobsplumbing", { now: NOW });
  ok("a Facebook page as the website is no website, said kindly", fb.state === "none" && /only website is a Facebook page/.test(fb.reason));
  ok("Google's switched-off free sites count as none", (await checkWebsite("bobsplumbing.business.site", { now: NOW })).state === "none");

  const dns = () => fakeFetch(() => netErr("ENOTFOUND"));
  eq("a listing's own address that does not exist is broken", (await checkWebsite("gonebiz.com", { from: "places", fetchImpl: dns(), now: NOW })).state, "broken");
  eq("🔴 an address only the research found that does not exist is UNKNOWN, it may just be wrong",
    (await checkWebsite("gonebiz.com", { from: "research", fetchImpl: dns(), now: NOW })).state, "unknown");
  const slowSite = await checkWebsite("slow.com", { from: "places", fetchImpl: fakeFetch(() => abortErr()), now: NOW });
  eq("🔴 a timeout is never 'down'", slowSite.state, "unknown");
  ok("and says so, with what to do", /didn't answer/.test(slowSite.note) && /phone/.test(slowSite.note));
  eq("🔴 a block (403) is never 'down'", (await checkWebsite("waf.com", { from: "places", fetchImpl: fakeFetch(() => ({ status: 403 })), now: NOW })).state, "unknown");
  eq("a homepage that 404s on both hosts is broken", (await checkWebsite("gone-plumbing.com", { from: "places", fetchImpl: fakeFetch(() => ({ status: 404 })), now: NOW })).state, "broken");

  const certF = fakeFetch((u) => u.startsWith("https://") ? netErr("CERT_HAS_EXPIRED") : { status: 200, body: GOOD });
  const cert = await checkWebsite("expired.com", { from: "places", fetchImpl: certF, now: NOW });
  ok("an expired certificate with a working plain version is the broken-certificate problem", cert.state === "weak" && ids(cert).includes("bad_cert"));
  const plainF = fakeFetch((u) => u.startsWith("https://") ? netErr("ECONNREFUSED") : { status: 200, body: GOOD });
  const plain = await checkWebsite("old.com", { from: "places", fetchImpl: plainF, now: NOW });
  ok("no secure version at all is the no-padlock problem", plain.state === "weak" && ids(plain).includes("no_https"));
  const fwd = await checkWebsite("bobs.com", { from: "places", fetchImpl: fakeFetch(() => ({ status: 200, url: "https://m.facebook.com/bobs", body: "<html></html>" })), now: NOW });
  ok("a domain that just forwards to Facebook is no website", fwd.state === "none" && /forwards to a Facebook page/.test(fwd.reason));
  const wix = await checkWebsite("https://bobs.wixsite.com/plumbing", { from: "places", fetchImpl: fakeFetch(() => ({ status: 200, body: GOOD })), now: NOW });
  ok("a free builder address is named", ids(wix).includes("builder") && /Wix/.test(wix.problems[0].label));
  const deep = fakeFetch(() => ({ status: 200, body: GOOD }));
  await checkWebsite("https://www.summit.com/locations/mesa?utm_source=gmb", { from: "places", fetchImpl: deep, now: NOW });
  eq("it reads the HOMEPAGE, not whatever page the listing linked", deep.seen[0], "https://www.summit.com/");
  const wwwOnly = fakeFetch((u) => /\/\/www\./.test(u) ? { status: 200, body: GOOD } : netErr("ECONNRESET"));
  eq("a site that only answers on www is still read", (await checkWebsite("summit.com", { from: "places", fetchImpl: wwwOnly, now: NOW })).state, "ok");
}

// ── 3. Scoring: website need, the cap, and can they pay for a website ───────
{
  eq("no website is the full 25", siteNeed({ state: "none", reason: "x" }).points, 25);
  eq("a dead one too", siteNeed({ state: "broken", reason: "x" }).points, 25);
  const weak = siteNeed(analyzeSite(OLD, { now: NOW }));
  ok("a weak site scores high but below none", weak.points > 15 && weak.points <= 23, String(weak.points));
  ok("and its reason is the problems, in a sentence", /^Their website isn't built for phones/.test(weak.why), weak.why);
  const fine = siteNeed({ state: "ok", problems: [] });
  ok("a site that passed scores 3 and caps the whole score", fine.points === 3 && fine.cap === SITE_OK_CAP);
  ok("unknown sits in the middle and never caps", siteNeed({ state: "unknown", note: "n" }).points === 10 && siteNeed({ state: "unknown" }).cap === 100);
  ok("research goes worst website first", siteRank({ state: "none" }) < siteRank({ state: "broken" }) && siteRank({ state: "broken" }) < siteRank(analyzeSite(OLD, { now: NOW }))
    && siteRank(analyzeSite(OLD, { now: NOW })) < siteRank({ state: "unknown" }) && siteRank({ state: "unknown" }) < siteRank({ state: "ok" }));

  const handy = assessAffordability({ employeesEstimate: 1, nicheGroup: "Home Services & Trades", kind: "service", pitch: "website" });
  ok("a one-person handyman CAN pay for a website (they could not for ads)", handy.known && ["workable", "comfortable"].includes(handy.band), handy.band);
  ok("the website math names the website, never an ads package", handy.entryId === "w-standard" && handy.lines.some((l) => /Standard website/.test(l)) && !handy.lines.some((l) => /Launch/.test(l)));
  const handyAds = assessAffordability({ employeesEstimate: 1, nicheGroup: "Home Services & Trades", kind: "service" });
  ok("the same handyman for ads is still capped, which is the point", handyAds.known && handyAds.cap < 100, `${handyAds.band}, cap ${handyAds.cap}`);
  // 🔴 Found while writing this suite: the one-time hand-off package had become the "cheapest way in" at
  // $0/mo, so every business came out comfortable and no cap ever applied.
  ok("🔴 the ads math never uses the one-time hand-off as a monthly way in", handyAds.entryId !== "h-handoff" && handyAds.entryMonthly > 0
    && !handyAds.lines.some((l) => /Infinity|Hand Off/.test(l)), handyAds.lines.join(" | "));
  const big = assessAffordability({ employeesEstimate: 12, nicheGroup: "Legal", kind: "service", pitch: "website" });
  eq("a bigger firm can stretch to the Signature website", big.affordableId, "w-signature");
  const unknown = assessAffordability({ employeesEstimate: 0, nicheGroup: "Legal", kind: "service", pitch: "website" });
  ok("unknown size says so and quotes the website price", !unknown.known && /\$1,500/.test(unknown.note));

  const factors = [
    { factor: "demand", points: 22, why: "d" }, { factor: "gap", points: 5, why: "model" },
    { factor: "reach", points: 12, why: "r" }, { factor: "momentum", points: 6, why: "m" }, { factor: "risk", points: 0, why: "none" },
  ];
  const sw = buildScore(factors, handy, { site: siteNeed({ state: "none", reason: "Their Google listing has no website on it" }) });
  const gap = sw.factors.find((f) => f.factor === "gap");
  ok("🔴 in website mode the gap factor is the website check, not the model", gap.points === 25 && gap.label === "Website need" && /Google listing/.test(gap.why));
  ok("and the score is still the sum of what is shown", sw.score === Math.min(100, sw.factors.reduce((a, f) => a + f.points, 0)));
  const capped = buildScore(factors, handy, { site: fine });
  ok("🔴 a website that already does the job caps the score at 40, and says why",
    capped.score === SITE_OK_CAP && capped.cappedFrom > SITE_OK_CAP && /already passed the checks/.test(capped.capReason), capped.capReason);
  const tiny = assessAffordability({ employeesEstimate: 1, nicheGroup: "Hospitality, Events & Food", kind: "service", pitch: "website" });
  const both = buildScore(factors, tiny, { site: fine });
  ok("the tighter of the two caps wins", both.score === Math.min(tiny.cap, SITE_OK_CAP), `${both.score} vs ${tiny.cap}`);
  const adsMode = buildScore(factors, handy);
  ok("ads mode is untouched: the model's gap stands", adsMode.factors.find((f) => f.factor === "gap").points === 5);
}

// ── 4. The prompts know what is being sold ──────────────────────────────────
{
  const w = enrichSystem({ niche: "Plumbing", areas: ["Mesa, AZ"], pitch: "website" });
  ok("website research is briefed on websites", /NEW WEBSITE/.test(w) && /w-standard/.test(w) && /w-signature/.test(w));
  ok("and told the website check is ground truth", /WEBSITE CHECK/.test(w) && /ground truth/.test(w));
  ok("ads research is unchanged", /runs managed Google Ads and Meta ads/.test(enrichSystem({ niche: "Plumbing", leadFee: 50, areas: [] })));
  const d = discoverySystem({ niche: "Plumbing", areas: ["Mesa, AZ"], count: 10, pitch: "website" });
  ok("website discovery hunts missing and weak websites, and rules out good ones", /no website of their own/.test(d) && /NOT a fit/.test(d));
  ok("and does not also carry the ads-mode website preference", !/Only include businesses that DO have their own website/.test(discoverySystem({ niche: "x", areas: ["a"], count: 5, pitch: "website", filters: { websiteState: "has" } })));
}

// ── 5. The engine: checks first, pays later ─────────────────────────────────
{
  const at = (s) => BG.indexOf(s);
  ok("🔴 website mode checks websites BEFORE the paid research starts",
    at("if (website) {") > 0 && at("await checkSites(first)") > at("if (website) {") && at("await checkSites(first)") < at("Phase 2: AI enrichment"));
  ok("and drops the ones that already do the job", /const needs = \(c\) => !c\.siteCheck \|\| c\.siteCheck\.state !== "ok";/.test(BG));
  ok("researching the worst websites first", /needy\.sort\(\(a, b\) => siteRank\(a\.siteCheck\) - siteRank\(b\.siteCheck\)\)/.test(BG));
  ok("searching again when too few need a site", /if \(needy\.length < count && !aiRan\)/.test(BG));
  ok("the research is told what is being sold", /enrichSystem\(\{ niche, kind: nicheKind, leadFee, areas, pitch \}\)/.test(BG) && /discoverySystem\(\{[^}]*pitch \}\)/.test(BG));
  ok("every record is labelled and carries its check", /pitch: pitch === "website" \? "website" : "ads",/.test(BG) && /siteCheck: siteCheck \|\| null,/.test(BG));
  ok("🔴 a website only the research found is checked, but never reported as broken", /again && again\.state !== "broken"/.test(BG));
  ok("🔴 the word 'none' never travels as an address into the paid ad lookups", /saidNone: \/\^none\$\/i/.test(BG) && /c\.saidNone \? "none" : c\.website/.test(BG));
  ok("ads mode gets the free check too", /checkWebsite\(c\.saidNone \? "none" : c\.website, \{ from: c\.source === "Google Places" \? "places" : "research" \}\)\.catch\(\(\) => null\),/.test(BG));
  ok("a website lead is never recommended an ads package", /if \(!\["w-standard", "w-signature"\]\.includes\(out\.recommendedPackageId\)\) out\.recommendedPackageId = "w-standard";/.test(BG));
  ok("the run says how many it skipped for free", /already had a website that does the job, so they were skipped before any research was paid for/.test(BG));
}

// ── 6. The label: ads, website or both ──────────────────────────────────────
{
  eq("an unlabelled company was found by the ads search, so it is ads", pitchOf({ data: {} }), "ads");
  eq("a nonsense label is ignored", pitchOf({ data: { pitch: "seo" } }), "ads");
  ok("'both' shows under either filter", matchesPitch({ data: { pitch: "both" } }, "ads") && matchesPitch({ data: { pitch: "both" } }, "website"));
  ok("a website lead is not an ads lead", !matchesPitch({ data: { pitch: "website" } }, "ads") && matchesPitch({ data: { pitch: "website" } }, "website"));
  ok("no filter means everyone", matchesPitch({ data: { pitch: "website" } }, "") && matchesPitch(null, ""));
  eq("the counts", pitchCounts([{ data: {} }, { data: { pitch: "website" } }, { data: { pitch: "both" } }]), { all: 3, ads: 2, website: 2 });
  eq("only the three real labels survive cleaning", ["ads", "website", "both", "x", ""].map(cleanPitch), ["ads", "website", "both", "", ""]);
  eq("a company typed in by hand can be labelled", buildManualProspect({ name: "Bob's", phone: "6025550123", pitch: "website" }).row.data.pitch, "website");
  ok("and is left unlabelled (ads) when nothing was picked", !("pitch" in buildManualProspect({ name: "Bob's", phone: "6025550123" }).row.data));

  ok("🔴 the queue filters by label AFTER the due rules, so the counts are of everyone due",
    /const due = dueQueue\(data \|\| \[\], Date\.now\(\)\);/.test(OUT) && /due\.filter\(\(p\) => matchesPitch\(p, pitch\)\)/.test(OUT) && /counts: pitchCounts\(due\)/.test(OUT));
  ok("the label is saved on the company and refuses anything else", /if \(action === "pitch"\)/.test(OUT) && /if \(!pitch\) return json\(\{ ok: false, error: "Pick ads, website or both\." \}, 400\);/.test(OUT));
  ok("the Lead Scout list filters by it too", /matchesPitch\(r, pitch\)/.test(SCOUT));
  ok("🔴 the free re-check works in small pages, because one request gets about ten seconds",
    /\.range\(offset, offset \+ pageSize - 1\)/.test(SCOUT) && /action=recheck-ads&offset=\$\{offset\}&limit=\$\{PAGE\}/.test(UI));
  ok("and an earlier real reading is never wiped out by a later 'couldn't read it'",
    /siteCheck\.state === "unknown" && d\.siteCheck && d\.siteCheck\.state !== "unknown"/.test(SCOUT));
}

// ── 7. Pain points: the website leads when the website is the pitch ──────────
const co = (data) => ({ id: "x", name: "Bob's Plumbing", niche: "Plumbing", data });
const OLDCHECK = analyzeSite(OLD, { now: NOW });
{
  const w = painPoints(co({ pitch: "website", googleAds: "no", rating: "4.9", reviewCount: 80, siteCheck: OLDCHECK }));
  eq("a website lead opens on what is wrong with the website", w[0].id, "site_problems");
  ok("in plain words, two problems at most", /^Their website isn't built for phones and /.test(w[0].line) && (w[0].line.match(/ and /g) || []).length <= 2, w[0].line);
  const a = painPoints(co({ googleAds: "no", rating: "4.9", reviewCount: 80, siteCheck: OLDCHECK }));
  ok("an ads lead still opens on the ads", a[0].id !== "site_problems");
  ok("🔴 the vague 'weak site' line is dropped once the specific one is there",
    !painPoints(co({ pitch: "website", websiteQuality: "dated", siteCheck: OLDCHECK })).some((p) => p.id === "weak_site"));
  eq("no website at all is said as the check said it", painPoints(co({ pitch: "website", siteCheck: { state: "none", reason: "Their Google listing has no website on it" } }))[0].line, "Their Google listing has no website on it.");
  ok("a dead website says where that leaves a customer", /hits a dead end/.test(painPoints(co({ pitch: "both", siteCheck: { state: "broken", reason: "Their domain is parked or up for sale" } }))[0].line));
  ok("🔴 a site that passed, or was never checked, adds nothing",
    !painPoints(co({ pitch: "website", siteCheck: { state: "ok", problems: [] } })).some((p) => /^site_|no_website/.test(p.id))
    && !painPoints(co({ pitch: "website", siteCheck: { state: "unknown", note: "x" } })).some((p) => /^site_|no_website/.test(p.id)));
}

// ── 8. The screen's copies agree, by running them ───────────────────────────
{
  const from = UI.indexOf("const OUT_PHONE_ROLES = {");
  const to = UI.indexOf("const outRankPhones=", from);
  const end = UI.indexOf("\n\n", to);
  const ui = new Function(`${UI.slice(from, end)}
    return { painPoints: outPainPoints, facts: outFacts, pitchOf: outPitchOf, matchesPitch: outMatchesPitch };`)();
  const probes = [
    { pitch: "website", siteCheck: OLDCHECK }, { pitch: "both", siteCheck: OLDCHECK }, { siteCheck: OLDCHECK },
    { pitch: "website", siteCheck: { state: "none", reason: "Their only website is a Facebook page" } },
    { siteCheck: { state: "none", reason: "Their Google listing has no website on it" }, googleAds: "no" },
    { pitch: "website", siteCheck: { state: "broken", reason: "Their domain is parked or up for sale" }, rating: "4.8", reviewCount: 40 },
    { pitch: "website", siteCheck: { state: "ok", problems: [] }, websiteQuality: "decent" },
    { pitch: "website", siteCheck: { state: "unknown", note: "n" }, websiteQuality: "poor" },
    { pitch: "website", websiteQuality: "dated", siteCheck: OLDCHECK, googleAds: "yes" },
    { pitch: "nonsense", siteCheck: OLDCHECK },
  ];
  const drift = probes.filter((p) => JSON.stringify(painPoints(co(p))) !== JSON.stringify(ui.painPoints(co(p))));
  ok("🔴 the screen and the rules give the SAME pain points for website leads", drift.length === 0, drift.map((p) => JSON.stringify(p)).join("\n        "));
  const labels = [undefined, "", "ads", "website", "both", "seo"];
  ok("and the same label for every value", labels.every((v) => ui.pitchOf({ data: { pitch: v } }) === pitchOf({ data: { pitch: v } })));
  ok("and the same filter answers", labels.every((v) => ["", "ads", "website"].every((f) => ui.matchesPitch({ data: { pitch: v } }, f) === matchesPitch({ data: { pitch: v } }, f))));
  const facts = (data) => Object.fromEntries(ui.facts(co(data)).map((x) => [x.label, x.value]));
  ok("the facts say what the check saw", /^Needs work: not built for phones, /.test(facts({ siteCheck: OLDCHECK }).Website), facts({ siteCheck: OLDCHECK }).Website);
  eq("no website, in the check's words", facts({ siteCheck: { state: "none", reason: "Their Google listing has no website on it" } }).Website, "Their Google listing has no website on it");
  ok("🔴 an unchecked site still says nothing invented", !("Website" in facts({})) && !("Website" in facts({ siteCheck: { state: "unknown", note: "x" } })));
}

// ── 9. The screens ──────────────────────────────────────────────────────────
{
  const SCOUT_UI = UI.split("function LeadScoutScreen")[1].split("\nfunction ")[0];
  const OUT_UI = UI.split("function OutreachScreen")[1].split("\nfunction ")[0];
  ok("Lead Scout asks what you are selling, first", /What are you selling\?/.test(SCOUT_UI) && SCOUT_UI.indexOf("What are you selling?") < SCOUT_UI.indexOf("Industry / niche *"));
  ok("and sends it with the search", /areas,count,filters,notes,pitch\}\)/.test(SCOUT_UI));
  ok("the ads-mode website preference is hidden in website mode, where it is the whole point", /\{pitch!=="website"&&\(\s*<div>\s*<div style=\{lbl\}>Website<\/div>/.test(SCOUT_UI));
  ok("each card shows its label and what the website check found", /SCOUT_PITCH_LABEL\[outPitchOf\(p\)\]/.test(SCOUT_UI) && /Website check/.test(SCOUT_UI));
  ok("the call list can be filtered by it", /qs\.set\("pitch",lf\.pitch\)/.test(SCOUT_UI));
  ok("Outreach has the Selling filter, with counts", /\["website","Websites",pitchCounts&&pitchCounts\.website\]/.test(OUT_UI) && /&pitch="\+pitchF/.test(OUT_UI));
  ok("each company's label can be changed with one tap, and is put back if the save fails",
    /api\("action=pitch&id="\+encodeURIComponent\(id\)/.test(OUT_UI) && /setQueue\(q=>q\.map\(x=>x\.id===id\?\{\.\.\.x,data:before\}:x\)\)/.test(OUT_UI));
  ok("a company added by hand can be labelled as it goes in", /JSON\.stringify\(\{\.\.\.addForm,pitch:addPitch\}\)/.test(OUT_UI));
  ok("the filter is remembered on this device only, and survives storage being blocked", /try\{ localStorage\.setItem\("bl-outreach-pitch",pitchF\); \}catch\(e\)\{\}/.test(OUT_UI));
}

// ── 10. The message writer pitches the right thing ──────────────────────────
{
  const L = researchLines(co({ pitch: "website", siteCheck: OLDCHECK })).join("\n");
  ok("a website lead's messages are told it is a website pitch", /What Bryson is selling them: a new website \(not ads\)/.test(L));
  ok("and given what the check saw", /Website check \(BoldLine read their homepage\): Not built for phones/.test(L));
  ok("an ads lead's messages are unchanged", !/What Bryson is selling them/.test(researchLines(co({})).join("\n")));
}

console.log(`verify-website-prospects: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
