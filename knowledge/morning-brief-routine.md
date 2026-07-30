---
name: morning-brief-routine
topic: Ops / automation
task: the automated daily morning brief Claude sends Bryson (priorities for the day — ads, clients, new businesses, income, gym)
keywords: [morning brief, daily brief, routine, scheduled task, trigger, morning routine, daily priorities, game plan, MORNING-BRIEF.md, cron, 8am arizona]
status: verified
summary: A recurring Routine (trigger id trig_01AvKbwqaidkJZs3gYYVAusV) fires a FRESH Claude session every day at 8:00 AM Arizona (cron "0 15 * * *" UTC), which reads docs/MORNING-BRIEF.md + the live business state (knowledge/ index, docs/DEPLOYS.md) and writes Bryson a prioritized daily game plan (🎯 top priority · 📈 BoldLine · 📞 get clients · 💡 new income · 💪 gym · ✅ quick wins), delivered as a push notification + email. Read-only (never commits/deploys/emails). Set up 2026-07-29. Update docs/MORNING-BRIEF.md to change what it focuses on.
verified: 2026-07-29
---

**Why (Bryson, 2026-07-29):** wanted an automated morning routine that Claude sends him with everything to get done for the day — ads, making new businesses, more ways of making money, gym, etc.

**Chosen config (his answers):** 8:00 AM **Arizona** time, **every day**, delivered as a **text checklist** (push to phone + email). Arizona = UTC-7 fixed (no DST), so 8am AZ = **15:00 UTC** → cron `0 15 * * *`.

**How it's wired:**
- **The Routine** = `create_trigger` with `create_new_session_on_fire=true` (fresh session each morning in this repo's environment), `notifications={push:true,email:true}`, cron `0 15 * * *`. Trigger id **`trig_01AvKbwqaidkJZs3gYYVAusV`**, name "BoldLine Daily Morning Brief". First run 2026-07-30T15:01Z. Manage via list_triggers / update_trigger / delete_trigger.
- **The living context file** = `docs/MORNING-BRIEF.md` (on `main` so the fresh session clones it). Holds Bryson's mission, the category structure, standing priorities, current phase (pre-first-client; Google client sellable now, Meta in review), and `[bracketed]` placeholders for the PERSONAL bits Claude doesn't know: **gym schedule, cold-outreach target (calls/emails per day), target niche, and side-business/income ideas.** Update this file to reshape the brief — no need to touch the trigger.
- **The prompt** (stored in the trigger) tells the fresh session to: read MORNING-BRIEF.md → pull live state from docs/INTEGRATIONS.md + relevant knowledge/ + docs/DEPLOYS.md → write the prioritized game plan in the 6 sections (dropping empty ones, leading with the biggest needle-mover) → end with the brief as its final message (that becomes the notification). Explicitly READ-ONLY — no commits/deploys/emails/edits.

**Gotchas / notes:**
- The trigger stores **no MCP connectors** (this session had none passable), so the morning session can't call the claude-code-remote MCP (e.g. list_triggers to see other reminders). Minor — the brief's value comes from the repo/KB which it reads fine. If connector access is ever needed, recreate the routine from a session that holds the connector, or from the claude.ai Routines UI.
- To change time/days: `update_trigger` the cron. To pause: `update_trigger enabled:false`. To stop entirely: `delete_trigger`.
- **Personalized 2026-07-29 (same day):** MORNING-BRIEF.md now has Bryson's real life: wakes 8am / asleep by midnight; **day job Mon–Fri 2–10pm** so his ONLY business window is mornings ~8:10–12:30 (weekends open); gym 1–1.5h inside that. **Cold-call target = 20/day week 1 → 25–30/day + 5 emails, metric = 1 booked meeting/day, calling window ~10am–12:15pm.** Gym split **Mon Push · Tue Pull · Wed Legs · Thu Arms · Fri Plyometrics(vertical)** + a full Friday plyo workout written into the file. Income streams: **reselling** (current side hustle), **BoldLine branches** (add-on services), and **a future new business**. Brief adapts by day-of-week (weekday=calls, weekend=build, no cold calls Sat/Sun).
- **Niche LOCKED 2026-07-29 = HVAC (Phoenix metro)** (best local market, highest income ceiling; recommended over garage-door/med-spa/restoration).
- **⛔ OUTREACH GATED (Bryson, 2026-07-29):** the 📞 cold-call push is ON HOLD in MORNING-BRIEF.md until **Meta App Review is approved + verified 100% working** — he wants the full Google+Meta offer ready before selling. Until then the brief keeps client-getting to optional prep and puts daily weight on finishing Meta + build. **When Meta clears:** remove the ⛔ hold lines in MORNING-BRIEF.md, activate the 📞 targets (20/day wk1 → 25–30/day, 1 booked meeting/day), and build the first 25-name Phoenix HVAC list + call script. (The 2026-08-05 Meta-status reminder trig_01GfUrFRykYvdbWbs5Qk187A already carries this activation step.)
