# BoldLine OS — Integrations & Setup Log

Detailed record of external-platform setup.

> **No secret values are stored here** — only variable names, non-secret account
> identifiers, decisions, and state. All credential values live only in Netlify
> environment variables.

Last updated: **2026-06-25**

## Netlify environment variables
All app secrets live here. Convention: ALL_CAPS_SNAKE_CASE, marked **"Contains
secret values"**, same value across Production / Deploy Previews / Branch deploys /
Preview Server & Agent Runners (Local development is dropped automatically for
secret vars — we don't use the Netlify CLI locally, so this is fine).

Pre-existing vars: `OWNER_EMAIL`, `OWNER_PHONE`, `REPORTS_FROM_EMAIL`,
`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `URL`.

---

## DocuSign (e-signature) — credentials DONE ✅ · code built ✅ · live-verify pending ⏳
- **Environment: DEMO / sandbox** (`demo.docusign.net` REST base + `account-d.docusign.com` auth server).
  - ⚠️ **Demo signatures are NOT legally binding** (watermarked). Before the first
    real client: open a **production** DocuSign account, complete the **Go-Live
    promotion** (requires ~20 successful API calls in demo first), and regenerate
    ALL DocuSign credentials for production. This is known future work.
- Auth method: **JWT Grant** (server-to-server, unattended). One-time consent grant
  **COMPLETED 2026-06-25** (redirect landed cleanly with `?code=...`).
- Account: BoldLine Media, account #48872018. Integration type: **Private custom
  integration** (locks once Go-Live passes "Ready to Submit" — chosen deliberately).
- RSA keypair generated (public key auto-registered with DocuSign; private key
  saved to Netlify only). Placeholder redirect URI `https://www.docusign.com`
  registered — required for the consent flow, otherwise unused.
- Env vars: `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`,
  `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_BASE_PATH` (= `https://demo.docusign.net`).
- **Code (built 2026-06-25):** `netlify/functions/docusign-send.mjs` — JWT Grant
  auth + envelope send, secured by the owner's Supabase session. Front end wired in
  two places: "Send via DocuSign" on a client's Contract tab (sends the rendered
  service agreement, marks contract "pending", stores `docusignEnvelopeId`), and a
  "Test DocuSign Connection" card on the Deploy tab (sends a non-binding test
  envelope to any email — self-serve credential verification). Signature tab is
  placed on an invisible `/BL_SIGN_HERE/` anchor in the contract.
- **TODO (Task #9):** (1) live-verify via the Test card once deployed; (2) later,
  envelope status sync (webhook/poll) so a signed contract flips status to "active"
  automatically; (3) production promotion before first real client (see warning above).

## Google Ads API — credentials DONE ✅ · awaiting approval + first client ⏳
- Architecture: one **MCC** manager account (#989-283-2533) + one Developer Token +
  one OAuth refresh token operate across all linked client accounts via the
  `login-customer-id` header.
- Google Cloud project created, Google Ads API enabled. OAuth consent screen
  **published to PRODUCTION** (avoids the 7-day refresh-token expiry of Testing mode).
- Two OAuth clients exist: a **Desktop-app** one (unused — OAuth Playground rejected
  it with `redirect_uri_mismatch`) and a **Web-application** one (the one in use; has
  `https://developers.google.com/oauthplayground` as an authorized redirect URI).
  The refresh token was generated via OAuth Playground against the Web-app client, so
  the `CLIENT_ID`/`CLIENT_SECRET` in Netlify must be the **Web-app** client's.
  (Refresh tokens are bound to the client that issued them.)
- Developer Token: currently **Explorer Access** (test accounts only). **Basic Access
  application submitted 2026-06-25** (~3 business-day review). The application
  included a custom design doc that cited the Task #8 approval-queue as the
  human-in-the-loop safety story.
- Env vars: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
  `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
  `GOOGLE_ADS_MANAGER_CUSTOMER_ID` (= `989-283-2533`, stored WITH dashes; code will
  strip them when calling the API).
- **TODO:** wait for Basic Access (Task #16) → link first client account to the MCC
  (Task #17) → build the Ads API code.

## Stripe (BoldLine service-fee billing) — NOT started ⏳
- Purpose: bill clients **BoldLine's management/service fee only**. NOT ad spend —
  the client pays Google/Meta directly (see hard business constraint in CLAUDE.md).
- Research/walkthrough already given in chat. Task #10.

## Meta Marketing API — NOT started ⏳
- **Longest approval pipeline** of all four (Business Verification + app review —
  can take weeks). Worth starting EARLY so the clock runs in the background. Task #12.

## Reference: existing OS safety capability
- **Task #8** built a human-in-the-loop guardrail: `propose_action` → `pendingActions`
  queue → Approve/Reject. No automated process executes a real ad-account change
  without manual approval. Reused as the safety story in the Google Ads Basic Access
  design doc, and the model for how all "guarded autonomy" should work.

---

## Deferred (do not start until OS automation is done)
- **Task #18:** rebuild BoldLine Media's own website (custom-built, Netlify-hosted,
  domain `boldlinemedia.com` DNS repointed from Wix — no Wix Premium / no registrar
  transfer needed) **+** add an AI website-builder feature into the OS itself
  (extending the existing AI landing-page generator). Bryson may later sell full
  website builds as a service. Explicitly deferred until Tasks #9–17 are done.
