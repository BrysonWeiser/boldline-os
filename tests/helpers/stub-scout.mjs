// Google Places and the homepage ad-tag reader, replaced by whatever the test says they
// found. Both record their arguments so a test can assert WHICH markets were searched.

const S = () => globalThis.__STUB;

export const placesSearch = async (args) => {
  S().places.push(args);
  const f = S().placesResult;
  return typeof f === "function" ? f(args) : (f || { ok: true, results: [] });
};

export const inspectAdTech = async (site) => {
  S().inspected.push(site);
  const f = S().adTechResult;
  return typeof f === "function" ? f(site) : (f || { reachable: true, googleAds: "no", metaAds: "no" });
};
