// Where a lead actually came from, in words a person can act on.
//
// Bryson, 2026-09-04, on his first lead: *"I'm not sure where from yet though because the os
// ad analytics haven't updated"*.
//
// 🔴 THE AD NUMBERS WERE NEVER GOING TO ANSWER THAT, AND WAITING FOR THEM WAS THE TRAP.
// Spend and clicks are totals for a campaign. They cannot say which click became this
// person. The only thing that can is what the visitor's own browser was carrying when they
// filled the form, and the marketing site was throwing all of it away.
//
// Two shapes arrive here and both have to work, because leads come from two different
// worlds:
//   • A CLIENT's landing page posts FLAT keys (`gclid`, `utm_source`, …) through
//     lead-intake, which has done this since 2026-08-26. See `attribution.mjs`.
//   • BOLDLINE's own site posts one `attribution` field holding JSON, because Netlify Forms
//     only records fields that are declared in the form's HTML, and one declared field is
//     far harder to forget than eleven.
// Anything already stored keeps working, and a lead with nothing still gets an honest line
// rather than a blank.
//
// 🔴 "PAID" IS A CLAIM ABOUT MONEY AND IT IS ONLY MADE ON EVIDENCE. A click id, or a utm
// medium that says cpc, is evidence. A Facebook REFERRER is not: that is just as likely to
// be someone tapping a link in a post. Calling an organic visit an ad would make the cost
// per lead on the My Ads screen quietly wrong, and a wrong number that looks right is worse
// than a missing one.

// Each platform's receipt for a click it charged for. `wbraid`/`gbraid` are what Google
// sends instead of `gclid` when the browser blocks it, which is most iPhone traffic.
export const CLICK_IDS = {
  gclid: "Google ad", wbraid: "Google ad", gbraid: "Google ad",
  fbclid: "Facebook or Instagram ad",
  msclkid: "Bing ad",
  ttclid: "TikTok ad",
};

export const ORIGIN_KEYS = [
  ...Object.keys(CLICK_IDS),
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "referrer", "landing_page",
];

const str = (v) => String(v == null ? "" : v).trim();

// Pull the attribution off a lead whatever shape it arrived in. Flat keys win over the
// JSON blob, because a landing page that sends both means the flat ones.
export function originFields(lead) {
  const l = lead || {};
  const bag = {};
  const soak = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const k of ORIGIN_KEYS) {
      const v = str(obj[k]).slice(0, 300);
      if (v && !bag[k]) bag[k] = v;
    }
  };
  soak(l);
  const p = l.payload && typeof l.payload === "object" ? l.payload : null;
  soak(p);
  // A lead mirrored onto the house account keeps its origin in `origin`, because the mirror
  // deliberately does not copy the whole payload across.
  soak(l.origin);
  // The site's single declared field, holding JSON. Bad JSON is ignored rather than thrown:
  // this runs while drawing a lead on screen and a malformed field must never blank the card.
  for (const src of [l, p]) {
    const raw = src && src.attribution;
    if (!raw) continue;
    if (typeof raw === "object") { soak(raw); continue; }
    try { soak(JSON.parse(String(raw))); } catch (e) { /* not JSON, nothing to read */ }
  }
  return bag;
}

const HOSTS = [
  [/(^|\.)google\./i, "Google search"],
  [/(^|\.)bing\./i, "Bing search"],
  [/(^|\.)duckduckgo\./i, "DuckDuckGo search"],
  [/(^|\.)(facebook|fb)\./i, "Facebook"],
  [/(^|\.)instagram\./i, "Instagram"],
  [/(^|\.)linkedin\./i, "LinkedIn"],
  [/(^|\.)(x|twitter)\./i, "X"],
  [/(^|\.)youtube\./i, "YouTube"],
  [/(^|\.)tiktok\./i, "TikTok"],
  [/(^|\.)reddit\./i, "Reddit"],
];

const hostOf = (url) => {
  const s = str(url);
  if (!s) return "";
  try { return new URL(s).hostname.replace(/^www\./, ""); }
  catch (e) { return s.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""); }
};

const SOURCES = [
  [/facebook|instagram|^ig$|^fb$|^meta$/i, "Facebook or Instagram"],
  [/google/i, "Google"],
  [/bing|microsoft/i, "Bing"],
  [/tiktok/i, "TikTok"],
  [/linkedin/i, "LinkedIn"],
  [/youtube/i, "YouTube"],
];
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|cpm|display|ads?)$/i;

// { label, detail, paid, known } — `label` is the sentence, `detail` names the campaign and
// the ad when we know them, `paid` is only true on real evidence, `known` is false when the
// lead carries nothing at all.
export function leadOrigin(lead) {
  const f = originFields(lead);

  for (const [key, label] of Object.entries(CLICK_IDS)) {
    if (f[key]) return { label, detail: campaignDetail(f), paid: true, known: true };
  }

  const src = f.utm_source || "";
  const med = f.utm_medium || "";
  if (src) {
    const named = (SOURCES.find(([re]) => re.test(src)) || [])[1] || titleish(src);
    const paid = PAID_MEDIUM.test(med);
    return {
      label: paid ? `${named} ad` : (med ? `${named} (${med.toLowerCase()})` : named),
      detail: campaignDetail(f), paid, known: true,
    };
  }

  const host = hostOf(f.referrer);
  if (host) {
    const named = (HOSTS.find(([re]) => re.test(host)) || [])[1] || host;
    // 🔴 NOT called an ad. A Facebook referrer with no click id is far more likely to be a
    // tap on a post, and guessing would poison the cost per lead.
    return { label: named, detail: landingDetail(f), paid: false, known: true };
  }

  if (f.landing_page) {
    return { label: "Typed the address in, or had it saved", detail: landingDetail(f), paid: false, known: true };
  }
  return { label: "Not recorded", detail: "", paid: false, known: false };
}

function campaignDetail(f) {
  const bits = [];
  if (f.utm_campaign) bits.push(titleish(f.utm_campaign));
  if (f.utm_content) bits.push(titleish(f.utm_content));
  if (f.utm_term) bits.push(`searched "${f.utm_term}"`);
  const page = landingDetail(f);
  if (page) bits.push(page);
  return bits.join(" · ");
}
const landingDetail = (f) => (f.landing_page && f.landing_page !== "/" ? `landed on ${f.landing_page}` : "");

// "spring_roof_leads" reads as a database field. "Spring roof leads" reads as a campaign.
const titleish = (s) => {
  const v = str(s).replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
  return v ? v[0].toUpperCase() + v.slice(1) : "";
};

// One short line for a push notification or an email subject.
export const originLine = (lead) => {
  const o = leadOrigin(lead);
  return o.known ? o.label : "";
};
