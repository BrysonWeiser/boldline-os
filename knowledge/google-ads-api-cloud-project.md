---
name: google-ads-api-cloud-project
topic: Google Ads
task: understand the Google Ads API developer-token sunset, or bump the API version
keywords: [when to apply standard access, standard access, basic access limit, 15000 operations, operations per day, rate limit, quota, brand verification, apply for standard, developer token, developer-token, sunsetting developer tokens, google cloud project, API Center, google ads api version, API_VERSION, GOOGLE_ADS_API_VERSION, v24, access level BASIC, 15000 operations, cloud project 600403499313, customer 989-283-2533, IAM owner editor, google ads api overview page, 2027 deadline, compliance email]
status: noted
summary: Google emailed 2026-09-13 that Google Ads API access levels have moved from developer tokens onto Google Cloud projects. BoldLine's token transferred automatically — Google Ads customer 989-283-2533, access level BASIC, Cloud project 600403499313. NOTHING BREAKS NOW and existing code keeps working; sending the developer-token header is merely optional from here. API versions released in the first half of 2027 will stop accepting it, and the legacy API Center page is decommissioned around the same time. The header comes out in the same change that bumps API_VERSION past the last version that accepts it, never earlier. The one genuinely time-sensitive item is IAM: once API Center is gone, Google's administrative and compliance emails go ONLY to Cloud project Owners and Editors, so Bryson's account must hold one of those roles on project 600403499313 or he stops being warned about his own ad infrastructure.
verified: 2026-09-14
---

Google's announcement email, received 2026-09-13, forwarded by Bryson 2026-09-14.

## The identifiers (public, kept on purpose per CLAUDE.md)

| Thing | Value |
|---|---|
| Google Ads customer ID | **989-283-2533** |
| Google Cloud project | **600403499313** |
| Its name in the console | **BoldLine Ads API** (project ID `boldline-ads-api`) |
| 🔴 Where it lives | **"No organization"**, NOT under `theboldlinemedia-org` |
| Access level | **BASIC** |

## What changed

Access levels are now a property of the **Google Cloud project**, not the developer token.
BoldLine's transferred automatically based on recent API activity, so there was nothing to
apply for and nothing to claim. Access is now viewed on the project's Google Ads API Overview
page in the Cloud Console; the legacy API Center page keeps the history until it is
decommissioned, expected first half of 2027.

## 🔴 Nothing breaks now, and the code was deliberately NOT changed

`google-ads.mjs` sends a `developer-token` header on every call. Google's own words: *"Your
existing code will continue working without any changes; however, sending a developer token in
your API call headers is now optional."*

**Removing it early buys nothing and risks a working integration**, which is the one thing
BoldLine cannot afford to break while a client's ads are live. API versions released in the
**first half of 2027** will stop accepting the header, and the API version is the natural
trigger: the header comes out in the same change that bumps `API_VERSION` past the last version
that takes it. Both the header and the `API_VERSION` constant carry a comment saying so.

`API_VERSION` is `v24`, overridable with `GOOGLE_ADS_API_VERSION` in Netlify, so a version bump
needs no code change — but dropping the header does, so they land together.

## 🔴 The one thing that IS time-sensitive: IAM

Administrative and compliance emails currently go to the addresses listed in API Center. Once
that page is decommissioned, **they go only to Google Cloud project Owners and Editors**. If
Bryson's address is not on project 600403499313 with one of those roles, he stops receiving
Google's warnings about his own ad infrastructure — including the ones that precede a
suspension. That is a two-minute check and it is the only action item from the whole email.

## 🔴 When to apply for Standard — researched 2026-09-14, answer is "not yet, and not on client count"

Bryson asked when to apply, expecting a third client that week. Measured rather than guessed.

**How Google counts.** A `Search` or `SearchStream` request is ONE operation. A mutate counts
every operation inside it (50 keywords in one call is 50). Basic is **15,000 operations/day**;
Standard is unlimited.

**What BoldLine actually spends, per client per day:**

| Job | Frequency | Ops per client per run | Per day |
|---|---|---|---|
| `ads-sync` performance read | hourly | 1 search | 24 |
| `ads-autopilot` | every 2h | 1 to 2 | 12 to 24 |
| `conversion-sync` | daily | 1 per conversion | a handful |
| `client-autobuild` | hourly, gated | usually 0 | ~0 |

**≈ 40 to 50 operations per client per day at rest.** Three clients is ~150 a day, **about 1%
of the cap**. A full campaign build is a one-off spike of roughly 80 to 100 (budget + campaign
+ ad groups + keywords + ads in one atomic mutate), so even twenty builds in a day is ~2,000.

**The cap bites somewhere near 300 clients at rest.** Client count is therefore the wrong
trigger. 🔴 The right trigger is **half the cap, ~7,500 operations a day**, or the day we ship
anything that reads far more per client (search-term mining across all accounts, keyword-level
hourly reporting, anything touching KeywordPlanIdeaService — which BoldLine does NOT use today
and which carries its own 1 QPS limit).

**And do not apply early "just in case".** Google's own wording: Standard *"is only granted to
developers who require unlimited Google Ads API operations, such as large companies or tools
that serve many users."* Applying at three clients invites a question with no good answer, and
a refusal is worse than not having asked.

## 🔴 What IS worth doing now: brand verification

Since a July 2026 pilot, **brand verification on the linked Cloud project gates every new Basic
and Standard access request**, and with it done a review lands in minutes to hours instead of
sitting in the backlog Google acknowledged in February 2026. Done with no deadline pressing it
is a ten-minute job; done the week the cap starts biting it is the difference between an
afternoon and several weeks with ads that cannot be managed.

It lives in the same Cloud Console as the IAM check: OAuth consent screen, user type External,
publishing status Production, branding details filled in.

## 🔴 How to actually FIND this project in the console (2026-09-14)

Bryson opened console.cloud.google.com to do the IAM job and landed somewhere else entirely, because
the console drops you into whatever project it used last and the picker is filtered by organization.
Three things make this project easy to miss, and all three bit in one sitting:

1. **The console opened on "My First Project"** (number **994350686555**, under
   `theboldlinemedia-org`) — an empty starter project with a $300 free-trial banner across the top.
   Nothing to do with the ads. **Ignore that banner; there is nothing to activate.**
2. **The project picker defaults to the organization**, and `theboldlinemedia-org` contains ONLY that
   starter project. Searching the number there returns nothing, which reads like "he has lost
   access" rather than "wrong filter".
3. **The ads project sits under "No organization"**, alongside a second project called
   **BoldLine OS** (`boldline-os`). Neither name carries the number, so the right one has to be
   confirmed by opening it and reading "Project number" on the welcome page.

**The route:** project picker (the chip beside the Google Cloud logo) → the **organization dropdown
inside that dialog** → **No organization** → **All** tab → **BoldLine Ads API**. Then check the
welcome page says **Project number: 600403499313** before changing anything.

**Never press "New project"** in the corner of that dialog while looking for it. A third empty
project is the one outcome that makes this worse next time.

## 🔴 Brand verification: the app name MUST match the home page (2026-09-14)

Google rejected a verification attempt on project `boldline-ads-api` with:

> The app name "BoldLine Ads API" configured for your OAuth consent screen does not match the app
> name on your home page.

**boldlinemedia.com says "BoldLine Media" everywhere** — the title, the nav, the footer — so the
consent screen has to say **BoldLine Media** too. The Cloud project can keep its own name
(`BoldLine Ads API`); only the **Branding → App name** field is judged against the site.

I had told him to leave it as "BoldLine Ads API" on the reasoning that renaming meant re-verifying.
That was exactly backwards: it was already rejected for that name, and the rejection was sitting on
the page. **Read the "Issues found from the previous verification attempt" panel before advising
anything about branding fields.**

Values that pass, all confirmed live (200) on 2026-09-14:

| Field | Value |
|---|---|
| App name | **BoldLine Media** |
| User support email | theboldlinemedia@gmail.com |
| Application home page | `https://boldlinemedia.com` |
| Privacy policy | `https://boldlinemedia.com/privacy` |
| Terms of service | `https://boldlinemedia.com/terms` |
| Authorized domain | `boldlinemedia.com` |
| Developer contact | both brysonaweiser@ and theboldlinemedia@ are already listed |

After fixing, the re-submit path is **Verify branding → "I have fixed the issues" → Proceed**, never
"I believe the issues found are incorrect" when Google's complaint is factually right.

**Layout note:** Google renamed this whole area to **Google Auth Platform**. There is no single
"OAuth consent screen" page any more — branding lives under **Branding**, user type and publishing
status under **Audience**, and verification under **Verification Center**.
