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
  MAX_VARIANTS, DEFAULT_COUNT, MIXABLE, ANGLES, angleFor, layoutPlan, planOptions, usedCombos, LAYOUTS, ORDERS,
  resolveBrand, normHex, isBoldlineGold, isNeutral,
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
  ok("🔴 and each one gets a different angle", /const plan = planOptions\(count,/.test(src) && /THIS VERSION'S ANGLE/.test(src),
    "one model asked for three versions returns one idea worded three ways");
  ok("🔴 one option failing does not lose the others", /results\.filter\(Boolean\)/.test(src),
    "handing back nothing because the third timed out is the worst reading of 'give me options'");
  ok("but every option failing is still reported as a failure",
    /if \(!built\.length\) return json\(\{ ok: false/.test(src));
  ok("a blend passes the instruction through as an instruction",
    /REWRITE INSTRUCTION FROM THE ACCOUNT MANAGER/.test(src));

  // 🔴 The autobuild bot and the existing Generate button both call this with no count. Their
  // response shape must not change, or a working feature breaks to add a new one.
  // 🔴 Written as the CONTRACT, not the exact wording. A first version pinned the variable
  // name and broke on a rename while the guarantee it protects was still intact, which trains
  // people to "fix" the test instead of reading it.
  ok("🔴 single-page callers still get a landingPage on the response",
    /return json\(\{ ok: true, landingPage: \w+, options: \[\w+\]/.test(src),
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

// ── 11. 🔴 THE OPTIONS MUST LOOK DIFFERENT, NOT JUST READ DIFFERENTLY ───────
// Bryson, 2026-09-01: *"i also dont just want different copy i also want different layouts
// too."* Left to itself the model converges: three calls on one brief pick similar design
// tokens and three options arrive as three headlines on the same page. So the structure is
// ASSIGNED, and this proves it against the real renderer rather than against the plan.
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const base = {
    name: "Stencil & Thread", landingSlug: "s", leadToken: "T", callTrackingNumber: "+15415550100",
    campaignSetup: { serviceArea: "Eugene, OR", mainOffer: "Free quote this week" },
  };
  const lp = { headline: "H", subheadline: "S", bullets: ["a", "b"], ctaText: "CTA", published: true, heroPath: "p/1.jpg", steps: ["1", "2", "3"], faqs: [{ q: "Q", a: "A" }] };
  const photos = [{ path: "p/1.jpg", url: "https://cdn.example.com/1.jpg", category: "photo" }];

  // A page's identity here is its body class (which drives the whole layout in CSS) plus the
  // order its sections actually come out in. Comparing the PLAN to itself would prove nothing.
  const signature = (cl, design) => {
    const h = renderLandingPage({ ...cl, landingPage: { ...lp, design } });
    const body = (h.match(/<body class="([^"]*)"/) || [])[1] || "";
    const heads = [...h.matchAll(/<h2[^>]*>([^<]{0,22})/g)].map((m) => m[1]).join(">");
    return `${body}||${heads}`;
  };

  for (const [label, media] of [["with a photo", photos], ["with no photos at all", []]]) {
    const plan = layoutPlan(3, { hasPhoto: media.length > 0 });
    const sigs = plan.map((d) => signature({ ...base, mediaLibrary: media }, d));
    ok(`🔴 three options render as three genuinely different pages, ${label}`,
      new Set(sigs).size === 3, `only ${new Set(sigs).size} distinct`);
  }

  // 🔴 Overlay needs a hero. The renderer silently falls back without one, so forcing it on a
  // photo-less client turns two "different" options into the same page.
  ok("🔴 overlay is offered when there are photos", layoutPlan(4, { hasPhoto: true }).some((d) => d.layout === "overlay"));
  ok("🔴 and never when there are none", !layoutPlan(4, { hasPhoto: false }).some((d) => d.layout === "overlay"),
    "the renderer refuses overlay without a hero and falls back, which would collide two options");

  const three = layoutPlan(3, { hasPhoto: true });
  ok("the three layouts are distinct", new Set(three.map((d) => d.layout)).size === 3);
  ok("and so are the section orders", new Set(three.map((d) => d.order)).size === 3);

  // 🔴 Measured against the renderer: it takes four order tokens but produces only three
  // distinct arrangements, so including the fourth would let two options collide.
  ok("🔴 only the order tokens that actually differ are used", !ORDERS.includes("d"),
    "measured against the real renderer, order 'd' lays the sections out identically to 'a'");
  const arrangements = new Set(["a", "b", "c", "d"].map((o) => signature({ ...base, mediaLibrary: photos }, { layout: "split", order: o })));
  ok("and that measurement still holds", arrangements.size === 3,
    "if the renderer ever gains a real fourth arrangement, put 'd' back");

  // Every angle names a layout, so the copy suits the shape it is written into.
  ok("every angle carries a layout", ANGLES.every((a) => LAYOUTS.includes(a.layout)));

  // The endpoint must OVERWRITE the layout, not merely ask for it.
  const { readFileSync } = await import("node:fs");
  const gen = readFileSync(new URL("../netlify/functions/generate-landing.mjs", import.meta.url), "utf8");
  ok("🔴 the layout is overwritten after the model answers, not just requested",
    /design: \{ \.\.\.\(lp\.design \|\| \{\}\), layout: d\.layout, order: d\.order \}/.test(gen),
    "a model that ignores the instruction would hand back three identical structures");
  ok("and the plan knows whether the client has a usable photo",
    /planOptions\(count, \{ hasPhoto: viewable\.length > 0, seed, exclude \}\)/.test(gen));
  ok("the copy is told which shape it is being written into", /THIS VERSION'S LAYOUT IS ALREADY DECIDED/.test(gen));
  // Taste stays the model's call, or the pages become arbitrary rather than different.
  ok("🔴 font, colour and background are still the model's choice",
    /Still choose font, colour, background and corner style to fit this brand/.test(gen)
      && !/font: |brandColor: d\./.test(gen.slice(gen.indexOf("if (count > 1)"), gen.indexOf("const options"))),
    "forcing taste tokens would make the options arbitrary instead of suited to the brand");
}

// ── 12. 🔴 IT MUST NOT BE THE SAME EVERY TIME ───────────────────────────────
// Bryson, 2026-09-01: *"the landing page layouts and copy options wont be the same everytime
// i want variety that is the whole point of this."* He was right to check, and it WAS: both
// the angle and the layout were indexed straight off the option number, so every press for
// every client returned The result / split, The worry / centered, Speed and ease / capture.
// Only the wording drifted. That is one option with three headlines.
{
  const plans = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    plans.add(planOptions(3, { hasPhoto: true, seed }).map((d) => `${d.angle}/${d.layout}/${d.order}`).join("|"));
  }
  ok("🔴 pressing it again gives a different set", plans.size > 10, `only ${plans.size} distinct plans in 40 presses`);

  // Deterministic for a given seed, or none of this is testable.
  const a = JSON.stringify(planOptions(3, { hasPhoto: true, seed: 42 }));
  ok("but the same seed is reproducible", a === JSON.stringify(planOptions(3, { hasPhoto: true, seed: 42 })));
  ok("and a different seed is not", a !== JSON.stringify(planOptions(3, { hasPhoto: true, seed: 43 })));

  // 🔴 Every guarantee from before still holds at every seed, or variety has been bought by
  // breaking the thing it was added to.
  for (let seed = 1; seed <= 40; seed++) {
    const withPhoto = planOptions(3, { hasPhoto: true, seed });
    const without = planOptions(3, { hasPhoto: false, seed });
    if (new Set(withPhoto.map((d) => d.layout)).size !== 3) { ok(`layouts stay distinct at seed ${seed}`, false); break; }
    if (new Set(withPhoto.map((d) => d.angle)).size !== 3) { ok(`angles stay distinct at seed ${seed}`, false); break; }
    if (new Set(withPhoto.map((d) => d.order)).size !== 3) { ok(`orders stay distinct at seed ${seed}`, false); break; }
    if (without.some((d) => d.layout === "overlay")) { ok(`overlay stays out without photos at seed ${seed}`, false); break; }
    if (seed === 40) {
      ok("🔴 layouts stay distinct at every seed", true);
      ok("🔴 angles stay distinct at every seed", true);
      ok("🔴 section orders stay distinct at every seed", true);
      ok("🔴 overlay never appears without a photo, at any seed", true);
    }
  }

  // 🔴 "Write three more" must explore new ground, not hand back what he is looking at.
  const first = planOptions(3, { hasPhoto: true, seed: 7 });
  const exclude = first.map((d) => ({ angle: d.angle, layout: d.layout }));
  let freshCount = 0;
  for (let seed = 100; seed < 140; seed++) {
    const next = planOptions(3, { hasPhoto: true, seed, exclude });
    freshCount += next.filter((d) => !exclude.some((e) => e.angle === d.angle)).length;
  }
  // Five angles, three already used, so two of every three should be new.
  ok("🔴 a second press favours angles he has not seen", freshCount / 40 >= 1.9,
    `averaged ${(freshCount / 40).toFixed(2)} fresh angles per press, expected about 2`);

  // Exhausted history must not return fewer than asked for. Banning outright would.
  const allUsed = ANGLES.map((a) => ({ angle: a.key, layout: "split" }));
  const exhausted = planOptions(3, { hasPhoto: true, seed: 5, exclude: allUsed });
  ok("once every angle has been used it still returns a full set", exhausted.length === 3);
  // 🔴 The real harm of BANNING rather than deprioritising is not a short list, it is three
  // options collapsing onto the same fallback angle. Length alone does not catch that.
  ok("🔴 and those three are still three different angles",
    new Set(exhausted.map((d) => d.angle)).size === 3,
    "banning what he has seen empties the pool the moment his options cover every angle, and "
    + "each one then falls back to the same angle");

  // The client's own history, in the shape the planner wants.
  const used = usedCombos({ landingVariants: [{ angle: "speed", design: { layout: "capture" } }, { angle: "proof", design: {} }] });
  ok("history is read off the client's own options", used[0].angle === "speed" && used[0].layout === "capture");
  ok("and an option with no design does not break it", used[1].angle === "proof" && !used[1].layout);
  ok("no options means nothing to exclude", usedCombos({}).length === 0 && usedCombos(null).length === 0);

  // Wired up on both ends, or the variety never reaches him.
  const { readFileSync } = await import("node:fs");
  const gen = readFileSync(new URL("../netlify/functions/generate-landing.mjs", import.meta.url), "utf8");
  const UI2 = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  ok("🔴 the endpoint takes a seed and defaults to the clock", /const seed = Number\(body\.seed\) \|\| Date\.now\(\);/.test(gen),
    "a caller that forgets must still get variety, not the same page three times forever");
  ok("and it passes both into the plan", /planOptions\(count, \{ hasPhoto: viewable\.length > 0, seed, exclude \}\)/.test(gen));
  // 🔴 Scoped to the call that writes the SET. A bare search for the clock also matches the
  // single-option rewrite, so it passed while the three-option press had lost its seed.
  ok("🔴 the OS sends a moving seed when it asks for a set",
    /call\(\{count:3,seed:Date\.now\(\),/.test(UI2));
  ok("🔴 and sends what he already has", /exclude:variants\.map\(v=>\(\{angle:v\.angle,layout:\(v\.design\|\|\{\}\)\.layout\}\)\)/.test(UI2));
}

// ── 13. 🔴 THE CLIENT'S BRAND COLOUR, NEVER A RANDOM ONE ────────────────────
// Bryson, 2026-09-01: *"make sure that we always keep brand colors and we dont add random
// colors."* Three separate things were producing random colours, and the options work made
// the worst of them visible: the colour was chosen PER OPTION, so one business got a blue
// page, a red page and a green page in the same set.
{
  const picks = [{ brandColor: "#2b6cb0", theme: "light" }, { brandColor: "#c53030", theme: "dark" }, { brandColor: "#2f855a", theme: "light" }];

  // 🔴 THE HEADLINE FIX. One colour for the whole client, whatever the options came back with.
  const r = resolveBrand({ picks });
  ok("🔴 three options that disagree resolve to ONE colour", !!r.brandColor);
  eq("and it is the first usable one", r.brandColor, "#2b6cb0");

  // Order of evidence. What he typed beats everything.
  eq("🔴 a colour he set by hand wins", resolveBrand({ client: { brandColor: "#123456" }, scrape: { themeColor: "#8b0000", accents: [] }, picks }).brandColor, "#123456");
  eq("their real website beats what the model guessed",
    resolveBrand({ scrape: { themeColor: "#8b0000", accents: [], themeHint: "dark" }, picks }).brandColor, "#8b0000");
  eq("a site accent counts when there is no theme colour",
    resolveBrand({ scrape: { themeColor: "", accents: ["#ffffff", "#7a1fa2"], themeHint: "light" }, picks }).brandColor, "#7a1fa2");
  eq("🔴 and the page keeps the colour it already has rather than being repainted",
    resolveBrand({ client: { landingPage: { brandColor: "#0f766e" } }, picks: [] }).brandColor, "#0f766e",
    "rewriting the copy must not change a client's colours");
  eq("with nothing at all it stays empty for the renderer's own default",
    resolveBrand({}).brandColor, "");

  // 🔴 OUR GOLD IS NEVER A CLIENT'S BRAND. The prompt asks; this guarantees.
  ok("🔴 BoldLine gold is refused", isBoldlineGold("#c8a84b") && isBoldlineGold("#c9a94c"));
  eq("🔴 even when it is typed into the field by hand", resolveBrand({ client: { brandColor: "#c8a84b" } }).brandColor, "");
  ok("but a genuinely different yellow is fine", !isBoldlineGold("#ffd000"));

  // Backgrounds are not brands. A scraper that returns near-white found the page, not the brand.
  ok("near-white, near-black and greys are not brand colours",
    isNeutral("#fafafa") && isNeutral("#0a0a0a") && isNeutral("#808080"));
  ok("a real colour is not treated as neutral", !isNeutral("#2b6cb0") && !isNeutral("#8b0000"));
  eq("so a white scrape falls through to the next source",
    resolveBrand({ scrape: { themeColor: "#ffffff", accents: [] }, picks }).brandColor, "#2b6cb0");

  eq("hex is normalised", normHex("2B6CB0"), "#2b6cb0");
  eq("and junk is refused", normHex("blue"), "");

  // Theme follows the same shape: one per client, his choice first.
  eq("he can force dark", resolveBrand({ client: { brandTheme: "dark" }, scrape: { themeHint: "light" } }).theme, "dark");
  eq("otherwise their website decides", resolveBrand({ scrape: { themeHint: "dark", accents: [] } }).theme, "dark");
  eq("an unclear website does not count", resolveBrand({ scrape: { themeHint: "unclear", accents: [] }, picks: [{ theme: "dark" }] }).theme, "dark");
  eq("and the default is light", resolveBrand({}).theme, "light");

  // The endpoint has to APPLY it, or none of the above reaches a page.
  const { readFileSync } = await import("node:fs");
  const gen = readFileSync(new URL("../netlify/functions/generate-landing.mjs", import.meta.url), "utf8");
  ok("🔴 every option is stamped with the one resolved colour",
    /built\.map\(\(o\) => \(\{ \.\.\.o, brandColor: brand\.brandColor, theme: brand\.theme/.test(gen),
    "resolving a colour and then not applying it leaves three options with three colours");
  ok("the single-page and blend paths get it too",
    (gen.match(/resolveBrand\(\{ client: body, scrape/g) || []).length === 3);

  // 🔴 THE PROMPT MUST NOT INVITE AN INVENTED COLOUR. It used to say "pick a confident,
  // professional color that fits this business", which is a random colour politely described.
  ok("🔴 the model is told to return nothing rather than invent a colour",
    /RETURN AN EMPTY STRING/.test(gen) && /Do NOT choose a color that would 'fit the industry'/.test(gen));
  ok("and the old invitation is gone", !/pick a confident, professional color/.test(gen));

  // And he can actually override it.
  const UI3 = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  // 🔴 BOTH inputs must save. A bare search passed while the hex box had lost its handler,
  // because the colour picker beside it still matched.
  ok("🔴 both the hex box and the colour picker save what he sets",
    (UI3.match(/set\("brandColor",e\.target\.value\)/g) || []).length === 2,
    "typing a hex and clicking the swatch must both stick, or half the control is decoration");
  ok("and the picker is a real colour input", /type="color"/.test(UI3));
  ok("and a light or dark override", /set\("brandTheme",e\.target\.value\)/.test(UI3));
}

console.log(`verify-landing-variants: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
