---
name: google-listing
topic: Google Business Profile
task: run a business's Google Business Profile from the OS (reviews, review replies, weekly posts, profile numbers), connect Google, or sell the Google profile add-on
keywords: [google listing, google business profile, GBP, business profile api, GBP_CLIENT_ID, GBP_CLIENT_SECRET, gbp-connect, gbp-watch, GoogleListingCard, gbpDrafts, gbpLog, review replies, local posts, localPosts, business.manage, fetchMultiDailyMetricsTimeSeries, google profile management]
status: LIVE, connected 2026-11-06 (BoldLine's own profile, as theboldlinemedia@gmail.com)
summary: Built 2026-10-26 after Google approved the Business Profile API (project 69639870912, 2026-10-23). A "Google listing" card on the Overview of BoldLine's own account and each owned business shows the profile's last 28 days (rating, calls, website clicks, direction requests, times seen, each against the 28 days before), every review still waiting for a reply with a drafted reply, and this week's post, all editable. NOTHING reaches Google until Bryson presses Post and confirms the exact words. A daily job (8:41am Phoenix) drafts replies to new reviews and, from Tuesday, next Monday's post (which goes up by itself Monday 8am unless held), and messages him (amber when a 1 or 2 star review is waiting). Needs GBP_CLIENT_ID and GBP_CLIENT_SECRET from an OAuth client in the BoldLine OS Cloud project, then "Connect Google" once.
verified: 2026-10-26
---

**Why (Bryson, 2026-10-23):** "yes" to building it after Google's approval email. BoldLine's own profile and his
detailing business first, then clients as the Google profile add-on (about $150 a month, KB `service-add-ons`).

## How it works
- `netlify/lib/gbp.mjs`: connecting (signed 30-minute state, code exchange, key SEALED with AES-GCM in private
  storage `client-contracts/gbp/connection.json`, never on a business record), and the calls:
  - accounts and locations: Account Management + Business Information APIs;
  - reviews and replies, and local posts: the v4 Google My Business API;
  - numbers: Business Profile Performance `fetchMultiDailyMetricsTimeSeries`, 56 days ending 3 days ago (Google
    trails), split into the last 28 against the 28 before.
- `netlify/functions/gbp.mjs` (owner session only) actions: status, start, disconnect, locations, link/unlink,
  overview, draftReply, draftPost, reply, post, dismiss.
- `gbp-connect-done.mjs` is Google's return address (`/gbp-connect/done`). One connection for all of BoldLine: the
  Google account that is Owner or Manager on every profile (the business Gmail). A client gives access by adding that
  Gmail as a Manager on their profile.
- `gbp-watch.mjs`, daily at 15:41 UTC = 8:41am Phoenix. It drafts:
  - up to 5 replies per business per run, only for reviews with no reply and no draft that are newer than a month
    before linking;
  - on Mondays (Phoenix), the week's post, if there's no draft and nothing was posted in the last 5 days.
  It saves the drafts and alerts Bryson. It never publishes.
- Records: `gbp` (which profile), `gbpDrafts`, `gbpLog` (what was published). All server-owned, in
  `SERVER_OWNED_KEYS` in index.html (the portal's `googleLinkRequest` and `metaAccess` were added to it at the same
  time, since an OS save could otherwise have wiped them).

## Rules it enforces
- 🔴 **Publishing is only `reply` and `post`, each sent from the card after a confirm box that shows the words.**
  Drafting and the daily job never touch Google.
- Public words go through `cleanPublic`: no em or en dashes, no emojis, trimmed to a whole sentence. The prompts also
  ban AI-sounding words and never mention Google, BoldLine, marketing or AI. Google's approval email forbids implying
  that Google partners with, sponsors or endorses BoldLine.
- A post's button never points at BoldLine. "Call now" needs no address; the others go to the business's own website.
- One profile belongs to one business.
- Low ratings get a calm, make-it-right draft that invites them to call. The card outlines those reviews in amber.

## Setup (Bryson, at a computer; in the 10pm reminder of 2026-10-26)
1. **Cloud Console, project BoldLine OS.** Enable these four APIs: My Business Account Management, My Business
   Business Information, Google My Business, and Business Profile Performance.
2. **Google Auth Platform:**
   - Branding: app name "BoldLine Media", with the business Gmail.
   - Audience: External, then **Publish app** (In production). In Testing, the key would expire every 7 days.
   - Clients: Create client, type Web application, redirect `https://os.boldlinemedia.com/gbp-connect/done`.
3. **Netlify:** add env vars `GBP_CLIENT_ID` and `GBP_CLIENT_SECRET`, then redeploy.
4. **In the OS:** open BoldLine's account or the detailing business, go to the Google listing card, press Connect
   Google, sign in with the business Gmail and tick "manage Business Profiles". If Google shows "hasn't verified this
   app", choose Advanced and continue (it's our own app). Then pick the profile.
5. **For the detailing business:** the business Gmail must be Owner or Manager on its profile.
   That's **Corvane Auto Detailing**. Not yet as of 2026-10-27: the business and its Google profile aren't set up.
   He's connecting BoldLine's own profile first, from My Ads, then the Overview tab.

## Setup progress, checked with Bryson Fri 2026-11-06 evening (Phoenix)
- Cloud steps 1 and 2 done (he confirmed). Google Auth Platform: Audience **In production**, External, 0/100 user cap.
- OAuth client **"BoldLine OS listing"** (Web application) exists, made Oct 27 2026; redirect URI is exactly
  `https://os.boldlinemedia.com/gbp-connect/done`; one secret, enabled. Google no longer shows or downloads secrets
  after creation, so a lost secret means **Add secret** on that client (then put the new one in Netlify).
- The client shows "Last used November 3, 2026", so the OS has used it at least once: the Netlify keys are very
  likely already in place. Next: the Google listing card (My Ads > Overview) tells which state it is in
  ("Not switched on yet" = Netlify keys missing; "Connect Google" = keys in, not connected; numbers = connected).
- The yellow "requires verification" banners are expected: unverified is fine for our own use (100-user cap).
- ✅ **CONNECTED** (Bryson's screenshot, Fri 2026-11-06 evening): My Ads > Overview > Google listing shows "Connected as
  theboldlinemedia@gmail.com", profile "BoldLine Media". Last 28 days then: no reviews yet, 0 calls, 1 website click,
  0 direction requests, 47 times seen (down from 50). Setup finished; nothing left for him in Google or Netlify.
  The detailing business (Corvane) still needs its own profile before it can be connected.

## Tests
`tests/verify-google-listing.mjs` (59 checks) runs the real functions with Supabase, Google and Anthropic stubbed.
The card was driven in the real OS at 390, 768, 1280 and 1600 wide.

## On the website and sold to clients (2026-10-27, Bryson: "we will need to add this to the website", price "lets do $130")
- Price lives in one place: `GOOGLE_PROFILE = { monthly: 130 }` in `netlify/lib/pricing-shared.mjs`. No setup fee.
- The marketing site has a "Your Google profile, kept busy." section (`gbpSection()` in
  `scripts/build-marketing-site.mjs`, styles `.gp*` in `marketing-src/new.css`). It's on /pricing/ after website pricing,
  /ads/ after "included", and /websites/ before the FAQ. It also has a line in llms.txt.
- It promises only what's built: every review answered, a post every week, the profile's calls, website clicks and
  direction requests watched. The mock review and post are labelled "Example". It names Google Business Profile as a
  product and never implies a Google partnership.
- The OS card is now on EVERY business's Overview, including clients and website-only clients, not just BoldLine's
  own account and owned businesses.
- ✅ **In the agreements and billing since 2026-10-28** (Bryson: "yes"). A box on the Contract tab and on the website
  deal puts it in the agreement; billing starts by itself once signed and the profile is linked here. KB `addon-billing`.


## Weekly posts on the blog's clock (2026-10-28, Bryson: "just like the blogs and newsletter where its made on tuesday and posted on monday at 8am", plus editing and on demand)
- `gbp-watch` (daily 8:41am Phoenix) writes NEXT Monday's post on any day except Monday (so in practice Tuesday, with
  catch-up later in the week), unless a draft is waiting or that Monday's slot is already in `gbpLog` (`forSlot`).
  The draft carries `scheduledFor` = Monday 8:00 Phoenix = 15:00 UTC (`nextPostSlot`), and `held`.
- 🔴 **Posts now go up WITHOUT a button press.** `gbp-post-run` (`*/15 15-23 * * 1`, Monday from 8am Phoenix, retries
  every 15 min) publishes each due, un-held draft with the words as saved, then logs `{forSlot, auto:true}`, clears the
  draft and alerts (amber if one failed). Review replies are unchanged: they still wait for his approval.
- Card: "Goes up on Google Monday, Nov 2, 8:00 AM unless you change it", Save changes (`savePost`: words, button, hold;
  publishes nothing), Hold / Let it post, Post now (fills that Monday's slot via `forSlot`), Throw away, and "Write a new
  one" with an optional topic, any time (keeps the slot and hold of the draft it replaces).
- `postPayload`: a Book/Learn more button with no website, or one pointing at BoldLine, is dropped to "no button" on the
  automatic post rather than failing. 70 checks in verify-google-listing (5 new mutations caught).

## 2026-11-24: "nothing is being posted for my Google profile even tho we have the bot connected"
No live log access from the session, so the exact cause is confirmed from his card. Silent gaps found and fixed:
- `gbp-watch` did `continue` when reading reviews failed, so the week's POST was never drafted either, and its alert
  only fired when something was drafted: a failing read looked exactly like a quiet week. Now the post is still
  written and an amber alert says what failed (`problems`). Same for a post that couldn't be written.
- Google connection missing while a profile is linked used to return silently; now an amber "Google listing is
  disconnected" alert tells him to press Connect Google.
- verify-google-listing 73 (new: failed review read still writes the post + amber alert; mutation caught).
Ask him: My Ads > Overview > Google listing card. A post waiting = it goes up Monday 8am; "held" = press Let it post;
nothing = run this week's job (Tuesday onward) or "Write a new one"; disconnected = Connect Google.
Photos advice given (GBP email "add photos"): real photos only, no stock; logo + cover, him at his desk, the OS on a
laptop/phone (sample data), screenshots of sample sites he built, team/working shots; add a few each month.
Photo upload to GBP is not automated by the OS (only posts and review replies).
- 2026-11-24 Google profile photo pack made (scratchpad gbp/, render.mjs): 1 Logo 720x720, 2 Cover 1600x900 ("Google
  and Meta ads, and the websites behind them."), 3-5 sample websites (auto detailing / window tint / handyman example
  sites, real renders, labelled "Sample website ... (made-up business)") on laptop + phone, 6 How it works card (pay per
  qualified lead, ad budget on your card, nothing live without your OK). Declined to AI-generate fake photos of him or
  an office (misleading; Google can remove). Real photos of him/his setup still recommended alongside.
- 2026-11-25 Bryson: "Can't the ai add those itself?" Answer: not today. gbp.mjs has no photo/media code; the bot only
  drafts/publishes posts and review replies. Google's API CAN add photos to a profile and attach a photo to a post
  (v4 locations.media / localPosts media with a public sourceUrl), so it's buildable: offered (a) every weekly post
  carries a picture, (b) a "Send to Google profile" button for photos from the media library, published only after he
  confirms, never AI-made photos of people. Awaiting his yes.
  His live profile photos then: a vacation selfie in sunglasses (advise replacing with a real headshot), the logo
  (keep), an old ad graphic "Slow weeks. Inconsistent leads." containing an em dash and "steady, predictable leads"
  (advise removing).

## 2026-11-25: PHOTOS, BUILT and live (Bryson: "Can you make it so the bot can add the photos" + "make sure it works for clients too")
- `gbp.mjs`: `addPhoto` (v4 `{location}/media`, mediaFormat PHOTO, `locationAssociation.category`, Google fetches
  `sourceUrl`), `PHOTO_CATS` (ADDITIONAL, PRODUCT, AT_WORK, TEAMS, INTERIOR, EXTERIOR, COVER, LOGO; mirrored as
  `GBP_PHOTO_CATS` in index.html), `photoUrlOk` (https + .jpg/.jpeg/.png only), `photoChoices(cl)` = the business's own
  library photos (not video/review/source) + for BoldLine's own account ONLY the `BRAND_PHOTO_PACK` (brand/gbp/*.jpg in
  the repo, served at https://os.boldlinemedia.com/brand/gbp/...), `photoAllowed`, `pickPostPhoto` (never logo/cover,
  least recently used by gbpLog `photo`), `createPost` adds `media` when a photo is given, `postPayload` carries `photo`.
- Weekly posts: `gbp-watch` drafts include `photo`; `gbp-post-run` posts with it and, if Google refuses the picture,
  posts the words alone and says "(without its picture: Google said ...)" in the alert. gbpLog post entries keep `photo`.
- OS card: picture picker under the post (or "No picture"), "Photos on Google" grid (thumb, kind dropdown, Add to Google
  with a confirm naming it, "✓ On Google" once sent), log shows "Photo added to Google (by the client)".
  Server: action `photo`; `savePost`/`post` accept `photo`; all refuse any URL not in `photoChoices`.
- Client portal (Your Photos & Video card): "Add to Google" on each JPG/PNG photo once their profile is linked;
  `media.mjs?action=google` (portal token): photo must be in THEIR library, profile linked, max 10/day, logs gbpLog
  `{type:"photo", by:"client"}` + commLog, blue alert to Bryson. Portal preview can't send (fetch wrapper blocks POST).
- verify-google-listing 91 (18 new; mutations caught: client sending a non-library photo, pack leaking to clients).
- Bryson to do: nothing for BoldLine (pack is built in: open My Ads > Overview > Google listing > Photos on Google and
  press Add to Google). For a client: their photos must be in their library (they upload in the portal, or he does).
