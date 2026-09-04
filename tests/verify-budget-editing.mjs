// Changing what one campaign spends a day, from the screens he actually uses.
//
// Bryson, 2026-09-04: *"make sure there is a way for me to update the daily budget for my
// individual ads"*.
//
// 🔴 THERE ALREADY WAS ONE, IN A PLACE HE NEVER OPENS. The write has existed on both
// platforms since the approval queue was built, and a hand editor was added to
// `LiveCampaignsCard` the day before. That card sits on a client's Package tab. The two
// screens he uses — My Ads, and Campaigns from the phone menu — both PRINTED the daily budget
// as plain text with nothing to press. So "there is no way to do this" and "the code to do
// this exists" were both true, which is why a suite that only asked whether the write existed
// would have passed while the feature was, to him, missing.
//
// 🔴 SO THIS SUITE RUNS THE COMPONENT. It compiles `DailyBudgetEditor` out of index.html,
// renders it with a hook harness, presses its buttons and inspects the calls that reach the
// ad platforms. Checking that `setBudget` appears in the file proves nothing about whether a
// press reaches it, whether it reaches it with the RIGHT id, or whether a typo is caught on
// the way. Every one of those is money.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const META = readFileSync(join(ROOT, "netlify/functions/meta-ads.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S);
let n = 0;
const t = (name, fn) => { const r = fn(); n++; return r; };
const ta = async (name, fn) => { await fn(); n++; };

// ─── Lift the component out of the page and make it runnable ─────────────────
const start = S.indexOf("function DailyBudgetEditor({");
assert.ok(start > 0, "DailyBudgetEditor is gone, so this suite is checking nothing");
const end = S.indexOf("// The Live Ad Performance card", start);
assert.ok(end > start, "the component's end anchor moved");
const SRC = S.slice(start, end);

const { transform } = await import("@babel/standalone");
const compiled = transform(SRC, { presets: ["react"] }).code;

// A minimal React that records a tree instead of drawing one.
const React = {
  createElement: (type, props, ...kids) => ({
    type, props: props || {},
    children: kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true),
  }),
};
const walk = (node, out = []) => {
  if (!node || typeof node !== "object") return out;
  out.push(node);
  (node.children || []).forEach((k) => walk(k, out));
  return out;
};
const textOf = (node) => (node.children || [])
  .map((k) => (typeof k === "object" ? textOf(k) : String(k))).join("");
const allText = (tree) => walk(tree).map((x) => (x.children || [])
  .filter((k) => typeof k !== "object").join("")).join(" ");

// The hook harness. `useState` keeps values in an array across renders; pressing a button
// mutates them and the driver re-renders, which is exactly the loop React runs.
function mount(Component, props, globals) {
  const cells = [];
  let i = 0;
  const useState = (init) => {
    const k = i++;
    if (cells.length <= k) cells[k] = typeof init === "function" ? init() : init;
    return [cells[k], (v) => { cells[k] = typeof v === "function" ? v(cells[k]) : v; }];
  };
  const scope = { React, useState, ...globals };
  const factory = new Function(...Object.keys(scope), `${compiled}\nreturn DailyBudgetEditor;`);
  const Fn = factory(...Object.values(scope));
  let tree = null;
  const render = () => { i = 0; tree = Fn(props); return tree; };
  render();
  const press = async (label) => {
    const hit = walk(tree).find((x) => x.type === "button" && textOf(x).includes(label));
    assert.ok(hit, `no button reading "${label}". On screen: ${allText(tree).slice(0, 300)}`);
    await hit.props.onClick();
    return render();
  };
  const type = async (value) => {
    const box = walk(tree).find((x) => x.type === "input");
    assert.ok(box, "there is no box to type a budget into");
    box.props.onChange({ target: { value: String(value) } });
    return render();
  };
  return { render, press, type, get tree() { return tree; }, text: () => allText(tree) };
}

// The fakes every case builds on. `calls` is the record of what reached the ad platforms.
function harness({ confirm = () => true, meta = async () => ({}), gads = async () => ({}) } = {}) {
  const calls = [];
  return {
    calls,
    globals: {
      C: new Proxy({}, { get: () => "#000" }),
      window: { confirm: (msg) => { calls.push({ fn: "confirm", msg }); return confirm(msg); } },
      metaCall: async (p) => { calls.push({ fn: "metaCall", ...p }); return meta(p); },
      gadsCall: async (p) => { calls.push({ fn: "gadsCall", ...p }); return gads(p); },
    },
  };
}
const GOOGLE_CLIENT = { id: "1", name: "Shaun's Roofing", googleAdsCustomerId: "1234567890" };
const HOUSE = { id: "0", name: "BoldLine", internal: true, metaAdAccountId: "999", googleAdsCustomerId: "1234567890" };
const writes = (calls) => calls.filter((c) => /^set(Budget|AdSetBudget)$/.test(c.action || ""));

// ── 1. THE ORDINARY CASE, ON BOTH PLATFORMS ──────────────────────────────────
await ta("a Google campaign's budget is changed on the campaign's own budget", async () => {
  const h = harness();
  const v = mount(null, { client: GOOGLE_CLIENT, platform: "google",
    campaign: { id: "77", name: "Roof leads", dailyBudget: 20, budgetResourceName: "customers/1/campaignBudgets/5" },
  }, h.globals);
  await v.press("Change budget");
  await v.type("30");
  await v.press("Save");
  const w = writes(h.calls);
  assert.equal(w.length, 1, "the press did not reach Google");
  assert.equal(w[0].fn, "gadsCall");
  assert.equal(w[0].dollars, 30);
  assert.equal(w[0].budgetResourceName, "customers/1/campaignBudgets/5");
  assert.match(v.text(), /Saved\./, "it saved and said nothing, so he presses again");
});

await ta("a Meta campaign that carries its own budget is changed on the campaign", async () => {
  const h = harness();
  const v = mount(null, { client: HOUSE, platform: "meta",
    campaign: { id: "120", name: "Lead ad", dailyBudget: 10 } }, h.globals);
  await v.press("Change budget");
  await v.type("15");
  await v.press("Save");
  const w = writes(h.calls);
  assert.equal(w.length, 1);
  assert.equal(w[0].action, "setBudget");
  assert.equal(w[0].campaignId, "120");
  assert.equal(w[0].dailyBudgetDollars, 15);
});

await ta("the new number is handed back so the screen can show it at once", async () => {
  const h = harness();
  const seen = [];
  const v = mount(null, { client: HOUSE, platform: "meta", campaign: { id: "120", dailyBudget: 10 },
    onSaved: (d) => seen.push(d) }, h.globals);
  await v.press("Change budget");
  await v.type("14");
  await v.press("Save");
  assert.deepEqual(seen, [14], "nothing is told the budget changed, so the old number stays on screen");
});

// ── 2. 🔴 META KEEPS THE BUDGET IN ONE OF TWO PLACES ─────────────────────────
// A campaign built by hand in Ads Manager puts the budget on the AD SET, and the campaign
// then truthfully reports none. Writing to the campaign there is not where the money is.
await ta("🔴 a Meta campaign with no budget of its own is edited on its ad set", async () => {
  const h = harness({ meta: async (p) => p.action === "campaignDetail"
    ? { campaign: { id: "300" }, adGroups: [{ id: "aset-1", name: "Roofers 25 to 65", dailyBudget: 25 }] }
    : {} });
  const v = mount(null, { client: HOUSE, platform: "meta",
    campaign: { id: "300", name: "Made in Ads Manager", dailyBudget: 0 } }, h.globals);
  await v.press("Set a daily budget");
  assert.ok(h.calls.some((c) => c.action === "campaignDetail"), "it never looked inside the campaign");
  assert.match(v.text(), /Roofers 25 to 65/, "it does not say which ad set the budget belongs to");
  await v.type("40");
  await v.press("Save");
  const w = writes(h.calls);
  assert.equal(w.length, 1);
  assert.equal(w[0].action, "setAdSetBudget", "it wrote to the campaign, which is not where the budget is");
  assert.equal(w[0].adSetId, "aset-1", "🔴 it sent the CAMPAIGN id as the ad set id");
  assert.equal(w[0].dailyBudgetDollars, 40);
});

await ta("a campaign on a total budget says so rather than offering a dead box", async () => {
  const h = harness({ meta: async (p) => p.action === "campaignDetail"
    ? { campaign: { id: "301", lifetimeBudget: 500 }, adGroups: [{ id: "a", name: "Set", lifetimeBudget: 500 }] }
    : {} });
  const v = mount(null, { client: HOUSE, platform: "meta", campaign: { id: "301", dailyBudget: 0 } }, h.globals);
  await v.press("Set a daily budget");
  assert.match(v.text(), /total budget/i, "a lifetime-budget campaign reads as broken");
  assert.equal(walk(v.tree).filter((x) => x.type === "input").length, 0,
    "it offers a box that cannot save, which is worse than offering nothing");
  assert.equal(writes(h.calls).length, 0);
});

// ── 3. 🔴 THE TYPO GUARD, WHICH IS THE ONLY THING BETWEEN HIM AND A MONTH OF SPEND ──
await ta("🔴 a big jump asks first, and declining writes nothing", async () => {
  const h = harness({ confirm: () => false });
  const v = mount(null, { client: GOOGLE_CLIENT, platform: "google",
    campaign: { id: "77", dailyBudget: 70, budgetResourceName: "b" } }, h.globals);
  await v.press("Change budget");
  await v.type("700");     // the classic: one extra nought
  await v.press("Save");
  const asked = h.calls.find((c) => c.fn === "confirm");
  assert.ok(asked, "$70 a day became $700 a day with no question asked");
  assert.match(asked.msg, /10 times higher/, "the question does not say how much bigger it is");
  assert.match(asked.msg, /\$21,000 a month/, "it does not say what that costs over a month");
  assert.equal(writes(h.calls).length, 0, "🔴 saying no still changed the budget");
});

await ta("and accepting it goes through", async () => {
  const h = harness({ confirm: () => true });
  const v = mount(null, { client: GOOGLE_CLIENT, platform: "google",
    campaign: { id: "77", dailyBudget: 70, budgetResourceName: "b" } }, h.globals);
  await v.press("Change budget"); await v.type("700"); await v.press("Save");
  assert.equal(writes(h.calls).length, 1, "a deliberate increase is blocked");
});

await ta("🔴 a big number where we knew of no budget asks too", async () => {
  // A multiplier rule cannot fire against zero, so the exact case where the OS has nothing to
  // compare against is the case that would sail through unquestioned.
  const h = harness({ confirm: () => false });
  const v = mount(null, { client: HOUSE, platform: "meta", campaign: { id: "9", dailyBudget: 10 } }, h.globals);
  await v.press("Change budget"); await v.type("11"); await v.press("Save");
  assert.equal(h.calls.filter((c) => c.fn === "confirm").length, 0, "a small change nags him");

  const h2 = harness({ confirm: () => false });
  const v2 = mount(null, { client: GOOGLE_CLIENT, platform: "google",
    campaign: { id: "9", dailyBudget: 0, budgetResourceName: "b" } }, h2.globals);
  await v2.press("Set a daily budget"); await v2.type("500"); await v2.press("Save");
  assert.ok(h2.calls.some((c) => c.fn === "confirm"), "🔴 $500 a day set from nothing, unquestioned");
  assert.equal(writes(h2.calls).length, 0);
});

await ta("nothing, zero and rubbish are refused before anything is called", async () => {
  for (const bad of ["", "0", "abc"]) {
    const h = harness();
    const v = mount(null, { client: HOUSE, platform: "meta", campaign: { id: "9", dailyBudget: 10 } }, h.globals);
    await v.press("Change budget"); await v.type(bad); await v.press("Save");
    assert.equal(writes(h.calls).length, 0, `"${bad}" was sent to Meta as a budget`);
    assert.match(v.text(), /above zero/, `"${bad}" was refused silently`);
  }
});

await ta("an absurd number is refused rather than sent", async () => {
  const h = harness();
  const v = mount(null, { client: HOUSE, platform: "meta", campaign: { id: "9", dailyBudget: 10 } }, h.globals);
  await v.press("Change budget"); await v.type("250000"); await v.press("Save");
  assert.equal(writes(h.calls).length, 0, "a quarter of a million a day went through");
});

// ── 4. THE WRITE NEEDS AN ID THE STORED SNAPSHOT DOES NOT CARRY ──────────────
await ta("🔴 a Google campaign with no budget id looks it up rather than failing", async () => {
  // The My Ads rows come from the hourly snapshot, which stores no budget resource name. If
  // the editor needed one it would work on the Campaigns screen and fail on My Ads, which is
  // the screen he asked about.
  const h = harness({ gads: async (p) => p.action === "campaigns"
    ? { campaigns: [{ id: "77", name: "Roof leads", budgetResourceName: "customers/1/campaignBudgets/5" }] } : {} });
  const v = mount(null, { client: GOOGLE_CLIENT, platform: "google",
    campaign: { id: "77", name: "Roof leads", dailyBudget: 20 } }, h.globals);
  await v.press("Change budget"); await v.type("25"); await v.press("Save");
  const w = writes(h.calls);
  assert.equal(w.length, 1, "a campaign from the snapshot cannot be edited");
  assert.equal(w[0].budgetResourceName, "customers/1/campaignBudgets/5");
});

await ta("🔴 a campaign that is gone says so and writes nothing", async () => {
  const h = harness({ gads: async (p) => p.action === "campaigns" ? { campaigns: [] } : {} });
  const v = mount(null, { client: GOOGLE_CLIENT, platform: "google",
    campaign: { id: "77", name: "Deleted one", dailyBudget: 20 } }, h.globals);
  await v.press("Change budget"); await v.type("25"); await v.press("Save");
  assert.equal(writes(h.calls).length, 0);
  assert.match(v.text(), /not in the Google account any more/, "it fails with something he cannot act on");
});

await ta("a platform refusal is shown, and is never reported as saved", async () => {
  const h = harness({ meta: async () => { throw new Error("setBudget — daily budget below the minimum"); } });
  const v = mount(null, { client: HOUSE, platform: "meta", campaign: { id: "9", dailyBudget: 10 } }, h.globals);
  await v.press("Change budget"); await v.type("1"); await v.press("Save");
  assert.match(v.text(), /below the minimum/, "Meta's reason is swallowed");
  assert.ok(!/Saved\./.test(v.text()), "🔴 it said saved when the platform refused");
});

// ── 5. IT IS ON THE SCREENS HE ACTUALLY OPENS ────────────────────────────────
// 🔴 The whole reason this was reported missing. A control the code contains and no screen
// renders is a control that does not exist.
t("🔴 it is on the campaign he taps in My Ads", () => {
  assert.match(UI, /\{sel&&<DailyBudgetEditor client=\{client\} platform=\{sel\.platform\} campaign=\{sel\}/,
    "tapping a campaign in My Ads still gives him numbers he cannot change");
  // Gated on ONE campaign being chosen: the card's totals are several campaigns added
  // together and there is no single budget for those.
  assert.ok(!/\{true&&<DailyBudgetEditor/.test(UI) && !/\{false&&<DailyBudgetEditor/.test(UI),
    "the editor's render gate is pinned open or wired shut");
});

t("🔴 and on every row of the Campaigns screen, which is the phone's whole campaign menu", () => {
  assert.match(UI, /<DailyBudgetEditor client=\{r\.client\} platform=\{r\.platform\} campaign=\{r\.c\} onSaved=\{\(\)=>load\(\)\}\/>/,
    "the Campaigns screen still only prints the budget");
});

t("the My Ads rows show the changed number without waiting for the hourly check", () => {
  assert.match(UI, /const camps = st\.campaigns\.map\(c=>\{ const k=`\$\{c\.platform\}-\$\{c\.id\}`;/,
    "there is no place for a just-changed budget to show");
  assert.match(UI, /setBudgets\(b=>\(\{\.\.\.b,\[`\$\{sel\.platform\}-\$\{sel\.id\}`\]:d\}\)\)/,
    "a saved budget is never recorded, so the row keeps the old number for an hour");
  // 🔴 Both the focused campaign AND the list read the overridden copy. Fixing one leaves the
  // number disagreeing with itself on the same screen.
  assert.match(UI, /const sel = camps\.find\(/, "the focused campaign reads the stale list");
  assert.match(UI, /\{camps\.map\(c=>\{/, "the campaign rows read the stale list");
});

// ── 6. THE SERVER SIDE OF THE AD-SET WRITE ───────────────────────────────────
t("🔴 the ad-set budget write exists, is routed, and checks its inputs", () => {
  assert.match(META, /export async function setAdSetBudget\(adSetId, dollars\)/, "there is no ad-set budget write");
  assert.match(META, /params: \{ daily_budget: String\(dollarsToCents\(dollars\)\) \}/, "the budget is not sent in cents");
  assert.match(META, /if \(action === "setAdSetBudget"\)/, "the write exists and nothing can call it");
  assert.match(META, /if \(!body\.adSetId \|\| body\.dailyBudgetDollars == null\)/,
    "a missing id or amount reaches Meta instead of being refused here");
});

t("it is written down where the next person will look", () => {
  assert.match(META, /"setAdSetBudget" -> \{ adSetId, dailyBudgetDollars \}/,
    "the action list at the top of the file does not mention it");
});

console.log(`✓ verify-budget-editing: ${n} checks passed`);
