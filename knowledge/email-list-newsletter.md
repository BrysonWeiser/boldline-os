---
name: email-list-newsletter
topic: Marketing site
task: the website email list / newsletter signup — where it lives, how it stores subscribers (Resend Audience + website_leads backup), and Bryson's setup steps
keywords: [email list, newsletter, subscribe, signup, mailing list, resend audience, broadcast, RESEND_AUDIENCE_ID, subscribe.mjs, nl-signup, blSubscribe]
status: verified
summary: boldlinemedia.com has an email-list signup (Bryson, 2026-07-25) — a "Free Newsletter" band on the homepage footer + every blog page (blog-render footerHTML). It POSTs to netlify/functions/subscribe.mjs which (1) adds the contact to a RESEND AUDIENCE (the real list you broadcast to) when RESEND_AUDIENCE_ID is set, and (2) writes a durable backup row to website_leads (form:"newsletter"). The OS filters newsletter rows out of the sales-Leads list. Adding contacts works today with just RESEND_API_KEY; SENDING broadcasts later needs boldlinemedia.com verified in Resend (blocked while DNS is on Wix — see domain-dns-wix).
verified: 2026-07-25
---

**Decision (Bryson, 2026-07-25):** start an email list on the website. Backend = **Resend Audiences** (same vendor already used for reports/alerts; real list product with broadcasts + unsubscribe). Placement = **homepage footer + end of every blog page**. Purpose = **marketing-tips newsletter** (matches the blog; nurtures prospects who aren't ready to buy).

**The signup UI:** a self-contained `.nl-signup` band (own `<style>` + `<script>`, no CSS-file dependency, dark+gold on-brand, Playfair heading). One email field + Subscribe, hidden honeypot field `company`, inline success ("You're in — thanks!") with the form hiding on success. Submits via `fetch()` to `/.netlify/functions/subscribe` (AJAX, no page reload). `window.blSubscribe` is the handler.
- **Homepage:** pasted directly above `<footer>` in `marketing-site/index.html` (data-source="homepage").
- **Blog (all pages):** `newsletterHTML(source)` exported from `marketing-site/netlify/lib/blog-render.mjs` and prepended inside `footerHTML()`, so every blog page (index, posts, glossary, 404) shows it (data-source="blog"). Verified 0px overflow + renders at 390/768/1280/1600.

**Backend — `marketing-site/netlify/functions/subscribe.mjs`:** POST JSON `{email, company, source}`. Validates email, honeypot-drops bots. Then best-effort + independent:
1. **Resend Audience:** `POST https://api.resend.com/audiences/{RESEND_AUDIENCE_ID}/contacts` with `RESEND_API_KEY`. Returns "not-configured" (no-op) until the audience ID is set. Adding contacts does NOT need a verified domain.
2. **Durable backup:** insert into the existing `website_leads` table (`form:"newsletter"`, service-role key), de-duped by email. Guarantees no signup is lost even before the Audience ID is set, and gives Bryson an owned copy he can export.
Always returns `{ok:true}` for a valid email so the UX never breaks.

**OS side:** `loadLeads` in `index.html` now filters `l.form !== "newsletter"` so subscribers don't clutter the sales-Leads screen. The list itself is managed in Resend (Audiences), not the OS.

**BRYSON'S SETUP (do this to make it a real list):**
1. Resend dashboard → **Audiences** → **Create Audience** (name it e.g. "BoldLine Newsletter"). Open it and copy the **Audience ID** (a long id in the URL / on the page).
2. Netlify → the **marketing site** → **Site configuration → Environment variables → Add** → key `RESEND_AUDIENCE_ID`, value = that ID → Save. Redeploy (or it applies on next deploy). Now every signup lands in that Audience.
3. **To SEND newsletters (later):** Resend needs **boldlinemedia.com verified** as a sending domain — currently blocked because DNS is on Wix, which won't add the subdomain records Resend needs (see KB `domain-dns-wix`). Until then you can still COLLECT subscribers; sending a broadcast waits on either moving DNS off Wix or verifying via a workaround. Resend → **Broadcasts** is where you'll compose + send once verified.

**GOTCHAS:** marketing-site `REPORTS_FROM_EMAIL` is intentionally unset (can't verify domain on Wix), so the site doesn't send branded email today — that's why the list uses Resend Audiences (collection, no sending needed yet) + the DB backup, not an email-per-signup. Contacts added to the Audience get unsubscribe handling from Resend automatically once broadcasting is on.

**Verified 2026-07-25:** subscribe.mjs + blog-render.mjs `node --check` clean; homepage renders the band at all 4 breakpoints (0px overflow); AJAX submit posts the correct JSON and shows the success state + hides the form; honeypot returns before any POST.
