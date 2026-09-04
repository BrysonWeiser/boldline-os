// Everything reachable on a computer must be reachable on a phone.
//
// Bryson, 2026-09-04: *"In the os on mobile there isn't a my ads tab just campaigns and the
// other tabs"*.
//
// 🔴 A BUG OF OMISSION, AND THE COMMENT ABOVE THE CODE WAS PART OF WHY IT SURVIVED.
//
// `openMyAds` existed. It was wired to the desktop sidebar and to a card on the dashboard.
// The mobile sheet was simply never handed it, so on a phone the account he checks most
// often had no entry in the navigation at all: reachable only by scrolling the dashboard and
// spotting a card. Nothing errored, nothing looked wrong, and a comment above `SideNav`
// asserted "same destinations as BottomNav" while the two had quietly drifted apart.
//
// 🔴 A COMMENT CANNOT FAIL. This suite can. He works from his phone most of the day, so the
// phone is the surface that matters, and it is the one nobody is looking at while building on
// a laptop.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

const block = (start, end) => {
  const i = S.indexOf(start);
  assert.ok(i > 0, `${start} is gone, so this suite is checking nothing`);
  const j = S.indexOf(end, i);
  return S.slice(i, j > 0 ? j : i + 6000);
};
const SIDE = block("function SideNav({", "\n// ─── ");
const SHEET = block("function MoreSheet({", "\n// ─── ");
const BAR = block("function BottomNav({", "\nfunction ");

// 🔴 The mobile equivalent of the sidebar is the bar PLUS the sheet, never the bar alone.
// Treating the bar as the whole story is precisely the mistake the old comment encoded.
const MOBILE = BAR + SHEET;

// Every destination the sidebar offers, by the handler it calls. Handlers rather than labels,
// because a label can be reworded on one surface and not the other and this should not care.
const DESTINATIONS = [
  ["onHome", "Dashboard"],
  ["onRevenue", "Revenue"],
  ["onLeads", "Leads"],
  ["onWebsite", "Website"],
  ["onMyAds", "My Ads"],
  ["onCampaigns", "Campaigns"],
  ["onContent", "Content Studio"],
  ["onLeadScout", "Lead Scout"],
  ["onDealPrep", "Deal Prep"],
  ["onCalendar", "Calendar"],
  ["onNotif", "Alerts"],
  ["onARIA", "ARIA"],
];

t("🔴 the sidebar really does offer all of these, or the list below is a fiction", () => {
  for (const [h, label] of DESTINATIONS) {
    assert.ok(SIDE.includes(`onClick={${h}}`),
      `the sidebar no longer has ${label}, so this suite would demand it on mobile for no reason`);
  }
});

t("🔴 AND EVERY ONE IS REACHABLE ON A PHONE", () => {
  const missing = DESTINATIONS.filter(([h]) => !MOBILE.includes(`onClick={${h}}`) && !MOBILE.includes(`,${h})}`));
  assert.deepEqual(missing.map(([, l]) => l), [],
    "these are reachable on a computer and NOT on a phone, which is the surface he actually "
    + "works from. Add them to the More sheet.");
});

t("🔴 My Ads specifically, since that is the one that went missing", () => {
  assert.match(SHEET, /"My Ads"/, "the sheet has no My Ads row");
  assert.match(SHEET, /onMyAds/, "the row exists but calls nothing");
  assert.match(S, /onMyAds=\{\(\)=>\{openMyAds\(\);setShowMore\(false\);\}\}/,
    "the sheet is handed a My Ads action that either does not open it or does not close the sheet");
});

t("it sits at the top of the sheet, where the most used thing belongs", () => {
  assert.ok(SHEET.indexOf('"My Ads"') < SHEET.indexOf('"Campaigns"'),
    "his own ad account is below everything else in a scrolling sheet on a phone");
});

t("🔴 every row in the sheet actually goes somewhere", () => {
  // A row wired to nothing looks identical to one that works until it is pressed.
  const rows = [...SHEET.matchAll(/\{row\(sv\([\s\S]*?\),"([^"]+)","[^"]*",(\w+)\)\}/g)];
  assert.ok(rows.length >= 7, `only ${rows.length} rows parsed, so this check is not seeing the sheet`);
  for (const [, label, handler] of rows) {
    assert.ok(new RegExp(`${handler}[,\\s}]`).test(SHEET.slice(0, SHEET.indexOf("return ("))),
      `the "${label}" row calls ${handler}, which the sheet is never given`);
  }
});

t("the sheet closes itself on every destination", () => {
  // A sheet left open over the screen it just navigated to is a screen he cannot use.
  const i = S.indexOf("{showMore&&<MoreSheet");
  const wiring = S.slice(i, S.indexOf("/>}", i));
  const handlers = [...wiring.matchAll(/on(\w+)=\{\(\)=>\{/g)].map((m) => m[0]);
  assert.ok(handlers.length >= 6, "the sheet's wiring changed shape and this is no longer reading it");
  for (const h of handlers) {
    const seg = wiring.slice(wiring.indexOf(h), wiring.indexOf("}}", wiring.indexOf(h)));
    assert.ok(seg.includes("setShowMore(false)"), `${h} navigates without closing the sheet`);
  }
});

console.log(`✓ verify-nav-parity: ${n} checks passed`);
