// The nightly backup: does it copy everything, prove the copy is readable, and keep exactly five.
// Run: node tests/verify-backup.mjs
//
// Bryson, 2026-09-11: *"I want to start keeping a backup data base of everything we have ...
// keep the last 5 ... I also get an email each morning ... run this everyday at 1am."*
//
// 🔴 THE THREE WAYS A BACKUP JOB LIES, AND WHAT IS ASSERTED ABOUT EACH.
//   1. It quietly stops copying a table. Guarded by reading every table name the codebase
//      touches and failing if one is missing from the list.
//   2. It writes a file nobody ever reads back, for months, until the day it is needed.
//      Guarded by requiring the function to download and unpack its own file before it
//      trusts it, and to delete nothing until that passes.
//   3. It deletes the good copies while broken. Guarded by the prune sitting behind the
//      verification, and by a keep limit that can never resolve to zero.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BACKUP_TABLES, BACKUP_BUCKET, KEEP, backupName, isBackupName, toPrune,
  countWarnings, summarizeBackup, packSnapshot, unpackSnapshot, humanBytes, backupEmailText, verifyAgainst,
} from "../netlify/lib/backup-shared.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const FN = readFileSync(new URL("../netlify/functions/backup-run.mjs", import.meta.url), "utf8");

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 IS ANYTHING LEFT OUT OF THE COPY?
// ══════════════════════════════════════════════════════════════════════════════
// A table added next month and forgotten here is only discovered on the morning it is needed
// back. So the list is checked against the code rather than against somebody's memory.
{
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : (f.endsWith(".mjs") || f.endsWith(".cjs") ? [p] : []);
  });
  const used = new Set();
  for (const f of walk(new URL("../netlify", import.meta.url).pathname)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/(?<!storage)\.from\(\s*["']([a-z][a-z0-9_]*)["']/g)) used.add(m[1]);
  }
  const listed = new Set(BACKUP_TABLES.map((t) => t.table));
  const missing = [...used].filter((t) => !listed.has(t)).sort();
  eq("🔴 every table the code touches is in the backup", missing, [],
    "a table nobody remembered to add is a table nobody can restore");
  ok("and the check actually found tables to compare", used.size >= 10, `only found ${used.size}`);
  const stale = [...listed].filter((t) => !used.has(t)).sort();
  eq("and nothing is listed that the code no longer uses", stale, []);
}

// Duplicates would double a table in the file and double its row count in the email.
eq("no table is listed twice", BACKUP_TABLES.length, new Set(BACKUP_TABLES.map((t) => t.table)).size);
ok("clients is in there", BACKUP_TABLES.some((t) => t.table === "clients"), "the business itself");
ok("clients is NOT capped", !(BACKUP_TABLES.find((t) => t.table === "clients") || {}).cap,
  "a partial copy of the client table is not a backup of the client table");
ok("website_leads is not capped either", !(BACKUP_TABLES.find((t) => t.table === "website_leads") || {}).cap);
for (const t of BACKUP_TABLES.filter((t) => t.cap)) {
  ok(`the capped table ${t.table} says how to order it`, !!t.order,
    "capping without an order keeps an arbitrary 500 rows rather than the newest 500");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 KEEP THE LAST FIVE. NOT FOUR. NEVER ZERO.
// ══════════════════════════════════════════════════════════════════════════════
const files = (n, from = 1) => Array.from({ length: n }, (_, i) =>
  ({ name: `boldline-backup-2026-09-${String(from + i).padStart(2, "0")}.json.gz` }));

eq("he asked for five", KEEP, 5);
eq("nothing is deleted while there are five", toPrune(files(5)), []);
eq("nothing is deleted while there are fewer", toPrune(files(3)), []);
eq("the sixth day deletes exactly the oldest one", toPrune(files(6)), ["boldline-backup-2026-09-01.json.gz"]);
eq("a backlog of eight deletes the three oldest", toPrune(files(8)),
  ["boldline-backup-2026-09-03.json.gz", "boldline-backup-2026-09-02.json.gz", "boldline-backup-2026-09-01.json.gz"]);
{
  // Order arrives however storage feels like returning it, which is not sorted.
  const shuffled = [files(6)[3], files(6)[0], files(6)[5], files(6)[1], files(6)[4], files(6)[2]];
  eq("it sorts before it counts", toPrune(shuffled), ["boldline-backup-2026-09-01.json.gz"],
    "trusting the listing order would delete whichever file came back first");
}
{
  const mixed = [...files(6), { name: ".emptyFolderPlaceholder" }, { name: "notes.txt" }, { name: null }, null];
  eq("a stray file in the bucket is never deleted and never counted", toPrune(mixed),
    ["boldline-backup-2026-09-01.json.gz"]);
}
eq("🔴 a keep of zero falls back to five, it does not delete everything", toPrune(files(6), 0),
  ["boldline-backup-2026-09-01.json.gz"],
  "keep=0 resolving to 'delete every copy' is the one bug there is no recovering from");
eq("a negative keep does the same", toPrune(files(6), -3), ["boldline-backup-2026-09-01.json.gz"]);
eq("and so does nonsense", toPrune(files(6), "lots"), ["boldline-backup-2026-09-01.json.gz"]);
eq("a deliberate smaller keep is still honoured", toPrune(files(6), 2).length, 4);
eq("junk in, nothing deleted", toPrune(null), []);

// ══════════════════════════════════════════════════════════════════════════════
// 3. 🔴 THE FILE IS READ BACK BEFORE ANYTHING IS DELETED
// ══════════════════════════════════════════════════════════════════════════════
ok("the function downloads its own file again", /\.download\(name\)/.test(FN),
  "a file that is never read back is a guess, not a backup");
ok("and unpacks it", /unpackSnapshot\(/.test(FN));
ok("and the answer decides whether it is trusted", /if \(!v\.ok\) throw/.test(FN),
  "reading the file back and ignoring the result is the same as not reading it back");

// The comparison itself, rather than a grep for it. A truncated file unzips perfectly well
// and is still not a copy of anything.
{
  const saved = [{ table: "clients", rows: 2 }, { table: "website_leads", rows: 3 }];
  const full = { clients: [1, 2], website_leads: [1, 2, 3] };
  eq("a complete file passes", verifyAgainst(saved, full).ok, true);
  const short = verifyAgainst(saved, { clients: [1, 2], website_leads: [1] });
  eq("🔴 a file that came back short fails", short.ok, false);
  ok("and it names the table and both counts", /website_leads/.test(short.why) && /1/.test(short.why) && /3/.test(short.why), short.why);
  eq("🔴 a table missing from the file fails", verifyAgainst(saved, { clients: [1, 2] }).ok, false);
  eq("an empty file fails", verifyAgainst(saved, {}).ok, false);
  eq("a file that unpacked to nothing fails", verifyAgainst(saved, null).ok, false);
  eq("and it checks past the first table", verifyAgainst(saved, { clients: [1, 2], website_leads: [] }).ok, false,
    "stopping at the first match would pass a file that lost everything after it");
  eq("a table that could not be read is not held against the file",
    verifyAgainst([{ table: "reviews", rows: 0, error: "nope" }], {}).ok, true,
    "it is already reported as missing; blaming the file would hide the real cause");
  eq("an empty table that really is empty still passes", verifyAgainst([{ table: "reviews", rows: 0 }], { reviews: [] }).ok, true);
}
{
  const i = FN.indexOf("pruned = toPrune(");
  const guard = FN.lastIndexOf("if (verified)", i);
  ok("🔴 nothing is pruned unless the copy verified", guard > 0 && guard < i,
    "a job that has stopped working must not spend its failing runs deleting the last good copies");
}
ok("a re-run on the same day replaces that day's file", /upsert:\s*true/.test(FN),
  "otherwise running it by hand burns one of the five slots");
ok("the file is named by day", isBackupName(backupName(new Date("2026-09-11T08:00:00Z"))));
eq("and the name carries the date", backupName(new Date("2026-09-11T08:00:00Z")), "boldline-backup-2026-09-11.json.gz");
eq("names sort oldest-last as plain text", ["boldline-backup-2026-10-02.json.gz", "boldline-backup-2026-09-30.json.gz"]
  .sort((a, b) => b.localeCompare(a))[0], "boldline-backup-2026-10-02.json.gz");
ok("something that is not ours is not treated as a backup", !isBackupName("backup.json") && !isBackupName("boldline-backup-2026-9-1.json.gz"));

// ══════════════════════════════════════════════════════════════════════════════
// 4. 🔴 THE BUCKET IS PRIVATE
// ══════════════════════════════════════════════════════════════════════════════
// Two other buckets in this project are created public because they hold images meant to be
// looked at. This one is every client's contact details and lead list in one document.
{
  const m = FN.match(/createBucket\(\s*BACKUP_BUCKET\s*,\s*\{([^}]*)\}/);
  ok("the backups bucket is created", !!m);
  ok("🔴 and it is NOT public", !!m && /public:\s*false/.test(m[1]) && !/public:\s*true/.test(m[1]),
    "a public bucket here publishes the entire customer database on a guessable URL");
  ok("and no public URL is ever minted from it", !/getPublicUrl/.test(FN),
    "a public URL for this file would outlive any decision to stop sharing it");
  ok("the download link is signed instead", /createSignedUrl\(/.test(FN));
  ok("and it expires", /createSignedUrl\(name,\s*7\s*\*\s*24\s*\*\s*3600\)/.test(FN),
    "a link that never expires is a permanent door into the customer database");
  eq("the bucket is its own, not shared with the public ones", BACKUP_BUCKET, "backups");
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. 🔴 IT CANNOT DAMAGE WHAT IT IS PROTECTING
// ══════════════════════════════════════════════════════════════════════════════
{
  // Every table read is a SELECT. The only writes in the file are to the backups bucket.
  const writes = [...FN.matchAll(/supabase\.from\(([^)]*)\)\s*\.\s*(insert|update|upsert|delete)\b/g)];
  eq("🔴 it never writes to a business table", writes.map((w) => w[0]), [],
    "a backup job with write access to the data it protects can destroy everything in one bad run");
  const removes = [...FN.matchAll(/\.remove\(/g)];
  eq("and the only deletion is the prune", removes.length, 1);
  ok("which is scoped to the backups bucket", /storage\.from\(BACKUP_BUCKET\)\s*\n?\s*\.remove\(pruned\)|storage\.from\(BACKUP_BUCKET\)\.remove\(pruned\)/.test(FN));
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. 🔴 THE QUIET FAILURE: THE FILE KEEPS BEING WRITTEN AND EMPTIES OUT
// ══════════════════════════════════════════════════════════════════════════════
const man = (rows) => ({ tables: Object.entries(rows).map(([table, r]) => (typeof r === "object" ? { table, ...r } : { table, rows: r })) });
{
  const w = countWarnings(man({ clients: 4, website_leads: 40 }), man({ clients: 4, website_leads: 40 }));
  eq("a steady night says nothing", w, []);
}
eq("growth says nothing either", countWarnings(man({ clients: 5 }), man({ clients: 4 })), []);
{
  const w = countWarnings(man({ website_leads: 38 }), man({ website_leads: 40 }));
  eq("a small drop is noted, not alarmed", w.map((x) => x.level), ["note"]);
  ok("and it says the actual numbers", /40/.test(w[0].text) && /38/.test(w[0].text), w[0].text);
}
{
  const w = countWarnings(man({ website_leads: 20 }), man({ website_leads: 40 }));
  eq("🔴 half the leads gone overnight is red", w.map((x) => x.level), ["red"]);
}
{
  const w = countWarnings(man({ clients: 0 }), man({ clients: 4 }));
  eq("🔴 a table emptied overnight is red", w.map((x) => x.level), ["red"]);
  ok("and it says so in words", /EMPTY/.test(w[0].text), w[0].text);
}
{
  const w = countWarnings(man({ clients: { rows: 0, error: "connection lost" } }), man({ clients: 4 }));
  eq("🔴 a table that could not be read is red, not a silent zero", w.map((x) => x.level), ["red"]);
  ok("and it says it is missing from tonight's copy", /NOT in tonight/.test(w[0].text), w[0].text);
  ok("rather than claiming it was deleted", !/EMPTY/.test(w[0].text),
    "an unreadable table and a wiped table need different reactions");
}
{
  const w = countWarnings(man({ login_events: { rows: 500, cap: 500 } }), man({ login_events: { rows: 500, cap: 500 } }));
  eq("a capped log sitting at its cap is not a finding", w, []);
}
{
  const w = countWarnings(man({ login_events: { rows: 400, cap: 500 } }), man({ login_events: { rows: 500, cap: 500 } }));
  eq("and a capped log moving is not either", w, [], "the cap is the number, not the truth");
}
eq("a first-ever run has nothing to compare with and says nothing", countWarnings(man({ clients: 4 }), null), []);
{
  const w = countWarnings(man({ clients: 4, website_leads: 0, blog_posts: 9 }), man({ clients: 4, website_leads: 3, blog_posts: 9 }));
  eq("it checks every table, not just the first", w.map((x) => x.table), ["website_leads"]);
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. THE FILE ITSELF
// ══════════════════════════════════════════════════════════════════════════════
{
  const snap = { manifest: { takenAt: "x", tables: [{ table: "clients", rows: 1 }] }, data: { clients: [{ id: "a", data: { name: "Sebastián — ok" } }] } };
  const back = unpackSnapshot(packSnapshot(snap));
  eq("what goes in comes back out", back, snap);
  ok("accents and symbols survive", back.data.clients[0].data.name === "Sebastián — ok",
    "a backup that mangles a name restores a mangled name");
  ok("it is actually compressed", packSnapshot({ a: "x".repeat(5000) }).length < 5000);
  ok("and it is gzip", packSnapshot({}).slice(0, 2).equals(Buffer.from([0x1f, 0x8b])));
}
eq("sizes read like sizes", [humanBytes(900), humanBytes(2048), humanBytes(3 * 1048576)], ["900 B", "2 KB", "3.0 MB"]);

// ══════════════════════════════════════════════════════════════════════════════
// 8. THE MORNING EMAIL
// ══════════════════════════════════════════════════════════════════════════════
{
  const m = man({ clients: 4, website_leads: 40, health_checks: { rows: 500, cap: 500 } });
  const s = summarizeBackup(m);
  eq("the summary counts the rows", s.rows, 544);
  eq("and the tables", s.tables, 3);
  const broken = summarizeBackup(man({ clients: 4, reviews: { rows: 0, error: "nope" } }));
  eq("an unreadable table is counted out of the total", broken.tables, 1);
  ok("and said in the one-liner", /could not be read/.test(broken.line), broken.line);
}
{
  const text = backupEmailText({
    manifest: man({ clients: 4, website_leads: 40 }),
    warnings: [{ level: "note", text: "website_leads went from 42 to 40" }],
    kept: ["boldline-backup-2026-09-11.json.gz", "boldline-backup-2026-09-07.json.gz"],
    pruned: ["boldline-backup-2026-09-06.json.gz"],
    link: "https://example.test/signed", phoenixDate: "Friday 11 September, 01:00",
  });
  ok("it says when the copy was taken, in his time", text.includes("Friday 11 September"), text.slice(0, 200));
  ok("it says what was saved", /44 rows from 2 tables/.test(text));
  ok("it carries the warning", text.includes("website_leads went from 42 to 40"));
  ok("it says how many copies are kept", /Copies kept: 2/.test(text));
  ok("it says what it deleted", text.includes("boldline-backup-2026-09-06.json.gz"));
  ok("the file is one tap away", text.includes("https://example.test/signed"));
  ok("and it is honest that the code was never the thing at risk",
    /already kept safely off site/.test(text),
    "claiming to have backed up the OS when git already had it is how the real gap stays hidden");
  ok("no jargon in the part he reads", !/Supabase|bucket|gzip|manifest|schema/i.test(text), text);
}
{
  const clean = backupEmailText({ manifest: man({ clients: 4 }), warnings: [], kept: [], pruned: [] });
  ok("a clean night leads with the all-clear", /nothing looks wrong/i.test(clean.split("\n")[0]), clean.split("\n")[0]);
  ok("and does not invent a warnings section", !/Worth a look/.test(clean));
  const bad = backupEmailText({ manifest: man({ clients: 0 }), warnings: [{ level: "red", text: "clients is EMPTY" }], kept: [], pruned: [] });
  ok("🔴 a bad night leads with the problem, not the summary", /NEEDS A LOOK/.test(bad.split("\n")[0]), bad.split("\n")[0]);
}
{
  // The condition guarding the send must be about whether email is CONFIGURED and nothing
  // else. A backup that only speaks when it breaks is indistinguishable from one that has
  // itself died, and silence is the single thing you cannot afford to misread about backups.
  const i = FN.indexOf("sendEmail(");
  ok("the email is actually sent", i > 0);
  const guard = FN.lastIndexOf("if (", i);
  const cond = FN.slice(guard, FN.indexOf("{", guard));
  ok("🔴 the email goes out every morning, not only when something breaks",
    /RESEND_API_KEY/.test(cond) && !/(red|warn|verified|sum\.ok|!ok)/.test(cond),
    `the send is gated on: ${cond.trim()}`);
}
ok("a red finding also goes down the alert channels", /dispatchAlert\(/.test(FN) && /severity:\s*"red"/.test(FN),
  "a table emptying overnight is not a thing to find in an inbox at leisure");
ok("the email address is read from Netlify, never written into the repo",
  /process\.env\.(BACKUP_EMAIL|OWNER_EMAIL)/.test(FN) && !/@gmail\.com/.test(FN),
  "an env var's value committed to a file fails the Netlify build outright");
ok("a failing email never fails the backup", /sendEmail\([\s\S]*?\)\.catch\(/.test(FN),
  "the copy is the job; the report is how you hear about it");

// ══════════════════════════════════════════════════════════════════════════════
// 9. IT IS ACTUALLY SCHEDULED, AT 1AM HIS TIME
// ══════════════════════════════════════════════════════════════════════════════
{
  const toml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
  ok("it runs on a schedule", /\[functions\."backup-run"\]\s*\n\s*schedule\s*=\s*"0 8 \* \* \*"/.test(toml),
    "an unscheduled backup is a file nobody runs");
  // 08:00 UTC in Phoenix, which never observes daylight saving, is 01:00 the same day.
  const t = new Date("2026-09-12T08:00:00Z").toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "2-digit", minute: "2-digit", hour12: false });
  eq("🔴 and 08:00 UTC really is 1am in Phoenix", t, "01:00");
  const winter = new Date("2027-01-12T08:00:00Z").toLocaleString("en-US", { timeZone: "America/Phoenix", hour: "2-digit", minute: "2-digit", hour12: false });
  eq("and still is in January, because Arizona has no daylight saving", winter, "01:00");
}
// 🔴 THE SLOW-CREEP FAILURE. A scheduled function is killed at 30 seconds. This one is fast
// today and will not be forever, and the run that first goes over just stops with no file.
{
  ok("it times itself", /Date\.now\(\) - startedAt\.getTime\(\)/.test(FN));
  ok("and says how long it took in EVERY email, not only the slow ones",
    /humanBytes\(packed\.length\)\},\s*took \$\{seconds\} seconds/.test(FN),
    "a number printed only once it is already too late is not a warning, it is a post-mortem");
  const m = FN.match(/Number\(seconds\) > (\d+)/);
  ok("and warns before the limit, not at it", !!m && Number(m[1]) > 0 && Number(m[1]) < 30,
    "warning at 30 seconds means warning on the night it already failed");
  const w = FN.indexOf("warnings.push({ table: \"\", level: \"note\"");
  ok("the timing warning lands in time to reach the email", w > 0 && w < FN.indexOf("const red = warnings"),
    "a warning pushed after the list is read is a warning nobody sees");
}

ok("a crash is alerted rather than swallowed", /withFailureAlert\("backup-run"/.test(FN),
  "a backup job that dies silently is worse than no backup, because it is trusted");

console.log(`verify-backup: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
