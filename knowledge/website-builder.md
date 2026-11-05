---
name: website-builder
topic: OS app
task: build, preview, edit, publish or debug a client website made by the OS (the website service), or change its designs, pages, motion, 3D or copy writer
keywords: [test copy, staging, branch deploy, not live version, preview site, homepage refresh, marketing site redesign, saguaro, site-showcase, sites site, separate netlify site, SITES_NETLIFY_SITE, lead-relay, lead-queue, lead-queue-sweep, site-uptime, uptime, __health, ignore.mjs, delegate access, domain access, web guy, access request, netlify-status, netlifyStatus, own domain, custom domain, web address, domain-set, domain-check, site-domain, NETLIFY_API_TOKEN, domain alias, sitemap.xml, robots.txt, x-site, serveWebsiteOnDomain, website emails, website_welcome, website_payment, website_review, website_live, website_past_due, blog_scheduled, website_monthly, website-monthly-run, enquiry wording, client blog editing, blogEdit, applyEdit, blog-save, portal website tab, site_visits, site-hit, visitor analytics, change request, websiteRequests, portal-website, extra pages, blog add-on, client blog, site-blog, blog articles, site-blog-run, site-blog-write-background, held article, website deal, websiteDeal, website agreement, WA-1, WA-2, build lock, publish lock, deposit, final payment, care plan, website-deal.mjs, SERVER_OWNED_KEYS, motion recipe, motionRecipe, motionSeed, try different animations, portal scene, rail scene, stack scene, lenis, smooth scroll, water caustics, liquid chrome, silk, topo, glSceneFor, website builder, client website, site-render, renderSite, site.mjs, site-build-background, siteJob, website tab, cinematic, aurora, editorial, webgl, glass orb, bubble, orb removed, cinematic photo frame, designs look alike, unique templates, dark cinematic, light or dark, light mode, dark mode, website.mode, split screen, cinematic scenes, editorial magazine, playfair display, cursor follow, follows the cursor, cursor ring, magnetic buttons, pill buttons, hard to read font, fraunces, table of contents, drop cap, pull quote, cinemaScenes, shader, word fill, marquee, preview key, /site/slug, five pages, home services about reviews contact, pexels background photos, website service, $1500, website preview]
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
when finished"*, second half BEFORE going live, $100/mo care from launch ($99 until 2026-10-07).
**What he does** (Website tab, new top card "Website deal"): set Build price (default $1,500), How they pay
(All up front / Half now, half before launch), Care plan $/mo (default $100, 0 = waived) > Save price >
"Read the agreement" (sandboxed preview) > "Send the agreement" (DocuSign). Then nothing until the site
is built: when they sign, the watcher sends the first invoice BY ITSELF (Stripe emails it) and alerts him;
when it's paid, the Build button unlocks (alert). Half plan: once built and approved, "Send the final
invoice"; when paid, "Put it live" unlocks. Putting it live starts the care plan (asks first). Card on
file (ads billing or portal) = charged monthly automatically, otherwise Stripe emails a monthly invoice.
"Cancel it to change the price" voids an unsigned envelope in DocuSign (only recorded once DocuSign
confirms). "Copy pay link" / "Send it again" (voids the old invoice so nobody pays twice).
**How it works:**
- `netlify/lib/website-deal.mjs`: terms, amounts (half: deposit takes the odd cent), `buildLock`,
  `publishLock`, `nextStep`, the agreement HTML (`WA-1`, now `WA-2`, no dashes, client owns domain + gets a static
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
- **One price list:** `WEBSITE_OFFER` in netlify/lib/pricing-shared.mjs ({build 1500, care 100, pages 5,
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
  what's included, the both-ways pitch, $1,500 / $100/mo, Book a Call. 🔴 NOT a tab of `.pkg` cards and
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

## 🔴 A website client only ever gets the website agreement (Bryson, 2026-10-11)
"We will need contracts specific to website clients ... make sure when we take on a website client that the website
contract is what is used." It already existed (Website Design and Care Agreement, WA-5, sent from the Website tab's
deal card through website-deal.mjs). Now enforced three ways:
- The ads Contract tab is hidden for `packageId: "w-site"` and they land on the Website tab (was already so).
- `contractGaps` (index.html) returns "This is a website client ... send it from the Website tab" first, so the ads
  send button stays blocked even if that tab is reached some other way.
- `docusign-send.mjs` (the ads sender) now requires `clientId` for any real send, looks the client up, and refuses a
  `w-site` client (409, `websiteClient:true`). The website agreement has its own sender and is unaffected.
- A client with ads AND a website signs both: the ads agreement for ads, the website agreement for the site
  (section 11: "ending one does not end the other").
- Samples for Bryson: `docs/contracts/website-agreement-{1..4}-*.pdf`, one per version (see WA-7 below).
- WA-6 (same night, Bryson: "yes add both"): section 2 now makes the client answer for material it supplies
  (defends BoldLine and pays losses/legal costs if a photo, logo, text or review infringes; BoldLine may pull it
  while a claim is open), and section 8 lets BoldLine show the finished site, business name and pictures in its
  portfolio/marketing, never private information, enquiries or results without written approval, removed within
  30 days of a written request. Agreements already sent keep their own version. Still a DRAFT FOR ATTORNEY REVIEW,
  same as the ads agreement.
- Test: `tests/verify-website-contract-only.mjs` (14).

## WA-7: four versions + Special Terms (Bryson, 2026-10-11)
"Make sure there is a way to manually edit it or have the ai edit it just like we do for the ads contract. Also make
sure there is a version for each variation of the website stuff (regular website with management, website without
management, custom, etc)."
- Terms gain `mgmt: "care" | "hosting"` (old agreements read as care) and `special: [{heading,text}]` (max 12,
  plain text, dashes become commas; `cleanSpecial`, mirrored as `wdSpecial`). `variantOf(t)` names the version.
- Four versions: Standard/Signature (custom) x Care Plan/hosting only. Hosting only = "Website Design and Hosting
  Agreement": section 7 "Hosting" ($25/mo default, `WEBSITE_OFFER.hosting`, editable), keeps it online + security +
  forms/booking/payments working, NO changes included, every change quoted, can move to the Care Plan in writing;
  no blog (normTerms forces it off); after launch, changing how customers book is quoted; tierIncludes careEdits 0.
  Stripe product "Website hosting, <name>"; welcome/payment emails and portal (change card, plan box) say hosting.
  🔴 Hosting only is an interpretation of "without management" (he may have meant a hand-off where the client hosts
  it themselves; no website export tool exists yet, only the landing-page handover-export). Told him; his call.
- Special Terms: section "14. Special Terms" after General, above the signatures, precedence wording identical to
  the ads agreement. Test proves the rest of the document is byte-identical with and without them. OS card
  `WebsiteSpecialTerms` (above WebsiteDealCard): "Write it up with AI" (contract-terms.mjs with `kind:"website"`,
  its own WEBSITE_SYSTEM, refuses 409 once the website agreement is out) or "Write one myself"; edits are local until
  "Save special terms"; saved through website-deal `set-special` (server-owned deal, refused once the agreement is
  out). Read-only once sent. Frozen into `agreement.terms` at send like everything else.
- OS deal card: "Which version" 2x2 tiles (price/monthly defaults follow unless he typed his own), "Hosting ($ a
  month)" label, blog hidden for hosting, send-confirm names the version and special-term count.
- Section 5 (same night, Bryson: "if you can't answer me within two weeks then that's just ghosting"): 14 days of
  client silence lets BoldLine PAUSE with written notice (section 5 timing stops), 14 more days after the notice lets
  it CLOSE (no refund). Recommended the notice step over a flat 14-day close: a client on a two-week trip would
  otherwise lose their deposit, which is the kind of clause that gets challenged. He can ask for a flat 14.
- 🔴 DEPLOY STATUS: merged to main 2026-10-12 ~1am Phoenix (e0c522e) but NOT live at 8am: the live site still
  serves the WA-6 sample PDF (74106 bytes) and the new PDFs 404 to the app shell. Nothing in the commit looks like a
  secret-scan hit, so most likely out of Netlify build credits (KB netlify-secret-scan-deploys). Asked Bryson to look
  at Deploys during the 8am Netlify job; "Trigger deploy" there publishes it. Verify with the sample-PDF size check.
  ✅ LIVE by 10:01pm Phoenix Mon 2026-10-12: the hosting-only sample PDF serves 74972 bytes and the live OS has the
  new version tiles. It went out with the next merge to main (5de1156, Lead Scout website mode), so the earlier
  build simply never ran rather than being blocked for good. If a merge is ever missing from the live site again,
  the next push is worth checking before assuming credits ran out.
- Tests: verify-website-deal (173, incl. 21 WA-7 checks), verify-client-emails (hosting flag in OS preview ctx).

## Add-ons: extra pages and the blog (BUILT 2026-10-06)
Bryson: *"what if a client wants to add extra pages such as a blog page? We should charge an extra for blog
page creation and then ai blog post creations"*. Recommended defaults (in `WEBSITE_OFFER`, all editable per
client on the deal card): **extra page $200 each**, **blog $300 setup + $150/mo for ~4 articles a month**.
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
  daily-check alerts red if the key is refused (expired/deleted); skipped if unset. The card shows before a site is
  built too. 🔴 The Website tab is now HIDDEN on My Ads (the house account) unless a site was built there:
  BoldLine's own site is the marketing site (sidebar Website page), and the tab confused Bryson by offering
  to build a second one. So the connection line is seen on a signed website client's record; the daily check
  is the ongoing guard. Verified connected by Bryson's screenshot 2026-10-06.
- 🔴 **WE ARE THEIR WEB PEOPLE (Bryson, 2026-10-06: "why would we have to work with their web guy if we are
  their web guy. we need to be able to 100% manage, edit, host, etc their website so we are the only company
  they have to deal with").** The card's default is now a 3-step flow: **1. Copy the access request** (asks
  the client to invite the signed-in OS email to their domain account via Delegate access / Share access /
  Members, DNS permission; domain stays in their name) > **2. Bryson adds the two records himself** in their
  account (keep MX, Cloudflare grey cloud) > **3. Check it now**. "Can't get access? Copy the records for
  them" is only a fallback. The website welcome email now tells the client up front we'll ask for that access
  (or help them buy an address in their name). The card shows on EVERY website client (website-only or a
  live website agreement); before signing it says it is set up once they sign.
  Possible next step (not built): Netlify-managed DNS so the OS sets records itself; deliberately NOT done
  because moving a live domain's DNS risks dropping its email (MX/DKIM records we cannot see) and a
  client's email breaking is far worse than one manual step.
- 🔴 **Agreement WA-2 (2026-10-06, Bryson: "yes add it"):** section 6 now says BoldLine manages the domain's
  settings through access the client gives to their registrar account (limited to settings where possible,
  for as long as BoldLine hosts); BoldLine will not transfer, change ownership of, cancel the domain or touch
  the client's email settings without written approval; renewal stays the client's job; the domain and account
  are always the client's and they may remove access any time (removing it while hosted may break the site, not
  a breach); on leaving, BoldLine stops using the access and says which settings it made, and that hand-back
  never depends on money owed. Applies to agreements SENT from now on; any already sent stay WA-1.
- **Domain ownership (recommendation given to Bryson 2026-10-06):** the client buys and owns the domain in
  their own name (about $12 to $20 a year); BoldLine does the DNS and hosts the site (hosting is already in
  the care plan). Same principle as ad accounts: if BoldLine held the domain, leaving would mean a domain
  held hostage and their site/email dying if our card lapsed.
- Tests: tests/verify-site-domain.mjs (84 checks, 15 mutations caught); OS card driven at 390/768/1280/1600.

## Homepage refresh (BUILT 2026-10-06, 🔴 ON THE DEV BRANCH, NOT MERGED: waiting for Bryson's go-ahead)
Bryson: *"I want to update my website to look better right now it feels a bit outdated"*. Kept black and
gold (KB `brand-palette-decision`; he agreed a rebrand would mean redoing logo, OS, portal, emails). Changes
to marketing-site/index.html only: display type is Inter tight (Playfair kept only for italic accents and the
founder quote), the constellation canvas, blueprint SVGs, grid and diamond dividers removed, eyebrows are
pills, pill buttons, softer cards, hero paragraph shortened + second button "See a site we built", the grey
skeleton browser replaced by REAL screenshots of a made-up sample business ("Saguaro Pool Co.") built by our
own engine (browser + overlapping phone + "New enquiry" toast, straightens on scroll), and a three-design
gallery in the Websites section. "Local & Retail" became "Retail & Storefronts". Images: marketing-site/img/*,
regenerated by `node scripts/build-site-showcase.cjs` (fixture scripts/site-showcase-demo.mjs). All 12
marketing-site suites pass; verified at 390/768/1280/1600, no sideways scroll.
🔴 Until he approves, do NOT merge the dev branch into main (it carries this commit).
- Preview video: Playwright recordVideo + ffmpeg-static (npm, scratchpad) to H.264 MP4 so it plays on his
  iPhone; sent 2026-10-06 (phone + desktop scroll-throughs).
- 🔴 **TEST COPY of the marketing site** (Bryson: "a live version of the website and a not live version that
  we can edit and see then if we like it we can push it to the live version"): Netlify BRANCH DEPLOYS on the
  marketing site (`boldline-media`) for the dev branch give a permanent address
  `https://claude-monday-sept-7-catchup-hyschf--boldline-media.netlify.app`. Needs one Netlify setting
  (Site configuration > Build & deploy > Branches and deploy contexts > Branch deploys: add the dev branch);
  on the 2026-10-06 10pm reminder. ✅ Switched on and verified 2026-10-07 (KB two-netlify-sites). Workflow after: he looks at the test address, says "go", I merge to main.
  Guard in BOTH marketing pages, right after the charset meta: on any `name--site.netlify.app` host every
  non-GET fetch is faked, sendBeacon is a no-op, POST form submits are stopped, analytics never load
  (`load()` checks `window.__TEST_COPY`, plus ga-disable flags), a gold "Test version" bar shows, and robots
  noindex is added. Live and the site's own netlify.app address are untouched. Run-tested by
  tests/verify-site-test-copy.mjs; noted under the manifest in verify-preview-safety. Not yet restyled: the
/get-started ads page and blog pages still use the old look.

## 🔴 Client websites have their own home (BUILT 2026-10-06, needs Bryson's Netlify setup to switch on)
Bryson: *"yes lets seperate them and then if you can think of any safeties we should add"*. Client websites
on their own addresses move to a SECOND Netlify site built from `sites/` (Base directory `sites`), so an OS
update, outage or bad deploy cannot take a client's live website down.
- `sites/netlify.toml`: own functions (`website` on `/*`, `site-hit`, `lead`), esbuild, installs the root
  packages, `check.mjs` refuses to deploy with missing files, and 🔴 schedules NOTHING (the OS's jobs must
  never run twice). 🔴 `ignore.mjs` skips the deploy unless a file the functions actually import changed
  (`deps.mjs` walks the imports: 18 files; NOT report-shared, NOT the OS app). `SUPABASE_URL` moved to its own
  `supabase-url.mjs` (report-shared re-exports it) so OS report changes never redeploy client sites.
- `website` = `serveWebsiteOnDomain` by Host (same renderer/gates as the OS); `/__health` for checks; its own
  netlify.app address is a 404. Pre-domain `/site/<slug>/` addresses and all previews stay on the OS.
- OS side: `SITES_NETLIFY_SITE` env on the OS (`<name>.netlify.app`) = `sitesTarget()`; new client addresses
  are added to that site via the API and their CNAME points there (`dnsRecords(host, target)`, `checkDomain`
  target, OS card reads `nf.target`). Unset = everything stays on the OS as before (safe default).
- 🔴 **Safety 1, no lost enquiries:** on the websites site `/lead` is `relayLead` (lead-relay.mjs): passes to the
  OS lead intake; if the OS doesn't answer or 5xx, the enquiry is written to private bucket `lead-queue/queue/`
  and the visitor still sees thanks (503 "try again" only if even that write fails). OS `lead-queue-sweep`
  (every 10 min) delivers each through the REAL lead intake handler; 4xx = set aside + yellow alert; 3 failed
  tries = set aside + red alert containing the enquiry. Note: a queued lead's receivedAt is its delivery time.
- 🔴 **Safety 2, hourly uptime:** OS `site-uptime` (:20 every hour) fetches every live client address and needs
  THEIR `x-site`; red alert after 2 misses in a row (lapsed domain, changed DNS, broken certificate, hosting),
  green when back; state on `websiteDeal.domain.uptime`. Also pings the websites site's `/__health`; the daily
  check adds "The client websites site answers".
- Rollback for the websites site alone: Netlify > that site > Deploys > pick the last good one > Publish deploy.
- Tests: tests/verify-sites-split.mjs (54 checks, 10 mutations caught; runs ignore.mjs against real commits).
- Setup steps given to Bryson 2026-10-06 (new Netlify site from the repo with Base directory `sites`,
  `SUPABASE_SERVICE_ROLE_KEY` on it, `SITES_NETLIFY_SITE` on the OS, redeploy OS).

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
else). Aurora (retired) shows it full screen (darkened behind the headline); Cinematic and Editorial have none
(Cinematic's glass orb was removed 2026-11-04, see below). Stops itself if a device can't keep up (more than half of the
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
| **Cinematic** | light, Archivo Expanded at huge sizes, two-part hero (line A top left, line B bottom right) | their best photo in a rounded frame beside line A (opens like a film frame, drifts on scroll, tilts toward the pointer). No WebGL since 2026-11-04 |

### 🔴 NOTHING EVER FOLLOWS THE CURSOR (Bryson, 2026-11-05: "on showcase there is a circle that follows around the
cursor but i dont want anything to ever follow someones cursor")
Removed everywhere, not just the ring he saw: the cursor ring (`motionRecipe().cursor` is always false now), the photo that
trailed the pointer over the services list (`.hov`, client sites incl. Editorial's contents rows), magnetic buttons that drifted
toward the pointer, and on boldlinemedia.com the background dots that leaned toward the pointer and drew lines to it plus the
light that followed it inside `.b-card`s. Tiles that TILT in place when pointed at stay (not following). Also: the floating
Book/Call bar's buttons are round inside the round bar on every design (Editorial had square buttons in a round bar; his
screenshot). Pinned by `tests/verify-no-cursor-follow.mjs`. A new effect that tracks the pointer must not be added.

### 🔴 Editorial's serif is PLAYFAIR DISPLAY, not Fraunces (Bryson, 2026-11-05: "change any font that looks like this to
something a bit easier to read ... I still want some sort of fancy but it needs to be readable")
His iPhone showed the cover headline squeezed and leaning. Reproduced by fetching the Google font files with an iPhone
user agent (Google serves Safari a different file): Fraunces at `opsz 144` with -.025em tracking came out condensed with its
"wonky" letters. Compared side by side at phone size (Fraunces reading cut, Playfair Display, Newsreader, DM Serif Display,
Libre Caslon Display); Playfair Display was the clearest that still looks fancy. Now: Playfair Display 400 to 700 (no
italic), headings weight 500 and -.01em, mid-size 450 to 600; Fraunces is gone from the site renderer. Landing pages that
borrow the website's look follow automatically (siteBrandKit). A Brand kit heading font still wins over it.
✅ LIVE 2026-11-04 ~7:32pm Phoenix (merge `41ad63d`, rollback `rollback/20261105-022859`); verified by fetching boldlinemedia.com
(editorial + handyman samples load Playfair Display, no Fraunces left, design picture updated).

### ✅ LIVE 2026-11-04 ~4:50pm Phoenix (merge `eb4052e`, rollback `rollback/20261104-234910`)
The split-screen Cinematic, the magazine Editorial, light or dark on every design, and top-on-refresh. Verified by fetching
the live pages, not assumed: boldlinemedia.com samples (`cn cn-top`, `edh`, the light/dark button), the Websites page
descriptions, the three design pictures (byte-identical to the build) and the OS (`ModePills`) all served the new version
within ~1 minute. The client-websites site rebuilds on its own when the renderer changes (sites/ignore.mjs) but has no
public address to fetch until a client site is live on its own domain, so it was not fetched. (Bryson had asked to "make sure
the website is updated as well it looked like it wasn't before": before this merge boldlinemedia.com WAS on the previous
release, Showcase; today's work was only on the test copy until "go".)

### 🔴 Editorial REBUILT as a magazine (Bryson, 2026-11-04: "I like cinematic now I want to make editorial look better")
Before: headline crammed into four lines beside a plain photo, services in shadowed white boxes, every section the same.
Now `editorialHome` (his order and hidden parts respected; other sections are the shared ones restyled):
- **Cover** (`.edh`): meta line (eyebrow left; right = their REAL rating if known, else "Call <phone>" as a tel link, never the
  town again), a drawn rule, one huge Fraunces headline across the page (underline mark kept), intro + both buttons on one row,
  then a 21:9 photo (4:3 on phones) with a caption (business name, area: never claims a stock photo is their job).
- **Services = table of contents** (`.ed-row`): big serif name, short line, round arrow; hover (pointer devices) italicises and
  shifts the name, fills the arrow, and the photo follows the pointer (`.hov`, JS selector now `.svc,.ed-row`). Phones: a 64px
  thumbnail per row (`.ed-th`); `np` rows when there are no photos.
- **Story = feature spread** (`.ed-feat`): 4:5 photo with caption, the first story line as a big serif statement, the next one
  or two paragraphs in columns (`--c`), a drop cap ONLY when the first is over 160 characters (`p.dc`): on a one-line
  paragraph it looked broken, and CSS `columns` put the floated cap in the wrong column, so it is a grid now.
- **Why us = newspaper columns** (`.ed-why`, vertical rules, italic serif titles); **review = pull quote** (`.rvt`, a big
  opening quote mark); **strip = italic ticker**; inside-page heroes get a heavy rule under the title.
- Motion is quiet on purpose: rules draw in (`.rule`), photos open top to bottom (clip-path from 78%, not 100%, because an
  IntersectionObserver never fires on a fully clipped element), the per-client headline entrance stays. 🔴 NO ITALICS in Editorial
  (Bryson, same day, on the pull quote: "change this font because it's too hard to read"): Fraunces italic at the display
  optical size, tightly spaced, crowded and its swash "v" read as "w". The italic font is no longer loaded; the pull quote,
  why-us titles, ticker, row hover and the big story line are upright, and mid-size serif text uses the reading cut
  (`font-variation-settings:normal;font-optical-sizing:auto`) with normal spacing. Only big headlines keep the display cut. The per-client "scroll moment" (portal/rail/stack) now only runs on Aurora.
Pinned in `verify-showcase-design` section 7.

### 🔴 Light or dark is its OWN choice, on every design (Bryson, 2026-11-04)
"Don't just change the light or darkness because some businesses would want a style but have it either light or dark and
that should be an option for all templates". `website.mode` = "light" | "dark" | unset (unset = the design's natural one:
`NATURAL_MODE` showcase light, cinematic dark, editorial light; aurora is always dark and has no switch). `SURFACES` holds
each design's light and dark colours; the layout never changes with the mode (pinned: identical HTML apart from styles).
The page carries BOTH colour sets (`:root` = chosen mode, `html[data-mode=<other>]` = the other) and `<html data-mode>`, so
the preview strips flip instantly: demo/pitch strip (`MODE_TOGGLE_HTML` + `modeToggleJS`, remembered per demo token in
sessionStorage, saves nothing) and the marketing sample strip (key `bl-mode-sample`). OS: `ModePills` on the Website tab
("Light or dark", saves website.mode) and on both preview cards (server action `mode` for demos and pitches, accepts only
"", light, dark); a preview turned into a site keeps its mode. Dark pages lift a very dark brand colour for the small
touches only (dots, ticks, stars); buttons keep the true colour. The landing page follows the mode via `siteBrandKit`.

### 🔴 Cinematic REBUILT as a split screen (Bryson, 2026-11-04: "redo one of them the whole layout and animations")
Replaces the photo-frame hero from earlier the same day. Home = `cinemaHome`: the top, each service (max 6), the story and
"why us" become SCENES (`cinemaScenes`): photos pinned on the left half (sticky, one per scene, crossfade + slow zoom),
words scrolling on the right; `cnUpd` (in motionScript, called from `frame()`) lights the scene crossing mid-screen, swaps
the photo, sets the caption and fills a progress line. Waiting scenes are dimmed ONLY under html.mo (readable without
JS). Everything else in his layout (strip, before/after, steps, FAQ, reviews, his blocks) follows at full width in his
order; hidden parts stay hidden. Phone (<900px): the photos become a band (34svh) pinned under the header. Inside pages
open on the same split (`.cnh`, `pageHero(..., C.pagePh)`); Services page is told as scenes too (ids s1..sN, so the
home links land); the closing CTA is a full-bleed photo end card (`.cn-end`, `ctaBand` when `C.theme==="cinematic"`).
Headlines use `oneLine` (natural wrapping; fixed thirds left "in" alone on a phone). **Phone, second pass (Bryson, same day: "at least on mobile it's a bit tight", then
"It's still tight I think we need to change up the design a bit when scrolling"):** a photo band pinned on a phone ate a
third of the screen whatever its size (a `cnTop` script that slid it under the menu was tried and REMOVED). Now on a phone
nothing is pinned: `.cn-media` is hidden and each scene carries its own full-width photo (`figure.cn-ph`, 16:9 for the top,
4:3 for the rest; hidden on computers) that opens from a letterbox slit as it scrolls in AND closes again on the way back up (Bryson: "make sure when I scroll
up the pictures close as well"): `phUpd()` in `frame()` sets `--o` 0 to 1 from the photo's top entering the bottom of the
screen to the middle; CSS clip-path/scale read it; not an IntersectionObserver one-off any more), words underneath, 64px between scenes; the
"more on" buttons are underlined text links with an arrow. Computers keep the pinned split screen unchanged. The menu sits in a frosted pill on
desktop because it can reach over the photo half. Pinned in `verify-showcase-design` sections 4 and 6.

### 🔴 The three offered designs must never look alike (Bryson, 2026-11-04)
"there is basically no difference between editorial and cinematic we need to make sure the 3 template options are unique".
Below the hero all three shared the same light page, cards, closing box and footer. Now: **Showcase** = bright, full-screen
photo hero, bento photo tiles. **Cinematic** = DARK (bg #0C0C0E, ink #F2F0EB, `dark: true`), brand-colour glow in the hero,
outlined dark cards, closing panel with an accent glow. **Editorial** = paper, serif, cards become a black hairline on top
with no box (`.tick` hidden), each section heading sits under a thin rule, closing panel is paper with a 3px ink top rule.
Pinned in `verify-showcase-design` section 5 (Cinematic must stay dark, the others light; each keeps its own hero and font).
### (Superseded the same day by the split-screen rebuild above) Cinematic: the orb is gone, their photo took its place
Bryson, on the Springbok preview: "cinematic still has the bubble and I feel like that should change where we don't have a
random bubble". `motionRecipe().gl` is now non-null for **aurora only**; cinematic's palette has `gl: null` and its home and
page heroes carry no `<canvas>`. The hero is `.ctop` (grid: line A `minmax(min-content,2.4fr)` + frame `minmax(0,1fr)`), then
`.cbot` (line B + sub + buttons). The frame (`.cdr > .ph.cfr[data-tilt]`) hides itself under 180px wide (container query)
so a long first word never squeezes it into a sliver. **Phone (<900px): the photo moves BELOW the buttons** (flex `order`)
so booking stays on the first screen and the photo peeks in under it. Type is 9.2vw / max 154px (was 10vw / 170px) so line A
and the photo share a row. Scroll drift: `frame()` moves `.cdr` up `scrollY*.06` (computers only: on a phone it slid into the buttons) and the
image inside by `--y * .08%` of its own height (max 4.8%, inside the 6% the 1.12 zoom leaves spare). 🔴 It was 60px once
and Bryson's iPhone showed a grey strip across the top of the frame. Phones also drop "Scroll to explore" and use 112px
top padding so the photo follows the buttons closely. Only without reduced motion. Entrance: `clip-path` opens from 34% top/bottom (not more: IntersectionObserver counts a
clip-path, and at 47% only 6% showed so the 12% threshold never fired and the frame stayed shut). With 2+ photos the
services section starts on photo 2 so the same picture never sits twice in a row. **A refresh opens at the top** (every design): `motionScript`
sets `history.scrollRestoration='manual'` and scrolls to 0 unless the address has a #section. Bryson's iPhone reopened the
Cinematic sample halfway down. Pinned in `verify-showcase-design` §4.
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
- **Hosting (Bryson asked 2026-10-06 "how hard would it be for us to get servers"):** advised NOT to run our
  own servers. Netlify already IS our hosting (fast worldwide, free security certificates, backups, nobody has
  to keep a machine patched at 2am), and "BoldLine hosts your site" is already true and sold in the care plan.
  Real risk to fix later (around 3+ live client sites): every client site shares ONE Netlify site with the OS,
  so an OS outage or bad deploy takes client sites down too. Plan: move client websites to their own Netlify
  site. Also check Netlify's per-site limit on domain aliases before ~20 client addresses.
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
  until the final payment arrives. The $100/mo care plan starts at launch.

## Price change 2026-10-07: care $99 -> $100, blog $149 -> $150
Bryson asked whether $100 beat $99; agreed. $99 is retail/impulse charm pricing and was the only non-round number
next to $400/$700/$1,200/$1,500; $1 a month is irrelevant to revenue. Blog moved to $150 for the same reason.
Changed in `WEBSITE_OFFER` (pricing-shared.mjs) + the OS copy in index.html (a test pins the two equal) + the
Websites page. Agreements already signed keep their own stored price (terms live on the deal, not the list).
Considered and NOT done: pricing care higher (hosting + security + 2 edits + domain management could justify it);
kept at $100 as an easy yes after a $1,500 build, revisit for new clients once a few sites are live.

## 2026-10-07 night: animation and small-screen fixes (LIVE)
- **Sideways "rail" scroll** only turns on with 5+ service cards AND at least 40% of a screen to travel; otherwise the
  cards sit as a grid. Bryson: three pictures sliding sideways "didn't make sense".
- **Moving services strip** repeats its items until each half holds 12, then shows the half twice, so it loops
  seamlessly on any screen. It used to run out and leave a blank gap on a big monitor (3 short services).
- **Small phones (320px)**: business name shrinks instead of pushing the menu button off screen; contact column no
  longer widened by a long email; stack cards may shrink. Sample bar compacts under 380px; toggle reads "Website".
- Button wording and website/landing brand match: KB `website-landing-brand-match`.

## Photo rows never leave a hole (2026-10-07)
- Bryson: on the pool sample's Services page "it looks like a picture is either missing". The services photo row was
  always three-across, and the pool sample only has two photos. Now `gal g2` (two wide 4:3 photos) when there are two,
  `gal g3` when three or more. Same day: on tablets every three-across row (`.g3`/`.g4`) wraps to two and stranded the
  third card next to an empty hole; now the odd last card runs full width (the third gallery photo turns 16:9). The
  plain (non-rail) `.track` of cards packs 3 across from 700px and stacks below it. Pinned in verify-site-builder.
- Swept every sample page at 1440/1024/768/600/390 for rows whose last line is under 80% full. Only the landing
  gallery's centred last photo remains, and that one is centred on purpose.

## Job A DONE (2026-10-07 ~10am Phoenix): the client-websites Netlify site is live
- Bryson created the new Netlify project (base directory `sites`) and set `SUPABASE_SERVICE_ROLE_KEY` on it (the only
  key that site reads), taking the legacy service_role key from Supabase > API Keys > Legacy API Keys.
- 🔴 `SITES_NETLIFY_SITE` added to `SECRETS_SCAN_OMIT_KEYS`: it is an address, not a credential, and
  `tests/verify-sites-split.mjs` contains `boldline-sites.netlify.app`, so Netlify's scanner would have failed every OS
  build the moment he set it to that value. He was told NOT to tick "Contains secret values" for it.
- ✅ Done and verified: Netlify project **boldline-sites** (`boldline-sites.netlify.app`), `/__health` answers
  `{"ok":true,"service":"client-websites"}`; Bryson set `SITES_NETLIFY_SITE=boldline-sites.netlify.app` on the OS and
  redeployed. Its own netlify.app address returning "Page not found" is by design (it only serves client domains).
  The first real proof of the database key is the first client domain served there (the OS's hourly website check
  will flag it if not).

## Booking for website prospects (2026-10-07)
Website buttons now book the "Website call" Calendly event and the OS labels those leads; details in KB `calendly-leads`.

## The website client's portal (2026-10-09, Bryson: "show me what the client portal for a website client would look like ... make sure that it fits mobile properly")

- **Driven in a browser at 360 / 390 / 768 / 1280 / 1600** on every tab (Website, Enquiries, Account), with
  every Account section open. **No sideways scroll anywhere.** The only elements past the edge are the
  blurred background glows (`.topglow`, `.orb`), which are clipped.
- **His earlier phone screenshot of /pricing** showed the logo bar in the middle of the page. That was the
  capture method (a fixed header inside an element screenshot), not the page itself.
- **Content fixed for website-only clients (`packageId: "w-site"`)** in `netlify/functions/portal.mjs`:
  - **Enquiries:** "Your enquiries", showing the total and the last 30 days. No "Counted as qualified",
    and no line about an invoice built from it. They are not billed per lead.
  - **Account: "Your Website Plan"** replaces the empty "Your Package: —". It shows the tier, build total
    and monthly cost, and what is included (pages, rounds, care edits, domain, blog, email setup,
    Signature design).
  - **Account: Your Information** has no Campaign Setup (ad budget), no "If people buy straight from your
    website", and no "who looks after your site" box.
  - **Account: Your Agreement** shows the WEBSITE agreement's status (On its way / Waiting for your
    signature / Signed on a date) and its terms in a frame with Save or Print. It no longer shows the
    ads contract marked "Expired".
  - **The signature badge** follows the website agreement for these clients.
  - 🔴 **The website sections are built before `sigDot` exists**, so they use the dot markup directly. Using
    `sigDot` would have thrown for any client whose agreement was out but unsigned.
- **Tests:** `tests/verify-portal-website-client.mjs` (8). Phone screenshots are in `docs/screens/`.

## 2026-11-03: Showcase design added, Aurora retired
Bryson: *"the aurora one might be out of date or just there might be a better style"*. My honest take, given and
agreed: Aurora (dark, glowing gradient, centered type, no photo above the fold) reads as a 2023 software-startup
template, makes every trade look alike, and was the DEFAULT for most demos. He said "yes" to a photo-first design.
- **Showcase** (`SITE_THEMES.showcase`): their photo full-bleed behind the headline (dark gradient, white type, header
  turns white over it on the home page), a **real** star rating chip at the top, services as a bento grid of photo
  tiles (layout per count, `n1`..`n5`), Plus Jakarta Sans 800, warm off-white, no WebGL (the photo is the hero).
  Before-and-after already exists as a home section and shows only real uploaded pairs (never faked).
- 🔴 **Rating chip = real or nothing** (`ratingOf`): `website.rating {stars,count,source}` he set, else `gbpStats`
  (the linked Google profile's average + total, saved by gbp-watch each morning), else for a demo the research rating.
  Needs a count; over 5 or a missing count shows nothing.
- **Aurora retired, not removed**: `SITE_THEMES.aurora.retired`, still renders for any site on it (themeOf default
  unchanged), and still appears in THAT site's own picker (`pickThemesFor`, `siteThemeListFor`, `demoThemesFor`).
  Offered list `PICK_THEMES` = showcase, cinematic, editorial. New sites and demos start on Showcase; a rebuilt Aurora
  demo moves to Showcase; clinics still get Editorial, heavy trades Cinematic.
- 🔴 Showcase was appended LAST to SITE_THEMES because `motionRecipe` indexes by position (existing sites keep their
  motion), and it borrows Aurora's slot so the three offered designs never share a scene or entrance.
- Headline fix for all designs: the letter-by-letter entrance kept a trailing "." or "," in its own box, losing the
  font's kerning ("driveway ."). Punctuation now stays with the letter before it; Showcase also tucks it in (`.pn`).
- Marketing site: homepage hero image, Websites page and the car-detailing/window-tint samples now use Showcase
  (`scripts/build-site-showcase.cjs` now fetches Pexels through curl). /examples/aurora/ still exists, unlinked.
- Tests: `verify-showcase-design` (20 checks); site-builder, sample-sites, demo-sites, google-listing updated.

## 2026-11-04: Exit button on website previews
Bryson: *"make sure that it's updated on the website and when any previews are made"* (checked: the live marketing site
serves Showcase; new sites, demos and pitch previews start on it) and *"add an exit button in a clients portal when
I'm viewing the preview for the website"*. The portal opens the site in a new tab, and on a phone there was no way back.
- Every `/site/<slug>/?preview=` page now carries a slim top bar, "Website preview. Not live yet." with **Exit preview**
  (`PREVIEW_BAR` / `withPreviewBar` in site.mjs). Never on the live site.
- Exit goes to the portal this browser last opened: the portal saves its own address (`/portal?token=...`, path only)
  to localStorage `bl_portal_back` (same origin), never from the OS's own portal preview. Only a `/portal?token=` path
  is accepted, within 7 days. Else `history.back()`, else `window.close()`, else the button says the tab can be closed.
- `tests/verify-preview-exit.mjs` (7 checks); driven in a browser: portal, tap See your website, Exit, back on the portal.
