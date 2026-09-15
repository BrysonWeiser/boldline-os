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

## 🔴 "It still looks the same": the right lever was one we already had

Bryson, twice: *"it looks exactly like the landing page for stencil & thread ... no matter what
each landing page should not just be a copy and paste they should be unique"*, then *"the page
itself still looks exactly the same"*, then the question that contained the answer: *"what
happened to what we made a while ago where we get 3 different versions of the same landing page
and I can choose one or modify them as i want."*

**Two wrong diagnoses before the right one, both worth keeping.**

1. **Design tokens.** `designConfig` prefers `landingPage.design` and otherwise seeds off the
   slug. The single-write path asks the model the same question every time, so every page came
   back `split/glowgrid/up/cards/modern/rounded/a`. The first fix **stripped `design`** so the
   seed decided. It worked, and it was the wrong lever.
2. **The skeleton, which is the honest answer to "looks the same".** Rendering S&T's page beside
   an audience page shows different tokens and an **identical section order**: hero, chips,
   why-us, how-it-works, form, footer. Seven style switches do not change the bones. A page from
   this renderer will always broadly resemble every other one, and no token shuffle fixes that.

**What actually varies a page is the ANGLE, and that mechanism already existed.**
`generate-landing`'s `planOptions` writes three options with deliberately different angles AND
different layouts, taking `seed` and `exclude` so more options explore new ground. That is KB
`landing-page-options`, built 2026-09-01 — and it was rendered as
`{!client.internal && <LandingOptionsCard .../>}`, **so Bryson had never once had it on his own
account.** He was asking where it went; it had never been there.

🔴 **So the design strip was reverted**: a page built from a CHOSEN option carries the layout he
picked, and stripping it would silently discard exactly that. Instead:

- **The single write now passes `seed` and `exclude`** (the other audience pages' angles and
  layouts), the same two arguments the options flow has always sent.
- **`LandingOptionsCard` is mounted per audience page.** It needed no changes to work: it reads
  `landingPage` + `landingVariants` and writes them back through `onUpdate`, so it is handed
  `previewClient(client, p)` — the same shim the preview uses, so what it thinks is live is what
  is live — and its writes fold into `landingPages[]`.
- **It takes an `audience` prop**, because `brief()` sent `niche`, and `niche:"Roofers"` writes a
  page advertising roofing to homeowners. Same word, opposite page. Absent, it behaves exactly as
  it did for clients.

Mutations caught: the card removed, the audience prop dropped, the seed dropped, the exclusions
dropped, `niche` sent instead of `audience`, and the design strip reinstated (caught by the
preview-parity check, from the other side).

## 🔴 THE FURNITURE WAS A LOCAL SERVICE BUSINESS'S, AND NO OPTION COULD CHANGE IT

Bryson: *"its still sort of using stuff from stencil & threads landing page such as the free quotes
with the checkmark, the very top of the page there is a bar that includes what it is."* Right, and
this is the part none of the previous three attempts could have touched, because **the renderer
builds it, not the writer**:

| Built in code | Was |
|---|---|
| Announcement bar | the account's `campaignSetup.mainOffer`, printed across the top |
| Eyebrow | `niche` or "Trusted local service" / "Marketing that brings you customers" |
| Hero trust row | service area · **"✓ Free quotes"** · "Fast response" |
| Chip row | **"Serving <town>"** · differentiator · **"✓ Free quote, no obligation"** · "Fast response" |

Two pages carrying all four read as the same page however different the words between them.
**BoldLine does not do quotes, does not serve a town, and has no fast-response promise to make.**

A page may now carry `eyebrow`, `trust[]`, `chips[]` and `announce`. **Absent, every default is
exactly what it was**, so no client page moves; `announce: ""` means "no bar", which is distinct
from having said nothing (absent still falls back to the main offer). `clientForPage` supplies
BoldLine's, **keyed to the audience** so the roofers page and the detailers page do not say the
same thing: eyebrow "For roofers", chips "Built for roofers · ✓ Free plan, no obligation · No long
contract to start". A page that writes its own keeps its own.

Both directions are asserted: BoldLine's page contains none of the four phrases, and Stencil &
Thread's still contains all of them including their offer bar.

**A check that was pinned to a line's shape, fixed on the way.** `verify-market-research` asserted
the trust row carried no emoji by matching `/const trustBits = \[/` on the source. That stopped
matching the moment the line no longer started with a `[`. It failed loudly rather than passing,
which is the right way round, but it was pinned to the shape of a line of code rather than to the
rule. It now **renders three pages and checks the actual trust row**, and still fails when an emoji
is put back.

**Process note worth keeping:** mutation testing in this repo restores by copying a `.bak` back.
Using `git checkout -- <file>` instead **silently discarded uncommitted work** on that file, and
the `|| cp` fallback never ran because the checkout succeeded. Restore from the backup, never from
git, while a change is uncommitted.

**Still true and not yet addressed:** the section skeleton is one template. If the pages still read
as siblings after choosing distinct angles, that is the thing to change, and it is a renderer
change rather than a prompt one.

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

## 🔴 THE PREVIEW IS THE ONLY THING HE SEES, AND IT WAS BUILT SEPARATELY

Bryson, after both fixes above shipped: *"the landing page still looks the same make sure its
fixed."* The live page WAS fixed. **The preview was not, so to him nothing had changed.**

`LandingPreview` POSTs the client object to `/.netlify/functions/landing` and **the server renders
exactly what it is sent**. The router path calls `clientForPage`; the preview path never did. It
built its own object inline, so it kept the writer's `design` (identical furniture on every page)
and missed `smsConsent: false` (the text-consent box the live page no longer carries).

🔴 **This had already been wrong once, for the same reason.** The brand fix a few hours earlier
patched `brandColor`/`brandTheme` into that inline object rather than making the preview use the
real transform. **Patching it field by field is what allowed the second miss.**

**Now:** one `previewClient(cl, pg)` mirror inside `AudiencePagesCard` (the OS is a single browser
file and cannot import the shared module), and `verify-landing-pages` **executes that mirror and
deep-compares it against `clientForPage`** across several page shapes. A field added to either and
not the other fails, whatever it is. A second assertion proves the comparison can actually fail, by
running a deliberately drifted version — a `deepEqual` that cannot fail is the same shape of
nothing as the per-field assertions it replaced.

Mutations caught by that one check: the preview keeping the writer's layout, missing the consent
flag, drifting back to indigo, **and a change made on the SERVER side** that the OS did not follow.

**The general rule:** when a preview is built by different code from the thing it previews, the
preview is a second implementation and will drift. Either share the code, or compare the two by
running them.

## Still to do

1. The existing **Page Options** card scoped to a page, so each audience gets several candidates to
   choose between. `landingPages[].variants` already exists for exactly this.
2. Campaign creation pointing an ad at a chosen page.
