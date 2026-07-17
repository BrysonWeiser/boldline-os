---
name: contact-wizard
topic: Marketing site
task: change the step-by-step contact wizard (questions, steps, styling, or its submission wiring)
keywords: [leadWiz, wiz-step, contact wizard, multi-step form, lead form, chips, form-name contact, wizSend, step by step, wdot]
status: verified
summary: The contact section's visible single form is replaced by a 4-step chip-driven wizard (BUILT 2026-07-17, Bryson's idea to stop mid-form abandonment) — platform chips → budget chips → business name/website → name/email/phone → send. Submits AJAX to the SAME Netlify "contact" form (answers packed into name/business/email/message), so email notifications + submission-created + the OS Leads tab pipeline are untouched. CRITICAL: the old static form stays in the HTML with `hidden` — Netlify detects forms at build time from static HTML; deleting it would silently kill the whole pipeline. E2E-verified headless (flow + intercepted payload + 4 breakpoints).
verified: 2026-07-17
---

**Why:** single visible form asked for everything at once; multi-step keeps momentum (easy chip
first, contact info LAST, framed as "where should we send your plan"). Lanes: Calendly = ready
to book, wizard = interested not ready, recommender modal = browsing packages.

**Structure (marketing-site/index.html, #contact):**
- `#leadWiz` with 4 `.wiz-step`s + `.wiz-progress` dots (`.wdot`): (0) platform chips
  (Google/Meta/Both/Not sure) — reuses the recommender's generic `.opts`/`.q-label` classes;
  (1) budget chips (Under $1k / 1–3k / 3–8k / $8k+ / Not sure); (2) business name (required) +
  website (optional) + Continue; (3) name + email (required, regex) + phone (optional) + Send.
  Chips auto-advance (160ms); Back button; Enter advances on input steps; inline amber `.wiz-err`
  validation lines; success reuses `#formSuccess` and hides the "or send a message" divider.
- **The static `<form id="leadForm" name="contact" data-netlify>` is still in the DOM with the
  `hidden` attribute — DO NOT DELETE.** Netlify's form detection parses static HTML at build; the
  wizard AJAX-posts urlencoded to `/` with `form-name=contact` + the same field names
  (name/email/business/message + empty bot-field). message packs `Platform: … / Ad budget: … /
  Website: … / Phone: … / (via step-by-step contact)` so the OS Leads tab shows the answers.
- JS lives in the same IIFE as the old lead handler (reuses `encode()` + `leadOk`).

**Verified 2026-07-17 (headless, local HTTP server + POST intercept, external hosts blocked):**
old form hidden ✓, chip flow advances ✓, back button ✓, payload contains all fields ✓, success
box ✓, zero page errors ✓, wizard visible + no h-scroll at 390/768/1280/1600 ✓.

**Tuning:** chips/copy are plain HTML in the wiz-step divs; steps are indexed by `data-step` and
the JS derives count from `.wiz-step` nodes — adding a step = add the div + a `.wdot` and (if it
needs validation) wire its button. Keep contact info LAST.
