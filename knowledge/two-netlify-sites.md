---
name: two-netlify-sites
topic: Netlify
task: understand or configure the two separate Netlify sites (OS vs marketing) and which branch and base dir each uses
keywords: [netlify.toml, marketing-site, base-directory, boldline-media.netlify.app, second-netlify-site]
status: verified
summary: One git repo deploys as TWO separate Netlify sites, both from main — the OS (repo-root netlify.toml, index.html at /*) and the marketing site (base dir marketing-site, its own netlify.toml). Each has its OWN env-var list.
verified: 2026-07-02
---

One git repo produces **two independent Netlify sites**, both auto-deploying from `main`.

- **OS site:** the repo-root `netlify.toml` serves the OS `index.html` (+ OS functions in `netlify/functions/`) at `/*`. Untouched by the marketing site.
- **Marketing site:** Base directory = `marketing-site`, with its own `marketing-site/netlify.toml`. Standalone static one-pager + blog + its own functions under `marketing-site/netlify/functions/`. No build step, no React/Babel — plain HTML/CSS (reuses the same `LOGO` data-URI as the product).
- Deliberately separate directories/toml so the marketing site deploys independently without touching OS routing.
- **Each site has its OWN separate env-var list**, even though both point at the same Supabase project. So a var like `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` must be added on the marketing site *separately* even if the OS already has it. Netlify hides secret values once saved, so create fresh keys rather than trying to copy them.
- Marketing site's public Netlify subdomain: `boldline-media.netlify.app` (WITH a hyphen; also the CNAME target for the custom domain — see `domain-dns-wix`).
- **OS site's public Netlify subdomain: `boldlinemedia.netlify.app` (NO hyphen)** — confirmed 2026-07-10. This is where index.html + all repo-root `netlify/functions/*` deploy (aria, portal, stripe-billing, stripe-webhook, docusign-send, etc.). The Stripe webhook endpoint is `https://boldlinemedia.netlify.app/.netlify/functions/stripe-webhook`. Easy to mix up with the hyphenated marketing domain.
- Secret-scanner scope follows base dir: the marketing build scans `marketing-site/`; the OS build scans the rest of the repo (including `knowledge/`). Keep env-var values out of committed files accordingly.
