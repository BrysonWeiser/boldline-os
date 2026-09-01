// Several landing pages to choose from, mix, and rewrite, instead of one take-it-or-leave-it.
//
// Bryson, 2026-09-01: *"giving me multiple landing page options that i can either choose to
// use combine certain ideas or just straight up regenerate individual ones or all of them."*
// He picked the both-ways version: pick piece by piece for speed, and describe a blend in
// plain English when he wants something genuinely new rather than a swap.
//
// 🔴 THE ONE INVARIANT EVERYTHING HERE PROTECTS: THE LIVE PAGE IS NOT A VARIANT.
// `client.landingPage` is what visitors actually get. `client.landingVariants` are
// candidates, and nothing in this file may write to the live page except `applyVariant`,
// which is the single deliberate act of choosing. Generating, regenerating, blending and
// discarding all leave the live page exactly as it was. Get that wrong and a client's ads
// keep running while the page underneath them changes on its own.
//
// Kept pure and separate from the endpoint that calls the model, for the same reason
// `autobuild-decide` is: the decisions are where the bugs live, and none of them need a
// network to exercise.

// How many candidates are kept. Each is a full page's worth of copy on the client record,
// and more than a handful is a wall nobody reads rather than a choice.
export const MAX_VARIANTS = 6;

// How many are generated when he asks for a fresh set.
export const DEFAULT_COUNT = 3;

// 🔴 THE FIELDS HE CAN TAKE ONE AT A TIME. Deliberately a list rather than "every key",
// because a variant also carries bookkeeping (id, label, generatedAt) and an "everything"
// merge would copy that bookkeeping onto the live page and quietly make it look like a
// variant. It also means a new field added to the generator is NOT silently mixable until
// somebody decides it should be.
export const MIXABLE = ["headline", "subheadline", "bullets", "ctaText", "steps", "faqs", "design", "brandColor", "theme", "heroPath"];

// Bookkeeping that belongs to a variant and must never reach the live page.
const VARIANT_ONLY = ["id", "label", "generatedAt", "source", "angle"];

// 🔴 AND THE ONE THAT MUST NEVER TRAVEL IN EITHER DIRECTION. `published` is the difference
// between a draft and a page the client's ads are pointing at. A variant has no business
// carrying it, and a variant that somehow did could publish a page nobody approved.
const NEVER = ["published", "publishedAt"];

const clean = (obj, drop) => {
  const out = {};
  for (const k of Object.keys(obj || {})) if (!drop.includes(k)) out[k] = obj[k];
  return out;
};

let seq = 0;
const mkId = () => `v${Date.now().toString(36)}${(seq = (seq + 1) % 1296).toString(36).padStart(2, "0")}`;

// Wrap freshly generated copy as a candidate. Strips anything that would let it masquerade
// as the live page.
export function newVariant(copy, { label = "", source = "generated", angle = "", at } = {}) {
  const body = clean(clean(copy || {}, NEVER), VARIANT_ONLY);
  return {
    id: mkId(),
    label: String(label || "").slice(0, 60),
    source, angle: String(angle || "").slice(0, 300),
    generatedAt: at || new Date().toISOString(),
    ...body,
  };
}

// Newest first, capped. Returning a NEW array rather than mutating, because the caller saves
// only when something changed and an in-place push makes "changed" impossible to detect.
export const addVariants = (list, incoming) =>
  [...(incoming || []), ...(Array.isArray(list) ? list : [])].slice(0, MAX_VARIANTS);

// Swap one candidate for its rewrite, keeping its position so the row he was looking at does
// not jump somewhere else while he reads it.
export function replaceVariant(list, id, next) {
  const arr = Array.isArray(list) ? list : [];
  // 🔴 A REWRITE THAT PRODUCED NOTHING MUST NOT ERASE WHAT WAS THERE. A failed model call
  // returning undefined would otherwise blank the candidate he was about to pick.
  if (!next || typeof next !== "object" || !next.headline) return arr;
  const i = arr.findIndex((v) => v && v.id === id);
  if (i < 0) return arr;
  const out = arr.slice();
  out[i] = { ...next, id: arr[i].id, label: next.label || arr[i].label };
  return out;
}

export const removeVariant = (list, id) =>
  (Array.isArray(list) ? list : []).filter((v) => v && v.id !== id);

// 🔴 CHOOSING A VARIANT. The only path from candidate to live page, and the only place the
// live page is written.
//
// `published` is taken from the CURRENT live page, never from the variant and never reset.
// Both other readings are wrong in opposite directions: forcing it false would take a live
// page offline the moment he tried a different headline, with the client's ads still pointing
// at it; letting the variant decide would let a candidate publish itself. Preserving it means
// swapping is exactly as live as the page already was, which is what he chose to do.
export function applyVariant(client, id) {
  const cl = client || {};
  const current = cl.landingPage || {};
  const v = (cl.landingVariants || []).find((x) => x && x.id === id);
  if (!v) return null;
  const body = clean(clean(v, VARIANT_ONLY), NEVER);
  return {
    landingPage: {
      ...current,
      ...body,
      published: !!current.published,
      ...(current.publishedAt ? { publishedAt: current.publishedAt } : {}),
      chosenVariantId: v.id,
      chosenAt: new Date().toISOString(),
    },
  };
}

// 🔴 TAKING ONE PIECE. The "combine certain ideas" half, and the reason MIXABLE is a list:
// this copies exactly the field asked for and nothing else, so taking a headline cannot drag
// a different page's colours, layout or hero image along with it.
export function pickField(client, id, field) {
  const cl = client || {};
  if (!MIXABLE.includes(field)) return null;
  const v = (cl.landingVariants || []).find((x) => x && x.id === id);
  if (!v || !(field in v)) return null;
  const current = cl.landingPage || {};
  return {
    landingPage: { ...current, [field]: v[field], published: !!current.published },
  };
}

// What the model is told when asked for several at once. Distinct ANGLES rather than "give me
// three": asking one model for three variations of the same brief reliably produces three
// rewordings of one idea, and the point of three options is three arguments.
export const ANGLES = [
  { key: "outcome", label: "The result", nudge: "Lead with the OUTCOME the customer gets. What is different about their day once this is done." },
  { key: "objection", label: "The worry", nudge: "Lead with the biggest WORRY or objection a buyer has here, and answer it head on." },
  { key: "speed", label: "Speed and ease", nudge: "Lead with how FAST and how EASY this is compared with the alternative." },
  { key: "proof", label: "Why them", nudge: "Lead with what makes THIS business the safe choice. No invented statistics, awards or testimonials." },
  { key: "offer", label: "The offer", nudge: "Lead with the specific OFFER or the free quote as the hook." },
];

export const angleFor = (i) => ANGLES[((Number(i) || 0) % ANGLES.length + ANGLES.length) % ANGLES.length];

// The plain-English blend. Returns the instruction the endpoint hands the model, or null when
// there is nothing to work from, so an empty box can never fire a pointless model call.
export function blendPrompt(variants, ids, instruction) {
  const chosen = (variants || []).filter((v) => v && (ids || []).includes(v.id));
  const say = String(instruction || "").trim();
  if (!chosen.length || !say) return null;
  const described = chosen.map((v, i) => {
    const bullets = Array.isArray(v.bullets) ? v.bullets.join(" / ") : "";
    return `OPTION ${i + 1}${v.label ? ` (${v.label})` : ""}:\n`
      + `Headline: ${v.headline || ""}\n`
      + `Subheadline: ${v.subheadline || ""}\n`
      + `Bullets: ${bullets}\n`
      + `Button: ${v.ctaText || ""}`;
  }).join("\n\n");
  return `Here are landing page options that already exist for this business.\n\n${described}\n\n`
    + `Write ONE new version following this instruction exactly:\n"${say}"\n\n`
    + `Keep what the instruction says to keep, word for word where it makes sense. `
    + `Change only what it asks you to change. Do not invent prices, statistics, awards or reviews.`;
}
