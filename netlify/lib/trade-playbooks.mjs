// What we know about filtering leads in a given trade, and where that knowledge came from.
//
// Bryson, 2026-08-25, about his first client: *"there will be a lot of testing and building
// things from working with him and I don't want that time to be wasted."*
//
// The campaign machinery already carries over to client two untouched. The JUDGEMENT does
// not. The searches worth blocking for a screen printer mostly apply to the next screen
// printer, and the questions that separate a real buyer from a tyre kicker are learned once
// and reused forever. Until now that lived in emails.
//
// 🔴 THE RULE THIS FILE EXISTS TO ENFORCE, AND IT IS THE SAME ONE AS MARKET RESEARCH.
// A seeded term is a GUESS. A term a real client taught us is EVIDENCE. They must never be
// presented as the same thing, because a plausible guess that blocks a profitable search
// costs money silently and nobody ever finds out. So every entry carries where it came
// from, and the two are shown apart.
//
//   seed     — written here from general knowledge of the trade. A hypothesis.
//   learned  — a real client said so, with their name and the date attached.
//
// Learned entries live on the HOUSE account's record (`tradePlaybooks`), not in a new
// table. A migration nobody ran is what made Lead Scout hang silently, and this needs to
// work the first time it is used.

// ─── UNIVERSAL ────────────────────────────────────────────────────────────────
// People who can never buy from ANY lead-gen client, whatever the trade. Cheap to exclude
// and expensive to leave in on a small daily budget: on $16 a day, a handful of clicks
// from job hunters is a meaningful share of the month.
export const UNIVERSAL_NEGATIVES = [
  "free", "cheap", "cheapest", "discount", "bargain",
  "jobs", "job", "salary", "hiring", "career", "careers", "intern", "internship", "resume", "entry level",
  "course", "courses", "training", "tutorial", "how to", "diy", "udemy", "certification",
  "software", "tool", "tools", "template", "reddit", "wikipedia", "meaning", "definition",
];

// Asked on every lead form regardless of trade. Deliberately short: every extra field
// costs enquiries, and these are the four without which a lead cannot be worked at all.
export const UNIVERSAL_QUESTIONS = [
  { key: "name",    label: "Your name",            required: true },
  { key: "email",   label: "Email",                required: true },
  { key: "phone",   label: "Phone",                required: true },
  { key: "message", label: "What do you need?",    required: true },
];

// ─── PER TRADE ────────────────────────────────────────────────────────────────
// Matched loosely on the client's niche, most specific pattern first. A trade with no
// entry still gets the universal list, which is the honest outcome: better an empty
// playbook than an invented one.
//
// 🔴 KEEP THIS THIN ON PURPOSE. It is tempting to fill in twenty trades from general
// knowledge, and that would produce exactly the confident-sounding guesses this design is
// built to keep separate from real evidence. Seed only what is genuinely well known about
// how people search, and let clients fill in the rest.
export const TRADES = [
  {
    id: "apparel",
    label: "Custom apparel and screen printing",
    match: /screen ?print|custom apparel|embroider|t.?shirt|promotional product|uniform/i,
    negatives: [
      // Somebody doing it themselves at home is not a customer for a print shop.
      "cricut", "heat press", "iron on", "vinyl cutter", "sublimation printer", "print at home",
      // Buying blanks rather than printing.
      "blank shirts", "wholesale blanks", "bulk blank",
      // One-offs. The whole business is volume.
      "1 shirt", "one shirt", "single shirt", "custom shirt for me",
      // Marketplaces, not local print shops.
      "etsy", "redbubble", "teespring", "vistaprint",
    ],
    questions: [
      { key: "organization", label: "Company or organization",     required: true,
        why: "A real buyer names an organization. A one-off often cannot." },
      { key: "quantity",     label: "Roughly how many pieces?",    required: true,
        why: "The single strongest signal of order size, and it is asked before anyone is quoted." },
      { key: "deadline",     label: "When do you need them?",      required: false,
        why: "A date means a real project. No date often means browsing." },
    ],
  },
  {
    id: "home-services",
    label: "Home services (roofing, HVAC, plumbing, electrical)",
    match: /roof|hvac|plumb|electric|landscap|remodel|contractor|garage door|fenc/i,
    negatives: [
      "parts", "supply", "supplies", "wholesale", "manual", "diagram", "replacement part",
      "rental", "rent", "used", "second hand",
      "apprentice", "license", "licensing", "certification",
    ],
    questions: [
      { key: "address",  label: "Property address or area", required: true,
        why: "Out of area is the most common way a good-looking lead turns out worthless." },
      { key: "urgency",  label: "How soon do you need this?", required: true,
        why: "Separates an emergency from someone pricing a job for next year." },
      { key: "own_rent", label: "Do you own the property?",   required: false,
        why: "A tenant usually cannot authorise the work." },
    ],
  },
  {
    id: "professional",
    label: "Professional services (legal, accounting, consulting)",
    match: /law|legal|attorney|account|bookkeep|consult|financial advis|insurance/i,
    negatives: [
      "pro bono", "free consultation", "legal aid", "self help", "forms", "do it yourself",
      "salary", "school", "degree", "exam", "study",
    ],
    questions: [
      { key: "situation", label: "Briefly, what is the situation?", required: true,
        why: "Most disqualification in these trades happens on the facts, not the budget." },
      { key: "timeline",  label: "Is there a deadline involved?",   required: false,
        why: "A filing date or a court date means it is real." },
    ],
  },
];

const norm = (s) => String(s || "").toLowerCase();

export const tradeFor = (niche) => {
  const n = norm(niche);
  if (!n) return null;
  return TRADES.find((t) => t.match.test(n)) || null;
};

// ─── LEARNED ──────────────────────────────────────────────────────────────────
// What a real client told us. `store` is the whole `tradePlaybooks` object from the house
// account, keyed by trade id (plus "universal" for something true of every trade).
//
// The shape of one entry:
//   { term, why, client, at, kind: "negative" | "question" | "disqualifier" }
export const learnedFor = (store, tradeId, kind) =>
  [...(((store || {}).universal || {})[kind] || []), ...(((store || {})[tradeId] || {})[kind] || [])]
    .filter((e) => e && e.term);

// 🔴 EVIDENCE OUTRANKS A GUESS, AND IT IS ALSO ALLOWED TO OVERRULE ONE. If a client says a
// term we seeded is actually one of their best searches, that entry can carry `keep: true`
// and the seeded negative is removed rather than argued with. The person who runs the
// business knows their market better than this file does.
export const keptTerms = (store, tradeId) =>
  new Set(learnedFor(store, tradeId, "negative").filter((e) => e.keep).map((e) => norm(e.term)));

// The whole playbook for one client, with every item labelled by where it came from.
// Nothing is merged into an anonymous blob, because "why is this blocked" has to be
// answerable months later.
export function playbookFor(niche, store) {
  const trade = tradeFor(niche);
  const id = trade ? trade.id : "";
  const keep = keptTerms(store, id);

  const seedNegatives = [...UNIVERSAL_NEGATIVES, ...((trade && trade.negatives) || [])]
    .filter((t) => !keep.has(norm(t)))
    .map((term) => ({ term, source: "seed" }));

  const learnedNegatives = learnedFor(store, id, "negative")
    .filter((e) => !e.keep)
    .map((e) => ({ term: e.term, source: "learned", client: e.client || "", at: e.at || "", why: e.why || "" }));

  // Deduped with LEARNED winning, so a term we guessed at and a client later explained
  // keeps the explanation rather than the guess.
  const seen = new Set();
  const negatives = [...learnedNegatives, ...seedNegatives].filter((n) => {
    const k = norm(n.term);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const questions = [
    ...UNIVERSAL_QUESTIONS.map((q) => ({ ...q, source: "universal" })),
    ...((trade && trade.questions) || []).map((q) => ({ ...q, source: "seed" })),
    ...learnedFor(store, id, "question").map((e) => ({
      key: e.key || norm(e.term).replace(/[^a-z0-9]+/g, "_"),
      label: e.term, required: !!e.required, why: e.why || "",
      source: "learned", client: e.client || "", at: e.at || "",
    })),
  ];

  return {
    trade: trade ? { id: trade.id, label: trade.label } : null,
    negatives,
    questions,
    // What a bad lead looks like in this trade. Entirely learned: there is no honest way
    // to guess it, and guessing would be the most damaging kind of invention here.
    disqualifiers: learnedFor(store, id, "disqualifier").map((e) => ({
      term: e.term, why: e.why || "", client: e.client || "", at: e.at || "", source: "learned",
    })),
    counts: {
      seeded: negatives.filter((n) => n.source === "seed").length,
      learned: negatives.filter((n) => n.source === "learned").length,
    },
  };
}

// Just the words, for the campaign builder's negative keyword box.
export const negativeTerms = (niche, store) => playbookFor(niche, store).negatives.map((n) => n.term);

// ─── WRITING SOMETHING NEW IN ─────────────────────────────────────────────────
// Returns the whole updated store. Pure, so the caller decides how to persist it, and the
// test suite can run the real merge.
export function recordLearning(store, { tradeId = "universal", kind = "negative", term, why = "", client = "", keep = false, key = "", required = false, at } = {}) {
  const t = String(term || "").trim();
  if (!t) return store || {};
  const next = { ...(store || {}) };
  const bucket = { ...(next[tradeId] || {}) };
  const list = [...(bucket[kind] || [])];
  const i = list.findIndex((e) => e && norm(e.term) === norm(t));
  const entry = {
    term: t, why: String(why || "").slice(0, 400), client: String(client || ""),
    at: at || new Date().toISOString(),
    ...(keep ? { keep: true } : {}),
    ...(kind === "question" ? { key: key || norm(t).replace(/[^a-z0-9]+/g, "_"), required: !!required } : {}),
  };
  // Re-teaching the same term updates it rather than stacking duplicates, so a corrected
  // reason replaces the old one instead of sitting beside it.
  if (i >= 0) list[i] = { ...list[i], ...entry };
  else list.push(entry);
  bucket[kind] = list;
  next[tradeId] = bucket;
  return next;
}
