// Two controls that move real money, and one button that proves a connection without
// touching anything.
//
// Bryson, 2026-09-03:
//   *"can you build a button to automatically send a test from the os right now too"*
//   *"for the campaigns i need a way to manually edit their daily budget and how long I want
//    the ads running for"*
//
// 🔴 THE TEST BUTTON'S WHOLE VALUE IS THAT IT WRITES NOTHING. `forwardLead(..., {dryRun})`
// has honoured Shaun's `test=true` since 1 September and NOTHING IN THE OS COULD REACH IT,
// so the only proof the connection worked was to wait for a real lead. That is precisely
// the wrong moment to discover the shared secret is wrong.
//
// 🔴 THE BUDGET AND DATE CONTROLS ARE THE OPPOSITE: every save moves money on somebody
// else's ad account. So they confirm, they re-read afterwards, and an empty date has to mean
// something definite rather than "unset".

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const TEST = readFileSync(join(ROOT, "netlify/functions/crm-test.mjs"), "utf8");
const GOOG = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
const META = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const UI = code(S);

// ── The test send ─────────────────────────────────────────────────────────────
t("🔴 it is a DRY RUN, always", () => {
  assert.match(code(TEST), /forwardLead\(client, testLead\(\), \{ dryRun: true \}\)/,
    "the test send is real, so testing the connection drops a junk contact into the client's pipeline");
});

t("🔴 and it never writes to the client record", () => {
  // forwardLead normally stamps its result onto the lead. There is no lead here to stamp,
  // and a test that changed something real would break the standing preview-safety rule.
  assert.ok(!/\.update\(/.test(code(TEST)), "the test send writes to the client record");
});

t("the fake lead announces itself as fake", () => {
  const { testLead } = { testLead: null };
  assert.match(TEST, /name: "BoldLine Test Lead"/, "the test contact looks like a real person to whoever reads it");
  assert.match(TEST, /Nothing to action/, "the message does not tell the reader to ignore it");
  assert.match(TEST, /test@boldlinemedia\.com/, "the email is not obviously ours");
});

t("🔴 it asserts NO consent for a person who does not exist", () => {
  // Sending "no" would be a claim; absent is what a real untouched form sends, and a test
  // must not fabricate a permission record.
  assert.ok(!/smsConsent/.test(code(TEST)),
    "the test lead carries a consent value, which invents a permission for a person who does not exist");
});

t("it is behind the owner's login and refuses anything but a POST", () => {
  assert.match(code(TEST), /auth\.getUser\(jwt\)/, "anyone on the internet can fire test sends at a client's system");
  assert.match(code(TEST), /Method not allowed/);
});

t("🔴 an unconfigured client is told what to do, not shown an error", () => {
  assert.match(TEST, /There is no address to send leads to yet/, "no message when nothing is set up");
  assert.match(TEST, /Send leads on to/, "the message does not name the box he has to fill in");
});

t("a 401 says what a 401 actually means", () => {
  // "Failed" would send him hunting. The one cause worth naming is the one that happens.
  assert.match(TEST, /shared secret in the OS does not match theirs/,
    "a rejected password reports as a generic failure");
});

t("the button exists and explains itself before it is pressed", () => {
  assert.match(UI, /<CrmTestButton client=\{client\}\/>/, "the button is never rendered");
  assert.match(S, /Send a test lead/);
  assert.match(S, /It is a dry run: their system checks everything and saves nothing\./,
    "nothing tells him it is safe to press, so he will not press it");
});

// ── Budget and run dates ──────────────────────────────────────────────────────
t("both platforms can be told when to stop", () => {
  assert.match(code(GOOG), /export async function setEndDate/, "Google campaigns cannot be given an end date");
  assert.match(code(META), /export async function setEndTime/, "Meta campaigns cannot be given an end date");
  assert.match(code(GOOG), /action === "setEndDate"/, "the Google write is unreachable");
  assert.match(code(META), /action === "setEndTime"/, "the Meta write is unreachable");
});

t("🔴 an end date can be REMOVED, not only set", () => {
  // Google rejects an empty end_date, so clearing it means writing its own runs-forever
  // sentinel. Without that a typo'd date could never be undone without rebuilding the
  // campaign.
  assert.match(code(GOOG), /"20371230"/, "clearing a Google end date is impossible, so a typo is permanent");
  assert.match(UI, /endDate:draft\.until/, "the date is not sent when blank, so yesterday's date stays put");
  assert.match(UI, /endTime:draft\.until/, "same on Meta");
});

t("🔴 and the sentinel reads as NO end date on the way back", () => {
  // Otherwise the box shows a date in 2037 he never typed, which is exactly the kind of
  // number that makes somebody stop trusting a screen.
  const i = S.indexOf("const isoDay");
  assert.ok(i > 0, "the date reader is gone");
  const isoDay = new Function(`${S.slice(i, S.indexOf("\n};", i) + 3)}\nreturn isoDay;`)();
  assert.equal(isoDay("20371230"), "", "Google's runs-forever sentinel shows as a real date");
  assert.equal(isoDay("2026-09-20"), "2026-09-20");
  assert.equal(isoDay("2026-09-20T23:59:59.000Z"), "2026-09-20", "a Meta timestamp is not read");
  for (const junk of ["", null, undefined, "nonsense", "2026-09"]) assert.equal(isoDay(junk), "");
});

t("🔴 the last day is included, not excluded", () => {
  // A date input gives midnight. Stopping at 00:00 on the day he typed means it does not run
  // that day at all, which is not what anybody means by "run until the 20th".
  assert.match(code(META), /T23:59:59/, "a Meta campaign stops at the start of its last day");
  assert.match(S, /The last day is included/, "nothing on screen says which way it reads");
});

t("🔴 a tenfold budget typo is questioned", () => {
  // Nothing else in the OS would catch $700/day where $70 was meant until the money was gone.
  assert.match(UI, /after>=before\*3/, "any budget change saves without a question");
  assert.match(S, /times higher and it spends on/, "the confirmation does not say what the new number does");
});

t("a budget that is not a positive number is refused", () => {
  assert.match(UI, /The daily budget has to be a number above zero/, "zero or a letter is sent to the ad account");
});

t("the screen re-reads the account after saving", () => {
  // 🔴 So it shows what the platform actually holds rather than what was typed. A save that
  // half-applied would otherwise look complete.
  const i = UI.indexOf("const saveEdit=async");
  const body = UI.slice(i, UI.indexOf("\n  const toggle=", i));
  assert.match(body, /await load\(\);/, "the row keeps showing the typed value even if the platform rejected it");
  assert.match(body, /setEdit\(null\)/, "the editor stays open after a successful save");
});

t("the controls are reachable from the card he actually uses", () => {
  assert.match(UI, /onClick=\{\(\)=>openEdit\(platform,c\)\}/, "there is no Edit control on a campaign row");
  assert.match(S, /Daily budget/);
  assert.match(S, /Run until/);
  assert.match(S, /Save to the ad account/, "the save button does not say where the change goes");
});

t("🔴 an empty date box says what empty MEANS", () => {
  // Without this, blank reads as "not set yet" rather than "runs until I stop it", and he
  // would never dare clear it.
  assert.match(S, /Leave the date empty and it runs until you pause it/,
    "an empty date box is unexplained, so its meaning has to be guessed");
});

console.log(`✓ verify-campaign-controls: ${n} checks passed`);
