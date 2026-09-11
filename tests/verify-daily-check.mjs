// The daily check that looks at the LIVE site, and whether it would have caught the outage.
// Run: node tests/verify-daily-check.mjs
//
// Bryson, 2026-09-10, after every button in the client portal was dead for a day:
// *"is there a way we can set up a daily check on everything ... that way something like
// this doesn't happen again"*.
//
// 🔴 THE POINT OF THIS JOB. Every suite in tests/ reads THIS REPO. The outage lived in the
// text Netlify actually served, and one suite was reading the raw source and passing on it.
// A green repo and a working site are different claims, and this project has shipped that
// gap twice: seven builds failing the secret scanner while git said merged, and this week.
//
// So the first thing asserted here is the only thing that really matters: given yesterday's
// broken page, does this check go red.

import { readFileSync } from "node:fs";
import { scriptsParse, previewScriptParses, summarize, hoursSince, STALE_HOURS, deployBehind } from "../netlify/functions/daily-check.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 WOULD IT HAVE CAUGHT 2026-09-10?
// ══════════════════════════════════════════════════════════════════════════════

// The exact shape that shipped: a template literal ate \/ , so the regex is malformed.
const BROKEN = `<html><body><div class="nb"></div><script>function blUrl(el){var t=(el.value||'').trim();el.value=t?(/^https?:///i.test(t)?t:'https://'+t):'';}function show(n,b){}</script></body></html>`;
const HEALTHY = `<html><body><div class="nb"></div><script>function blUrl(el){var t=(el.value||'').trim();el.value=t?(/^https?:\\/\\//i.test(t)?t:'https://'+t):'';}function show(n,b){}</script></body></html>`;

{
  const bad = scriptsParse(BROKEN);
  ok("🔴 yesterday's broken portal is caught", bad.bad.length === 1,
    "this is the whole reason the job exists: a page that loads fine with a dead script");
  ok("and it says what was wrong", /regular expression|Unexpected/i.test(bad.bad[0] || ""), bad.bad[0]);

  const good = scriptsParse(HEALTHY);
  eq("a healthy portal passes", good.bad, []);
  eq("and it says how much it looked at", good.checked, 1);
}

// The page LOADS in both cases, which is why "did it return 200" was never enough.
ok("the broken page is still perfectly valid HTML", BROKEN.includes("<div class=\"nb\">"),
  "a status check would call this page healthy, and every button on it is dead");

// ── What it must NOT trip on ─────────────────────────────────────────────────
eq("a page with no script at all is fine", scriptsParse("<html><body>hi</body></html>").bad, []);
eq("an empty script block is skipped", scriptsParse("<script>  </script>").checked, 0);
eq("a script loaded from a file is not parsed here", scriptsParse('<script src="/a.js"></script>').checked, 0,
  "there is no inline code to parse, and fetching every asset is a different job");
eq("a module is skipped", scriptsParse('<script type="module">import x from "y";</script>').checked, 0,
  "import is a syntax error inside new Function, so parsing modules this way is a false alarm");
eq("a babel block is skipped", scriptsParse('<script type="text/babel">const a = <b/>;</script>').checked, 0,
  "JSX is not plain script; the OS page is full of it");
eq("junk in does not throw", scriptsParse(null).bad, []);
{
  const two = scriptsParse("<script>var a=1;</script><script>var b=(;</script>");
  eq("every block is checked, not just the first", two.checked, 2);
  eq("and the broken one is reported", two.bad.length, 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. THE PREVIEW, WHICH IS A TEMPLATE LITERAL RATHER THAN A SCRIPT
// ══════════════════════════════════════════════════════════════════════════════
// Run against the REAL index.html, so this suite fails if the preview breaks again.
{
  const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const r = previewScriptParses(os);
  ok("the preview literal is found in the OS page", r.found);
  ok("🔴 and what it emits parses", r.ok, r.why);
  ok("and it defines the tab handler", r.defines === true, "show() is what every tab button calls");

  // Break it the way it was broken, and confirm the check goes red.
  const sabotaged = os.replace("/^https?:\\\\/\\\\//i", "/^https?:\\/\\//i");
  ok("the sabotage applied", sabotaged !== os);
  const bad = previewScriptParses(sabotaged);
  ok("🔴 re-breaking the preview is caught", bad.found && !bad.ok,
    "if this passes, the check cannot see the bug it was built for");

  eq("a page without the preview reports that, rather than passing", previewScriptParses("<html></html>").ok, false);
  eq("and says so plainly", /not in the served file/.test(previewScriptParses("<html></html>").why), true);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. STALENESS, WHICH IS HOW A STOPPED JOB HIDES
// ══════════════════════════════════════════════════════════════════════════════
{
  const hoursAgo = (h) => new Date(Date.now() - h * 3.6e6).toISOString();
  ok("a fresh reading is fresh", hoursSince(hoursAgo(1)) < STALE_HOURS.adPerf);
  ok("a day-old reading is stale", hoursSince(hoursAgo(24)) > STALE_HOURS.adPerf,
    "a stopped sync looks exactly like a quiet week");
  eq("a missing timestamp is unknown, not fresh", hoursSince(null), null,
    "treating never-read as up to date is how a job that never ran reads as healthy");
  eq("and junk is unknown too", hoursSince("not a date"), null);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3b. 🔴 IS THE SITE RUNNING THE CODE WE THINK IT IS?
// ══════════════════════════════════════════════════════════════════════════════
// In August seven builds in a row were rejected by Netlify's secret scanner while git
// reported every merge as fine, and the OS served day-old code for days. This job runs FROM
// the deploy, so it cannot see its own staleness by looking inward. Asking GitHub is the
// only way, and a difference alone is not a fault because a build takes minutes.
{
  const mins = (m) => new Date(Date.now() - m * 6e4).toISOString();
  const same = deployBehind({ deployed: "abc1234567", head: "abc1234567", headAt: mins(0) });
  ok("a matching commit is current", same.ok === true);
  ok("and it names what is live", /abc1234/.test(same.why), same.why);

  const building = deployBehind({ deployed: "old0000000", head: "new1111111", headAt: mins(4) });
  ok("🔴 a commit pushed minutes ago is NOT a failure", building.ok === true,
    "a build takes a few minutes; failing here would page him on every single push");
  ok("and it says why it is not worried", /still building/.test(building.why), building.why);

  const stuck = deployBehind({ deployed: "old0000000", head: "new1111111", headAt: mins(300) });
  ok("🔴 a head sitting there for hours IS a failure", stuck.ok === false,
    "this is the August incident: merged in git, never deployed");
  ok("it names both commits", /old0000/.test(stuck.why) && /new1111/.test(stuck.why), stuck.why);
  ok("it says how long", /5h ago/.test(stuck.why), stuck.why);
  ok("and it says what it means, not just what differs", /is NOT live/.test(stuck.why));
  ok("and where to look", /Netlify deploy log/.test(stuck.why));

  // The boundary, checked on both sides rather than assumed.
  ok("just inside the grace period is fine", deployBehind({ deployed: "a", head: "b", headAt: mins(24) }).ok === true);
  ok("just outside it is not", deployBehind({ deployed: "a", head: "b", headAt: mins(26) }).ok === false);

  // 🔴 UNKNOWN IS NOT OK. Without the token, or without a commit ref, this must skip rather
  // than quietly claim the deploy is fine.
  ok("no commit ref means unknown, not fine", deployBehind({ deployed: "", head: "b", headAt: mins(0) }).ok === null);
  ok("no branch head means unknown, not fine", deployBehind({ deployed: "a", head: null, headAt: mins(0) }).ok === null);
  ok("and an unreadable head is unknown too", deployBehind({ deployed: "a", head: undefined }).ok === null);
  ok("a difference with no push date is still a failure", deployBehind({ deployed: "a", head: "b" }).ok === false,
    "no date is not a reason to assume a build is in flight");
}

{
  const src = readFileSync(new URL("../netlify/functions/daily-check.mjs", import.meta.url), "utf8");
  ok("the check is wired to GitHub", /api\.github\.com\/repos\/BrysonWeiser\/boldline-os\/commits\/main/.test(src));
  ok("it reads the deployed commit from Netlify", /process\.env\.COMMIT_REF/.test(src));
  ok("🔴 with no token it SKIPS rather than failing",
    /add\("The deploy is current", null,[\s\S]{0,120}GITHUB_READ_TOKEN is not set in Netlify/.test(src),
    "a missing setting must not look like a broken deploy every morning, and null is the skip while false is a red alert");
  ok("and the skip says what to set", /GITHUB_READ_TOKEN/.test(src));
  ok("the token is never written into the repo", !/ghp_|github_pat_/.test(src),
    "credentials live in Netlify, never here");
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. WHAT IT SAYS, AND WHEN IT STAYS QUIET
// ══════════════════════════════════════════════════════════════════════════════
{
  const C = (name, ok) => ({ name, ok, detail: "" });
  const good = summarize([C("a", true), C("b", true)]);
  ok("all passing is ok", good.ok === true);
  ok("and says so", /all 2 checks passed/.test(good.line), good.line);

  const bad = summarize([C("a", true), C("b", false), C("c", false)]);
  ok("any failure is not ok", bad.ok === false);
  ok("and it counts them", /2 of 3 checks failed/.test(bad.line), bad.line);
  eq("the failures are carried, so the alert can name them", bad.failed.map((c) => c.name), ["b", "c"]);

  // 🔴 A SKIPPED CHECK IS NOT A PASS AND NOT A FAILURE. Before the first client had a portal
  // there was nothing to fetch; calling that green would have been a lie, and calling it red
  // would have cried wolf every morning.
  const skip = summarize([C("a", true), C("b", null)]);
  ok("a skipped check does not fail the run", skip.ok === true);
  eq("but it is counted separately from a pass", skip.passed, 1);
  ok("and the line says some were skipped", /1 skipped/.test(skip.line), skip.line);
  eq("nothing at all is vacuously ok", summarize([]).ok, true);
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. THE JOB ITSELF
// ══════════════════════════════════════════════════════════════════════════════
{
  const src = readFileSync(new URL("../netlify/functions/daily-check.mjs", import.meta.url), "utf8");

  // 🔴 IT RUNS AGAINST PRODUCTION WITH A REAL CLIENT'S TOKEN.
  ok("every request it makes is a GET", !/method:\s*["'](POST|PUT|PATCH|DELETE)/i.test(src),
    "a health check that can write to a client is not a health check");
  ok("it never sends to a client", !/autoSendClientEmail|sendEmail\(/.test(src),
    "the only messages it sends are to Bryson");

  ok("a failure alerts immediately and in red", /severity: "red"/.test(src));
  // A checker that only speaks when things break cannot be told from one that has died.
  ok("🔴 and it reports in when nothing is wrong", /getUTCDay\(\) === 1/.test(src),
    "silence has to mean something, so Monday gets an all-clear either way");
  ok("the all-clear explains why it exists", /silence the rest of the week means the check is running/.test(src));
  ok("its own bookkeeping failing does not fail the check", /could not store its result/.test(src));

  const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
  ok("it is actually scheduled", /\[functions\."daily-check"\]\s*\n\s*schedule\s*=\s*"40 13 \* \* \*"/.test(toml),
    "an unscheduled watcher is a file nobody runs");
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. THE OTHER HALF: THE SUITE RUNS BY ITSELF NOW
// ══════════════════════════════════════════════════════════════════════════════
{
  const ci = readFileSync(new URL("../.github/workflows/tests.yml", import.meta.url), "utf8");
  ok("there is CI at all", ci.includes("node tests/run-all.mjs"),
    "86 suites that only run when somebody remembers are not a safety net");
  ok("it runs on every push", /push:/.test(ci));
  ok("and again every morning", /schedule:/.test(ci) && /cron: "10 13 \* \* \*"/.test(ci));
  ok("the runner exits non-zero on failure", readFileSync(new URL("../tests/run-all.mjs", import.meta.url), "utf8").includes("process.exit(1)"),
    "CI that cannot fail is a green tick that means nothing");
  ok("and a hung suite is a failure, not an hour of waiting", /timed out after 180s/.test(readFileSync(new URL("../tests/run-all.mjs", import.meta.url), "utf8")));
}

console.log(`verify-daily-check: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
