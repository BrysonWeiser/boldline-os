// Stage 5 of the OS redesign (Bryson, 2026-10-07: "let's finish the os screens").
// What has to stay true:
//  1. Every screen opens on the ONE shared header (ScreenHeader), not a hand-built title that drifts.
//  2. The form screens use the full width on a computer (form left, results right), never a thin strip.
//  3. Empty screens use the line-icon EmptyState, not emoji.
//  4. A malformed answer from an outside service shows a message on its card, never the "Something broke"
//     screen (the analytics card used to take the whole OS down), and missing numbers never print "undefined".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const body = (name) => { const a = S.indexOf(`function ${name}(`); if (a < 0) return ""; const b = S.indexOf("\nfunction ", a + 10); return S.slice(a, b < 0 ? undefined : b); };

ok("the shared header exists", /function ScreenHeader\(\{ group, title, sub, stats, actions, icon, onBack, isDesktop \}\)/.test(S));
ok("and its styles", /\.sh\{position:relative;overflow:hidden;border-radius:18px/.test(S) && /\.sh-title\{font-family:var\(--hud\)/.test(S));
ok("the turning ring stops for reduce motion", /@media \(prefers-reduced-motion:reduce\)\{\.sh,\.sh-ring i,\.sh-eye i\{animation:none!important\}\}/.test(S));
ok("the ring is computers only", /\{isDesktop && svg && <div className="sh-ring" aria-hidden="true">/.test(S));

// 1. Every screen
for (const [fn, title] of [["LeadsScreen", "Leads"], ["DealPrepScreen", "Deal Prep"], ["LeadScoutScreen", "Lead Scout"], ["CalendarScreen", "Calendar"],
  ["CampaignManagerScreen", "Campaigns"], ["WebsiteScreen", "Website"], ["ContentStudioScreen", "Content Studio"], ["RevenueScreen", "Revenue"]]) {
  const b = body(fn);
  ok(`🔴 ${title} opens on the shared header`, new RegExp(`<ScreenHeader [^>]*title="${title}"`).test(b), fn);
  ok(`${title} no longer hand-builds its title`, !new RegExp(`className="os-title"[^>]*>${title}</div>`).test(b));
}
ok("the client lists (alerts, expiring, all) use it too", /<ScreenHeader group="Clients" title=\{meta\.title\}/.test(body("SegmentScreen")));
ok("the client page's pinned bar has the new look and keeps its tabs pinned", /<div className="ch-bar" style=\{\{borderBottom:/.test(body("ClientHub")) && /\.ch-bar\{position:relative;background:/.test(S));

// 2. Full width on a computer
ok("the side-by-side layout exists and is wide screens only", /@media \(min-width:1180px\)\{\.os-split\{display:grid;grid-template-columns:minmax\(380px,460px\) minmax\(0,1fr\)/.test(S));
for (const fn of ["DealPrepScreen", "LeadScoutScreen", "ContentStudioScreen"]) {
  ok(`🔴 ${fn} puts the form beside its results on a computer`, /className=\{?[^>]*os-split/.test(body(fn)) && /className="os-split-l"/.test(body(fn)));
}
ok("Deal Prep's form is no longer capped at 640px", !/\{\.\.\.card,maxWidth:640/.test(body("DealPrepScreen")));

// 3. Empty states
ok("the shared empty state exists", /function EmptyState\(\{ icon, text, action \}\)/.test(S));
ok("Leads uses it, not a mailbox emoji", /<EmptyState icon="leads"/.test(body("LeadsScreen")) && !/📭/.test(body("LeadsScreen")));
ok("the client lists use it", /<EmptyState icon="segment" text=\{EMPTY\.msg\}\/>/.test(body("SegmentScreen")));
ok("the client search has no magnifier emoji", !/🔍<\/div>/.test(S));

// 4. One bad answer never breaks the OS
ok("🔴 analytics without numbers shows a message instead of crashing the OS", /if\(!d\.totals\|\|typeof d\.totals!=="object"\)\{ setState\("error"\)/.test(body("GA4AnalyticsCard")));
ok("newsletter numbers never print undefined", /subs\.thisMonthAdded==null\?"—":"\+"\+subs\.thisMonthAdded/.test(S));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-os-screens: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
