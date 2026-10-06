# Client websites (their own Netlify site)

Client websites are served from THIS folder's Netlify site, separate from the OS, so nothing done to the OS
(an update, an outage, a bad deploy) can take a client's live website down (Bryson, 2026-10-06). KB
`website-builder` ("Client websites have their own home").

- Netlify site settings: Base directory `sites`. Everything else comes from `sites/netlify.toml`.
- It only rebuilds when the website code itself changes (`ignore.mjs` walks the imports of these functions).
- Env var on this site: `SUPABASE_SERVICE_ROLE_KEY` (same value as the OS site).
- Env var on the OS site: `SITES_NETLIFY_SITE` = this site's `<name>.netlify.app`, so new client addresses are
  added here and their DNS points here.
- Functions: `website` (every page, sitemap, robots, by the address it was asked for), `site-hit` (visitor
  count), `lead` (contact form: passed to the OS, and kept safe to deliver later if the OS is down).
