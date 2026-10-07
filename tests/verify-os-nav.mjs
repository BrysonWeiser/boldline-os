// The OS menu and quick search (Ctrl K).
//
// Bryson, 2026-10-07: the OS "is crowded and hard to navigate". Stage 2 of the redesign groups the menu by
// the job he is doing and adds one search box that jumps anywhere. What has to stay true:
//  1. The groups exist, in the order he works: Command, Get clients, Run clients, Money; Outreach (his most
//     used screen) heads Get clients.
//  2. Quick search opens from the keyboard anywhere, from the sidebar, and from the phone menu.
//  3. 🔴 Quick search only NAVIGATES. Every result runs a function that changes screen or opens a panel he
//     would open by hand. A search result that wrote, sent or deleted something on Enter would be one stray
//     keypress from a real mistake.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const between = (a, b) => { const i = S.indexOf(a); const j = S.indexOf(b, i + a.length); return i < 0 ? "" : S.slice(i, j < 0 ? i + 20000 : j); };

// 1. Groups
const SIDE = between("function SideNav({", "\nfunction PhxClock(");
ok("the sidebar was found", SIDE.length > 1000);
const order = ["Command", "Get clients", "Run clients", "Money"].map((g) => SIDE.indexOf(`{grp("${g}")}`));
ok("the sidebar has all four groups, in working order", order.every((x) => x > 0) && order.every((x, k) => k === 0 || x > order[k - 1]), order.join(","));
const gc = SIDE.slice(SIDE.indexOf('{grp("Get clients")}'), SIDE.indexOf('{grp("Run clients")}'));
ok("Outreach heads Get clients", gc.indexOf("onClick={onOutreach}") > 0 && gc.indexOf("onClick={onOutreach}") < gc.indexOf("onClick={onLeadScout}"));
const SHEET = between("function MoreSheet({", "\n// ─── LOGIN SCREEN");
const so = ["Get clients", "Run clients", "Money"].map((g) => SHEET.indexOf(`{grp("${g}")}`));
ok("the phone menu uses the same groups", so.every((x) => x > 0) && so[0] < so[1] && so[1] < so[2]);
ok("the clock in the sidebar is Phoenix time", /function PhxClock\(\)[\s\S]{0,600}timeZone:"America\/Phoenix"/.test(S));

// 2. Ways in
ok("Ctrl K (or Cmd K) toggles quick search from anywhere", /\(e\.ctrlKey\|\|e\.metaKey\)&&!e\.altKey&&\(e\.key==="k"\|\|e\.key==="K"\)\)\{ e\.preventDefault\(\); setShowCmd\(v=>!v\)/.test(S));
ok("the sidebar has a Search button", /onSearch=\{\(\)=>setShowCmd\(true\)\}/.test(S) && SIDE.includes("onClick={onSearch}"));
ok("the phone menu has one, and it closes the menu first", /onSearch=\{\(\)=>\{setShowMore\(false\);setShowCmd\(true\);\}\}/.test(S) && SHEET.includes("onClick={onSearch}"));

// 3. Navigation only
const PAL = between("{showCmd&&<CommandPalette", "]}/>}");
ok("the palette's items were found", PAL.length > 500);
const runs = [...PAL.matchAll(/run:\(\)=>([^}]*?)\}/g)].map((m) => m[1].trim());
ok("every result has an action", runs.length >= 14, String(runs.length));
const SAFE = /^(setScreen\("[a-z]+"\)|openDealPrep\(null\)|openMyAds\(\)|selectClient\(cl\)|setShowAdd\(true\)|setShowARIA\(true\)|setShowNotif\(true\))$/;
const unsafe = runs.filter((r) => !SAFE.test(r));
ok("🔴 every result only changes screen or opens a panel", unsafe.length === 0, unsafe.join(" | "));
const COMP = between("function CommandPalette(", "\nfunction App(");
ok("🔴 the palette itself calls no endpoint and writes nothing", COMP.length > 500 && !/fetch\(|api\(|supabase|update[A-Z]\w*\(|delete\w*\(|localStorage/.test(COMP));
ok("Escape closes it and Enter runs the highlighted result", /e\.key==="Escape"\)\{ e\.preventDefault\(\); onClose\(\)/.test(COMP) && /e\.key==="Enter"\)\{ e\.preventDefault\(\); run\(shown\[a\]\)/.test(COMP));

// The Mission Control faces load in the background, never holding the OS on a blank screen.
ok("the display fonts load without blocking the first paint", /family=Chakra\+Petch[^"]*" media="print" onload="this\.media='all'"/.test(S));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-os-nav: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
