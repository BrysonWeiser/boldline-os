---
name: website-builder
topic: OS app
task: build, preview, edit, publish or debug a client website made by the OS (the website service), or change its designs, pages, motion, 3D or copy writer
keywords: [website builder, client website, site-render, renderSite, site.mjs, site-build-background, siteJob, website tab, cinematic, aurora, editorial, webgl, glass orb, shader, word fill, marquee, preview key, /site/slug, five pages, home services about reviews contact, pexels background photos, website service, $1500, website preview]
status: step 1 built (builder + OS tab + serving); steps 2 (package/contract/billing) and 3 (custom domain) not built
summary: Step 1 of the website service, built 2026-10-06. The OS writes a client's 5-page site (Home, Services, About, Reviews, Contact) with Claude, picks Pexels background photos until the client sends real ones, and renders it in one of three designs (Cinematic, Aurora, Editorial) the client picks from preview links. Served at /site/<landingSlug>/ once "Put it live" is pressed; drafts only via the site's own preview key. Motion and a WebGL accent are layered on after the page is usable and drop out for reduce-motion, Data Saver and small-memory phones. 49 checks, 9 mutations caught; driven at four widths.
verified: 2026-10-06
---

## What Bryson sees
Client record > **Website** tab (between Reviews and Assets).
1. **Build the website**: about a minute. Writes every page from the client record (niche, services,
   area, offer, differentiator, tone, call notes, qualified-lead definition) and fetches 4 Pexels photos.
2. **Pick a design**: three live thumbnails. "Copy the 3 designs to send the client" copies a message
   with three preview links (`/site/<slug>/?preview=<key>&theme=<id>`) that work while unpublished.
   He marks the one they choose with "Use this one". (Client picks: Bryson, 2026-10-06.)
3. **Edit the words**: brand name, brand color, headline (+ the two Cinematic lines), sub line, button,
   about story, services, hours, public email, Google listing link, and REAL reviews only.
4. **Put it live / Take it offline**, with the live link. Nothing is public until he presses it.
5. Big preview with page tabs and Desktop/Phone; clicking a link inside the preview switches the tab.
Amber note while there are no client photos: ask them to upload in their portal under Assets; their
`photo` uploads replace the background photos automatically (own photos are used first).

## The three designs (from his two references, jeskojets.com and inthebrandlab.com)
| | Look | Motion / 3D |
|---|---|---|
| **Cinematic** | light, Archivo Expanded at huge sizes, two-part hero (line A top left, line B bottom right) | WebGL **glass orb** with fresnel + specular that tilts toward the pointer over a liquid sky gradient (brand tinted) |
| **Aurora** | dark, Inter 800, eyebrow pill, centered hero, numbered `[01]` cards, marquee strip | WebGL liquid aurora in the brand color |
| **Editorial** | warm cream, Fraunces serif with an italic accent line, photo-led hero | no WebGL (deliberate); parallax photo, drawn rules |
All: staggered blur-in headline, scroll reveals, story paragraph that lights up word by word (Jesko),
magnetic buttons and 3D tilt cards (fine pointers only), header that hides on scroll down, floating
pill CTA (Book + Call), page fade transitions, marquee. Brand color = website.brandColor, else the
landing page's, else the design's default.

## Rules enforced by tests/verify-site-builder.mjs (and verify-preview-safety "Website preview")
- 🔴 Fast first: content visible without script (hidden states only under `html.js`); WebGL waits for
  idle, skips reduce-motion / saveData / deviceMemory<4 / no WebGL, pauses offscreen and in hidden tabs.
- 🔴 Every href absolute (built from an https `base`), tel:, mailto:, or Google. Nothing relative,
  nothing to boldlinemedia.com or the OS. Preview links keep `?preview=&theme=` on every internal link.
- 🔴 Preview frame: `sandbox="allow-scripts"` only; the form checks `about:` BEFORE fetch; in a preview
  every link is intercepted and only postMessages `{blSitePage}` to the OS.
- 🔴 No emojis, no em/en dashes (model output through humanizeDeep, hand edits through humanizeAdCopy),
  no `//` comments in shipped script.
- 🔴 No invented proof: reviews only from `website.reviews` (typed in by hand) or a link to Google.
  The writer prompt forbids invented years, counts, ratings, awards, guarantees, prices.
- 🔴 Health clients: no free-text message box on the form; the writer gets a no-cures rule.
- Unpublished: only with the site's own `previewKey` (never the portal token); `?theme=` only with it;
  an empty stored key never matches. Billing-paused clients get a 503 like landing pages.

## How it works
- `netlify/lib/site-render.mjs` `renderSite(cl, page, {base, theme, query, noindex})` returns the whole
  page. `siteContent(cl)` fills safe defaults so a page always renders.
- `netlify/functions/site-build-background.mjs` (POST {clientId}, owner JWT): Claude **claude-opus-5-5**,
  `output_config: {effort:"medium", format: json_schema SITE_SCHEMA}`, refusal fallback
  `betas:["server-side-fallback-2026-07-01"], fallbacks:"default"` (retries without it on a 400),
  writes `data.siteJob` (read-merge-write). Forced tool_choice is NOT used: Opus 5.5 rejects it.
- `netlify/functions/site.mjs`: GET serves `/site/<slug>/[page]/` (netlify.toml rewrites); POST
  `preview` renders for the OS; POST `poll` reads `siteJob`. The OS saves the job's content into
  `website` itself (so a stale browser save cannot lose it after it lands).
- Client data: `website = {content, theme, previewKey, published, brandName, brandColor, stock[],
  reviews[], hours, publicEmail, googleListingUrl, builtAt}`. Uses `landingSlug` as the site slug.
- Env: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, PEXELS_API_KEY (already set on the OS site).
  No new env vars, no table.

## Not built yet (the plan)
- **Step 2, selling it:** a Website package ($1,500 build + $99/mo, 2 edits a month), its own
  agreement section (client owns the domain, gets a copy if they leave), billing, Deal Prep and the
  marketing site. The cross-sell both ways (KB `service-add-ons`).
- **Step 3, their domain:** serve on the client's own domain (Netlify domain alias = a 10pm-reminder
  job), sitemap.xml/robots, and send review emails from their domain (Resend free plan: 3 domains).
- A portal page where the client picks the design themselves (today: preview links + Bryson clicks).
- Rebuilding BoldLine's own site with this engine to the same bar.

## 🔴 2026-10-06 REQUIREMENT: no website is built until the client has SIGNED and PAID (Bryson)
*"make sure that the option to build a website is only available after a client signs the agreement and
pays (I also want to be able to modify the payment as I want and then allow the option for pay half now
half when finished)"*. Not built yet; it lands with step 2 because it needs the website agreement:
- Build button locked until: website agreement signed AND first payment received (Stripe webhook, not a
  checkbox).
- Price editable per client (default $1,500); payment plan per client: in full, or 50/50 (deposit now,
  balance when finished). Stripe invoice with a pay link, metadata `kind: website`, `stage: deposit|final`.
- Proposed (awaiting his answer): "Put it live" stays locked until the final payment arrives; the $99/mo
  care plan starts at launch.
