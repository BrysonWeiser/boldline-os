---
name: account-email-map
topic: Business rules
task: know which email/login owns which external account before signing in or setting one up
keywords: [account-map, login, brysonaweiser, theboldlinemedia, lleatherboy, which-email, mercury, stripe-login, mcc-login, docusign-login, which email for docusign]
status: stale-able
summary: Master map of which email owns which external account. Business gmail (theboldlinemedia) = Google Ads MCC + Stripe + Netlify forms notifications + Meta business-contact email. Personal gmail (brysonaweiser) = Search Console, Mercury login (by design — one login, many future orgs), old/aged Facebook account. lleatherboy@gmail.com is NOT a login anywhere. Update this entry whenever a new account is created.
verified: 2026-08-24
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
| DocuSign (developer / sandbox account) | **theboldlinemedia@gmail.com** (confirmed by Bryson 2026-08-24) | The account holding the "BoldLine OS" integration key while it is still on demo.docusign.net. **The PRODUCTION account's admin email is a SEPARATE question and is not yet confirmed** — the go-live verification form demands the production admin, and a wrong address gets the envelope declined. Verify by signing in at www.docusign.net (not demo) and checking Admin → Users says Administrator. See `docusign-integration`. |
| Namecheap (domain registrar — boldlinemedia.com) | **brysonaweiser@gmail.com** (2026-07-27) | Domain transferred here off Wix so Resend can verify the domain for email sending. Namecheap transfer-authorization/approval emails go to THIS inbox; the Wix release/auth-code email went to theboldlinemedia@gmail.com. Auto-renew ON, free WHOIS privacy. See domain-dns-wix. |

**Rules learned the hard way:**
- `lleatherboy@gmail.com` is NOT one of Bryson's logins anywhere (a mistaken Meta invite went there 2026-07-07).
- One legal entity = one bank account, always — future LLCs get their own accounts/orgs under the same Mercury login, never shared funds.
- When any new external account is created, add it here immediately.

**Apollo.io** (Lead Scout owner/decision-maker enrichment) — signed up 2026-08-11 with **Sign in with
Google** on the BUSINESS gmail (theboldlinemedia). No separate password; log in via Google SSO. API key
lives only in Netlify env `APOLLO_API_KEY` on the OS site. See `lead-scout`.

**Google Cloud / Google Maps Platform** (Lead Scout Places lookups) — created 2026-08-11 on the BUSINESS
gmail. The Places API key ended up in the auto-created project **"My First Project"**, not the
"BoldLine OS" project that was made first — cosmetic only, the key works and billing is attached there.
Key is restricted to Places API (New), stored only in Netlify env `GOOGLE_PLACES_API_KEY` on the OS
site. On the free trial ($300 / 90 days from 2026-08-11) — **not** activated to full pay-as-you-go, so
the trial expiry is a future to-do. See `lead-scout`.
