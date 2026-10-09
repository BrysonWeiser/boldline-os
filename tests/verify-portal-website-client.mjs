// A website-only client's portal speaks about their website (Bryson, 2026-10-09: "show me what the client portal
// for a website client would look like and then also make sure that it fits mobile properly"). Rendered, it was
// showing the ADS portal's furniture: a "qualified" lead count and a line about invoices built from it, "Your
// Package: —", an ad budget box, and the ads agreement marked "Expired". What has to stay true:
//  1. Enquiries: no qualified count, no invoice line. Ad clients keep both.
//  2. Account: their website plan, their information without ad-only boxes, their WEBSITE agreement and its status.
//  3. The page carries a phone viewport and nothing is built wider than a phone (driven at 360 to 1600 in a browser).
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const P = await import("../netlify/functions/portal.mjs");
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const web = { id: "c1", name: "Copper Ridge Plumbing", contactName: "Dana", packageId: "w-site", portalToken: "tok",
  websiteDeal: { price: 1500, care: 100, tier: "signature", agreement: { status: "completed", signedAt: ago(10), terms: { price: 3500, care: 150, tier: "signature" } }, invoices: { full: { paidAt: ago(9) } } },
  website: { published: true }, leadsLog: [{ name: "Sam", phone: "4805550101", source: "website", receivedAt: ago(1) }, { name: "Ana", source: "website", receivedAt: ago(40) }] };
const h = P._internal.makePortalHTML(web, P._internal.findPkg("w-site"), null, { siteUrl: "https://copper.example/" });
const strip = (x) => x.replace(/<script[\s\S]*?<\/script>/g, "");
// 1
ok("🔴 enquiries: no qualified count and no invoice line", !/Counted as qualified/.test(strip(h)) && !/your invoice is based on/.test(h) && /Your enquiries/.test(h) && /In the last 30 days/.test(h));
const ads = { ...web, packageId: "g-launch", websiteDeal: undefined, contractStatus: "active", contractSigned: true, leadsLog: web.leadsLog };
const ha = P._internal.makePortalHTML(ads, P._internal.findPkg("g-launch"), null);
ok("an ad client keeps both", /Counted as qualified/.test(ha) && /your invoice is based on/.test(ha));
// 2
ok("🔴 their website plan, with its real numbers, in place of an empty ads package", /Your Website Plan/.test(h) && /Signature website/.test(h) && /\$3,500/.test(h) && /\$150\/mo/.test(h) && !/Your Package:/.test(h));
ok("🔴 no ad budget, no shop box, no 'who looks after your site' box", !/Monthly Ad Budget/.test(h) && !/If People Buy Straight From Your Website/.test(h) && !/Two quick things about your own site/.test(h) && /Everything we build your website from/.test(h));
ok("🔴 their WEBSITE agreement, signed, never the ads contract marked Expired", /Your website agreement/.test(h) && /Signed /.test(h.slice(h.indexOf("Agreement status"))) && !/Advertising Services Agreement/.test(h) && !/>Expired</.test(h));
ok("an agreement out for signature says so", /Waiting for your signature/.test(P._internal.makePortalHTML({ ...web, websiteDeal: { agreement: { status: "sent" } } }, P._internal.findPkg("w-site"), null, {})));
ok("ad clients still get their package and their contract", /Your Package:/.test(ha) && /Campaign Setup/.test(ha));
// 3
ok("it is built for phones", /width=device-width/.test(h));
if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-portal-website-client: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
