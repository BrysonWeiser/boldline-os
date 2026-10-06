---
name: website-builder
topic: OS app
task: build, preview, edit, publish or debug a client website made by the OS (the website service), or change its designs, pages, motion, 3D or copy writer
keywords: [netlify-status, netlifyStatus, own domain, custom domain, web address, domain-set, domain-check, site-domain, NETLIFY_API_TOKEN, domain alias, sitemap.xml, robots.txt, x-site, serveWebsiteOnDomain, website emails, website_welcome, website_payment, website_review, website_live, website_past_due, blog_scheduled, website_monthly, website-monthly-run, enquiry wording, client blog editing, blogEdit, applyEdit, blog-save, portal website tab, site_visits, site-hit, visitor analytics, change request, websiteRequests, portal-website, extra pages, blog add-on, client blog, site-blog, blog articles, site-blog-run, site-blog-write-background, held article, website deal, websiteDeal, website agreement, WA-1, build lock, publish lock, deposit, final payment, care plan, website-deal.mjs, SERVER_OWNED_KEYS, motion recipe, motionRecipe, motionSeed, try different animations, portal scene, rail scene, stack scene, lenis, smooth scroll, water caustics, liquid chrome, silk, topo, glSceneFor, website builder, client website, site-render, renderSite, site.mjs, site-build-background, siteJob, website tab, cinematic, aurora, editorial, webgl, glass orb, shader, word fill, marquee, preview key, /site/slug, five pages, home services about reviews contact, pexels background photos, website service, $1500, website preview]
status: step 1 built + animation upgrade + step 2a (website agreement, payments, build/live locks) + step 2b (Deal Prep, marketing site, cross-sell) + website-only clients + extra pages/blog add-ons + portal Website tab with visitor numbers + client blog editing + website emails live 2026-10-06; step 3 (own domain) not built (package/contract/billing) and 3 (custom domain) not built
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

## 🔴 Step 2a: the website deal (BUILT 2026-10-06): signed and paid before building, paid in full before live
Bryson: build only *"after a client signs the agreement and pays"*, price his to change, *"pay half now half
when finished"*, second half BEFORE going live, $99/mo care from launch.
**What he does** (Website tab, new top card "Website deal"): set Build price (default $1,500), How they pay
(All up front / Half now, half before launch), Care plan $/mo (default $99, 0 = waived) > Save price >
"Read the agreement" (sandboxed preview) > "Send the agreement" (DocuSign). Then nothing until the site
is built: when they sign, the watcher sends the first invoice BY ITSELF (Stripe emails it) and alerts him;
when it's paid, the Build button unlocks (alert). Half plan: once built and approved, "Send the final
invoice"; when paid, "Put it live" unlocks. Putting it live starts the care plan (asks first). Card on
file (ads billing or portal) = charged monthly automatically, otherwise Stripe emails a monthly invoice.
"Cancel it to change the price" voids an unsigned envelope in DocuSign (only recorded once DocuSign
confirms). "Copy pay link" / "Send it again" (voids the old invoice so nobody pays twice).
**How it works:**
- `netlify/lib/website-deal.mjs`: terms, amounts (half: deposit takes the odd cent), `buildLock`,
  `publishLock`, `nextStep`, the agreement HTML (`WA-1`, no dashes, client owns domain + gets a static
  copy on exit, 2 revision rounds, 14-day first version / 60-day refund right, 60-day silence closes it,
  care cancel 30 days, offline at 15 days overdue, liability = 12 months fees, AZ law + AAA), the DocuSign
  decision, the Stripe event decision, `createWebsiteInvoice` (Stripe invoice: send_invoice, 7 days,
  card + ACH, `pending_invoice_items_behavior: exclude` so parked lead fees are never swept in, metadata
  `kind: website, stage: full|deposit|final`) and `startCarePlan` (subscription, metadata kind website,
  stage care). DRAFT FOR ATTORNEY REVIEW like the ads agreement.
- `netlify/functions/website-deal.mjs` (owner): set-terms / preview / send / void / invoice / launch / sync.
  Every write re-reads the client first and writes only `websiteDeal` (+ a commLog line).
- 🔴 `cl.websiteDeal` is SERVER-OWNED: index.html `SERVER_OWNED_KEYS` makes every OS save re-read the
  DB copy of it (and write nothing if that read fails), so a stale screen can never write "unpaid" back.
- 🔴 Locks enforced server side: site-build-background returns 409 while `buildLock`; site.mjs `gateView`
  hides a "published" site from the public until `publishLock` clears (preview links still work, so the
  client can approve before paying the balance). House account (`internal`) is exempt.
- stripe-webhook: website money (`kind: website` on the invoice, or on the subscription via
  `subscription_details`/`parent.subscription_details`) is handled BEFORE the ads patch and touches only
  `websiteDeal` (never billingStatus, never a late-payment pause). No new Stripe events needed.
- docusign-watch: a second pass for website envelopes; on "completed" saves the signature AND the first
  invoice in one write; Stripe failure = yellow alert "send it from their Website tab". A per-run `latest`
  map keeps passes from overwriting each other's saves (the input rows are never mutated).
- `$0` build price = unlocks on signature alone. Website deals do NOT count as founding clients
  (`contractSigned` is untouched).
- Tests: tests/verify-website-deal.mjs (98 checks, 15 mutations caught), preview-safety row "Website
  agreement preview" (sandbox=""). Browser-driven at 390/1280 in three states.
- Not yet: a stored copy of the signed website PDF (DocuSign keeps it; the ads archive pattern could be
  reused), a portal view of the website deal, and the static-files export promised on exit.

## Step 2b: selling it (BUILT 2026-10-06)
- **One price list:** `WEBSITE_OFFER` in netlify/lib/pricing-shared.mjs ({build 1500, care 99, pages 5,
  carePlanEdits 2, revisionRounds 2}). The agreement defaults, the OS (mirror `WEBSITE_OFFER` in
  index.html), Deal Prep and the marketing site all read it; tests pin every copy to it.
- **Deal Prep:** the research prompt gets `websitePromptBlock()` (prices, payment rules, WHEN to pitch,
  and "do NOT pitch it when their site is genuinely good") and must output a second header line
  `WEBSITE: yes|only|no` (parsed by `parseWebsiteLine`, stored as `result.recommendWebsite`) plus a
  **Website** section. Under every brief, `DealPrepWebsite` shows the offer with a badge (Pitch it too /
  Pitch this instead of ads / Their site looks fine) and an only-you-see-this talk track both ways.
  Older briefs (no verdict) just show the offer.
- **Cross-sell, ads to website:** `WebsiteUpsell` on the client Overview for a SIGNED ads client with no
  website deal and no built site; "Set it up" opens the Website tab; "Not now" hides it 60 days
  (`websiteUpsellHiddenAt`, browser-owned). Website to ads lives in the Deal Prep talk track.
- **Marketing site:** new `#websites` section on the homepage between Services and "Every Engagement":
  what's included, the both-ways pitch, $1,500 / $99/mo, Book a Call. 🔴 NOT a tab of `.pkg` cards and
  its button is `.wo-cta`, not `.pkg-cta`: verify-site-matches-packages maps every .pkg card to an ads
  package, and verify-meta-flip counts `.pkg-cta` per panel (a `.pkg-cta` here was counted into the
  e-commerce panel and failed it). /get-started (BoldLine's own ad landing page) is left single-goal.
- ✅ **Website-only clients (BUILT 2026-10-06).** Package `w-site` ("Website Only", `pricingModel:
  "website"`), defined beside the house package and NOT in PACKAGES_DB (never on the site, in the ads
  catalog checks, or an upgrade target). `isWebsiteOnly(cl)` is the switch: getAlerts returns
  `websiteOnlyAlerts` only (no intake / renewal / billing alerts), the ads tabs (campaign, pipeline,
  reviews, package, competitors, contract, emails, reports) are hidden, the client opens on its Website
  tab, the Overview is `WebsiteOnlyOverview` (status tiles + "Offer them ads": pick a package, confirm,
  packageId switches, ads tabs appear, website deal untouched), `buildBots` returns none. Created from
  Add Client (new "Website only" tab, saves in one step) or Deal Prep (option at the top, default when
  the brief said `WEBSITE: only`), with NO ads contract dates. Server jobs already skip them because
  they never get `contractSigned`/`contractStatus: active` (that is the ads agreement).

## Add-ons: extra pages and the blog (BUILT 2026-10-06)
Bryson: *"what if a client wants to add extra pages such as a blog page? We should charge an extra for blog
page creation and then ai blog post creations"*. Recommended defaults (in `WEBSITE_OFFER`, all editable per
client on the deal card): **extra page $200 each**, **blog $300 setup + $149/mo for ~4 articles a month**.
- **Deal terms** gain `extraPages, extraPagePrice, blog, blogSetup, blogMonthly, blogPosts` (`normTerms`,
  mirrored as `wdNorm`). `buildTotal` = website + pages + blog setup (half-and-half splits the WHOLE
  total); `monthlyTotal` = care + blog. Agreements sent before add-ons read as none. The agreement shows
  the breakdown, a Blog Plan key term and section 7a (client can change/remove/cancel articles; no
  invented facts; no promises; blog needs the care plan). The care subscription gets a second line.
- **Extra pages:** OS "Extra pages · n of N" card: name + one-line brief > "Write this page" >
  site-build-background `{extraPage}` (PAGE_SCHEMA: headline, intro, 3 to 6 sections) > job kind "page" >
  saved to `website.extraPages[{slug,title,brief,content}]`. 🔴 `extraPageRoom` refuses past the paid
  count (server, before any work) and the OS hides the form when full. Slugs can't reuse a main page
  (`RESERVED_SLUGS`). Rendered at `/site/<slug>/<page-slug>/`; nav shows them while the top bar has 7
  links or fewer (else menu + footer only), and a top bar of 6+ links folds into the menu below 1180px.
- **Blog:** articles live in a PRIVATE storage bucket `site-blog/<clientId>/index.json` + `posts/<slug>.json`
  (no table to create; never on the client record, which the OS loads everywhere). `isPublished` = past
  `publishAt` and not held, used by the public site, the OS preview and the portal alike. Daily
  `site-blog-run` (16:05 UTC = 9:05am Phoenix) picks clients where `blogActive` (bought blog, signed, paid
  in full, launched, plan not cancelled) and `nextDue` (spaced 30/N days, never over N in a Phoenix
  calendar month) and starts `site-blog-write-background` with an internal key (sha256 of the
  service-role key, no new env var). The writer (claude-opus-5-5, json_schema POST_SCHEMA, humanizeDeep,
  no invented facts, health rule, avoids repeat topics) saves it with `publishAt` 48h out and alerts
  Bryson. OS Blog card: Read / Hold / Release / Delete (asks) / "Write one now". Routes:
  `/site/<slug>/blog/` and `/site/<slug>/blog/<post>/` (redirects before `/:page/`); a held or future
  article is a 404 publicly; BlogPosting JSON-LD.
- Tests: tests/verify-website-addons.mjs (67 checks, 14 mutations caught). Browser-driven.

## The client portal's Website tab + visitor numbers (BUILT 2026-10-06)
Bryson: *"add a way for the client to view the analytics and other details (in the client portal)"*.
- `netlify/lib/portal-website.mjs` `websitePortalHTML(cl, {siteUrl, stats, posts})`: status in plain
  words (`websiteStatus`: none/sign/pay/build/review/launch/live), a link (live site, or the preview link
  while they review before paying the balance), Payments (each stage paid or "Pay now" to Stripe's own
  https invoice page; monthly plan status), Visitors last 30 days (only once live: visitors, page views,
  website enquiries, daily bars, where they came from, top pages, phone/tablet/computer; says "soon" rather
  than zeros if the numbers are not readable), the blog's latest articles, and "Ask for a change"
  (counts the care plan's 2 small changes a month).
- portal.mjs: a WEBSITE-ONLY client's portal is Website | Enquiries | Account (Status hidden, ad-account
  connections dropped, help chat kept); an ads client with a website gets a 6th tab (fits 360px via the
  flex rule; verify-portal-upgrades now pins six). Change requests POST `{websiteRequest:{text}}`, stored
  in `cl.websiteRequests` (cap 10 open), logged, Bryson alerted; OS shows them on the Website tab
  ("Mark done", which the client then sees) and as a yellow alert. The OS portal PREVIEW only names the tab
  (the numbers live server side).
- Visitor counting: live public pages only (site.mjs passes `track` when published and not a preview)
  send a text/plain beacon to `/site-hit` (skips about:, ?preview=, webdriver). `site-hit.mjs` always
  answers 204, skips bots, stores `site_visits` rows {client_id, at, path, source, device, visitor} where
  visitor is a DAILY-rotating hash (no cookie, no IP stored). `site-stats.mjs` `summarize` (30 days,
  Internal clicks are page views but not arrivals). In the nightly backup (capped 20,000).
- ✅ **Supabase table created by Bryson 2026-10-06** (docs/sql/site-visits-schema.sql run in the SQL
  Editor). Verified the same day: the REST API answers 200 with `[]` for `site_visits` to the public key
  (table exists, RLS keeps it private) vs 404 for a made-up table. Visits count from now on; the portal
  shows numbers once a live site has had a visitor, and the monthly summary email starts 1 Nov 2026.
- Tests: tests/verify-website-portal.mjs (49 checks, 10 mutations caught).

## Client blog editing (BUILT 2026-10-06)
Bryson: *"make sure the client has a way to see when they go out and what is written that way they can
edit it if they want (just like how i have for my blogs)"*. The 4-a-month limit stays as is.
- Portal Website tab lists EVERY article (scheduled, held and published, newest first, up to 24) with
  "Goes out <weekday, date>" / "Published <date>" / "On hold, not published", "edited by you", a live link
  only once it is out, and **Read and edit** (title, headings, paragraphs in place) + **Hold it / Release it**
  (hold asks first). POSTs `blogGet`, `blogEdit`, `blogHold` to the portal with the portal token; 🔴 refused
  unless the deal includes the blog, and only ever the token holder's own articles (`data.id`, never a
  client id from the body; `loadPost` slugifies so a slug can't reach another folder). Each change is
  logged on the record and alerts Bryson.
- `site-blog.mjs` `cleanEdit` / `applyEdit(store, id, slug, edit, who)`: 🔴 an edit keeps `publishAt` and
  `held` (editing never releases or reschedules), drops empty blocks, unknown block kinds become paragraphs,
  dashes stripped (humanizeDeep), excerpt follows the new first paragraph, stamps `editedAt` / `editedBy`
  ("client" | "boldline") on the article and the index.
- OS Blog card: Read > **Edit** > Save (`site` action `blog-save`); shows "edited by the client".
- Tests: verify-website-addons (84) + verify-website-portal (49); 8 mutations caught.

## 🔴 Step 3: the client's own web address (BUILT 2026-10-06)
Bryson: *"yea start on the web address"*. A client's site can now run on THEIR address (www.acmepools.com).
- **How it routes:** the existing client-domain edge function sends every unknown address to the landing
  function (now with `?path=`). Landing looks up a landing page first; only if none claims the address does
  it call `serveWebsiteOnDomain` (site.mjs). 🔴 A landing page always wins an address. One shared
  `renderPublic` draws the page on either address, so payment gate, preview key, held articles and the
  visitor count are identical. Links, canonical and the visitor beacon all use their address (`/site-hit`
  passes the edge); nothing on the page names us. The bare/www twin 301s to the address that was set.
- **Stored** on `websiteDeal.domain = {host, setAt, live, liveAt, check{dns,https,note,at}, alias}`
  (server-owned). 🔴 `live` is only set by `checkDomain`, which fetched `https://<host>/` and saw
  `x-site: <slug>` (every public site response carries it), AND the site is published and paid. Emails,
  portal and OS links switch to their address only when live (`liveDomain`/`publicSiteUrl`, OS mirror
  `wdLiveDomain`). On our /site/<slug>/ address the canonical then points at theirs (no redirect, so our
  address keeps working as a fallback if their domain ever lapses).
- **Search engines:** `/sitemap.xml` (pages + published articles) and `/robots.txt` on their address
  (robots says Disallow until the site is out and paid); sitemap also at /site/<slug>/sitemap.xml.
- **OS: "Their web address" card** on the Website tab (shows once the website agreement is signed): type
  the address > `domain-set` (refuses our own addresses, and any address another client's website OR
  landing page uses: `addressTaken`) > a records table + **Copy instructions for them** (plain message for
  their web person: records, keep MX, Cloudflare grey cloud) > **Check it now** (`domain-check`) > Remove.
  Launch also checks the address so the "you're live" email can already carry it.
- **DNS:** bare `A @ 75.2.60.5` + `CNAME www boldlinemedia.netlify.app`; a subdomain gets one CNAME
  (`dnsRecords`, mirrored in the OS as `siteDnsRecords`, parity tested).
- **Netlify:** each address must be a domain alias on the OS site. Optional env var **`NETLIFY_API_TOKEN`**
  (a Netlify personal access token) lets `domain-set` add the alias itself via the API (`addNetlifyAlias`:
  🔴 reads the list and only ever APPENDS; never writes if the read fails). Without it the card shows the one
  manual Netlify step (Domain management > Add domain alias, both forms) = a 10pm-reminder job per client.
  ✅ **Set by Bryson 2026-10-06** on the OS site (no-expiry personal access token, redeployed). The card shows
  "Connected to Netlify" before the first address is set (`netlify-status`, read-only `netlifyStatus`), and
  daily-check alerts red if the key is refused (expired/deleted); skipped if unset. Where to see it: sidebar
  **My Ads** (BoldLine's house account) > **Website** tab > "Their web address" card (the card shows before a
  site is built too, since 2026-10-06, so the house account shows it).
- **Domain ownership (recommendation given to Bryson 2026-10-06):** the client buys and owns the domain in
  their own name (about $12 to $20 a year); BoldLine does the DNS and hosts the site (hosting is already in
  the care plan). Same principle as ad accounts: if BoldLine held the domain, leaving would mean a domain
  held hostage and their site/email dying if our card lapsed.
- Tests: tests/verify-site-domain.mjs (84 checks, 15 mutations caught); OS card driven at 390/768/1280/1600.

## 🔴 Ad clients get nothing about websites unless they are buying one (2026-10-06)
Bryson: *"make sure that regular ad clients wont get anything regarding website stuff unless of course they
are paying for it"*. Audited every client-facing website touchpoint. Already true: website emails only fire on
website-tagged Stripe money, the website envelope, launch, an active blog, or a launched site; no ads email
mentions a website; blog articles need `blogActive`. Tightened the same day:
- Portal Website tab (`hasWebsite`): a website agreement out or signed, or the website-only package. A draft
  site on an ads client's record no longer shows it.
- Portal change requests refused (403) without a website; blog actions already needed the blog.
- "Email them the preview" needs a SIGNED website agreement; the monthly summary needs one too.
- OS Emails tab offers website emails to an ads client only while a website agreement is out or signed.
- Pinned in verify-website-emails section 7 (5 mutations caught). Note: the portal's "Your Website" and
  "If People Buy Straight From Your Website" Account cards are about the client's OWN existing site (ads
  tracking), not our website product, so they stay.

## 🔴 The website emails (BUILT 2026-10-06)
Bryson: *"make sure the website only clients get the automated emails just like ad clients do and make
sure they are tailored to the website clients"*. Seven new types in `client-emails-shared.mjs` (all in the
Emails tab, labelled automatic, website footer "Websites built and looked after for you"):
| Email | Sent when | By |
|---|---|---|
| website_welcome | website agreement signed (with the first invoice's pay link) | docusign-watch, after the save; flag `emailAuto.websiteWelcome` |
| website_payment | each website payment (deposit/full: building starts; final: goes live next; care: monthly receipt) | stripe-webhook website branch, after the save; dedupe `emailAuto.websiteSent` (`type:invoiceId`, last 40) |
| website_past_due | a website payment fails (care version states the 15-day offline clause) | same |
| website_review | the second-half invoice is sent (only once built), or Bryson presses **Email them the preview** on the deal card (`send-review`) | website-deal |
| website_live | first launch only; the launch write now sets `website.published` server-side BEFORE the email | website-deal; flag `websiteLive` |
| blog_scheduled | each article written: title + the day it goes out + "read or edit it in your portal" | site-blog-write-background |
| website_monthly | 1st of the month 16:10 UTC (9:10am Phoenix), Arizona calendar month just ended: visitors, page views, website enquiries, top source, articles; website-only clients get a one-line Google Ads ask | new `website-monthly-run`; once a month (`emailAuto.websiteMonthly = "YYYY-MM"`); skipped if live < 14 days, no visits, or the visits table can't be read |
- 🔴 **Gap found and fixed:** a website-only client's form enquiries land in `leadsLog`, so the ads Results
  Milestone would have told them "BoldLine has now delivered 10 leads ... your campaigns keep running".
  `buildClientCtx` (and the OS `buildCtx` mirror) now sets `resultKind:"enquiry"` for `packageId "w-site"`;
  `emailWords` has an enquiry variant ("10 enquiries from your website") and the review ask opens with the
  website, and every email to them carries the website footer.
- Website-only clients also get the review ask once, 45 days after going live, care plan not past due
  (client-nurture step 4b). They never get the ads welcome / access / nudges / renewal: those need
  `contractSigned`, which website deals never set.
- OS Emails tab filters by client: website-only sees the website emails + milestone, review ask, thank-you;
  an ads client sees website emails only once they have a website deal or a site.
- Tests: tests/verify-website-emails.mjs (118 checks, 14 mutations caught) + verify-client-emails (auto
  labels checked against the real senders).

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
- ✅ Step 3 own domain + sitemap/robots BUILT 2026-10-06 (see above). Still open from the old plan: send review emails from their domain (Resend free plan: 3 domains).
- A portal page where the client picks the design themselves (today: preview links + Bryson clicks).
- Rebuilding BoldLine's own site with this engine to the same bar.

## 🔴 2026-10-06 REQUIREMENT: no website is built until the client has SIGNED and PAID (Bryson). ✅ BUILT 2026-10-06, see "Step 2a" above.
*"make sure that the option to build a website is only available after a client signs the agreement and
pays (I also want to be able to modify the payment as I want and then allow the option for pay half now
half when finished)"*. Not built yet; it lands with step 2 because it needs the website agreement:
- Build button locked until: website agreement signed AND first payment received (Stripe webhook, not a
  checkbox).
- Price editable per client (default $1,500); payment plan per client: in full, or 50/50 (deposit now,
  balance when finished). Stripe invoice with a pay link, metadata `kind: website`, `stage: deposit|final`.
- ✅ DECIDED (Bryson, 2026-10-06): the second half is due BEFORE it goes live. "Put it live" stays locked
  until the final payment arrives. The $99/mo care plan starts at launch.
