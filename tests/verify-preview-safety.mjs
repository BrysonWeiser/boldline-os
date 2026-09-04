// 🔴 A PREVIEW MUST NEVER CHANGE ANYTHING REAL.
//
// Bryson, 2026-09-01, after finding that the landing page preview navigated to the OS:
// *"make sure to always check that things like that dont happen with future clients or
// anything we build."* So this is the enforcement, not a note. The rule it enforces:
//
//   Anything the OS renders into an iframe so Bryson can LOOK at it must be incapable of
//   writing to a client's record, sending to a real person, spending money, or navigating
//   the OS away from itself.
//
// That rule is easy to agree with and easy to break, because every one of these previews is
// built by handing a REAL client object, carrying REAL access tokens, to the same renderer
// that serves the real thing. Same origin, same token, same code. The only thing standing
// between "looking at it" and "doing it" is a guard somebody remembered to add.
//
// Two live bugs of exactly this shape were found in one sitting:
//
//   1. The landing page preview navigated the frame to the OS on its main button, because a
//      bare `href="#lead-form"` inside an `iframe srcdoc` resolves against the PARENT
//      document. It also carried the real leadToken and would have posted a phantom lead.
//   2. 🔴 THE CLIENT PORTAL PREVIEW ACTUALLY FIRED. Pressing Approve or Request Changes in
//      the preview sent a real POST with the client's real portal token and recorded a
//      decision the client never made. Confirmed in a headless browser, not inferred.
//
// 🔴 THE MANIFEST BELOW IS THE POINT OF THIS FILE. Every `srcDoc` embed in the OS must be
// listed with what makes it safe. A new preview added without an entry FAILS THIS SUITE,
// which forces the question to be asked once rather than discovered by a client.

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

// ── Every embed the OS renders, and why each one cannot do harm ──────────────
// Adding a preview means adding a row here. That is the whole mechanism.
const MANIFEST = {
  "Landing Page Preview": "carries the real leadToken; guarded by an about: check before the intake fetch",
  "Client Portal": "carries the real portalToken; guarded by BL_PREVIEW blocking every non-GET request",
  "Service Agreement": "inert document, no fetch / form / onclick / external links",
  "Contract": "inert document, no fetch / form / onclick / external links",
  "Email preview": "sandboxed with no allow-scripts, so nothing in it can run",
};

// 🔴 NOT IN THE MANIFEST, AND DELIBERATELY SO: saved landing pages (2026-09-04). They are the
// sharpest preview-safety case in the codebase, because an archived page carries the client's
// REAL lead token and lands in a PUBLIC bucket, so a tap on its form would create a real lead
// from a page nobody is running. They are absent here because they are not `srcDoc` embeds:
// they are neutralised at the moment they are WRITTEN (every script, the form action, the
// token and every href) and opened in a new tab rather than inside the OS. Guarded by
// tests/verify-page-archive.mjs. If an archive is ever shown in an iframe instead, it belongs
// in the manifest above.

// ── 1. 🔴 NO UNREVIEWED PREVIEWS ─────────────────────────────────────────────
{
  // Pull the title off every iframe that is handed rendered HTML.
  const embeds = [];
  const re = /<iframe\b[^>]*src[Dd]oc[^>]*>/g;
  let m;
  while ((m = re.exec(UI))) {
    const tag = m[0];
    const t = /title="([^"]+)"/.exec(tag);
    embeds.push({ title: t ? t[1] : "(untitled)", tag });
  }
  // The contract embed is built by string concatenation rather than JSX, so it is matched
  // separately; without this the suite would silently cover one fewer preview than it claims.
  for (const t of (UI.match(/srcdoc="'\+[a-zA-Z]+/g) || [])) {
    const line = UI.slice(UI.indexOf(t) - 400, UI.indexOf(t) + 200);
    const title = /title="([^"]+)"/.exec(line);
    if (title && !embeds.some((e) => e.title === title[1])) embeds.push({ title: title[1], tag: line });
  }

  ok("the OS still renders previews at all", embeds.length >= 4, `found ${embeds.length}`);
  for (const e of embeds) {
    ok(`🔴 the "${e.title}" preview is accounted for`, !!MANIFEST[e.title],
      "a new preview was added without deciding what stops it changing real data. Add it to "
      + "MANIFEST in this file, with a real guard, and add an assertion for that guard below.");
  }
  ok("🔴 every untitled embed is rejected", !embeds.some((e) => e.title === "(untitled)"),
    "an embed with no title cannot be reasoned about or matched to the manifest");
}

// ── 2. The landing page: cannot post, cannot navigate away ───────────────────
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const page = renderLandingPage({
    name: "Stencil & Thread", landingSlug: "s", leadToken: "REAL-TOKEN",
    campaignSetup: { serviceArea: "Eugene, OR" },
    landingPage: { headline: "Shirts", subheadline: "Fast", ctaText: "Get a quote", published: true },
  });

  ok("🔴 a submit from a preview cannot reach the intake",
    /indexOf\('about:'\)===0/.test(page)
      && page.indexOf("indexOf('about:')===0") < page.indexOf("functions/lead-intake?token="),
    "the guard has to sit BEFORE the send, or it is not a guard");
  ok("🔴 and its own buttons cannot navigate the frame to the OS",
    /querySelectorAll\('a\[href\^="#"\]'\)/.test(page) && /preventDefault\(\)/.test(page),
    "a bare fragment href resolves against the PARENT document inside an iframe srcdoc");
}

// ── 3. 🔴 THE PORTAL: the one that was actually firing ───────────────────────
// Both copies. The portal exists twice (the served function and the OS's own mirror), and a
// guard in only one of them is a guard that is absent exactly where Bryson clicks.
{
  const { _internal } = await import("../netlify/functions/portal.mjs");
  const pkg = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" };
  const client = {
    name: "Stencil & Thread", contactName: "Sebastian", packageId: "g-launch",
    portalToken: "REAL-CLIENT-TOKEN", leadsLog: [], commLog: [],
    approvals: [{ id: "a1", kind: "landing_page", title: "Page", body: "b", status: "pending", createdAt: "2026-09-01T00:00:00Z" }],
  };
  const served = _internal.makePortalHTML(client, pkg);

  // 🔴 THE DETECTION ITSELF, not just the branch it guards. A first pass asserted only that
  // the pieces were present, and setting BL_PREVIEW=false still passed: a guard that is never
  // armed reads identically to one that works. Pin the expression.
  const ARMED = /BL_PREVIEW=String\(location\.href\)\.indexOf\('about:'\)===0/;

  for (const [label, html] of [["served portal", served], ["the OS's own copy", UI]]) {
    ok(`🔴 ${label} actually detects a preview, rather than defining the flag`, ARMED.test(html),
      "BL_PREVIEW=false leaves every string in this suite intact while disarming the guard "
      + "completely, which is the exact shape of a mutation that got through once");
    ok(`🔴 ${label} blocks every state-changing request in a preview`,
      /BL_PREVIEW/.test(html) && /if\(m==='GET'\|\|m==='HEAD'\)return _blFetch/.test(html)
        && /Promise\.reject\(new Error\('preview'\)\)/.test(html),
      "pressing Approve in the preview sent a real POST carrying the client's real portal "
      + "token and recorded a decision the client never made");
    ok(`${label} still allows reads, so the preview renders`, /m==='GET'\|\|m==='HEAD'/.test(html),
      "blocking everything would make the preview useless, which gets the guard removed later");
    ok(`${label} says out loud that it is a preview`, /Preview only\. Buttons here do nothing\./.test(html),
      "a button that silently does nothing reads as broken, and broken previews get 'fixed' "
      + "by deleting the guard");
    ok(`${label} suppresses the failure alert`, /window\.alert=function\(\)\{\}/.test(html));
    ok(`${label} answers no to any confirm`, /window\.confirm=function\(\)\{return false;\}/.test(html),
      "deleting a client's uploaded file asks for confirmation first, so this stops it earlier");
  }

  // 🔴 THE TWO COPIES MUST NOT DRIFT. The portal exists twice on purpose, and every bug of
  // this class so far has been one copy fixed and the other forgotten.
  const grab = (h) => (/(var BL_PREVIEW=[\s\S]{0,700}?document\.body\.firstChild\);\}catch\(e\)\{\}\})/.exec(h) || [])[1] || "";
  ok("🔴 both copies carry byte-identical guards", !!grab(served) && grab(served) === grab(UI),
    "a guard in only one copy is absent exactly where Bryson clicks");

  // The token is genuinely present, which is what makes the guard load-bearing rather than
  // theoretical. An assertion the data cannot violate is not a test.
  ok("🔴 the preview really does carry the client's live token",
    served.includes("REAL-CLIENT-TOKEN"),
    "if it did not, this whole suite would be guarding nothing");
}

// ── 4. The contract: inert by construction ───────────────────────────────────
{
  const shared = readFileSync(join(ROOT, "netlify/lib/contract-shared.cjs"), "utf8");
  for (const [what, pattern] of [["fetch", /fetch\(/], ["a form", /<form/], ["an onclick", /onclick/]]) {
    ok(`the contract document contains no ${what}`, !pattern.test(shared),
      "the contract preview is deliberately unsandboxed, which is only safe while the "
      + "document itself can do nothing");
  }
}

// ── 5. The email preview: nothing in it may run ──────────────────────────────
{
  ok("🔴 the email preview is sandboxed with no allow-scripts",
    /title="Email preview" srcDoc=\{open\.html\} sandbox=""/.test(UI),
    "email bodies are assembled from client data and rendered same-origin with the OS; "
    + "scripts have no business running there");
}

console.log(`verify-preview-safety: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
