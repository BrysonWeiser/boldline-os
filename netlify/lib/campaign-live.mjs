// WHEN THE TERM ACTUALLY STARTS, DECIDED BY THE AD PLATFORMS RATHER THAN BY A GUESS.
//
// Bryson, 2026-09-17, after working out that a fixed start date in a signed agreement cannot
// be moved without an amendment: *"yea do that"*, on making the contract define the start date
// as the day the ads go live and having the OS record that day on its own.
//
// 🔴 THE PROBLEM THIS ENDS. A contract was signed with a date somebody guessed, usually a week
// or two out, chosen before anyone knew when the client would hand over their ad account. Every
// slip then cost a written amendment, because the signed PDF is frozen and the date in it is an
// operative term. It happened to Sebastian, who was given the concession that his term starts
// the day the ads switch on, and it was about to happen to Air Suds. Twice is a pattern.
//
// Under terms v5 the agreement says the Start Date IS the day the first campaign begins
// delivering. A slip is then the agreement working as written, not a change to it, and there is
// nothing to amend and nothing to re-sign.
//
// 🔴 SPEND IS THE PROOF, NOT OUR OWN BUTTON. A campaign can be switched on and sit in review
// for a day delivering nothing, and a campaign can be started by hand in Ads Manager where our
// button never ran. Money leaving the client's ad account is the one signal that is
// unambiguous, is recorded by Meta and Google rather than by us, and matches what the client
// was told the date would mean. `ads-sync` already pulls it every run.

// The terms version that defines the Start Date by the go-live event. Anything earlier names a
// fixed date in the signed document.
export const TERMS_EVENT_START = 5;

// 🔴 AND NOT WHEN THE DATE IS A PROMISE RATHER THAN AN ESTIMATE. `startDateFirm` means both
// sides agreed a specific day, and the agreement prints it as agreed. Moving it because the
// launch happened to land elsewhere would rewrite a term the client accepted, which is the same
// wrong as rewriting an older client's fixed date.
export const usesEventStart = (cl) =>
  Number((cl || {}).contractTermsVersion || 0) >= TERMS_EVENT_START && !(cl || {}).startDateFirm;

// The date format the contract and the OS both already use, so a stamped date is
// indistinguishable from one Bryson typed.
export const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// 🔴 THE END DATE MOVES WITH THE START, BY THE SAME NUMBER OF DAYS. Recomputing it from the
// committed term would quietly overwrite a term somebody set by hand for a reason. Same rule as
// `reslotTerm` in the OS edit sheet, and a test pins the two to each other.
export function shiftEnd(prevStart, nextStart, prevEnd) {
  const ns = new Date(nextStart), ps = new Date(prevStart), pe = new Date(prevEnd);
  if (isNaN(ns) || isNaN(ps) || isNaN(pe)) return "";
  const span = Math.round((pe - ps) / 864e5);
  if (!(span > 0)) return "";
  const out = new Date(ns);
  out.setDate(out.getDate() + span);
  return fmtDate(out);
}

// Has any money actually moved through this client's ad accounts?
//
// 🔴 Read from the TOTALS the sync just wrote, which come straight from Google's and Meta's own
// reporting. A campaign merely marked live is not enough: that is true the moment a switch is
// flipped, including while it sits in review spending nothing, and starting a client's term on
// a day nothing ran is the same unfairness as guessing the date in the first place.
export const hasSpent = (adPerf) => Number(((adPerf || {}).totals || {}).spend30d || 0) > 0;

// The whole decision, as data.
//
//   { patch, note }   patch is what to merge onto the client (null = nothing to do),
//                     note is a line for the client's history (empty = say nothing).
//
// Called on every sync, so the overwhelmingly common answer is "nothing to do".
export function goLiveDecision(client, adPerf, now = new Date()) {
  const cl = client || {};
  const none = { patch: null, note: "" };

  if (cl.internal) return none;                 // the house account has no term to start
  if (cl.campaignLiveAt) return none;           // 🔴 stamped once, never re-stamped
  if (!hasSpent(adPerf)) return none;           // nothing has run yet

  const at = now instanceof Date ? now : new Date(now);
  const on = fmtDate(at);
  const patch = { campaignLiveAt: at.toISOString() };

  // 🔴 THE DATE IS ONLY MOVED FOR A CLIENT WHOSE AGREEMENT SAYS IT SHOULD BE.
  //
  // A client signed under v4 or earlier has a FIXED date printed in their signed PDF. Quietly
  // rewriting their start date here would recreate, automatically and at scale, exactly the
  // drift that was just fixed: the OS saying one thing and the document they signed saying
  // another. Their go-live is still recorded, because it is worth knowing, and Bryson is told
  // so he can decide whether an amendment is worth it.
  if (!usesEventStart(cl)) {
    return {
      patch,
      note: `Ads started delivering on ${on}. Their agreement names a fixed start date, so nothing was changed. Move it only by written amendment.`,

    };
  }

  // Already correct to the day. Record the go-live, leave the dates alone.
  if (cl.contractStart && fmtDate(cl.contractStart) === on) {
    return { patch, note: `Ads started delivering on ${on}, which is the start date already on record.` };
  }

  const nextEnd = shiftEnd(cl.contractStart, at, cl.contractEnd);
  return {
    patch: {
      ...patch,
      contractStart: on,
      ...(nextEnd ? { contractEnd: nextEnd } : {}),
    },
    note: `Ads started delivering on ${on}, so the term now runs from then`
      + (nextEnd ? ` to ${nextEnd}.` : ".")
      + " Their agreement defines the start date this way, so there is nothing to re-sign. Tell them the dates.",
  };
}
