---
name: two-netlify-sites
topic: Netlify
task: understand or configure the Netlify sites (OS, marketing, client websites) and which branch and base dir each uses
keywords: [netlify.toml, marketing-site, base-directory, boldline-media.netlify.app, second-netlify-site, third netlify site, boldline-sites, sites base directory, branch deploys, test copy, build skipped]
status: verified
summary: One git repo deploys as THREE separate Netlify sites, all from main — the OS (repo-root netlify.toml, index.html at /*), the marketing site (base dir marketing-site, its own netlify.toml) and, since 2026-10-07, the client-websites site boldline-sites (base dir sites). Each has its OWN env-var list. The marketing site also builds the dev branch as a test copy.
verified: 2026-10-07
---

One git repo produces **independent Netlify sites**, all auto-deploying from `main` (OS, marketing, and since 2026-10-07 client websites).

- **OS site:** the repo-root `netlify.toml` serves the OS `index.html` (+ OS functions in `netlify/functions/`) at `/*`. Untouched by the marketing site.
- **Marketing site:** Base directory = `marketing-site`, with its own `marketing-site/netlify.toml`. Standalone static one-pager + blog + its own functions under `marketing-site/netlify/functions/`. No build step, no React/Babel — plain HTML/CSS (reuses the same `LOGO` data-URI as the product).
- Deliberately separate directories/toml so the marketing site deploys independently without touching OS routing.
- **Each site has its OWN separate env-var list**, even though both point at the same Supabase project. So a var like `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` must be added on the marketing site *separately* even if the OS already has it. Netlify hides secret values once saved, so create fresh keys rather than trying to copy them.
- Marketing site's public Netlify subdomain: `boldline-media.netlify.app` (WITH a hyphen; also the CNAME target for the custom domain — see `domain-dns-wix`).
- **OS site's public Netlify subdomain: `boldlinemedia.netlify.app` (NO hyphen)** — confirmed 2026-07-10. This is where index.html + all repo-root `netlify/functions/*` deploy (aria, portal, stripe-billing, stripe-webhook, docusign-send, etc.). The Stripe webhook endpoint is `https://boldlinemedia.netlify.app/.netlify/functions/stripe-webhook`. Easy to mix up with the hyphenated marketing domain.
- Secret-scanner scope follows base dir: the marketing build scans `marketing-site/`; the OS build scans the rest of the repo (including `knowledge/`). Keep env-var values out of committed files accordingly.

## Third site: client websites (live 2026-10-07, Job A)
- Netlify project **boldline-sites** (`boldline-sites.netlify.app`), Base directory `sites`, everything else from
  `sites/netlify.toml` (schedules nothing). Its only env var: `SUPABASE_SERVICE_ROLE_KEY` (legacy service_role key from
  Supabase > API Keys > Legacy API Keys). OS has `SITES_NETLIFY_SITE=boldline-sites.netlify.app` (in
  `SECRETS_SCAN_OMIT_KEYS`, because a test contains that address). `/__health` verified. Details: KB `website-builder`.

## Marketing site test copy (switched on 2026-10-07, Job B)
- Bryson added the dev branch under Branch deploys on the marketing site (Project configuration > Developer settings >
  Branches and deploy contexts). Address: `https://claude-monday-sept-7-catchup-hyschf--boldline-media.netlify.app`.
- 🔴 GOTCHA: with a Base directory set, Netlify SKIPS a build when the commit changed nothing inside that folder. A
  KB-only push does not create or refresh the test copy (it stayed 404 after the first push). A commit must touch
  `marketing-site/` (the first one added a comment to marketing-site/netlify.toml explaining this).

## 2026-10-07 ~9:53 to 10:00 Phoenix: GitHub refused every write
- Both `git push` and the GitHub API returned HTTP 500 for this repo for about 7 minutes while githubstatus.com said
  all systems operational; `gh api` writes are blocked by the session proxy (403), so there was no other route. A
  background retry loop (`until git push; sleep`) got through on its own. If it happens again: retry in the background,
  tell Bryson nothing is lost, don't create junk branches (the proxy can't delete them).
