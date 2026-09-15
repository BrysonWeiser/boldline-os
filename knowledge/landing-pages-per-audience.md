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

## Are the pages original, or made from references? (2026-09-15)

Bryson: *"just make sure that the landing pages are original and arent made from references."*
Checked rather than asserted:

- **No example page, competitor page, reference or sample copy is ever put in front of the
  writer.** Searched the whole generator for it; there is none.
- **The only external content it can pull is a website scrape**, and that is the CLIENT'S OWN
  site, used to read their brand colours. The audience payload sends **no `website`**, so nothing
  is fetched for BoldLine's pages.
- **Each call is stateless and receives only what the caller sends.** For an audience page that
  is BoldLine's own name, the audience label, his own campaign setup, brand voice and media
  library, plus a seed and the OTHER audience pages' angle and layout NAMES so it avoids
  repeating them. No other client's data can reach it.
- 🔴 **One canned thing was found and fixed.** The five `ANGLES` are a fixed creative brief shared
  by every page, which is legitimate (they are directions, not content) — except one read *"Lead
  with the specific OFFER or the free quote as the hook"*. A local service business's assumption,
  reaching every page written from that angle. Now neutral wording, and pinned.

## 🔴 Nothing is said twice

*"also make sure information isnt listed twice."* True of **every page this renderer has ever
produced**, not only the new ones:

| Repeated | Where |
|---|---|
| A client's town | trust row, chip row AND footer |
| "Fast response" | trust row and chip row |
| A benefit bullet | trust row and the benefits section |
| "Free plan, no obligation" | both rows of an audience page (my own defaults) |

**One `dedupKey` and one running `said` set**, shared by the trust row and the chip row. Writing a
second copy for the chips was the same mistake in miniature, and the first attempt did exactly
that before it was consolidated. Bullets are seeded into the set first, because a bullet has room
to explain itself and a chip does not.

🔴 **Matched on EXACT normalised equality, never a substring.** Lowercase, strip the tick and a
leading "Serving", drop punctuation. Enough to see "Eugene, OR" and "Serving Eugene, OR" are one
fact, and deliberately too strict to notice "Free quotes" and "Free quote, no obligation" are
nearly one: **dropping a line off a live client's page because it merely RESEMBLED another is a
worse failure than printing one twice.** Both behaviours are asserted.

**Two more hard-coded local-service lists found on the way**, both now overridable with the
defaults unchanged: the how-it-works steps (*"Get a fast, free quote"*) and the three lines beside
the form (*"We'll reach out fast with your free quote"*). BoldLine does not quote, it plans.

## 🔴 Two more checks that were pinned to a line's SHAPE

Both in `verify-market-research`, both about the landing page, both broken by restructuring a line
whose RULE never changed:

- the trust row carries no emoji — matched `/const trustBits = \[/` on the source
- a national business is not given a town — matched the exact markup of a ternary

Both now **render pages and read the result**. The second one also had a broken fixture:
`NATIONAL_MARKETS` is a list of cities to research, not a national signal, so the "national" page
was actually local and the check passed on nothing. Both were mutation-tested afterwards.

## 🔴 THE FURNITURE HAS TO TRAVEL WITH THE PAGE OBJECT, NOT BE PAINTED ON AROUND IT

Bryson, screenshotting the **options card**: *"the landing page is still duplicating data."* The
option previewed with `MARKETING AGENCY` as its eyebrow, **"✓ Free quotes"** in the trust row and
**"✓ Free quote, no obligation"** in the chips. Everything the previous fix had removed.

**Because a variant REPLACES `landingPage` wholesale.** `LandingPreview` renders
`{...client, landingPage: overrideLanding}`, and a variant carries only the words the writer
produced. So the furniture, which had been applied when the LIVE page was assembled, was simply
not on the object being rendered, and the renderer fell back to its local-service defaults with
the eyebrow reading `cl.niche`.

🔴 **And it was not only a preview problem.** `blApplyVariant` writes the chosen variant as the
live page, so pressing "Use this one" would have published the undressed version too. Decorating
the preview alone would have shown him one page and published another.

**Fixed by putting the furniture ON the object at CREATION.** `audienceFurniture(label)` is now one
exported function, and every variant is dressed with it the moment it is built — the three
options, a rewritten one, and a blend. Preview and apply then agree by construction rather than by
being decorated in two places.

**Four places need it and three are not the live page:** the OS preview, the three written
options, and whichever option is chosen. That is why it is one function rather than an inline
literal, and why the OS's single mirror is now compared to the server's **field for field across
several labels** rather than only through `previewClient`.

Mutations caught: options written undressed, a rewritten option losing it, the OS furniture
drifting from the server's, and the server dropping a field the OS still sets.

**A wrong-component assertion, caught by its own failure.** The first version of the
"options carry the furniture" check searched `AudiencePagesCard` for a helper that lives in
`LandingOptionsCard`, and failed on code that was perfectly correct. Same shape as the bug that
shipped Deal Prep broken (KB `deal-prep-to-client`): assert against the component that actually
holds the code.

## 🔴 EVERY DEFAULT ON THESE PAGES IS A CLAIM, AND ONE OF THEM WAS FALSE

Bryson: *"make sure its also truthful it says no long contracts but there is a 3 month minimum
when you first sign on."* He is right and it is the most serious thing found in this whole
sequence. The chip read **"No long contract to start"** on a page BoldLine pays for clicks to,
while the agreement carries a **three month minimum** — the marketing site's own FAQ is headed
*"Why is there a three month minimum to start?"*.

Not a wording quibble. A prospect reads it, books a call on that basis, and finds out on the call.
That costs the call and the trust, and it is the kind of thing that gets an ad account complained
about.

**First fix: "Three months to start, then month to month"**, which is what the site's FAQ says.
Checked against the source rather than written from memory.

**Then Bryson changed the call:** *"how about we just avoid talking about the contract periods
instead put a different reason for working with me."* He is right, and it is a sharper read than
the first fix. The line was true, but it spent the hero's best line answering an objection the
visitor had not raised yet, and on a cold ad click the first thing you volunteer is the thing you
look worried about. The term belongs on the call, where it can be explained. **Saying nothing
about the term is not a claim about it. Claiming there is no contract was**, which is why the
original guard stays exactly where it is.

**Now: "Your ad account stays in your name."** Chosen because it is the one thing BoldLine does
that most agencies do not, and because it is a **hard rule of the business rather than a promise
someone can quietly stop keeping** (CLAUDE.md: *"Each client's ad account stays owned and billed
by the client; BoldLine only ever holds manager-level access"*). Plenty of agencies hold the
account and the client discovers it on the way out the door. The site says the same thing in two
places, and the test reads the site, so the page and the site cannot drift apart on it the way
they nearly did on the contract term.

Rejected: *"your budget never rises without your say-so"* (true on the site, but nothing in the
autopilot code enforces it as an invariant, so it is a promise resting on behaviour) and *"we
never touch your ad spend"* (true, but it names a risk the visitor was not thinking about).

Also fixed: a step read *"Ads go live and the calls come to you"*, promising a phone call when
most leads arrive as a form.

🔴 **Why this needed a guard and not just a fix.** These defaults are the only copy on these pages
that **no human writes and no model writes**. Nobody proof-reads them, so an untrue claim can sit
there for months. `verify-landing-pages` now fails if any default contains *no long contract, no
contract, cancel anytime, no commitment, no minimum, quit anytime*. After the change above it
**also** fails if any default mentions the term at all (*contract, minimum, three months, month to
month*), fails if the ad-account promise disappears from the trust row, and fails if the marketing
site stops making that promise. Note the two guards are deliberately **both** kept: the page may
not deny the term, and it may not debate it either. A half-fix that only deleted the old guard
would have reopened the door to the exact copy Bryson caught.

**Mutation-testing note worth keeping:** the first run of these mutations changed only the server
mirror, so the **preview-parity check fired first and masked whether the truthfulness checks
worked at all**. Four mutations, four identical failures, none of them from the assertion under
test. Mutate BOTH mirrors, or the parity check hides everything behind it.

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

## 🔴 POINTING AN AD AT ONE OF THEM (2026-09-15)

Bryson: *"when i make the ads and i want to select the landing page i said to use how do i do
that?"* Honest answer at the time: **he could not.** Both launch cards carried a bare text box
("Landing / final URL") pre-filled with the account's single page, so using an audience page meant
leaving the screen, copying the address, coming back, and pasting it. On his own account the box
pre-filled with `HOUSE_LANDING_URL` (`/get-started`), so every campaign he built started aimed at
the wrong page and stayed that way unless he remembered, every single time.

**Now:** `LandingTargetPicker` sits directly under that field in **both** `GoogleLaunchCard` and
`MetaLaunchCard`, as a row of pills — *Main page* plus one per audience page. Picking one writes
the address into the same field, so nothing downstream changed and the field is still typeable.
The component and its helpers (`audienceTargets`, `sameUrl`/`tidyUrl`, `deadAudienceTarget`,
`AUDIENCE_PAGE_BASE`) live immediately above `GoogleLaunchCard` in `index.html`.

🔴 **The part that costs money is the guard, not the picker.** `landing.mjs` serves the real page
only when it is **published AND has a headline**, and returns a coming-soon holder otherwise. An ad
pointed at such an address looks completely correct in the OS, in the ad, and in the campaign
report, and every click it buys lands on a placeholder. So:

- `live` checks **both** flags, not just `published`. The published-but-empty page is the easy half
  to forget.
- A page that is not live is **greyed out and labelled "not live yet"**, with the reason on hover.
- `deadAudienceTarget` runs in **both** `launch()` bodies at **spend time**, not just at pick time.
  Greying out a button does nothing about a pasted address, a page unpublished *after* the draft
  was written, or a draft auto-saved and reopened next week. The refusal names the page and says
  how to fix it.
- Addresses compare tidied (trailing slash, case, surrounding space), because the paste path is
  exactly the one the picker cannot police. **Blank does not match blank**, or an account with no
  main page lights up the *Main page* pill.

**`tests/verify-landing-target.mjs` (52 checks).** The helpers and both real `launch()` bodies are
extracted from `index.html` and RUN. The "live" rule is cross-checked by **lifting the real publish
gate out of `landing.mjs` and executing it**, page shape by page shape, rather than restating the
rule in the test — a test that restates the rule it is testing passes forever while the two drift
apart. Two further checks prove the server both withholds some pages and serves others, so the
agreement cannot be vacuous. **7/7 mutations caught**, including removing the guard from one card
and leaving it on the other.

🔴 **Two extraction anchors broke, and one of them is a lesson.** `verify-group-picker` built
`launch()` in a scope that did not contain the new helper, so the harness became **more permissive
than the real page**; fixed by handing it the REAL helper, not a stub returning null (a stub would
pass forever and hide the day the refusal starts firing wrongly). And `verify-draft-persistence`
sliced *"from `useSavedDraft` to `function GoogleLaunchCard(`"*, so inserting anything between them
swallowed its JSX and died with a syntax error pointing at code it had no business reading; it now
anchors to the hook's own closing brace. **Slicing to "whatever function is declared next" is a
trap** and there are more of them in `tests/`.

Responsive: checked headlessly at 390/768/1280/1600 by compiling the real component with Babel and
rendering it. No horizontal scroll, no pill spilling its card; the row wraps 4 rows / 2 / 1 / 1.

## Still to do

1. The existing **Page Options** card scoped to a page, so each audience gets several candidates to
   choose between. `landingPages[].variants` already exists for exactly this.
