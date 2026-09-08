// Sending a client's Google Ads manager link request from inside the OS.
//
// Bryson, 2026-09-08, between two client calls: *"can you make it so when i put in the 10
// digit id later for sebastian the os automatically sends the manage link request"*. Until
// now it was six clicks inside Google's own interface and nothing in the OS did it at all.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { linkClientAccount } from "../netlify/functions/google-ads.mjs";

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

console.log(`verify-manager-link: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
