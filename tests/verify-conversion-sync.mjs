// The conversion signals send themselves now.
//
// Bryson, 2026-09-09, after asking what the two buttons on the Conversion Tracking card do
// and being told nothing sends them on a schedule: *"Yes can you make it automatic"*.
//
// 🔴 The failure this fixes is silent. Google can see a form was filled in and nothing else,
// so left alone it goes and finds more of everyone who fills in forms. The upload existed
// and worked, behind two buttons somebody had to remember to press. The ads just quietly
// stay average and nothing anywhere says why.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { uploadable, readyForConversions } from "../netlify/functions/conversion-sync.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JOB  = readFileSync(join(ROOT, "netlify/functions/conversion-sync.mjs"), "utf8");
const GADS = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
const TOML = readFileSync(join(ROOT, "netlify.toml"), "utf8");
const OS   = readFileSync(join(ROOT, "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };

const READY = {
  name: "Stencil & Thread", googleAdsCustomerId: "9248506870", conversionId: "123",
  conversionActions: { form: { label: "f" }, qualified: { resourceName: "customers/1/conversionActions/2" } },
};

// ── Who gets uploaded ────────────────────────────────────────────────────────
{
  ok("a client with tracking finished is uploaded", uploadable(READY));
  ok("🔴 a DEMO client never is",
    !uploadable({ ...READY, demo: true }),
    "its leads are invented, and the whole point is teaching a real ad account what a real buyer looks like");
  ok("a client with no Google account is skipped", !uploadable({ ...READY, googleAdsCustomerId: "" }));
  ok("🔴 and so is one whose tracking setup only half finished",
    !uploadable({ ...READY, conversionActions: { form: { label: "f" } } }),
    "uploading into an action that does not exist makes Google refuse the whole batch");
  ok("a missing conversionId counts as not set up",
    !readyForConversions({ ...READY, conversionId: "" }));
  ok("nothing at all is safe input", !uploadable(null) && !uploadable(undefined) && !readyForConversions(null));
}

// ── It runs the same code the buttons run ────────────────────────────────────
{
  ok("🔴 the upload was LIFTED OUT of the handler, not copied",
    /export async function sendConversions\(supabase, accessToken/.test(GADS),
    "two copies of \"what has already been sent\" is how a button and a job start disagreeing about what Google has been told");
  ok("the job imports it rather than reimplementing it",
    /import \{ getAccessToken as gadsToken, sendConversions \} from "\.\/google-ads\.mjs"/.test(JOB));
  ok("and the button's endpoint now calls it too",
    /const r = await sendConversions\(supabase, accessToken, \{/.test(GADS));
  ok("🔴 only what Google accepted is marked as sent",
    /rejected\.has\(i\)\) return;/.test(GADS)
    && /ONLY MARK WHAT GOOGLE ACTUALLY TOOK/.test(GADS),
    "marking a rejected row as sent hides it forever, and the lead never reaches the bidding it was meant to feed");
}

// ── The run itself ───────────────────────────────────────────────────────────
{
  ok("both stages are sent, not just qualified",
    /for \(const stage of \["qualified", "won"\]\)/.test(JOB),
    "closed customers with an order value are the strongest signal there is");
  ok("🔴 one client's failure never ends the run",
    /catch \(e\) \{[\s\S]{0,400}failed\+\+;/.test(JOB)
    && /ONE CLIENT'S FAILURE NEVER ENDS THE RUN/.test(JOB),
    "a run that stops on the first error silently starves every account after it in the list");
  ok("one OAuth exchange for the whole run, not one per client",
    /One OAuth exchange for the whole run/.test(JOB)
    && (JOB.match(/await gadsToken\(\)/g) || []).length === 1);
  ok("🔴 it does not fail silently either",
    /if \(failed \|\| rejected\) \{/.test(JOB) && /dispatchAlert/.test(JOB),
    "silence is the exact failure mode this job exists to fix");
  ok("the alert says what a rejection usually means and what to press",
    /conversion action was deleted in the ad account/.test(JOB) && /Re-check the setup/.test(JOB));
  ok("a red alert for an outright failure, amber for refused rows",
    /severity: failed \? "red" : "yellow"/.test(JOB));
  ok("it wraps in the shared failure alert like every other scheduled job",
    /withFailureAlert\("conversion-sync"/.test(JOB));
  ok("a missing service key aborts quietly rather than throwing",
    /conversion-sync aborted: SUPABASE_SERVICE_ROLE_KEY missing/.test(JOB));
  ok("no clients ready is a normal answer, not an error",
    /no client has conversion tracking finished yet/.test(JOB));
}

// ── It is actually scheduled ─────────────────────────────────────────────────
{
  ok("🔴 the function is scheduled in netlify.toml",
    /\[functions\."conversion-sync"\]\s*\n\s*schedule = "0 4 \* \* \*"/.test(TOML),
    "a job nobody schedules is the manual button it replaced");
  ok("and the comment says when that lands in his own timezone",
    /04:00 UTC = 9pm Phoenix/.test(TOML));
}

// ── The card stops reading like a chore ──────────────────────────────────────
ok("🔴 the OS says the upload happens by itself",
  /This sends itself every night, so there is nothing to remember/.test(OS),
  "without this the buttons still read as a job he has to remember, which is the thing that was fixed");
ok("and explains what the buttons are still for",
  /when you want Google to know sooner/.test(OS));

console.log(`verify-conversion-sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
