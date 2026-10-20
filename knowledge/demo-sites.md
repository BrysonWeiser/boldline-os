---
name: demo-sites
topic: Websites
task: build a demo website for a company before a sales meeting, show it, turn it into a client, or sell / hand over a website bought outright ($2,500, no monthly)
keywords: [demo website, demo site, spec site, website before the meeting, show them their site, private link, they want it, buy it outright, bought outright, own it, buyout, $2500, handover, site files, download site files, zip, export site, mgmt own, WA-8, Purchase Agreement, demo-site.mjs, demo-site-background, DemoSiteBox, clientFromDemo, SiteFilesHandover, site-export.mjs, __mailto, researchFacts]
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
