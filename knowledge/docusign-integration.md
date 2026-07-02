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

**Before the first real client (deferred):** demo signatures are **not legally binding** (watermarked). Open a **production** DocuSign account, complete **Go-Live promotion** (requires ~20 successful demo API calls first — every test send counts toward the 20), and **regenerate ALL DocuSign credentials** for production.

**TODO (not blocking):** envelope status sync (webhook/poll) so a signed contract auto-flips "pending" → "active"; exercise the real Contract-tab send path (same verified backend, only the contract-HTML rendering path is untested).
