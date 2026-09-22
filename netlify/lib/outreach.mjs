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

import { dedupeKeyFor, normDomain } from "./scout-shared.mjs";

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

// ── Adding a company by hand ──────────────────────────────────────────────────
//
// Lead Scout finds businesses. This is the other door in: a referral, a name off the side of a van,
// somebody who said "call me next quarter". Without it the only way to work one specific company is
// to run a whole search and hope it turns up, which nobody does, so the referral never gets called.
//
// 🔴 A TYPED ROW MUST BE INDISTINGUISHABLE FROM A FOUND ONE ONCE IT LANDS, because the queue, the
// cadence, the counters and the do-not-contact guard all read the same columns. So this builds the
// SAME row shape the scout writes and, above all, the SAME dedupe key: a key computed any other way
// would let one company sit in the list twice, once found and once typed, and the second copy gets
// called by somebody who has no idea the first already said no.
export const MANUAL_SOURCE = "manual";
export const isManual = (p) => !!(p && p.data && p.data.source === MANUAL_SOURCE);

// A phone number is stored as digits and shown back in a readable shape. Anything under ten digits
// is a typo rather than a number, and saying so beats saving a row that can never be dialled.
export const cleanPhone = (s) => {
  const raw = String(s || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  return (/^\+/.test(raw) && digits.length > 10 ? "+" : "") + digits;
};

export const prettyPhone = (s) => {
  const v = cleanPhone(s);
  if (!v) return "";
  const d = v.replace(/[^0-9]/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return v;
};

export const cleanEmail = (s) => {
  const v = String(s || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : "";
};

// Returns { row, dedupeKey } to insert, or { error } in words worth reading on a phone.
//
// 🔴 AT LEAST ONE WAY TO REACH THEM IS REQUIRED. A name with nothing attached is a row that reaches
// the top of the queue, cannot be actioned, and gets skipped every morning forever.
export const buildManualProspect = (input = {}, { at = Date.now() } = {}) => {
  const name = String(input.name || "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Add the company name." };
  if (name.length > 120) return { error: "That company name is too long." };

  const rawPhone = String(input.phone || "").trim();
  const phone = cleanPhone(rawPhone);
  if (rawPhone && !phone) return { error: "That phone number doesn't look right. Use the full number including the area code." };

  const rawEmail = String(input.email || "").trim();
  const email = cleanEmail(rawEmail);
  if (rawEmail && !email) return { error: "That email address doesn't look right." };

  const website = normDomain(input.website);
  if (String(input.website || "").trim() && !website) return { error: "That website doesn't look right. Something like example.com." };

  if (!phone && !email && !website) {
    return { error: "Add a phone number, an email or a website, otherwise there is no way to reach them." };
  }

  const city  = String(input.city  || "").trim().replace(/\s+/g, " ");
  const niche = String(input.niche || "").trim().replace(/\s+/g, " ");
  const owner = String(input.ownerName || "").trim().replace(/\s+/g, " ");
  const notes = String(input.notes || "").trim().slice(0, 2000);

  const dedupeKey = dedupeKeyFor({ name, city });
  if (!dedupeKey) return { error: "Add the company name." };

  const iso = new Date(nowMs(at)).toISOString();
  return {
    dedupeKey,
    row: {
      run_id: null,                       // no search found it, and the column is deliberately loose
      dedupe_key: dedupeKey,
      name,
      domain: website || null,
      niche: niche || null,
      area: city || null,
      // 🔴 SCORE STAYS 0 AND THAT IS NOT A JUDGEMENT. The scout's score is the product of real
      // research; inventing one here would put a made-up number beside a researched one and make
      // both meaningless. Ordering handles it instead: see `dueQueue`, where a typed row goes first
      // BECAUSE it was typed. Anything showing a score must check `isManual` and say so.
      score: 0,
      tier: null,
      status: "new",
      notes: notes || null,
      data: {
        source: MANUAL_SOURCE,
        name,
        city: city || "",
        website: website || "",
        ownerName: owner || "",
        phones: phone ? [{ number: prettyPhone(phone), whose: owner ? "owner" : "main", kind: "main" }] : [],
        emails: email ? [{ address: email, whose: owner ? "owner" : "main" }] : [],
        addedAt: iso,
      },
      updated_at: iso,
    },
  };
};

// ── Who is likely to pick up each number ─────────────────────────────────────
//
// Bryson, 2026-09-22, an hour before his first calls: *"can you make it so itll label the phone
// numbers it shows such as a business owner or if its likely to be a gatekeeper etc"*. On a screen
// built for speed, three numbers with no guidance is three decisions per prospect, and the whole
// point of the queue is that there are none.
//
// 🔴 EVERY LABEL IS A LIKELIHOOD AND SAYS SO. The scout tags `whose` and `kind` from research, not
// from certainty, so a chip reading "Owner" would be an assertion this data cannot support — and
// the expensive version of that mistake already happened once on this project, when an audit told a
// roofing company it had no contact form. So: "Likely the owner", and where there is no signal at
// all the honest answer is "Unknown", never a guess dressed as a fact.
//
// 🔴 HEADCOUNT IS THE STRONGEST SIGNAL AND IT IS NOT ON THE PHONE. At a three-person pool builder
// the "main line" IS the owner's phone. At a forty-person one it is a receptionist whose job is to
// stop this call. The same `kind: "main"` therefore means opposite things, so the size of the
// business decides.
export const PHONE_ROLES = {
  owner_mobile: { id: "owner_mobile", label: "Likely owner's mobile", tone: "best",
    hint: "Best shot on the list. A mobile is answered by a person, not a desk." },
  owner_line:   { id: "owner_line",   label: "Likely the owner",       tone: "best",
    hint: "Research says this one reaches the owner directly." },
  mobile:       { id: "mobile",       label: "Mobile",                 tone: "good",
    hint: "Whoever owns this answers it themselves. Worth trying before the main line." },
  direct:       { id: "direct",       label: "Direct line",            tone: "good",
    hint: "A desk line that skips whoever answers the main number." },
  small_main:   { id: "small_main",   label: "Main line, small shop",  tone: "good",
    hint: "At this size the main line usually IS the owner. Expect him to answer it himself." },
  main:         { id: "main",         label: "Main line",              tone: "plain",
    hint: "Expect to be screened. Ask who does their estimates rather than for the owner." },
  toll_free:    { id: "toll_free",    label: "Toll-free line",         tone: "plain",
    hint: "Usually routes to whoever is on duty. Least likely to reach a decision maker." },
  unknown:      { id: "unknown",      label: "Unknown",                tone: "plain",
    hint: "No idea who picks this up. Still worth a try." },
};

// Best bet first, so the first chip on the card is the one to ring.
const ROLE_RANK = ["owner_mobile", "owner_line", "mobile", "direct", "small_main", "main", "toll_free", "unknown"];

// Headcount from whatever the scout managed to learn. Free text like "2-6 (estimate)" is common, so
// the numbers are read out of it and the LARGEST is taken: claiming "small shop" is a claim, and it
// should only be made when even the top of the range is small.
export const headcount = (prospect) => {
  const d = (prospect && prospect.data) || prospect || {};
  const n = Math.max(0, Math.round(Number(d.employeesEstimate) || 0));
  if (n > 0) return n;
  const nums = String(d.employees || "").match(/\d+/g);
  if (!nums || !nums.length) return null;
  return Math.max(...nums.map(Number));
};

export const SMALL_SHOP_MAX = 10;

export const phoneRole = (phone, prospect) => {
  const p = phone || {};
  const kind = String(p.kind || "unknown");
  const whose = String(p.whose || "unknown");
  const isMobile = kind === "mobile";
  // A label the researcher wrote can override a generic kind: "front desk" is a gatekeeper however
  // the row was tagged.
  const desk = /reception|front desk|switchboard|answering service/i.test(String(p.label || ""));

  if (whose === "owner" && isMobile) return PHONE_ROLES.owner_mobile;
  if (whose === "owner" && !desk)    return PHONE_ROLES.owner_line;
  if (isMobile)                      return PHONE_ROLES.mobile;
  if (kind === "direct" && !desk)    return PHONE_ROLES.direct;
  if (kind === "toll_free")          return PHONE_ROLES.toll_free;
  if (kind === "main" || kind === "secondary" || desk) {
    const n = headcount(prospect);
    return (n !== null && n > 0 && n <= SMALL_SHOP_MAX && !desk) ? PHONE_ROLES.small_main : PHONE_ROLES.main;
  }
  return PHONE_ROLES.unknown;
};

// Every number on a prospect, labelled and ordered best-bet first. A stable sort, so two numbers
// with the same role keep the order the research put them in.
export const rankPhones = (prospect) => {
  const list = (prospect && prospect.data && Array.isArray(prospect.data.phones)) ? prospect.data.phones : [];
  return list
    .map((p, i) => ({ ...p, i, role: phoneRole(p, prospect) }))
    .sort((a, b) => (ROLE_RANK.indexOf(a.role.id) - ROLE_RANK.indexOf(b.role.id)) || (a.i - b.i))
    .map(({ i, ...rest }) => rest);
};

// ── What to hit THIS company with ────────────────────────────────────────────
//
// Bryson, 2026-09-22: *"can you add in something that could be a pain point i can hit that is for
// each specific company that is listed"*. A script is the same words for everyone; this is the one
// sentence that is only true about the business whose number is on the screen.
//
// 🔴 NEVER ASSERT A NEGATIVE FROM MISSING EVIDENCE. This is the rule this project learned the
// expensive way, when an audit told a roofing company it had no contact form and one was sitting on
// their homepage. The scout's ad fields are deliberately four-valued — "yes", "likely", "no",
// "unknown" — and "no" is only returned when the model ACTIVELY SEARCHED and saw nothing. So a
// claim is only ever built from "yes"/"no", never from "unknown", and anything unconfirmed becomes
// a QUESTION TO ASK rather than a statement to be wrong about. On a cold call that is stronger
// anyway: a question he cannot be caught out on opens the conversation, a wrong claim ends it.
//
// Every point carries the words to say AND the question that follows, because naming a problem
// without the next move is half a feature.
const yearsTrading = (prospect, now = Date.now()) => {
  const d = (prospect && prospect.data) || prospect || {};
  const t = String(d.yearsInBusiness || "");
  const yr = /(?:since|est\.?|founded)\D{0,4}(\d{4})/i.exec(t);
  if (yr) return Math.max(0, new Date(nowMs(now)).getUTCFullYear() - Number(yr[1]));
  const n = /(\d+)\s*(?:\+)?\s*year/i.exec(t);
  return n ? Number(n[1]) : null;
};

const WEAK_SITE = ["none", "poor", "dated"];

export const painPoints = (prospect, { now = Date.now() } = {}) => {
  const d = (prospect && prospect.data) || {};
  const out = [];
  const g = String(d.googleAds || "unknown");
  const site = String(d.websiteQuality || "unknown");
  const rating = Number(d.rating) || 0;
  const reviews = Math.max(0, Math.round(Number(d.reviewCount) || 0));
  const years = yearsTrading(prospect, now);
  const weakSite = WEAK_SITE.includes(site);
  const advertising = g === "yes";

  // Strongest first. Someone set this up and walked away, which means budget once existed.
  if (g === "likely") out.push({ id: "tag_no_campaign", strength: 1,
    line: "Their site has ad tracking on it but no paid results are showing, so somebody set this up and it stopped.",
    ask: "Were you running Google ads at some point? What happened with it?" });

  if (g === "no") out.push({ id: "not_advertising", strength: 2,
    line: "Nobody is bidding on their service in their own city, so every job they get is one that found them first.",
    ask: "Right now is it all word of mouth and repeat, or are you running anything paid?" });

  if (advertising && weakSite) out.push({ id: "paying_for_weak_page", strength: 1,
    line: "They are paying for clicks that land on a page built to describe the company rather than to book the job.",
    ask: "When someone clicks one of your ads, where do they land and what do you want them to do there?" });
  else if (weakSite) out.push({ id: "weak_site", strength: 3,
    line: "Their site will not convert somebody who is ready to buy today.",
    ask: "When someone lands on your site ready to go, what are they supposed to do next?" });

  if (rating >= 4.5 && reviews >= 25) out.push({ id: "reputation_unused", strength: 2,
    line: `${rating} stars from ${reviews} reviews, and almost nobody outside their existing customers ever sees that.`,
    ask: "You are clearly good at the work. How do people who have never heard of you find that out?" });
  else if (reviews > 0 && reviews < 10) out.push({ id: "few_reviews", strength: 4,
    line: `Only ${reviews} review${reviews === 1 ? "" : "s"}, which is not enough to win a big decision against somebody showing two hundred.`,
    ask: "How much of your work comes from people comparing you against two or three others?" });

  if (years !== null && years <= 3) out.push({ id: "young", strength: 3,
    line: `About ${years} year${years === 1 ? "" : "s"} in, so there is no decade of referrals to coast on yet.`,
    ask: "Where is the work coming from while you are still building the name up?" });

  // The scout researched this specifically ("the marketing gaps BoldLine could fix"), so anything
  // it found beats anything derived here, but it goes last because it has no question attached.
  for (const gap of (Array.isArray(d.gaps) ? d.gaps : []).slice(0, 2)) {
    if (gap) out.push({ id: "gap", strength: 5, line: String(gap), ask: "" });
  }

  return out.sort((a, b) => a.strength - b.strength).slice(0, 3);
};

// The one line to open with. The scout writes a per-company hook ("grounded in something real you
// found"), which beats anything computed; falling back to the strongest pain point keeps the card
// from ever being blank.
export const bestHook = (prospect) => {
  const d = (prospect && prospect.data) || {};
  const h = String(d.bestHook || "").trim();
  if (h) return { text: h, from: "research" };
  const p = painPoints(prospect)[0];
  // `fromId` so the card can avoid printing the same sentence twice: a derived hook IS the first
  // point's question, and on a phone the repeat reads as a bug. Caught by looking at the render,
  // not by a test.
  return p ? { text: p.ask || p.line, from: "derived", fromId: p.id } : null;
};

// What to do about a company he just typed in, given whatever is already on the list under that
// name or website. A function rather than three `if`s in the endpoint, because it is the point
// where a do-not-contact request either holds or does not, and that has to be testable by running
// it rather than by reading it.
//
// 🔴 BLOCKED OUTRANKS EVERYTHING. Somebody who asked to be taken off the list stays off it, and
// typing their name in by hand is not a new decision that overrides the one they made.
export const manualAddVerdict = (existing) => {
  if (existing && isBlocked(existing)) {
    return { verdict: "blocked", status: 409,
      message: `${existing.name} asked not to be contacted, so they cannot be added back.` };
  }
  if (existing) {
    return { verdict: "duplicate", status: 200, message: `${existing.name} is already on your list.` };
  }
  return { verdict: "insert", status: 200, message: "" };
};

// Everything due on or before `now`, best prospect first. Blocked rows can never appear.
// 🔴 A SALES STAGE THAT MEANS "DO NOT CALL THIS ONE" HAS TO ACTUALLY STOP THE CALL. Marking a
// prospect "Not a fit" in Lead Scout, or "Won" once they are a client, left them sitting in the
// calling queue at step 0 with nothing due, so they came up again the next morning. Weeding the
// list did nothing, which is the same complaint as a Delete button that does not delete.
// This is NOT the do-not-contact guard and does not replace it: a status is a dropdown somebody
// can change back, `blocked_at` is not, which is why they are separate checks.
export const QUEUE_SKIP_STATUS = ["dead", "client"];
export const isQueueable = (p) => !!p && !isBlocked(p) && !QUEUE_SKIP_STATUS.includes(String((p && p.status) || ""));

export const dueQueue = (prospects, now = Date.now()) => {
  const n = nowMs(now);
  return (Array.isArray(prospects) ? prospects : [])
    .filter((p) => p && !isBlocked(p) && isQueueable(p))
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
      // 🔴 A COMPANY HE TYPED IN HIMSELF COMES BEFORE ONE A SEARCH FOUND. Typing a name in is a
      // stronger signal than any score, and a hand-added row carries a score of 0 on purpose, so
      // without this the referral he just entered sorts below thirty scraped businesses and never
      // gets called. It sits below a promised callback, which is what the branch above protects.
      const am = isManual(a) ? 1 : 0, bm = isManual(b) ? 1 : 0;
      if (am !== bm) return bm - am;
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
