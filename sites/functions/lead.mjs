// The contact form on a client's website: passed to the OS, kept safe if the OS is down. See lead-relay.mjs.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../../netlify/lib/supabase-url.mjs";
import { relayLead, queueStore } from "../../netlify/lib/lead-relay.mjs";

export default async (req) => relayLead(req, {
  fetchFn: fetch,
  store: queueStore(createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || "")),
  osBase: process.env.OS_BASE_URL || undefined,
});
export const config = { path: "/lead" };
