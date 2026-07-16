---
name: docusign-integration
topic: OS app
task: send or debug DocuSign e-signature envelopes from the OS, and plan the production go-live
keywords: [docusign-send.mjs, jwt-grant, normalizeKey, DOCUSIGN_PRIVATE_KEY, go-live, BL_SIGN_HERE]
status: verified
summary: DocuSign e-sign is live-verified in DEMO/sandbox via JWT Grant (docusign-send.mjs). Demo signatures are NOT legally binding — production needs Go-Live promotion (~20 demo API calls) + regenerated creds before the first real client. Watch the multi-line PEM paste gotcha (normalizeKey self-heals it).
verified: 2026-07-02
---

**Status:** credentials done, code built, **live-verified 2026-06-25** in **DEMO/sandbox** (REST base = the DocuSign demo host, held in `DOCUSIGN_BASE_PATH`; auth via the DocuSign demo auth host). Full JWT round-trip (sign → token → envelope → deliver) confirmed end to end via the Deploy-tab test card.

**Auth:** **JWT Grant** (server-to-server, unattended); one-time consent completed 2026-06-25. RSA keypair (public auto-registered with DocuSign; private key stored in Netlify only). Account: BoldLine Media (account number is on file in the DocuSign portal — not stored here). Integration type: **Private custom integration** (locks once Go-Live passes "Ready to Submit").

**Env vars:** `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_BASE_PATH`.

**Code:** `netlify/functions/docusign-send.mjs` — JWT auth + envelope send, secured by the owner's Supabase session. Front end in two places: "Send via DocuSign" on a client's Contract tab (sends the rendered service agreement, marks the contract "pending", stores `docusignEnvelopeId`; the signature tab sits on an invisible `/BL_SIGN_HERE/` anchor in the contract), and a "Test DocuSign Connection" card on the Deploy tab (non-binding test envelope to any email — self-serve credential check).

**GOTCHA — multi-line PEM paste (cost ~3 retries):** pasting a multi-line PEM into Netlify's secret field collapses the internal newlines, and Node's `crypto` then rejects the malformed PEM at the `sign` stage. Fix in code: `normalizeKey()` rebuilds canonical PEM (re-wraps the base64 body at 64 chars) whenever the BEGIN/END markers survive, so a flattened paste self-heals; the sign-stage error also returns non-secret structural facts (length, line count, marker presence) for diagnosis. **Expect the same on the production key — cleanest is to keep the newlines intact on paste.**

**GO-LIVE PROGRESS (2026-07-14):** The demo integration was **eligible ("Ready to Submit")** — the ~20-call requirement was already met. Ran **Go Live** on the "BoldLine OS" integration key (its value is `DOCUSIGN_INTEGRATION_KEY` in Netlify — never write the GUID here), accepted the integration-type/billing T&C (type is correct: private server-to-server JWT for sending our own contracts — locks once pending/live), and **promoted it into the production account** (account # is `DOCUSIGN_ACCOUNT_ID` in Netlify; owner Bryson A. Weiser). Status is now **"Pending approval — Submit verification form"** (DocuSign reviews within ~48h). All of this is FREE.

**Remaining to actually send binding contracts (the paid/setup half — DEFERRED until a client is close, per lean-spend):**
1. **Submit the verification form** (free) → wait ~48h for approval. [in progress 2026-07-14]
2. Production account `176800420` needs an **eSignature plan with API access** (the monthly fee — ~$25-45/mo tier; the free tier won't API-send). Don't activate until a deal is imminent.
3. **Regenerate/register production credentials:** register the RSA **public** key on the production app + complete a **one-time JWT consent** for production. New values differ from demo: prod `DOCUSIGN_ACCOUNT_ID` = 176800420's API account id, prod `DOCUSIGN_USER_ID` = the prod user GUID, `DOCUSIGN_BASE_PATH` = the production host (e.g. `https://na*.docusign.net`, NOT demo.docusign.net — the code auto-switches the auth host to account.docusign.com when BASE_PATH lacks "demo"). Integration key may carry over.
4. **Swap the 5 Netlify env vars** (OS site) to the production values, redeploy, test one send. **Do NOT swap early** — pointing the OS at production before the plan + consent are done breaks the working "Send via DocuSign". Keep demo creds live until the final cutover.

Demo signatures remain **not legally binding** (watermarked) until the above is done.

**TODO (not blocking):** envelope status sync (webhook/poll) so a signed contract auto-flips "pending" → "active"; exercise the real Contract-tab send path (same verified backend, only the contract-HTML rendering path is untested).
