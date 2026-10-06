---
name: website-builder
topic: OS app
task: build, preview, edit, publish or debug a client website made by the OS (the website service), or change its designs, pages, motion, 3D or copy writer
keywords: [motion recipe, motionRecipe, motionSeed, try different animations, portal scene, rail scene, stack scene, lenis, smooth scroll, water caustics, liquid chrome, silk, topo, glSceneFor, website builder, client website, site-render, renderSite, site.mjs, site-build-background, siteJob, website tab, cinematic, aurora, editorial, webgl, glass orb, shader, word fill, marquee, preview key, /site/slug, five pages, home services about reviews contact, pexels background photos, website service, $1500, website preview]
status: step 1 built (builder + OS tab + serving) + animation upgrade (per-client motion mix, trade-matched 3D) live 2026-10-06; steps 2 (package/contract/billing) and 3 (custom domain) not built
summary: Step 1 of the website service, built 2026-10-06, plus the same-day animation upgrade. The OS writes a client's 5-page site (Home, Services, About, Reviews, Contact) with Claude, picks Pexels background photos until the client sends real ones, and renders it in one of three designs (Cinematic, Aurora, Editorial) the client picks from preview links. Every client gets its own MIX of motion (headline entrance, one big scroll scene, reveal style, page transition, strip) from a library, and a 3D backdrop matched to their trade (water, chrome, silk, contour lines, liquid light); the three designs one client sees never share a scene. Served at /site/<landingSlug>/ once "Put it live" is pressed. All motion is layered on after the page is usable and drops out for reduce-motion, Data Saver, slow and small-memory phones. 83 checks, 12 mutations caught; driven at four widths.
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

## 🔴 The motion system (animation upgrade, 2026-10-06)
Bryson: *"unique, luxury, and immersive"*, *"make sure we aren't only ever using the same animation like how it
went through the window"*, *"don't use to much motion but also don't use to little basically using it at the
right times"*. `motionRecipe(cl, theme)` in site-render picks, seeded from the client id (or
`website.motionSeed`), one of each:
| Slot | Options | Notes |
|---|---|---|
| entrance (hero headline) | rise, chars (letter by letter), focus (blur to sharp), wipe | |
| scene (THE one big home scroll moment) | **portal** (photo window behind the business name in huge type, you scroll INTO it, the Jesko move), **rail** (services pinned and scrolled sideways, 900px+ and 3+ cards only), **stack** (service cards stack and dim as you scroll) | one per home page, never two |
| reveal (sections) | rise, clip (photos wipe up), soft (fade + slight scale) | no blur on reveals (costly on phones) |
| transition (between pages) | veil (fade), curtain (accent panel sweeps up) | arrival only after an internal click |
| marquee | drift (CSS), velocity (speeds up and skews with scroll) | |
| fill / cursor | word-by-word story light (home or About), cursor ring (mouse only) | |
The three designs for one client never share a scene or an entrance (one shuffle per client, indexed by
design), so the 3 preview links always show 3 different experiences. OS button **"Try different
animations"** (Pick a design card) stores a new `website.motionSeed` = a new mix for all three; words,
photos and the chosen design stay.
Also everywhere (quiet, "right times"): button labels roll up on hover, magnetic buttons, gentle tilt on
cards/photos (mouse only), steps draw a line as you pass them, Services page has a photo that follows the
pointer down the list (mouse only), smooth scrolling (Lenis 1.3.26 from jsdelivr, pinned by sha384
integrity, mouse + not Data Saver only).
**3D backdrop matched to the trade** (`glSceneFor`, plain WebGL1, no library): water caustics (pools,
plumbing, cleaning), liquid chrome (auto, detailing, metal), silk (chiro, wellness, med/day spa, salons,
dental), contour lines (roofing, landscaping, construction, real estate, trades), liquid light (anything
else). Aurora shows it full screen (darkened behind the headline); Cinematic shows it through the glass orb
(muted outside the orb); Editorial has none. Stops itself if a device can't keep up (more than half of the
first 120 frames slow). Shader rule: never a reversed `smoothstep(a,b,x)` with a>b (undefined on some GPUs).
**AI tells removed** (frontend-design skill review): no all-caps eyebrows, no `[01]` numbering on things that
aren't a sequence, no monospace, no italic accent word. Aurora default accent amber `#E8A15B` (was acid
green), fonts Bricolage Grotesque + Geist; Editorial is paper white + Fraunces + Instrument Sans with a
drawn underline under the last headline word.
🔴 **Gotchas found while building, keep them:** (1) CSS specificity: hidden states carry
`body[data-in]`/`body[data-rv]`, so "shown" rules must be `html.mo body .rv.in` etc., or the hero stays
invisible (it did, once). (2) Headline lines must be joined with a space, or without the script
"better.Feel" runs together. (3) `.btn` needs `white-space:nowrap` or phone pill buttons wrap.

## The three designs (from his two references, jeskojets.com and inthebrandlab.com)
| | Look | Motion / 3D |
|---|---|---|
| **Cinematic** | light, Archivo Expanded at huge sizes, two-part hero (line A top left, line B bottom right) | WebGL **glass orb** that tilts toward the pointer, showing the trade's 3D backdrop inside it |
| **Aurora** | dark, Bricolage Grotesque, eyebrow pill, centered hero, marquee strip | the trade's 3D backdrop full screen |
| **Editorial** | paper white, Fraunces serif, drawn underline, photo-led hero | no WebGL (deliberate); tilt on the hero photo |
Motion per client: see the table above. Header hides on scroll down, floating pill CTA (Book + Call).
Brand color = website.brandColor, else the landing page's, else the design's default.

## Rules enforced by tests/verify-site-builder.mjs (and verify-preview-safety "Website preview")
- 🔴 Fast first: content visible without script (every hide-until-revealed rule is parsed out of the CSS and
  must sit under `html.mo`/`html.js`; the page body is never hidden); the script removes its classes if it
  throws; reduce-motion never gets `mo`; every scroll scene has a plain layout and still shows every service.
  WebGL waits for idle, skips reduce-motion / saveData / deviceMemory<4 / no WebGL, pauses offscreen and
  in hidden tabs, and stops on slow devices. Lenis only with its integrity hash.
- 🔴 Variety: every option of every slot is used across 300 fake clients; one client's 3 designs never share a
  scene or entrance; exactly one big scroll moment per home page.
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
- ✅ DECIDED (Bryson, 2026-10-06): the second half is due BEFORE it goes live. "Put it live" stays locked
  until the final payment arrives. The $99/mo care plan starts at launch.
