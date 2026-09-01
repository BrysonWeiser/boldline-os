// Several landing pages to choose from, mix and rewrite.
//
// Bryson, 2026-09-01: *"giving me multiple landing page options that i can either choose to
// use combine certain ideas or just straight up regenerate individual ones or all of them."*
//
// 🔴 WHAT THIS SUITE IS REALLY FOR. Every operation here sits next to `client.landingPage`,
// which is the page a client's ads point at and real visitors load. The interesting failures
// are not "the wrong headline appeared", they are:
//
//   - a candidate quietly becoming the live page without anyone choosing it,
//   - choosing one taking a LIVE page offline, or publishing a page nobody approved,
//   - a failed rewrite blanking the option he was about to pick,
//   - taking one headline dragging another page's colours and layout along with it.
//
// So the tests are about what must NOT move, which is the half that is easy to get wrong and
// impossible to notice until a client's ads are pointing at the result.

import {
  MAX_VARIANTS, DEFAULT_COUNT, MIXABLE, ANGLES, angleFor,
  newVariant, addVariants, replaceVariant, removeVariant, applyVariant, pickField, blendPrompt,
} from "../netlify/lib/landing-variants.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, got === want, `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const COPY = {
  headline: "Custom shirts, printed fast", subheadline: "25 pieces or more", bullets: ["a", "b"],
  ctaText: "Get a quote", design: { layout: "split" }, brandColor: "#123456", theme: "dark",
  steps: ["one", "two", "three"], faqs: [{ q: "Q", a: "A" }], heroPath: "p/1.jpg",
};

// ── 1. A candidate is a candidate, not a page ────────────────────────────────
{
  const v = newVariant(COPY, { label: "The result", angle: "outcome" });
  ok("it carries the copy", v.headline === COPY.headline && v.ctaText === "Get a quote");
  ok("and an id and a timestamp", !!v.id && !!v.generatedAt);
  ok("ids are unique", newVariant(COPY).id !== newVariant(COPY).id);

  // 🔴 The flag that separates a draft from a live page has no business on a candidate.
  const sneaky = newVariant({ ...COPY, published: true, publishedAt: "2026-01-01" });
  ok("🔴 a variant can never carry a published flag", !("published" in sneaky) && !("publishedAt" in sneaky),
    "a candidate carrying published:true could publish a page nobody approved");

  // Bookkeeping from a previous variant must not survive into a new one.
  const recycled = newVariant({ ...COPY, id: "OLD", generatedAt: "1999", source: "x" }, { source: "blended" });
  ok("bookkeeping is regenerated, never inherited",
    recycled.id !== "OLD" && recycled.generatedAt !== "1999" && recycled.source === "blended");
}

// ── 2. Keeping the list sane ─────────────────────────────────────────────────
{
  const many = Array.from({ length: 10 }, (_, i) => newVariant({ ...COPY, headline: `h${i}` }));
  const list = addVariants([], many);
  eq("the list is capped", list.length, MAX_VARIANTS);
  eq("newest first", list[0].headline, "h0");
  ok("a fresh set does not mutate what it was given", (() => {
    const before = [newVariant(COPY)];
    const snapshot = before.slice();
    addVariants(before, [newVariant(COPY)]);
    return before.length === snapshot.length;
  })(), "an in-place push makes 'did anything change' impossible to answer, so the caller saves every render");

  const three = addVariants([], [newVariant(COPY), newVariant(COPY), newVariant(COPY)]);
  eq("removing one leaves the rest", removeVariant(three, three[1].id).length, 2);
  ok("removing an unknown id changes nothing", removeVariant(three, "nope").length === 3);
}

// ── 3. 🔴 REGENERATING ONE. The failure that eats his work ───────────────────
{
  const list = addVariants([], [newVariant({ ...COPY, headline: "first" }), newVariant({ ...COPY, headline: "second" })]);
  const target = list[1].id;

  const rewritten = replaceVariant(list, target, { ...COPY, headline: "rewritten" });
  eq("the rewrite lands", rewritten[1].headline, "rewritten");
  eq("🔴 in the SAME position", rewritten[0].headline, "first");
  eq("keeping its id, so the row he is looking at stays the same row", rewritten[1].id, target);
  eq("and the other option is untouched", rewritten[0].headline, list[0].headline);

  // 🔴 The one that matters. A model call that fails returns nothing.
  for (const [what, bad] of [["undefined", undefined], ["null", null], ["a non-object", "oops"], ["an empty object", {}], ["copy with no headline", { subheadline: "x" }]]) {
    const after = replaceVariant(list, target, bad);
    eq(`🔴 a rewrite returning ${what} leaves the option alone`, after[1].headline, "second");
  }
  ok("an unknown id is a no-op", replaceVariant(list, "nope", COPY)[1].headline === "second");
}

// ── 4. 🔴 CHOOSING ONE. The only path to the live page ───────────────────────
{
  const v = newVariant({ ...COPY, headline: "chosen" });
  const base = { landingVariants: [v] };

  // A page that is NOT live stays not live.
  const draft = applyVariant({ ...base, landingPage: { headline: "old", published: false } }, v.id);
  eq("the copy is swapped in", draft.landingPage.headline, "chosen");
  eq("🔴 an unpublished page stays unpublished", draft.landingPage.published, false);

  // 🔴 A page that IS live stays live. Forcing it false would take a client's page offline
  // while their ads keep pointing at it, which is worse than the thing it would prevent.
  const live = applyVariant({ ...base, landingPage: { headline: "old", published: true, publishedAt: "2026-08-01" } }, v.id);
  eq("🔴 a live page stays live when he swaps the copy", live.landingPage.published, true);
  eq("and keeps when it went live", live.landingPage.publishedAt, "2026-08-01");

  // 🔴 And the other direction: a variant may never turn publishing ON by itself.
  const forged = { ...newVariant(COPY), published: true, publishedAt: "1999" };
  const attack = applyVariant({ landingVariants: [forged], landingPage: { published: false } }, forged.id);
  eq("🔴 a variant claiming to be published cannot publish the page", attack.landingPage.published, false,
    "published is read from the live page, never from the candidate");
  ok("nor backdate it", !attack.landingPage.publishedAt);

  // Bookkeeping must not leak onto the live page.
  for (const k of ["id", "label", "generatedAt", "source", "angle"]) {
    ok(`the live page does not inherit the variant's ${k}`, !(k in draft.landingPage));
  }
  ok("but it records WHICH option was chosen", draft.landingPage.chosenVariantId === v.id && !!draft.landingPage.chosenAt,
    "so a page can be traced back to the option it came from");

  // Fields the live page has and the variant does not are kept, not wiped.
  const withExtra = applyVariant({ ...base, landingPage: { published: false, heroUrl: "https://x/y.png", logo: "https://x/l.png" } }, v.id);
  ok("fields the option says nothing about are preserved",
    withExtra.landingPage.heroUrl === "https://x/y.png" && withExtra.landingPage.logo === "https://x/l.png",
    "the scraped logo and hero are not part of a copy variant and must survive a swap");

  eq("choosing something that does not exist does nothing", applyVariant(base, "nope"), null);
}

// ── 5. 🔴 TAKING ONE PIECE, and only that piece ──────────────────────────────
{
  const a = newVariant({ headline: "A headline", subheadline: "A sub", bullets: ["a1"], ctaText: "A cta", design: { layout: "overlay" }, brandColor: "#aaaaaa", theme: "dark" });
  const client = {
    landingVariants: [a],
    landingPage: { headline: "LIVE headline", subheadline: "LIVE sub", bullets: ["live"], ctaText: "LIVE cta", design: { layout: "split" }, brandColor: "#111111", theme: "light", published: true },
  };

  const took = pickField(client, a.id, "headline");
  eq("the chosen field comes across", took.landingPage.headline, "A headline");
  // 🔴 THE WHOLE POINT. Taking a headline must not repaint the page.
  eq("🔴 the subheadline is untouched", took.landingPage.subheadline, "LIVE sub");
  eq("🔴 so is the colour", took.landingPage.brandColor, "#111111");
  eq("🔴 and the layout", took.landingPage.design.layout, "split");
  eq("🔴 and the theme", took.landingPage.theme, "light");
  eq("and the page stays as live as it was", took.landingPage.published, true);

  ok("every mixable field can actually be taken",
    MIXABLE.filter((f) => f in a).every((f) => pickField(client, a.id, f) !== null));
  // 🔴 An allow list, not "any key". Bookkeeping is not a design choice.
  for (const f of ["id", "label", "generatedAt", "published", "chosenVariantId", "__proto__"]) {
    eq(`🔴 ${f} is not a takeable field`, pickField(client, a.id, f), null);
  }
  eq("a field the option does not have is refused", pickField(client, a.id, "faqs"), null);
}

// ── 6. Three options means three arguments, not three rewordings ─────────────
{
  ok("there are several angles to draw from", ANGLES.length >= 3);
  ok("each has a nudge the model can act on", ANGLES.every((a) => a.key && a.label && a.nudge.length > 20));
  ok("angles are distinct", new Set(ANGLES.map((a) => a.key)).size === ANGLES.length);
  eq("they cycle", angleFor(0).key, angleFor(ANGLES.length).key);
  ok("and never fall off either end", !!angleFor(-1) && !!angleFor(999));
  ok("a default set is more than one and fits the cap", DEFAULT_COUNT > 1 && DEFAULT_COUNT <= MAX_VARIANTS);
  // 🔴 No invented proof, in the angle that most invites it.
  ok("🔴 the 'why them' angle forbids inventing proof",
    /no invented statistics, awards or testimonials/i.test(ANGLES.find((a) => a.key === "proof").nudge),
    "asking a model why this business is the safe choice is the prompt most likely to produce "
    + "a fabricated award on a real client's page");
}

// ── 7. The plain-English blend ───────────────────────────────────────────────
{
  const a = newVariant({ headline: "Fast turnaround", subheadline: "s1", bullets: ["b1", "b2"], ctaText: "c1" }, { label: "Speed" });
  const b = newVariant({ headline: "Nobody beats our guarantee", subheadline: "s2", bullets: ["b3"], ctaText: "c2" }, { label: "The worry" });
  const list = [a, b];

  const p = blendPrompt(list, [a.id, b.id], "Use option two but with the speed headline from option one.");
  ok("the instruction is passed through verbatim", p.includes("Use option two but with the speed headline from option one."));
  ok("both options are described to the model", p.includes("Fast turnaround") && p.includes("Nobody beats our guarantee"));
  ok("their labels come along", p.includes("Speed") && p.includes("The worry"));
  ok("bullets are included, since he may be blending those", p.includes("b1") && p.includes("b3"));
  ok("🔴 and it is told not to invent proof", /Do not invent prices, statistics, awards or reviews/.test(p));

  // 🔴 Nothing to work from must not fire a model call.
  eq("no instruction, no call", blendPrompt(list, [a.id], "   "), null);
  eq("no options selected, no call", blendPrompt(list, [], "do a thing"), null);
  eq("unknown ids select nothing, so no call", blendPrompt(list, ["nope"], "do a thing"), null);
  eq("no variants at all, no call", blendPrompt([], [a.id], "do a thing"), null);

  ok("one option is enough to blend from", !!blendPrompt(list, [a.id], "make it shorter"),
    "rewriting a single option with an instruction is a legitimate use, not a degenerate one");
}

// ── 8. The endpoint actually uses all of this ───────────────────────────────
// The logic above is only worth anything if the generator calls it. These read the shipping
// source, because the alternative is a live model call per option.
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../netlify/functions/generate-landing.mjs", import.meta.url), "utf8");

  ok("asking for several fans out into several calls", /if \(count > 1\)/.test(src) && /Promise\.all\(/.test(src));
  ok("🔴 and each one gets a different angle", /angleFor\(i\)/.test(src) && /THIS VERSION'S ANGLE/.test(src),
    "one model asked for three versions returns one idea worded three ways");
  ok("🔴 one option failing does not lose the others", /results\.filter\(Boolean\)/.test(src),
    "handing back nothing because the third timed out is the worst reading of 'give me options'");
  ok("but every option failing is still reported as a failure",
    /if \(!options\.length\) return json\(\{ ok: false/.test(src));
  ok("a blend passes the instruction through as an instruction",
    /REWRITE INSTRUCTION FROM THE ACCOUNT MANAGER/.test(src));

  // 🔴 The autobuild bot and the existing Generate button both call this with no count. Their
  // response shape must not change, or a working feature breaks to add a new one.
  ok("🔴 single-page callers get exactly the shape they always got",
    /return json\(\{ ok: true, landingPage: single, options: \[single\] \}/.test(src),
    "client-autobuild reads d.landingPage and would silently stop building pages");
  ok("the count is clamped to the cap", /Math\.min\(MAX_VARIANTS, Math\.max\(1, Number\(body\.count\) \|\| 1\)\)/.test(src));

  // 🔴 One shaping function, not one per path. Two copies is how an option ends up with an
  // unvalidated layout token or a colour that is not a colour.
  ok("🔴 validation is shared by every path", (src.match(/function shape\(/g) || []).length === 1);
  ok("and a result with no headline is refused there",
    /if \(!String\(headline \|\| ""\)\.trim\(\)\) return null;/.test(src));
  ok("the expensive website scrape happens once, above the fan-out",
    src.indexOf("await scrapeBrand(") < src.indexOf("if (count > 1)"),
    "scraping per option would triple the cost and the wait for an identical result");
}

// ── 9. 🔴 THE TWO COPIES MUST AGREE ─────────────────────────────────────────
// index.html cannot import a Node module, so this logic exists twice. That is the recurring
// hazard in this repo: the portal and the contract both drifted this way. So the browser copy
// is EXTRACTED FROM THE SHIPPING FILE and run against the identical cases, rather than being
// described in a comment and hoped about.
{
  const { readFileSync } = await import("node:fs");
  const UI = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const start = UI.indexOf("const BL_MAX_VARIANTS = 6;");
  const end = UI.indexOf("const hasPendingApproval");
  ok("the browser copy is present and findable", start > 0 && end > start);

  const src = UI.slice(start, end);
  const mod = new Function(`${src}\nreturn {blNewVariant,blAddVariants,blReplaceVariant,blRemoveVariant,blApplyVariant,blPickField,blBlendPrompt,BL_MIXABLE,BL_MAX_VARIANTS};`)();

  eq("the cap matches", mod.BL_MAX_VARIANTS, MAX_VARIANTS);
  eq("the mixable list matches exactly", mod.BL_MIXABLE.join(","), MIXABLE.join(","));

  const v = mod.blNewVariant({ ...COPY, published: true });
  ok("🔴 the browser copy also refuses to carry published", !("published" in v));

  const cl = { landingVariants: [v], landingPage: { headline: "LIVE", brandColor: "#111111", published: true, publishedAt: "2026-08-01" } };
  const a = mod.blApplyVariant(cl, v.id);
  eq("🔴 a live page stays live in the browser copy too", a.landingPage.published, true);
  eq("and keeps its publish date", a.landingPage.publishedAt, "2026-08-01");
  ok("bookkeeping does not leak", !("id" in a.landingPage) && !("generatedAt" in a.landingPage));

  // 🔴 A forged candidate must not publish OR backdate. The publishedAt half escaped a first
  // pass because the fixture never carried one: `published` is overridden after the spread
  // anyway, so only publishedAt actually distinguishes a single clean from a double clean.
  const forged = { ...mod.blNewVariant(COPY), published: true, publishedAt: "1999-01-01" };
  const attack = mod.blApplyVariant({ landingVariants: [forged], landingPage: { published: false } }, forged.id);
  eq("🔴 nor can a forged variant publish from the browser", attack.landingPage.published, false);
  ok("🔴 nor backdate a page that was never published", !attack.landingPage.publishedAt);

  const took = mod.blPickField(cl, v.id, "headline");
  eq("taking a headline works", took.landingPage.headline, COPY.headline);
  eq("🔴 and does not repaint the page", took.landingPage.brandColor, "#111111");
  // 🔴 Ask for a key the variant REALLY HAS but that is not mixable. "published" proves
  // nothing here, since a variant never carries one and the lookup fails for that reason
  // instead of the allow list. An assertion the data guarantees is not a test.
  ok("the variant genuinely carries the bookkeeping being refused", "id" in v && "generatedAt" in v);
  eq("🔴 the allow list holds in the browser copy", mod.blPickField(cl, v.id, "id"), null);
  eq("and covers every piece of bookkeeping", mod.blPickField(cl, v.id, "generatedAt"), null);

  const list = mod.blAddVariants([], [mod.blNewVariant({ ...COPY, headline: "keep me" })]);
  // 🔴 A failed model call can return an EMPTY OBJECT or copy with no headline, not just null.
  // Both are truthy, so a bare falsy check passes them straight through and blanks the option.
  for (const [what, bad] of [["null", null], ["an empty object", {}], ["copy with no headline", { subheadline: "x" }], ["a string", "oops"]]) {
    eq(`🔴 a rewrite returning ${what} does not blank an option in the browser copy`,
      mod.blReplaceVariant(list, list[0].id, bad)[0].headline, "keep me");
  }
  eq("removing works", mod.blRemoveVariant(list, list[0].id).length, 0);

  // 🔴 The blend prompt is what reaches a model. Both copies must produce the SAME text, or
  // the OS quietly asks for something different from what the tests exercise.
  const b1 = mod.blNewVariant({ headline: "H1", subheadline: "S1", bullets: ["x", "y"], ctaText: "C1" }, { label: "Speed", at: "2026-09-01T00:00:00.000Z" });
  const b2 = { ...b1, id: b1.id };
  eq("🔴 both copies build the identical blend prompt",
    mod.blBlendPrompt([b1], [b1.id], "make it shorter"),
    blendPrompt([b2], [b2.id], "make it shorter"));
  eq("and both refuse an empty instruction", mod.blBlendPrompt([b1], [b1.id], "  "), null);
}

// ── 10. Seeing the options, not just reading them ───────────────────────────
// Bryson, 2026-09-01: *"i want to visually see the options not just words... choose to see
// landing page one two or three and the to view them side by side to compare them."*
{
  const { readFileSync } = await import("node:fs");
  const UI = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  ok("a preview can render a CANDIDATE instead of the live page", /overrideLanding\?\{\.\.\.client,landingPage:overrideLanding\}:client/.test(UI),
    "only landingPage is swapped, so the media, colours, phone and service area stay the "
    + "client's real data and the preview is honest about what that option would produce");

  // 🔴 LOOKING AT AN OPTION MUST NOT CHANGE ANYTHING. The preview posts to a render endpoint
  // and paints HTML. If it ever called onUpdate, flicking between tabs would rewrite the
  // client record, and in this card one of those writes touches the live page.
  const card = UI.slice(UI.indexOf("function LandingOptionsCard("), UI.indexOf("// `overrideLanding` renders a CANDIDATE"));
  const previewCalls = (card.match(/<LandingPreview[^>]*>/g) || []);
  ok("the card shows real rendered pages", previewCalls.length >= 2, `found ${previewCalls.length}`);
  ok("🔴 no preview is handed onUpdate", !previewCalls.some((c) => /onUpdate/.test(c)),
    "a preview that can write would turn looking into doing, which is the whole class of bug "
    + "the preview-safety rule exists for");

  // 🔴 Never scale UP. A column wider than a phone shows the page at its own width.
  ok("🔴 the preview never scales a page up", /Math\.min\(1,scaleTo\/FRAME_W\)/.test(UI),
    "blowing a 390px layout up to 510 shows a size no visitor will ever load");
  // 🔴 SCOPED TO THE COMPONENT, not the whole file. A first pass matched `overflow:"hidden"`
  // and the word ResizeObserver ANYWHERE in a 1MB file, so both mutations passed while the
  // real code was broken. A pattern that can match somebody else's code is not a test.
  const prev = UI.slice(UI.indexOf("function LandingPreview({client, overrideLanding"), UI.indexOf("// ─── HOME SCREEN"));
  ok("the scaled frame is clipped by its own wrapper",
    /if\(scaleTo\) return <div style=\{\{width:scaleTo,height:h,overflow:"hidden",position:"relative"/.test(prev),
    "an unclipped scaled frame overlaps the next column and scrolls the card sideways");

  // Three columns need room. Below that it falls back to one at a time and says why.
  ok("side by side is gated on measured width", /const canCompare = colW >= \d+;/.test(card));
  ok("🔴 the width is MEASURED on every resize, not read once",
    /new ResizeObserver\(\(\)=>\{[^}]*setColW/.test(card),
    "reading clientWidth once leaves the columns wrong the moment the window changes, and a "
    + "mere mention of ResizeObserver in a guard is not the same as observing anything");
  ok("and the fallback explains itself", /Side by side needs a wider window/.test(UI),
    "a disabled button with no reason reads as broken");

  ok("the tabs pick which option is shown", /setIdx\(i\);setCompare\(false\);/.test(card));
}

console.log(`verify-landing-variants: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
