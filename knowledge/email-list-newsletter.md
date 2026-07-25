---
name: email-list-newsletter
topic: Marketing site
task: the website email list / newsletter signup — where it lives, how it stores subscribers (Resend Audience + website_leads backup), and Bryson's setup steps
keywords: [email list, newsletter, subscribe, signup, mailing list, resend audience, broadcast, RESEND_AUDIENCE_ID, subscribe.mjs, nl-signup, blSubscribe]
status: verified
summary: boldlinemedia.com has an email-list signup (Bryson, 2026-07-25) — a "Free Newsletter" band on the homepage footer + every blog page (blog-render footerHTML). It POSTs to netlify/functions/subscribe.mjs which (1) adds the contact to Resend's account-level Contacts (POST /contacts — NO audience_id; shown under "Audience" in the dashboard) using just RESEND_API_KEY, and (2) writes a durable backup row to website_leads (form:"newsletter"). The OS filters newsletter rows out of the sales-Leads list. Collecting works today with the API key already set (no extra config); SENDING broadcasts later needs boldlinemedia.com verified in Resend (blocked while DNS is on Wix — see domain-dns-wix).
verified: 2026-07-25
---

**Decision (Bryson, 2026-07-25):** start an email list on the website. Backend = **Resend Audiences** (same vendor already used for reports/alerts; real list product with broadcasts + unsubscribe). Placement = **homepage footer + end of every blog page**. Purpose = **marketing-tips newsletter** (matches the blog; nurtures prospects who aren't ready to buy).

**The signup UI:** a self-contained `.nl-signup` band (own `<style>` + `<script>`, no CSS-file dependency, dark+gold on-brand, Playfair heading). One email field + Subscribe, hidden honeypot field `company`, inline success ("You're in — thanks!") with the form hiding on success. Submits via `fetch()` to `/.netlify/functions/subscribe` (AJAX, no page reload). `window.blSubscribe` is the handler.
- **Homepage:** pasted directly above `<footer>` in `marketing-site/index.html` (data-source="homepage").
- **Blog (all pages):** `newsletterHTML(source)` exported from `marketing-site/netlify/lib/blog-render.mjs` and prepended inside `footerHTML()`, so every blog page (index, posts, glossary, 404) shows it (data-source="blog"). Verified 0px overflow + renders at 390/768/1280/1600.

**Backend — `marketing-site/netlify/functions/subscribe.mjs`:** POST JSON `{email, company, source}`. Validates email, honeypot-drops bots. Then best-effort + independent:
1. **Resend Contacts:** `POST https://api.resend.com/contacts` with `RESEND_API_KEY`, body `{email, unsubscribed:false}`. **Account-level — no audience_id** (Resend migrated to this; confirmed 2026-07-25 against a real account whose dashboard URL was `resend.com/audience` singular with no ID, and whose SDK examples showed `resend.contacts.create({email,...})` with no audienceId). A repeat email returns an error → treated as "already" (success). Adding contacts does NOT need a verified domain. Works with the API key already on the marketing site — zero extra config.
2. **Durable backup:** insert into the existing `website_leads` table (`form:"newsletter"`, service-role key), de-duped by email. Guarantees no signup is lost even if the Resend add fails, and gives Bryson an owned copy he can export.
Always returns `{ok:true}` for a valid email so the UX never breaks.

**OS side:** `loadLeads` in `index.html` now filters `l.form !== "newsletter"` so subscribers don't clutter the sales-Leads screen. The list itself is managed in Resend (Audiences), not the OS.

**BRYSON'S SETUP — essentially NONE for collecting.** Because Resend contacts are account-level and `RESEND_API_KEY` is already on the marketing site, signups flow into Resend Contacts (dashboard → **Audience** tab) the moment the fix is deployed. No `RESEND_AUDIENCE_ID` to create/set (that was the OLD Resend model; abandoned 2026-07-25 after discovering this account uses account-level contacts). Just test: subscribe on the site with your own email → it appears under Audience → Contacts in a few seconds.
- **To SEND newsletters (later):** Resend needs **boldlinemedia.com verified** as a sending domain — currently blocked because DNS is on Wix, which won't add the subdomain records Resend needs (see KB `domain-dns-wix`). Until then you can still COLLECT subscribers; sending a broadcast waits on either moving DNS off Wix or verifying via a workaround. Resend → **Broadcasts** is where you'll compose + send once verified.

**GOTCHAS:** (1) Resend changed from audience-scoped contacts (`POST /audiences/{id}/contacts`) to account-level (`POST /contacts`) — the first cut of subscribe.mjs used the old endpoint + a needless `RESEND_AUDIENCE_ID`; fixed 2026-07-25. If a signup ever 404s from Resend, check whether the endpoint model changed again. (2) marketing-site `REPORTS_FROM_EMAIL` is intentionally unset (can't verify domain on Wix), so the site doesn't send branded email today — collection needs no sending. Contacts get unsubscribe handling from Resend automatically once broadcasting is on.

**Verified 2026-07-25:** subscribe.mjs + blog-render.mjs `node --check` clean; homepage renders the band at all 4 breakpoints (0px overflow); AJAX submit posts the correct JSON and shows the success state + hides the form; honeypot returns before any POST.
