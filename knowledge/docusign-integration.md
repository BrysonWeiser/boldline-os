---
name: docusign-integration
topic: OS app
task: send or debug DocuSign e-signature envelopes from the OS, and plan the production go-live
keywords: [docusign-send.mjs, jwt-grant, normalizeKey, DOCUSIGN_PRIVATE_KEY, go-live, BL_SIGN_HERE, go live form voided, generic email domains not allowed, gmail rejected, corporate domain email, cloudflare email routing, bryson@boldlinemedia.com, production account id guid, trial account cannot be used]
status: verified
summary: ✅ FULLY LIVE IN PRODUCTION as of 2026-08-27, verified by a real unwatermarked test envelope. Go-live approved, key promoted, production keypair + JWT consent done, Netlify env vars swapped. 'Send via DocuSign' on any client's Contract tab now sends a legally binding envelope. Watch the multi-line PEM paste gotcha (normalizeKey self-heals it).
verified: 2026-08-27
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

**TODO (not blocking):** ~~envelope status sync (webhook/poll) so a signed contract auto-flips "pending" → "active"~~ — DONE 2026-08-27, see KB `docusign-signature-watch`; exercise the real Contract-tab send path (same verified backend, only the contract-HTML rendering path is untested).


## ✅ 2026-08-26 — THE GO-LIVE FORM IS SUBMITTED AND SIGNED

Third attempt, and the first that did not void. Confirmation screen read **"Agreement Signed
— You're all done!"**. DocuSign reviews in roughly 48 hours.

**What was different this time, and it was only ever one thing:** every email field carried
**bryson@boldlinemedia.com** instead of a gmail address. The two earlier envelopes
(2026-07-15 and 2026-08-24) both voided on the generic-domain rule, and the 2026-07 note
that guessed "expired unsigned" was wrong and cost a chase in the wrong direction.

**The answers submitted**, recorded so a resubmission never has to be reconstructed:

| Field | Answer |
|---|---|
| Radio option | **Option 1**, developed by my organization |
| Integration Key | the developer key (value = `DOCUSIGN_INTEGRATION_KEY` in Netlify) |
| OAuth v2 for REST | **Yes** |
| Company name | BoldLine Media LLC |
| Business contact | Bryson A. Weiser, bryson@boldlinemedia.com |
| DocuSign Case # | left blank, and it accepted that |
| Production API Account ID GUID | from apps.docusign.com → Admin → Integrations → Apps and Keys → My Account Information |
| Date of 20+ test API calls | the day the Deploy-tab test card was run ~15 times (each send is several calls, so ~15 sends clears 20 calls comfortably) |
| Primary purpose | sending our own advertising services agreements; JWT Grant; one envelope per client; no resale or redistribution |
| Internal / External / Both | **Internal**. Only BoldLine operates the software. Clients are RECIPIENTS, not users of the integration, and answering "External" would have contradicted the no-redistribution answer above and invited ISV-style scrutiny |
| Documentation link | https://boldlinemedia.com (the "if available" public link; there is no public doc for a private internal tool) |
| Signatory Name / Date Signed / Signature at the foot of page 3 | **left blank on purpose** — that block is DocuSign's own countersignature ("Go Live Execution"), not the applicant's |

**🔴 GOTCHA: three unsigned Go-Live envelopes were sitting in the inbox at once** (19 min, 1
hour and 22 hours old) from repeated restarts. Only the NEWEST was completed; the others were
left to expire. Half-filling several is how the earlier ones died.

**🔴 THE DISTINCTION THAT WAS BEING MISSED, AND IT UNBLOCKS THE FIRST CLIENT.** Go-live
approval governs the **API** — the OS sending envelopes automatically. It does NOT govern
**sending an envelope by hand from the DocuSign web app**, which a paid account can do today.
Earlier advice in this project ("do not promise a DocuSign link") was written against the API
state and was too broad. Before relying on it, send a throwaway test envelope to yourself from
app.docusign.com → Start → Send an envelope, because the account's plan is the real gate:
the form itself says *"Only paid accounts or partner accounts can be used."*

**Still to do after approval lands:** register the RSA public key on the production app,
complete production JWT consent, then swap the five Netlify env vars and test one send. Do
NOT swap early — that breaks the working demo send.


# ═══════════════════════════════════════════════════════════════════════════════
# ✅ 2026-08-27 — PRODUCTION IS LIVE. EVERYTHING ABOVE THIS LINE IS HISTORY.
# ═══════════════════════════════════════════════════════════════════════════════

Verified end to end by a real test envelope from the OS Deploy tab: it arrived, it was
signable, and it carried **no sandbox watermark**. That watermark is the only visible
difference between a demo envelope and a binding one, so its absence is the proof.

## What finished it, in order

1. **Go-live approved.** The completion email (`Completed: DocuSign API - Go Live Form`)
   arrived within a day of submitting. Confirmed properly by checking
   apps.docusign.com → Admin → Apps and Keys, where **BoldLine OS now appears under
   Apps and Integration Keys**. Production had previously read *"No Integration Keys found"*,
   so that listing is the real signal, not the email.
   🔴 **Go-live PROMOTES the existing key rather than issuing a new one**, so the integration
   key value never changed.
2. **A production RSA keypair**, generated in the app's Edit screen
   (Service Integration → **Generate RSA**). DocuSign shows the private key **once**; it went
   straight into Netlify's `DOCUSIGN_PRIVATE_KEY` and nowhere else.
3. **A redirect URI**, which the production app had none of. `https://boldlinemedia.com/`.
   Needed ONLY so the consent screen has somewhere to bounce back to.
4. **One-time JWT consent**, granted by visiting the auth URL and clicking Allow:
   `https://account.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=<DOCUSIGN_INTEGRATION_KEY>&redirect_uri=https://boldlinemedia.com/`
   Landing back on boldlinemedia.com with a code in the address bar IS the success signal.
5. **Three Netlify env vars swapped** (`DOCUSIGN_USER_ID`, `DOCUSIGN_ACCOUNT_ID`,
   `DOCUSIGN_BASE_PATH`), then a **Trigger deploy**. Env var changes do not reach live
   functions until the site rebuilds.

## Gotchas worth keeping

- **`DOCUSIGN_BASE_PATH` is `https://www.docusign.net`**, with **no trailing slash and no
  `/restapi`** — `docusign-send.mjs` appends `/restapi/v2.1/...` itself. Note it is the
  generic `www` host, not a regional `na*` one; that is normal and it works.
- **The auth host switches itself.** `authServer` is derived as
  `basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com"`, so
  removing "demo" from the base path is what moved auth to production. Nothing else to set.
- **Rollback:** the demo values were saved to a note before being overwritten. To go back,
  restore those three vars and redeploy. The demo API account id starts `47275628`.
- **Plan ceiling: 10 envelope sends per month** on eSignature Standard ($45/mo). Fine now,
  worth watching past roughly ten clients, and it is a hard stop rather than an overage.

## What this unblocks

**"Send via DocuSign" on any client's Contract tab now sends a real, binding envelope.**
No download, no print dialog, no manual upload. The whole PDF-export detour that was being
worked around on 2026-08-26 is obsolete.

**✅ THE RETURN PATH IS DONE TOO, same day.** A scheduled job polls DocuSign every 15 minutes
and flips a signed contract to active by itself, alerts Bryson, and sends the client their
confirmation email. Full write-up, including why polling beat DocuSign Connect and the
"delivered is not signed" trap, in KB **`docusign-signature-watch`**.
