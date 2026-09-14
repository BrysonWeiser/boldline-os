---
name: google-ads-api-cloud-project
topic: Google Ads
task: understand the Google Ads API developer-token sunset, or bump the API version
keywords: [developer token, developer-token, sunsetting developer tokens, google cloud project, API Center, google ads api version, API_VERSION, GOOGLE_ADS_API_VERSION, v24, access level BASIC, 15000 operations, cloud project 600403499313, customer 989-283-2533, IAM owner editor, google ads api overview page, 2027 deadline, compliance email]
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

## Access level BASIC, worth knowing before it bites

BASIC is roughly 15,000 operations a day. That is ample for two clients and is not a problem
today. It becomes one at scale, and applying for Standard takes review time, so the moment
client count starts climbing is the moment to apply rather than the moment it starts failing.
