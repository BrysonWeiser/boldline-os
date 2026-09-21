---
name: hiring-and-outreach-plan
topic: Business
task: decide when to hire, what role to hire first, how to actually hire a setter, or plan the cold outreach section of the OS
keywords: [hiring, first hire, appointment setter, cold caller, when to hire, account manager, media buyer, VA, contractor, 1099, cold outreach, cold calling, cold email, cold DM, outreach section, dialer, call workflow, follow up cadence, deliverability]
status: parked
summary: Bryson asked (2026-09-21) when he needs to start hiring and for what. Answer, agreed: hire against HOURS, not client count, and not until revenue would survive 90 days with no new sale (roughly 8-10 paying clients, ~$10k/mo). First hire is an APPOINTMENT SETTER on cold calls only, not an account manager, because the OS already absorbs servicing and his cap is conversations. Then a part-time coordinator around 12-15 clients, then maybe a media buyer at 25-30, and deliberately NOT a developer. The hiring how-to is written out below. It also produced his idea for a COLD OUTREACH section in the OS, which is parked with a recommended build order and two things flagged as must-not-build.
verified: 2026-09-21
---

## When to hire, and for what (2026-09-21)

Bryson: *"at what point will i need to start hiring people and what kinds of people/positions would i
need to hire?"*, then *"how would i hire a setter"*, then *"lets save this for later"*.

**The trigger is hours, not headcount.** His week is selling, servicing, and fixing. He hires when
servicing has eaten enough of the week that selling stops. Client count is a bad trigger because the
OS absorbs most servicing.

🔴 **The money rule first:** do not hire until revenue would still be there in 90 days with no new
sale. Sebastian stalling showed how fragile one or two clients is. Roughly 8-10 paying clients and
about $10k/mo, and even then the first hire is commission or part time, never a salary.

| Order | Who | When | Why this one |
|---|---|---|---|
| 1 | **Appointment setter, cold calls only** | After he has closed 3-5 himself, so the pitch is proven | Growth is capped by conversations. Most delegable, most miserable, most repeatable hour of his day. Touches no client and no ad account, so a bad hire costs almost nothing |
| 2 | **Part-time coordinator / VA** | ~12-15 clients, or a day a week lost to client admin | Onboarding chasing, approvals, "where's my report" |
| 3 | **Media buyer** | 25-30 clients, or a move to much bigger budgets | The OS builds campaigns; this is for the odd judgment call |
| ✗ | **Developer** | Resist | He has Claude. A lone dev on a codebase this size spends two months just learning it |

Design, video and one-off copy are bought per job, never hired. And before every hire, ask whether it
can be automated instead, because for this business it usually can. **Selling is the exception**: that
is where humans get added, not bots.

## How to hire the setter, when the time comes

1. **Write the job down in one paragraph first.** Call from the list I give you, follow the script,
   book into my calendar, log the outcome. No emails, no ad accounts, no pricing questions. The
   narrower the role, the cheaper it is and the less a bad hire can break.
2. **Have their three tools ready before hiring.** The list (🔴 **Lead Scout already produces it**,
   scored, so no list to buy). The script, written from his own calls that actually closed. His
   Calendly link. **They never get OS access.**
3. **Where:** OnlineJobs.ph for affordable offshore, which suits his stage; Upwork for a paid trial;
   agency-owner Facebook groups for US-based by word of mouth. Indeed and LinkedIn drown you in people
   who have never cold called.
4. 🔴 **The only screening step that matters: have them cold call HIM**, using the script, with him
   playing a business owner who does not want to talk. Ninety seconds tells you everything a résumé
   cannot. Pay them for the time. Anyone who refuses has answered.
5. **Pay (ballpark):** offshore ~$4-8/hr part time plus $10-25 a meeting; US ~$15-25/hr plus $50-75 a
   meeting. 🔴 **Pay on meetings that SHOW UP, not meetings booked**, or the calendar fills with people
   who agreed to end the call. Avoid commission-only: good setters refuse it.
6. **Paperwork:** contractor not employee, simple written agreement, confidentiality, W-9 and a 1099
   at year end if US. This is the natural moment to finally get the CPA in KB `business-taxes-accounting`.
7. **Calling rules:** B2B cold calling is normal and legal, but no auto-dialers and no recorded
   messages to mobiles, keep an internal do-not-call list, honour opt-outs immediately. Put it in their
   agreement. Worth reading Arizona's rules before starting. (General guidance, not legal advice.)
8. **First two weeks:** listen to calls, expect week one to be bad, track only meetings that showed. If
   that number is not moving by week three it is usually the list or the script, not the person.

## 🔴 PARKED IDEA: a cold outreach section in the OS

Bryson, 2026-09-21: *"what if we build a cold outreach section in the os and it is completely tailored
to doing cold outreach (cold calls, cold dms, cold emails, etc.)"*.

**Agreed it is the right next build**, because everything else in the OS serves clients he already has
and this serves the actual bottleneck. **Half of it exists**: Lead Scout finds, scores and lists
prospects. What is missing is WORKING the list. A card list with a status dropdown is not a workflow,
and nobody makes sixty dials a day off one.

**Build order:**

1. **The call workflow.** One prospect on screen, the script beside it, big outcome buttons (no answer,
   gatekeeper, not interested, callback, booked), which log, schedule the follow-up and advance to the
   next person. The value is removing every decision between calls.
2. **Follow-up cadence.** Where the meetings actually come from; almost nobody books on call one. The
   OS already runs scheduled jobs well.
3. **Honest counters.** Dials, conversations, meetings booked, and meetings that **showed up**, because
   that last one is what a setter gets paid on and the only one that cannot be gamed.
4. **Drafting for email and DM**, personalised from what Lead Scout already knows. The OS composes and
   logs; the sending happens in the real app.

**🔴 TWO THINGS NOT TO BUILD, and the reasons are about protecting what already works:**

| Do not build | Why |
|---|---|
| **A cold email sender in the OS** | Cold email at volume earns spam complaints, and complaints poison the sending domain. That is the same domain client reports and INVOICES go out on. A client's invoice silently landing in spam because of an email sent to a stranger is an unacceptable trade. Proper cold email needs a separate warmed domain and a dedicated tool, which is a deliberate decision and a real cost, not a feature to bolt on |
| **Automated Instagram / LinkedIn DMs** | Both platforms ban accounts for it, and his Instagram carries his name and is a business asset. The OS writing and logging a DM is fine; the OS pressing send is how the account is lost |

**Sizing:** several days across a few sessions, not an afternoon. **Start with the call workflow alone**,
have him use it himself for two weeks, then build the rest from what that teaches. Same logic as not
hiring a setter before the script is proven: do not automate a script nobody has proven yet.
