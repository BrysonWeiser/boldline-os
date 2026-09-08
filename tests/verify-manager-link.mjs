// Sending a client's Google Ads manager link request from inside the OS.
//
// Bryson, 2026-09-08, between two client calls: *"can you make it so when i put in the 10
// digit id later for sebastian the os automatically sends the manage link request"*. Until
// now it was six clicks inside Google's own interface and nothing in the OS did it at all.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { linkClientAccount, getClientLinkStatus } from "../netlify/functions/google-ads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GADS = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
const UI = readFileSync(join(ROOT, "index.html"), "utf8")
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

let pass = 0, fail = 0;
const ok = (name, cond, why = "") => { if (cond) pass++; else { fail++; console.log(`  FAIL  ${name}${why ? "\n        " + why : ""}`); } };
const threw = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

// ── 🔴 NEVER AUTOMATIC ON SAVE ───────────────────────────────────────────────
// A manager link request is VISIBLE TO WHOEVER OWNS THE NUMBER TYPED IN. Firing it when a
// Customer ID is saved means one mistyped digit sends a stranger a request from an agency
// they have never heard of, asking for control of their ad account.
ok("🔴 the request is a button, not a side effect of saving the ID",
  /<LinkRequestRow customerId=\{form\.googleAdsCustomerId\} \/>/.test(UI)
  && !/onChange[\s\S]{0,120}linkClient/.test(UI),
  "one mistyped digit would otherwise reach a real stranger's Google Ads account");
ok("🔴 and it takes two presses, showing the number back first",
  /state==="confirm"/.test(UI) && /Ask <strong[^>]*>\{pretty\}/.test(UI),
  "reading the number back is the only check that catches a typo before it leaves");
ok("the confirm buttons are a real tap target",
  /minHeight:36[\s\S]{0,200}Send request/.test(UI));
ok("it never offers to send when there is no ID at all",
  /if \(!digits\) return null;/.test(UI));
ok("it uses the shared owner-authed caller rather than a hand-rolled fetch",
  /await gadsCall\(\{action:"linkClient"/.test(UI),
  "a second way of calling the same endpoint is how half of it stops working later");
ok("🔴 a failure still tells him how to do it by hand",
  /Link existing account/.test(UI),
  "this runs while he is on a call with the client; a dead end there is the worst outcome");
ok("BoldLine's own house account is not offered the button",
  /!client\.internal&&<LinkRequestRow/.test(UI),
  "the house account is already under the manager; asking it to link to itself is nonsense");

// ── The server side ──────────────────────────────────────────────────────────
ok("the endpoint has a linkClient action", /action === "linkClient"/.test(GADS));
ok("🔴 it creates the link PENDING against the MANAGER account",
  /customers\/\$\{mcc\}\/customerClientLinks:mutate/.test(GADS) && /status: "PENDING"/.test(GADS),
  "we ask; the client approves. We must never be able to grant ourselves access");

ok("it refuses an empty id", (await threw(() => linkClientAccount("t", ""))) === "clientCustomerId required");
ok("🔴 it refuses anything that is not 10 digits, in words he can read mid-call",
  /10 digits/.test(await threw(() => linkClientAccount("t", "12345")) || ""),
  "Google's own error for this is opaque, and he reads it while a client waits");
{
  const m = await threw(() => linkClientAccount("t", "1234567890"));
  ok("a well-formed id gets past the guards toward the API", m === null || /manager account|fetch|network|token/i.test(m), m || "");
}

// ── 🔴 THE ONE-LETTER BUG THAT MADE THE BUTTON USELESS ───────────────────────
// Every other mutate in google-ads.mjs takes `operations: [...]`, so this one was written
// the same way, and Google answered "Unknown name 'operations': Cannot find field" — an
// error that reads like a permissions problem. Bryson had to send the request by hand on a
// live client call. CustomerClientLinkService links one account at a time and its request
// carries a single `operation`.
{
  // Comment lines stripped: the note explaining the bug names `operations: [...]` in prose,
  // and a test that reads its own explanation as the code it is checking proves nothing.
  const fn = GADS.slice(GADS.indexOf("export async function linkClientAccount"),
                        GADS.indexOf("export async function getClientLinkStatus"))
    .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  ok("🔴 the link request sends one `operation`, not an `operations` list",
    /const body = \{ operation: \{ create: \{/.test(fn) && !/operations:\s*\[/.test(fn),
    "Google rejects `operations` on this endpoint, and its error names a field, not a permission");
}

// ── Do we actually have access? ──────────────────────────────────────────────
// Bryson, 2026-09-08: *"make sure the os knows that we already sent the manager request and
// it was approved so we have manager access to sebastians google ad account"*. The tempting
// build is a stored tick. A client can revoke manager access from their own account at any
// time without telling us, and a stored tick would keep saying yes.
ok("the endpoint can be asked whether a client account is actually under us",
  /action === "linkStatus"/.test(GADS));
ok("🔴 and it ASKS GOOGLE rather than reading a flag off the client record",
  /FROM customer_client_link/.test(GADS) && !/googleAdsLinkStatus/.test(UI),
  "a stored tick keeps saying yes after a client revokes access, which is the one case it matters");
ok("it reads the link row on the MANAGER account, where those rows live",
  /customers\/\$\{mcc\}\/googleAds:search/.test(GADS));
ok("🔴 ACTIVE anywhere wins, because a refused request then a fresh one leaves two rows",
  /rows\.includes\("ACTIVE"\) \? "ACTIVE" : rows\.includes\("PENDING"\)/.test(GADS),
  "picking the first row would report a stale refusal on an account we now manage");
ok("no row at all reads as NONE, not as refused",
  /\|\| "NONE"/.test(GADS) || /rows\[0\] \|\| "NONE"/.test(GADS));
ok("it refuses an empty id", (await threw(() => getClientLinkStatus("t", ""))) === "clientCustomerId required");

// The OS side of the same question.
ok("the OS checks the status itself once a full 10-digit ID is present",
  /gadsCall\(\{action:"linkStatus",customerId:digits\}\)/.test(UI));
ok("🔴 and it does NOT ask about a half-typed number",
  /if\(digits\.length!==10\)\{ setLink\(null\); return; \}/.test(UI),
  "a partial id is a stranger's account, and asking about it is a request-shaped read on it");
ok("granted access is stated in his words, not Google's",
  /We manage this account\. Access is approved and live\./.test(UI)
  && !/>ACTIVE</.test(UI));
ok("🔴 and once access is live the send-request button is gone, not sitting there to re-press",
  /link&&link\.linked \? null : state==="sent"/.test(UI),
  "a Send request button under a green Access is live line is an invitation to break it");
ok("a failed check says so rather than reading as no access",
  /Could not check with Google just now/.test(UI));

console.log(`verify-manager-link: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
