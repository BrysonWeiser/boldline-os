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

console.log(`verify-lead-handoff: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
