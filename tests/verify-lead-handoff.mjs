// Guards the two things that have to be true the day a client's campaign goes live:
// their leads reach their own follow-up system, and their ad shows their own domain.
//
// Both came out of one email from Shaun Smith, who runs Stencil & Thread's website
// (2026-08-25). He offered an endpoint to post the form to, so leads land in the client's
// CRM where the follow-up automation lives, and he is right that it is worth having.
//
// 🔴 BUT IT COULD NOT SIMPLY REPLACE OUR INTAKE, AND THAT IS THE INVARIANT HERE. The click
// id is captured at our endpoint at the moment of arrival. It is the only way an order
// weeks later is credited back to the search that produced it (KB `conversion-loop`), the
// only basis for per-qualified-lead billing, and the whole content of the scorecard. Post
// the form straight to the CRM and the ads keep spending while learning nothing.
//
// So: stored here first, forwarded second, forwarded exactly once, and a failure is said
// out loud rather than logged.
//
// The rules are imported and executed rather than restated (KB `repo-tests`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  crmPayload, crmTarget, shouldRetry, signBody, forwardResult, forwardLead,
  alreadyForwarded, CRM_TIMEOUT_MS, CRM_MAX_ATTEMPTS,
} from "../netlify/lib/crm-forward.mjs";
import { normalizeHost, isOwnHost, isReservedPath, routeFor } from "../netlify/lib/client-domain.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI      = readFileSync(join(ROOT, "index.html"), "utf8");
const INTAKE  = readFileSync(join(ROOT, "netlify/functions/lead-intake.mjs"), "utf8");
const LANDING = readFileSync(join(ROOT, "netlify/functions/landing.mjs"), "utf8");
const EDGE    = readFileSync(join(ROOT, "netlify/edge-functions/client-domain.js"), "utf8");
const strip = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const UI_CODE = strip(UI), INTAKE_CODE = strip(INTAKE), LANDING_CODE = strip(LANDING), EDGE_CODE = strip(EDGE);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const CLIENT = { name: "Stencil & Thread", campaignSetup: { crmWebhook: "https://crm.example.com/hook", crmWebhookSecret: "s3cret" } };
const LEAD = { name: "Dana Cole", email: "d@co.com", phone: "555", message: "40 hoodies", source: "landing_page",
               receivedAt: "2026-08-25T18:00:00.000Z", gclid: "abc123", clickAt: "2026-08-25T17:58:00.000Z" };

// ── 1. 🔴 STORED BEFORE FORWARDED, NEVER THE OTHER WAY ────────────────────────
{
  const i = INTAKE_CODE.indexOf("appendLead(");
  const f = INTAKE_CODE.indexOf("forwardLead(");
  ok("the intake saves the lead", i > 0);
  ok("and forwards it", f > 0);
  ok("🔴 saving happens FIRST, so a dead CRM can never cost a lead", i > 0 && f > i, `save at ${i}, forward at ${f}`);

  // The visitor gets their thank-you regardless. A CRM problem is not their problem.
  ok("a forward that throws is caught", /forwardLead\(nextData, lead\)\.catch\(/.test(INTAKE_CODE));
  ok("and the request still succeeds", /return json\(\{ ok: true \}, 200\);/.test(INTAKE_CODE));
  ok("the click id is still captured here, before anything is forwarded",
    INTAKE_CODE.indexOf('["gclid", "wbraid", "gbraid"]') < f);
}

// ── 2. Who gets forwarded to, and who does not ────────────────────────────────
{
  ok("a configured client has a target", !!crmTarget(CLIENT));
  eq("pointed at their endpoint", crmTarget(CLIENT).url, "https://crm.example.com/hook");
  eq("carrying the shared password", crmTarget(CLIENT).secret, "s3cret");
  ok("a client with nothing set up is skipped", crmTarget({ name: "X" }) === null);
  ok("and so is a blank string", crmTarget({ campaignSetup: { crmWebhook: "   " } }) === null);
  // 🔴 A customer's name, email and phone would otherwise cross the open internet.
  ok("an unencrypted endpoint is refused outright",
    crmTarget({ campaignSetup: { crmWebhook: "http://crm.example.com/hook" } }) === null);
  ok("as is nonsense", crmTarget({ campaignSetup: { crmWebhook: "not a url" } }) === null);
  // A record written before the field moved into the campaign settings still works.
  ok("an older record still resolves", !!crmTarget({ crmWebhook: "https://old.example.com/h" }));
}

// ── 3. What the client's system actually receives ─────────────────────────────
{
  const p = crmPayload(CLIENT, LEAD);
  eq("the business is named", p.business, "Stencil & Thread");
  eq("with the contact", p.lead.email, "d@co.com");
  eq("and what they asked for", p.lead.message, "40 hoodies");
  eq("timed to when it arrived", p.receivedAt, "2026-08-25T18:00:00.000Z");
  // Passed on so the CRM can report by campaign too, and nobody has to ask us where a
  // contact came from.
  eq("the ad click travels with it", p.attribution.gclid, "abc123");
  eq("flagged as ad-sourced", p.attribution.fromAd, true);
  eq("a lead that found them another way is flagged too",
    crmPayload(CLIENT, { name: "Walk in" }).attribution.fromAd, false);
  // Nothing may arrive as the string "undefined" in somebody's sales pipeline.
  const flat = JSON.stringify(crmPayload(CLIENT, { name: "Sparse" }));
  ok("missing fields are empty, never the word undefined", !/undefined/.test(flat), flat);
  ok("and never null", !/null/.test(flat), flat);
}

// ── 4. The signature, so the far end can prove it was us ──────────────────────
{
  const a = await signBody('{"a":1}', "s3cret");
  const b = await signBody('{"a":1}', "s3cret");
  const c = await signBody('{"a":2}', "s3cret");
  eq("the same body signs the same way", a, b);
  ok("a different body does not", a !== c);
  ok("it is a hex digest", /^[0-9a-f]{64}$/.test(a), a);
  eq("no secret means no signature", await signBody('{"a":1}', ""), "");
}

// ── 5. 🔴 RETRY ONLY WHAT A RETRY CAN FIX ─────────────────────────────────────
// A duplicate lead in someone's sales pipeline is worse than one that never arrived,
// because a human then works the same lead twice and the customer notices.
{
  ok("a dropped connection is worth retrying", shouldRetry({ networkError: true }));
  ok("so is a server having a bad moment", shouldRetry({ status: 503 }));
  ok("and an explicit come-back-later", shouldRetry({ status: 429 }));
  ok("and a timeout", shouldRetry({ status: 408 }));
  // These mean the REQUEST was wrong. Sending it again produces the same rejection, and
  // on an endpoint that half-accepted it, a second lead.
  ok("a rejected request is NOT retried", !shouldRetry({ status: 400 }));
  ok("nor a bad password", !shouldRetry({ status: 401 }));
  ok("nor a wrong address", !shouldRetry({ status: 404 }));
  ok("a success is obviously not retried", !shouldRetry({ status: 200 }));
  eq("and it never tries more than twice", CRM_MAX_ATTEMPTS, 2);
}

// ── 6. The send, run for real against a fake endpoint ─────────────────────────
const fakeFetch = (script) => {
  const calls = [];
  let i = 0;
  const fn = async (url, opts) => {
    calls.push({ url, opts, body: JSON.parse(opts.body) });
    const step = script[Math.min(i++, script.length - 1)];
    if (step.throw) { const e = new Error(step.throw); e.name = step.name || "Error"; throw e; }
    return { ok: step.status >= 200 && step.status < 300, status: step.status };
  };
  fn.calls = calls;
  return fn;
};

{
  const f = fakeFetch([{ status: 200 }]);
  const r = await forwardLead(CLIENT, LEAD, { fetchImpl: f });
  eq("a good hand-off is recorded as ok", r.ok, true);
  eq("in one attempt", r.attempts, 1);
  eq("hitting their endpoint once", f.calls.length, 1);
  eq("as a POST", f.calls[0].opts.method, "POST");
  ok("signed", /^[0-9a-f]{64}$/.test(f.calls[0].opts.headers["x-boldline-signature"]));
  ok("identifying itself", f.calls[0].opts.headers["user-agent"] === "BoldLine-OS");
  // The visitor is watching a "Sending..." button, so a slow CRM must not become a slow form.
  ok("with a time limit so a slow CRM is not a slow form", !!f.calls[0].opts.signal);
  eq("and that limit is seconds, not minutes", CRM_TIMEOUT_MS, 6000);
}

{
  const f = fakeFetch([{ status: 503 }, { status: 200 }]);
  const r = await forwardLead(CLIENT, LEAD, { fetchImpl: f });
  eq("a server hiccup is retried and succeeds", r.ok, true);
  eq("on the second try", f.calls.length, 2);
}

{
  const f = fakeFetch([{ status: 400 }]);
  const r = await forwardLead(CLIENT, LEAD, { fetchImpl: f });
  eq("a rejected request fails", r.ok, false);
  eq("🔴 and is NOT sent twice", f.calls.length, 1);
  eq("recording what the CRM said", r.status, 400);
  ok("in words", /replied 400/.test(r.error), r.error);
}

{
  const f = fakeFetch([{ throw: "aborted", name: "AbortError" }]);
  const r = await forwardLead(CLIENT, LEAD, { fetchImpl: f });
  eq("a CRM that never answers fails", r.ok, false);
  ok("and says so plainly rather than in jargon", /no answer within 6 seconds/.test(r.error), r.error);
  eq("after both attempts", f.calls.length, 2);
}

{
  // 🔴 FORWARD ONCE, EVER. A replayed intake must not put a second copy of the same
  // person in a sales pipeline.
  const sent = { ...LEAD, crm: { ok: true, at: "2026-08-25T18:00:05.000Z" } };
  ok("a lead already delivered is recognised", alreadyForwarded(sent));
  const f = fakeFetch([{ status: 200 }]);
  eq("and is never sent again", await forwardLead(CLIENT, sent, { fetchImpl: f }), null);
  eq("nothing was called", f.calls.length, 0);
  // A previous FAILURE is not a delivery, so it may be attempted again.
  ok("but a previous failure may be retried", !alreadyForwarded({ ...LEAD, crm: { ok: false } }));
}

{
  const f = fakeFetch([{ status: 200 }]);
  eq("a client with no endpoint is skipped entirely", await forwardLead({ name: "X" }, LEAD, { fetchImpl: f }), null);
  eq("with no call made", f.calls.length, 0);
}

// ── 7. A failure is visible, not buried ───────────────────────────────────────
{
  const r = forwardResult({ ok: false, error: "x".repeat(500) });
  ok("a long error is trimmed for a lead row", r.error.length <= 200);
  ok("the result is stamped with a time", /^\d{4}-/.test(r.at));
  ok("the intake records the outcome onto the lead", /log\[i\] = \{ \.\.\.log\[i\], crm \}/.test(INTAKE_CODE));
  // Stamping the wrong index would put one lead's failure on another lead's row.
  ok("matched by timestamp rather than trusted position",
    /log\[0\]\.receivedAt === lead\.receivedAt/.test(INTAKE_CODE));
  ok("and the OS says so on the row", /did not reach \{client\.name\}'s own system/.test(UI));
  ok("while making clear the lead itself is safe", /It is saved here, so nothing is lost/.test(UI));
  ok("the endpoint is editable in the OS", /k:"crmWebhook"/.test(UI_CODE));
}

// ── 8. 🔴 THE EDGE FUNCTION RUNS ON EVERY REQUEST TO THE WHOLE OS ─────────────
// A mistake here is not a broken feature, it is a blank app for everyone. Every unknown
// case must resolve to "this is ours, leave it alone".
{
  ok("the live site is ours", isOwnHost("boldlinemedia.netlify.app"));
  ok("so is every deploy preview", isOwnHost("deploy-preview-42--boldlinemedia.netlify.app"));
  ok("and a branch deploy", isOwnHost("my-branch--boldlinemedia.netlify.app"));
  ok("and the marketing site", isOwnHost("boldlinemedia.com"));
  ok("with or without the www", isOwnHost("www.boldlinemedia.com"));
  // 🔴 The OS's own hostname. Netlify allows exactly one PRIMARY custom domain per site and
  // makes every other one an alias, so the OS needs an address of its own for client domains
  // to sit alongside. Missing here, that hostname falls through to a landing-page lookup,
  // finds no client, and 404s the entire OS for everyone.
  ok("🔴 the OS's own hostname is ours, not a client lookup", isOwnHost("os.boldlinemedia.com"));
  eq("and is passed straight through rather than routed to a landing page",
    routeFor("os.boldlinemedia.com", "/").kind, "pass");
  ok("and local development", isOwnHost("localhost:8888"));
  ok("an empty host is treated as ours", isOwnHost(""));
  ok("and so is junk, rather than serving a stranger a client page", isOwnHost("!!!"));
  ok("a new OS hostname can be added without a deploy", isOwnHost("os.example.com", "os.example.com"));

  // The one case that is NOT ours.
  ok("a client's own subdomain is not ours", !isOwnHost("quote.stencilandthread.com"));
  eq("and routes to their landing page", routeFor("quote.stencilandthread.com", "/").kind, "landing");
  eq("carrying the host, lowercased", routeFor("QUOTE.Stencilandthread.COM", "/").host, "quote.stencilandthread.com");
  eq("our own host is passed straight through", routeFor("boldlinemedia.netlify.app", "/").kind, "pass");

  // 🔴 The landing page posts its form to a RELATIVE /.netlify/functions/ path. Rewriting
  // those would break the very lead capture this exists to preserve.
  ok("function routes are never rewritten", isReservedPath("/.netlify/functions/lead-intake"));
  eq("even on a client domain", routeFor("quote.stencilandthread.com", "/.netlify/functions/lead-intake").kind, "pass");
  ok("and neither are well-known routes, which certificates need", isReservedPath("/.well-known/acme-challenge/x"));

  // A crafted Host header must not reach the database as a wildcard.
  eq("a wildcard in the host is discarded", normalizeHost("quote.%.com"), "");
  eq("and an underscore", normalizeHost("a_b.com"), "");
  eq("a port is stripped", normalizeHost("quote.example.com:443"), "quote.example.com");

  // The edge function itself.
  ok("it runs on every path", /path: "\/\*"/.test(EDGE_CODE));
  ok("it rewrites rather than redirecting, so the client's address stays in the bar",
    /context\.rewrite\(/.test(EDGE_CODE));
  ok("🔴 and any failure passes the request through untouched", /catch \(e\)/.test(EDGE_CODE) && /return;/.test(EDGE_CODE));
  ok("it shares the routing rule rather than keeping its own copy", /routeFor/.test(EDGE_CODE));
}

// ── 9. The page resolves by domain as well as by link ─────────────────────────
{
  ok("a slug still works, which is how it is previewed", /data->>landingSlug/.test(LANDING_CODE));
  ok("and a client domain resolves too", /landingDomain/.test(LANDING_CODE));
  ok("matched without caring about capitals", /\.ilike\(/.test(LANDING_CODE));
  ok("with neither, it is a 404 rather than a wrong page", /if \(!slug && !host\) return notFoundPage\(\);/.test(LANDING_CODE));
  ok("the host is normalised before it is used", /normalizeHost\(url\.searchParams\.get\("host"\)/.test(LANDING_CODE));
  ok("and the domain is editable in the OS", /k:"landingDomain"/.test(UI_CODE));
}

// ── 🔴 THE PAGE MUST BEHAVE THE SAME IN THE OS PREVIEW AS IT DOES LIVE ──────
// Bryson, 2026-09-01: *"the get my free quote button goes to my os which it shouldnt."*
// Reproduced in a headless browser rather than guessed at. The OS previews this page in an
// `<iframe srcdoc>`, whose document URL is `about:srcdoc`, so a bare `href="#lead-form"`
// resolves against the PARENT document and the frame navigates to the OS app. The live page
// was never broken, but a preview that jumps to the OS on the main button is a preview nobody
// can trust, and trusting it is the whole point of having one.
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const cl = {
    name: "Stencil & Thread", landingSlug: "stencil", leadToken: "TOK",
    campaignSetup: { serviceArea: "Eugene, OR" },
    landingPage: { headline: "Custom shirts, fast.", subheadline: "25 or more.", ctaText: "Get a quote", published: true },
  };
  const managed = renderLandingPage(cl);
  const ho = renderLandingPage(cl, { handoff: { phone: "(541) 555-0100" } });

  ok("🔴 in-page links are scrolled to, not navigated to",
    /querySelectorAll\('a\[href\^="#"\]'\)/.test(managed) && /preventDefault\(\)/.test(managed)
      && /scrollIntoView/.test(managed),
    "a bare fragment href resolves against the PARENT document inside an iframe srcdoc, so the "
    + "OS preview navigates itself to the OS app");
  ok("and the hand-off page gets the same handling", /querySelectorAll\('a\[href\^="#"\]'\)/.test(ho),
    "a hand-off page is previewed in the same iframe");
  ok("the plain href survives as the no-JS fallback", /href="#lead-form"/.test(managed),
    "on the live page the fragment is correct, so JS off must still reach the form");
  ok("a fragment pointing at nothing is left alone", /if\(!t\)return;/.test(managed),
    "hijacking every hash link including ones with no target would break anchors we do not own");

  // 🔴 A PREVIEW MUST NEVER CREATE A REAL LEAD. The preview carries the real leadToken and is
  // same-origin with the OS, so a submit would post to the live intake: a phantom lead in the
  // client's pipeline, a text and an email to whatever was typed, and a forward to their CRM.
  ok("🔴 a submit from a preview never reaches the intake",
    /indexOf\('about:'\)===0/.test(managed),
    "today the OS sandbox also omits allow-forms so the submit event never fires, but that is "
    + "an attribute in another file held up by habit. Adding allow-forms to make the preview "
    + "button feel alive is an obvious future edit, and this is what makes it safe");
  ok("and it still shows the thank-you state, so the preview stays useful",
    /indexOf\('about:'\)===0\)\{[\s\S]{0,220}lf-thanks/.test(managed));
  ok("🔴 the guard sits BEFORE the fetch, not after it",
    managed.indexOf("indexOf('about:')===0") < managed.indexOf("functions/lead-intake?token="),
    "a guard after the send is not a guard");
}

// ── 🔴 NOTHING ON A CLIENT'S PAGE MAY POINT BACK AT BOLDLINE ────────────────
// Bryson, 2026-09-01: *"make sure when we build landing pages the buttons never link back to
// the os unless i specifically want them to for whatever reason."*
//
// Three separate reasons this matters, and only the first is obvious:
//   1. The page runs on the CLIENT's domain. A link to BoldLine puts a marketing agency in
//      front of a screen printer's customer, which is the same defect the custom domain
//      exists to fix.
//   2. A RELATIVE href is the quiet version of the same bug. It resolves against whatever
//      document it is in: the client's domain when live, and THE OS when previewed in an
//      iframe srcdoc. That is exactly how the CTA ended up navigating to the OS.
//   3. Google checks that an ad's display URL matches where it lands. A cross-domain hop
//      out of the landing page is an ad policy problem, not just a taste one.
//
// The escape hatch he asked for is real: anything HE types into the client record (a booking
// link, say) is his call. So this asserts the RENDERER never introduces one on its own, by
// rendering from data that contains no BoldLine URL at all.
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const clean = {
    name: "Stencil & Thread", landingSlug: "stencil", leadToken: "TOK",
    // The managed page reads callTrackingNumber, NOT businessPhone. With the wrong field the
    // phone-dependent furniture (call buttons, the fast-response chip) renders in no layout at
    // all, which is how a phone-emoji mutation slipped through unnoticed.
    callTrackingNumber: "+15415550100",
    campaignSetup: {
      serviceArea: "Eugene, OR",
      privacyUrl: "https://stencilandthread.com/privacy.html",
      termsUrl: "https://stencilandthread.com/terms.html",
      smsOptInUrl: "https://stencilandthread.com/sms-opt-in.html",
    },
    // 🔴 THE FIXTURE HAS TO LIGHT UP THE OPTIONAL BRANCHES OR THE SCAN COVERS LESS PAGE THAN
    // IT CLAIMS. A first pass omitted the logo, so a mutation that planted a relative link in
    // the logo branch applied to the source and still passed: that branch never rendered.
    // Same shape as the trap in KB `repo-tests`, a mutation that does not reach the output
    // looks exactly like a guard that works.
    brandLogo: "https://cdn.example.com/logo.png",
    mediaLibrary: [
      { path: "p/1.jpg", url: "https://cdn.example.com/1.jpg", category: "photo" },
      { path: "p/2.jpg", url: "https://cdn.example.com/2.jpg", category: "photo" },
    ],
    landingPage: {
      headline: "Custom shirts", subheadline: "25 or more", bullets: ["a", "b"],
      ctaText: "Get a quote", published: true, heroPath: "p/1.jpg",
      reviews: [{ text: "Great work", name: "Dana R." }],
    },
  };
  // 🔴 EVERY LAYOUT, NOT JUST WHICHEVER ONE THE SEED HAPPENS TO PICK. The page has four, and
  // they render different furniture: the ghost "Call now" button exists in three of them and
  // not in the capture layout. A first pass rendered one page, and a mutation putting a phone
  // emoji back on that button passed cleanly because the fixture never rendered it. Same trap
  // as the logo branch above, and the same lesson: a mutation that does not reach the output
  // is indistinguishable from a guard that works.
  const LAYOUTS = ["split", "centered", "overlay", "capture"];
  const pages = [
    ...LAYOUTS.map((l) => [`managed / ${l}`,
      renderLandingPage({ ...clean, landingPage: { ...clean.landingPage, design: { layout: l } } })]),
    ["hand-off", renderLandingPage(clean, { handoff: { phone: "(541) 555-0100" } })],
    ["with a booking link", renderLandingPage({ ...clean, bookingUrl: "https://calendly.com/stencil/quote" })],
    // 🔴 A NATIONAL business renders DIFFERENT furniture: the service-area line is replaced by
    // a nationwide one, and that branch is unreachable for any client with a service area. A
    // mutation putting a globe emoji back on it passed until this row existed.
    ["national", renderLandingPage({ ...clean, campaignSetup: { ...clean.campaignSetup, serviceArea: "Nationwide" } })],
  ];

  for (const [label, html] of pages) {
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

    ok(`🔴 the ${label} page links nowhere near BoldLine`,
      !hrefs.some((h) => /boldline|\.netlify\.app|^https?:\/\/os\./i.test(h)),
      `found: ${hrefs.filter((h) => /boldline|netlify/i.test(h)).join(", ")}`);

    // 🔴 Relative links are the quiet version. Live they hit the client's domain; previewed
    // in an iframe srcdoc they resolve against the OS.
    const relative = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//"));
    ok(`🔴 the ${label} page has no relative links`, relative.length === 0,
      `a relative href resolves against whatever document it sits in, which is the OS inside a `
      + `preview. found: ${relative.join(", ")}`);

    // Everything left must be one of the four shapes a client page legitimately uses.
    const odd = hrefs.filter((h) => !(h.startsWith("#") || h.startsWith("tel:") || h.startsWith("mailto:") || /^https:\/\//.test(h)));
    ok(`every link on the ${label} page is a fragment, a phone, an email or an https address`,
      odd.length === 0, `found: ${odd.join(", ")}`);

    ok(`the ${label} page never names BoldLine to the client's customer`,
      !/[Bb]old[Ll]ine/.test(html),
      "the visitor is on the client's own domain and has never heard of us");

    // 🔴 NO EMOJIS ON ANYTHING A CLIENT'S CUSTOMER SEES. Bryson, 2026-09-01: *"for all landing
    // pages and anything we make edit design etc. dont add emojis."* The page shipped with
    // pin, globe, lightning, lock, star and telephone emojis in the trust row, the chips, the
    // call buttons and the form reassurance line. Functional monochrome glyphs stay: a tick
    // and a star are typography, not emoji.
    const ALLOWED = new Set(["\u2713", "\u2605"]);
    const emoji = [...(html.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu) || [])]
      .filter((c) => !ALLOWED.has(c));
    ok(`🔴 the ${label} page a visitor receives has no emojis`, emoji.length === 0,
      `found: ${[...new Set(emoji)].join(" ")}`);

    // 🔴 NO EM DASHES ON ANYTHING A VISITOR READS. Bryson, 2026-08-14, named the em dash as
    // THE tell that makes copy read as AI-written, and the standing rule covers landing pages
    // by name. The generated copy was already policed; this page's OWN FURNITURE was not, and
    // it had six of them: the error line, the thank-you line, the review byline, the closing
    // reassurance, the form intro, and 🔴 THE PAGE TITLE, which is the line Google prints in
    // its results and the line every share preview shows. The marketing site regressed exactly
    // this way once, one dash at a time over eight weeks, each one looking fine on its own.
    // Rendered output only, so the bullet parser is free to keep splitting on a dash the model
    // hands it; what matters is that none survives into the page.
    const dashes = [...html.matchAll(/.{0,44}[\u2014\u2013].{0,44}/g)].map((m) => m[0]);
    ok(`🔴 the ${label} page a visitor receives has no em dashes`, dashes.length === 0,
      dashes.join("\n        "));

    // 🔴 NO STRAY WHITESPACE IN FRONT OF THE CLIENT'S NAME. Found on Stencil and Thread's
    // LIVE page the night it went up: a tab pasted in with the name rendered as
    // "... | \tStencil & Thread" in the <title>, which is the line Google prints in its
    // search results and the one every browser tab shows. It was in the logo alt text, the
    // header and the footer too. Nothing was checking, because nothing renders visibly
    // wrong on the page itself, only in the places a person does not look at while building.
    const inTitle = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "";
    ok(`the ${label} page title carries no tab or newline`, !/[\t\n\r]/.test(inTitle), JSON.stringify(inTitle));
    ok(`the ${label} page title has no doubled spaces`, !/  /.test(inTitle), JSON.stringify(inTitle));
    const alts = [...html.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]);
    ok(`no alt text on the ${label} page starts or ends with a space`,
      alts.every((a) => a === a.trim()), JSON.stringify(alts.filter((a) => a !== a.trim())));

    // 🔴 AND NO INTERNAL COMMENTARY IN THE CLIENT'S PAGE SOURCE. The submit handler is shipped
    // verbatim, so engineering notes written inside that string travel to the client's own
    // domain where their developer can read them. Reasoning belongs outside the template.
    ok(`🔴 the ${label} page ships no internal code comments`,
      (html.match(/\/\/ [A-Z]/g) || []).length === 0,
      "a client's developer viewing source should not be reading our notes about phantom "
      + "leads and preview guards");
  }

  // The escape hatch, asserted so nobody 'fixes' the rule into a blanket ban later. If Bryson
  // deliberately points a client at something of ours, that is his decision and it renders.
  const deliberate = renderLandingPage({ ...clean, bookingUrl: "https://boldlinemedia.com/book" });
  ok("but a link Bryson deliberately typed is still honoured",
    deliberate.includes("https://boldlinemedia.com/book"),
    "he asked for the rule 'unless i specifically want them to', so the guard is on what the "
    + "renderer invents, not on what he chooses");
}

// ── 🔴 NOTHING ON THE PAGE SITS OUT OF PLACE ────────────────────────────────
// Bryson, 2026-09-01: *"make sure everything is always uniform and not out of place"*, with a
// screenshot of the centred layout: headline, button, trust line and every section heading
// centred, and then two pills hard against the left edge.
//
// The real check is geometric and lives in `tools/audit-landing-uniformity.js`, which renders
// all four layouts at all four widths in a browser and measures them. This is the cheap guard
// that stops the fix being deleted between runs of that.
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const css = renderLandingPage({
    name: "S&T", landingSlug: "s", leadToken: "T",
    campaignSetup: { serviceArea: "Eugene, OR" },
    landingPage: { headline: "H", ctaText: "C", published: true, design: { layout: "centered" } },
  });

  ok("🔴 a centred page centres its chip row too",
    /\.lay-centered \.chips\{justify-content:center\}/.test(css),
    "the CONTAINER was already centred; the items inside were not, because a flex row packs "
    + "to the start unless told otherwise and text-align does nothing to flex children");
  ok("and the rule is scoped to that layout only",
    !/^\.chips\{[^}]*justify-content:center/m.test(css),
    "centring them everywhere would push them off the left edge that every other layout "
    + "lines up on");
}

// ── 🔴 A PASTED TAB MUST NOT REACH THE CLIENT'S NAME IN PUBLIC ──────────────────
// Found on Stencil and Thread's LIVE page the night it went up: a tab pasted in with the
// business name rendered as "... | \tStencil & Thread" in the <title>, which is the line
// Google prints in its search results and the one every browser tab shows. Also in the
// logo's alt text, the header and the footer.
//
// 🔴 THE CHECKS ADDED ALONGSIDE THIS ONE COULD NOT FAIL. They assert the rendered title
// has no tab, but every fixture in this file already uses a clean name, so they were
// guaranteed by the fixture rather than by the code. Removing the trim entirely left them
// all passing. This one hands the renderer a deliberately filthy name, which is the only
// version that actually tests anything.
{
  const filthy = "\tStencil  &   Thread \n";
  const { renderLandingPage: render } = await import("../netlify/functions/landing.mjs");
  const html = render({
    name: filthy, landingSlug: "stencil", leadToken: "TOK",
    campaignSetup: { serviceArea: "Eugene, OR" },
    landingPage: { headline: "Custom shirts, fast.", subheadline: "25 or more.", ctaText: "Get a quote", published: true,
      design: { layout: "split", benefits: "cards", background: "clean", shape: "rounded", font: "modern", motion: "up", order: "a" } },
  });
  const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "";
  ok("a name pasted with a tab and doubled spaces is cleaned before it is printed",
    /\| Stencil &amp; Thread$/.test(title) && !/[\t\n\r]/.test(title) && !/  /.test(title),
    JSON.stringify(title));
  ok("and nowhere on the page keeps the raw version", !html.includes(filthy));
  const alts = [...html.matchAll(/alt="([^"]*)"/g)].map((m) => m[1]);
  ok("nor does any alt text", alts.every((a) => a === a.trim() && !/[\t\n\r]/.test(a)),
    JSON.stringify(alts.filter((a) => a !== a.trim() || /[\t\n\r]/.test(a))));
}

// ── 🔴 THE LINK THE OS HANDS HIM MUST BE THE CLIENT'S OWN DOMAIN ─────────────
// Bryson, 2026-09-03: *"for the dns can i get the link because when i copy the link from the
// os it gives me this one https://boldlinemedia.netlify.app/lp/stencil-thread-rdju"*.
//
// 🔴 HE PRESSED THE HARMLESS ONE. FIVE places built that URL by gluing the OS's own origin
// to `/lp/<slug>`, and none of them read `campaignSetup.landingDomain`. Two of the five are
// the Google and Meta campaign builders, so EVERY AD WE BUILT POINTED AT
// boldlinemedia.netlify.app — the precise thing this file's own rule forbids, because Google
// displays the address an ad points to and a screen printer's ad must not show a marketing
// agency's domain. Copy Live Link was the least of it.
{
  const src = readFileSync(join(ROOT, "index.html"), "utf8");
  const i = src.indexOf("const landingUrlFor = ");
  ok("the shared URL helper exists", i > 0);
  const decl = src.slice(i, src.indexOf("\n};", i) + 3);
  const landingUrlFor = new Function(`${decl}\nreturn landingUrlFor;`)();

  const withDomain = { landingSlug: "stencil-thread-rdju", campaignSetup: { landingDomain: "quote.stencilandthread.com" } };
  eq("their own domain is used when they have one",
    landingUrlFor(withDomain), "https://quote.stencilandthread.com");

  // 🔴 The ROOT, not /lp/<slug>. `routeFor` sends every path on a client host to their page,
  // so the slug path happens to work and reads like an accident.
  ok("and without our /lp/ path on the end", !/\/lp\//.test(landingUrlFor(withDomain)));

  // 🔴 The whole reason this was invisible: with no domain set, the old behaviour is still
  // correct, so nothing looked wrong until a client actually had one.
  ok("with no domain it still falls back to our own address",
    /\/lp\/stencil-thread-rdju$/.test(landingUrlFor({ landingSlug: "stencil-thread-rdju", campaignSetup: {} })));

  eq("a domain typed with a scheme or a trailing slash is cleaned up",
    landingUrlFor({ campaignSetup: { landingDomain: "https://quote.stencilandthread.com/" } }),
    "https://quote.stencilandthread.com");
  eq("and it is always https, never the http they may have typed",
    landingUrlFor({ campaignSetup: { landingDomain: "http://quote.stencilandthread.com" } }),
    "https://quote.stencilandthread.com");

  eq("the preview key rides on their domain too",
    landingUrlFor(withDomain, { preview: "abc123" }), "https://quote.stencilandthread.com?preview=abc123");

  eq("a client with neither a domain nor a slug gets an empty string, not a broken link",
    landingUrlFor({ campaignSetup: {} }), "");
  eq("and a missing client does not throw", landingUrlFor(null), "");

  // 🔴 Nothing may build this URL by hand any more, or the sixth place gets it wrong again.
  const strays = (src.match(/\$\{window\.location\.origin\}\/lp\//g) || []).length;
  eq("nothing glues the OS origin onto /lp/ by hand any more", strays, 0);
}

console.log(`verify-lead-handoff: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
