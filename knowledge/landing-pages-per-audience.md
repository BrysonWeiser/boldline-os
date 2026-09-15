---
name: landing-pages-per-audience
topic: Ads
task: give BoldLine's own ads a different landing page per audience, or add a new audience page
keywords: [landing pages per audience, multiple landing pages, page per niche, car detailers page, roofers page, landingPages, clientForPage, freeSlug, boldlinemedia.com/for, /for/ proxy, lead path relative, /lead, one account many pages]
status: built
summary: BoldLine's own ads need a page per audience, one for car detailers and a different one for roofers, each with several options to choose from. A record could only ever hold ONE landing page, so an account may now carry `landingPages[]` alongside the one it already had. The pages answer at boldlinemedia.com/for/<name>, proxied to the OS, chosen over a subdomain each so a new audience needs no DNS and no Netlify job. 🔴 The lead form posted to a RELATIVE path, which on a proxied domain would 404 every enquiry while the ads kept spending; it now posts to `/lead`, proven live. Client detail > Assets > Landing Pages By Audience, on the My Ads account only: add, write, put live, open, copy, rename, delete.
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

## The screen

**Client detail → Assets → Landing Pages By Audience**, on the My Ads account only, directly under
the existing hand-built page card (which is untouched and remains the main page).

Type who the next ad is aimed at, press **Add page**, and it appears with its address. Open it to
write the page, put it live, preview it, copy the address, rename it or delete it. **Writing never
publishes** — a page that went live the moment it was written would put unreviewed copy on an
advertised address.

## 🔴 THE PAGE SELLS TO THE TRADE, IT DOES NOT SELL THE TRADE

The biggest risk in the whole feature, and it reads fine until you notice who the page is talking
to. `generate-landing`'s prompt is written for *"a local service business"* selling to consumers, so
wiring the card to send `niche: "Roofers"` — the obvious thing — would have produced **a page
advertising roofing to homeowners, on Bryson's own domain, paid for by Bryson's own ads.**

So the generator takes an optional **`audience`** instead, which swaps the entire system prompt for
one that says the visitor is the OWNER of that trade and the page sells BoldLine's service to them.
**Absent, nothing in that file changes**, and a test asserts the original prompt is still the one
used without an audience and that the audience prompt contains no trace of "local service business".

🔴 **The audience prompt forbids inventing proof, and says why.** BoldLine is new with almost no
track record, so a fabricated case study or "X businesses served" is both a lie and instantly
checkable. Also skips the local-conditions lookup: an audience page speaks to a trade nationally,
so there is no service area to look up and the call would be spent on an empty string.

## What the tests pin

- The card sends an **audience** and never a niche (the mutation writes the wrong-direction page).
- Handlers live **inside** the card, by slicing the component — Deal Prep shipped broken because
  they landed in a neighbour and every grep still passed (KB `deal-prep-to-client`).
- The card is mounted **only** on the internal account. 🔴 Proved by finding the nearest
  `client.internal ? (` before the mount and asserting the else-arm has not opened in between. The
  first version checked a fixed 2000-character window and failed because the branch was 2354 away,
  which would have been "fixed" by widening the window until it passed: a test tuned to its answer.
- Addresses cannot collide, including with the account's own.
- Deleting warns that ads pointing at the address will break.
- Writing a page never publishes it.

**Previews:** audience pages render through the SAME `LandingPreview` embed as a client's, handing
it the account with `landingPage` swapped, so they carry the same real lead token and ride the same
`about:` guard already in `verify-preview-safety`'s manifest. That row now says so, and says to
re-read it if anyone ever gives audience pages their own embed.

**Verified in a real browser** at 390/768/1280/1600, which caught a bug no test would have: the
Delete button was written `backgroundColor:"none"`, which is not a valid colour, so React dropped it
and the browser's default light button styling showed through on a dark card.

## 🔴 They render in BOLDLINE's brand, and that is stamped in code

Bryson, 2026-09-15: *"make sure the landing pages for my ads match my branding right now they are
matching stencil & threads branding."*

They were not carrying a client's colours. They were carrying **nobody's**. `landingTheme` falls
back to **`#4f6bed` on a light page** when no brand colour is set, and that is the same fallback
Stencil & Thread's page lands on, so BoldLine's own ads pointed at a page that looked like another
company's.

`landingTheme`'s own comment says the colour comes from the client's branding and *"Never
BoldLine's"*. **That is right for a CLIENT page and exactly inverted here**: these pages ARE
BoldLine's, advertising BoldLine, on BoldLine's domain. So `clientForPage` stamps
`brandColor: #c8a84b` and `brandTheme: dark` as TOP-LEVEL fields, which beat whatever the generator
wrote. A page may still carry its own if one is ever wanted per audience.

🔴 **In code, not in the prompt.** The prompt asked for gold on dark too, and a prompt is a request
while this is a guarantee. The prompt now says the colour is applied in code and not to set it, so
the next person does not debug the wrong half; a test pins that wording.

**The OS preview stamps the same values.** A preview showing indigo-on-white while the live page is
gold-on-dark gets wrong the one thing a preview exists for.

Verified by rendering a real audience page: page background `rgb(12,13,17)`, button
`rgb(200,168,75)`. A real client's page is unchanged, asserted both for a hand-set colour and a
generated one.

## 🔴 EVERY PAGE IS ITS OWN PAGE, AND THE WRITER'S LAYOUT IS THROWN AWAY

Bryson, 2026-09-15: *"i like it but it looks exactly like the landing page for stencil & thread ...
no matter what each landing page should not just be a copy and paste they should be unique."*

`designConfig` takes layout, background, motion, benefit style, font, shape and section order from
`landingPage.design` **when the writer set them**, and otherwise from a seed derived from the
page's own slug. The writer sets them, and **a model asked the same question returns the same
answer**, so every audience page came out `split/glowgrid/up/cards/modern/rounded/a`. Identical
furniture, different words.

**`clientForPage` now drops `design` entirely**, handing all seven choices to the slug seed, which
differs by construction:

| Audience | What it gets |
|---|---|
| roofers | centered · dots · alt · cards · modern · soft · c |
| car-detailers | capture · mesh · up · list · modern · rounded · b |
| med-spas | capture · glowgrid · alt · list · elegant · soft · c |

**Varied, not random.** The seed is the slug, so the same page is the same page on every visit;
furniture that moved between two visits would be its own bug. Both are asserted. The BRAND stays
pinned, so the pages differ in structure while staying unmistakably BoldLine.

## 🔴 NO CONSENT BOX FOR MESSAGES THAT CANNOT BE SENT

*"it even includes their text thing which we dont have yet."* Every landing page rendered the SMS
consent checkboxes **unconditionally**. `landing.mjs`'s own rule is that *"the consent wording is
not ours to word. It is whatever that business filed with the carriers."* **BoldLine has filed
nothing and cannot send a text at all** — Twilio is still on the free trial (KB `call-tracking`).
So BoldLine's own page asked a prospect to agree to messages that cannot be sent.

- `cs.smsConsent === false` now removes the box. **Undefined keeps today's behaviour exactly**, so
  no client page changes; it is opt-OUT precisely because removing Stencil & Thread's filed
  wording would be a compliance regression on a paying client. A mutation that forces the gate off
  fails by name on their page.
- 🔴 **The consent RECORD goes with the box.** The submit script sends `consentDisclosure`, a copy
  of the exact words shown, so a lead carries proof of what its person agreed to. With no box there
  were no such words, and sending them anyway would file a record saying a disclosure was made that
  the visitor never saw — the same falseness the original note rejects, arriving from the other
  direction. The script's read is already guarded (`sc&&sc.checked`) so the missing box cannot
  throw, and that guard is asserted.

**Flip `smsConsent` back on for BoldLine only when A2P registration is actually complete**, and
word it from the filing, not from us.

## Still to do

1. The existing **Page Options** card scoped to a page, so each audience gets several candidates to
   choose between. `landingPages[].variants` already exists for exactly this.
2. Campaign creation pointing an ad at a chosen page.
