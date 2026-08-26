// Where a lead came from, captured once at the door and carried forever after.
//
// Two different things live here and they are NOT interchangeable:
//
//   CLICK IDS (gclid, wbraid, gbraid) are Google's own receipt for a paid click. They are
//   the only thing that can credit an order weeks later back to the search that produced
//   it, and they are what the offline conversion upload matches on. Without one, an
//   outcome cannot be sent back to Google at all.
//
//   UTM TAGS are labels we put on our own links. Google never reads them back. They exist
//   so a human, or a CRM, can look at a contact months later and see which campaign and
//   which ad group produced it without asking anyone.
//
// Shaun Smith (Stencil & Thread's developer), 2026-08-26: *"include the gclid and UTM
// fields alongside the contact info. I'll store them on the contact record in the CRM.
// That way attribution lives with the lead itself."* He is right, and it costs us nothing
// to pass along what we are already standing next to.
//
// 🔴 ONE LIST, THREE PLACES. The landing page reads these names out of the URL, the intake
// endpoint accepts exactly these names and ignores everything else, and the CRM forward
// sends exactly these names. They drifted apart once already on the click ids. Keeping the
// list here means a name can only be wrong in one place.

// Google's click identifiers. `wbraid` and `gbraid` are what Google sends INSTEAD of
// `gclid` when the browser blocks the usual one, which is most iPhone traffic. Dropping
// them loses roughly half the attribution, which is why all three are first class.
export const CLICK_KEYS = ["gclid", "wbraid", "gbraid"];

// The five standard tags. Nothing custom: a CRM on the other end maps these once because
// every ad platform on earth already uses these exact names.
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

// Everything the browser is allowed to send us about where a visitor came from.
export const ATTRIBUTION_KEYS = [...CLICK_KEYS, ...UTM_KEYS];

// 🔴 THIS ENDPOINT IS PUBLIC, SO IT ACCEPTS ONLY WHAT IT KNOWS. Anyone can post to the
// intake URL. Copying arbitrary keys off a request body onto a stored record is how a
// public form becomes a way to write junk into someone's client record, so the allow list
// above is the whole contract and anything outside it is dropped without comment.
export function pickAttribution(body) {
  const b = body || {};
  const out = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = String(b[k] == null ? "" : b[k]).trim().slice(0, 200);
    if (v) out[k] = v;
  }
  return out;
}

// The UTM tags on their own, as a flat object, for handing to a CRM. Always returns every
// key so the receiving end sees a stable shape rather than a field that vanishes when it
// happens to be empty. A CRM that has to branch on "is this field present" is a CRM that
// will get it wrong once.
export function utmFields(lead) {
  const l = lead || {};
  const out = {};
  for (const k of UTM_KEYS) out[k] = String(l[k] == null ? "" : l[k]);
  return out;
}

// True when Google can actually credit an outcome back to an ad. A UTM tag alone does not
// count and must never be mistaken for one: it proves we labelled the link, not that
// Google recognised the click.
export const hasClickId = (lead) => CLICK_KEYS.some((k) => !!String((lead || {})[k] || "").trim());
