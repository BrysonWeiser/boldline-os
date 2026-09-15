---
name: landing-pages-per-audience
topic: Ads
task: give BoldLine's own ads a different landing page per audience, or add a new audience page
keywords: [landing pages per audience, multiple landing pages, page per niche, car detailers page, roofers page, landingPages, clientForPage, freeSlug, boldlinemedia.com/for, /for/ proxy, lead path relative, /lead, one account many pages]
status: in progress
summary: BoldLine's own ads need a page per audience, one for car detailers and a different one for roofers, each with several options to choose from. A record could only ever hold ONE landing page, so an account may now carry `landingPages[]` alongside the one it already had. The pages answer at boldlinemedia.com/for/<name>, proxied to the OS, chosen over a subdomain each so a new audience needs no DNS and no Netlify job. 🔴 The lead form posted to a RELATIVE path, which on a proxied domain would 404 every enquiry while the ads kept spending; it now posts to `/lead`, proven live. FOUNDATION BUILT, the screen to manage them is not.
verified: 2026-09-15
---

## What he asked for

2026-09-15: *"for my ads i want a way to have multiple different landing pages that i can choose
from for each ad ... lets say i want to run an ad targeting car detailers i want to have a landing
page that fits that ad and I want to have multiple options to select for that one ad like how i do
with my clients and then I also want the ability to run a seperate ad lets say for roofers."*

Two things, and only the second was missing. **Choosing between several versions of one page
already exists** (KB `landing-page-options`). **An account holding several pages did not**: a
record has one `landingPage` and one `landingSlug`, full stop.

## 🔴 Why not a record per audience, which would have been free

Every feature he wants already works per client record, so the cheap answer was to make
"BoldLine: Roofers" a pretend internal client. Rejected, for two reasons found by looking:

1. **Four places take `find(c => c.internal)` and use the first match** — the My Ads screen
   (`index.html`), the owner report (`report-shared.mjs`), and two heartbeat reads in
   `alerts-watch.mjs`. A second internal record makes all four pick one at random.
2. It would **split his own ad performance across several fake clients**, which is the exact
   blending KB `campaign-breakdown` exists to stop. These are not separate advertising accounts.
   They are separate pages on one account.

## The shape

`landingPages[]` on the record, each `{ id, at, label, slug, page, variants[] }`. `landingPage`
and `landingSlug` are untouched and remain the account's main page, so nothing reading them today
changes behaviour.

🔴 **The renderer is not taught about any of this.** `clientForPage(cl, page)` hands it a shallow
copy of the account with `landingPage` and `landingSlug` swapped, so every layout, every guard and
every existing test covers these pages unchanged. That is the whole reason it is done this way.

**Slugs cannot collide.** `freeSlug` refuses to reuse another page's address *or the record's own*,
appending `-2` rather than erroring mid-flow. Two pages on one address is a coin flip over which
one a paid click lands on, and the loser is invisible: live, listed, never visited.

**Routing:** `/lp/<slug>` tries the indexed `landingSlug` lookup exactly as before; only on a miss
does it scan records carrying `landingPages`. It SCANS rather than filtering inside the JSON on the
server, because a jsonb containment filter is not testable from here and an untestable query on the
path a paid click takes is the shape of thing this project keeps shipping broken. Revisit when
there are more than a handful of records.

## The address, and the trap under it

**`boldlinemedia.com/for/<name>`**, proxied by two rules in `marketing-site/netlify.toml`. Bryson
chose this over a subdomain each (2026-09-15) because a subdomain needs a DNS record and a Netlify
job before every new audience, and this needs neither: after the one-time setup, a new audience is
a name typed into the OS.

🔴 **THE SECOND PROXY RULE IS LOAD-BEARING AND IS THE ONE THAT GETS FORGOTTEN.** A rendered landing
page uses exactly ONE relative address, the lead form's. Served on boldlinemedia.com it would post
*there*, where no such endpoint exists, so **every enquiry would 404 while the ads kept spending**
and the visitor would see "something went wrong" — the quiet failure `landing.mjs`'s own hand-off
note was written about. So the form now posts to **`/lead`**, the OS's existing public alias, and
that path is proxied too. `/.netlify/*` is reserved by Netlify and deliberately is NOT what is
proxied.

**Proven live before shipping**, because this changes a paying client's lead path: `POST /lead` and
`POST /.netlify/functions/lead-intake` return the byte-identical `{"ok":false,"error":"Invalid
token"}`, so the method, the query string and the handler all survive the rewrite. Tested with a
deliberately bad token, so nothing was written.

**The general guard that matters most:** `verify-landing-pages` asserts a rendered page carries
**exactly one** relative address and that it is the proxied one. A second one added later would
work perfectly on our own domain and fail only on the proxied address, where the money is.

## A latent hole closed on the way

Two preview-safety checks compared `indexOf(guard) < indexOf(send)` directly. **A missing guard
indexes to -1, which compares as "before" everything**, so both would have passed on a page
carrying no guard at all — the exact failure they exist to prevent. Both now require each half to
be present before judging the order, and were proved by deleting the guard.

## 🔴 What is NOT built yet

The screen. There is no way in the OS to create, name, edit or delete an audience page, so nothing
above is reachable by Bryson yet. Next, in order:

1. A card on the My Ads account listing the pages, with add / rename / delete and each page's
   public address.
2. The existing **Page Options** card scoped to the selected page, so each audience gets its own
   set of candidates to choose between. That is the half he already knows how to use.
3. Campaign creation pointing an ad at a chosen page.

Anything new that renders a page for looking at must be added to `verify-preview-safety`'s manifest
in the same change (standing rule).
