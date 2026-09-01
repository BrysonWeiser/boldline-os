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

## Related

`ad-landing-page`, `client-autobuild` (the bot that writes the first page), `sms-consent`,
`preview-safety`, `repo-tests`.
