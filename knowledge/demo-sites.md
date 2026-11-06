---
name: demo-sites
topic: Websites
task: build a demo website for a company before a sales meeting, show it, turn it into a client, or sell / hand over a website bought outright ($2,500, no monthly)
keywords: [their photos, their videos, add photos or videos, demo photos, instagram photos, DemoMediaRow, mediaSign, mediaAdd, mediaRemove, demoSite.media, demo host, boldline-sites demo, demo link address, exit demo, back to the os, DemoViewer, openDemoView, demo-page.mjs, serveDemoPage, demoRedirect, BrandFixSheet, brandFromPicked, screenshot colours, cloudflare challenge, springbok colours, no website, no social media, just starting out, new business, social media link, facebook page, tiktok, normSocial, social.mjs, noContactYet, waitingForContact, mergeContact, action=contact, demoOnly, newBusiness, website demos screen, demos screen, opened signal, they opened it, recordOpen, __seen, demoOpenJS, me=1, listDemos, demo website, demo site, spec site, website before the meeting, show them their site, private link, they want it, buy it outright, bought outright, own it, buyout, $2500, handover, site files, download site files, zip, export site, mgmt own, WA-8, Purchase Agreement, demo-site.mjs, demo-site-background, DemoSiteBox, clientFromDemo, SiteFilesHandover, site-export.mjs, __mailto, researchFacts]
status: LIVE 2026-10-20
summary: Built 2026-10-20 (Bryson, "i want to build it for the full website for the company im cold calling when i hop on a meeting with them that way if they like it we just need to link their payment method"; pricing "$2500 ... if they want to include the $100/month for us to host it and do everything then itll be $1500 then the monthly"). On any Lead Scout or Outreach company labelled Website or Both, "Build their demo website" writes their full 5-page site with the real builder from public research facts (stock photos), served at os.boldlinemedia.com/demo/<random token>/ with a "Preview for <name>. Not live yet." strip, a guard that stops every send, noindex + no-store, no visit count, a 3-design switcher, and a 30-day expiry (rebuild keeps the same link). "They want it" picks Monthly plan ($1,500 + $100/mo) or Buy it outright ($2,500) and creates an unsigned website-only client with the demo as their website; the agreement and payment then go out from the Website tab as usual. Outright is a fifth agreement version (WA-8, "Website Design and Purchase Agreement": no monthly, handover of files, nothing after handover is ours); once fully paid the Website tab downloads the whole site as a zip made for THEIR domain (form opens the visitor's email app, booking off, photos copied in, read-me inside).
verified: 2026-10-20
---

## How Bryson uses it
1. Lead Scout or Outreach, a company labelled **Website** or **Both** > **Demo website** box > **Build their demo website**
   (about a minute; he can keep calling).
2. **Open their site** on the meeting, or **Copy link to text them**. "Opens in" picks the design the link opens on;
   the strip on the page also switches between the three.
3. **They want it** > **Monthly plan** or **Buy it outright**. That creates the client (unsigned, onboarding, website-only)
   with the demo already on their record and the plan pre-picked on the Website tab. Then: Website tab > send the
   agreement > send the payment link, exactly as any website client.
4. Outright only: once paid in full, Website tab > **Handover** > type their web address > **Download their site
   files** > send the zip to them or their web person.

## 🔴 Safety rules (all pinned in tests/verify-demo-sites.mjs, 55 checks)
- A demo is a PREVIEW for a business that agreed to nothing: the guard (same as the sample sites) is the first script
  on every page and answers every POST, beacon and form submit locally; the strip says what it is at every width;
  noindex meta + `x-robots-tag` + `no-store`; no visit counter; absolute links only.
- Only PUBLIC research facts reach the writer (`researchFacts`: rating, years, owner first name). Bryson's verdict and
  notes never do. Stock photos only: their Instagram photos are theirs until they buy.
- A company marked Do not contact cannot get a demo, and an old demo link of theirs 404s.
- Expires 30 days after building. Rebuild renews and keeps the same token, so a link already texted still works.
- Outright: the server forces care 0 and refuses "Put it live" on our hosting; the export refuses unless mgmt is
  `own` and the deal is fully paid. The exported pages link only to their domain, the form uses `__mailto`
  (site-render formScript), booking is switched to the quote form, no counter, photos copied in up to ~3.2MB.

## Where
| Piece | File |
|---|---|
| Rules, guard, strip, record shape | `netlify/lib/demo-site.mjs` |
| Builder (background, writes `scout_prospects.data.demoSite`) | `netlify/functions/demo-site-background.mjs` |
| Page + poll/theme/content | `netlify/functions/demo-site.mjs`, routes `/demo/:token/...` in netlify.toml |
| OS box + conversion | index.html `DemoSiteBox`, `clientFromDemo`, `DEMO_STORE` (state outside the card, because Lead Scout cards re-mount) |
| Outright version | `website-deal.mjs` (MGMT.own, normTerms, agreement sections 6/7/8), `pricing-shared.mjs` WEBSITE_OFFER.buyout, OS mirror wdNorm, `website-deal` function set-terms/launch |
| Handover zip | `netlify/lib/site-export.mjs` (hand-written zip), site.mjs action `export`, OS `SiteFilesHandover` |

## Live status
Merged to main Tue 2026-10-20 (Phoenix morning). The sample sites on boldlinemedia.com were regenerated in the same deploy because the shared form script changed (no visible change).

## 2026-10-20 (Tue, ~1:15pm Phoenix): outright sales are now hands-off after "Send the agreement"
Bryson: *"after they pay there is a place for them to type their own web address and once they do it automatically
sends to them that way I dont have to do it manually where there could be mistakes"*, then "yes lets do it and give
me a visual preview of the whole process". Built:
- **Paying was already automatic**: signing triggers the first Stripe invoice plus the `website_welcome` email with
  the pay link (docusign-watch). For outright the welcome now explains the outright steps and drops the "give us
  access to your domain" paragraph (`own` flag in client-email-auto ctx AND the OS Emails tab ctx; a test pins both).
- **Paid in full** (`website_payment`, stage full or final, `own`): subject "Paid in full, your website is ready to
  download", button **Get Your Website Files** to the portal (button image generated by build-email-buttons).
- **Client portal, Website tab** (`siteFilesCardHTML` in portal-website.mjs): before payment "ready the moment your
  payment is in"; once paid it LEADS the tab: web address typed twice, **Download my website** (portal POST
  `siteFiles`, same exporter, photos capped at 2.4MB for the response size), a five-step Netlify Drop guide, and
  **Have BoldLine host it for me** (POST `hostRequest`: alert + log only, plan unchanged; moving to the Care Plan
  takes a new agreement). Status reads "Paid in full, ready to download" / "It's yours".
- Server re-checks: outright only (403), fully paid (409), both addresses equal after cleaning (400). First download,
  or a download for a different address, alerts Bryson (green) and logs to commLog; `handedOverAt/To` +
  `lastDownloadAt` on websiteDeal.
- 🔴 Gotcha: the portal script lives in a template literal, so `\/` in a regex collapses to `/` and the WHOLE portal
  script failed to parse. Rewrote the address cleaner with `split` instead of a regex; a test now parses
  WEBSITE_PORTAL_JS.
- Fixed on the way: a demo-made client's Website tab did not pre-pick "bought outright" (wdDeal fills a default price,
  so the seed now reads the raw record), and the Send confirmation said "Care plan" for outright.
- Visual walkthrough (private artifact, real screens): https://claude.ai/artifact/EiUz5zNhxmghyqGn21pfaa
Tests: verify-demo-sites now 70 (section 7). Full suite 168/168.

### Preview gotcha (2026-10-20): broken picture icons were the screenshot machine, not the emails
Bryson saw broken-image icons on the email buttons and logo in the walkthrough. Cause: the screenshot browser here
cannot reach the internet, and the email buttons are PICTURES hosted at boldlinemedia.com/email/v1/ (on purpose: Gmail's
iPhone dark mode turns a drawn gold button olive, KB email button note in netlify/lib/email-button.mjs). Checked live:
logo, pay-the-invoice, open-your-portal and get-your-website-files all return 200. For future previews, fetch
boldlinemedia.com through curl in the Playwright route (as the walkthrough's shot.cjs now does) so pictures show.
Only real-world gap: an email app that blocks pictures (mainly Outlook on a computer) shows the gold button with the
words on it; that is the designed fallback.

## 2026-10-21: booking and payments on the handed-over site
The download card now asks how customers book (their booking app link, call, or request form) plus an optional payment link before it downloads, checks the links, and lets them switch apps later by downloading again. The Download button itself was broken until then (read the server answer twice). Full detail in KB `own-site-booking`.

## Pitch previews for EXISTING clients (2026-11-03)
Bryson, on Springbok: *"I don't want to make the website and him have access to download it or use it until he pays but
I want to be able to show him and pitch it"*. Demos only worked for Lead Scout/Outreach prospects, and the client
Website tab won't build before signed + paid, so there was no way.
- Website tab, card **"Preview to pitch"** (under the website agreement and "What we need from them"; the Overview's website offer has a
  "Show them a preview" button that opens it). Same builder, same `/demo/<token>/` link, guard, preview strip, noindex,
  design switcher and 30-day expiry as a demo (`demo-site-background` `{clientId}`; `demo-site` POST `{clientId}`;
  GET falls back to `clients` where `data.pitchSite.token` matches).
- 🔴 Stored on `pitchSite` (server-owned), NEVER `website`: not in the portal, no download, no publish. "Make it their
  website" appears only when `wdBuildLock` is clear (website agreement signed AND first payment in), copies the words,
  photos and design into `website` unpublished (`fromPitch`). Hidden for internal records and once a site is live.
- The writer gets `pitchWriterOf`: name customers see (website brandName / reviewSenderName / dba), niche, services,
  brand voice, service area, main offer, portal intake. 🔴 Never `notes`, `qualifiedLeadDef` or billing fields. The
  renderer gets `pitchClientOf` (leadToken/landingSlug "demo", no email/portal token).
- `tests/verify-pitch-preview.mjs` (18 checks, 4 mutations caught). Driven at 390/768/1280/1600.

## Website demos screen + "they opened it" (BUILT 2026-11-05)
Bryson: "build a way to just create a website for a company in its own section in the os that way if a client isn't in
outreach I can still build a website to pitch them", then "build it with the signal that they opened it".
- **Screen:** Get clients > **Website demos** (`WebsiteDemosScreen`; sidebar, phone More sheet, Ctrl K "Website demos";
  screen id `demos`). Form: name*, what they do, town, phone, current website, email (one way to reach them required, the
  same rule as Outreach's add-by-hand). Build = outreach `action=add` with `pitch:"website"` (a duplicate is REUSED; one
  labelled ads becomes "both"; one with a live demo is not rebuilt) then demo-site-background `{prospectId}` + demoPoll.
  So every demo built here is also in Outreach, and "They want it" still creates the client. List = demo-site POST
  `action:"list"` (`listDemos`): prospects with a demoSite + clients with a pitchSite, picked field by field (never the
  15KB of words), with status, design, mode, expiry and opens. Filters All / Opened / Not opened yet / Link ended; top line
  names who opened this week. Refreshes every minute while open.
- **The signal:** `demoOpenJS` in every demo page (after the send-nothing guard, which is NOT weakened: the ping is a GET,
  which the guard already lets through) sends `GET /demo/<token>/__seen` once per tab, only after a scroll/tap/key or 6s
  on screen (a texting app's link preview does neither), never with `navigator.webdriver`, never in a tab opened from the
  OS (every OS "Open" link carries `?me=1`, remembered in sessionStorage). Server `recordOpen`: refuses preview robots by
  user agent (`PREVIEW_BOT`), blocked companies, expired or unfinished demos; repeats within 10 min are one visit; writes
  `opens`, `firstOpenedAt`, `lastOpenedAt` on demoSite (prospects: WITHOUT touching updated_at, so the call list never
  reorders) or pitchSite (clients). The FIRST open sends a push ("<name> opened their demo website. Good time to call while
  it's fresh."), push only, no email or text. The Outreach demo box and the client pitch card show "They opened it 2 hours
  ago (3 visits)" / "Not opened by them yet".
- Caveat said to Bryson: if HE opens the copied link himself (not the OS's Open button), it counts as them.
- Tests: `tests/verify-demo-opened.mjs` (33, incl. real-browser: scroll counts once, 2.5s preview does not, 6.7s of reading
  does, ?me=1 and webdriver never).

## Businesses with NO website (2026-11-05)
Bryson: "I need to be able to do it for companies that don't have a website at all. Right now I'm talking to a mobile tint
guy and he posts on instagram but he doesn't have a website." The builder never needed a website (it writes from what is on
the record), but two things blocked it: the add form demanded a phone, email or website, and a phone typed by hand never
reached the demo (manual rows keep it in `data.phones[]`, the demo read `data.phone`). Now:
- `buildManualProspect` accepts `instagram` (any handle or profile link, cleaned by `normInstagram`, stored on the existing
  `data.instagram` that Outreach's DM mode already uses) as a way to reach them, plus PUBLIC `services` (comma list, max 8)
  and `about` (max 400). `notes` stay private and never reach the writer.
- `demoClientOf` falls back to `phones[0].number` and adds `about` to the facts the writer may use.
- Website demos form: Instagram, "What they offer", "Anything true about them (goes on the site)", and the website box says
  "leave blank if they don't have one". Outreach's add-by-hand form has Instagram too.
- Photos are still stock: their Instagram photos are theirs (see the rule at the top of lib/demo-site.mjs).

### Any platform, or nothing at all (2026-11-05, same evening)
Bryson: "The instagram was just an example but I need a way to build it for businesses without a website in general whether
they are on instagram or another social media platform or they don't even have social media and they are just starting out."
- **One social box for any platform.** `netlify/lib/social.mjs` `normSocial(value, platformForHandle)` reads a pasted link from
  any site (Instagram, Facebook, TikTok, X, YouTube, LinkedIn, Nextdoor, Yelp, Threads, Pinterest, Snapchat, Thumbtack, Angi,
  Houzz, Linktree, Google maps links; anything else is named by its domain) or a bare @handle on Instagram/Facebook/TikTok/X
  (the OS shows a platform picker only when a handle is typed). Every saved link is https. Stored as `data.socials[]`
  `{platform,url,handle}`; an Instagram one also fills `data.instagram` so Outreach's DM mode keeps working.
  - 🔴 GOTCHA fixed before ship: "tint.ninja.az" is an Instagram HANDLE (dots are common), not a domain. Without https:// a
    value is read as a link only if it has a path or is a known platform host.
  - A Facebook/Yelp/etc. link typed in the WEBSITE box is moved to socials and the website left blank, because a domain is
    used to tell companies apart and every business on facebook.com would otherwise look like the same one.
- **No contact at all is allowed, for a demo only.** The Website demos screen sends `demoOnly:true`; only the name and "What
  they do" are required. A row with no phone, email, website or social gets `data.noContactYet` and `waitingForContact()`
  keeps it OFF the call list (`isQueueable`), so an unreachable company never sits at the top of the queue being skipped.
  Outreach's own add-by-hand still requires a way to reach them.
- **Adding one later.** Such a card on Website demos shows an amber "No way to reach them yet, so they're off your call
  list" box with Phone + Social + Save > outreach `action=contact` > `mergeContact()` (appends, never overwrites, never the
  same link twice, clears `noContactYet`). It then joins the call list.
- **"They're just starting out"** tick box > `data.newBusiness` > `demoClientOf` tells the writer: a brand-new business with no
  years in business, past customers, reviews, ratings or awards to mention. Stops a demo inventing a track record.
- The Outreach call card now shows each social link (↗ Facebook etc.) beside phone/email/site, https only.
- Pinned by `tests/verify-demo-opened.mjs` section 4.

## Demo host, the in-OS viewer, and colours from blocked sites (2026-11-05, evening)
Bryson: "make sure for the demo sites there is a way to exit out of them in the os and also make sure that when I send
the link that there is no way for the person with the link to be able to access the os", then "I added springbok
wellnesses website and it didn't work".
- 🔴 **Demo links live on the client-websites site now: `https://boldline-sites.netlify.app/demo/<token>/`**
  (`DEMO_HOST`/`DEMO_ORIGIN` in lib/demo-site.mjs, `DEMO_ORIGIN_OS` in index.html, pinned equal by
  `tests/verify-demo-host.mjs`). Served by `sites/functions/demo.mjs` (GET/HEAD only) through the lean
  `netlify/lib/demo-page.mjs` (`serveDemoPage`, `renderDemo`, `parseDemoPath`), which must NOT import the OS demo
  function (that drags report/push code into the client-websites build: verify-sites-split). The page's "they opened it"
  ping goes to `<demo host>/demo/<t>/__seen`, which passes it server to server to the OS function (push needs the OS's
  keys); the OS address appears only there, never in the page.
  - The OS function no longer renders demo pages: every GET on `os.boldlinemedia.com/demo/...` (links already sent)
    gets a **302** to the same page on the demo host (`demoRedirect`); `__seen` is still recorded there.
  - Why: the old address told every prospect where the OS is and ran their page on the OS's own origin. That host has
    no OS on it. Rendered pages were checked to contain no OS address and no relative links.
  - Optional later: a branded address (e.g. preview.boldlinemedia.com) = DNS record + Netlify alias on boldline-sites,
    then change both constants. Not done.
- **In-OS viewer** (`DemoViewer` / `openDemoView`, mounted once in App): every Open button (Website demos card,
  DemoSiteBox "Open their site", PitchPreviewCard "Open the preview") opens the demo over the OS with a gold
  "✕ Back to the OS" button (Esc works) and "Open in browser ↗". Before, Open navigated away, and the home-screen app
  (manifest scope "/") had no back button. The frame: `sandbox="allow-scripts allow-popups
  allow-popups-to-escape-sandbox"` (preview-safety manifest row "Demo website"). `demoOpenJS` never pings inside a frame,
  because a sandboxed frame has no storage to remember ?me=1 across pages.
- **Colours when a site blocks servers.** springbokwellness.com sits behind Cloudflare's "Just a moment..." challenge:
  403 to any server, and even a real headless browser from a data centre stays stuck. We do NOT try to get round it
  (a browser-disguise retry was rejected as bot-check circumvention). Instead the brand action answers
  `{blocked:true}` and the OS opens `BrandFixSheet`: steps (open their site on your phone, screenshot the top, add it),
  the picture is sampled in the browser (`bkPalette(f,{gap:30,max:8})`, nothing uploaded), he taps the main colour or
  uses the colour picker, and `{primary, colors}` goes to the same action > `brandFromPicked()` (brand-scrape.mjs),
  saved with `from:"screenshot"`, keeping any earlier logo/fonts. The website address is asked in the same sheet (no
  more browser pop-up).
- 🔴 **For a client's pitch preview, colours taken via "Use their website's colours" (`pitchSite.brand`) now beat the
  landing page colour and the Website tab colour** (`pitchClientOf`). Otherwise Springbok's ad landing page colour
  would have hidden them. The Brand kit still wins over everything.
- Found on the way: Supabase sign-ups were open. See KB `os-signup-lockdown`.
- **Their own photos and videos from social media (asked same evening):** not pulled automatically (login walls; going
  round them breaks the platforms' rules and risks BoldLine's Meta app). Official Instagram route parked behind Meta
  approval (KB `meta-parked-work` item 5). Bryson said yes to the upload instead, built and LIVE 2026-11-05:
  - **Website demos card > "Their photos and videos" > + Add photos or videos** (every finished demo and client pitch
    preview card; NOT on Outreach's DemoSiteBox). Several at once from the phone. `DemoMediaRow` in index.html.
  - Photos are shrunk on the phone to 2000px JPEG (`demoPrepPhoto`; a format the browser can't draw, e.g. HEIC on
    Chrome, is refused with "take a screenshot instead"); videos up to 50 MB, MP4/MOV/WebM, tall/wide detected.
  - Server: demo-site POST `mediaSign` (one-time upload address in bucket `client-media` under
    `demo/p-<prospectId>/` or `demo/c-<clientId>/`, `demoMediaPrefix`), browser PUTs the file, `mediaAdd` records
    `{kind,url,path,tall,at}` on `demoSite.media` / `pitchSite.media`; `mediaRemove` deletes from storage too.
    Max 12 photos + 3 videos (`DEMO_MEDIA_MAX`). Paths outside the demo's own folder are refused.
  - On the page: photos become `mediaLibrary` photos (site-render puts them in front of stock everywhere); videos become
    one "<name> at work" section (`demoVideoBlocks`), using the new video-block `clips` (2-3 side by side) and `tall`
    (9:16) options in site-render `cleanBlock`/`renderBlock`. A block without clips renders exactly as before.
  - "They want it" and a client adopting a pitch preview carry them over (`demoPhotosToLibrary`, `demoVideoBlockOS`);
    the client's portal can delete a carried-over photo because media.mjs allows a `demo/` path that is in THEIR library.
  - The rule at the top of lib/demo-site.mjs changed from "stock photos only" to "their own photos on this private demo
    only, added by Bryson". Pinned by `tests/verify-demo-media.mjs`.
