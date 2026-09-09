---
name: client-campaign-tab
topic: OS
task: build a client's ad campaign without digging for the controls
keywords: [campaign tab, campaign creation, build campaign, where do i build ads, CampaignStartHere, launch card, conversion tracking order, client tabs, campaign section]
status: verified
summary: Everything needed to launch a client's ads existed and worked, scattered down the Package tab under the plan, the scorecard and the trade playbook. Building a campaign is the most common thing done on a new client and it was the hardest thing on the screen to find. New **Campaign** tab, second in the client tab strip right after Overview, holding the ordered guide, conversion tracking, the Google/Meta launch cards and the live campaign list. New `CampaignStartHere` card states the ORDER (account, landing page, tracking, build) and writes out only the one step that is actually blocking, all observed from the record. The house account's Package tab no longer relabels itself "Campaigns", which would have collided. Built 2026-09-09.
verified: 2026-09-09
---

**Why (Bryson, 2026-09-09):** *"when I go into an individual client there is a campaign
creation section that way I don't have to dig for it and make it very easy to use"*.

Nothing was missing and nothing was broken. The Package tab was doing two jobs: what the
client BOUGHT, and how their ads get built. The second was underneath the first.

## The tab

`["campaign","Campaign"]`, **second in `TABS`, right after Overview**, holding in this order:

1. `CampaignStartHere` (the guide, clients only)
2. `ConversionLoopCard` (tracking)
3. `AdCreativeStudio` / `GoogleLaunchCard` / `MetaLaunchCard` (the build)
4. `LiveCampaignsCard` (start / pause what exists)

Plus `MyAdsInsights` and `MyAdsSetupCards` for the house account, so **where the ads live is
one answer, not one per account type**.

🔴 **They MOVED off Package rather than being copied.** Two homes for one stateful card is
worse than an awkward home: he presses the one he was not told about and neither of us can
tell which he used. The suite asserts each card is on Campaign and *not* on Package.

## The guide, and why the order is the product

`CampaignStartHere`. Four steps, each read off the record, with only the blocking one written
out in full — a list of four green ticks is not a to-do list.

| Step | Done when | Why it is in this position |
|---|---|---|
| Their ad account is linked | `googleAdsCustomerId`, or Meta account + page | Nothing can be built without it |
| Their landing page is published | `landingPage.published && .headline` | The ads need somewhere to point |
| Conversion tracking is set up | `conversionId` + BOTH `form.label` and `qualified.resourceName` | 🔴 **Google refuses a campaign with a lead goal until this exists, and its error does not say so** |
| The campaign is built | `campaigns.length > 0` | Needs all three above |

🔴 **He learned that order from me, in chat, twice.** That is exactly the thing that should
not have to happen, and is the reason this card exists rather than a link to the launch card.

🔴 **Observed, never ticked**, same rule as the launch checklist and the pipeline panels. A
half-finished tracking run (form action created, qualified action not) reads as NOT done, and
a drafted-but-unpublished page reads as NOT done with different wording, because telling him
to generate a page he has already written is how he loses the one he wrote.

Every instruction names **where to go**, not just what is missing: "link the account" is not
an instruction to someone who does not know where that lives.

## Two things that had to move with it

- 🔴 **The house account used to relabel its Package tab "Campaigns"**, which would now sit
  beside a real Campaign tab reading `Campaign | … | Campaigns`, with the second one unable
  to build a campaign. Relabel removed. (The `portal` → `Assets` relabel stays; seven pieces
  of guidance depend on it and `verify-app-boots` pins it.)
- **Guidance that named the wrong place.** Three instructions said *"Build a campaign on the
  Campaigns screen (More, then Campaigns)"* — that screen manages campaigns, it does not
  build them. They now name the client's Campaign tab, in `index.html` **and** in
  `netlify/lib/launch-checklist.mjs`. `verify-app-boots` already fails when the OS names a
  tab that does not exist, and that guard is what makes the new name safe.

## Delete, on the row he is looking at

Bryson, 2026-09-09, looking at the stray campaign Google made Sebastian create while opening
his account: *"I need a way to delete this ad"*. Delete existed — on the **global Campaigns
screen**, a different screen behind a different menu. Standing in front of the campaign with
no way to remove it is the same complaint that built that screen, one level down.

`LiveCampaignsCard` rows now carry **Delete** after Start and Edit, red and last, because it
is the one press on that row that cannot be taken back.

🔴 **Same actions and same two confirmations as the Campaigns screen** (`removeCampaign` /
`deleteCampaign`). A second, gentler path to a destructive thing is how a destructive thing
gets done by accident. A live campaign is asked about twice and is **PAUSED before it is
removed**, so a delete that fails halfway leaves it stopped rather than running.

## 🔴 One name for one thing

Bryson, same message: *"how do I set up the tracking"* — while the card was on screen,
directly above what he was reading. The build card's warning said *"set up conversion
tracking… there is a button for it further up this screen"*, and the card further up this
screen was headed **"What Google Learns From"**. Both true, neither leading to the other.

The heading is now **Conversion Tracking**, the plain-English explanation opens by saying it
is what the builder below asks for, and the warning names the card and the button instead of
pointing vaguely upward. A card he cannot find by name is a card he cannot find.

## Tests

`tests/verify-campaign-tab.mjs`, 48 checks. The steps array is **extracted and executed**, and
the component itself is **compiled through Babel and rendered** into a recording React (same
harness as `verify-budget-editing`) so the assertions read the words that actually land on
screen. 21 mutations, all caught, including a genuine reordering of tracking after the build.

🔴 **The delete guard is EXECUTED, not matched.** The first version of it checked that the
word "confirm" appeared, and three mutations walked straight through — a confirm wired to a
constant, a missing confirm, and a live campaign deleted without being paused. It now
extracts `remove()` and runs it with a fake `window.confirm` and fake API callers, asserting
the exact call sequence: declining calls nothing, a paused campaign takes one confirmation,
a live one takes two, and a live one emits `setStatus:PAUSED` before `removeCampaign`.
