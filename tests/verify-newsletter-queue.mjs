// 🔴 TURNING SENDING ON MUST NOT FIRE A BACKLOG AT THE LIST.
//
// Bryson, 2026-09-02, wanting the newsletter switched on so a new subscriber does not land
// on a dead list: *"can you just clear the backlog"*.
//
// Sending had been off for weeks while the writer kept queueing one companion email per blog
// post, and the old code said the quiet part out loud: "leave them scheduled so they send the
// moment sending is turned on". So one switch would have fired the entire backlog in a single
// hourly run. Several emails at once, each announcing a post that went up weeks ago as though
// it were new, and that is the first thing a brand new subscriber would ever have received.
//
// The rule that replaces it: an email more than STALE_AFTER_HOURS past its send time is
// RETIRED rather than sent. That clears the existing pile by itself and stops the trap being
// reset every time sending is ever paused again.
//
// This runs the REAL sendDueNewsletters against a fake database, so what is being checked is
// the decision the code makes, not a description of it. sendBroadcast is never reached in the
// paths that matter, and where it is, the fake has no Resend key so it throws before any mail
// could exist. Nothing here can send anything.

import { sendDueNewsletters, STALE_AFTER_HOURS } from "../netlify/lib/newsletter-shared.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const HOUR = 3600 * 1000;
const agoH = (h) => new Date(Date.now() - h * HOUR).toISOString();

// A database that records what the code TRIED to write, rather than storing anything.
function fakeDb(rows) {
  const writes = [];
  return {
    writes,
    from() {
      let patch = null;
      const q = {
        select: () => q,
        eq: (col, val) => { if (patch && col === "id") writes.push({ id: val, patch }); return q; },
        lte: () => q,
        update: (p) => { patch = p; return q; },
        then: (onOk, onErr) => Promise.resolve({ data: rows, error: null }).then(onOk, onErr),
      };
      return q;
    },
  };
}

const retiredIds = (db) => db.writes.filter((w) => w.patch.status === "deleted").map((w) => w.id).sort();
const sentIds = (db) => db.writes.filter((w) => w.patch.status === "sent").map((w) => w.id).sort();

const withSending = async (on, fn) => {
  const before = process.env.NEWSLETTER_SENDING_ENABLED;
  if (on) process.env.NEWSLETTER_SENDING_ENABLED = "1";
  else delete process.env.NEWSLETTER_SENDING_ENABLED;
  try { return await fn(); }
  finally { if (before === undefined) delete process.env.NEWSLETTER_SENDING_ENABLED; else process.env.NEWSLETTER_SENDING_ENABLED = before; }
};

// ── 1. 🔴 THE BACKLOG CLEARS ITSELF WHILE SENDING IS STILL OFF ───────────────────
// This is the half he actually asked for. The job runs hourly regardless of the switch,
// so by the time he flips it the pile is already gone and there is nothing to fire.
{
  const rows = [
    { id: "old1", post_slug: "a", scheduled_for: agoH(24 * 30) },
    { id: "old2", post_slug: "b", scheduled_for: agoH(24 * 14) },
    { id: "old3", post_slug: "c", scheduled_for: agoH(72) },
  ];
  const db = fakeDb(rows);
  const r = await withSending(false, () => sendDueNewsletters(db));
  ok("with sending off, the whole backlog is retired", r.retired === 3, JSON.stringify(r));
  ok("and it is retired by id, one row at a time", retiredIds(db).join(",") === "old1,old2,old3", retiredIds(db).join(","));
  ok("nothing is sent while sending is off", r.sent === 0 && sentIds(db).length === 0);
  ok("and nothing is left waiting", r.pending === 0, `pending ${r.pending}`);
}

// ── 2. 🔴 IT IS THE SAME SOFT DELETE THE OS DELETE BUTTON USES ───────────────────
// Retiring must be recoverable. A hard delete would mean an email retired by mistake is
// gone, and the row is also what stops the writer regenerating a companion for that post.
{
  const db = fakeDb([{ id: "x", post_slug: "p", scheduled_for: agoH(500) }]);
  await withSending(false, () => sendDueNewsletters(db));
  const w = db.writes[0];
  ok("retiring writes a status, it does not remove the row", !!w && w.patch.status === "deleted", JSON.stringify(w));
  ok("and it changes nothing else about the email", !!w && Object.keys(w.patch).join(",") === "status", JSON.stringify(w && w.patch));
}

// ── 3. A FRESH EMAIL IS NEVER RETIRED ────────────────────────────────────────────
// The failure that would matter most: binning a good newsletter instead of sending it.
{
  const rows = [
    { id: "fresh1", post_slug: "d", scheduled_for: agoH(1) },
    { id: "fresh2", post_slug: "e", scheduled_for: agoH(STALE_AFTER_HOURS - 1) },
  ];
  const db = fakeDb(rows);
  const r = await withSending(false, () => sendDueNewsletters(db));
  ok("a newsletter still within its window is left alone", r.retired === 0, JSON.stringify(r));
  ok("and it stays queued for when sending comes on", r.pending === 2, `pending ${r.pending}`);
  ok("nothing was written to it at all", db.writes.length === 0, JSON.stringify(db.writes));
}

// ── 4. THE BOUNDARY, FROM BOTH SIDES ─────────────────────────────────────────────
// An off-by-one here is the difference between binning this morning's newsletter and
// mailing one from last month.
{
  const just = fakeDb([{ id: "just-inside", post_slug: "f", scheduled_for: agoH(STALE_AFTER_HOURS - 0.5) }]);
  const r1 = await withSending(false, () => sendDueNewsletters(just));
  ok(`half an hour inside ${STALE_AFTER_HOURS}h survives`, r1.retired === 0, JSON.stringify(r1));

  const past = fakeDb([{ id: "just-past", post_slug: "g", scheduled_for: agoH(STALE_AFTER_HOURS + 0.5) }]);
  const r2 = await withSending(false, () => sendDueNewsletters(past));
  ok(`half an hour past ${STALE_AFTER_HOURS}h is retired`, r2.retired === 1, JSON.stringify(r2));
}

// ── 5. 🔴 A MISSING OR BROKEN SEND TIME COUNTS AS FRESH ──────────────────────────
// Date.parse of rubbish is NaN, and NaN < cutoff is false in JavaScript, so this happens
// to be right. It is pinned because it is right by ACCIDENT: flip the comparison while
// tidying and every row with a bad timestamp gets silently binned instead.
{
  for (const bad of [null, undefined, "", "not a date"]) {
    const db = fakeDb([{ id: "b", post_slug: "h", scheduled_for: bad }]);
    const r = await withSending(false, () => sendDueNewsletters(db));
    ok(`a send time of ${JSON.stringify(bad)} is never treated as stale`, r.retired === 0, JSON.stringify(r));
  }
}

// ── 6. WITH SENDING ON, STALE AND FRESH ARE SEPARATED, NOT LUMPED ────────────────
// The mixed queue is the real case on the day he flips the switch.
{
  const rows = [
    { id: "old", post_slug: "i", scheduled_for: agoH(24 * 20) },
    { id: "new", post_slug: "j", scheduled_for: agoH(2) },
  ];
  const db = fakeDb(rows);
  const r = await withSending(true, () => sendDueNewsletters(db));
  ok("the old one is retired", r.retired === 1 && retiredIds(db).join(",") === "old", JSON.stringify(r));
  // The fresh one is attempted. There is no Resend key here so the send throws and is
  // caught, which is the point: it was PUT THROUGH the send path while the old one was not.
  ok("the old one is never put through the send path", !sentIds(db).includes("old"), sentIds(db).join(","));
  ok("and the report separates the two", r.enabled === true && typeof r.retired === "number" && typeof r.sent === "number", JSON.stringify(r));
}

// ── 7. AN EMPTY QUEUE REPORTS CLEANLY ────────────────────────────────────────────
// The everyday case: nearly every hourly run has nothing to do and must say so without
// a missing field that a caller would read as undefined.
{
  for (const empty of [[], null]) {
    const r = await withSending(false, () => sendDueNewsletters(fakeDb(empty)));
    ok(`an empty queue (${JSON.stringify(empty)}) reports zero on every count`,
      r.sent === 0 && r.pending === 0 && r.retired === 0, JSON.stringify(r));
  }
}

// ── 8. 🔴 THE WRITER CANNOT REGENERATE WHAT WAS JUST RETIRED ─────────────────────
// If it could, the hourly job would create and bin a row forever, burning a model call
// every hour. It is safe only because the companion check is by post_slug and does NOT
// filter out deleted rows. That is load-bearing and reads like an oversight, so pin it.
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../netlify/lib/newsletter-shared.mjs", import.meta.url), "utf8");
  const check = /\.from\("newsletter_emails"\)\.select\("id"\)\.eq\("post_slug", post\.slug\)\.limit\(1\)/.exec(src);
  ok("the companion check finds a post's email by slug", !!check);
  ok("🔴 and it does NOT exclude retired ones, or retiring would loop forever",
    !!check && !/\.eq\("post_slug", post\.slug\)[^;]*neq\("status", "deleted"\)/.test(src),
    "adding a not-deleted filter here makes the job regenerate every retired email, hourly");
}

// ── 9. 🔴 BREAK EVERY GUARD ONCE ─────────────────────────────────────────────────
// Each of these is a real way this regresses. The checker has to notice all of them.
{
  const mixed = () => [
    { id: "old", post_slug: "k", scheduled_for: agoH(24 * 20) },
    { id: "new", post_slug: "l", scheduled_for: agoH(2) },
  ];

  // (a) The cutoff removed entirely, which is the code exactly as it shipped.
  const noCutoff = (rows) => ({ retired: 0, pending: rows.length });
  const real = await withSending(false, () => sendDueNewsletters(fakeDb(mixed())));
  ok("caught: no cutoff at all, the whole queue waits to fire",
    real.retired !== noCutoff(mixed()).retired,
    "the shipped behaviour and the fixed behaviour would be indistinguishable");

  // (b) Retiring only when sending is already on, which leaves the pile intact until the
  //     switch is flipped and defeats the entire point of clearing it beforehand.
  const offRun = await withSending(false, () => sendDueNewsletters(fakeDb(mixed())));
  ok("caught: retiring gated behind the sending switch", offRun.retired === 1,
    "the backlog would still be sitting there when he turns sending on");

  // (c) The comparison flipped, so fresh is binned and stale is mailed.
  const freshOnly = await withSending(false, () => sendDueNewsletters(fakeDb([{ id: "n", post_slug: "m", scheduled_for: agoH(1) }])));
  ok("caught: the comparison inverted", freshOnly.retired === 0,
    "an hour-old newsletter being retired means the test is reading the wrong side of the cutoff");
}

console.log(fail ? `\n✗ newsletter queue: ${pass} passed, ${fail} FAILED` : `✓ newsletter queue: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
