---
name: account-email-map
topic: Business rules
task: know which email/login owns which external account before signing in or setting one up
keywords: [quo, openphone, business phone login, account-map, login, brysonaweiser, theboldlinemedia, lleatherboy, which-email, mercury, stripe-login, mcc-login, docusign-login, which email for docusign, docusign production admin, go live form email]
status: stale-able
summary: Master map of which email owns which external account. Business gmail (theboldlinemedia) = Google Ads MCC + Stripe + Netlify forms notifications + Meta business-contact email. Personal gmail (brysonaweiser) = Search Console, Mercury login, Bing Places, Apple Business Connect, DocuSign PRODUCTION, Namecheap, OpenPhone/Quo (2026-09-21) and the Anthropic Console (2026-09-27) — all by design: one login, many future orgs, and the login is never public. 🔴 That concentration is now large enough to be its own risk: two-factor and recovery details on that Google account protect the bank, the domain, the signing account and the business phone at once. lleatherboy@gmail.com is NOT a login anywhere. Update this entry whenever a new account is created.
verified: 2026-09-21
---

**The two emails:**
- **theboldlinemedia@gmail.com** — the business gmail.
- **brysonaweiser@gmail.com** — Bryson's personal gmail.

**Who owns what (as of 2026-07-08):**

| Service | Login / owner | Notes |
|---|---|---|
| Google Ads MCC + API Center + Basic Access application | **theboldlinemedia@gmail.com** | Application decisions arrive here |
| Google Search Console (boldlinemedia.com domain property) | **brysonaweiser@gmail.com** | Set up 2026-07-07 |
| Facebook — the ONE personal account (Bryson Weiser) — admin of the BoldLine Media Business Portfolio + owner of the dev app + BoldLine Page | **brysonaweiser@gmail.com** (primary), phone +1 602-784-4228 | **CORRECTED 2026-07-27 via Accounts Center: there is only ONE Facebook account.** Accounts Center → Profiles shows a single profile "Bryson Weiser"; Contact info = brysonaweiser@gmail.com + 602 only; birthday on file Oct 11 2007 (young + weeks-old account = why Meta keeps checkpointing). `theboldlinemedia@gmail.com` is NOT a separate FB personal account — it's the Business Portfolio's business-contact email (and appears to also work as a login alias to this same account). The old "NEW vs OLD account / invite a 2nd admin" model was WRONG — you can't be your own second admin, which is why every invite looped "you're already in the Business Portfolio." |
| Meta Business Portfolio business-contact email | **theboldlinemedia@gmail.com** | Contact address only, not a login |
| Mercury (bank) | **brysonaweiser@gmail.com** (DECISION 2026-07-08) | Deliberate: one personal login can own multiple org entities as future businesses launch; BoldLine Media LLC is the org inside it |
| Stripe | **theboldlinemedia@gmail.com** (as instructed; unconfirmed) | Fine either way — Stripe logins can hold multiple accounts |
| Netlify Forms email notifications | sent to **theboldlinemedia@gmail.com** | |
| Calendly | link = calendly.com/theboldlinemedia/30min; **"Calendar to add events to" (= Google Meet HOST) is `brysonaweiser@gmail.com`** | Free Calendly writes events to ONE calendar only; the business calendar (`theboldlinemedia@gmail.com`) is connected for conflict-check but shows **"Calendar unavailable on current tier."** So Calendly creates each booking + its Google Meet on the PERSONAL account → **that account is the meeting host.** GOTCHA (2026-08-11): you MUST join Meet links signed into `brysonaweiser@gmail.com` or Google treats you as a guest and makes you "request access to the admin." To move the host/organizer to the business account, Calendly must be PAID (then set it as the add-to calendar). |
| Yelp for Business | **theboldlinemedia@gmail.com** (DECISION 2026-08-11, Bryson chose it) | Business listing platform, so it sits with GBP/Meta rather than the personal-login consoles. |
| Apple Business Connect (Apple Account) | **brysonaweiser@gmail.com** (DECISION 2026-08-11) | NOT yet created — Apple's signup rate-limited him. Personal on purpose: he'll want this Apple Account on a future iPhone, and two Apple Accounts sharing one phone number causes 2FA-code ambiguity + iMessage routing bugs. |
| Bing Places for Business (Microsoft account) | **brysonaweiser@gmail.com** (DECISION 2026-08-11) | Reused his EXISTING Microsoft account rather than creating a business one. Same logic as Mercury/Search Console: the login is never public (only the listing is), one Microsoft account can hold multiple businesses as future ventures launch, new Microsoft accounts get security-flagged with painful recovery, and Bing Places lets you add managers later if it ever needs to transfer. |
| DocuSign — **DEVELOPER / sandbox** account | **theboldlinemedia@gmail.com** (confirmed 2026-08-24) | Holds the "BoldLine OS" integration key while it is still on demo.docusign.net. |
| DocuSign — **PRODUCTION** account | **brysonaweiser@gmail.com** (confirmed 2026-08-24) | 🔴 **THE TWO DOCUSIGN ACCOUNTS ARE ON DIFFERENT EMAILS.** theboldlinemedia@gmail.com does NOT sign in at www.docusign.net at all. This matters because the go-live verification form demands the PRODUCTION admin email and production Account ID, and warns that a demo value gets the envelope declined — which is one of the ways the July 2026 attempt died. See `docusign-integration`. |
| Cloudflare (DNS for boldlinemedia.com) | **login not yet recorded** | 🔴 Discovered 2026-08-24 by DNS lookup: the domain's nameservers are **leia/drake.ns.cloudflare.com**, so CLOUDFLARE runs the records, not Namecheap's own DNS. Namecheap is only the registrar. `domain-dns-wix` predates this move and still describes the Wix/Namecheap record setup. |
| Email on boldlinemedia.com | ✅ **`bryson@boldlinemedia.com`** since 2026-08-24 | Confirmed by DNS: zero MX records. Free **Cloudflare Email Routing**, forwarding into **theboldlinemedia@gmail.com since 2026-10-05** (was brysonaweiser@gmail.com). Receive-only. Forced by DocuSign, which refuses gmail on the go-live form. Confirmed working: all five DNS records live, and a test send logged as Forwarded. See `docusign-integration`. |
| Quo, formerly OpenPhone (business phone number for cold calling) | **brysonaweiser@gmail.com** (DECISION 2026-09-21, Bryson chose it) | Same deliberate logic as Mercury / Bing Places / Apple Business Connect: **one personal login can hold multiple workspaces as future businesses launch**, and the login is never public. 🔴 **The login email is NOT the business identity** — the WORKSPACE must be named BoldLine Media and any business-verification step uses the LLC name + the Articles address (3101 N Central Ave Ste 183 #7182, Phoenix AZ 85012), because those are checked against state/IRS records and the login email is not. A setter gets invited into the workspace later; they never need this login. |
| Anthropic Console (the API account behind every AI feature in the OS: Lead Scout, Deal Prep, Content Studio, reports) | **brysonaweiser@gmail.com** (confirmed 2026-09-27) | Pay-as-you-go credits, a SEPARATE bill from his Claude subscription. When credits run out, AI features fail with "credit balance is too low" (Lead Scout shows it in a red Research errors box). Top up at console.anthropic.com, Billing. Auto-reload deliberately OFF while cash is tight (Sept 2026). The key itself lives only in Netlify as `ANTHROPIC_API_KEY`. |
| Namecheap (domain registrar — boldlinemedia.com) | **brysonaweiser@gmail.com** (2026-07-27) | Domain transferred here off Wix so Resend can verify the domain for email sending. Namecheap transfer-authorization/approval emails go to THIS inbox; the Wix release/auth-code email went to theboldlinemedia@gmail.com. Auto-renew ON, free WHOIS privacy. See domain-dns-wix. |

**Rules learned the hard way:**
- `lleatherboy@gmail.com` is NOT one of Bryson's logins anywhere (a mistaken Meta invite went there 2026-07-07).
- One legal entity = one bank account, always — future LLCs get their own accounts/orgs under the same Mercury login, never shared funds.
- When any new external account is created, add it here immediately.
- 🔴 **THE PERSONAL LOGIN IS NOW A SINGLE POINT OF FAILURE, and that is the cost of the pattern.**
  Mercury (the bank), the domain registrar, the PRODUCTION DocuSign account, Search Console and the
  business phone all sit behind `brysonaweiser@gmail.com`. The one-login-many-orgs choice is still
  right, but it means **two-factor and up-to-date recovery details on that Google account are not
  optional** — losing it takes out the bank, the domain and the phone in the same afternoon.
- **A login email is never a business identity.** Anything that VERIFIES the business (carrier
  registration, Meta, DocuSign go-live) is checked against state and IRS records, so it takes the
  LLC name and the Articles address regardless of which gmail is signed in.

**Apollo.io** (Lead Scout owner/decision-maker enrichment) — signed up 2026-08-11 with **Sign in with
Google** on the BUSINESS gmail (theboldlinemedia). No separate password; log in via Google SSO. API key
lives only in Netlify env `APOLLO_API_KEY` on the OS site. See `lead-scout`.

**Google Cloud / Google Maps Platform** (Lead Scout Places lookups) — created 2026-08-11 on the BUSINESS
gmail. The Places API key ended up in the auto-created project **"My First Project"**, not the
"BoldLine OS" project that was made first — cosmetic only, the key works and billing is attached there.
Key is restricted to Places API (New), stored only in Netlify env `GOOGLE_PLACES_API_KEY` on the OS
site. On the free trial ($300 / 90 days from 2026-08-11) — **not** activated to full pay-as-you-go, so
the trial expiry is a future to-do. See `lead-scout`.


## 2026-10-05 — bryson@boldlinemedia.com: forward to the BUSINESS gmail, and send from it
✅ **Part 1 (receive) DONE 2026-10-05, tested by Bryson:** bryson@ now forwards to **theboldlinemedia@gmail.com**. In Cloudflare the destination list shows only theboldlinemedia@gmail.com (Verified); the old personal-gmail destination is no longer listed. ✅ **Part 2 (send-as) DONE 2026-10-05:** Gmail "Send mail as" bryson@ verified, via smtp.resend.com:587, username `resend`. 🔴 Gotcha: Gmail PRE-FILLS the SMTP box with `route3.mx.cloudflare.net` and username `bryson` (it guesses from the MX records). Cloudflare Email Routing is receive-only, so that guess cannot send; overwrite both.
Bryson asked to (1) forward bryson@ to **theboldlinemedia@gmail.com** instead of his personal gmail, and
(2) send as bryson@. Steps given:
- **Receive:** Cloudflare (login is the personal gmail) → boldlinemedia.com → Email → Email Routing →
  Destination addresses → add theboldlinemedia@gmail.com (🔴 this one DOES need the verify link, unlike
  the first, which auto-verified because it matched the Cloudflare login) → Routing rules → edit the
  bryson@ rule → new destination. Do this FIRST: the Gmail send-as code in step 2 is mailed to bryson@.
- **Send, free, recommended:** Gmail "Send mail as" through **Resend's SMTP** (smtp.resend.com, port 587,
  TLS, username `resend`, password = a NEW Resend API key with Sending access only, named "Gmail
  send-as"; typed into Gmail, never into chat or the repo). Resend already has boldlinemedia.com verified
  with DKIM at `resend._domainkey`, so mail passes DMARC as boldlinemedia.com. Rejected: sending through
  Gmail's own server (signs as gmail.com, fails DMARC alignment for boldlinemedia.com, shows "via
  gmail.com", spam risk). Google Workspace (~$7/mo, a real mailbox) is the upgrade if he ever wants a
  separate inbox. Caveat: one-to-one email only, never bulk cold email (that would put the domain the OS
  sends client emails from at risk), and it shares Resend's daily limit with the OS.
- Side effect to know: DocuSign's login is bryson@, so its emails and password resets will then land in
  the business gmail.
