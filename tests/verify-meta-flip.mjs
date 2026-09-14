// Keeps the Meta flip checklist honest. Run: node tests/verify-meta-flip.mjs
//
// Bryson, 2026-08-17: "make sure from now on any updates we do to the website are saved
// for when we flip the website back to normal".
//
// The risk this removes: the site's coming-soon state was originally meant to be undone
// with `git revert a4b83f0`. Anything added to the site AFTER that commit is invisible to
// that revert — the Full System: Acquisition card already proved it — so the flip would
// leave a stray "Join the waitlist" button behind and nobody would notice until a
// prospect hit it.
//
// So the SITE is the source of truth, and this test forces docs/META-FLIP-CHECKLIST.md to
// match it. Add a gated change without recording it and this fails by name.
//
// It also flips its own expectations after the flip: once no sentinels remain, it stops
// checking the checklist and starts asserting that every package books a call.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const SITE = "marketing-site/index.html";
const GETSTARTED = "marketing-site/get-started/index.html";
const CHECKLIST = "docs/META-FLIP-CHECKLIST.md";

const site = readFileSync(SITE, "utf8");
const getStarted = readFileSync(GETSTARTED, "utf8");
const checklist = readFileSync(CHECKLIST, "utf8");
const bothFiles = [[SITE, site], [GETSTARTED, getStarted]];

const GATED_PANELS = ["meta", "combined", "ecom"];
const panelOf = (name) => {
  const i = site.indexOf(`data-panel="${name}"`);
  if (i < 0) return "";
  const j = site.indexOf('data-panel="', i + 10);
  return site.slice(i, j > 0 ? j : site.length);
};
const ctasIn = (block) =>
  [...block.matchAll(/<a class="pkg-cta"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map((m) => ({ href: m[1], text: m[2].trim() }));

// ── Count what is actually gated on the site ────────────────────────────────
const ctaMarks = bothFiles.reduce((n, [, src]) => n + (src.match(/CS:META-SOON cta/g) || []).length, 0);
const blockIds = bothFiles.flatMap(([, src]) =>
  [...src.matchAll(/CS:META-SOON:START ([a-z-]+)/g)].map((m) => m[1]));
const endIds = bothFiles.flatMap(([, src]) =>
  [...src.matchAll(/CS:META-SOON:END ([a-z-]+)/g)].map((m) => m[1]));
const inlineMarks = bothFiles.reduce((n, [, src]) =>
  n + (src.match(/<!-- CS:META-SOON -->/g) || []).length, 0);

const stillGated = ctaMarks + blockIds.length + inlineMarks > 0;

// ── Structural rules that hold in BOTH states ───────────────────────────────
for (const id of blockIds) ok(`block "${id}" is closed`, endIds.includes(id), "START with no END");
for (const id of endIds) ok(`block "${id}" was opened`, blockIds.includes(id), "END with no START");
eq("no duplicate block ids", new Set(blockIds).size, blockIds.length);

// Google is never gated. If this ever fails, the sellable half of the business went dark.
{
  const g = ctasIn(panelOf("google"));
  eq("Google still has 3 cards", g.length, 3);
  // The one-time hand-off is sold on calls, never advertised (Bryson, 2026-08-19), so it
  // must not appear here — and if it ever does, that is a leak, not a gating question.
  ok("the un-advertised hand-off is not on the site", !/Hand Off/.test(site));
  ok("every Google card books a call", g.every((c) => /calendly/.test(c.href)),
    g.map((c) => c.text).join(" | "));
  eq("no Google CTA is gated", (panelOf("google").match(/CS:META-SOON/g) || []).length, 0);
}

if (stillGated) {
  // ── STATE: coming soon. The checklist must account for everything. ────────
  console.log("state: coming soon (Meta not yet approved)");

  // Every waitlist button must carry a marker. This is the assertion that catches a new
  // card being added without being recorded — exactly the Full System: Acquisition case.
  for (const name of GATED_PANELS) {
    const block = panelOf(name);
    const ctas = ctasIn(block);
    const marks = (block.match(/CS:META-SOON cta/g) || []).length;
    ok(`${name}: every card is on the waitlist`, ctas.every((c) => !/calendly/.test(c.href)),
      ctas.filter((c) => /calendly/.test(c.href)).map((c) => c.text).join(" | "));
    eq(`${name}: every waitlist button carries a marker`, marks, ctas.length);
  }

  // The checklist has to describe the same site this test just read.
  const rowCount = (checklist.match(/^\| \d+ \| /gm) || []).length;
  eq("checklist lists every gated button", rowCount, ctaMarks);
  for (const id of new Set(blockIds)) {
    ok(`checklist covers block "${id}"`, new RegExp(`\`${id}\``).test(checklist),
      "add a row for it, or the flip will miss it");
  }
  // And must not list blocks that no longer exist, or the flip chases ghosts.
  const listedIds = [...checklist.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
  for (const id of listedIds) {
    ok(`checklist entry "${id}" still exists on the site`, blockIds.includes(id), "stale row");
  }
  ok("checklist records the inline markers", new RegExp(`Inline — ${inlineMarks} total`).test(checklist),
    `site has ${inlineMarks}`);

  // The trap that started all this must stay written down.
  ok("checklist warns the old revert is not sufficient", /no longer sufficient/i.test(checklist));
  ok("checklist names the card the revert would miss", /Full System: Acquisition/.test(checklist));
  ok("checklist says to flip by sentinels", /SENTINELS, not by reverting/i.test(checklist));
  ok("checklist tells you how to add a new gated change", /Adding a NEW gated thing/.test(checklist));
} else {
  // ── STATE: flipped. Nothing may be left behind. ───────────────────────────
  console.log("state: FLIPPED (Meta approved)");
  // 🔴 ELEVEN, NOT TWELVE, AND THIS ASSERTION HAD NEVER ONCE RUN UNTIL TODAY.
  // It said 12 because that was true when it was written. **Full System: Launch** was deleted
  // on 2026-08-18 when pricing moved to the greater-of model (running both platforms starts at
  // $5,000/mo of ad budget, so a combined Launch tier could only be sold to someone it hurts),
  // and the checklist has said so ever since. But this whole branch only executes once the
  // sentinels are gone, so the stale number sat here for a month and failed on the one morning
  // it mattered. Same shape as the scheduled jobs that had never run (KB `scheduled-job-wiring`).
  //
  // Counted PER PANEL rather than as a total, so a card vanishing from one panel and appearing
  // in another cannot cancel out.
  const perPanel = { google: 3, meta: 3, combined: 2, ecom: 3 };
  for (const [name, n] of Object.entries(perPanel)) {
    eq(`${name} panel has ${n} packages`, ctasIn(panelOf(name)).length, n);
  }
  const all = GATED_PANELS.concat("google").flatMap((n) => ctasIn(panelOf(n)));
  eq("all 11 packages are present", all.length,
    Object.values(perPanel).reduce((a, b) => a + b, 0));
  ok("every package books a call", all.every((c) => /calendly/.test(c.href)),
    all.filter((c) => !/calendly/.test(c.href)).map((c) => c.text).join(" | "));
  ok("no waitlist copy survives anywhere", !/Join the waitlist/i.test(site));
  ok("no coming-soon pill survives", !/class="soon"/.test(site));
  for (const [f, src] of bothFiles) ok(`${f} has no sentinels left`, !/CS:META-SOON/.test(src));

  // ── Meta has to be OFFERED, not merely un-gated ──────────────────────────
  // The flip removed the sentinels, but two places choose platforms for the
  // visitor and neither carried one. The contact wizard's first question still
  // read "Google Ads / Not sure yet" for a day after Meta went live.
  const wizOpts = (site.match(/<div class="opts" data-key="platform">([\s\S]*?)<\/div>/) || [, ""])[1];
  const wizVals = [...wizOpts.matchAll(/data-val="([^"]+)"/g)].map((m) => m[1]);
  ok("the contact wizard offers Meta", wizVals.some((v) => /meta/i.test(v)), wizVals.join(" | "));
  ok("the contact wizard offers both platforms together",
    wizVals.some((v) => /google/i.test(v) && /meta/i.test(v)), wizVals.join(" | "));

  // 🔴 EXECUTED, NOT GREPPED. FAMILIES.meta existing proves nothing about whether
  // any answer combination can REACH it — the gated build had the map intact and
  // the routing disabled. So run the shipped pickFamily over every combination
  // the modal can actually produce and assert each family comes out at least once.
  const recSrc = (site.match(/var FAMILIES = \{[\s\S]*?\n  \}\n/) || [])[0];
  ok("the recommender's family map and routing are still in the page", !!recSrc);
  if (recSrc) {
    const budgets = optVals("budget"), types = optVals("type"), channels = optVals("channel");
    eq("the modal still asks all three questions",
      [budgets.length, types.length, channels.length].every((n) => n > 0), true);
    const run = new Function("answers", recSrc + "\nreturn pickFamily();");
    const seen = new Set();
    for (const budget of budgets) for (const type of types) for (const channel of channels) {
      seen.add(run({ budget, type, channel }));
    }
    for (const fam of ["google", "meta", "combined", "ecom"]) {
      ok(`a real answer set reaches the ${fam} packages`, seen.has(fam), [...seen].join(", "));
    }
  }
}

// Pulls the buttons a recommender question actually offers, so the routing above is
// exercised with the real inputs rather than values invented by the test.
function optVals(q) {
  const block = (site.match(new RegExp(`<div class="q" data-q="${q}">([\\s\\S]*?)</div>\\s*</div>`)) || [, ""])[1];
  return [...block.matchAll(/data-val="([^"]+)"/g)].map((m) => m[1]);
}

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-meta-flip: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
