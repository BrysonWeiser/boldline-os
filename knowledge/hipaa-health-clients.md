---
name: hipaa-health-clients
topic: Clients and compliance
task: take on or run a medical / health client (chiropractor, dentist, med spa, therapy, clinic) where HIPAA and the ad platforms' health rules apply
keywords: [hipaa, phi, patient information, business associate agreement, baa, medical clients, health clients, chiropractor, med spa, dental, meta pixel health, google healthcare policy, personal attributes, legitscript, health mode]
status: explained to Bryson 2026-11-09; no "health mode" built yet (offered). Springbok Wellness is the only health deal and is handled by hand.
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

## Recommended next build (offered, not built): "Health client" switch on the client record
Form fields locked to contact details (no free-text box); no Meta Pixel; Aria AI follow-up off; lead emails/texts
carry no reason-for-visit; ad-copy check for "you + condition" wording; generic review replies; the lead goes
straight to the practice and is kept in the OS only as long as billing needs it.
