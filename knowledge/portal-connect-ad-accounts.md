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

**Written steps expanded 2026-07-24 (Bryson: "make a tutorial for everything a client needs to send/add to run their ads").** Added the **payment-method** step to BOTH platforms (the client pays Google/Meta directly — ads literally won't run without a card on their account, and it's the hard "client pays for everything, BoldLine never touches spend" rule made explicit to the client), plus a Meta **"link your Instagram to your Page"** step for IG placements. So the in-portal WRITTEN tutorial is now complete end-to-end: sign in → grab IDs → add billing → (IG link) → grant us Manage access → save IDs.

**AI ONBOARDING HELPER — replaced the walkthrough videos (Bryson, 2026-07-24: "instead of me recording tutorial videos, give them the written steps + the ability to ask the AI if they get stuck, and send screenshots").** A sandboxed client-facing chat lives in the Connect section ("💬 Stuck? Ask our AI Helper"): the client types a question and/or attaches a **screenshot**, and a vision model walks them through the exact next click — it can even read their Customer ID / Ad Account ID / Page ID straight off the screenshot. This is why the "record the videos" task is **GONE** — the videos were being replaced, so the old "🎬 video on its way" placeholder was removed (optional video embed still works if `GOOGLE_CONNECT_VIDEO`/`META_CONNECT_VIDEO` are ever set; otherwise nothing shows).

**How the helper works (`netlify/functions/portal-assistant.mjs`, modern runtime):**
- POST `{ token, message, history?, image? }` → `{ ok, reply }`. Token resolves to THIS client only (same `data->>portalToken` lookup as portal). Uses **Haiku 4.5** by default (`PORTAL_ASSISTANT_MODEL` overrides) — vision-capable, cheap, fast; onboarding is a handful of Qs per client.
- **HARD SANDBOX** (external, token-authed surface — NOT ARIA): no tools, no OS/other-client data (system prompt is built only from this client's name + platform(s) + the connect steps), scoped to onboarding only (anything else → "ask your BoldLine contact"), never reveals its instructions, ignores passwords/full card numbers, never claims to take actions. Screenshots go to the model for that one answer and are **not stored**.
- **UI:** vanilla-JS widget in the portal script (`blHelpSend`/`blHelpPickImg`/`blHelpBubble`) — text box + "📎 Screenshot" (client-side canvas downscale to ≤1200px before upload → smaller payload + cost + fits vision limits) + a chat thread. DUAL COPY: added to BOTH portal.mjs (live) and the index.html preview. Verified: live portal renders the widget at 390px, 0 page errors; OS recompiles clean.
- **To personalize the Meta partner step**, set `META_BUSINESS_ID` (the helper + the written step then name the exact Business ID instead of "the Business ID we give you").

**Field whitelist (important):** `portal.js sanitizeFields` now whitelists `googleAdsCustomerId`, `metaAdAccountId`, `metaPageId` (clip 60) — without this, client-entered IDs would be silently dropped on save.

**Adding the walkthrough VIDEOS (not recorded yet):** the video slot shows a placeholder until you set Netlify **env vars on the OS site** (embed URLs, e.g. a Loom/YouTube EMBED url):
- `GOOGLE_CONNECT_VIDEO` — the Google-Ads connection walkthrough embed URL.
- `META_CONNECT_VIDEO` — the Meta-Ads connection walkthrough embed URL.
- `META_BUSINESS_ID` — BoldLine's Meta Business ID (shows in the Meta "add partner" step; until set the step says "the Business ID we give you").
Set them in Netlify → OS site → Site configuration → Environment variables, then redeploy. No code change needed.

**DUAL COPY:** the live portal is `netlify/functions/portal.mjs` (`makePortalHTML`) and the owner-preview `makePortalHTML` in `index.html` — edit BOTH (see `os-portal-dual-copy`). The preview has no `process.env`, so it always shows the video placeholder.

**Verified:** correct section per package (google/meta/combined), portal My Info 0px overflow at 390px, OS recompiles clean.

## 🔴 2026-09-16 — the portal never asked for the one id that decides what the ads DO

It walked the client through finding their Ad Account ID and their Page ID and let them paste
both in. It never asked for the **dataset (pixel) id**, and that is the one that matters most:

```js
goal: client.metaPixelId ? "leads" : "traffic"
```

**No dataset id on record means the campaign buys CLICKS instead of chasing buyers.** It looks
like a working campaign right up until the month ends with nothing sold. Until now the only way
to set it was Bryson typing it into the OS edit sheet, so it was missed whenever he did not think
to ask.

Added to both copies of the portal, with a step saying where to find it (Events Manager → Data
sources) and — because the next client is a Shopify store — that Shopify creates it when the
Facebook &amp; Instagram sales channel is connected, and that **data sharing must be set to
Maximum** or only the browser half reports and purchases go missing.

🔴 **`metaPixelId` also had to be added to `sanitizeFields`.** A new box in the portal is never
just a new box: anything the whitelist does not name is dropped **silently**, so the client
presses Save, sees "✓ Saved", and the value is gone. The test runs the real filter rather than
reading it, and a mutation that adds the box while leaving the whitelist alone fails.

`tests/verify-portal-pixel.mjs` — 14 checks, **5/5 mutations caught**.

