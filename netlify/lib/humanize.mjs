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
//    compound words  "done-for-you", "no-obligation", "24-hour", "e-commerce"
//    identifiers     "AW-18269689296", "act_1045064901242944"
//    phone numbers   "602-555-0199"
//    bullet lines    "\n- Fast service"
// A hyphen only counts as a dash when it has a real space on BOTH sides. Everything above
// either has no spaces or sits at the start of a line, so all of it survives untouched.

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

/**
 * Remove dashes used as sentence connectors.
 * @param {*} s        input (non-strings are returned untouched)
 * @param {string} join what a joining dash becomes. ". " splits into two sentences (right
 *                      for ad copy, which is what the voice rule asks for); ", " keeps one
 *                      sentence (right for prose, where a hard stop reads clipped).
 */
export const humanize = (s, { join = ". " } = {}) => {
  if (typeof s !== "string") return s;
  let t = s
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
  + "Hyphens INSIDE a word are fine and expected: done-for-you, no-obligation, 24-hour.";
