// Saved copies of a client's landing page, and the showcase rights that let us publish them.
//
// Bryson, 2026-09-04: *"have aria take screenshots of published landing pages... that way we
// can use it for content and case studies"*, then *"make sure there is a way for me to access
// the saved page and delete them when I want"*, and *"should we also add in future contracts
// that we are able to use any work we've done for content purposes... but will not sell
// information"*.
//
// 🔴 WHY THE PAGE AND NOT A SCREENSHOT. `landing.mjs` rebuilds every landing page from the
// database on every single request. There is no stored copy anywhere. That is why an edit
// goes live instantly, and it is also why the version that produced leads exists only until
// somebody edits the record. A screenshot is a low-resolution picture of that; the page is
// the thing, and an image can be made from it later.
//
// 🔴 AND WHY A SAVED PAGE IS DANGEROUS. A landing page is not an inert document. It carries a
// submit handler pointing at `lead-intake?token=<the client's REAL lead token>`. Save it
// verbatim, open it months later to show somebody, tap the form, and a REAL LEAD lands on
// that client's record and is forwarded to their CRM from a page nobody is running. That is
// the standing preview-safety rule, and this is the sharpest case of it in the codebase,
// because the archive also sits in a PUBLIC bucket.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const FN = readFileSync(join(ROOT, "netlify/functions/page-archive.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S), F = code(FN);
let n = 0;
const t = (name, fn) => { fn(); n++; };

const { neutraliseArchive, archiveEntry, ARCHIVE_BUCKET } = await import("../netlify/lib/page-archive-shared.mjs");
const { renderLandingPage } = await import("../netlify/functions/landing.mjs");

// A REAL page from the REAL renderer. Neutralising tested against a hand-written sample would
// only prove the sample was easy.
const CLIENT = {
  id: "c1", name: "Stencil & Thread", landingSlug: "st", leadToken: "REAL_LEAD_TOKEN_abc123",
  businessPhone: "(541) 555-0100",
  campaignSetup: { serviceArea: "Eugene, OR", bookingUrl: "https://calendly.com/x",
    privacyUrl: "https://stencilandthread.com/privacy.html", conversionId: "AW-123" },
  landingPage: { headline: "Custom shirts, fast.", subheadline: "25 pieces or more.",
    ctaText: "Get My Free Quote", published: true },
};
const LIVE = renderLandingPage(CLIENT);
const SAFE = neutraliseArchive(LIVE, archiveEntry({ headline: "Custom shirts, fast.", clientId: "c1" }));

// ── 1. 🔴 THE SAVED PAGE CANNOT DO ANYTHING ─────────────────────────────────
t("🔴 the live page really does carry the machinery, so this is not a theoretical risk", () => {
  assert.match(LIVE, /<script/i, "if the live page had no scripts, none of these checks mean anything");
  assert.ok(LIVE.includes("REAL_LEAD_TOKEN_abc123"), "the live page must carry the token for the test to be real");
});

t("🔴 no script survives into the archive", () => {
  assert.ok(!/<script/i.test(SAFE),
    "the submit handler, the click-id capture and the conversion tag all still fire, from a "
    + "page nobody is running");
});

t("🔴 THE LEAD TOKEN IS GONE FROM THE TEXT", () => {
  // The scripts are stripped, but the token lived inside one. This file lands in a PUBLIC
  // bucket: anyone holding it can post leads to that client for as long as it is valid.
  assert.ok(!SAFE.includes("REAL_LEAD_TOKEN_abc123"),
    "a public file carries a working lead token, so anyone with the link can create leads on "
    + "that client");
  // 🔴 AND THE SCRUB IS TESTED ON ITS OWN, not just through the script strip. Removing the
  // scrub line entirely still passed this, because the token happens to live inside a script
  // today. That makes it look redundant and invites deleting it. It is not redundant: one
  // odd script tag this stripper fails to match, or a token that ever appears in markup,
  // and the scrub is the only thing left. So it is exercised where the strip cannot help.
  const bare = neutraliseArchive(
    '<body><p>see /.netlify/functions/lead-intake?token=REAL_LEAD_TOKEN_abc123 here</p></body>',
    archiveEntry({ clientId: "c1" }));
  assert.ok(!bare.includes("REAL_LEAD_TOKEN_abc123"),
    "a token sitting in the markup rather than inside a script survives into a public file");
});

t("🔴 the form cannot be submitted, three ways over", () => {
  assert.ok(!/<form[^>]*\saction\s*=/i.test(SAFE), "the form still has somewhere to post to");
  assert.match(SAFE, /onsubmit="return false"/, "submitting is not blocked");
  assert.match(SAFE, /<fieldset disabled/, "the fields are still fillable, which invites the tap");
});

t("no inline handler survives", () => {
  assert.ok(!/\son(?:click|submit|change|load)\s*=\s*["'][^"']*[a-z(]/i.test(SAFE.replace(/onsubmit="return false"/g, "")),
    "an attribute handler is not a script tag and survives a script-only strip");
});

t("🔴 links do not go anywhere", () => {
  // A booking link still takes a real booking and a phone link still rings the client.
  assert.ok(!/<a[^>]*\shref\s*=/i.test(SAFE), "a saved page can still book a meeting or ring the client");
  assert.match(SAFE, /data-archived-href/, "the destination was destroyed rather than parked, so the record is incomplete");
});

// ── 2. But it still LOOKS like the page ─────────────────────────────────────
t("🔴 the visual record is intact, which is the entire point", () => {
  assert.ok(SAFE.includes("Custom shirts, fast."), "the headline is gone");
  assert.ok(SAFE.includes("Get My Free Quote"), "the call to action is gone");
  assert.match(SAFE, /<style/i, "the styling is gone, so the archive is not a record of how it looked");
  assert.ok(SAFE.length > LIVE.length * 0.5,
    "half the page vanished, which means the stripper is eating content and not just plumbing");
});

t("🔴 it says on the page that it is a saved copy", () => {
  // Pixel-identical to the live page otherwise. The first time somebody opens the wrong tab
  // they will believe it is live and act on it.
  assert.match(SAFE, /Saved copy/, "nothing distinguishes it from the live site");
  assert.match(SAFE, /Nothing on this page works/, "it does not say the page is inert");
});

t("the banner survives a page with no body tag", () => {
  const odd = neutraliseArchive("<div>hello</div>", archiveEntry({ clientId: "c1" }));
  assert.match(odd, /Saved copy/, "a malformed page silently loses its warning");
});

// ── 3. Naming and storage ───────────────────────────────────────────────────
t("each saved page is named by something he would recognise", () => {
  const e = archiveEntry({ headline: "Custom shirts, fast.", clientId: "c1" });
  assert.equal(e.label, "Custom shirts, fast.", "a list of identical timestamps cannot be chosen from");
  assert.match(e.path, /^c1\//, "archives are not filed under their client");
  assert.match(e.id, /^\d{4}-\d{2}-\d{2}-/, "the id carries no date, so storage cannot be read by eye");
});

t("two saves in the same second do not collide", () => {
  const a = archiveEntry({ clientId: "c1" }), b = archiveEntry({ clientId: "c1" });
  assert.notEqual(a.id, b.id, "a same-second save would overwrite the earlier one");
});

// ── 4. 🔴 DELETING, which Bryson asked for in the same breath ───────────────
t("🔴 the file is removed BEFORE the record", () => {
  // Clearing the record first and failing on the file leaves a page in a public bucket with
  // nothing in the OS pointing at it: the one outcome nobody can find again to fix.
  const i = F.indexOf('action === "delete"');
  assert.ok(i > 0, "there is no delete path at all");
  const body = F.slice(i, F.indexOf("// ── SAVE", i));
  assert.ok(body.indexOf(".remove([hit.path])") < body.indexOf('.update({ data: next })'),
    "the record is cleared first, so a failed file delete strands a public page forever");
});

t("a failed save does not strand a file either", () => {
  assert.match(F, /remove\(\[entry\.path\]\)\.catch/, "a written file with no record is an orphan nobody can reach");
});

t("deleting something already gone says so instead of pretending", () => {
  assert.match(FN, /That saved page is not there any more/);
});

// ── 5. Reachable, and only by the owner ─────────────────────────────────────
t("it is behind the owner's login and refuses anything but a POST", () => {
  assert.match(F, /auth\.getUser\(jwt\)/, "anyone on the internet can archive or delete a client's pages");
  assert.match(F, /Method not allowed/);
});

t("🔴 nothing is saved from an unpublished page", () => {
  assert.match(FN, /The page has to be published first/,
    "archiving a draft stores a Coming Soon placeholder as though it were the client's page");
});

t("the card is rendered, and can save, view and delete", () => {
  assert.match(UI, /function PageArchiveCard\(\{client,onUpdate\}\)/, "the card does not exist");
  assert.match(UI, /<PageArchiveCard client=\{client\} onUpdate=\{onUpdate\}\/>/, "the card is never rendered");
  assert.match(S, /Save how it looks now/);
  assert.match(UI, /action:"delete", archiveId: a\.id/, "there is no way to delete one");
  // 🔴 Pin the GATE, not the word. `/window.confirm/` passed with the call behind `false&&`,
  // because the text was still in the file. Checking a line exists is not checking it runs.
  assert.match(UI, /if \(!window\.confirm\(/,
    "deleting is irreversible and nothing keeps another copy, so it must ask first");
});

// ── 5b. 🔴 SEEING IT AT THE SIZE PEOPLE SEE IT ──────────────────────────────
// Bryson chose this over a paid screenshot service and over a card generator: with one
// client, what he needs is to open a saved page at phone width and screenshot it himself.
// A real screenshot, no new service, no credential, no monthly fee.
t("🔴 the phone view exists and is reachable from the row", () => {
  assert.match(UI, /const wrapperHTML = \(a\) =>/, "there is no framed viewer");
  assert.match(UI, /onClick=\{\(\)=>openFramed\(a\)\}/, "the viewer is never reachable");
  assert.match(S, /Phone view/, "the button has no label he would recognise");
});

t("🔴 it opens at PHONE width by default", () => {
  // Opening at desktop width and asking him to switch defeats the point: the screenshot he
  // wants is the one people actually see.
  assert.match(UI, /iframe\{[^}]*width:390px/, "the frame does not start at phone width");
  assert.match(UI, /id=\\"w1\\" checked/, "phone is not the selected size on open");
});

t("and tablet and desktop are one tap away", () => {
  assert.match(UI, /#w2:checked~\.stage iframe\{width:768px\}#w3:checked~\.stage iframe\{width:1280px\}/,
    "the other widths are advertised but do nothing");
});

t("🔴 THE WRAPPER CONTAINS NO SCRIPT, and that is a deliberate constraint", () => {
  // A script here would need `</scr`+`ipt>` escaping inside a file that is itself one giant
  // script block, which is the exact shape of edit that has blanked this whole app before.
  // The width switch is CSS radios for that reason, so this is pinned rather than assumed.
  const i = UI.indexOf("const wrapperHTML = (a) =>");
  const body = UI.slice(i, UI.indexOf("\n  };", i));
  assert.ok(!/<script/i.test(body), "the wrapper carries a script, which needs escaping this file cannot safely hold");
  assert.match(body, /input type=\\"radio\\"/, "the width switch is not the CSS-only one");
});

t("🔴 the frame is sandboxed as well", () => {
  // The archive is already dead when written. This is the second lock on a bolted door, and
  // it costs nothing.
  const i = UI.indexOf("const wrapperHTML = (a) =>");
  const body = UI.slice(i, UI.indexOf("\n  };", i));
  assert.match(body, /sandbox title=/, "the frame grants the archive full privileges");
});

t("🔴 the label and URL are escaped into the wrapper", () => {
  // A client's business name goes into this document. An apostrophe or an angle bracket in
  // it would otherwise break the page, and a quote in the URL would break out of the src.
  const i = UI.indexOf("const wrapperHTML = (a) =>");
  const body = UI.slice(i, UI.indexOf("\n  };", i));
  assert.match(body, /replace\(\/\[<>&\]\/g/, "the page title is injected raw");
  assert.match(body, /replace\(\/"\/g, "&quot;"\)/, "the archive URL is injected raw into an attribute");
});

t("a blocked pop-up says so instead of doing nothing", () => {
  assert.match(S, /Your browser blocked the new tab/,
    "the button silently does nothing, which reads as broken");
});

t("🔴 a saved page opens in a new tab, never inside the OS", () => {
  // It carries the client's own full-page styling. Dropping that into the OS is how a preview
  // ends up restyling or navigating the app around it.
  assert.match(UI, /href=\{a\.url\} target="_blank" rel="noopener noreferrer"/,
    "the archive is embedded in the OS, where its own styles and layout apply to our app");
});

t("the card explains why saving is needed at all", () => {
  assert.match(S, /rebuilt fresh every time somebody opens it, so nothing keeps the old version/,
    "without the reason, this looks like a pointless extra button and never gets pressed");
});

// ── 6. 🔴 THE CONTRACT RIGHT THAT MAKES PUBLISHING THEM LEGAL ───────────────
{
  const cs = await import("../netlify/lib/contract-shared.cjs");
  const make = cs.default && typeof cs.default === "function" ? cs.default
    : (cs.makeContractHTML || Object.values(cs.default || cs).find((v) => typeof v === "function"));
  const base = { name: "X", packageId: "g-launch", billingMonthly: 400, billingSetup: 750, billingPerLead: 50, contractTermMonths: 3 };
  const txt = (cl) => make(cl, {}).replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");
  const v3 = txt({ ...base, contractTermsVersion: 3 });
  const v4 = txt({ ...base, contractTermsVersion: 4 });
  const out = txt({ ...base, contractTermsVersion: 4, showcaseOptOut: true });

  t("🔴 a client who signed v3 never gains the clause", () => {
    // A signed agreement must never grow a term it was not signed with. This is the whole
    // reason terms are versioned.
    assert.ok(!/Showcase and case study/.test(v3), "an already-signed contract gained a new grant");
    assert.match(v3, /Portfolio rights/, "the older clause vanished, leaving v3 with no portfolio right at all");
  });

  t("v4 grants the showcase right in plain terms", () => {
    assert.match(v4, /Showcase and case study rights/);
    assert.match(v4, /landing pages, advertisements, creative assets and campaign structure/);
    assert.match(v4, /screenshots, recordings, written case studies/);
  });

  t("🔴 AND PROMISES THE LEAD DATA IS NEVER SOLD, which is what makes it signable", () => {
    assert.match(v4, /will not publish, share, license or sell the personal information/,
      "the grant is broad with no carve-out, which is the version a client refuses to sign");
    assert.match(v4, /names, email addresses, telephone numbers/,
      "a vague promise about 'data' is not a promise about their customers' phone numbers");
  });

  t("their confidential business information is excluded", () => {
    assert.match(v4, /costs, margins, supplier terms, pricing to its own customers/);
  });

  t("results can be published without naming them", () => {
    assert.match(v4, /describe Client generically rather than by name/,
      "a client whose competitors would learn their cost per lead has no option but to refuse");
  });

  t("and any single item can be pulled on request", () => {
    assert.match(v4, /stop publishing any specified item/);
    assert.match(v4, /not required to recall material already distributed/,
      "an unlimited recall obligation is one nobody can actually honour");
  });

  t("🔴 a client can decline it without losing the deal", () => {
    assert.match(out, /has not granted Agency the right to publish/, "there is no way to opt out");
    assert.ok(!/Showcase and case study/.test(out),
      "the opt-out shows the refusal AND the grant, so the contract says both at once");
  });
}

console.log(`✓ verify-page-archive: ${n} checks passed`);
