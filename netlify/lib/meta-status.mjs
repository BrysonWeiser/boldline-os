// "Switched on" and "actually delivering" are two different questions on Meta.
//
// Bryson, 2026-09-04, after pausing the views campaign and raising the budget on the leads
// one, sent a screenshot of the Campaigns screen reading:
//   Live · Not delivering · "Meta says this campaign is on, but it isn't serving (in process)
//   — usually the ad set or the ad underneath is paused."
// on a campaign with 786 views and $9.05 of spend, minutes after he changed its budget.
//
// 🔴 TWO DEFINITIONS OF "LIVE" THAT DISAGREED WITH EACH OTHER.
//
// Meta reports both `status` (the campaign's own switch, the thing the Pause button acts on)
// and `effective_status` (whether it is serving right now, which also swallows everything
// underneath it and every transient state). The Campaigns screen read `status`, so it said
// Live. The hourly snapshot read `effective_status || status`, so the SAME campaign was about
// to appear in My Ads as **Paused**, under the sentence "Not running, so it has not been seen
// by anyone and has spent nothing" — on a campaign that had been seen 786 times and had spent
// real money. A false sentence, arrived at honestly, from one word being asked to mean two
// things.
//
// 🔴 AND `IN_PROCESS` IS NOT A FAULT. It is Meta still applying an edit, which is the single
// most likely thing to be true immediately after changing a budget in the OS. It clears on its
// own. Reporting it as "the ad set underneath is paused" sends him into Ads Manager hunting
// for a problem that does not exist.
//
// So: `metaOn` answers "is the switch on" and `metaDelivering` answers "is it serving", and
// nothing has to guess which one a caller meant.

// The campaign's own switch. This is what Pause and Start act on, and what the OS means by a
// campaign being on.
export const metaOn = (c) => String((c || {}).status || "").toUpperCase() === "ACTIVE";

// Serving right now. A campaign with no effective status reported has nothing to contradict
// its switch, so the switch stands.
export const metaDelivering = (c) => {
  const eff = String((c || {}).effectiveStatus || "").toUpperCase();
  return metaOn(c) && (!eff || eff === "ACTIVE");
};

// Google has no equivalent split: ENABLED means enabled, and anything blocking delivery shows
// up as the campaign not being ENABLED. Kept here so callers can pass one pair of functions
// per platform rather than special-casing.
export const googleOn = (c) => String((c || {}).status || "").toUpperCase() === "ENABLED";
export const googleDelivering = googleOn;
