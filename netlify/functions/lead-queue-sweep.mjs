// Every 10 minutes: deliver any client-website enquiries that were kept safe while the OS was down (KB
// `website-builder`, "Client websites have their own home"). The client-websites site queues an enquiry in
// private storage when the OS does not answer; this hands each one to the real lead intake, exactly as if
// it had arrived live, so the alert, the auto-reply and the CRM forward all still happen.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/supabase-url.mjs";
import { withFailureAlert, dispatchAlert } from "../lib/alerts-shared.mjs";
import { queueStore, sweepQueue } from "../lib/lead-relay.mjs";
import intake from "./lead-intake.mjs";

// Straight into the intake function, not over the network: if this job is running, the OS is up.
export const deliverVia = (handler) => async (e) => {
  const r = await handler(new Request(`https://os.internal/lead?token=${encodeURIComponent(e.token)}`, {
    method: "POST", headers: { "content-type": e.contentType || "application/json" }, body: e.body,
  }));
  return r.status;
};

const handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response("not configured", { status: 200 });
  const store = queueStore(createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY));
  let r;
  try { r = await sweepQueue({ store, deliver: deliverVia(intake), alert: dispatchAlert }); }
  catch (e) {
    // An empty or not-yet-created queue is the normal case, not a failure.
    if (/not found|does not exist/i.test(String(e.message))) return new Response("queue empty", { status: 200 });
    throw e;
  }
  const line = `lead-queue-sweep: ${r.delivered} delivered, ${r.retry} to retry, ${r.rejected} refused, ${r.parked} set aside`;
  if (r.delivered || r.retry || r.rejected || r.parked) console.log(line);
  return new Response(line, { status: 200 });
};

export default withFailureAlert("lead-queue-sweep", handler);
