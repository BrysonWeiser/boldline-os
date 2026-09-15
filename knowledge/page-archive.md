---
name: page-archive
topic: Assets/Landing pages
task: save, view or delete a copy of a client's landing page, or use client work as content
keywords: [page archive, saved page shows code, supabase serves html as text/plain, archive viewer route, viewArchive, private page-archives bucket, saved page, save landing page, case study, portfolio, showcase rights, contract v4, neutraliseArchive, page-archive.mjs, ARCHIVE_BUCKET, pageArchives, showcaseOptOut, screenshot landing page, no copy of the page, lead token public bucket]
status: built
summary: A landing page is rebuilt from the database on every request, so no copy of it exists and the version that worked is lost the moment the record changes. The OS can now save one, list them, open them and delete them. The saved copy is neutralised at write time (every script, the form, the lead token and every link) because an archive of a live page can otherwise create a real lead. Contract terms v4 adds showcase rights with an explicit promise never to sell lead data. 26 checks, ten mutations caught.
verified: 2026-09-15
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

## 🔴 SUPABASE WILL NOT SERVE HTML, AND THAT BROKE THE WHOLE FEATURE (2026-09-15)

Bryson: *"i just saved a copy of the landing page for stencil & thread and i went to view it and
it only shows code not the actual visual landing page so that needs to be fixed."*

**Supabase Storage returns `text/plain` for a stored `.html` object no matter what content type it
was uploaded with.** It is deliberate, long-standing, and not configurable: Supabase does not want
its storage used to host web pages. So the browser painted the source. Nothing about the saving,
the rendering or the neutralising was wrong. **The delivery was, and the feature had therefore
never once worked** in the eleven days since it shipped. Confirmed against Supabase's own
discussions ([#7377](https://github.com/supabase/supabase/discussions/7377),
[#39110](https://github.com/orgs/supabase/discussions/39110),
[storage#186](https://github.com/supabase/storage/issues/186)).

**The fix: we serve it ourselves.** `GET /.netlify/functions/page-archive?file=<clientId>/<id>.html`
downloads the object with the service key and sets `text/html; charset=utf-8` itself.

- **The address is derived from the stored `path`, never read from the stored `url`.** Every page
  saved before today has a Supabase public URL on its record; deriving the address in the UI means
  those start rendering with nothing to re-save and no migration to run.
- **The bucket is now PRIVATE.** It was public only because a public URL used to be the delivery
  mechanism, and that URL never worked. A client's landing page with their own copy on it should
  not be world-readable. The neutralising and the lead-token strip stay exactly as they were.
- **The viewer carries no session**, because it opens in a new tab where no `Authorization` header
  can be sent — exactly as the public URL it replaces carried none. It is guarded three other ways:
  the path must match the archive shape exactly (no traversal, nothing else in the bucket), the
  path must be listed on the client record it names (**so a deleted archive stops serving even if
  the file lingers**), and the response is `Content-Security-Policy: sandbox` with nothing allowed
  — no scripts, no forms, no navigating the tab away. That last one is what makes serving from our
  own origin no more dangerous than serving from Supabase's.

### 🔴 And then the fix's own guard locked him out, for the same reason again

Bryson, minutes later: *"i saved it again and opened it and now it just says that is not a saved
page."*

`isArchivePath` demanded the client id be a **UUID**. **Client ids are `uid()` —
`Math.random().toString(36).slice(2, 9)`, so `k3m9xz2`** (and the seeded ones are `c1`). Every real
saved page was refused. **The test passed because its fixture was a UUID I had written out by
hand**: it confirmed my assumption about the data instead of the code's behaviour. Same shape as
the defect in the paragraph above, committed one commit later.

**The check no longer tries to recognise a client id at all**, because that was never its job and
guessing can only ever fail in the direction of locking him out. It makes the string safe to hand
to storage and nothing more: exactly one `/`, no `.` in the first segment so `..` cannot appear,
no slash inside either segment, `.html` ending. **Authorisation was always the membership check** —
the path must be listed on the client record it names — which is strictly stronger and needs no
guess about formats.

**The assertion that would have caught it, and now does:** run the real producer through the real
validator. `archiveEntry(...).path` is generated for every id shape the OS actually makes (`c1`,
seven-char `uid()` values, the one-character value `Math.random()` occasionally yields) and
`isArchivePath` must accept all of them. Restoring the UUID regex fails it by name:
*"the saver produced `c1/2026-09-15-ke9uhe.html` and the viewer rejects it"*. Traversal fixtures
were rebuilt off the generated path too, so none of them depend on a guessed prefix either.

**The rule: never hand-write a fixture for a format another function owns.** Generate it with the
real producer, or the test is a copy of your assumption.

### 🔴 Then it rendered, and showed only the header — a real bug in the LIVE page

Bryson: *"it only shows the header not the whole landing page."*

**`landing.mjs` hard-coded `js` onto the `<body>` tag, server-side.** So `.js .reveal{opacity:0}`
— the scroll reveal's resting state — matched unconditionally, and the only thing that ever made
those sections visible again was a script adding `.in`. An archive strips every script on purpose,
so **every revealed section was invisible forever**. The hero is not a `.reveal`, so a saved copy
showed the header and nothing else.

🔴 **This was never really an archive bug. The `.js` gate was not a test for JavaScript at all** —
it was on before a single line ran. **With JavaScript off, a live client landing page rendered the
same header over a blank page**, on a page BoldLine pays for clicks to, while the motion block's
own rule 1 said *"a visitor with JavaScript off ... render[s] COMPLETE"* and
`verify-landing-motion`'s preamble said it pinned exactly that.

**Fixed at the source:** the class now comes only from the head script, which puts it on `<html>`
before the body is parsed. With JavaScript on, nothing changes and there is no flash. With it off,
the gate does not match and everything sits at its finished, visible state. `neutraliseArchive`
strips the class too (a stored file has to stand on its own), and **`viewArchive` strips it when
serving**, which is what makes every page saved before 2026-09-15 render without re-saving it.

### Why three test layers all missed it

- `verify-landing-motion` claimed to pin the no-JS case and **read the HTML and CSS as text**. You
  cannot see `opacity: 0` that way. It now launches a browser with `javaScriptEnabled: false` and
  asserts **no element with real height computes to opacity 0** — and separately that `js` is not
  in the markup, so the check cannot pass today and stop meaning anything tomorrow.
- The archive chain test stopped at *"HTML came back"*. HTML came back the whole time he was
  looking at a blank page. It now **renders the served bytes in a browser**, with a floor on page
  height and visible text so "nothing is invisible" cannot be satisfied by a page with nothing on
  it.
- Nothing covered the files **already in storage**. The fixture for that is now deliberately an
  old-style archive, built by putting `js` back, and it must render in full after being served.
  Removing the serve-time strip fails it with *"9 parts still invisible, so every page saved
  before today stays broken"*.

Mutations caught: `js` hard-coded back onto the body (28 invisible sections), and the serve-time
strip removed.

### 🔴 The test pinned the broken version, and the harness could not fail

Two separate defects in the suite, both worth remembering:

1. **`assert.match(UI, /href=\{a\.url\}.../)`** was the guard on this. It proved the link's
   TARGET WINDOW and said nothing about whether it rendered. **A feature can be fully tested and
   still have never worked.** The viewer is now EXECUTED — `viewArchive(req, supabase)` takes its
   client as an argument specifically so the route can be run against a fake bucket and its real
   `Response` inspected: status, `content-type`, bytes, CSP, and that a bad path never reaches the
   database or the bucket at all.
2. **`const t = (name, fn) => { fn(); n++; }`** counted an async test as passed the moment it was
   called, throwing the promise away. Every promise is now collected and awaited before the suite
   reports success, so a test whose `await` is forgotten at the call site still fails the run.
   Proved by breaking an executed assertion *and* removing its `await`: exit code 1, no pass line.

Mutations caught: `text/plain` restored, sandbox dropped, path check removed, deleted archives
served, UI falling back to the Supabase URL, and the forgotten-await case above.

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
