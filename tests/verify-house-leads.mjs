// Guards the seam that made BoldLine's own account read `leads: 0` while real leads
// were sitting in the OS (Bryson, 2026-08-21: "the os isnt taking the data from the
// live ad"). KB `house-leads-mirror`.
//
// Three invariants, each of which has been deliberately broken and confirmed to fail:
//   1. a website lead becomes a house lead EXACTLY ONCE, deduped on its row id — this
//      job runs every 15 minutes over the whole table, so a weak dedupe multiplies
//      every lead by 96 a day,
//   2. a status Bryson set by hand in the house Leads tab is never overwritten by the
//      next poll, and
//   3. pruning only happens on a run that actually read the whole table, so a lead can
//      never be deleted merely for falling off the end of a page.
//
// 🔴 THIS SUITE RUNS THE REAL MERGE, and it took a failed attempt to get there. The first
// version re-implemented the merge locally (the function imports Supabase, so it cannot be
// imported without credentials) and pinned the original with regexes over the source. Then
// the guards were broken to check they bite, per KB `repo-tests` — and TWO of them did not:
// deleting the hand-set-status guard and renaming the dedupe key both left the suite green,
// because the copy in the test was still correct and the pins matched unrelated lines. The
// fix was to move the pure logic into ../netlify/lib/house-leads-merge.mjs and import it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// 🔴 The scheduled function AND the shared core it now calls, read as one body.
// The merge moved into netlify/lib/house-leads-run.mjs on 2026-09-02 so the OS could ask
// for the same mirror on demand. Every rule below is about the MIRROR, not about which file
// it sits in, so they are checked against both rather than being relaxed or deleted. If
// this had been narrowed to the scheduled file, ten real guards would have gone quiet the
// moment the code moved, and that is the failure mode this comment exists to prevent.
const SRC = readFileSync(join(ROOT, "netlify/functions/house-leads.mjs"), "utf8")
  + "\n" + readFileSync(join(ROOT, "netlify/lib/house-leads-run.mjs"), "utf8");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const TOML = readFileSync(join(ROOT, "netlify.toml"), "utf8");

// Comment lines are stripped before any assertion about behaviour: this file's own
// prose explains the bugs, and more than one suite in this repo has passed by matching
// the comment that described the thing it was meant to be checking.
const code = (s) => s.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
const SRC_CODE = code(SRC);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

import { mergeHouseLeads, mapStatus, sourceOf, isLeadRow, NON_LEAD_FORMS, HOUSE_STATUSES, PRUNE_LIMIT } from "../netlify/lib/house-leads-merge.mjs";

// One name, so every call below reads like the job's own code path.
const merge = mergeHouseLeads;

const wl = (id, over = {}) => ({
  id, created_at: "2026-08-20T18:00:00.000Z", form: "contact",
  name: `Lead ${id}`, business: "", email: `${id}@example.com`, message: "", status: "new",
  payload: {}, ...over,
});

// ── 1. Every lead lands, exactly once ──────────────────────────────────────────
{
  const leads = [wl("a"), wl("b"), wl("c")];
  const first = merge([], leads);
  eq("first run adds every website lead", first.added, 3);
  eq("first run keeps exactly those leads", first.kept.length, 3);

  // The whole correctness argument: re-running the same poll must change nothing.
  let log = first.kept;
  for (let i = 0; i < 96; i++) {           // one day of 15-minute polls
    const r = merge(log, leads);
    log = r.kept;
    if (r.added || r.updated || r.pruned) { ok("a repeat poll is a no-op", false, `run ${i} added ${r.added}`); break; }
  }
  eq("96 repeat polls leave 3 leads, not 288", log.length, 3);
  eq("every mirrored lead carries its source row id", log.filter((l) => l.websiteLeadId).length, 3);
}

// ── 2. Newest first, and hand-entered leads are never touched ──────────────────
{
  const leads = [
    wl("old", { created_at: "2026-08-01T00:00:00.000Z" }),
    wl("new", { created_at: "2026-08-21T00:00:00.000Z" }),
  ];
  const manual = { status: "won", name: "Called in", source: "call_tracking", receivedAt: "2026-08-10T00:00:00.000Z" };
  const r = merge([manual], leads);
  eq("hand-entered lead survives the mirror", r.kept.filter((l) => !l.websiteLeadId).length, 1);
  eq("hand-entered lead is never pruned", r.pruned, 0);
  eq("log is newest first", r.kept[0].websiteLeadId, "new");
  eq("oldest sorts last", r.kept[r.kept.length - 1].websiteLeadId, "old");
}

// ── 3. Status: synced one way, until he moves it himself ───────────────────────
{
  const leads = [wl("x", { status: "new" })];
  let log = merge([], leads).kept;
  eq("mirrored lead starts at the website status", log[0].status, "new");

  // He marks it Meeting Booked on the global Leads screen: the house copy follows.
  const r1 = merge(log, [wl("x", { status: "meeting" })]);
  eq("website status change syncs across", r1.kept[0].status, "meeting");
  eq("a status sync is reported as an update", r1.updated, 1);

  // He moves it by hand in the HOUSE tab instead. The next poll must not undo him.
  const byHand = r1.kept.map((l) => ({ ...l, status: "won" }));
  const r2 = merge(byHand, [wl("x", { status: "meeting" })]);
  eq("a hand-set status is never overwritten", r2.kept[0].status, "won");
  eq("and is not counted as an update", r2.updated, 0);
  // Still true after many more polls, not just the next one.
  let log2 = r2.kept;
  for (let i = 0; i < 20; i++) log2 = merge(log2, [wl("x", { status: "meeting" })]).kept;
  eq("a hand-set status survives repeated polls", log2[0].status, "won");
}

// ── 4. Status mapping covers every website_leads value ─────────────────────────
{
  eq("archived folds into lost", mapStatus("archived"), "lost");
  eq("an unknown status falls back to new", mapStatus("zzz"), "new");
  eq("a missing status falls back to new", mapStatus(undefined), "new");
  for (const s of HOUSE_STATUSES) eq(`${s} maps to itself`, mapStatus(s), s);
  // Every status the schema and the two writers can produce must land somewhere real.
  const SCHEMA = ["new", "contacted", "won", "lost", "archived", "meeting"];
  ok("every real website status maps into the house pipeline",
    SCHEMA.every((s) => HOUSE_STATUSES.includes(mapStatus(s))));
  // The house Leads tab's own status list is the set we are mapping into.
  const tab = UI.match(/const STATUSES = client\.internal[\s\S]{0,600}?\]\s*:/);
  ok("the house Leads tab still offers exactly these stages", !!tab
    && HOUSE_STATUSES.every((s) => new RegExp(`id:"${s}"`).test(tab[0])));
}

// ── 5. Deleted leads are pruned, but only when we saw the whole table ──────────
{
  const leads = [wl("a"), wl("b")];
  const log = merge([], leads).kept;
  const r = merge(log, [wl("a")]);           // he deleted "b" from the Leads screen
  eq("a deleted website lead is pruned", r.pruned, 1);
  eq("and is gone from the log", r.kept.length, 1);

  // A run that FILLED its page has not seen everything, so pruning must be off —
  // otherwise every lead past the page boundary is deleted on a perfectly healthy run.
  // Six leads mirrored, then a read whose page holds only five: the sixth is missing
  // because it did not fit, not because he deleted it.
  const six = Array.from({ length: 6 }, (_, i) => wl(`f${i}`, { created_at: `2026-08-0${i + 1}T00:00:00.000Z` }));
  const seeded = merge([], six, { limit: 99 }).kept;
  eq("six leads mirrored", seeded.length, 6);
  const page = six.slice(0, 5);                       // a full page: 5 rows, limit 5
  const capped = merge(seeded, page, { limit: 5 });
  eq("a full page prunes nothing", capped.pruned, 0);
  eq("and loses nothing", capped.kept.length, 6);
  // Same missing lead, but the page had room to spare, so the absence IS a deletion.
  const roomy = merge(seeded, page, { limit: 6 });
  eq("a short page does prune the missing lead", roomy.pruned, 1);
  eq("leaving the five that were read", roomy.kept.length, 5);
}

// ── 6. Source labels reach the Leads tab intact ────────────────────────────────
{
  eq("a Calendly booking is labelled calendly", sourceOf({ form: "calendly" }), "calendly");
  eq("the fit quiz is labelled quiz", sourceOf({ form: "recommendation" }), "quiz");
  eq("the contact form is labelled website", sourceOf({ form: "contact" }), "website");
  eq("an unknown form still gets a label", sourceOf({}), "website");
}

// ── 6b. Rows that are NOT leads never reach the house account ─────────────────
// Two kinds of row share this table without being enquiries. The first version of the
// job mirrored both, so newsletter subscribers were landing on the house account as
// leads — inflating the count AND the cost-per-lead that is divided by it.
{
  ok("a newsletter subscriber is not a lead", !isLeadRow({ form: "newsletter" }));
  ok("a deleted-lead tombstone is not a lead", !isLeadRow({ form: "deleted" }));
  ok("a contact form is a lead", isLeadRow({ form: "contact" }));
  ok("a Calendly booking is a lead", isLeadRow({ form: "calendly" }));
  // A DENYLIST, not an allowlist: a Netlify form added later must arrive as a lead by
  // default rather than silently vanish because nobody updated a list.
  ok("an unknown future form is still a lead", isLeadRow({ form: "quote-request-2027" }));
  ok("a row with no form at all is still a lead", isLeadRow({}));

  const mixed = [
    wl("real", { form: "contact" }),
    wl("sub", { form: "newsletter" }),
    wl("tomb", { form: "deleted" }),
    wl("book", { form: "calendly" }),
  ];
  const r = merge([], mixed);
  eq("only the real enquiries are mirrored", r.added, 2);
  ok("no subscriber reached the house account", !r.kept.some((l) => l.websiteLeadId === "sub"));
  ok("no tombstone reached the house account", !r.kept.some((l) => l.websiteLeadId === "tomb"));

  // Self-healing: subscribers mirrored before the filter existed must be pruned on the
  // next run, not left behind forever.
  const stale = merge([], mixed.map((m) => ({ ...m, form: "contact" }))).kept;
  eq("four leads existed before the filter", stale.length, 4);
  const healed = merge(stale, mixed);
  eq("the two that are not leads get pruned", healed.pruned, 2);
  eq("leaving only the real ones", healed.kept.length, 2);

  // 🔴 The prune gate is measured on the RAW page. Filtering first would make a page that
  // came back FULL look short, re-enabling pruning on an incomplete read — the exact data
  // loss the gate exists to prevent.
  const page = [wl("a", { form: "contact" }), wl("b", { form: "newsletter" }), wl("c", { form: "newsletter" })];
  const seeded2 = merge([], [wl("a"), wl("z")], { limit: 99 }).kept;
  eq("two leads mirrored", seeded2.length, 2);
  const gated = merge(seeded2, page, { limit: 3 });   // 3 rows read, page size 3 = full
  eq("a full page of mostly non-leads still prunes nothing", gated.pruned, 0);
  eq("and keeps the lead it could not see", gated.kept.length, 2);
}

// ── 6c. Deleting a Calendly lead has to stay deleted ──────────────────────────
// The bug he hit: the Calendly sync re-derives bookings from Calendly every 15 minutes
// and asks whether a lead already carries the event id. A hard delete answered "no", so
// the booking came straight back. The OS now re-files the row as a stripped tombstone.
{
  const del = UI.match(/const deleteLead = useCallback\(async \(lead\) => \{[\s\S]*?\n  \}, \[loadLeads\]\);/);
  ok("the delete handler exists in its new form", !!del);
  const body = del ? del[0] : "";
  ok("a Calendly lead is re-filed rather than removed", /form: "deleted"/.test(body));
  ok("the booking id is kept, which is the whole point",
    /calendlyEventUri: uri/.test(body));
  ok("every personal field is cleared",
    ["name", "email", "business", "recommended", "notes"].every((f) => new RegExp(`${f}: null`).test(body)));
  ok("a non-Calendly lead is still hard deleted", /\.delete\(\)\.eq\("id", id\)/.test(body));
  ok("a refused delete is shown to the owner, not just logged",
    /setLeadError\(/.test(body) && /loadLeads\(\)/.test(body));
  ok("the whole lead is handed to the handler, not just its id", /onDelete\(lead\)/.test(UI));

  // The Calendly sync's dedupe must still be the form-agnostic lookup the tombstone
  // relies on. If it ever starts filtering by form, the tombstone stops working.
  const SYNC = code(readFileSync(join(ROOT, "netlify/functions/calendly-leads.mjs"), "utf8"));
  const dedupe = SYNC.match(/\.from\("website_leads"\)\.select\("id"\)[^;]*/);
  ok("the sync still looks the booking id up across the whole table", !!dedupe
    && /payload->>calendlyEventUri/.test(dedupe[0]) && !/\.eq\("form"/.test(dedupe[0]));

  // And the tombstone must be invisible on the Leads screen.
  ok("tombstones are filtered out of the Leads list",
    /l\.form !== "newsletter" && l\.form !== "deleted"/.test(UI));
}

// ── 7. The wiring around the merge ────────────────────────────────────────────
// The logic above is the real thing, so these only pin what the merge cannot see:
// which row it writes, which table it must never write, and that it is scheduled.
{
  // The path is "./" from the lib and "../lib/" from a function, so the check is about
  // IMPORTING the shared merge rather than about where the importer happens to live.
  ok("the mirror uses the shared merge, not a second copy",
    /import \{ mergeHouseLeads, PRUNE_LIMIT \} from "\.[^"]*house-leads-merge\.mjs"/.test(SRC_CODE));
  ok("🔴 and there is exactly one place that does the mirroring",
    (SRC_CODE.match(/mergeHouseLeads\(/g) || []).length === 1,
    "the merge is called from more than one file, so the scheduled job and the on-demand one can disagree about a lead count");
  ok("the house account is still found by the internal flag",
    /\.eq\("data->>internal", "true"\)/.test(SRC_CODE));
  ok("website_leads is only ever read",
    /\.from\("website_leads"\)\s*\n?\s*\.select\(/.test(SRC_CODE)
    && !/\.from\("website_leads"\)[\s\S]{0,120}?\.(insert|update|delete|upsert)\(/.test(SRC_CODE));
  ok("the leads counter is kept in step with the log", /leads: kept\.length/.test(SRC_CODE));
  // Now conditional on the heartbeat too: a quiet run still writes nothing while the
  // heartbeat is fresh, and writes only the heartbeat once an hour so the OS can tell
  // "no leads yet" apart from "this stopped working". See section 9.
  ok("a quiet run with a fresh heartbeat still writes nothing",
    /if \(!changed && !staleBeat\) \{/.test(SRC_CODE));
  ok("the read page size is the same one the merge prunes against",
    /\.limit\(PRUNE_LIMIT\)/.test(SRC_CODE) && PRUNE_LIMIT === 1000);
  ok("it is scheduled every 15 minutes", /\[functions\."house-leads"\]\s*\n\s*schedule = "\*\/15 \* \* \* \*"/.test(TOML));
}

// ── 8. The screens read the log, not the stale counter ─────────────────────────
// This is the half of the bug the mirror alone would not fix: three places used the
// cached `leads` number, which nothing on the website path ever incremented.
{
  const UI_CODE = code(UI);
  ok("the health score counts the log",
    /const leads = \(\(cl && cl\.leadsLog\) \|\| \[\]\)\.length/.test(UI_CODE));
  ok("the pipeline counts the log",
    /const leads\s+= \(cl\.leadsLog \|\| \[\]\)\.length/.test(UI_CODE));
  ok("adPerfStats exists and reads the stored snapshot",
    /const adPerfStats = \(cl\) =>/.test(UI_CODE) && /cl\.adPerf/.test(UI_CODE));
  ok("cost per lead is computed from spend and leads, not stored",
    /cpl: \(leads30>0 && spend30>0\) \? spend30\/leads30 : null/.test(UI_CODE));
  ok("the Overview shows live ad performance", /Live Ad Performance/.test(UI_CODE));
  ok("a failed account read is surfaced rather than shown as a zero",
    /These numbers are stale/.test(UI_CODE));
  // Parity: the card is not house-only. A client with a linked account gets it too.
  ok("clients with a linked account get the same card",
    /\{\(client\.internal\|\|client\.googleAdsCustomerId\|\|client\.metaAdAccountId\)&&\(\(\)=>\{\s*\n\s*const st = adPerfStats\(client\);/.test(UI));
}

// ── 9. A heartbeat, so "no leads yet" and "this broke" look different ─────────
// Bryson, 2026-08-24: "I also want to make sure the actual lead count works (i havent
// gotten any yet but i still want to test that itll work)".
//
// 🔴 HE CANNOT TEST IT WITH NO LEADS, AND THAT IS EXACTLY THE STATE WHERE A BROKEN
// MIRROR IS INVISIBLE. The screen reads 0, which is also the correct answer, so nothing
// looks wrong. Same shape as the "These numbers are stale" panel on the ad card: a
// failed read must never be indistinguishable from a real zero.
{
  ok("the job records when it last checked", /const leadSync = \{ at: new Date\(\)\.toISOString\(\)/.test(SRC_CODE));
  ok("and stores it on the record", /leadSync \}/.test(SRC_CODE));
  // It must still not write 96 times a day just to say it did nothing.
  ok("a quiet run with a fresh heartbeat writes nothing",
    /if \(!changed && !staleBeat\) \{/.test(SRC_CODE));
  ok("but a quiet run with a stale heartbeat does write",
    /const staleBeat = !prevSync\.at \|\| \(Date\.now\(\) - new Date\(prevSync\.at\)\.getTime\(\)\) > 55 \* 60e3;/.test(SRC_CODE));

  const UI_CODE2 = code(UI);
  ok("the OS reads the heartbeat", /leadsSyncedAt: \(cl && cl\.leadSync && cl\.leadSync\.at\) \|\| null/.test(UI_CODE2));
  ok("and works out whether it has gone quiet",
    /leadsSyncStale: !!\(cl && cl\.leadSync && cl\.leadSync\.at/.test(UI_CODE2));
  ok("the card says zero leads is normal when the check is healthy",
    /No leads yet, and the lead check is running normally/.test(UI));
  // 🔴 Checks that a stale count is FLAGGED, not the exact sentence. The wording changed on
  // 2026-09-02 when the OS started refreshing on demand: "the lead check has not run" was
  // no longer true or useful, because the leads themselves were never late, only this
  // count. Pinning the sentence would have made an accuracy fix look like a regression.
  ok("and warns plainly when the count is behind",
    /These numbers were last refreshed/.test(UI) && /may be missing from the count/.test(UI));
  // 🔴 And it must not frighten him about the leads themselves, which are never delayed.
  ok("while making clear no lead is actually lost",
    /Leads themselves are safe and are all on the Leads screen/.test(UI));
  ok("and says so before the first run too", /has not reported in yet/.test(UI));
  ok("the leads tile shows when it last checked", /checked \$\{ago\(st\.leadsSyncedAt\)\}/.test(UI));
}

// ── 10. Ad numbers refresh hourly ─────────────────────────────────────────────
// Bryson: "can you make it so the ads performance metrics in the os updated accurately
// every hour or two instead of 6".
{
  ok("ads-sync runs hourly", /\[functions\."ads-sync"\]\s*\n\s*schedule = "0 \* \* \* \*"/.test(TOML));
  ok("and no longer every six hours", !/schedule = "0 \*\/6 \* \* \*"/.test(TOML));
  ok("the lead mirror still runs every 15 minutes",
    /\[functions\."house-leads"\]\s*\n\s*schedule = "\*\/15 \* \* \* \*"/.test(TOML));
}

// ── 🔴 8. THE NUMBERS UPDATE WHILE HE IS LOOKING AT THEM ──────────────────────
// Bryson, 2026-09-02, after a Netlify log showed the fifteen-minute job skipped for two and
// a half hours: *"lets have the numbers update live"*.
//
// 🔴 The distinction that decides what this is worth, and an earlier reply to him got it
// wrong: website leads ALREADY reach the OS instantly, because the Leads screen reads
// `website_leads` directly on a realtime subscription. What lagged is the house account's
// COPY, which the My Ads tiles read. This makes a dashboard current, not leads arrive.
{
  const SYNCFN = readFileSync(join(ROOT, "netlify/functions/house-leads-sync.mjs"), "utf8");
  const RUN = readFileSync(join(ROOT, "netlify/lib/house-leads-run.mjs"), "utf8");

  ok("the on-demand sync runs the same mirror as the schedule",
    /import \{ syncHouseLeads \} from "\.\.\/lib\/house-leads-run\.mjs"/.test(SYNCFN)
    && /import \{ syncHouseLeads \} from "\.\.\/lib\/house-leads-run\.mjs"/.test(readFileSync(join(ROOT, "netlify/functions/house-leads.mjs"), "utf8")),
    "one of the two paths has its own copy of the mirror, so they can disagree about a lead count");

  ok("🔴 it is behind the owner's login",
    /auth\.getUser\(jwt\)/.test(SYNCFN) && /Not authenticated/.test(SYNCFN),
    "anyone on the internet can make this run work against the database");

  ok("and refuses anything but a POST", /Method not allowed/.test(SYNCFN));

  // 🔴 The scheduled job alerts because nobody watches it. This one runs because he is
  // looking at the screen, so a red alert for something he can see and fix by refreshing
  // would be noise, and noise is how real alerts get ignored.
  ok("it does not raise a red alert of its own", !/dispatchAlert|withFailureAlert/.test(SYNCFN));

  const UI_CODE3 = code(UI);
  ok("the OS asks for the mirror on the same event the Leads screen listens to",
    /useLiveData\(pullHouseLeads,\{ table:"website_leads"/.test(UI_CODE3),
    "the live update is on a timer only, so it is not actually live");

  ok("🔴 only for the house account",
    /if \(!client\.internal \|\| syncingHouseLeads\.current\) return;/.test(UI_CODE3),
    "opening any client would trigger the house mirror, and a real client's leads are written by a different path entirely");

  ok("🔴 two runs cannot overlap",
    /syncingHouseLeads\.current = true;/.test(UI_CODE3) && /syncingHouseLeads\.current = false;/.test(UI_CODE3),
    "a burst of leads fires several overlapping merges at the same row");

  ok("and it re-reads the client only when something was actually written",
    /d\.beat!==false/.test(UI_CODE3),
    "a screen left open re-fetches the client on every poll for no reason");

  // 🔴 The whole point of the no-write shortcut, which matters MORE now than it did when
  // only a cron called it: this runs on every realtime nudge and every poll.
  ok("a quiet on-demand run still writes nothing",
    /if \(!changed && !staleBeat\) \{/.test(code(RUN)),
    "a My Ads screen left open would rewrite the client record all day");
}

console.log(`verify-house-leads: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
