// Nightly backup: what gets copied, how many copies are kept, and what a bad one looks like.
//
// Bryson, 2026-09-11: *"I want to start keeping a backup data base of everything we have
// (the os, website, data base, etc.) I want to keep the last 5 and have you manage it but I
// also get an email each morning. I want you to run this everyday at 1am."*
//
// 🔴 WHAT ACTUALLY HAD NO BACKUP. The OS and the marketing site are text files in git, and
// GitHub already keeps every version of them forever, so "back up the OS" is a job that was
// silently already done. The DATABASE is the half nothing was protecting: every client
// record, every lead, every campaign draft, every blog post and every contract state lives
// in one Supabase project, and until tonight a bad write, a wrong delete or a lost project
// took all of it with no way back. That is what this copies.
//
// The email is deliberately honest about that split rather than claiming to have copied
// three things when two of them were never at risk.
//
// 🔴 THE BUCKET IS PRIVATE. This file is every client's contact details, lead list and
// campaign history in one JSON document. Two other buckets in this project are created with
// `public: true` because they hold images and archived pages meant to be looked at. Copying
// that line here would publish the entire customer database on a guessable URL. The test
// suite asserts `public: false` and that no public URL is ever minted from this bucket.

import zlib from "node:zlib";

export const BACKUP_BUCKET = "backups";

// "keep the last 5" — his words. One file per day, so five days of history.
export const KEEP = 5;

// 🔴 EVERY TABLE THE CODE TOUCHES MUST BE IN THIS LIST. A table added next month and left
// out of here is a table nobody finds out was missing until the morning they need it back.
// `tests/verify-backup.mjs` reads every `.from("...")` in netlify/ and fails if any table is
// absent from this list, so forgetting is caught by CI rather than by a disaster.
//
// `cap` exists only for the append-only logs, which grow forever and are the least valuable
// rows in the project. A capped table is recorded as truncated in the manifest and said out
// loud in the email, so a partial copy never reads as a complete one.
export const BACKUP_TABLES = [
  { table: "clients" },                                  // 🔴 the business. Everything else is replaceable.
  { table: "website_leads", order: "created_at" },
  { table: "deal_briefs" },
  { table: "calendar_events" },
  { table: "reviews" },
  { table: "blog_posts" },
  { table: "blog_settings" },
  { table: "newsletter_emails" },
  { table: "scout_prospects", order: "created_at" },     // the durable call list
  { table: "push_subscriptions" },
  { table: "scout_runs", order: "created_at", cap: 200 },   // one row per search, mostly noise after a week
  { table: "login_events", order: "created_at", cap: 500 },  // sign-in history
  { table: "health_checks", order: "ran_at", cap: 500 },     // the daily check's own results
];

// Storage buckets hold FILES, not rows, and copying every image every night would be five
// copies of the same megabytes. These are inventoried instead: the backup records what
// existed and where, which is what you need to know what is missing. Said plainly in the email.
export const INVENTORY_BUCKETS = ["page-archives", "media", "stock-photos"];

const two = (n) => String(n).padStart(2, "0");

// Named by DAY on purpose. A second run on the same day replaces that day's file rather than
// eating one of the five slots, so re-running by hand can never cost history.
export const backupName = (d = new Date()) =>
  `boldline-backup-${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}.json.gz`;

export const isBackupName = (n) => /^boldline-backup-\d{4}-\d{2}-\d{2}\.json\.gz$/.test(String(n || ""));

// Which stored files are past the keep limit.
//
// 🔴 ORDER OF OPERATIONS: the caller prunes only AFTER a verified upload. Pruning first, or
// pruning on a failed run, is how a job that has stopped working quietly deletes the last
// good copies it made while it still worked.
export const toPrune = (files, keep = KEEP) => {
  // A keep limit that resolves to zero deletes every copy in one run, and that is the one
  // bug there is no recovering from. Anything that is not a sane number falls back to five.
  const n = Number(keep);
  const k = Number.isFinite(n) && n >= 1 ? Math.floor(n) : KEEP;
  return (files || [])
    .map((f) => (f && f.name) || "")
    .filter(isBackupName)
    .sort((a, b) => b.localeCompare(a))          // ISO dates sort newest-first as plain text
    .slice(k);
};

// ── Is the copy we just took actually healthy? ───────────────────────────────
// 🔴 A BACKUP NOBODY READS IS A FILE, NOT A BACKUP. The failure this catches is the quiet
// one: the job keeps running, the file keeps being written, and what is inside it has been
// emptying out for a week. Comparing today's row counts with yesterday's is the only way to
// see that from the outside, and it is also how he would learn a table got wiped at all.
export const countWarnings = (today, previous) => {
  const prev = new Map(((previous && previous.tables) || []).map((t) => [t.table, t]));
  const out = [];
  for (const t of (today && today.tables) || []) {
    if (t.error) {
      out.push({ table: t.table, level: "red",
        text: `${t.table} could not be read, so it is NOT in tonight's copy (${t.error})` });
      continue;
    }
    const was = prev.get(t.table);
    if (!was || was.error || typeof was.rows !== "number") continue;
    // A capped table's row count is the cap, not the truth, so a change there means nothing.
    if (t.cap || was.cap) continue;
    const drop = was.rows - t.rows;
    if (drop <= 0) continue;
    const share = was.rows ? drop / was.rows : 0;
    const red = t.rows === 0 || share >= 0.25;
    out.push({ table: t.table, level: red ? "red" : "note", drop,
      text: t.rows === 0
        ? `${t.table} is EMPTY this morning and had ${was.rows} yesterday. Something deleted all of it.`
        : `${t.table} went from ${was.rows} to ${t.rows}${red ? ", which is a big drop" : ""}` });
  }
  return out;
};

// 🔴 DOES THE FILE WE JUST WROTE ACTUALLY CONTAIN WHAT WE READ?
//
// The classic way a backup job lies is by "succeeding" for months while writing a file that
// is truncated, empty or unreadable, discovered on the one day it is needed. So the file is
// downloaded again, unpacked, and every table's row count inside it is compared with what
// came out of the database. A table that read fine but landed short means the file is not a
// copy of anything, and nothing may be deleted on the strength of it.
export const verifyAgainst = (tables, restored) => {
  if (!restored || typeof restored !== "object") return { ok: false, why: "the file unpacked to nothing" };
  for (const t of tables || []) {
    if (t.error) continue;                       // already reported as missing; not the file's fault
    const got = restored[t.table];
    if (!Array.isArray(got)) return { ok: false, why: `${t.table} is not in the file at all` };
    if (got.length !== t.rows) return { ok: false, why: `${t.table} came back with ${got.length} rows and ${t.rows} were saved` };
  }
  return { ok: true, why: "" };
};

export const summarizeBackup = (manifest) => {
  const tables = (manifest && manifest.tables) || [];
  const okTables = tables.filter((t) => !t.error);
  const rows = okTables.reduce((n, t) => n + (Number(t.rows) || 0), 0);
  const broken = tables.filter((t) => t.error);
  return {
    rows,
    tables: okTables.length,
    broken: broken.length,
    line: broken.length
      ? `${rows} rows from ${okTables.length} tables saved, ${broken.length} could not be read`
      : `${rows} rows from ${okTables.length} tables saved`,
  };
};

// gzip, because this is mostly repeated JSON keys and compresses about ten to one.
export const packSnapshot = (snapshot) => zlib.gzipSync(Buffer.from(JSON.stringify(snapshot), "utf8"));
export const unpackSnapshot = (buf) => JSON.parse(zlib.gunzipSync(Buffer.from(buf)).toString("utf8"));

export const humanBytes = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
};

// ── The morning email ────────────────────────────────────────────────────────
// Plain English on purpose. He reads this half asleep and the only questions that matter are
// "did it work", "is anything missing", and "where is the file if I need it".
export const backupEmailText = ({ manifest, warnings = [], kept = [], pruned = [], link, phoenixDate }) => {
  const sum = summarizeBackup(manifest);
  const red = warnings.filter((w) => w.level === "red");
  const lines = [];
  lines.push(red.length ? "SOMETHING NEEDS A LOOK" : "Backup finished, nothing looks wrong.");
  lines.push("");
  lines.push(`Copy taken: ${phoenixDate}`);
  lines.push(`Saved: ${sum.line}.`);
  if (warnings.length) {
    lines.push("");
    lines.push("Worth a look:");
    for (const w of warnings) lines.push(`  ${w.level === "red" ? "!" : "-"} ${w.text}`);
  }
  lines.push("");
  lines.push(`Copies kept: ${kept.length} (oldest ${kept[kept.length - 1] || "none"}).`);
  if (pruned.length) lines.push(`Deleted the oldest: ${pruned.join(", ")}.`);
  if (link) { lines.push(""); lines.push(`Download this copy (link works for 7 days): ${link}`); }
  lines.push("");
  lines.push("What this covers: everything in the database. Clients, their leads, campaigns, contracts, the blog and the calendar.");
  lines.push("What it does not need to cover: the OS itself and the website. Those are code, and every version of them is already kept safely off site.");
  return lines.join("\n");
};
