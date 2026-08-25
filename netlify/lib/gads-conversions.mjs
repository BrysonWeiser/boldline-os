// The conversion loop: teaching Google which leads were actually worth having.
//
// Bryson, 2026-08-24, on his first real prospect. The client's own analysis got the
// important part right: "Don't have Google optimize around someone simply submitting
// Contact Us." A screen printer selling 25-piece orders and a teenager wanting one shirt
// fill in the same form. If every form fill is reported to Google as a conversion, Smart
// Bidding will faithfully go and find more teenagers, because that is what it was told to
// want. The budget gets spent, the conversion count looks healthy, and the business gets
// nothing.
//
// THREE ACTIONS, DELIBERATELY UNEQUAL:
//   • Form submission  — SECONDARY. Measured, never bid on. It is a signal that the page
//     works, not that money is coming.
//   • Qualified lead   — PRIMARY. Uploaded by hand once a person has judged the lead real.
//   • Closed customer  — PRIMARY, and carries the actual order value, so bidding can chase
//     revenue rather than a count.
//
// 🔴 THE PIECE EVERYONE FORGETS IS THE CLICK ID. Google can only credit an outcome to the
// ad that caused it if the lead carries the `gclid` from the click that brought them in.
// That has to be captured on the landing page at the moment of the visit and stored with
// the lead, WEEKS before anyone knows whether the lead was any good. Miss it at capture
// time and the outcome can never be attributed, no matter what is uploaded later. This is
// why the tracking has to ship with the campaign, not after the first leads arrive.
//
// Pure module on purpose: every rule below is executed by the test suite rather than
// re-implemented in it (KB `repo-tests`).

// ─── THE THREE ACTIONS ────────────────────────────────────────────────────────
// `key` is ours and is what the client record stores. `category` is Google's, and it is
// what makes the lead funnel legible in the Google Ads UI rather than three anonymous
// custom actions.
export const CONVERSION_ACTIONS = [
  {
    key: "form",
    name: "BoldLine Form Submission",
    category: "SUBMIT_LEAD_FORM",
    type: "WEBPAGE",
    // 🔴 The whole point. `primaryForGoal: false` keeps this OUT of the "Conversions"
    // column that Smart Bidding optimizes toward. It still reports, so we can see the
    // landing page's conversion rate, but Google never chases it.
    primary: false,
  },
  {
    key: "qualified",
    name: "BoldLine Qualified Lead",
    category: "QUALIFIED_LEAD",
    // Uploaded from the OS days later, so it is a click upload rather than a page tag.
    type: "UPLOAD_CLICKS",
    primary: true,
  },
  {
    key: "won",
    name: "BoldLine Closed Customer",
    category: "CONVERTED_LEAD",
    type: "UPLOAD_CLICKS",
    primary: true,
  },
];

export const ACTION_KEYS = CONVERSION_ACTIONS.map((a) => a.key);
export const byKey = (key) => CONVERSION_ACTIONS.find((a) => a.key === key) || null;

// Google refuses a click conversion whose click is older than this. Uploading one anyway
// returns a partial failure per row, which is easy to miss in a batch, so the rows are
// filtered out here and the reason is recorded on the lead instead of vanishing.
export const CLICK_MAX_DAYS = 90;

// ─── CREATE PAYLOAD ───────────────────────────────────────────────────────────
// `leadValue` is what one qualified lead is worth to the business. It goes on as a
// DEFAULT, not a fixed value: a real order value is sent with the upload when we know it,
// and the default only fills in when we do not. Sending zero would tell Google the lead
// was worthless, which is worse than sending nothing.
export const conversionActionPayload = (a, { leadValue } = {}) => {
  const op = {
    name: a.name,
    category: a.category,
    type: a.type,
    status: "ENABLED",
    primaryForGoal: !!a.primary,
    // One per click. A lead who fills the form twice is one lead, and counting them twice
    // would quietly inflate every number downstream of this.
    countingType: "ONE_PER_CLICK",
  };
  const v = Number(leadValue);
  if (a.primary && Number.isFinite(v) && v > 0) {
    op.valueSettings = {
      defaultValue: Math.round(v * 100) / 100,
      defaultCurrencyCode: "USD",
      // false = an uploaded value wins. true would throw away the real order value.
      alwaysUseDefaultValue: false,
    };
  }
  return op;
};

export const createOperations = (opts = {}) =>
  CONVERSION_ACTIONS.map((a) => ({ create: conversionActionPayload(a, opts) }));

// ─── READING THE TAG BACK ─────────────────────────────────────────────────────
// The page tag needs two things Google does not return from the create call: the
// account's conversion id (AW-…) and the per-action label. The label only exists inside
// the event snippet Google generates, so it gets parsed out of that.
//
// A snippet looks like:  gtag('event', 'conversion', {'send_to': 'AW-123456789/AbC-dEf'});
export const parseConversionLabel = (snippet) => {
  const m = String(snippet || "").match(/send_to['"]?\s*:\s*['"]([^'"]+)['"]/);
  if (!m) return null;
  const parts = m[1].split("/");
  return parts.length === 2 && parts[0] && parts[1]
    ? { conversionId: parts[0], label: parts[1] }
    : null;
};

// Turn the GAQL rows into the small record the client keeps. Matching is on NAME, because
// the id is assigned by Google and the name is the only thing we control. Anything we did
// not create is ignored rather than adopted: a client may already have conversion actions
// of their own and taking them over would change what their account bids on.
export const mapConversionRows = (rows) => {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const ca = (row && row.conversionAction) || {};
    const spec = CONVERSION_ACTIONS.find((a) => a.name === ca.name);
    if (!spec) continue;
    const snippets = ca.tagSnippets || [];
    const parsed = snippets.map((s) => parseConversionLabel(s && s.eventSnippet)).find(Boolean);
    out[spec.key] = {
      resourceName: ca.resourceName || "",
      id: ca.id != null ? String(ca.id) : "",
      name: ca.name || spec.name,
      primary: !!spec.primary,
      ...(parsed ? { label: parsed.label, conversionId: parsed.conversionId } : {}),
    };
  }
  return out;
};

// ─── THE UPLOAD ───────────────────────────────────────────────────────────────
// Google wants "yyyy-MM-dd HH:mm:ss+HH:mm" and rejects an ISO string outright. UTC is used
// rather than the account's timezone because the offset is explicit either way, and
// guessing a timezone we were never told is how conversions land on the wrong day.
export const gadsDateTime = (when) => {
  const t = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(t.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())} `
       + `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}+00:00`;
};

// The click identifier, whichever kind this visitor had. `gclid` is the normal one;
// `wbraid` and `gbraid` are what Google sends instead when the browser blocked the usual
// tracking, mostly on iOS. Supporting all three is the difference between attributing most
// leads and attributing roughly half of them.
export const clickIdOf = (lead) => {
  const l = lead || {};
  for (const k of ["gclid", "wbraid", "gbraid"]) {
    const v = String(l[k] || "").trim();
    if (v) return { kind: k, value: v };
  }
  return null;
};

export const clickAgeDays = (lead, now = Date.now()) => {
  const l = lead || {};
  const t = new Date(l.clickAt || l.receivedAt || 0).getTime();
  if (!t || Number.isNaN(t)) return Infinity;
  return (now - t) / 864e5;
};

// 🔴 WHY A LEAD IS SKIPPED MATTERS AS MUCH AS WHETHER IT IS. A silent skip looks exactly
// like a working upload that Google ignored, and that is a bug nobody finds for months.
// Every lead gets a verdict, and the reason travels with it.
export function uploadPlan(client, { stage, now = Date.now() } = {}) {
  const spec = byKey(stage);
  if (!spec || spec.type !== "UPLOAD_CLICKS") {
    return { ok: false, error: `Nothing to upload for "${stage}"`, rows: [], skipped: [] };
  }
  const conv = ((client || {}).conversionActions || {})[stage];
  if (!conv || !conv.resourceName) {
    return { ok: false, error: `The ${spec.name} conversion has not been created in the ad account yet.`, rows: [], skipped: [] };
  }

  const rows = [];
  const skipped = [];
  const leads = ((client || {}).leadsLog) || [];

  leads.forEach((lead, index) => {
    const l = lead || {};
    // Has this lead actually reached this stage?
    if (!leadIsAtStage(l, stage)) return;

    // Already sent. Uploading twice would double-count the lead in Google's own numbers,
    // which then feeds bidding and every report that reads it.
    const sent = (l.gadsUploaded || {})[stage];
    if (sent) { skipped.push({ index, reason: "already sent", at: sent }); return; }

    const click = clickIdOf(l);
    if (!click) { skipped.push({ index, reason: "no click id, so Google cannot match it to an ad" }); return; }

    const age = clickAgeDays(l, now);
    if (age > CLICK_MAX_DAYS) {
      skipped.push({ index, reason: `the click is ${Math.round(age)} days old, past Google's ${CLICK_MAX_DAYS} day limit` });
      return;
    }

    const when = gadsDateTime(stageTime(l, stage) || l.receivedAt || new Date());
    if (!when) { skipped.push({ index, reason: "no usable date on the lead" }); return; }

    const row = { [click.kind]: click.value, conversionAction: conv.resourceName, conversionDateTime: when };
    const value = stageValue(l, stage);
    if (value != null) { row.conversionValue = value; row.currencyCode = "USD"; }
    rows.push({ index, row });
  });

  return { ok: true, rows, skipped, conversionAction: conv.resourceName, stage };
}

// A won lead was necessarily a qualified one, so it counts for both. Without that rule a
// lead that goes straight from new to won never reports as qualified at all, and the
// primary conversion the whole account bids on quietly under-counts.
export const leadIsAtStage = (lead, stage) => {
  const l = lead || {};
  const won = !!l.won || /^(won|closed|customer)$/i.test(String(l.status || ""));
  if (stage === "won") return won;
  if (stage === "qualified") return won || !!l.qualified || /^qualified$/i.test(String(l.status || ""));
  return false;
};

const stageTime = (lead, stage) => {
  const l = lead || {};
  return stage === "won" ? (l.wonAt || l.qualifiedAt) : (l.qualifiedAt || l.wonAt);
};

// Only a closed customer carries a real number. A qualified lead's worth is an average,
// and the average is already on the conversion action as its default value, so sending it
// per row would just be the same estimate wearing a disguise.
const stageValue = (lead, stage) => {
  if (stage !== "won") return null;
  const v = Number((lead || {}).orderValue);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
};
