---
name: email-list-newsletter
topic: Marketing site
task: the website email list / newsletter signup — where it lives, how it stores subscribers (Resend Audience + website_leads backup), and Bryson's setup steps
keywords: [email list, newsletter, subscribe, signup, mailing list, resend audience, broadcast, RESEND_AUDIENCE_ID, subscribe.mjs, nl-signup, blSubscribe]
status: verified
summary: boldlinemedia.com has an email-list signup (Bryson, 2026-07-25) — a "Free Newsletter" band on the homepage footer + every blog page (blog-render footerHTML). It POSTs to netlify/functions/subscribe.mjs which (1) adds the contact to Resend's account-level Contacts (POST /contacts — NO audience_id) AND assigns it to the RESEND_SEGMENT_ID segment, and (2) writes a durable backup row to website_leads (form:"newsletter"). The OS filters newsletter rows out of the sales-Leads list. CRITICAL: the marketing site's RESEND_API_KEY must be FULL ACCESS — a "sending only" key 401s on /contacts ("restricted to only send emails") and silently drops every signup from Resend (fixed 2026-08-05). SENDING is now LIVE (domain verified; see newsletter-emails / domain-dns-wix).
verified: 2026-08-05
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

**GOTCHAS:** (1) Resend changed from audience-scoped contacts (`POST /audiences/{id}/contacts`) to account-level (`POST /contacts`) — the first cut of subscribe.mjs used the old endpoint + a needless `RESEND_AUDIENCE_ID`; fixed 2026-07-25. If a signup ever 404s from Resend, check whether the endpoint model changed again. (2) marketing-site `REPORTS_FROM_EMAIL` is intentionally unset (can't verify domain on Wix), so the site doesn't send branded email today — collection needs no sending. Contacts get unsubscribe handling from Resend automatically once broadcasting is on. (3) **Full-access key (2026-08-05):** the marketing key was "Sending access" → `POST /contacts` 401'd `"restricted to only send emails"`, so signups saved to `website_leads` but NEVER reached Resend (the OS showed subscribers from the DB backup while Resend Contacts showed 0 — that mismatch is the tell). Fix = a **Full access** Resend key. The failure is invisible from the UI (form always says "you're in"); the marketing site's Netlify **function log** prints `subscribe Resend failed: Resend 401 …` — that's the fastest diagnosis. (4) **Segments are manual (2026):** Resend renamed Audiences→Segments and broadcasts target a `segment_id`; a segment doesn't auto-include contacts, so `subscribe.mjs` now sends `segments:[RESEND_SEGMENT_ID]` on create. Needs `RESEND_SEGMENT_ID` set on the marketing site too.

**Verified 2026-07-25:** subscribe.mjs + blog-render.mjs `node --check` clean; homepage renders the band at all 4 breakpoints (0px overflow); AJAX submit posts the correct JSON and shows the success state + hides the form; honeypot returns before any POST.

## ➕ 2026-09-02 — Turning sending on would have fired the whole backlog

**Bryson:** *"Turn the newsletter on that way when someone does sign up it's not off"*, then
*"can you just clear the backlog"*.

- 🔴 **First, the premise needed correcting: SIGN-UPS WERE NEVER OFF.** `NEWSLETTER_SENDING_ENABLED`
  gates SENDING only. `subscribe.mjs` (marketing site) never reads it, so every signup has been
  captured to Resend contacts + `website_leads` the whole time. Nobody was ever lost.
- 🔴 **What the switch would actually have done.** `sendDueNewsletters` held every due email while
  sending was off, and the comment said it outright: *"leave them scheduled so they send the moment
  sending is turned on"*. The writer has been queueing one companion email per blog post hourly for
  weeks. So flipping one switch would have fired the entire backlog in a single run: several emails
  at once, each announcing a post that went live weeks ago as if it were new, and that is the first
  thing a brand new subscriber would ever have received.
- **The fix is a rule, not a tidy-up.** `STALE_AFTER_HOURS = 48`: an email more than 48h past its
  send time is RETIRED instead of sent. Two things follow. The existing pile clears itself on the
  next hourly run **whether or not sending is on**, which is what he asked for and means the queue
  is already empty before he touches the switch. And the trap cannot be reset the next time sending
  is ever paused.
- **Retiring is the same soft delete the OS delete button uses** (`status: "deleted"`), so a row
  retired by mistake can still be read and sent by hand.
- 🔴 **IT CANNOT LOOP, AND THE REASON LOOKS LIKE AN OVERSIGHT.** `ensureCompanionDraft` skips a post
  that already has a companion row, and that check is `.eq("post_slug", post.slug)` with **NO
  `.neq("status","deleted")` filter**. So a retired email is never regenerated. Adding a
  not-deleted filter there would make the hourly job create and bin a row forever, burning a model
  call each time. Pinned by a test for exactly that reason.
- `?test=1` on `newsletter-autopublish` now reports `wouldSend` vs `wouldRetire` instead of one
  lumped `dueNow`, so the backlog is visible in the run log. (Direct HTTP invocation of a scheduled
  function returns **403** from outside — the dry run is only readable in Netlify's function logs.)
- `tests/verify-newsletter-queue.mjs`, 25 checks, runs the REAL sender against a fake database.
  Covers both sides of the boundary, a missing/unparseable send time counting as fresh (right by
  ACCIDENT, since `NaN < cutoff` is false, so it is pinned), and three mutations: no cutoff at all
  (the shipped behaviour), retiring gated behind the switch, and the comparison inverted. All three
  caught.
- **Still on Bryson to do in Netlify:** set `NEWSLETTER_SENDING_ENABLED=1` on the **OS site**
  (`boldlinemedia`, no hyphen) → Site configuration → Environment variables, **then trigger a
  redeploy**, because an env var change does not reach running functions until the next deploy.
