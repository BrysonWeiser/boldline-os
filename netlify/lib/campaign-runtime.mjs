// How long a campaign has actually been running, and since when.
//
// Bryson, 2026-09-21: *"in the os with the ads can we also add when they started and how long
// they have been running for not only for my ads but also clients ads"*.
//
// 🔴 THE OBVIOUS ANSWER IS THE WRONG ONE. Both platforms hand us a start date: Google's
// `campaign.start_date` and Meta's `start_time`. Neither is when the campaign RAN. It is when
// the campaign was configured to be allowed to start. Every campaign the OS builds is created
// PAUSED on purpose and switched on later, sometimes weeks later, so that date is routinely
// wrong in the one direction that matters: it makes a campaign look older than it is.
//
// That number would be read as "this has had three weeks to work" when it has had two days, and
// judged on that. It would go into a client report. This codebase already settled the same
// question for contract start dates (`campaign-live.mjs`): SPEND IS THE PROOF, because money
// leaving the account is recorded by Google and Meta rather than by us, and it cannot happen
// without the campaign actually serving.
//
// 🔴 AND THE SECOND TRAP, WHICH IS WORSE. The day this ships, every campaign already running has
// been running for a while, and the first time this code sees one spending is NOT the day it
// started. Stamping "today" for those would tell him a campaign three months old is one day old,
// with total confidence, on the screen he uses to judge whether the ads are working.
//
// So a campaign is only credited with an EXACT start when the OS watched it cross over: seen at
// least once with no spend, then seen spending. Anything caught already spending is recorded as
// `exact: false` and must never be presented as an age. It says when we first saw it instead,
// which is true, and pairs it with the platform's configured date, which is also true. Two
// honest facts beat one confident guess.

const DAY = 864e5;

// Campaigns come from two platforms whose ids are unrelated, so the key carries both.
export const campKey = (platform, id) => `${platform}:${id}`;

// 🔴 A CAP, BECAUSE THIS MAP LIVES ON THE CLIENT RECORD AND IS READ ON EVERY LOAD. An account
// that churns through campaigns would otherwise grow it forever. Pruned oldest-first by when we
// last saw the campaign, so anything live or recent survives.
export const RUNTIME_CAP = 200;

// Fold this run's campaigns into what we already knew.
//
// `prev`  : the stored map, `{ "<platform>:<id>": { seenAt, since, exact, scheduled } }`
// `camps` : [{ platform, id, spend, startDate }] from this run, every campaign, paused included
// Returns a NEW map. Never mutates, never overwrites a `since` once set, never deletes a stamp
// for a campaign that is merely paused today.
export const foldFirstSpend = (prev, camps, nowIso = new Date().toISOString()) => {
  const out = { ...(prev && typeof prev === "object" ? prev : {}) };
  for (const c of (Array.isArray(camps) ? camps : [])) {
    if (!c || c.id == null || !c.platform) continue;
    const k = campKey(c.platform, c.id);
    const spent = Number(c.spend || 0) > 0;
    const was = out[k];
    if (!was) {
      // First sight. Spending already means we missed the crossover and cannot date it.
      out[k] = spent
        ? { seenAt: nowIso, since: nowIso, exact: false, ...(c.startDate ? { scheduled: c.startDate } : {}) }
        : { seenAt: nowIso, since: null, exact: false, ...(c.startDate ? { scheduled: c.startDate } : {}) };
      continue;
    }
    const next = { ...was, seenAt: nowIso };
    if (c.startDate) next.scheduled = c.startDate;
    // 🔴 THE ONE CASE THAT EARNS AN EXACT DATE: we saw it not spending, and now it is.
    if (spent && !was.since) { next.since = nowIso; next.exact = true; }
    out[k] = next;
  }
  return prune(out);
};

const prune = (map) => {
  const keys = Object.keys(map);
  if (keys.length <= RUNTIME_CAP) return map;
  const byOldest = keys.sort((a, b) =>
    new Date(map[a].seenAt || 0).getTime() - new Date(map[b].seenAt || 0).getTime());
  const out = { ...map };
  for (const k of byOldest.slice(0, keys.length - RUNTIME_CAP)) delete out[k];
  return out;
};

// Whole days INCLUSIVE of the first day, so a campaign that started this morning is on day 1
// rather than "0 days", which reads as though it has not started.
export const runningDays = (sinceIso, now = Date.now()) => {
  const t = new Date(sinceIso).getTime();
  if (!isFinite(t)) return null;
  const n = typeof now === "number" ? now : new Date(now).getTime();
  if (n < t) return null;
  return Math.floor((n - t) / DAY) + 1;
};

export const fmtDay = (d) => {
  const t = new Date(d).getTime();
  if (!isFinite(t)) return "";
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// How long, in the words that go on the screen.
//   exact  -> "Running 14 days, since Sep 7"
//   !exact -> "Running, first seen spending Sep 7" (+ the configured date when we have it)
//   never spent, configured in the future -> "Set to start Oct 1"
//   never spent -> "Has not spent yet"
export const runtimeLabel = (entry, now = Date.now()) => {
  const e = entry || {};
  const n = typeof now === "number" ? now : new Date(now).getTime();
  if (e.since) {
    if (e.exact) {
      const d = runningDays(e.since, n);
      return { text: `Running ${plural(d, "day")}, since ${fmtDay(e.since)}`, exact: true, days: d };
    }
    // 🔴 NO AGE HERE, EVER. We do not know when it started, only when we first saw it spending,
    // and a number of days would be a confident lie about the figure he judges the ads on.
    const sched = e.scheduled ? `, set to start ${fmtDay(e.scheduled)}` : "";
    return { text: `Running, first seen spending ${fmtDay(e.since)}${sched}`, exact: false, days: null };
  }
  if (e.scheduled) {
    const t = new Date(e.scheduled).getTime();
    if (isFinite(t) && t > n) return { text: `Set to start ${fmtDay(e.scheduled)}`, exact: false, days: null };
    return { text: `Has not spent yet, was set to start ${fmtDay(e.scheduled)}`, exact: false, days: null };
  }
  return { text: "Has not spent yet", exact: false, days: null };
};

// The account's own answer: the earliest campaign start we know of. An EXACT stamp always wins
// over an inexact one, however much older the inexact one looks, because "running 40 days" must
// never be derived from a date we only know we noticed.
export const accountRuntime = (map, now = Date.now()) => {
  const entries = Object.values(map && typeof map === "object" ? map : {}).filter((e) => e && e.since);
  if (!entries.length) return { text: "No campaign has spent yet", exact: false, days: null, since: null };
  const exact = entries.filter((e) => e.exact);
  const pool = exact.length ? exact : entries;
  const first = pool.reduce((a, b) => (new Date(a.since) <= new Date(b.since) ? a : b));
  const label = runtimeLabel({ ...first, scheduled: null }, now);
  return { ...label, since: first.since };
};
