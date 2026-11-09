---
name: hipaa-health-clients
topic: Clients and compliance
task: take on or run a medical / health client (chiropractor, dentist, med spa, therapy, clinic) where HIPAA and the ad platforms' health rules apply
keywords: [hipaa, phi, patient information, business associate agreement, baa, medical clients, health clients, chiropractor, med spa, dental, meta pixel health, google healthcare policy, personal attributes, legitscript, health mode]
status: health switch LIVE 2026-11-09 (Bryson said go). Springbok Wellness on automatically.
summary: Bryson asked 2026-11-09 how BoldLine handles HIPAA for medical niches. Answer: today it is handled by hand per client (Springbok rules), not enforced by the OS. Plan recommended - stay OUT of holding patient health details (a "health mode" switch per client), and only become a HIPAA business associate (BAA + HIPAA-eligible vendors + written safeguards) if medical becomes a main niche. Get a healthcare lawyer to check the setup once before signing health clients routinely; this is general guidance, not legal advice.
verified: 2026-11-09
---

## What applies (general, not legal advice)
- HIPAA covers the practice (a "covered entity"). BoldLine becomes a **business associate** the moment it receives,
  stores or sends patient health information for them. Then a **BAA** is required, BoldLine must follow the Security
  Rule (risk assessment, access controls, breach notice), and every vendor that touches the data needs a BAA too.
- 🔴 Today the OS DOES touch it for a health client: leads land in the OS database first, then go to the client
  (KB `lead-handoff`); lead emails/texts go through outside services; Aria (AI follow-up) can text or call a lead.
  Name + phone + "reason for visit" on a clinic's page is, conservatively, patient information.
- Most of the services the OS runs on only sign BAAs on paid/enterprise plans, if at all. Going fully HIPAA-ready is
  real cost and paperwork; only worth it if medical becomes a main niche (Bryson's focus is service trades, KB
  `niche-selection`).
- Tracking: HHS warned in 2022/2024 that pixels on health sites can leak patient information (part of that guidance
  was struck down by a court in 2024, but the FTC still enforces). Meta now limits what health advertisers can track
  and optimise for. Practical rule: no Meta Pixel on a health client's page, no conditions in conversion data.
- Ad rules: Google bars targeting or remarketing on health conditions; Meta bars copy that implies you know someone's
  condition ("Struggling with back pain?" is rejected; "Back pain treatment in Mesa" is fine). Prescription drugs
  (Botox by name, weight-loss injections), addiction treatment and some others need certification (LegitScript)
  or are not allowed.

## How we handle it now (manual, from Springbok Wellness)
- Landing form: contact details only, no symptom or history questions; no Meta Pixel (`metaPixelId` left empty).
- Show-up tracking: the practice tells us yes/no per lead only, never what the visit was about.
- Reviews: replies never confirm the reviewer is a patient. Review requests to patients need a BAA first.
- If the practice asks for a BAA, say yes (and then the vendor question above becomes real).

## The health switch (built 2026-11-09)
- ONE source: `netlify/lib/health-mode.mjs` (`HEALTH_NICHE_SRC`, `HEALTH_NOT_SRC`, `SAFEGUARDS`, `healthModeOf`,
  `healthBlocks(cl, key)`). index.html carries a copy for the OS card; `verify-health-mode` fails if they drift.
  It replaced three separate niche regexes (site-render, site-blog, review-requests).
- Stored on the client: `healthMode` "auto" (default) | "on" | "off"; `healthSafeguards {key:false}` for any one
  switched off. Auto = niche, niche group, industry or name matches the list (every OS "Health & Medical" niche, and
  Springbok by "Chiropractic"/"Wellness"), minus exclusions (vets, cars, law firms, massage, day spas and similar).
- OS: "Health and privacy (HIPAA)" card on every client's Overview (ads and website-only), Auto / Always on / Off
  plus a tick box per safeguard. Non-health clients see one quiet line with "Change".
- Safeguards and where they bite: `form` (site-render no textarea; lead-intake blanks `message` BEFORE appendLead),
  `pixel` (landing.mjs drops metaPixelId), `autoReply` (lead-intake notifyLead + lead-followup skip),
  `patientEmails` (isHealthBusiness -> review requests refused, queued rows stopped with reason "health", past-customer
  emails refused), `reviewReplies` (gbp replyPrompt adds HEALTH_REPLY_RULE), `adRules` (ad-gen systemFor(isAgency,
  health) adds HEALTH_AD_RULES; healthForAds looks the client up by clientId so the rules hold without the OS flag).
- Trade-off told to Bryson: with `autoReply` on, the lead gets no instant "thanks" text; the practice calls them.
- Guard: `tests/verify-health-mode.mjs` (70 checks, renders the card and the real landing page). verify-review-requests'
  sample is a chiropractor, so its fixture carries `healthMode: "off"` (it tests sending mechanics).

## Original recommendation (now built, above): "Health client" switch on the client record
Form fields locked to contact details (no free-text box); no Meta Pixel; Aria AI follow-up off; lead emails/texts
carry no reason-for-visit; ad-copy check for "you + condition" wording; generic review replies; the lead goes
straight to the practice and is kept in the OS only as long as billing needs it.
