// Is the founding-client offer still open? Asked by the marketing site's own banner.
//
// 🔴 THE BANNER IS HIDDEN UNTIL THIS SAYS YES, WHICH IS THE OPPOSITE OF THE USUAL RULE HERE.
// KB `content-visibility-no-js` says never gate content on JS, because a crawler that does not
// run scripts saw a blank page once. That rule is about the page's SUBSTANCE and it still
// stands: the hero, the packages, the FAQ and the reviews are all in the HTML and visible with
// scripts off. This is one promotional claim, and it is the one thing on the page where being
// wrong is expensive in a way losing a line of persuasion is not.
//
// Fail direction, chosen deliberately: if this endpoint is down, slow, blocked, or the visitor
// has JS off, the banner STAYS HIDDEN. Worst case he loses a persuasion line. The alternative
// fail direction advertises a free build worth $1,500 to $4,900 that has already been given
// away three times, to someone who will quite reasonably ask for it.

import { createClient } from "@supabase/supabase-js";
import { foundingOfferActive, foundingSlotsLeft } from "../../../netlify/lib/founding.mjs";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      // A minute of edge caching. Long enough that a burst of visitors is one query, short
      // enough that the offer comes down within a minute of the third signature.
      "cache-control": "public, max-age=60",
    },
  });

export default async () => {
  // No key configured means we cannot prove the offer is still open, so we do not claim it is.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ active: false, reason: "unconfigured" });
  try {
    const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from("clients").select("data");
    if (error) throw error;
    const clients = (data || []).map((r) => r.data).filter(Boolean);
    return json({ active: foundingOfferActive(clients), slotsLeft: foundingSlotsLeft(clients) });
  } catch (e) {
    console.error("founding-status failed:", e && e.message);
    // Same reasoning as above: an error is not evidence the offer is open.
    return json({ active: false, reason: "error" });
  }
};
