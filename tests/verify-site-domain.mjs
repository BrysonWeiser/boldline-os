// A client's website on THEIR own web address (KB `website-builder`, step 3).
//
// Bryson, 2026-10-06: no business will print "boldlinemedia.netlify.app/site/acme" on a truck. Pins that
// the address routes to the right site, that only a working address ever goes "live", that the pages served
// on it never name or link to us, that one address can't belong to two clients, that the Netlify automation
// only ever ADDS addresses, and that search engines get a sitemap, a robots file and the right canonical.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cleanDomain, altHost, isApex, dnsRecords, domainRequest, sitemapXML, robotsTXT, checkDomain, addNetlifyAlias,
  liveDomain, publicSiteUrl, addressTaken, netlifyStatus, NETLIFY_TARGET, NETLIFY_APEX_IP } from "../netlify/lib/site-domain.mjs";
import { serveWebsiteOnDomain } from "../netlify/functions/site.mjs";
import { renderSite, SITE_PAGES } from "../netlify/lib/site-render.mjs";
import { routeFor } from "../netlify/lib/client-domain.mjs";
import { buildClientCtx } from "../netlify/lib/client-email-auto.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

// ── 1. The address Bryson types ────────────────────────────────────────────────────────────
eq("a pasted link becomes a bare address", cleanDomain(" https://www.AcmePools.com/contact?x=1 "), "www.acmepools.com");
eq("a trailing dot is dropped", cleanDomain("acmepools.com."), "acmepools.com");
for (const bad of ["", "acme", "acme pools.com", "acme_pools.com", "-acme.com", "acme.c0m", "%.com", "http://", "a".repeat(64) + ".com"])
  ok(`"${bad.slice(0, 20)}" is refused`, cleanDomain(bad) === "", cleanDomain(bad));
for (const ours of ["os.boldlinemedia.com", "boldlinemedia.com", "www.boldlinemedia.com", "boldlinemedia.netlify.app", "x.netlify.app", "boldlinemedia.co"])
  ok(`🔴 one of our own addresses can never be given to a client (${ours})`, cleanDomain(ours) === "");
eq("www and the bare address are twins", [altHost("www.acme.com"), altHost("acme.com")], ["acme.com", "www.acme.com"]);
ok("bare vs sub", isApex("acme.com") && !isApex("www.acme.com"));

// ── 2. The DNS records their web person adds ─────────────────────────────────────────────
eq("a bare address: A record at the root, and www too", dnsRecords("acmepools.com"), [{ type: "A", name: "@", value: NETLIFY_APEX_IP }, { type: "CNAME", name: "www", value: NETLIFY_TARGET }]);
eq("a www address: CNAME for www, and the root too", dnsRecords("www.acmepools.com"), [{ type: "CNAME", name: "www", value: NETLIFY_TARGET }, { type: "A", name: "@", value: NETLIFY_APEX_IP }]);
eq("any other subdomain: one CNAME", dnsRecords("site.acmepools.com"), [{ type: "CNAME", name: "site", value: NETLIFY_TARGET }]);
eq("the target is the OS site's own Netlify address", [NETLIFY_TARGET, NETLIFY_APEX_IP], ["boldlinemedia.netlify.app", "75.2.60.5"]);
const UI = src("index.html");
{
  const blk = UI.slice(UI.indexOf("const SITE_DNS_TARGET="), UI.indexOf("const wdTerms=("));
  const osRecs = new Function(`${blk}; return siteDnsRecords;`)();
  for (const h of ["acmepools.com", "www.acmepools.com", "site.acmepools.com", "a.b.acme.com"])
    eq(`🔴 the OS shows the same records as the server for ${h}`, osRecs(h), dnsRecords(h));
}

// ── 3. What a request on their address is asking for ────────────────────────────────────
eq("pages", [domainRequest("/"), domainRequest("/services/"), domainRequest("/blog/my-post/")].map((r) => r.kind + ":" + r.rest), ["page:/", "page:/services/", "page:/blog/my-post/"]);
eq("sitemap and robots", [domainRequest("/sitemap.xml").kind, domainRequest("/robots.txt").kind], ["sitemap", "robots"]);
eq("🔴 a path that could not be a page is nothing", [domainRequest("/a/b/c/d/").kind, domainRequest("/<script>/").kind], ["none", "none"]);
const sm = sitemapXML("https://www.acme.com/", SITE_PAGES, [{ slug: "tip one" }]);
ok("the sitemap lists every page and article on their address", sm.includes("<loc>https://www.acme.com/</loc>") && sm.includes("<loc>https://www.acme.com/services/</loc>") && sm.includes("<loc>https://www.acme.com/blog/tip%20one/</loc>"));
ok("robots allows everything and names the sitemap", robotsTXT("https://www.acme.com") === "User-agent: *\nAllow: /\n\nSitemap: https://www.acme.com/sitemap.xml\n");

// ── 4. 🔴 The check: the ONLY thing that may call an address live ────────────────────────
const resp = (h = {}) => ({ headers: new Headers(h) });
const dns = (cn, a) => async (h, type) => { const v = type === "CNAME" ? cn : a; if (!v) throw new Error("ENODATA"); return v; };
{
  const good = await checkDomain("www.acme.com", "acme", { fetchFn: async () => resp({ "x-site": "acme" }), resolve: dns(["boldlinemedia.netlify.app"], null) });
  ok("🔴 live when the address serves THIS client's site over https", good.live === true && good.dns === "ok" && good.https === "ok");
  const other = await checkDomain("www.acme.com", "acme", { fetchFn: async () => resp({ "x-site": "someone-else" }), resolve: dns(["boldlinemedia.netlify.app"], null) });
  ok("🔴 not live when it serves somebody else's site", other.live === false);
  const theirs = await checkDomain("acme.com", "acme", { fetchFn: async () => resp({}), resolve: dns(null, ["1.2.3.4"]) });
  ok("not live while it still points at their old host, and says so", theirs.live === false && theirs.dns === "elsewhere" && /points somewhere else/.test(theirs.note));
  const none = await checkDomain("acme.com", "acme", { fetchFn: async () => { throw new Error("ENOTFOUND"); }, resolve: dns(null, null) });
  ok("nothing pointed yet is explained in plain words", none.live === false && none.dns === "none" && /Nothing is pointed at us yet/.test(none.note));
  const cert = await checkDomain("acme.com", "acme", { fetchFn: async () => { const e = new Error("fetch failed"); e.cause = { code: "ERR_TLS_CERT_ALTNAME_INVALID" }; throw e; }, resolve: dns(null, ["75.2.60.5"]) });
  ok("a certificate still being issued is explained", cert.live === false && cert.https === "cert" && /certificate/.test(cert.note));
  ok("no dashes in anything the check says", ![good, theirs, none, cert].some((r) => /[—–]/.test(r.note)));
}

// ── 5. 🔴 Netlify: only ever ADDS ───────────────────────────────────────────────────────
{
  const calls = [];
  const fake = (site, okRead = true, okWrite = true) => async (url, o = {}) => { calls.push({ url, method: o.method || "GET", body: o.body }); return o.method === "PATCH" ? { ok: okWrite, status: okWrite ? 200 : 422, json: async () => ({}) } : { ok: okRead, status: okRead ? 200 : 500, json: async () => site }; };
  const r = await addNetlifyAlias(["www.acme.com", "acme.com"], { fetchFn: fake({ custom_domain: "os.boldlinemedia.com", domain_aliases: ["quote.stencilandthread.com"] }), token: "t", siteId: "sid" });
  const sentList = JSON.parse(calls.find((c) => c.method === "PATCH").body).domain_aliases;
  ok("🔴 the existing client addresses are kept, the new ones appended", r.ok && JSON.stringify(sentList) === JSON.stringify(["quote.stencilandthread.com", "www.acme.com", "acme.com"]));
  calls.length = 0;
  const r2 = await addNetlifyAlias(["acme.com"], { fetchFn: fake({}, false), token: "t" });
  ok("🔴 if the current list can't be read, nothing is written", !r2.ok && !calls.some((c) => c.method === "PATCH"));
  calls.length = 0;
  await addNetlifyAlias(["quote.stencilandthread.com"], { fetchFn: fake({ domain_aliases: ["quote.stencilandthread.com"] }), token: "t" });
  ok("an address already there is not written again", !calls.some((c) => c.method === "PATCH"));
  const r3 = await addNetlifyAlias(["acme.com"], { fetchFn: async () => { throw new Error("should not call"); }, token: "" });
  ok("with no token it does nothing and says to add it by hand", r3.manual === true && !r3.ok);
  ok("🔴 our own addresses are filtered out even if asked", (await addNetlifyAlias(["os.boldlinemedia.com"], { fetchFn: fake({ domain_aliases: [] }), token: "t" })).added.length === 0);
}

// The connection check is read-only and says plainly what is wrong.
{
  const seen = [];
  const f = (status, body) => async (url, o = {}) => { seen.push(o.method || "GET"); return { ok: status === 200, status, json: async () => body }; };
  const okS = await netlifyStatus({ fetchFn: f(200, { custom_domain: "os.boldlinemedia.com", domain_aliases: ["a", "b"] }), token: "t" });
  ok("a working key reads as connected", okS.connected === true && okS.aliases === 2 && /Connected to Netlify/.test(okS.note));
  const bad = await netlifyStatus({ fetchFn: f(401, {}), token: "t" });
  ok("🔴 an expired or deleted key says so and what to do", bad.connected === false && bad.set === true && /expired or been deleted/.test(bad.note));
  const none = await netlifyStatus({ fetchFn: async () => { throw new Error("should not call"); }, token: "" });
  ok("no key: not connected, nothing called", none.connected === false && none.set === false);
  ok("🔴 the status check only ever reads", seen.every((m) => m === "GET"));
  const DC = src("netlify/functions/daily-check.mjs");
  ok("🔴 the daily check alerts if the key stops working, and skips when none is set", /add\("The Netlify key for client web addresses works", ns\.set \? ns\.connected : null/.test(DC));
  ok("the OS card shows whether Netlify is connected", /action:"netlify-status"/.test(UI) && /\{nf&&<div/.test(UI));
}

// ── 6. Serving the site on their address ───────────────────────────────────────────────
const CONTENT = { hero: { eyebrow: "Pools in Phoenix", headline: "Pools done right.", lineA: "Pools", lineB: "done right.", sub: "Built well." },
  services: [{ name: "Builds", blurb: "New pools." }, { name: "Repairs", blurb: "Fixes." }, { name: "Cleaning", blurb: "Weekly." }],
  about: { headline: "Family run", story: ["Since 2001."] }, why: [], process: [], faqs: [], cta: { headline: "Ready?", sub: "Call us.", button: "Get a quote" }, marquee: [] };
const paid = { agreement: { status: "completed", terms: { price: 1500, plan: "full", care: 99 } }, invoices: { full: { paidAt: "2026-10-01T00:00:00Z", amount: 1500 } }, launchedAt: "2026-10-02T00:00:00Z" };
const SITE = { name: "Acme Pools", landingSlug: "acme", leadToken: "LT", businessPhone: "(602) 555-0100", website: { content: CONTENT, published: true, previewKey: "PK", theme: "aurora" },
  websiteDeal: { ...paid, domain: { host: "www.acmepools.com", live: true } } };
const fakeSb = (rows) => ({
  from: () => { let col = "", val = ""; const q = { select: () => q, ilike: (c, v) => { col = c; val = String(v).toLowerCase(); return q; },
    maybeSingle: async () => { const hit = rows.find((r) => String(((r.data.websiteDeal || {}).domain || {}).host || "").toLowerCase() === val); return { data: hit || null, error: null }; } }; return q; },
  storage: { from: () => ({ download: async () => ({ data: null, error: { message: "none" } }) }) },
});
const sb = fakeSb([{ id: "c9", data: SITE }]);
const U = (q = "") => new URL(`https://x.app/.netlify/functions/landing?host=h${q}`);
{
  const home = await serveWebsiteOnDomain(sb, "www.acmepools.com", "/", U());
  const h = await home.text();
  ok("🔴 their address serves their home page", home.status === 200 && /Pools done right/.test(h) && home.headers.get("x-site") === "acme");
  ok("🔴 every link on it is on THEIR address", /href="https:\/\/www\.acmepools\.com\/services\/"/.test(h) && !/\/site\/acme/.test(h));
  ok("🔴 nothing on it names us (no BoldLine, no netlify address)", !/boldline|netlify\.app/i.test(h), (h.match(/.{30}(boldline|netlify\.app).{30}/i) || [])[0]);
  ok("the visitor count posts to their own address", /https:\/\/www\.acmepools\.com\/site-hit/.test(h));
  ok("the canonical is their address", /<link rel="canonical" href="https:\/\/www\.acmepools\.com\/">/.test(h));
  const svc = await serveWebsiteOnDomain(sb, "www.acmepools.com", "/services/", U());
  ok("other pages work by their plain path", svc.status === 200 && /Builds/.test(await svc.text()));
  const bare = await serveWebsiteOnDomain(sb, "acmepools.com", "/services/", U("&preview=PK"));
  ok("🔴 the bare address sends visitors to the one that was set, same page, keeping a preview link", bare.status === 301 && bare.headers.get("location") === "https://www.acmepools.com/services/?preview=PK");
  ok("an address no client has set is left to the landing function", (await serveWebsiteOnDomain(sb, "nobody.com", "/", U())) === null);
  ok("🔴 a crafted address never reaches the lookup", (await serveWebsiteOnDomain(sb, "%.com", "/", U())) === null);
  const robots = await serveWebsiteOnDomain(sb, "www.acmepools.com", "/robots.txt", U());
  ok("robots.txt on their address", /Sitemap: https:\/\/www\.acmepools\.com\/sitemap\.xml/.test(await robots.text()));
  const map = await serveWebsiteOnDomain(sb, "www.acmepools.com", "/sitemap.xml", U());
  ok("sitemap.xml on their address", /application\/xml/.test(map.headers.get("content-type")) && /<loc>https:\/\/www\.acmepools\.com\/contact\/<\/loc>/.test(await map.text()));
  const nf = await serveWebsiteOnDomain(sb, "www.acmepools.com", "/nope/", U());
  ok("an unknown page is a 404", nf.status === 404);
  // 🔴 The same gates as our address.
  const unpaid = fakeSb([{ id: "c9", data: { ...SITE, websiteDeal: { ...SITE.websiteDeal, invoices: {} } } }]);
  const u = await serveWebsiteOnDomain(unpaid, "www.acmepools.com", "/", U());
  ok("🔴 an unpaid site is not shown on their address either", /almost ready/.test(await u.text()));
  const ur = await serveWebsiteOnDomain(unpaid, "www.acmepools.com", "/robots.txt", U());
  ok("🔴 and search engines are told to stay away until it is out", /Disallow: \//.test(await ur.text()));
  const pv = await serveWebsiteOnDomain(unpaid, "www.acmepools.com", "/", U("&preview=PK"));
  ok("the preview link works on their address before it is paid", /Pools done right/.test(await pv.text()));
  const pvMap = await serveWebsiteOnDomain(unpaid, "www.acmepools.com", "/sitemap.xml", U("&preview=PK"));
  ok("no sitemap through a preview link", pvMap.status === 404);
}
ok("🔴 on OUR address, the canonical points search engines at their address once it is live",
  /<link rel="canonical" href="https:\/\/www\.acmepools\.com\/about\/">/.test(renderSite(SITE, "about", { base: "https://os.boldlinemedia.com/site/acme", canonicalBase: "https://www.acmepools.com" })));
ok("a canonical that isn't https is ignored", /<link rel="canonical" href="https:\/\/os\.boldlinemedia\.com\/site\/acme\/">/.test(renderSite(SITE, "home", { base: "https://os.boldlinemedia.com/site/acme", canonicalBase: "javascript:x" })));

// ── 7. The address only counts once it is proven ──────────────────────────────────────────
ok("live address", liveDomain(SITE) === "www.acmepools.com" && liveDomain({ websiteDeal: { domain: { host: "x.com", live: false } } }) === "");
ok("🔴 links switch to their address only once live", publicSiteUrl(SITE, "https://os.boldlinemedia.com") === "https://www.acmepools.com/"
  && publicSiteUrl({ ...SITE, websiteDeal: { domain: { host: "www.acmepools.com", live: false } } }, "https://os.boldlinemedia.com") === "https://os.boldlinemedia.com/site/acme/");
ok("🔴 emails use their address once live", buildClientCtx(SITE).siteUrl === "https://www.acmepools.com/" && /\/site\/acme\/$/.test(buildClientCtx({ ...SITE, websiteDeal: paid }).siteUrl));
ok("the portal uses the same rule", /siteUrl: publicSiteUrl\(cl, `https:\/\/\$\{host\}`\)/.test(src("netlify/functions/portal.mjs")));
ok("the OS uses the same rule", /const live=wdLiveDomain\(client\)\?/.test(UI) && /siteUrl: wdLiveDomain\(client\)\?/.test(UI));

// ── 8. Routing, and the controls ───────────────────────────────────────────────────────
eq("their address is handed to the landing function, which falls back to the website", routeFor("www.acmepools.com", "/services/", "", "GET").kind, "landing");
const EDGE = src("netlify/edge-functions/client-domain.js");
ok("the edge function passes the page they asked for", /target\.searchParams\.set\("path", url\.pathname\)/.test(EDGE));
const LAND = src("netlify/functions/landing.mjs");
const fb = LAND.indexOf("if (!data && !slug && host) {");
ok("🔴 a landing page always wins; the website is only tried when no landing page claims the address", fb > LAND.indexOf('.ilike("data->campaignSetup->>landingDomain", host)') && fb < LAND.indexOf("if (!data) return notFoundPage();\n\n  // Rendered by handing"));
ok("🔴 a website failure there never breaks the landing function", /try \{\s*const site = await serveWebsiteOnDomain\([\s\S]{0,140}\} catch \(e\)/.test(LAND));
const FN = src("netlify/functions/website-deal.mjs");
const set = FN.slice(FN.indexOf('case "domain-set":'), FN.indexOf('case "domain-check":'));
ok("🔴 only for a client who signed for a website", /if \(!exempt\(cl\) && !isSigned\(cl\)\) return json/.test(set));
{
  const rows = [{ id: "a", data: { name: "A", websiteDeal: { domain: { host: "www.acme.com" } } } }, { id: "b", data: { name: "B", campaignSetup: { landingDomain: "quote.bee.com" } } }];
  ok("🔴 another client's website address is taken, with or without www", addressTaken(rows, "z", "acme.com").id === "a" && addressTaken(rows, "z", "www.acme.com").id === "a");
  ok("🔴 another client's landing page address is taken", addressTaken(rows, "z", "quote.bee.com").id === "b");
  ok("a client's own address isn't taken from themselves, and a free one is free", addressTaken(rows, "a", "www.acme.com") === null && addressTaken(rows, "z", "free.com") === null);
  ok("the server uses that rule before saving", set.indexOf("addressTaken(all, clientId, host)") > 0 && set.indexOf("addressTaken(all, clientId, host)") < set.indexOf("await save("));
}
ok("their own landing page address can't double as the website", /Their ad landing page already uses that address/.test(set));
ok("🔴 the address is saved on the server-owned deal, never by the browser", /await save\(\{ domain: \{ host, setAt/.test(set));
const chk = FN.slice(FN.indexOf('case "domain-check":'), FN.indexOf('case "domain-remove":'));
ok("🔴 live needs the check to pass AND the site to be out and paid", /const live = r\.live && out;/.test(chk) && /const out = !!\(cl\.website && cl\.website\.published\) && !publishLock\(cl\);/.test(chk));
const launch = FN.slice(FN.indexOf('case "launch":'), FN.indexOf('case "sync":'));
ok("putting the site live checks their address, before the you're-live email", launch.indexOf("checkDomain(dm.host") > 0 && launch.indexOf("checkDomain(dm.host") < launch.indexOf('"website_live"'));
ok("🔴 the Netlify token is read from the environment, never written anywhere", /process\.env\.NETLIFY_API_TOKEN/.test(FN) && !/NETLIFY_API_TOKEN\s*[:=]\s*["'`][^"'`]/.test(FN));
ok("the OS card asks before removing an address", /window\.confirm\(`Stop using \$\{d\.host\}/.test(UI));
ok("🔴 the instructions he sends their web person carry no dashes or emojis", (() => { const i = UI.indexOf("const forThem=d?"); const m = i > 0 ? UI.slice(i, UI.indexOf(':"";', i)) : ""; return !!m && !/[\u2014\u2013]/.test(m) && !/\p{Extended_Pictographic}/u.test(m) && /MX records/.test(m) && /grey cloud/.test(m); })());
ok("the OS card shows only once they signed for a website", /const shown=wdExempt\(client\)\|\|wdSigned\(client\);/.test(UI) && /if\(!shown\) return null;/.test(UI));
ok("the sitemap also works on our address", /where\.seg === "sitemap\.xml" && !where\.post/.test(src("netlify/functions/site.mjs")));

ok("the address card also shows before the site is built (DNS takes hours, the build a minute)", (UI.match(/<SiteDomainCard client=\{client\} onUpdate=\{onUpdate\}\/>/g) || []).length === 2);

ok("🔴 My Ads (the house account) has no Website tab unless a site was built there on purpose", /client\.internal&&k==="website"&&!\(client\.website&&typeof client\.website==="object"&&client\.website\.content\)/.test(UI));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-site-domain: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
