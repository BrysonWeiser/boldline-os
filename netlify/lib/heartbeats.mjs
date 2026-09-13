// How long a stored reading may sit before it means the job behind it stopped.
//
// 🔴 A STOPPED JOB LOOKS EXACTLY LIKE A QUIET WEEK. Every background job here writes a
// timestamp when it succeeds, and that timestamp is the only difference between "nothing
// happened" and "nothing is running". These live in one place because two copies of the
// same threshold drift, and the day they disagree is the day one watcher says everything is
// fine while the other is already alarming.

export const STALE_HOURS = {
  adPerf: 8,     // the hourly ad-figures sync
  leads: 2,      // the 15-minute website-lead mirror onto the house account
};

export const hoursSince = (iso, nowMs = Date.now()) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? (nowMs - t) / 3.6e6 : null;
};

// ── The lead mirror's heartbeat ──────────────────────────────────────────────
//
// 🔴 WHY THIS IS NOT JUDGED BY THE JOB THAT FAILED. On 2026-09-12 at 11pm the 15-minute
// mirror hit one Gateway Timeout reading the client list and sent Bryson a red alert on the
// spot. Supabase was fine a minute later. That is a blip, not an outage, and a job that
// pages on its own first bad run pages up to 96 times a day when the blip lasts. The
// codebase already wrote this lesson down once, next to the clock-skew retry in
// report-shared: "96 red alerts a day from a 15-minute job, which is how a notification
// channel gets muted and then swallows the alert it exists to deliver."
//
// So the failing job now stays quiet and simply does not update its heartbeat, and THIS is
// judged from the outside by a different job that is still working. A blip is invisible. A
// mirror that has genuinely stopped goes past two hours and is said once.
//
// Returns { alert, clear }: `alert` means say something now, `clear` means it recovered and
// the flag should be dropped so a FUTURE stall can alert again. Without `clear` this fires
// once ever and then never again, which is worse than not having it.
export const leadMirrorState = (house, { now = Date.now(), staleHours = STALE_HOURS.leads } = {}) => {
  const cl = (house && house.data) || {};
  const at = cl.leadSync && cl.leadSync.at;
  const flagged = !!cl.leadMirrorAlertedAt;
  const none = { alert: false, clear: false, hours: null };

  // Never run at all. That is a different fault with a different fix (the schedule was never
  // added, or the house account was only just created), and guessing between them here would
  // mean alerting forever on a brand-new install.
  if (!at) return { ...none, why: "the lead mirror has no heartbeat yet, so there is nothing to judge" };
  const hours = hoursSince(at, now);
  if (hours == null) return { ...none, why: "the heartbeat is not a readable time" };

  if (hours > staleHours) {
    return { alert: !flagged, clear: false, hours,
      why: `the lead mirror last ran ${hours.toFixed(1)}h ago and it runs every 15 minutes` };
  }
  return { alert: false, clear: flagged, hours, why: `last ran ${hours.toFixed(1)}h ago` };
};
