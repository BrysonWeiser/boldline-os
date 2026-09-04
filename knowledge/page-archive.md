---
name: page-archive
topic: Assets/Landing pages
task: save, view or delete a copy of a client's landing page, or use client work as content
keywords: [page archive, saved page, save landing page, case study, portfolio, showcase rights, contract v4, neutraliseArchive, page-archive.mjs, ARCHIVE_BUCKET, pageArchives, showcaseOptOut, screenshot landing page, no copy of the page, lead token public bucket]
status: built
summary: A landing page is rebuilt from the database on every request, so no copy of it exists and the version that worked is lost the moment the record changes. The OS can now save one, list them, open them and delete them. The saved copy is neutralised at write time (every script, the form, the lead token and every link) because an archive of a live page can otherwise create a real lead. Contract terms v4 adds showcase rights with an explicit promise never to sell lead data. 26 checks, ten mutations caught.
verified: 2026-09-04
---

## Why saving the PAGE beats a screenshot

Bryson asked for screenshots of published pages for case studies. The stronger answer is the
page itself, and the reason matters:

🔴 **THERE IS NO COPY OF A LANDING PAGE.** `landing.mjs` rebuilds every page from Supabase on
every single request. That is why an edit is live instantly, with no publish step and no
cache. It also means **the version that produced leads exists only until somebody edits the
record.** A client changes their headline, or churns and the record is cleared, and it is
gone. Not archived, not recoverable.

A screenshot is a low-resolution picture of that. The page is the thing, and an image can be
made from it later.

## Where it is

**Client → Assets → Saved Copies of the Page**, directly under the landing page card. Save,
View (new tab), Delete. Stored in the public `page-archives` bucket, listed on the client
record as `pageArchives[]`.

## 🔴 An archive is a preview, and a preview must never change anything real

This is the sharpest case of the standing rule in the whole codebase. A landing page is **not
inert**: it carries a submit handler pointing at `lead-intake?token=<the client's REAL lead
token>`. Archive it verbatim, open it months later to show somebody, tap the form to
demonstrate it, and **a real lead lands on that client's record and is forwarded to their
CRM** from a page nobody is running. The file also sits in a **public bucket**.

So the copy is **neutralised when it is WRITTEN, not when it is shown.** Neutralising on
display would leave the dangerous version in storage, one direct link away from being live.

| Cut | Why |
|---|---|
| Every `<script>` and `<noscript>` | the submit handler, click-id capture, conversion tag, pixel |
| Inline `on*` attributes | not script tags, so a script-only strip misses them |
| `action`, `method`, Netlify form attrs; `onsubmit="return false"`; `<fieldset disabled>` | three independent ways the form cannot post |
| 🔴 Any `lead-intake?token=…` in the text | the token lived inside a script, but this is a **public** file and one unmatched script tag is all it takes |
| Every `href` → `data-archived-href` | a booking link still books, a phone link still rings |

**The visual record is untouched.** Only plumbing is cut, which is the entire point of saving
the page rather than a picture. A fixed banner says *"Saved copy from &lt;date&gt;. Nothing on
this page works, it is a record of how it looked."* because otherwise it is pixel-identical to
the live site and somebody will act on it.

🔴 **It opens in a NEW TAB, never an iframe in the OS.** It carries the client's own full-page
styling, and dropping that inside the OS is how a preview restyles or navigates the app around
it. Recorded in `verify-preview-safety`'s manifest comment so its absence there reads as a
decision rather than an oversight.

## Deleting

Bryson asked for this in the same breath as the saving, and it is what makes the feature
acceptable to a client. 🔴 **The file goes before the record**: clearing the record first and
failing on the file would leave a page in a public bucket with nothing pointing at it, the one
outcome nobody can find again to fix. The reverse case is handled too — a written file whose
record fails to save is removed rather than orphaned. It confirms first, because nothing else
keeps a copy.

## Contract terms v4: showcase rights

v1 to v3 carried one vague line about "portfolio rights", too thin to publish case studies on.
**v4 replaces it** (`CONTRACT_TERMS_VERSION = 4`; a client who signed v3 never gains it, which
is the entire reason terms are versioned):

- **(c)** the right to reproduce and display the landing pages, ads, creative and campaign
  structure, plus name and logo, in screenshots, recordings, case studies, social, email and
  the website.
- 🔴 **(d) Client data is never used.** No lead, customer or contact information is published,
  shared, licensed or sold, naming names, emails, phone numbers and message contents
  explicitly. **This carve-out is not a courtesy, it is what makes the rest signable**, and it
  is what BoldLine already does, so writing it down costs nothing.
- **(e)** their confidential business information is excluded: costs, margins, supplier terms,
  what they charge their own customers.
- **(f)** results may be published, but on written request the client is described
  generically rather than named.
- **(g)** any single item is pulled within 30 days on request, with no obligation to recall
  what is already printed or distributed.

🔴 **`showcaseOptOut` on the client swaps the whole grant for a refusal**, so a client who
says no never costs the deal.

## Phone view: see it at the size people see it

A **Phone view** button on each saved row opens it in a new tab inside a frame at **390px**,
with one-tap **Tablet (768)** and **Desktop (1280)**. Screenshot it and that is a real
screenshot at the size that matters.

🔴 **THE WRAPPER CONTAINS NO SCRIPT, and that is a constraint rather than a style choice.** A
script there would need `</scr` + `ipt>` escaping inside `index.html`, which is itself one
giant script block, and that is the exact shape of edit that has blanked this whole app
before. The width switch is three CSS radio buttons and a sibling selector. Pinned by a check
so nobody "improves" it back into JavaScript.

The frame is also `sandbox`ed. The archive is already dead when it is written, so this is a
second lock on a bolted door, and it costs nothing. The client's business name and the archive
URL are escaped into the wrapper, because a business name with an apostrophe or a quote in a
URL would otherwise break the document.

## Why not a screenshot service, yet

Bryson asked which to build. **Neither, yet**, and the recommendation is recorded because the
answer changes with scale:

- **A card generator loses the thing that matters.** What makes the work look good IS the
  page. A graphic built from the headline and the brand colours only says "we built
  something".
- **A screenshot service is the right eventual answer**, because it works on **anything with a
  URL**, including a client's OLD site beside the new landing page. That before-and-after is
  the actual case study, and a card generator cannot produce it at all. A few dollars a month
  and one Netlify trip for the key.
- **But not at one client and no results.** Between now and the third client that is perhaps
  five images. Unlike the archive, it is not urgent: **a saved page can be screenshotted at
  any point in the future, whereas an unsaved page is gone the moment the record changes.**

Revisit when case studies are a regular job.
