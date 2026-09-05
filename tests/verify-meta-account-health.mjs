// Why a campaign that says RUNNING has stopped spending.
//
// Bryson, 2026-09-04, on a campaign marked RUNNING with $9.05 spent and not a cent more for
// seven hours on a $14 a day budget: *"why has the ad not been doing anything for the past
// few hours"*.
//
// 🔴 THE CAMPAIGN WAS NOT THE PROBLEM, AND THE CAMPAIGN WAS ALL WE WERE LOOKING AT.
//
// Every Meta fact the OS held was per campaign: status, effective status, spend, budget. Every
// one of them can read perfectly healthy while the ACCOUNT underneath refuses to spend another
// penny, and Meta does not mark the campaign as broken when that happens. It just quietly
// stops delivering. So the screen said Running, the numbers froze, and there was nothing
// anywhere in the OS that could explain it.
//
// The three account-level killers, in the order they actually happen to a small advertiser:
// a lifetime spending limit reached, a card that has stopped working, and the account itself
// disabled or under review. None of them are visible from a campaign read.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const META = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");
const SYNC = readFileSync(join(ROOT, "netlify/functions/ads-sync.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S);
let n = 0;
const t = (name, fn) => { fn(); n++; };

const LIB = await import("../netlify/lib/meta-account-health.mjs");

// 🔴 THE BROWSER COPY, EXTRACTED AND RUN. index.html cannot import the lib, so there are two
// copies and they must agree. Every case below runs against BOTH.
const start = S.indexOf("const MA_STATES = {");
assert.ok(start > 0, "the browser copy of the account check is gone");
const end = S.indexOf("// ─── IS IT ON, AND IS IT ACTUALLY RUNNING", start);
assert.ok(end > start, "the browser copy's end anchor moved");
const B = new Function(S.slice(start, end) + "\nreturn { accountTrouble, MA_STATES };")();
const both = (fn) => { fn(LIB, "server"); fn(B, "browser"); };

// ── 1. 🔴 THE CASE HE HIT: A LIMIT NOBODY REMEMBERS SETTING ──────────────────
t("🔴 a spending limit reached stops everything, and says exactly that", () => {
  both((M, w) => {
    const r = M.accountTrouble({ accountStatus: 1, spendCap: 10, amountSpent: 9.05 });
    // $9.05 of a $10 cap is 90.5%, so this is the warning band, not the wall.
    assert.ok(r, `[${w}] an account within pennies of its cap says nothing at all`);
    const hit = M.accountTrouble({ accountStatus: 1, spendCap: 10, amountSpent: 10 });
    assert.equal(hit.blocked, true, `[${w}] a cap that has been reached is not treated as blocking`);
    assert.match(hit.say, /lifetime spending limit of \$10/, `[${w}] it does not say what the limit is`);
    assert.match(hit.say, /Billing/, `[${w}] it does not say where to fix it`);
  });
});

t("🔴 and it warns BEFORE the wall, because afterwards the ads are already off", () => {
  both((M, w) => {
    const near = M.accountTrouble({ accountStatus: 1, spendCap: 100, amountSpent: 92 });
    assert.ok(near && near.blocked === false, `[${w}] no warning until everything has already stopped`);
    assert.match(near.say, /close to its lifetime spending limit/i, `[${w}]`);
    const fine = M.accountTrouble({ accountStatus: 1, spendCap: 100, amountSpent: 40 });
    assert.equal(fine, null, `[${w}] a healthy account is being warned about, which trains him to ignore it`);
  });
});

t("no cap set is not a problem", () => {
  both((M, w) => {
    assert.equal(M.accountTrouble({ accountStatus: 1, spendCap: null, amountSpent: 500 }), null, `[${w}]`);
    assert.equal(M.accountTrouble({ accountStatus: 1, spendCap: 0, amountSpent: 500 }), null,
      `[${w}] a zero cap means no cap on Meta, and reading it as a reached limit would cry wolf on every account`);
  });
});

// ── 2. THE OTHER TWO KILLERS ─────────────────────────────────────────────────
t("🔴 a disabled, unsettled or reviewing account is named in plain words", () => {
  both((M, w) => {
    for (const [status, must] of [[2, /disabled/i], [3, /unpaid balance/i], [7, /reviewing/i], [9, /grace period/i], [101, /closed/i]]) {
      const r = M.accountTrouble({ accountStatus: status });
      assert.ok(r && r.blocked, `[${w}] account status ${status} is treated as healthy`);
      assert.match(r.say, must, `[${w}] status ${status} does not explain itself: ${r.say}`);
      assert.ok(!/account_status|disable_reason|status \d/.test(r.say), `[${w}] jargon reached him: ${r.say}`);
    }
  });
});

t("an active account with nothing wrong says nothing", () => {
  both((M, w) => {
    assert.equal(M.accountTrouble({ accountStatus: 1 }), null, `[${w}] a healthy account raises a warning`);
    assert.equal(M.accountTrouble({}), null, `[${w}] an account we never read is reported as broken`);
    assert.equal(M.accountTrouble(null), null, `[${w}]`);
  });
});

t("🔴 a status Meta invents later still gets flagged, not silently passed", () => {
  both((M, w) => {
    const r = M.accountTrouble({ accountStatus: 42 });
    assert.ok(r && r.blocked, `[${w}] an unknown account state is assumed healthy, which is the optimistic guess`);
    assert.match(r.say, /unusual state/i, `[${w}]`);
  });
});

t("nothing throws on rubbish", () => {
  both((M, w) => {
    for (const a of [undefined, {}, { accountStatus: "x" }, { spendCap: "abc", amountSpent: "def" }]) {
      assert.doesNotThrow(() => M.accountTrouble(a), `[${w}] threw on ${JSON.stringify(a)}`);
    }
  });
});

// ── 3. 🔴 MONEY ARRIVES IN CENTS ─────────────────────────────────────────────
t("🔴 Meta reports money in cents, and reading it as dollars is a hundredfold error", () => {
  // A $10 cap comes back as "1000". Getting this wrong would either never warn, or warn
  // about a limit a hundred times bigger than the real one.
  const a = LIB.trimAccount({ account_status: 1, spend_cap: "1000", amount_spent: "905", balance: "0", currency: "USD" });
  assert.equal(a.spendCap, 10, "the spending limit is being read as cents, so the warning never fires");
  assert.equal(a.amountSpent, 9.05, "the amount spent is a hundred times too big or too small");
  assert.equal(LIB.accountTrouble(a).reason, "spend cap close",
    "the exact numbers from his account do not produce a warning");
});

t("the stored account is trimmed to what a warning needs", () => {
  const a = LIB.trimAccount({ account_status: 1, spend_cap: "0", amount_spent: "0", funding_source: "123", junk: "x" });
  assert.equal(a.hasFunding, true, "a card on the account is not recorded");
  assert.ok(!("junk" in a), "the raw account object is being stored on a record read on every screen");
  assert.ok(a.at, "there is no record of when this was read");
  assert.equal(LIB.trimAccount({}).hasFunding, false, "a missing card reads as present, which is the wrong way round");
});

// ── 4. IT IS ACTUALLY READ, STORED AND SHOWN ─────────────────────────────────
t("🔴 the account is read alongside the campaigns", () => {
  assert.match(META, /export async function getAccountHealth\(adAccountId\)/, "there is no way to read the account");
  assert.match(META, /account_status,disable_reason,spend_cap,amount_spent,balance,currency,funding_source/,
    "the read does not ask for the fields the warning needs");
  assert.match(META, /if \(action === "accountHealth"\)/, "the read exists and nothing can call it");
  assert.match(SYNC, /meta\.account = await metaAccountHealth\(mid\);/, "the hourly job never looks at the account");
});

t("🔴 and losing it never costs us the numbers themselves", () => {
  // This is a diagnosis. A campaign read that succeeded must not be thrown away because the
  // account read failed.
  const i = SYNC.indexOf("meta.account = await metaAccountHealth");
  const block = SYNC.slice(i - 100, i + 220);
  assert.match(block, /try \{/, "an account read failure would take the whole Meta sync down with it");
  assert.match(block, /catch \(e\) \{ console\.warn/, "the failure is swallowed with no trace at all");
});

t("🔴 it reaches the screen, and reads as an answer rather than a status code", () => {
  assert.match(UI, /metaAccount: \(perf\.meta\|\|\{\}\)\.account \|\| null,/, "the card cannot see the account");
  assert.match(UI, /const tr = accountTrouble\(st\.metaAccount\); return tr/, "the account is stored and never checked");
  assert.match(S, /Your Facebook ad account has stopped spending\./,
    "a blocked account is not announced in words he can act on");
  assert.match(UI, /color:tr\.blocked\?C\.red:C\.amber/,
    "a warning and a stoppage look identical, and one of them is an emergency");
});

console.log(`✓ verify-meta-account-health: ${n} checks passed`);
