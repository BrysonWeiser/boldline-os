# Meta flip checklist — turning the website back to normal

Everything on the marketing site that is currently in its **"coming soon"** state because Meta has
not granted Marketing API standard access, and exactly what each one becomes when it does.

**This file is kept honest by a test.** `node tests/verify-meta-flip.mjs` reads the site, finds
every `CS:META-SOON` marker, and fails if any of them is missing from the table below, or if this
file lists one that no longer exists. So a new gated change cannot be added to the site without
being recorded here.

---

## 🔴 Flip by the SENTINELS, not by reverting the old commit

The original instruction was `git revert a4b83f0`. **That is no longer sufficient on its own**, and
relying on it would leave parts of the site half-flipped:

- The **Full System: Acquisition** card was added on 2026-08-17, *after* that commit. Reverting the
  commit does not touch a line that did not exist when it was made, so its waitlist button would
  survive the revert and stay wrong.
- Anything else added to the site from now on has the same problem.

**The sentinels are the source of truth.** Work the table below, top to bottom. Use
`git show a4b83f0` only as a reference for the original wording of the blocks that predate it.

---

## Marker types

| Marker | Meaning |
|---|---|
| `<!-- CS:META-SOON cta -->` | A **button** that was switched from booking a call to joining the waitlist. |
| `<!-- CS:META-SOON:START id -->` … `<!-- CS:META-SOON:END id -->` | A **block** added for the coming-soon state. Delete the whole block including both markers. |
| `<!-- CS:META-SOON -->` | An **inline** addition, immediately followed by the thing it added. |

---

## The checklist

### Buttons — 8 total, all in `marketing-site/index.html`

Each currently reads **"Join the waitlist"** and points at `#contact`. Each becomes **"Book a Call"**
pointing at the Calendly link, exactly like the three Google cards do today.

| # | Panel | Card |
|---|---|---|
| 1 | Meta Ads | Launch System |
| 2 | Meta Ads | Growth System |
| 3 | Meta Ads | Acquisition System |
| 4 | Combined | Full System: Growth |
| 5 | Combined | **Full System: Acquisition** — added after the revert commit, see the warning above |
| 6 | E-Commerce | Store Launch |
| 7 | E-Commerce | Store Growth |
| 8 | E-Commerce | Store Domination |

> **Was 9.** The **Full System: Launch** card was deleted on 2026-08-18 when pricing moved
> to the greater-of model: running both platforms now starts at $5,000/mo of ad budget, so a
> combined Launch tier could only ever be sold to someone it hurts. There is nothing to
> un-gate for it — do not go looking for it in `git show a4b83f0`.

Copy the exact markup from any Google card, which is the untouched reference:
`<a class="pkg-cta" href="https://calendly.com/theboldlinemedia/30min" target="_blank" rel="noopener noreferrer">Book a Call</a>`

### Blocks — delete entirely, markers included

**⚠️ Do not try this with a single find-and-replace.** Two blocks do not look like the others,
and a naive script silently skips them — which is exactly what happened when this was first
tested:

- **`rec-gate` is a JavaScript comment** (`/* … */`), not an HTML comment. Anything matching on
  `<!--` will never see it.
- **`styles` and `rec-gate` carry a trailing note** after the id (`START styles — remove this
  whole block…`), so a pattern expecting the marker to end right after the id misses them.

| id | File | Comment style | What it is |
|---|---|---|---|
| `intro` | index.html | HTML | The coming-soon explainer near the top of pricing |
| `styles` | index.html | HTML **+ trailing note** | CSS that only exists to style the coming-soon bits (`.soon`, `.soon-note`, `.eta`) |
| `note-meta` | index.html | HTML | "Meta systems open when…" note above the Meta cards |
| `note-combined` | index.html | HTML | Same note above the Combined cards |
| `note-ecom` | index.html | HTML | Same note above the E-Commerce cards |
| `wizard` | index.html | HTML | The package-recommender's coming-soon handling |
| `rec-notice` | index.html | HTML | The notice shown in the recommender result instead of a booking button |
| `rec-gate` | index.html | **JS `/* */`** + trailing note | Hides the recommender's "Book a Call" when it lands on a Meta result |
| `notice` | index.html | HTML | The site-wide coming-soon notice |
| `get-started` | get-started/index.html | HTML | The coming-soon note on the get-started page. **Reworded 2026-08-28**, because this is where paid social traffic lands and the old wording ("Meta is still going through platform approval, estimated October 2026") told people who had just clicked a *Facebook* ad that we could not do Facebook ads. It now reads "Taking on Google Ads clients now. Facebook and Instagram open later this year, and we add them to your account the moment they do." **At flip: delete the whole block, sentinels included.** Nothing in it survives, because the sentence exists only to explain an absence. |

Work them by hand, or match on `CS:META-SOON:START <id>` without assuming the comment syntax.
`node tests/verify-meta-flip.mjs` refuses to call the site flipped while any marker survives, so
a half-done flip cannot pass unnoticed.

### Inline — 3 total, in `marketing-site/index.html`

The **"Coming soon"** pill on three tab buttons. Delete the marker and the `<span class="soon">`
that follows it.

| Tab |
|---|
| Meta Ads |
| Combined Systems |
| E-Commerce |

---

## 🟡 Pricing changed underneath this checklist (2026-08-18)

The site now quotes **"From $X/mo"** plus a **"whichever is higher, never both"** line on every
card, and carries two permanent notes (the $5,000 combined unlock, and the $500 minimum ad
budget). **None of that is gated** — it is the live pricing model, not coming-soon copy, so the
flip must leave all of it alone. The only thing the flip changes is who can book.

---

## After flipping

1. `node tests/verify-meta-flip.mjs` — it flips its own expectations once no sentinels remain, and
   will then assert that **all 12 cards book** and no waitlist button survives.
2. `node tests/verify-packages.mjs` — prices and packages unchanged.
3. Check the site at 390 / 768 / 1280 / 1600 px.
4. Merge to `main` with a rollback branch, log it in `docs/DEPLOYS.md`.
5. Update KB `site-coming-soon`, `meta-marketing-api`, `meta-parked-work`.
6. Then raise the parked feature work in KB `meta-parked-work` — do not silently build it.

---

## Adding a NEW gated thing to the site from here

Bryson, 2026-08-17: *"make sure from now on any updates we do to the website are saved for when we
flip the website back to normal"*.

1. Wrap it in the right marker above.
2. Add a row to this file.
3. Run `node tests/verify-meta-flip.mjs`. If you skipped step 2, it fails and names what is missing.
