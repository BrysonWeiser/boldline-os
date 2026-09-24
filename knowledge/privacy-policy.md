---
name: privacy-policy
topic: Marketing site
task: change the marketing site's privacy policy, or add/remove any analytics, pixel or tracking tag on boldlinemedia.com
keywords: [privacy policy, privacy.html, tracking disclosure, meta pixel disclosure, google analytics, microsoft clarity, google ads conversion tag, cookies, opt out, gaoptout, my ad center, ad preferences, activity from other businesses, third-party advertising, cross-site tracking, attribution.js, verify-privacy-disclosure]
status: verified
summary: Until 2026-09-24 the policy said "We do not run third-party advertising or cross-site tracking" and "only the minimal cookies needed", while every page loaded Google Analytics (G-MG7T0687RT) and Microsoft Clarity and /get-started loaded the Meta Pixel and a Google Ads conversion tag (AW-18269689296). Meta's terms require the pixel to be disclosed. Rewritten from the actual scripts, with a new "Analytics and advertising tools" section, honest cookie and sharing language, and working opt-outs. 🔴 `tests/verify-privacy-disclosure.mjs` DISCOVERS the trackers from the pages and fails if one is not explained, if a "Get Started page only" or "we don't send your email" claim stops being true in code, or if the old false sentences return. Adding a tag to the site now means updating this policy or the build fails.
verified: 2026-09-24
---

## What the site actually runs (verified against the HTML, 2026-09-24)

| Tool | Where | What it sends | Loads |
|---|---|---|---|
| **Google Analytics** `G-MG7T0687RT` | every page (index, get-started, privacy, terms, 404) | page views, source, rough location; a `generate_lead` event on /get-started | deferred until first interaction or idle |
| **Microsoft Clarity** `y0tivdizq8` | every page | clicks, scrolling, mouse movement, session replay | deferred, same loader |
| **Meta Pixel** `2164699294444030` | /get-started ONLY | PageView on load; `Lead` or `Schedule` on a form or booking | immediately on that page |
| **Google Ads conversion** `AW-18269689296` | /get-started ONLY | `conversion` on a booking (label `J15GCPmVnuEcENCr1YdE`) or form | with the deferred gtag loader |
| **attribution.js** (first-party) | index, get-started | ad click ids (gclid, fbclid, msclkid, ttclid...) + UTMs + landing page, kept in `sessionStorage` for the visit and sent with any form | deferred |
| **Calendly** widget | index, get-started | its own booking iframe, own cookies | on page |

🔴 **No personal details go to Meta or Google.** The pixel is initialised with no advanced matching
and the Google Ads conversion carries no `user_data`. The policy SAYS so, which makes it a claim a
code change can falsify, so the test checks the code for both.

## What the policy now says

- **Information we collect** names the free Lead-Leak Check (website address included) and a new
  bullet, *Which ad or link brought you here*, for attribution.js.
- New **Analytics and advertising tools** section: one plain-English list item per tool, where it
  runs, what it tells us, cookies, and for Meta that it can connect the visit to a signed-in
  Facebook or Instagram account.
- **How we use**: adds measuring which ads and pages bring in enquiries. The old *"we don't share it
  for others' advertising"* is replaced by an honest line: we don't sell it, and the Meta and Google
  tools do send those companies information about the visit.
- **How we share**: adds Google (Analytics, Ads, and PageSpeed Insights for the free check), Microsoft
  (Clarity), Meta (pixel), and **Anthropic** (the AI that reviews the website someone asks us to
  check). Notes that Meta and Google also use tag data under their own policies.
- **Cookies**: says what actually sets them. The old text promised to update the policy "if we add
  website analytics", which had already happened.
- **Your choices**: opt-outs. Browser cookie settings; Google's
  [opt-out add-on](https://tools.google.com/dlpage/gaoptout); Google
  [My Ad Center](https://myadcenter.google.com/); Meta: Accounts Center → Ad preferences.
  🔴 **Meta retired the "Your activity off Meta technologies" setting in June 2026** in favour of
  "activity from other businesses", so the policy names Ad preferences and links Meta's help page
  rather than a deep link or a setting name that no longer exists.
- The **Text messages** section added the same day for carrier texting registration is untouched
  (KB `cold-call-phone-number`).

## 🔴 The rule going forward

**Adding or removing any tag on the marketing site means editing this policy in the same change.**
`verify-privacy-disclosure` will fail otherwise, by design. It finds trackers from the pages
themselves, not from a list, because a hand-kept list goes stale in exactly the way the old policy did.

**Mutation-tested (13):** tool paragraph deleted (caught only after the check was scoped to the tools
section; the first version passed because the name still appeared in the cookie and sharing lists),
old false sentence restored, opt-out link broken, em dash in copy, Text messages section removed,
pixel or Google Ads tag added to the homepage, advanced matching or enhanced conversions added,
Clarity removed from one page, and Clarity removed from every page while still described. One
survivor was a bad mutation that left `fbq('init'` in place, so the pixel was genuinely still there.

Checked at 390/768/1280/1600 served over HTTP (a `file://` render is unstyled because the site's
stylesheets load from the root, which looks like a bug and is not one).

**Not fixed, noticed in passing:** `marketing-site/attribution.js` is served publicly with its full
internal comment block (names, dates, internal notes). `verify-public-source` polices HTML comments,
not JS files. Worth stripping in its own change.
