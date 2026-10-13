// What Bryson is selling a prospect: ads, a website, or both (KB `website-prospects`).
//
// Bryson, 2026-10-12: "I want to make a category for companies that need websites and or need better
// websites and then I also want to be able to categorize them in outreach if I want to".
//
// Stored on the prospect's own record (`data.pitch`), so no database change was needed. Everything found
// before this existed came from the ads search, so a prospect with no label counts as ads, and a
// prospect labelled "both" shows up under either filter.
// Mirrored in index.html (outPitchOf / outMatchesPitch); `verify-website-prospects` runs both copies.

export const PITCHES = [
  { id: "ads", label: "Ads" },
  { id: "website", label: "Website" },
  { id: "both", label: "Both" },
];
export const cleanPitch = (v) => (["ads", "website", "both"].includes(String(v)) ? String(v) : "");
export const pitchOf = (p) => cleanPitch(p && p.data && p.data.pitch) || "ads";
// filter "" = everyone; "ads" or "website" also takes the prospects labelled "both".
export const matchesPitch = (p, filter) => {
  const f = cleanPitch(filter);
  if (!f) return true;
  const v = pitchOf(p);
  return v === f || v === "both";
};
export const pitchCounts = (list) => {
  const rows = Array.isArray(list) ? list : [];
  return { all: rows.length, ads: rows.filter((p) => matchesPitch(p, "ads")).length, website: rows.filter((p) => matchesPitch(p, "website")).length };
};
