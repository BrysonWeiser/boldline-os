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
