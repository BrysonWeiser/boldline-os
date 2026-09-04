// Re-send a lead to the client's own system when the first send did not get through.
//
// Bryson told Shaun Smith, 2026-09-03, pushing back on his request to have the visitor's
// browser post straight to Sebastian's site as a second path:
//
//   *"What I'd suggest instead is I make my relay retry harder and queue anything that
//   doesn't get through, so a blip on my side delays a lead rather than losing it."*
//
// That was a promise made to a partner, so it exists. Until now the intake tried twice, in
// the same breath, while the visitor watched a Sending button; if both failed the lead sat in
// the OS with a failure stamped on it and NOTHING EVER TRIED AGAIN. Shaun's worry was real.
// His fix was the wrong shape (an unsigned public endpoint that a browser cannot reach when
// the browser is the thing that died); this is the right one.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 FOUR RULES, AND THE FIRST IS THE ONE THAT WOULD DO REAL DAMAGE.
//
// 1. ONLY LEADS THAT WERE ATTEMPTED AND FAILED. A lead with no `crm` record at all was never
//    attempted, because no CRM was configured when it arrived. Sweeping those would mean the
//    day a client finally connects their CRM, every lead they have ever received floods into
//    their pipeline at once, months of it, looking to them like our software went haywire.
//    The presence of `crm.ok === false` is the whole gate.
//
// 2. NEVER TWICE. `alreadyForwarded` (their system holds the record) plus the stable dedupe
//    key their endpoint sees. A duplicate in somebody's sales pipeline is worse than a late
//    lead, which is the rule the original forward was built on and this must not weaken.
//
// 3. GIVE UP, BUT NEVER SILENTLY. Retrying forever is noise nobody reads. Dropping a paying
//    customer's lead without a word is worse. So the tries are capped and the cap raises an
//    alert naming the client and the reason.
//
// 4. SPACED OUT, NOT HAMMERED. A CRM that is down is usually down for a while. Backing off
//    covers an overnight outage in eight attempts instead of nine hundred.
//
// 🔴 AND THE SCHEDULER IS BEST EFFORT. Netlify has skipped a scheduled run by two and a half
// hours with no error (see KB `house-leads`), so nothing here may assume it runs on time.
// Every decision is made from timestamps ON THE LEAD rather than from "this run is N minutes
// after the last", so a skipped sweep delays a retry and breaks nothing.

import { forwardLead, alreadyForwarded, crmTarget } from "./crm-forward.mjs";

// Eight attempts spread over roughly a day and a quarter. Long enough to ride out an
// overnight outage or a certificate that expired on a Friday, short enough that a lead is
// never "maybe still coming" a week later.
export const CRM_RETRY_DELAYS_MS = [
  5 * 60 * 1000,        // 5 minutes  — a blip
  15 * 60 * 1000,       // 20 minutes
  30 * 60 * 1000,       // 50 minutes
  60 * 60 * 1000,       // ~2 hours
  2 * 60 * 60 * 1000,   // ~4 hours
  4 * 60 * 60 * 1000,   // ~8 hours
  8 * 60 * 60 * 1000,   // ~16 hours   — covers a night
  12 * 60 * 60 * 1000,  // ~28 hours   — covers a night and the next morning
];
export const CRM_RETRY_MAX_TRIES = CRM_RETRY_DELAYS_MS.length;

// How long to wait after the Nth failed sweep. Past the end of the list there is no next
// attempt, which is what `gaveUp` records.
export const retryDelayMs = (tries) => {
  const i = Math.max(0, Math.floor(Number(tries) || 0));
  return i >= CRM_RETRY_DELAYS_MS.length ? null : CRM_RETRY_DELAYS_MS[i];
};

// 🔴 A configuration error is not an outage and must not be treated like one. A 401 or 403
// means the shared secret is wrong, and no amount of waiting fixes that: somebody has to
// change it. It is still retried (the moment the secret is corrected the queued leads go),
// but it is reported the FIRST time rather than a day later when the cap is reached, because
// a day is long enough to lose the customer the lead was.
export const needsAHuman = (crm) => {
  const s = Number((crm || {}).status);
  return s === 401 || s === 403;
};

// Is this lead due for another go right now?
//
// 🔴 EVERY CLAUSE HERE IS A SEPARATE WAY TO CAUSE HARM, so they are written out rather than
// collapsed into one expression.
export function dueForRetry(lead, now = Date.now()) {
  const l = lead || {};
  const crm = l.crm;
  if (!crm) return false;                       // never attempted: see rule 1
  if (crm.ok) return false;                     // already delivered
  if (crm.gaveUp) return false;                 // finished, and already reported
  const tries = Number(crm.tries) || 0;
  // 🔴 THE CAP AND THE WAIT ARE THE SAME QUESTION, ASKED ONCE. An earlier version also tested
  // `tries >= CRM_RETRY_MAX_TRIES` here, which read as belt and braces and was neither: the
  // cap IS the length of the delay list, so the two could never disagree, and the duplicate
  // meant deleting either one changed nothing and no test could tell. One gate, one meaning.
  const wait = retryDelayMs(tries);
  if (wait == null) return false;               // out of attempts
  const last = Date.parse(String(crm.at || ""));
  // A lead with an unreadable timestamp is retried rather than stranded: the cap still holds,
  // so the worst case is eight attempts slightly sooner than intended.
  if (!Number.isFinite(last)) return true;
  return now - last >= wait;
}

// What the lead's `crm` record becomes after one more go. Pure, so the arithmetic can be
// tested without a network or a database.
export function nextCrmState(prev, result, now = new Date()) {
  const tries = (Number((prev || {}).tries) || 0) + 1;
  const at = now instanceof Date ? now.toISOString() : String(now);
  if (result && result.ok) {
    // 🔴 The success record keeps the history. "Delivered, eventually, after four tries" is a
    // different fact from "delivered", and it is the one that says a client's endpoint is
    // flaky while still working.
    return { ...result, tries, retried: true, at: result.at || at };
  }
  const gaveUp = tries >= CRM_RETRY_MAX_TRIES;
  return { ...(result || {}), ok: false, tries, retried: true, at: result && result.at ? result.at : at, ...(gaveUp ? { gaveUp: true } : {}) };
}

// One client's backlog. Returns what changed and what is worth telling Bryson, and writes
// nothing itself: the caller owns the database, which keeps this testable with plain objects.
//
// `max` stops one client with a thousand stuck leads from eating the whole run and starving
// every other client's single stuck lead.
export async function sweepClientLeads(client, { now = Date.now(), max = 25, forward = forwardLead } = {}) {
  const c = client || {};
  const log = Array.isArray(c.leadsLog) ? c.leadsLog.slice() : [];
  const out = { changed: false, leadsLog: log, sent: 0, failed: 0, gaveUp: 0, needsAHuman: false, lastError: "" };
  if (!crmTarget(c)) return out;                // nothing configured: nothing to retry into

  let done = 0;
  for (let i = 0; i < log.length && done < max; i++) {
    const lead = log[i];
    if (!dueForRetry(lead, now)) continue;
    if (alreadyForwarded(lead)) continue;       // belt and braces against rule 2
    done++;
    let result;
    try {
      result = await forward(c, lead, { now: new Date(now).toISOString() });
    } catch (e) {
      result = { ok: false, error: String((e && e.message) || e).slice(0, 200) };
    }
    // `forwardLead` answers null when there is nothing to do. Treat that as "leave it alone"
    // rather than as a failure, or a lead it deliberately skipped would burn a try.
    if (!result) continue;
    const crm = nextCrmState(lead.crm, result, new Date(now));
    log[i] = { ...lead, crm };
    out.changed = true;
    if (crm.ok) out.sent++;
    else {
      out.failed++;
      out.lastError = crm.error || (crm.status ? `their system answered ${crm.status}` : "no answer");
      if (crm.gaveUp) out.gaveUp++;
      // Reported on the FIRST failed sweep, not at the cap: a wrong password is a job for a
      // person and a day of silent retries is a day of lost leads.
      if (needsAHuman(crm) && crm.tries === 1) out.needsAHuman = true;
    }
  }
  return out;
}
