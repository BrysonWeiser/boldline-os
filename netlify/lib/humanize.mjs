// One place that strips the dash. Used by everything that writes copy.
//
// Bryson, 2026-08-14: no ad may read as AI-written, and the em dash is the tell he named.
// Bryson, 2026-08-20: "make sure for all of the ad copy for my ads and clients and anything
// we write that we avoid using - because it makes it seem ai written."
//
// TWO THINGS WERE WRONG BEFORE THIS FILE EXISTED.
//
// 1. THE PLAIN HYPHEN WAS NEVER CAUGHT. Every implementation matched only "—" and "–", so
//    "Roof repair - done right" sailed straight through. That is the same tell wearing a
//    different character, and it is the one a model reaches for most often because it is
//    on every keyboard. This is what Bryson kept seeing.
//
// 2. THERE WERE THREE COPIES AND THEY HAD ALREADY DRIFTED. `ad-gen-shared` handled em and
//    en dashes, `blog-shared` handled only the em dash, and nine other model-writing
//    surfaces — including the LANDING PAGE writer, the CLIENT REPORT writer and the
//    prospect-facing audit email — cleaned nothing at all and relied on the prompt. A
//    prompt is guidance; this is the guarantee.
//
// 🔴 WHAT MUST NOT BE TOUCHED, which is why this is not a blanket find-and-replace:
//    real spellings  "e-commerce", "t-shirt", "self-employed", "follow-up", "24-hour"
//    identifiers     "AW-18269689296", "act_1045064901242944"
//    phone numbers   "602-555-0199"
//    bullet lines    "\n- Fast service"
// A hyphen only counts as a dash when it has a real space on BOTH sides. Everything above
// either has no spaces or sits at the start of a line, so all of it survives untouched.
//
// 🔴 THE EXCEPTION: MARKETING COMPOUNDS (Bryson, 2026-08-20). "done-for-you" and
// "no-obligation" ARE hyphens inside a word, and he called them out anyway: *"the done for
// you doesnt need hyphens neither does the no obligation thats what makes it seem ai
// written"*. He is right. Nobody says "done-for-you" out loud; the hyphens are a copywriting
// tic that reads as marketing rather than as a person talking. So a SHORT, EXPLICIT list of
// those phrases loses its hyphens.
//
// It is an explicit list and not a rule on purpose. "De-hyphenate any adjective compound"
// would wreck "e-commerce", "self-employed", "part-time" and "follow-up", all of which are
// simply how the words are spelled. Anything not on this list keeps its hyphen.

// Horizontal whitespace only. Using \s here would treat a newline as a space and turn a
// bulleted list into prose, which is how a "safe" cleanup quietly wrecks a blog post.
const H = "[ \\t]";

const LEAD_LONG = /^\s*[—–]+\s*/;
const TRAIL_LONG = /\s*[—–]+\s*$/;
const JOIN_LONG = /\s*[—–]+\s*/g;

// The plain hyphen, only ever as a spaced connector. One or two of them.
const LEAD_HYPHEN = new RegExp(`^${H}*-{1,2}${H}+`);
const TRAIL_HYPHEN = new RegExp(`${H}+-{1,2}${H}*$`);
const JOIN_HYPHEN = new RegExp(`${H}+-{1,2}${H}+`, "g");

// Phrases we hyphenate out of copywriting habit, which a person speaking would not.
// Deliberately short. Add to it when a new one shows up in real copy, never broaden it
// into a pattern.
const MARKETING_COMPOUNDS = [
  "done-for-you", "no-obligation", "no-hassle", "hassle-free", "risk-free", "worry-free",
  "stress-free", "no-nonsense", "full-service", "data-driven", "results-driven",
  "family-owned", "locally-owned", "fully-managed", "ready-to-go", "custom-built",
  "purpose-built", "same-day", "next-day", "top-rated", "best-in-class", "high-quality",
  "cost-effective", "time-saving", "user-friendly", "hand-picked", "tried-and-tested",
  "state-of-the-art", "up-front", "no-strings", "no-pressure", "no-commitment",
];
// Longest first, so "tried-and-tested" is matched before any shorter piece of it.
const COMPOUND_RE = new RegExp(
  `\\b(${MARKETING_COMPOUNDS.sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");

// Replace the hyphens with spaces while keeping whatever capitalisation was there, so
// "Done-For-You" becomes "Done For You" and "done-for-you" becomes "done for you".
const deCompound = (s) => s.replace(COMPOUND_RE, (m) => m.replace(/-/g, " "));

/**
 * Remove dashes used as sentence connectors.
 * @param {*} s        input (non-strings are returned untouched)
 * @param {string} join what a joining dash becomes. ". " splits into two sentences (right
 *                      for ad copy, which is what the voice rule asks for); ", " keeps one
 *                      sentence (right for prose, where a hard stop reads clipped).
 */
export const humanize = (s, { join = ". " } = {}) => {
  if (typeof s !== "string") return s;
  let t = deCompound(s)
    .replace(LEAD_LONG, "").replace(TRAIL_LONG, "")
    .replace(LEAD_HYPHEN, "").replace(TRAIL_HYPHEN, "")
    .replace(JOIN_LONG, join)
    .replace(JOIN_HYPHEN, join);

  if (join === ". ") {
    // A dash often followed a full stop already ("done. — next"), and two stops in a row
    // reads worse than the dash did.
    t = t.replace(/\s*\.\s*\.\s*/g, ". ")
      // A sentence that now starts mid-flow should start like a sentence.
      .replace(/([.!?])\s+([a-z])/g, (m, p, c) => `${p} ${c.toUpperCase()}`);
  } else {
    t = t.replace(/,\s*,/g, ",").replace(/\s+,/g, ",");
  }
  // Never leave the punctuation dangling at the very end.
  return t.replace(/[\s,;:]+$/, "").replace(/\s{2,}/g, " ").trim();
};

/** Apply `humanize` to every string in an object or array, however deeply nested. */
export const humanizeDeep = (v, opts) =>
  Array.isArray(v) ? v.map((x) => humanizeDeep(x, opts))
  : (v && typeof v === "object") ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, humanizeDeep(x, opts)]))
  : humanize(v, opts);

// The line every copy-writing prompt carries, so the model is told the same rule the code
// enforces. Named the plain hyphen explicitly on 2026-08-20 — the old wording said "em
// dash or en dash", and a model reads that as permission to use "-" instead.
export const NO_DASH_RULE =
  "NEVER use a dash to join or interrupt a sentence. That means the em dash, the en dash, "
  + "and a plain hyphen with spaces around it. All three read as machine-written, and the "
  + "spaced hyphen is the most common tell of all. Write two sentences, or use a comma. "
  + "ALSO do not hyphenate marketing phrases nobody hyphenates when speaking: write "
  + "\"done for you\", \"no obligation\", \"same day\", \"family owned\", \"risk free\". "
  + "Keep the hyphen only where it is genuinely part of the spelling: e-commerce, t-shirt, "
  + "self-employed, follow-up, 24-hour.";

// ─── WORD-SAFE TRIMMING ──────────────────────────────────────────────────────
// Moved here from ad-gen-shared.mjs so the landing page renderer can use it without
// pulling in the Anthropic SDK. Same rules, one definition.
// A plain .slice() produced "When the calls should be ringi" on a real creative.
// Copy that stops mid-word reads broken and is worse than copy that is simply
// shorter, so these trim back to a whole word (or a whole sentence) instead.
// If even the first word does not fit, the field is dropped rather than mangled.
export const fitWords = (s, max) => {
  const t = String(s == null ? "" : s).trim().replace(/\s{2,}/g, " ");
  if (t.length <= max) return t;
  const sp = t.slice(0, max + 1).lastIndexOf(" ");
  if (sp <= 0) return "";
  return t.slice(0, sp).replace(/[\s,;:.\-]+$/, "");
};

// ── Trimming that never stops mid-THOUGHT ───────────────────────────────────
// Bryson, 2026-08-19, off a live Meta ad: the description read
// "Steady roofing leads, not just".
//
// This is NOT the mid-word bug that was fixed before. `fitWords` did exactly its job:
// that string is 30 characters and ends on a whole word. It is still broken English,
// because a whole word is not a whole THOUGHT. A short hard-capped field (a 30-character
// description, a 30-character Google headline) will nearly always land mid-clause if you
// simply cut at the limit, so word-safety is not enough on its own.
//
// The fix walks BACK off dangling words until the text ends somewhere a person could
// stop. On the reported string: "…, not just" -> drop "just" -> "…, not" -> drop "not"
// -> "Steady roofing leads," -> strip the comma -> "Steady roofing leads". Twenty
// characters, complete, and it says the same thing.
//
// If nothing survives, the field is DROPPED rather than shipped as a fragment — the same
// principle as before, and safe here because these fields are optional.
// 🔴 CONSERVATIVE ON PURPOSE. Only words that essentially CANNOT end an English
// sentence belong here. A false positive is worse than a false negative: leaving a
// slightly awkward ending merely reads plain, whereas deleting a good last word turns
// working copy into worse copy. So phrasal-verb particles and adverbs that DO end
// sentences are deliberately absent — "check it out", "call now", "members only",
// "not yet", "back then", "we do that too", "start here" are all fine endings.
const DANGLING = new Set([
  // articles and determiners
  "a", "an", "the", "this", "these", "those", "your", "our", "their", "its",
  "my", "his", "her", "every", "each", "more", "most", "less",
  // 🔴 QUANTIFIERS ADDED 2026-08-20, off a live ad reading "Steady roof leads, no".
  // The walk-back was working: the model wrote "Steady roof leads, no more guessing",
  // `fitWords` cut it to "…, no more", and "more" WAS caught and popped. It then stopped
  // on "no", which was not listed, so a one-word fragment survived. The lesson is that the
  // list has to cover a whole CHAIN of leading words, not just the last one, because
  // popping one dangler routinely exposes another underneath it.
  // Still conservative: "both", "either", "much", "many" and "enough" are deliberately
  // ABSENT because they genuinely do end sentences ("we do both", "thanks so much").
  // "no" is the one judgement call — "the answer is no" is valid English but essentially
  // never appears in ad copy, whereas "no contracts" / "no guessing" is everywhere.
  "no", "any", "another", "other", "such", "several",
  // coordinating and subordinating conjunctions
  "and", "or", "but", "nor", "so", "because", "if", "when", "while",
  "although", "though", "unless", "until", "that", "which", "whose", "than",
  // prepositions (particles like out/up/off are excluded — they end phrasal verbs)
  "of", "to", "in", "on", "at", "by", "for", "with", "from", "into", "onto",
  "about", "after", "before", "between", "through", "during", "without", "within",
  "across", "against", "near", "per", "via",
  // auxiliaries and copulas
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did",
  "has", "have", "had", "will", "would", "can", "could", "should", "may", "might", "must",
  // intensifiers and qualifiers that always lead into something
  "not", "just", "very", "really", "quite",
]);
const isDangling = (w) => DANGLING.has(String(w || "").toLowerCase().replace(/[^a-z']/gi, ""));

// The shortest thing worth shipping. Below this, a trimmed field says nothing useful and
// an empty slot looks deliberate where a stub looks broken.
const MIN_PHRASE_WORDS = 2;

export const fitPhrase = (s, max) => {
  const full = String(s == null ? "" : s).trim().replace(/\s{2,}/g, " ");
  // 🔴 Only walk back when something was actually CUT. A field that already fits was
  // written deliberately and is complete as-is; running the dangling check over it
  // would edit copy nobody asked us to edit, which is exactly the false positive this
  // whole comment block warns about.
  if (full.length <= max) return full;
  const t = fitWords(full, max);
  if (!t) return "";
  const words = t.split(" ").filter(Boolean);
  while (words.length && isDangling(words[words.length - 1])) words.pop();
  if (words.length < MIN_PHRASE_WORDS) return "";
  return words.join(" ").replace(/[\s,;:.\-]+$/, "");
};

// For prose, prefer ending on a finished sentence; fall back to a whole word.
