// Morning agenda digest — SCHEDULED (netlify.toml: daily 14:00 UTC = 7am AZ).
// Thin wrapper around the shared engine. The OS Calendar screen is a view only;
// this is what actually notifies you (push + email) about what's on today.
// Only sends when there's >=1 item that day (?test=1 forces a send). The on-demand
// "send now" button uses calendar-digest-run.mjs, which shares the same engine.

import { runDigest } from "../lib/calendar-digest-shared.mjs";
import { withFailureAlert } from "../lib/alerts-shared.mjs";

const run = async (req) => {
  const force = new URL(req.url).searchParams.get("test") === "1";
  const result = await runDigest({ force });
  return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
};

export default withFailureAlert("calendar-digest", run);
