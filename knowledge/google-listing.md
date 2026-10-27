---
name: google-listing
topic: Google Business Profile
task: run a business's Google Business Profile from the OS (reviews, review replies, weekly posts, profile numbers), connect Google, or sell the Google profile add-on
keywords: [google listing, google business profile, GBP, business profile api, GBP_CLIENT_ID, GBP_CLIENT_SECRET, gbp-connect, gbp-watch, GoogleListingCard, gbpDrafts, gbpLog, review replies, local posts, localPosts, business.manage, fetchMultiDailyMetricsTimeSeries, google profile management]
status: built, waiting on setup
summary: Built 2026-10-26 after Google approved the Business Profile API (project 69639870912, 2026-10-23). A "Google listing" card on the Overview of BoldLine's own account and each owned business shows the profile's last 28 days (rating, calls, website clicks, direction requests, times seen, each against the 28 days before), every review still waiting for a reply with a drafted reply, and this week's post, all editable. NOTHING reaches Google until Bryson presses Post and confirms the exact words. A daily job (8:41am Phoenix) drafts replies to new reviews and a Monday post, and messages him (amber when a 1 or 2 star review is waiting). Needs GBP_CLIENT_ID and GBP_CLIENT_SECRET from an OAuth client in the BoldLine OS Cloud project, then "Connect Google" once.
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

## Tests
`tests/verify-google-listing.mjs` (59 checks) runs the real functions with Supabase, Google and Anthropic stubbed.
The card was driven in the real OS at 390, 768, 1280 and 1600 wide.
