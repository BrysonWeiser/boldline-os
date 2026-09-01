---
name: landing-page-options
topic: Ads
task: give the owner several landing pages to choose from, mix, or rewrite
keywords: [landing page options, variants, landingVariants, multiple options, three options, blend, mix and match, pick field, take just, regenerate one, rewrite option, use this one, angles, LandingOptionsCard, blApplyVariant, blPickField, blBlendPrompt, landing-variants]
status: built
summary: Three landing pages written from three different angles instead of one take-it-or-leave-it. Use one as it is, take single pieces from any of them, or tick a few and describe the blend in plain English. The live page is never touched except by "Use this one", and choosing keeps the page exactly as live as it already was. 96 checks, 14 mutations caught.
verified: 2026-09-01
---

## What Bryson asked for

2026-09-01: *"giving me multiple landing page options that i can either choose to use combine
certain ideas or just straight up regenerate individual ones or all of them."* Offered A
(pick piece by piece), B (describe a blend in plain English) or C (both). **He chose C.**

## What it does

A **Page Options** card on the client view, above the approvals card:

| Action | What it touches |
|---|---|
| **Write three options** | Adds three candidates. Live page untouched |
| **Use this one** | The ONLY thing that writes the live page |
| **Take just: Headline / Sub / Bullets / Button / Look** | Copies that one field onto the live page |
| **Rewrite** | Replaces one candidate in place. Live page untouched |
| **Discard** | Removes one candidate |
| **Blend** | Tick some, describe the mix, get a new candidate. Live page untouched |

## 🔴 The invariant everything protects

**`client.landingPage` is what real visitors load. `client.landingVariants` are candidates.**
Only `applyVariant` writes the live page. Generating, rewriting, blending and discarding all
leave it exactly as it was. Get that wrong and a client's ads keep running while the page
underneath them changes on its own.

**`published` is read from the LIVE page, never from the candidate, and never reset.** Both
other readings are wrong in opposite directions:

- forcing it false would **take a live page offline** the moment he tried a different
  headline, with the client's ads still pointing at it;
- letting the candidate decide would let one **publish itself**.

So swapping copy is exactly as live as the page already was. When the page IS live the UI
confirms first, because that swap changes what visitors see immediately.

**Taking one piece copies exactly that field.** `MIXABLE` is an allow list, not "every key",
so taking a headline cannot drag another option's colours, layout or hero image along, and a
variant's bookkeeping (`id`, `generatedAt`) can never land on the live page.

**A rewrite that returns nothing leaves the option alone.** `replaceVariant` refuses anything
without a headline, so a failed model call cannot blank the option he was about to pick. Empty
objects and headline-less copy are truthy, so a bare falsy check is not enough.

## Three options means three arguments, not three rewordings

Asking one model for "three versions" reliably returns one idea phrased three ways. Each
option is generated with a distinct **ANGLE** instead (the result / the worry / speed and ease
/ why them / the offer). 🔴 The "why them" angle explicitly forbids inventing statistics,
awards or testimonials, because that prompt is the one most likely to put a fabricated award
on a real client's page.

**One scrape, one set of images, N calls.** The expensive part (fetching the client's site,
attaching their photos) is identical for every option and happens once above the fan-out. One
option failing does not lose the others; all failing is still an error.

🔴 **Single-page callers are unchanged, byte for byte.** `client-autobuild` and the existing
Generate button call with no `count` and still get `{ ok, landingPage }`. There is a test for
it, because breaking a working bot to add a new feature is the easy mistake here.

## Two copies, again

`index.html` cannot import a Node module, so the logic exists in **both**
`netlify/lib/landing-variants.mjs` and `index.html` (`bl*` prefix). Same hazard as the portal
and the contract. `verify-landing-variants.mjs` **extracts the browser copy from the shipping
file and runs the identical cases against it**, including that both build a byte-identical
blend prompt.

## How it was verified

**96 checks. 14 mutations applied, all caught** after fixes: a live page taken offline by a
swap, a forged variant publishing or backdating, an empty rewrite blanking an option, the
allow list removed, one field dragging the whole variant, a variant keeping a published flag,
an empty blend box firing a model call, the list growing without limit, and six drift
mutations between the two copies.

🔴 **Three of those escaped a first pass, and all three for the same reason: the assertion was
guaranteed by the fixture rather than by the code.**

- A forged `published` is overridden after the spread anyway, so only a forged **`publishedAt`**
  actually distinguishes one clean from two.
- `pickField(v, "published")` returns null because a variant never HAS a published key, not
  because of the allow list. Asking for **`id`**, which the variant really carries, is the test.
- `replaceVariant(list, id, null)` is rejected by any check. **`{}`** and **`{subheadline}`** are
  truthy and are what a failed call actually returns.

Also rendered in a real browser at 390 / 768 / 1280 / 1600: no sideways scroll, nothing
overflows, no JS errors, and `verify-app-boots` confirms the OS still compiles, since a syntax
error in `index.html` blanks the whole app.

## 2026-09-01 — seeing them, not just reading them

Bryson, same day: *"i want to visually see the options not just words. so it doesnt take up to
much space i want an option to be able to choose to see landing page one two or three and the
to view them side by side to compare them."*

**Two modes, which is exactly what he described:**

- **Tabs (default).** A `1 2 3` row and ONE real rendered page underneath, with that option's
  full controls below it. Compact, and the page is at readable size.
- **Compare.** All three side by side, each a real rendered page. Differences are obvious at a
  glance in a way a list of headlines never shows.

**How it renders.** `LandingPreview` gained an `overrideLanding` prop that swaps ONLY
`landingPage` in the posted body, so media, colours, phone and service area stay the client's
real data and the preview is honest about what that option would produce. `POST /landing` is
owner-authed and renders from the posted object with **no model call**, so previews are
instant and cost nothing.

🔴 **The preview is never handed `onUpdate`.** Flicking between tabs must not write to the
client record, and in this card one of those writes touches the live page. Asserted, because
that is the preview-safety class all over again.

**Two layout rules, both learned by measuring:**

- 🔴 **Never scale UP.** A column wider than a phone gets the page at its own width; only a
  narrower column shrinks the phone layout. Blowing a 390px layout up to 510 shows a size no
  visitor ever loads.
- 🔴 **The column width is MEASURED with a ResizeObserver, not assumed.** A fixed scale is
  right at one window size and wrong at every other, and this card sits in a column that
  changes width between laptop and desktop.

Side by side is gated on a measured 760px and **says why** when it is off, because a disabled
button with no reason reads as broken. On a phone it falls back to the tabs.

Verified in a browser at 390 / 768 / 1280 / 1600: Compare correctly disabled on the two narrow
widths, three frames on the two wide ones, no sideways scroll and nothing overflowing anywhere.

🔴 **Two more escaped mutations, same lesson as before but a new flavour: a pattern that can
match somebody else's code is not a test.** Asserting `overflow:"hidden"` and the bare word
`ResizeObserver` against the whole 1MB file passed while the real code was broken, because
both strings appear elsewhere (the latter inside its own `typeof` guard). Both assertions are
now scoped to the component slice.

## 🔴 2026-09-01 — different LAYOUTS, not just different copy

Bryson: *"i also dont just want different copy i also want different layouts too."* He was
right, and the reason is worth keeping: **left to itself the model converges.** Three calls on
one brief pick similar design tokens, so three options arrive as three headlines on the same
page. Asking nicely for variety does not fix that.

**So the structure is ASSIGNED, and then OVERWRITTEN after the model answers.** `layoutPlan()`
hands each option a distinct `layout` (where the form sits, whether a photo sits beside the
copy) and a distinct `order` (how the sections below the fold are arranged). The endpoint tells
the model which shape it is writing into, so the copy suits it, and then sets `design.layout`
and `design.order` itself. A model that ignores the instruction cannot collapse the options.

**Taste stays the model's call.** Font, colour, background and corner style are still chosen to
fit the brand, because forcing those would make the options arbitrary rather than different.

| Option | Angle | Layout |
|---|---|---|
| 1 | The result | `split` (copy beside a photo) |
| 2 | The worry | `centered` (copy above a wide banner) |
| 3 | Speed and ease | `capture` (the lead form IS the hero) |
| 4 | Why them | `overlay` (copy over a full-bleed photo) |

🔴 **OVERLAY IS DROPPED WHEN THE CLIENT HAS NO USABLE PHOTO.** The renderer already refuses it
without a hero (`useOverlay = D.layout === "overlay" && !!hero`), so forcing it on a photo-less
client does not break, it **silently falls back and two "different" options become the same
page.** A guaranteed difference has to exclude the one that cannot deliver it.

🔴 **And a renderer quirk found by measuring rather than reading: `order` takes four tokens but
produces only THREE distinct arrangements.** Token `d` lays the sections out identically to `a`.
`ORDERS` therefore omits `d`, with a test that re-measures the claim, so if the renderer ever
gains a real fourth arrangement it can go back.

**Proved against the real renderer, not against the plan.** A page's identity in the test is its
body class (which drives the whole layout in CSS) plus the order its sections actually come out
in, and three options must produce three distinct signatures **both with and without photos**.
Six mutations, all caught: overlay forced on a photo-less client, the colliding order token
restored, every option given the same layout, every option given the same order, the layout
merely requested instead of enforced, and the plan no longer checking for photos.

## 🔴 2026-09-01 — IT WAS THE SAME EVERY TIME. Bryson caught it.

*"the landing page layouts and copy options wont be the same everytime i want variety that is
the whole point of this."* He was right to check, and it was:

```
run 1: The result/split  |  The worry/centered  |  Speed and ease/capture
run 2: The result/split  |  The worry/centered  |  Speed and ease/capture
run 3: ... identical, forever, for every client
```

**Both the angle and the layout were indexed straight off the option number** (`ANGLES[i % 5]`,
`usable[i % usable.length]`), so pressing "write three options" returned the same three shapes
on every press and for every client. Only the wording drifted, which is one option with three
headlines. The feature looked finished and did not do the thing it exists for.

**The fix: the plan is SEEDED and it AVOIDS WHAT HE ALREADY HAS.**

- `planOptions(count, { hasPhoto, exclude, seed })` replaces `layoutPlan` + `angleFor`.
- **Deterministic for a given seed**, which is what makes it testable; **varied across seeds**,
  which is what makes it useful. 40 seeds produce well over 10 distinct plans.
- The OS passes `Date.now()` and the angles and layouts already on the client, so **"write
  three more" explores new ground** instead of handing back the three he is looking at. With
  five angles and three used, two of every three come back fresh.
- The endpoint **falls back to the clock** if a caller forgets the seed, because the failure
  mode of forgetting is silently returning the same page forever.

🔴 **HISTORY DEPRIORITISES, IT DOES NOT BAN.** Banning empties the pool the moment his six
options cover every angle, and then every option falls back to the same one. The test for this
had to assert the three angles are still DISTINCT: asserting the list is still three long
passes even when all three are identical.

**Every earlier guarantee is re-checked at every seed**, or variety would have been bought by
breaking what it was added to: layouts distinct, angles distinct, orders distinct, and overlay
still absent whenever the client has no photo.

### Two more escaped mutations, same root cause as ever

- `seed:Date.now()` was asserted with a bare search of a one-megabyte file. It also matches the
  single-option **rewrite** call, so it passed while the three-option press had lost its seed.
  Scoped to `call({count:3,seed:...`.
- The ban mutation was asserted by list LENGTH, which the fallback keeps at three. The harm is
  three identical angles, so that is what is asserted now.

**A pattern that can match somebody else's code, and an assertion the fallback guarantees, are
both ways of testing nothing.**

## 🔴 2026-09-01 — ALWAYS THE CLIENT'S BRAND COLOUR, NEVER A RANDOM ONE

Bryson: *"make sure that we always keep brand colors and we dont add random colors."* Three
separate things were producing random colours, and the options work made the worst one visible.

**1. 🔴 The colour was chosen PER OPTION.** Each option is its own model call, so one business
got a blue page, a red page and a green page in the same set. Measured before the fix:
`#2b6cb0 / #c53030 / #2f855a`. **Layout and copy are what should differ between options. Brand
identity never is.**

**2. 🔴 The prompt asked the model to invent one.** The tool description said *"Otherwise pick a
confident, professional color that fits THIS specific business and industry"*, which is a random
colour politely described. It now says to **return an empty string** when there is no logo, no
photo and no website signal, and the renderer's own neutral default takes over.

**3. There was no override.** Nothing let Bryson set a colour, so a bad guess could not be
corrected. There is now a hex box **and** a colour picker on the client, plus a light/dark
choice.

### The order of evidence, resolved ONCE per client

`resolveBrand({ client, scrape, picks })`:

| Rank | Source |
|---|---|
| 1 | **What Bryson typed.** Nothing overrides it |
| 2 | Their real website (theme-color meta, then the dominant accent) |
| 3 | What the model read off their logo and photos, **first usable pick only**, applied to all |
| 4 | The colour the page is already using, so rewriting copy never repaints a live page |
| 5 | Empty, and the renderer falls back to its own neutral |

**Two colours can never be a brand, whatever the source says:**

- 🔴 **BoldLine's own gold.** The prompt already asked the model to avoid it, but a prompt is a
  request and this is a guarantee. Anything within a small distance of `#C8A84B` is refused,
  including when typed into the field by hand, because a scraper reading a screenshot or a
  model ignoring the line would otherwise put our brand on a client's page.
- **Near-white, near-black and greys.** A scraper returning one of those has found the page
  background, not the brand, so it falls through to the next source.

Theme follows the same shape: his choice, then their website's light/dark feel, then the
current page, then light.

### How it was verified

Six mutations, all caught: the colour resolved but never applied, the model's guess outranking
what he typed, the gold and neutral guards removed, the gold check disabled, and regenerating
repainting a live page. Then rendered through the real page builder to confirm three options
that arrived with three different colours come out as one.

🔴 **One escaped, and it is the same lesson again in a new place.** "There is a field to set the
colour" matched a bare search, and passed while the hex box had lost its save handler, because
the **colour picker beside it** still matched the same pattern. The assertion now requires
**both** inputs to save. Anything that appears twice needs to be counted, not found.

Two older assertions also broke on a variable rename while the guarantee behind them was
intact. One of them is the contract that `client-autobuild` depends on, so it is now written as
the **shape** of the response rather than the exact wording, because a test that breaks on a
rename trains people to edit the test instead of reading it.

## Related

`ad-landing-page`, `client-autobuild` (the bot that writes the first page), `sms-consent`,
`preview-safety`, `repo-tests`.
