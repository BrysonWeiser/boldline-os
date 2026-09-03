// Publishing a landing page and asking the client to approve it are two separate actions.
//
// Bryson, 2026-09-02: *"when I pressed publish for the updated landing page it automatically
// published it and sent it for approval... add a button that says send for approval... and
// make it so if I want to manually publish the page without sending for approval that's what
// the publish button does"*.
//
// The old single button did both. That was his own earlier request (2026-07-30, "don't make
// me manually request it") and it was right while publishing was the only action there was.
// It stopped being right the moment he needed to fix a typo on a live page, because every
// small edit re-published AND emailed the client another approval request.
//
// 🔴 THE TRAP THIS SUITE EXISTS FOR, WHICH IS NOT THE BUTTONS. An unpublished page does not
// render: landing.mjs serves a Coming Soon placeholder. So "send for approval" on an
// unpublished page would email the client a link to a page that is not there, and they would
// reasonably reply asking what happened. That failure is invisible from the OS, because
// everything on Bryson's side would report success.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const LANDING = readFileSync(join(ROOT, "netlify/functions/landing.mjs"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

// ── 🔴 THE REAL GATE, EXECUTED ─────────────────────────────────────────────────
// The three lines are lifted OUT OF THE SHIPPING FILE and run, rather than restated here.
// A restated copy of a rule is a second implementation that happens to agree today; this
// fails the moment the real expression changes.
const gate = (() => {
  // 🔴 The end anchor is searched FROM the start anchor. `return html(renderLandingPage(cl))`
  // appears twice in this file and the earlier one sits above the gate, so an unanchored
  // search produced an empty slice and this lifted nothing at all.
  const from = LANDING.indexOf('const key = String(url.searchParams.get("preview")');
  assert.ok(from > 0, "the preview gate is gone from landing.mjs");
  const src = LANDING.slice(from, LANDING.indexOf("return html(renderLandingPage(cl));", from));
  assert.ok(src.includes("previewing") && src.includes("comingSoonPage"), "could not lift the publish gate out of landing.mjs");
  // `comingSoonPage` becomes a marker so the branch taken is observable.
  const body = src.replace("return comingSoonPage(cl.name);", 'return "coming-soon";') + '\nreturn "real-page";';
  return new Function("url", "lp", `const comingSoonPage=()=>"coming-soon";const cl={};${body}`);
})();

const asUrl = (preview) => new URL(`https://x.test/lp/s${preview == null ? "" : `?preview=${encodeURIComponent(preview)}`}`);

t("a published page renders, key or no key", () => {
  assert.equal(gate(asUrl(null), { published: true, headline: "H" }), "real-page");
  assert.equal(gate(asUrl("anything"), { published: true, headline: "H" }), "real-page");
});

t("an unpublished page with no key is still Coming Soon", () => {
  assert.equal(gate(asUrl(null), { published: false, headline: "H", previewKey: "abc" }), "coming-soon");
});

t("🔴 an unpublished page with the RIGHT key renders the real page", () => {
  // This is the entire point. Without it, sending for approval emails a dead link.
  assert.equal(gate(asUrl("abc"), { published: false, headline: "H", previewKey: "abc" }), "real-page");
});

t("a wrong key does not open it", () => {
  for (const bad of ["ABC", "ab", "abcd", "abc ", " abc", "x"]) {
    assert.equal(gate(asUrl(bad), { published: false, headline: "H", previewKey: "abc" }), "coming-soon",
      `an unpublished page opened with the wrong key: ${JSON.stringify(bad)}`);
  }
});

t("🔴 a page with no key set cannot be opened by sending an empty one", () => {
  // The hole the emptiness check exists to close. Without it, `"" === undefined` is false so
  // this happens to pass, but `String(undefined)` games and `?preview=` on a client whose key
  // is an empty string would open EVERY unpublished page to anyone who guessed the slug.
  for (const lp of [{ published: false, headline: "H" },
                    { published: false, headline: "H", previewKey: "" },
                    { published: false, headline: "H", previewKey: null }]) {
    for (const sent of ["", null]) {
      assert.equal(gate(asUrl(sent), lp), "coming-soon",
        `an unpublished page with no key was opened: lp=${JSON.stringify(lp)} sent=${JSON.stringify(sent)}`);
    }
  }
});

t("a page with no headline is Coming Soon however it is asked for", () => {
  assert.equal(gate(asUrl("abc"), { published: true, previewKey: "abc" }), "coming-soon");
  assert.equal(gate(asUrl("abc"), { published: false, previewKey: "abc" }), "coming-soon");
});

// ── The two actions, and the line between them ─────────────────────────────────
const fn = (name) => {
  const i = S.indexOf(`const ${name} = `);
  assert.ok(i > 0, `${name} is gone`);
  return S.slice(i, S.indexOf("\n  };", i));
};

t("🔴 Publish no longer emails anybody", () => {
  const body = fn("handleTogglePublish");
  for (const forbidden of ["makeApproval", "notifyClientApproval", "approvals", "commLog"]) {
    assert.ok(!body.includes(forbidden),
      `Publish still does "${forbidden}", so every small edit to a live page re-sends the client an approval request`);
  }
  assert.match(body, /published:goingLive/, "Publish no longer publishes");
});

t("🔴 Send for approval does not publish", () => {
  const body = fn("handleSendForApproval");
  assert.ok(!/published:\s*true/.test(body),
    "sending for approval also publishes the page, which is the behaviour being separated");
  assert.match(body, /notifyClientApproval/, "it does not actually email anybody");
  assert.match(body, /makeApproval/, "no approval item is created, so nothing appears in their portal");
});

t("it refuses to send twice, or to send on the house account", () => {
  const body = fn("handleSendForApproval");
  // 🔴 The house account has no client. Emailing an approval request there would send it to
  // Bryson about his own page.
  assert.match(body, /if \(client\.internal \|\| hasPendingApproval\(client,"landing_page"\)\) return;/,
    "a second approval can be queued, or one can be sent on the house account");
});

t("🔴 the key is only attached when the page is NOT live", () => {
  const body = fn("handleSendForApproval");
  assert.match(body, /lp\.published\?"":`\?preview=\$\{key\}`/,
    "the preview key is either always attached or never attached; it belongs only on an unpublished page");
});

t("🔴 the preview key is not the portal token", () => {
  const body = fn("handleSendForApproval");
  assert.ok(!/portalToken/.test(body),
    "the portal token is being put in a page address; the full URL travels in the referrer header to every third-party host the page loads");
  assert.match(body, /randomUUID/, "the key is not random");
});

t("an existing key is reused rather than rotated on every send", () => {
  // Rotating it would silently break the link in an approval email already sitting in the
  // client's inbox, which is the same dead-link failure in a slower costume.
  assert.match(fn("handleSendForApproval"), /lp\.previewKey \|\|/,
    "a fresh key is minted every send, which kills the link in any approval email already sent");
});

// ── The buttons ────────────────────────────────────────────────────────────────
t("both buttons are on the card and say what they do", () => {
  assert.match(S, /Send to \{client\.name\.split\(" "\)\[0\]\} for Approval/, "there is no send-for-approval button");
  assert.match(S, /\{client\.landingPage\.published\?"Unpublish":"Publish"\}/, "the publish button is gone");
  // 🔴 The whole confusion was not knowing which button emails the client. Both now say so.
  assert.match(S, /title="Emails the client a link to look at and approve\. Does not publish\."/);
  assert.match(S, /Puts the page live straight away\. Nobody is emailed\./);
});

t("the approval button is hidden on the house account and while one is pending", () => {
  const i = S.indexOf("Send to {client.name.split");
  const before = S.slice(Math.max(0, i - 700), i);
  assert.ok(/!client\.internal/.test(before), "the house account is offered a button that emails Bryson his own page");
  assert.ok(/hasPendingApproval\(client,"landing_page"\)/.test(before), "a second approval request can be sent while one is outstanding");
  assert.match(S, /Waiting on \{client\.name\} to approve/, "nothing tells him why the button is not there");
});

console.log(`✓ verify-publish-vs-approval: ${n} checks passed`);
