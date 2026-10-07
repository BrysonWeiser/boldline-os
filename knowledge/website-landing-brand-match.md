---
name: website-landing-brand-match
topic: Working preferences
task: build or change a client's website or landing page, pick colours or fonts for either, add a button label, or check that a business's pages look like one business
keywords: [brand match, same colors, same branding, landing page colors, website colors, siteBrandKit, brandColorOf, kit, fonts, typeface, landing font, website theme, button labels, button text, generic buttons, our services, learn more, send, call now, cta explore, cta send]
status: standing rule
summary: Bryson, 2026-10-07 - (1) a business's website and its landing page must share colours and branding; (2) every button must fit its text and say something specific to that business, not the same copy-pasted label on every site. Built - once a website design is picked, the landing page borrows that website's background, text colours, brand colour, typefaces and corner shape (siteBrandKit); one brand colour rule for both (brandColorOf). Site buttons now come from the writer (cta.explore, cta.send) with fallbacks built from the client's own services. Pinned by verify-brand-match and verify-site-builder.
verified: 2026-10-07
---

## What he said
- *"make sure that the colors for a website and the landing page for the same example company/website have the same
  colors and branding"* (Northline: website dark, red, Bricolage; landing page white, a system font).
- *"make sure every button (for my website and the sample websites and for real client websites in the future) that
  all the buttons actually fit in themselves and make sense and arent just a copy and paste of every other websites
  button"*.

## How it works now
- `siteBrandKit(cl)` in `netlify/lib/site-render.mjs`: null until `cl.website.theme` is a real design; then returns the
  website's bg, bg2, ink, mute, line, accent, typeface link, display/body fonts and radius. `landingTheme(cl)` in
  `netlify/functions/landing.mjs` uses it when present (adds `kit` to the palette); the page then loads the same
  Google Fonts, puts `kit` on `<body>`, and uses the website's corner shape (editorial buttons square, others round).
  **Ads-only clients (no design picked) are untouched**, byte for byte the old look.
- `brandColorOf(cl)`: website editor colour, then the hand-set `cl.brandColor`, then the generated
  `landingPage.brandColor`. Both renderers use it, so they can't disagree.
- Sample landing pages (`LANDING_DEMOS` in `scripts/site-showcase-demo.mjs`) carry their sample website's design.
- Real client effect: any client that has picked a website design AND has a landing page changes look the moment this
  is live. Ads-only clients (Stencil & Thread) do not.

## Buttons
- Writer schema (`site-build-background.mjs`): `cta.explore` (the second hero button, "never 'Our services' or 'Learn
  more'") and `cta.send` (the contact form button). Fallbacks for sites written before: "See all N services" / "See
  what we do" and "Send my request". The form restores its own label after an error (it used to reset to "Send").
- Per-service links: "More on <service>" when the name is 14 characters or fewer, else "See the details". Reviews
  link: "Read all N reviews" / "See the review". Blog: "Read the blog". Landing page call button shows the number
  ("Call (480) 555-0172"), which the capture layout already did.
- The floating bottom bar ("pill"): matches each design's corner shape (editorial square), call button has a phone
  icon and goes icon-only under 380px so the main button never squeezes.
- Checked at 1440, 390 and 320 with a script that flags a button whose text wraps to a second line or spills out.
