---
name: docusign-integration
topic: OS app
task: send or debug DocuSign e-signature envelopes from the OS, and plan the production go-live
keywords: [docusign-send.mjs, jwt-grant, normalizeKey, DOCUSIGN_PRIVATE_KEY, go-live, BL_SIGN_HERE, go live form voided, generic email domains not allowed, gmail rejected, corporate domain email, cloudflare email routing, bryson@boldlinemedia.com, production account id guid, trial account cannot be used]
status: verified
summary: DocuSign e-sign is live-verified in DEMO/sandbox via JWT Grant (docusign-send.mjs). Demo signatures are NOT legally binding — production needs Go-Live promotion (~20 demo API calls) + regenerated creds before the first real client. Watch the multi-line PEM paste gotcha (normalizeKey self-heals it).
verified: 2026-08-24
---

**Status:** credentials done, code built, **live-verified 2026-06-25** in **DEMO/sandbox** (REST base = the DocuSign demo host, held in `DOCUSIGN_BASE_PATH`; auth via the DocuSign demo auth host). Full JWT round-trip (sign → token → envelope → deliver) confirmed end to end via the Deploy-tab test card.

**Auth:** **JWT Grant** (server-to-server, unattended); one-time consent completed 2026-06-25. RSA keypair (public auto-registered with DocuSign; private key stored in Netlify only). Account: BoldLine Media (account number is on file in the DocuSign portal — not stored here). Integration type: **Private custom integration** (locks once Go-Live passes "Ready to Submit").

**Env vars:** `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_PRIVATE_KEY`, `DOCUSIGN_BASE_PATH`.

**Code:** `netlify/functions/docusign-send.mjs` — JWT auth + envelope send, secured by the owner's Supabase session. Front end in two places: "Send via DocuSign" on a client's Contract tab (sends the rendered service agreement, marks the contract "pending", stores `docusignEnvelopeId`; the signature tab sits on an invisible `/BL_SIGN_HERE/` anchor in the contract), and a "Test DocuSign Connection" card on the Deploy tab (non-binding test envelope to any email — self-serve credential check).

**GOTCHA — multi-line PEM paste (cost ~3 retries):** pasting a multi-line PEM into Netlify's secret field collapses the internal newlines, and Node's `crypto` then rejects the malformed PEM at the `sign` stage. Fix in code: `normalizeKey()` rebuilds canonical PEM (re-wraps the base64 body at 64 chars) whenever the BEGIN/END markers survive, so a flattened paste self-heals; the sign-stage error also returns non-secret structural facts (length, line count, marker presence) for diagnosis. **Expect the same on the production key — cleanest is to keep the newlines intact on paste.**

**GO-LIVE PROGRESS (2026-07-14):** The demo integration was **eligible ("Ready to Submit")** — the ~20-call requirement was already met. Ran **Go Live** on the "BoldLine OS" integration key (its value is `DOCUSIGN_INTEGRATION_KEY` in Netlify — never write the GUID here), accepted the integration-type/billing T&C (type is correct: private server-to-server JWT for sending our own contracts — locks once pending/live), and **promoted it into the production account** (account # is `DOCUSIGN_ACCOUNT_ID` in Netlify; owner Bryson A. Weiser). Status is now **"Pending approval — Submit verification form"** (DocuSign reviews within ~48h). All of this is FREE.

**🔴 THE REAL BLOCKER, FOUND 2026-08-24: DOCUSIGN REFUSES GMAIL ON THE GO-LIVE FORM.** The
envelope was voided within minutes by go-live@docusign.com with the reason written out:

> *"Generic email domains such as @gmail or @hotmail are not allowed. Please resubmit a new
> envelope and ensure to use your companies corporate domain email address."*

**This is almost certainly why the 2026-07-15 envelope voided too** — same address, same rule.
The earlier note below guessed it expired unsigned. **That guess was wrong**, and it sent us
chasing a deadline that was never the problem. Nothing about the form's ANSWERS was wrong:
Option 1, the developer integration key, and the production account were all correct.

**What the form actually demands, in order:**
1. An email on the company's own domain. `brysonaweiser@gmail.com` and
   `theboldlinemedia@gmail.com` are both refused.
2. That address must have **ADMIN privileges on the PRODUCTION account**.
3. The production account must be **paid or partner** — *"A trial account cannot be used."*
   ✅ **CONFIRMED 2026-08-24: it is PAID.** Admin → Subscription and billing shows
   **eSignature Standard, $45.00/month, 1 user license, 10 envelope sends/month**, 0 sent.
   So this requirement is met and was never the blocker. Two things to remember: that
   $45/mo has been running with zero clients, and **10 envelopes/month** is the ceiling
   (fine now, worth watching past ~10 clients). **Still unknown:** whether Standard
   includes the API sending the OS uses. The form only demands a paid account, so it does
   not block submission; it will show up immediately in the first production send test.
4. The **production** API Account ID GUID, from apps.docusign.com → Apps and Keys → My
   Account Information. A sandbox ID is an automatic decline (the demo GUID starts 47275628).

**THERE WAS NO EMAIL ON THE DOMAIN AT ALL** — confirmed 2026-08-24 by DNS lookup: zero MX
records on boldlinemedia.com. Also learned in the same lookup: **the domain's DNS is on
CLOUDFLARE** (leia/drake.ns.cloudflare.com), not Namecheap's own DNS. Namecheap is the
registrar; Cloudflare runs the records. `domain-dns-wix` predates that move.

**DECISION 2026-08-24 (Bryson chose it):** free **Cloudflare Email Routing** →
`bryson@boldlinemedia.com` forwarding into `brysonaweiser@gmail.com`. Receive-only, which is
all the go-live form needs, and it costs nothing. A real mailbox (Google Workspace, ~$7/mo,
lets him SEND from the address) was offered and deferred until he is actually emailing
prospects. The address stays the same either way, so moving later costs DocuSign nothing.

**GO-LIVE STALLED — found 2026-07-19:** the go-live did NOT complete. Production **Apps and Keys** shows **"No Integration Keys found"** (the demo IK never migrated), and the home-page Agreement Activity shows **"DocuSign API - Go Live Form for brysonaweiser@gmail.com" = VOIDED (2026-07-15)**. The go-live review sends a verification-form ENVELOPE you must complete/sign; ours voided (expired/unsigned), so the migration stalled. The production account shell exists (Account ID + API Account ID + `https://www.docusign.net` base URI all on the prod Apps-and-Keys page — record only via env-var NAMES, never the values). To finish: go back to the **developer account** (banner on that page: "manage integrations in Developer Console" → Open; or the "developer account" link) → the BoldLine OS integration key → **re-run Go Live** and COMPLETE the form envelope this time (don't let it void). **DECISION 2026-07-19: parked the whole DocuSign production cutover (go-live re-run + paid plan + cred swap) until a client is close — doing the free go-live now just risks the approval going stale again before there's anything to send.**

**NEXT STEPS (2026-08-24), in order:**
0. ✅ **DONE 2026-08-24.** Cloudflare Email Routing → `bryson@boldlinemedia.com` forwards
   into brysonaweiser@gmail.com. All five records live and verified externally (3 MX
   route1/2/3.mx.cloudflare.net, DKIM at cf2024-1._domainkey, SPF on the apex). A test send
   showed **Forwarded** in Cloudflare's Activity Log.
   🔴 **Two gotchas worth keeping.** The destination address **auto-verified with no email**,
   because it is the same address as the Cloudflare login. And a test sent FROM
   brysonaweiser@gmail.com never appears in that inbox: Gmail suppresses a message you sent
   to yourself, so it lands in All Mail rather than the Inbox and looks like a failure. Test
   from the OTHER address, and search `to:bryson@boldlinemedia.com` to find it.
   **Checked BEFORE adding records:** the apex had no SPF, and Resend's lives on the `send.`
   subdomain, so Cloudflare's SPF created no conflict. Two SPF records on one name break
   outbound mail, so always look first.
1. **CHANGE the existing user's email** to `bryson@boldlinemedia.com` rather than adding a
   user. The account has 1 seat and 0 unassigned, so a second admin costs another ~$45/mo
   seat for nothing. [in progress]
2. ✅ Confirmed paid, see above.
3. Start a FRESH go-live form using `bryson@boldlinemedia.com` in every email field.
   Answers that were already correct: **Option 1** (developed by my organization), the
   **developer** integration key, OAuth v2 = **Yes**, company **BoldLine Media LLC**.
   The "date of 20+ test API calls" wants a date whose logs still exist (DocuSign keeps
   ~30 days) — run the OS's Deploy-tab test card ~15 times that day and use that date.

**Remaining to actually send binding contracts (the paid/setup half — DEFERRED until a client is close, per lean-spend):**
0. **Re-run Go Live** in the developer account and COMPLETE the verification-form envelope (the 2026-07-15 one voided). Free. Migrates the IK to production.
1. **Submit the verification form** (free) → wait ~48h for approval. [in progress 2026-07-14]
2. The production account (its # is `DOCUSIGN_ACCOUNT_ID` in Netlify) needs an **eSignature plan with API access** (the monthly fee — ~$25-45/mo tier; the free tier won't API-send). Don't activate until a deal is imminent.
3. **Regenerate/register production credentials:** register the RSA **public** key on the production app + complete a **one-time JWT consent** for production. New values differ from demo: prod `DOCUSIGN_ACCOUNT_ID` = the production account's API account id, prod `DOCUSIGN_USER_ID` = the prod user GUID, `DOCUSIGN_BASE_PATH` = the production host (e.g. `https://na*.docusign.net`, NOT demo.docusign.net — the code auto-switches the auth host to account.docusign.com when BASE_PATH lacks "demo"). Integration key may carry over.
4. **Swap the 5 Netlify env vars** (OS site) to the production values, redeploy, test one send. **Do NOT swap early** — pointing the OS at production before the plan + consent are done breaks the working "Send via DocuSign". Keep demo creds live until the final cutover.

Demo signatures remain **not legally binding** (watermarked) until the above is done.

**TODO (not blocking):** envelope status sync (webhook/poll) so a signed contract auto-flips "pending" → "active"; exercise the real Contract-tab send path (same verified backend, only the contract-HTML rendering path is untested).
