// The Today screen (top of the Dashboard) and the ARIA core.
//
// Bryson, 2026-10-07: open the OS and feel "like Jarvis". Stage 3 of the redesign. What has to stay true:
//  1. 🔴 It only READS. It shows the call log he already keeps; a home screen that wrote anything on load
//     would do it every single time the OS opens.
//  2. 🔴 Every day boundary is Phoenix's. The session clock is UTC and is already tomorrow every evening,
//     which would zero his "calls today" at 5pm (KB arizona-time).
//  3. The 3D never costs him the screen: it loads after the page is usable, from cdnjs, and is skipped on
//     Data Saver and low-memory devices; reduce motion gets one still frame; a failure shows a glow, not a hole.
//  4. The old emoji tiles are gone from the top of the screen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const slice = (a, b) => { const i = S.indexOf(a); const j = S.indexOf(b, i + a.length); return i < 0 ? "" : S.slice(i, j < 0 ? undefined : j); };

const TODAY = slice("// ─── TODAY (the Dashboard's top)", "\nfunction RevenueScreen(");
const CORE = slice("function AriaCore(", "\nfunction TodayHero(");
const HERO = slice("function TodayHero(", "\nfunction RevenueScreen(");
ok("the Today code was found", TODAY.length > 4000 && CORE.length > 2000 && HERO.length > 2000);

// 1. Reads only
const fetches = [...TODAY.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
ok("🔴 the only request is reading the call log", fetches.length === 1 && /action=touches&days=30/.test(fetches[0]) && !/method/.test(fetches[0]), fetches.join(" | "));
ok("🔴 nothing writes: no POST, no Supabase writes, no client updates", !/method:\s*"(POST|PUT|PATCH|DELETE)"|\.insert\(|\.update\(|\.upsert\(|\.delete\(|onUpdate|updateClient/.test(TODAY));
ok("it is on the dashboard, above everything else", (() => { const H = slice("function HomeScreen(", "\nfunction "); return H.indexOf("<TodayHero ") > 0 && H.indexOf("<TodayHero ") < H.indexOf("Guaranteed Monthly Floor"); })());

// 2. Phoenix days
ok("🔴 'today' and the week are Phoenix days", /const phxDayKey = \(d\) => new Date\(d\)\.toLocaleDateString\("en-CA", \{ timeZone: "America\/Phoenix" \}\)/.test(TODAY)
  && /phxDayKey\(t\.created_at\) === todayKey/.test(HERO) && !/getDate\(\)|toDateString\(\)/.test(HERO));
ok("the greeting follows the Phoenix hour", /timeZone: "America\/Phoenix", hour: "numeric", hour12: false/.test(TODAY));
ok("the goals match Power Hour's", /calls: 40/.test(TODAY) && /const PH_GOAL=40;/.test(S));

// 3. The 3D is optional
ok("three.js comes from cdnjs, pinned to r128, loaded on demand", /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js/.test(TODAY) && !/<script[^>]*three(\.min)?\.js/.test(S.slice(0, 4000)));
ok("it waits until the screen is usable", /requestIdleCallback\(start/.test(CORE));
ok("🔴 skipped on Data Saver and low-memory devices", /conn\.saveData \|\| \(navigator\.deviceMemory && navigator\.deviceMemory <= 2\)/.test(CORE));
ok("reduce motion gets one still frame", /prefers-reduced-motion: reduce/.test(CORE) && /if \(still\) \{ setArcs\(true\);[^}]*rd\.render\(scene, cam\); \}/.test(CORE));
ok("a failed load shows the glow instead of a hole", /\.catch\(\(\) => \{ if \(!dead\) setGl\("off"\); \}\)/.test(CORE) && /gl !== "on" && <div className="td-orb">/.test(CORE));
ok("it stops drawing when off screen and cleans up when he leaves", /IntersectionObserver/.test(CORE) && /rd\.dispose\(\)/.test(CORE) && /cancelAnimationFrame\(raf\)/.test(CORE));
ok("stage 4's voice has a hook to drive it", /window\.__ariaCore = \{ state: "idle", env: 0 \}/.test(TODAY));

// 4. No emoji tiles up top
const H = slice("function HomeScreen(", "\nfunction ");
ok("the emoji shortcut tiles are gone", !/entry\("📍"|entry\("☎️"|entry\("🎯"/.test(H) && !/🚀/.test(H));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-today: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
