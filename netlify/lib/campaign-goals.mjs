// What a campaign is told to go and buy.
//
// Bryson, 2026-09-02: *"Can you make a way for me to be able to select whether I want an ad
// I'm making to go for leads clicks etc"*.
//
// He is right that this should be a choice. Until now it was INFERRED: a Meta campaign
// chased leads if a pixel id happened to be saved on the client and page views otherwise,
// and Google always used manual CPC. Inferring it is how the house campaign spent $87 on
// 6,997 page views and zero leads while everyone assumed it was hunting for leads.
//
// 🔴 THE ONE RULE THIS FILE EXISTS TO ENFORCE: A GOAL IS NEVER SILENTLY DOWNGRADED.
// Asking for leads without the tracking to find them must FAIL LOUDLY at build time. The
// tempting alternative — quietly fall back to traffic — recreates the exact bug above, and
// makes it worse, because now he would have deliberately chosen "Leads" and still be buying
// clicks. A campaign that refuses to build costs nothing. One that builds and buys the
// wrong thing costs money every hour until somebody notices.

// Two goals, not five, and that is a decision rather than a first draft.
//
// The obvious third candidate on Meta is LINK_CLICKS, but LANDING_PAGE_VIEWS is strictly
// better for the same money: it optimises for people whose browser actually finished
// loading the page rather than for people whose thumb touched the ad. Offering both would
// be offering a worse option next to a better one with no way to tell them apart.
//
// Reach and awareness objectives are deliberately absent. They buy eyeballs that never
// visit, which cannot produce a customer for a business that gets paid per job.
export const GOALS = [
  {
    id: "leads",
    label: "Leads",
    // Written for Bryson, and shown to him verbatim in the OS.
    blurb: "Find people likely to fill in the form. Costs more per click and is the point.",
    needs: "tracking",
  },
  {
    id: "traffic",
    label: "Visits",
    blurb: "Buy the most page visits for the money. Cheaper clicks, fewer of them convert.",
    needs: "",
  },
];

export const GOAL_IDS = GOALS.map((g) => g.id);

// The default when a caller says nothing. 🔴 "traffic", NOT "leads", and not for tidiness:
// client-autobuild and any older caller still build campaigns without naming a goal, and a
// default of "leads" would make every one of those either fail outright or start optimising
// for an event the client's site may never fire. Silence must keep meaning what it has
// always meant.
export const DEFAULT_GOAL = "traffic";

// 🔴 The two platforms need DIFFERENT tracking, so they need different instructions. One
// generic "set up tracking" message would send him hunting through the wrong screen, which
// has already cost an evening once this week over two similarly named Netlify sites.
const FIX_TRACKING = {
  meta: 'Add the Meta Pixel ID on this client. Open My Ads, press Edit, and paste it into the "Meta Pixel ID" box.',
  google: "Set up conversion tracking for this client first. There is a button for it on the client's Ads screen.",
};

/**
 * Normalise and validate a requested goal.
 * @param {string} goal   what the caller asked for, possibly empty
 * @param {object} have   { tracking: boolean, platform: "meta"|"google" }
 * @returns {{goal:string}|{error:string}}
 */
export const resolveGoal = (goal, have = {}) => {
  const raw = String(goal == null ? "" : goal).trim().toLowerCase();
  if (!raw) return { goal: DEFAULT_GOAL };
  if (!GOAL_IDS.includes(raw)) {
    return { error: `"${goal}" is not a campaign goal. Choose ${GOAL_IDS.join(" or ")}.` };
  }
  if (raw === "leads" && !have.tracking) {
    // This message is the WHOLE instruction he gets, so it says what is missing and which
    // screen fixes it, and it never names a field in a file.
    const fix = FIX_TRACKING[have.platform] || "Set up conversion tracking for this client first.";
    return { error: `This campaign is set to go after leads, but there is nothing connected that can count a lead, so it would spend the budget hunting for something it cannot see. ${fix} Then build it again. Nothing was created.` };
  }
  return { goal: raw };
};
