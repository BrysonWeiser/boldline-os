---
name: portal-connect-ad-accounts
topic: OS app
task: the client-portal "Connect Your Ad Accounts" tutorials + self-entry of ad IDs, and how to add the walkthrough videos
keywords: [portal, connect, tutorial, video, googleAdsCustomerId, metaAdAccountId, metaPageId, GOOGLE_CONNECT_VIDEO, META_CONNECT_VIDEO, META_BUSINESS_ID, sanitizeFields, conditional-by-platform]
status: verified
summary: Client portal (My Info tab) has a "Connect Your Ad Accounts" section that shows ONLY the platform(s) the client's package runs (Google/Meta/both). Each has a walkthrough-video slot + click-by-click steps + input fields so the client self-enters their IDs (googleAdsCustomerId / metaAdAccountId / metaPageId), which save to the client record and drive the OS ad-runners. Built 2026-07-22.
verified: 2026-07-22
---

**What it is (Bryson request 2026-07-22):** in the client portal **My Info** tab, a "Connect Your Ad Accounts" block that teaches the client how to give BoldLine what we need to run their ads — shown **conditionally** so a Google-only client sees only the Google steps, a Meta-only client only Meta, a combined client both.

**Conditional logic:** `hasGoogle = /google/i.test(pkg.platform)`, `hasMeta = /meta|facebook|instagram/i.test(pkg.platform)`. Driven by the client's package platform.

**Each section has:** a walkthrough-video slot, click-by-click steps, and **input fields the client fills in themselves**:
- Google → `googleAdsCustomerId` (+ **add a payment method** in Billing → Payments, + "approve our manager link request").
- Meta → `metaAdAccountId` + `metaPageId` (+ **add a payment method** in Billing → Payment settings, + link Instagram to the Page for IG ads, + Partners → Add our Business ID → share as Manage).
These are the SAME per-client IDs the OS uses to run ads (Edit → Campaign → Ad Account Linking). The client's entries save via the portal Save button.

**Written steps expanded 2026-07-24 (Bryson: "make a tutorial for everything a client needs to send/add to run their ads").** Added the **payment-method** step to BOTH platforms (the client pays Google/Meta directly — ads literally won't run without a card on their account, and it's the hard "client pays for everything, BoldLine never touches spend" rule made explicit to the client), plus a Meta **"link your Instagram to your Page"** step for IG placements. So the in-portal WRITTEN tutorial is now complete end-to-end: sign in → grab IDs → add billing → (IG link) → grant us Manage access → save IDs. **STILL TODO (Bryson's part): record the two short walkthrough VIDEOS** and set `GOOGLE_CONNECT_VIDEO` / `META_CONNECT_VIDEO` / `META_BUSINESS_ID` (below) — until then the video slot shows a placeholder that says the written steps have everything.

**Field whitelist (important):** `portal.js sanitizeFields` now whitelists `googleAdsCustomerId`, `metaAdAccountId`, `metaPageId` (clip 60) — without this, client-entered IDs would be silently dropped on save.

**Adding the walkthrough VIDEOS (not recorded yet):** the video slot shows a placeholder until you set Netlify **env vars on the OS site** (embed URLs, e.g. a Loom/YouTube EMBED url):
- `GOOGLE_CONNECT_VIDEO` — the Google-Ads connection walkthrough embed URL.
- `META_CONNECT_VIDEO` — the Meta-Ads connection walkthrough embed URL.
- `META_BUSINESS_ID` — BoldLine's Meta Business ID (shows in the Meta "add partner" step; until set the step says "the Business ID we give you").
Set them in Netlify → OS site → Site configuration → Environment variables, then redeploy. No code change needed.

**DUAL COPY:** the live portal is `netlify/functions/portal.mjs` (`makePortalHTML`) and the owner-preview `makePortalHTML` in `index.html` — edit BOTH (see `os-portal-dual-copy`). The preview has no `process.env`, so it always shows the video placeholder.

**Verified:** correct section per package (google/meta/combined), portal My Info 0px overflow at 390px, OS recompiles clean.
