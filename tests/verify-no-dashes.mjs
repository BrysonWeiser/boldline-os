// Nothing BoldLine writes may contain a dash used as a sentence connector.
// Run: node tests/verify-no-dashes.mjs
//
// Bryson, 2026-08-14: no copy may read as AI-written, and the em dash is the tell he named.
// Bryson, 2026-08-20: "make sure for all of the ad copy for my ads and clients and anything
// we write that we avoid using - because it makes it seem ai written."
//
// TWO THINGS WERE WRONG, and the second is the one that let it keep reaching him.
//
// 1. THE PLAIN HYPHEN WAS NEVER CAUGHT. Every implementation matched only "—" and "–", so
//    "Roof repair - done right" shipped untouched. That is the same tell wearing the
//    character that is actually on a keyboard, which is why a model reaches for it most.
//
// 2. NINE OF THIRTEEN MODEL-WRITING SURFACES CLEANED NOTHING AT ALL and relied on the
//    prompt. Among them: the LANDING PAGE writer, the CLIENT REPORT writer, and the audit
//    email sent to prospects. A prompt is guidance. This suite pins the guarantee.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { humanize, humanizeDeep, NO_DASH_RULE } from "../netlify/lib/humanize.mjs";

let n = 0; const fails = [];
// 🔴 An async test used to return a promise, n++ would run, and any assertion inside was
// lost — a check that reported "passed" no matter what. Promises are collected and awaited
// before the summary.
const pending = [];
const t = (name, fn) => {
  try {
    const r = fn();
    if (r && typeof r.then === "function") {
      pending.push(r.then(() => { n++; }, (e) => { fails.push(`${name}: ${e.message}`); }));
      return;
    }
    n++;
  } catch (e) { fails.push(`${name}: ${e.message}`); }
};

// ── The character itself ───────────────────────────────────────────────────
t("a spaced hyphen is treated as a dash", () => {
  assert.equal(humanize("Roof repair - done right"), "Roof repair. Done right");
  assert.equal(humanize("We fix roofs -- fast"), "We fix roofs. Fast");
});

t("em and en dashes still go", () => {
  assert.equal(humanize("Steady leads — not luck"), "Steady leads. Not luck");
  assert.equal(humanize("Fast service – guaranteed"), "Fast service. Guaranteed");
  // The first letter of the whole string is deliberately left as written: we do not know
  // whether it starts a sentence, and force-capitalising it would break "e-commerce brands".
  assert.equal(humanize("word—word"), "word. Word");
});

t("a dash at either end is dropped, not converted", () => {
  assert.equal(humanize("Trailing dash -"), "Trailing dash");
  assert.equal(humanize("- Leading dash"), "Leading dash");
  assert.equal(humanize("— Leading long dash"), "Leading long dash");
});

// 🔴 THE HALF THAT MATTERS MORE. A blanket find-and-replace would wreck all of this, and
// the damage would be invisible until a client noticed their phone number was mangled.
t("hyphens inside words are untouchable", () => {
  // NOTE: "done-for-you", "no-obligation" and "state-of-the-art" used to be listed here as
  // must-survive. Bryson corrected that on 2026-08-20 — they are marketing hyphens, not
  // spellings — so they moved to the de-hyphenate list and are asserted below instead.
  for (const s of [
    "24-hour emergency service",
    "e-commerce brands",
    "day-to-day running",
    "Call 602-555-0199 today",
    "Conversion id AW-18269689296",
    "act_1045064901242944",
    "1080x1920 story size",
  ]) {
    assert.equal(humanize(s), s, `mangled: ${s}`);
  }
});

t("a bullet on its own line is not swallowed into prose", () => {
  const src = "Why us:\n- Fast\n- Honest\n- Straight answers";
  assert.equal(humanize(src), src,
    "using \\s instead of horizontal whitespace turns a list into a paragraph");
});

// ── The two join styles ────────────────────────────────────────────────────
t("prose joins with a comma, ad copy with a full stop", () => {
  assert.equal(humanize("We run your ads - and the pages behind them", { join: ", " }),
    "We run your ads, and the pages behind them");
  assert.equal(humanize("We run your ads - and the pages behind them"),
    "We run your ads. And the pages behind them");
});

t("no double punctuation is left behind", () => {
  assert.ok(!/\.\s*\./.test(humanize("Done. - Next thing")));
  assert.ok(!/,\s*,/.test(humanize("Done, - next thing", { join: ", " })));
});

t("non-strings pass through untouched", () => {
  assert.equal(humanize(null), null);
  assert.equal(humanize(42), 42);
  assert.equal(humanize(undefined), undefined);
});

t("humanizeDeep reaches nested strings and leaves structure alone", () => {
  const out = humanizeDeep({
    a: "Roof repair - fast", b: [{ c: "Leads — not luck" }], n: 7, ok: true,
  });
  assert.equal(out.a, "Roof repair. Fast");
  assert.equal(out.b[0].c, "Leads. Not luck");
  assert.equal(out.n, 7);
  assert.equal(out.ok, true);
});

// ── Every surface that writes copy must clean AND instruct ────────────────
// Discovered from the source, not listed by hand: a new copy-writing function added later
// is caught automatically instead of quietly shipping dashes.
const FN_DIRS = ["../netlify/functions", "../netlify/lib"];
const writers = [];
for (const dir of FN_DIRS) {
  for (const f of readdirSync(new URL(dir + "/", import.meta.url))) {
    if (!f.endsWith(".mjs") || f === "humanize.mjs") continue;
    const src = readFileSync(new URL(`${dir}/${f}`, import.meta.url), "utf8");
    if (/anthropic\.messages\.create|runTool\(/.test(src)) writers.push([f, src]);
  }
}

t("the surfaces were actually found", () => {
  assert.ok(writers.length >= 12, `only found ${writers.length} copy-writing surfaces`);
});

for (const [name, src] of writers) {
  t(`${name} cleans what the model returns`, () => {
    // 🔴 IMPORT LINES ARE STRIPPED FIRST. The first version of this matched the word
    // "humanize" anywhere in the file, so it happily matched the leftover `import` after
    // the actual CALL was deleted — a test that could not fail, guarding the thing this
    // whole suite exists for. Found by deliberately breaking generate-landing.
    const body = src.split("\n").filter((l) => !/^\s*import\s/.test(l)).join("\n");
    // `cleanResearch` is the Market Research equivalent of `cleanMeta`: it runs every
    // string the model returned through `humanize` before anything can read it.
    const cleans = /\b(humanize|humanizeDeep|stripDashes|deDash|cleanGoogle|cleanMeta|cleanCreatives|cleanResearch)\s*\(/.test(body);
    assert.ok(cleans, "model output reaches a reader without any dash cleaning");
  });
  // ── The OTHER standing wording rule, checked on the same discovered set ──────
  // Bryson: never "local businesses", he works remotely and nationally. It was already
  // pinned on Market Research by hand, which is exactly why Deal Prep kept telling its
  // model that BoldLine serves "local/service businesses" for months without anyone
  // noticing. Checking it here means EVERY copy-writing surface is covered, including
  // ones added later, rather than whichever ones somebody remembered.
  t(`${name} never calls his customers local businesses`, () => {
    // 🔴 Comments stripped first. The line that REMOVES this wording quotes it while
    // explaining why, and the naive check has matched my own comment four times now
    // (KB `repo-tests`).
    const body = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    // 🔴 A PROMPT THAT FORBIDS THE PHRASE HAS TO BE ALLOWED TO NAME IT, and the first
    // exemption here was written against one file's exact wording ("NEVER describe...").
    // It then flagged `ad-gen-shared`, which states the same rule in different words, as
    // a violation. Matching the INTENT rather than one phrasing: any sentence telling the
    // model never to do something is the rule, not a breach of it.
    const stated = body.split(/(?<=[.!])\s+/).filter((s) => !/never/i.test(s)).join(" ");
    assert.ok(!/local\s*\/?\s*(service\s+)?businesses/i.test(stated),
      "tells its model BoldLine serves local businesses; he works remotely and nationally");
  });

  t(`${name} tells the model the rule`, () => {
    // Either its own copy of the rule, or it inherits one of the shared prompt builders.
    // `mrSystem(` is the Market Research equivalent of `systemFor(`: the shared builder
    // that carries the rule into the prompt.
    const has = /NEVER use a dash|NO_DASH_RULE|systemFor\(|mrSystem\(|VOICE/.test(src);
    assert.ok(has, "relies on the code alone; a model mirrors the style of its prompt");
  });
}

// ── The rule text itself has to name the plain hyphen ─────────────────────
// The old wording said "em dash or en dash", which a model can read as permission to use
// "-" instead. That is very likely how this kept happening.
t("the shared rule names all three characters", () => {
  assert.ok(/em dash/i.test(NO_DASH_RULE));
  assert.ok(/en dash/i.test(NO_DASH_RULE));
  assert.ok(/plain hyphen/i.test(NO_DASH_RULE), "the spaced hyphen is the one that kept slipping through");
});

// 🔴 THIS ASSERTION USED TO REQUIRE THE OPPOSITE. It insisted the rule say hyphens inside a
// word are "fine and expected: done-for-you, no-obligation", which is exactly the habit
// Bryson then called out. A test can pin the wrong behaviour just as firmly as the right one.
t("the rule tells the model not to hyphenate marketing phrases", () => {
  assert.ok(/done for you/i.test(NO_DASH_RULE), "the phrase he named must appear unhyphenated");
  assert.ok(/no obligation/i.test(NO_DASH_RULE));
  assert.ok(!/done-for-you/i.test(NO_DASH_RULE), "the rule still shows the hyphenated form as acceptable");
  assert.ok(/e-commerce/i.test(NO_DASH_RULE), "without a keep-list the model strips real spellings too");
});

// ── Marketing compounds lose the hyphen; real spellings keep it ──────────
t("phrases nobody hyphenates out loud are de-hyphenated", () => {
  assert.equal(humanize("Done-for-you ad management"), "Done for you ad management");
  assert.equal(humanize("A fast, no-obligation quote"), "A fast, no obligation quote");
  assert.equal(humanize("Same-day roof repair"), "Same day roof repair");
  assert.equal(humanize("Family-owned since 1998"), "Family owned since 1998");
  assert.equal(humanize("Risk-free trial"), "Risk free trial");
});

t("capitalisation is preserved when the hyphen goes", () => {
  assert.equal(humanize("Done-For-You Ads"), "Done For You Ads");
  assert.equal(humanize("DONE-FOR-YOU ADS"), "DONE FOR YOU ADS");
});

// 🔴 The list is explicit for a reason. A rule like "de-hyphenate adjective compounds"
// would wreck every one of these, and they are simply how the words are spelled.
t("real hyphenated spellings are never touched", () => {
  for (const s of [
    "e-commerce brands", "t-shirt printing", "self-employed clients", "follow-up call",
    "24-hour service", "part-time staff", "long-term contract", "built-in tracking",
    "one-off project", "x-ray clinic",
  ]) {
    assert.equal(humanize(s), s, `de-hyphenated a real spelling: ${s}`);
  }
});

t("the longest compound wins, so a nested one is not half-matched", () => {
  assert.equal(humanize("Tried-and-tested process"), "Tried and tested process");
});

// The OS carries its own copy of the list and must agree.
t("the OS de-hyphenates the same phrases", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const i = src.indexOf("const MARKETING_COMPOUNDS =");
  const j = src.indexOf("\n  .trim();", i) + "\n  .trim();".length;
  assert.ok(i > 0 && j > i, "the OS copy of the compound list is missing");
  const { humanizeAdCopy } = new Function(src.slice(i, j) + "\nreturn { humanizeAdCopy };")();
  assert.equal(humanizeAdCopy("Done-for-you ad management"), "Done for you ad management");
  assert.equal(humanizeAdCopy("no-obligation quote"), "no obligation quote");
  assert.equal(humanizeAdCopy("e-commerce brands"), "e-commerce brands");
  assert.equal(humanizeAdCopy("24-hour service"), "24-hour service");
});

// ── Our own hardcoded copy must obey the rule too ───────────────────────
// The runtime cleaner never sees a string that is baked into a template.
t("no hardcoded marketing hyphen survives in client-facing copy", () => {
  const files = [
    "../index.html", "../netlify/functions/portal.mjs",
    "../marketing-site/index.html", "../marketing-site/get-started/index.html",
  ];
  const offenders = [];
  for (const f of files) {
    let src; try { src = readFileSync(new URL(f, import.meta.url), "utf8"); } catch { continue; }
    for (const line of src.split("\n")) {
      // Skip the lists and the rule text, which necessarily contain the hyphenated forms.
      if (/MARKETING_COMPOUNDS|COMPOUND_RE|NEVER use a dash|^\s*\/\//.test(line)) continue;
      const m = line.match(/\b(done-for-you|no-obligation|same-day|family-owned|risk-free|hassle-free)\b/i);
      if (m) offenders.push(`${f}: ${m[0]}`);
    }
  }
  assert.equal(offenders.length, 0, `hardcoded marketing hyphen: ${offenders.join("; ")}`);
});

// ── 🔴 THE OUTREACH DRAFTS, WHICH GO STRAIGHT TO A PROSPECT ─────────────
//
// Bryson, 2026-09-04, asking a plain question about the Book a Call button: *"which email
// does it send from"*. Reading the code to answer it turned up an em dash in the email
// SUBJECT LINE and another in the text message, in BOTH copies of the card, four places in
// total, none of which any check had ever looked at.
//
// 🔴 THIS IS THE MOST DIRECT CLIENT-FACING COPY IN THE WHOLE OS AND IT LOOKED INTERNAL.
// Everything else the dash rule guards is obviously outward: the portal, the site, the ad
// copy, the client emails. These two strings sit inside a React component in the OS's own
// dashboard, so they read as app code, and they are the exact words a prospect gets in
// their inbox and on their phone. Where a string LIVES says nothing about who READS it.
t("🔴 the Book a Call email and text drafts carry no dash", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const offenders = [];
  // The drafts and the subject line, wherever they appear. Both cards are checked because
  // the house Leads tab and the global Leads screen hold separate copies of the same code.
  const spots = [
    [/const emailDraft = \([^)]*\) => \{[\s\S]{0,900}?\};/g, "the email draft"],
    [/const smsDraft = \([^)]*\) => `[^`]*`;/g, "the text draft"],
    [/subject=\$\{encodeURIComponent\("[^"]*"\)\}/g, "the email subject"],
  ];
  let found = 0;
  for (const [re, label] of spots) {
    const hits = src.match(re) || [];
    found += hits.length;
    for (const h of hits) {
      if (/[—–]/.test(h)) offenders.push(`${label}: ${h.slice(0, 90)}`);
      if (/ - /.test(h)) offenders.push(`${label} (spaced hyphen): ${h.slice(0, 90)}`);
    }
  }
  // 🔴 If the patterns stop matching, this passes while checking nothing. There are two of
  // each, one per card, so anything under six means the check has gone blind.
  assert.ok(found >= 6, `only ${found} outreach strings found, so this check is not reading them`);
  assert.equal(offenders.length, 0, `a dash in what a prospect actually receives: ${offenders.join("; ")}`);
});

// ── 🔴 THE CLIENT PORTAL, RENDERED AND READ ─────────────────────────────
//
// The check above catches hyphenated marketing compounds. It never looked for the
// character Bryson actually named. So the portal, the one page a client reads end to end,
// shipped with a dozen em dashes in its own sentences: "ask for changes — nothing goes
// live without your OK", "you pay Google directly — we never hold or touch it". Found
// 2026-08-27 by rendering the page and reading it, which is the only way to check
// generated text (KB `repo-tests`).
//
// Rendered, not grepped: the copy is assembled from template literals across hundreds of
// lines, and half of these were `&mdash;` entities that a source grep for "—" misses.
t("no dash connects a sentence in the client portal", async () => {
  const { _internal } = await import("../netlify/functions/portal.mjs");
  const cl = {
    name: "Stencil & Thread", contactName: "Sebastian", packageId: "g-launch",
    adBudget: "$500/mo", portalToken: "t", billingPerLead: 50, leadsLog: [], commLog: [],
  };
  const pkg = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" };
  // Every entry state a client can arrive in, so a banner cannot smuggle one back.
  const offenders = [];
  for (const notice of [undefined, "card", "success", "cancel"]) {
    const html = _internal.makePortalHTML(cl, pkg, notice);
    // The signed agreement is a legal document with its own conventions, and it is
    // rendered from the contract module rather than written as portal copy.
    const body = html.slice(0, html.indexOf("bl-contract-frame") + 1 || html.length);
    const text = body
      .replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ")
      // 🔴 DECODE THE ENTITIES FIRST. Half the portal's dashes are written as `&mdash;`,
      // which a scan for the character misses entirely — the same blind spot that let a
      // dozen of them ship. Decoding is what makes this check see what a reader sees.
      .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
      .replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013")
      .replace(/\s+/g, " ");
    for (const m of text.matchAll(/[^.!?]{0,45}[—–][^.!?]{0,45}/g)) {
      const s = m[0].trim();
      // 🔴 THE PACKAGE-NAME EXEMPTION IS GONE, because the name is. "Full System — Growth"
      // was the last em dash a client could actually read, carved out here as "a product
      // name, not copy". It is now "Full System: Growth" everywhere, matching what the
      // marketing site already said, so the carve-out would only hide a future one.
      // The stage ring still prints a dash when there is no stage yet: a placeholder in a
      // graphic, not a sentence.
      if (/Campaign Progress [—–]/.test(s)) continue;
      offenders.push(s);
    }
  }
  assert.equal(offenders.length, 0,
    `the portal reads as AI-written here:\n        ${[...new Set(offenders)].join("\n        ")}`);
});

// The portal exists twice. The copy in the OS's Live Client View must say the same words,
// or Bryson signs off on a preview that is not what the client gets.
t("no old dash-joined sentence survives in either copy of the portal", () => {
  // The portal exists twice (netlify/functions/portal.mjs and makePortalHTML in
  // index.html). They word a few things differently, so this checks by ABSENCE rather
  // than pinning exact phrases: none of the sentences that used to be joined by a dash
  // may come back, in either file.
  const OLD = [
    "ask for changes &mdash;", "ask for changes —",
    "directly &mdash; we never", "directly — we never",
    "directly &mdash; we only", "directly — we only",
    "agreement &mdash; available", "agreement — available",
    "Tell us &mdash; we", "Tell us — we",
    "Your Package &mdash; ", "Your Package — ",
    "3&ndash;5 strong", "3–5 strong", "2&ndash;3 of your", "2–3 of your",
    "video &mdash; even phone", "video — even phone",
    "You qualify &mdash;", "You qualify —",
  ];
  const offenders = [];
  for (const f of ["../netlify/functions/portal.mjs", "../index.html"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const o of OLD) if (src.includes(o)) offenders.push(`${f}: ${o}`);
  }
  assert.equal(offenders.length, 0, `old dashed copy is back: ${offenders.join("; ")}`);
});

// ── 🔴 THE MARKETING SITE, READ THE WAY A VISITOR READS IT ───────────────
//
// The portal check above was written 2026-08-27 after a dozen dashes shipped in the one
// page a client reads end to end. The marketing site is the page a STRANGER reads end to
// end, and it had fifty of them, including in the hero paragraph and on every price card.
// KB `dedash-ai-voice` claimed the site had already been done. It had not, which is the
// whole argument for a check over a memory.
//
// Read the way a visitor reads it, which is the same discipline as the portal check.
// Each strip below was verified by removing it and watching this check fail:
//   · <style> and <script> come out, and they are the big ones. Two thirds of the dashes in
//     this file sit in CSS and JS comments that no reader ever sees. Leaving them in floods
//     the result with noise, which is exactly why a naive grep gets ignored and fifty real
//     ones survived in the copy.
//   · HTML comments come out too. A single-line one is already eaten by the tag stripper,
//     but a comment spanning lines with a `>` inside it is not, and the sentinel blocks in
//     this file are precisely that shape.
//   · Entities are decoded. Most of the site's dashes were written `&mdash;`, so a scan for
//     the character alone sees none of them.
const visibleText = (html) => html
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&rsquo;/g, "'")
  .replace(/\s+/g, " ");

// 🔴 Proven against the real thing before it was trusted: run on the file as it stood
// before this cleanup it reported 35 offenders, and every one was visible on screen.
// 🔴 EVERY LIFECYCLE EMAIL A CLIENT RECEIVES, WHICH THIS SUITE DID NOT SCAN AT ALL.
// Bryson's rule names emails explicitly, and there were 41 dashes in them: the welcome, the
// ad-account request, the invoice, the receipt, the past-due notice, the renewal, the
// approval request and the thank-you. Every one hand written by us, every one shipped, and
// the suite that exists to stop exactly this was only looking at the portal and the site.
// 🔴 The entity form counts too: the footer read "BoldLine Media &mdash; Google &amp; Meta",
// which renders as a dash and would have survived a search for the character.
t("no dash connects a sentence in any client lifecycle email", () => {
  const src = readFileSync(new URL("../netlify/lib/client-emails-shared.mjs", import.meta.url), "utf8");
  const offenders = [];
  for (const line of src.split("\n")) {
    // Code comments are ours to write however we like; only the copy is client facing.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
    const text = line.replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013");
    for (const m of text.matchAll(/[^.!?]{0,45}[\u2014\u2013][^.!?]{0,45}/g)) offenders.push(m[0].trim());
  }
  assert.equal(offenders.length, 0,
    `client emails read as AI-written here:\n        ${[...new Set(offenders)].join("\n        ")}`);
});

t("no dash connects a sentence anywhere on the marketing site", () => {
  const offenders = [];
  for (const f of ["../marketing-site/index.html", "../marketing-site/get-started/index.html"]) {
    const text = visibleText(readFileSync(new URL(f, import.meta.url), "utf8"));
    for (const m of text.matchAll(/[^.!?]{0,45}[—–][^.!?]{0,45}/g)) {
      const s = m[0].trim();
      offenders.push(`${f.split("/").slice(-2).join("/")}: ${s}`);
    }
  }
  assert.equal(offenders.length, 0,
    `the site reads as AI-written here:\n        ${[...new Set(offenders)].join("\n        ")}`);
});

// The stripper itself has to be honest. If `visibleText` ever over-stripped (say a bad
// regex ate the body), the check above would pass on an empty string forever — a test that
// cannot fail, which this project has shipped twice already (KB `repo-tests`).
t("the visible-text reader really does see the page copy", () => {
  const text = visibleText(readFileSync(new URL("../marketing-site/index.html", import.meta.url), "utf8"));
  assert.ok(text.length > 8000, `only extracted ${text.length} characters of page copy`);
  assert.ok(/Book a Call/i.test(text), "the main call to action is missing from the extracted text");
  assert.ok(/qualified lead/i.test(text), "the pricing copy is missing from the extracted text");
  // And it must NOT see the things a reader cannot see, or the check drowns in CSS notes.
  assert.ok(!/compositor-only cascade/.test(text), "CSS comments leaked into the visible text");
  assert.ok(!/IntersectionObserver/.test(text), "script bodies leaked into the visible text");
});

// ── The OS carries its own copy, and it must behave identically ──────────
t("the browser-side humanizer matches the server", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  // Slice from the compound list, not from humanizeAdCopy: it now calls deCompound, which
  // is declared above it, so a narrower slice throws "deCompound is not defined".
  const i = src.indexOf("const MARKETING_COMPOUNDS =");
  const j = src.indexOf("\n  .trim();", i) + "\n  .trim();".length;
  assert.ok(i > 0 && j > i, "the OS humanizer block was not found in index.html");
  const { humanizeAdCopy } = new Function(src.slice(i, j) + "\nreturn { humanizeAdCopy };")();

  assert.equal(humanizeAdCopy("Roof repair - done right"), "Roof repair. Done right");
  assert.equal(humanizeAdCopy("Steady leads — not luck"), "Steady leads. Not luck");
  assert.equal(humanizeAdCopy("We fix roofs -- fast"), "We fix roofs. Fast");
  // and the same things must survive
  // Real spellings only: the marketing compounds are asserted de-hyphenated further down.
  for (const s of ["24-hour service", "Call 602-555-0199", "e-commerce brands", "follow-up call"]) {
    assert.equal(humanizeAdCopy(s), s, `OS side mangled: ${s}`);
  }
});

// ── No hardcoded dash may sit in client-facing copy ──────────────────────
// One was found in the prospect audit email's footer: "BoldLine Media &mdash; ...".
t("no client-facing template hardcodes an em dash", () => {
  const offenders = [];
  for (const [name, src] of writers) {
    for (const m of src.matchAll(/^(?!\s*\/\/).*&mdash;|&ndash;/gm)) {
      offenders.push(`${name}: ${String(m[0]).trim().slice(0, 60)}`);
    }
  }
  assert.equal(offenders.length, 0, `hardcoded dash entity in copy: ${offenders.join("; ")}`);
});

await Promise.all(pending);
console.log(fails.length ? `✕ ${fails.length} failed, ${n} passed\n  ` + fails.join("\n  ")
  : `✓ verify-no-dashes: ${n} checks passed`);
process.exit(fails.length ? 1 : 0);
