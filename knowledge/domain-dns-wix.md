---
name: domain-dns-wix
topic: Domain/DNS
task: point or debug the boldlinemedia.com custom domain at Netlify when the domain is Wix-registered
keywords: [A-record, CNAME, nameserver-delegation, lets-encrypt, 75.2.60.5, boldline-media.netlify.app]
status: verified
summary: boldlinemedia.com is live on Netlify via DNS RECORDS (Wix won't delegate nameservers for Wix-registered domains) — A @ → 75.2.60.5, CNAME www → boldline-media.netlify.app. Apex serves HTTPS (auto Let's Encrypt), www 301→apex, http 301→https. No email on the domain.
verified: 2026-07-02
---

- **Wix keeps the registration.** DNS was repointed to Netlify via **records** because **Wix does not allow nameserver delegation for Wix-registered domains** — so Netlify DNS / a Netlify DNS zone could not be used. The Netlify DNS zone that had been started was deleted so Netlify verifies against the records instead.
- Records set at Wix:
  - `A @ → 75.2.60.5` (Netlify's load balancer)
  - `CNAME www → boldline-media.netlify.app`
  - These replaced the Wix default A records (`185.230.63.x`) and the `www` / `en` Wix CNAMEs.
- Verified live (2026-06-30): apex serves the marketing site over **HTTPS** (Let's Encrypt cert auto-issued), `www` 301→apex, `http` 301→`https`.
- **No email on the domain** (nothing to preserve). This is also *why* Resend domain verification is blocked — Wix can't add the required subdomain MX record; see `branded-lead-email-dormant`.

**MOVING OFF WIX — in progress (Bryson, 2026-07-27).** To unblock email SENDING (newsletter + Resend broadcasts + branded lead emails), the domain is being transferred OFF Wix so we can add Resend's records. Confirmed on the Wix DNS screen that Wix is a dead end for this: **NS records are "not editable"** (can't delegate to Cloudflare) and the **MX section has no free "Add Record"** (only "connect a business email" — can't add Resend's `send.` subdomain MX). Cloudflare set-up was done (free zone added, A `@`→75.2.60.5 + CNAME `www`→boldline-media.netlify.app imported as **DNS-only/grey**, TXT google-verify kept; assigned nameservers **drake.ns.cloudflare.com / leia.ns.cloudflare.com**). BUT Cloudflare Registrar can't be the transfer target (it requires the domain to already be on CF nameservers, which Wix blocks). **Plan (Option A, chosen over a quick dedicated sending domain):** transfer the registration Wix → **Namecheap** (auth/EPP code from Wix "Transfer away from Wix"; ~$10 incl. +1yr; ~5-7 days; site stays live since records don't change). AFTER it lands: point Namecheap nameservers → Cloudflare (drake/leia), add Resend's 3 records (MX+SPF on `send`, DKIM `resend._domainkey`) in Cloudflare, verify, then set OS-site Netlify env vars REPORTS_FROM_EMAIL + NEWSLETTER_SENDING_ENABLED=1 (+ RESEND_AUDIENCE_ID) to turn sending on. Domain renews Oct 28 2026 (well past the 60-day transfer lock, so eligible). Follow-up check-in trigger set for ~2026-07-30 (re-arms if the transfer isn't done yet), then rolls into the Meta account-confirmation step.
