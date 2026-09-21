// Working a cold list: what an attempt was, when to try again, and what the numbers mean.
//
// Bryson, 2026-09-21: *"what if we build a cold outreach section in the os and it is completely
// tailored to doing cold outreach"*, then *"build everything but what you flagged we shouldnt do"*.
//
// Lead Scout already FINDS prospects, scores them and keeps a list. This is the other half:
// working that list. A card list with a status dropdown is not a workflow, and nobody makes sixty
// dials a day off one. What a caller needs is no decisions between calls: one prospect, one tap,
// next prospect.
//
// 🔴 EVERY RULE IN HERE IS PURE AND LIVES IN ONE FILE ON PURPOSE. The queue, the counters and the
// screen all have to agree about what "a conversation" is and who is due today. Three copies of
// that arithmetic is three different numbers on three screens.

const DAY = 864e5;

// ── What happened on an attempt ───────────────────────────────────────────────
//
// 🔴 `reached` IS NOT THE SAME AS `answered`. A gatekeeper picking up is a human conversation and
// counts as one, because the dials-to-conversations ratio is how you tell a bad LIST from a bad
// SCRIPT. A voicemail is not a conversation however long you talked.
//
// `ends` takes the prospect out of the working queue for good. `blocks` is stronger: it also makes
// them permanently uncontactable, which is a legal obligation and not a preference.
export const OUTCOMES = [
  { id: "no_answer",      label: "No answer",         channels: ["call"],                    reached: false, nextDays: 2 },
  { id: "voicemail",      label: "Left a voicemail",  channels: ["call"],                    reached: false, nextDays: 3 },
  { id: "gatekeeper",     label: "Gatekeeper",        channels: ["call"],                    reached: true,  nextDays: 2 },
  { id: "bad_number",     label: "Wrong/bad number",  channels: ["call"],                    reached: false, ends: true },
  { id: "no_reply",       label: "No reply",          channels: ["email", "dm", "text"],     reached: false, nextDays: 3 },
  { id: "replied",        label: "They replied",      channels: ["email", "dm", "text"],     reached: true,  nextDays: 2 },
  { id: "callback",       label: "Call back later",   channels: ["call", "email", "dm", "text"], reached: true, needsWhen: true },
  { id: "not_interested", label: "Not interested",    channels: ["call", "email", "dm", "text"], reached: true, ends: true },
  { id: "booked",         label: "Booked a meeting",  channels: ["call", "email", "dm", "text"], reached: true, needsWhen: true, books: true, ends: true },
  // 🔴 THE ONE THAT IS NOT A PREFERENCE. "Take me off your list" is a legal instruction, so it is
  // an outcome with teeth rather than a note somebody might read. See `isBlocked` below.
  { id: "do_not_contact", label: "Do not contact",    channels: ["call", "email", "dm", "text"], reached: true, ends: true, blocks: true },
];

export const CHANNELS = [
  { id: "call",  label: "Call" },
  { id: "email", label: "Email" },
  { id: "dm",    label: "DM" },
  { id: "text",  label: "Text" },
];

export const outcomeById = (id) => OUTCOMES.find((o) => o.id === id) || null;
export const outcomesFor = (channel) => OUTCOMES.filter((o) => o.channels.includes(channel));

// ── The cadence ───────────────────────────────────────────────────────────────
//
// 🔴 THE MEETINGS ARE IN THE FOLLOW-UPS. Almost nobody books on attempt one, and the single most
// common way a cold list is wasted is calling everyone once and moving on. The gaps widen on
// purpose: chasing daily reads as pestering, and a gap longer than a fortnight means they have
// forgotten the first call ever happened.
//
// After the last step a prospect leaves the queue rather than looping forever, because a list you
// never finish is a list you never replace.
export const CADENCE_DAYS = [2, 3, 5, 7, 14];
export const MAX_STEPS = CADENCE_DAYS.length + 1;   // the first attempt, then one per gap

// When to come back, given what just happened. Returns null when they are done.
//
// `when` is the time THEY named on a callback or a booking, and it always wins: a cadence gap is a
// guess and a time the prospect gave you is a fact.
export const nextDueAt = ({ outcome, step = 1, at = Date.now(), when = null }) => {
  const o = outcomeById(outcome);
  if (!o || o.ends) return null;
  if (o.needsWhen) {
    const t = when ? new Date(when).getTime() : NaN;
    if (isFinite(t)) return new Date(t).toISOString();
    // No time given on a callback still deserves a try rather than a silent drop.
    return new Date(nowMs(at) + (o.nextDays || 2) * DAY).toISOString();
  }
  if (step >= MAX_STEPS) return null;
  // The gap for the step just completed. Step 1 uses the first gap, and so on.
  const gap = CADENCE_DAYS[Math.min(step, CADENCE_DAYS.length) - 1] || o.nextDays || 2;
  return new Date(nowMs(at) + Math.max(gap, o.nextDays || 0) * DAY).toISOString();
};

const nowMs = (at) => (typeof at === "number" ? at : new Date(at).getTime());

// The whole state change one attempt makes to a prospect. One function so the endpoint, the queue
// and any future importer cannot disagree about it.
export const applyTouch = (prospect, touch, at = Date.now()) => {
  const p = prospect || {};
  const o = outcomeById(touch && touch.outcome);
  if (!o) return { error: "unknown outcome" };
  const step = Number(p.step || 0) + 1;
  const iso = new Date(nowMs(at)).toISOString();
  const due = nextDueAt({ outcome: o.id, step, at, when: touch.when });
  const patch = {
    step,
    last_touch_at: iso,
    next_due_at: due,
    updated_at: iso,
  };
  // 🔴 A BLOCK IS PERMANENT AND IS NEVER IMPLIED BY A STATUS. Status is a sales stage somebody can
  // change back with a dropdown; this is a separate field precisely so that cannot happen.
  if (o.blocks) patch.blocked_at = iso;
  if (o.books && touch.when) patch.meeting_at = new Date(touch.when).toISOString();
  // Status follows the outcome, but only ever forwards to a more advanced stage.
  if (o.books) patch.status = "meeting";
  else if (o.blocks || o.id === "not_interested" || o.id === "bad_number") patch.status = "dead";
  else if (p.status === "new") patch.status = "contacted";
  return { patch, step, dueAt: due };
};

// ── Who may be contacted at all ───────────────────────────────────────────────
//
// 🔴 ONE FUNCTION, ASKED EVERYWHERE. A prospect who asked not to be contacted must be impossible to
// surface, not merely unlikely to appear. Bryson will hand this list to a setter, and "please
// remember not to call that one" is not a control.
export const isBlocked = (p) => !!(p && p.blocked_at);

// Everything due on or before `now`, best prospect first. Blocked rows can never appear.
export const dueQueue = (prospects, now = Date.now()) => {
  const n = nowMs(now);
  return (Array.isArray(prospects) ? prospects : [])
    .filter((p) => p && !isBlocked(p))
    .filter((p) => {
      if (!p.next_due_at) return Number(p.step || 0) === 0;   // never touched: due immediately
      return new Date(p.next_due_at).getTime() <= n;
    })
    .sort((a, b) => {
      // A time the prospect named outranks everything: missing a callback they asked for is the
      // one failure that loses a warm prospect.
      const aw = a.meeting_at || (Number(a.step || 0) > 0 ? a.next_due_at : null);
      const bw = b.meeting_at || (Number(b.step || 0) > 0 ? b.next_due_at : null);
      if (aw && !bw) return -1;
      if (bw && !aw) return 1;
      if (aw && bw && aw !== bw) return new Date(aw) - new Date(bw);
      return Number(b.score || 0) - Number(a.score || 0);
    });
};

// ── The numbers ───────────────────────────────────────────────────────────────
//
// 🔴 MEETINGS THAT SHOWED UP IS THE ONLY ONE THAT CANNOT BE GAMED, and it is what a setter would be
// paid on. A booking is a promise; a person on the call is the result. They are counted separately
// and a booking is never quietly counted as a show.
export const rollup = (touches, { now = Date.now() } = {}) => {
  const list = (Array.isArray(touches) ? touches : []).filter(Boolean);
  const attempts = list.length;
  const reached = list.filter((t) => { const o = outcomeById(t.outcome); return o && o.reached; }).length;
  const booked = list.filter((t) => { const o = outcomeById(t.outcome); return o && o.books; });
  const showed = booked.filter((t) => t.showed === true).length;
  const noShowed = booked.filter((t) => t.showed === false).length;
  return {
    attempts,
    conversations: reached,
    booked: booked.length,
    showed,
    noShowed,
    // Awaiting a verdict: booked, the time has passed, and nobody has said either way yet.
    pendingShow: booked.filter((t) => t.showed == null
      && t.meeting_at && new Date(t.meeting_at).getTime() <= nowMs(now)).length,
    // null, never 0, so "we have not made a call yet" cannot read as "nobody ever answers".
    convRate: attempts > 0 ? reached / attempts : null,
    bookRate: reached > 0 ? booked.length / reached : null,
    showRate: (showed + noShowed) > 0 ? showed / (showed + noShowed) : null,
  };
};

// Counted per channel too, because "cold outreach isn't working" is usually one channel dragging
// the average down and the average hides it.
export const rollupByChannel = (touches, opts) => {
  const out = {};
  for (const c of CHANNELS) {
    out[c.id] = rollup((touches || []).filter((t) => t && t.channel === c.id), opts);
  }
  return out;
};
