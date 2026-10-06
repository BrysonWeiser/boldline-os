// A client's website on their OWN address (acmepools.com), not ours (KB `website-builder`, step 3).
//
// Bryson, 2026-10-06: a business will not put "boldlinemedia.netlify.app/site/acme" on a truck. The site
// stays hosted here; the client (or whoever holds their domain) points it at us with one or two DNS
// records, and the existing client-domain edge function hands any address it does not recognise to the
// landing function, which now falls back to a website when no landing page claims the address.
//
// The address lives on `websiteDeal.domain` = { host, setAt, live, liveAt, check, alias }, which is
// SERVER-OWNED like the rest of the deal: the OS cannot write it by saving a stale copy of the client.
// `live` is only ever set by a check that fetched the real site over https on that address, so every
// email, portal link and canonical tag that switches to the client's address switches only once it works.
//
// Pure functions only, so the routing, the DNS instructions and the checks are all testable.

import { isOwnHost, normalizeHost } from "./client-domain.mjs";

// Where client DNS points. The OS site's own Netlify address (a CNAME target) and Netlify's load balancer
// for a bare domain, which cannot hold a CNAME. Both are Netlify's published values for external DNS.
export const NETLIFY_TARGET = "boldlinemedia.netlify.app";
export const NETLIFY_APEX_IP = "75.2.60.5";

// Whatever Bryson pastes ("https://www.AcmePools.com/contact", "acmepools.com ") becomes a bare
// hostname, or "" if it is not one we may use.
export function cleanDomain(input) {
  const raw = String(input || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  const h = normalizeHost(raw);
  if (!h || h.length > 253) return "";
  const labels = h.split(".");
  if (labels.length < 2 || labels.some((l) => !l || l.length > 63 || l.startsWith("-") || l.endsWith("-"))) return "";
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1]) && !/^xn--/.test(labels[labels.length - 1])) return "";
  // 🔴 Never one of OUR addresses: claiming os.boldlinemedia.com or a netlify.app name for a client would
  // send the OS itself to their website, or be refused by the router anyway and look broken.
  if (isOwnHost(h) || /(^|\.)boldlinemedia\./.test(h)) return "";
  return h;
}

// The same address with or without "www.", so both forms reach the site and one sends to the other.
export const altHost = (h) => (h.startsWith("www.") ? h.slice(4) : `www.${h}`);

// A bare domain ("acmepools.com") vs a subdomain ("www.acmepools.com", "site.acmepools.com"). Good
// enough without the public-suffix list for the DNS advice it drives; a two-part country domain such as
// acme.co.uk reads as a subdomain, which only changes which record we suggest first.
export const isApex = (h) => h.split(".").length === 2;

export const domainOf = (cl) => ((cl && cl.websiteDeal) || {}).domain || null;
// The client's own address, but only once a check has proved it serves their site over https.
export const liveDomain = (cl) => { const d = domainOf(cl); return d && d.live && d.host ? d.host : ""; };

// Where the public site lives: their own address once it works, our address until then.
export function publicSiteUrl(cl, ownBase) {
  const d = liveDomain(cl);
  if (d) return `https://${d}/`;
  const base = String(ownBase || "").replace(/\/+$/, "");
  return cl && cl.landingSlug && base ? `${base}/site/${encodeURIComponent(cl.landingSlug)}/` : "";
}

// The DNS records to add, in plain terms, for whoever manages the domain. `www` and the bare domain are
// both set up so either one a customer types works.
export function dnsRecords(host) {
  const h = cleanDomain(host);
  if (!h) return [];
  if (h.startsWith("www.") && isApex(h.slice(4))) {
    return [{ type: "CNAME", name: "www", value: NETLIFY_TARGET }, { type: "A", name: "@", value: NETLIFY_APEX_IP }];
  }
  if (isApex(h)) {
    return [{ type: "A", name: "@", value: NETLIFY_APEX_IP }, { type: "CNAME", name: "www", value: NETLIFY_TARGET }];
  }
  return [{ type: "CNAME", name: h.split(".").slice(0, -2).join("."), value: NETLIFY_TARGET }];
}

// What a request on a client's address is asking for: a page (mapped onto the /site/<slug>/ shape the
// site function already understands), the sitemap, robots.txt, or nothing we serve.
export function domainRequest(path) {
  const p = "/" + String(path || "/").replace(/^\/+/, "");
  if (p === "/robots.txt") return { kind: "robots" };
  if (p === "/sitemap.xml") return { kind: "sitemap" };
  if (/^\/[a-z0-9._~%-]*(\/[a-z0-9._~%-]*){0,2}\/?$/i.test(p)) return { kind: "page", rest: p };
  return { kind: "none" };
}

// The site's address list for search engines: every page that exists and every article already out.
export function sitemapXML(base, pages, posts = []) {
  const b = String(base || "").replace(/\/+$/, "");
  const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const urls = (pages || []).map((p) => `${b}/${p.path ? p.path + "/" : ""}`)
    .concat((posts || []).map((p) => `${b}/blog/${encodeURIComponent(p.slug)}/`));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${x(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export const robotsTXT = (base) => `User-agent: *\nAllow: /\n\nSitemap: ${String(base || "").replace(/\/+$/, "")}/sitemap.xml\n`;

// 🔴 Is the address really serving THIS client's site, over https? The only thing that may set `live`.
// `fetchFn` and `resolve` are passed in so this is testable; `resolve(host, type)` returns an array or
// throws. The https fetch is the proof; DNS is only read to say WHAT is wrong in plain words.
export async function checkDomain(host, slug, { fetchFn, resolve } = {}) {
  const h = cleanDomain(host);
  if (!h) return { live: false, note: "That isn't a web address we can use." };
  let dns = "none";
  try {
    const cn = await resolve(h, "CNAME").catch(() => []);
    const a = await resolve(h, "A").catch(() => []);
    if ((cn || []).some((c) => String(c).replace(/\.$/, "").toLowerCase() === NETLIFY_TARGET)) dns = "ok";
    else if ((a || []).includes(NETLIFY_APEX_IP)) dns = "ok";
    else if ((cn || []).length || (a || []).length) dns = "elsewhere";
  } catch { dns = "unknown"; }
  let served = false, https = "no";
  try {
    const r = await fetchFn(`https://${h}/`, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000) });
    https = "ok";
    served = String(r.headers.get("x-site") || "") === String(slug || "");
  } catch (e) {
    https = /cert|ssl|tls|self.signed|altname/i.test(String((e && (e.cause && e.cause.code || e.cause && e.cause.message)) || (e && e.message) || "")) ? "cert" : "no";
  }
  const live = served;
  const note = live ? "Working. The website is live on this address."
    : dns === "none" ? "Nothing is pointed at us yet. Add the two records in step 2 in their domain account. It can take a few hours to take effect."
    : dns === "elsewhere" ? "The address still points somewhere else, probably their old website. Change the records in step 2 to the values shown."
    : https === "cert" ? "The address points at us. The security certificate is still being issued, which usually takes a few minutes and can take up to a day."
    : "The address points at us, but the site isn't answering on it yet. Give it a few minutes and check again.";
  return { live, dns, https, note, checkedAt: new Date().toISOString() };
}

// 🔴 One address, one owner. Another client's website OR landing page on the same address (or its www
// twin) would make the lookup ambiguous, and a landing page always wins it, so the website would silently
// vanish. Returns the client row already using it, or null.
export function addressTaken(rows, clientId, host) {
  const hs = [host, altHost(host)];
  return (rows || []).find((r) => r && r.id !== clientId && hs.some((h) =>
    String((((r.data || {}).websiteDeal || {}).domain || {}).host || "").toLowerCase() === h
    || String(((r.data || {}).campaignSetup || {}).landingDomain || "").toLowerCase() === h)) || null;
}

// ── Netlify (optional) ────────────────────────────────────────────────────────────────────────
// With a NETLIFY_API_TOKEN set, adding a client's address to this Netlify site happens from the OS,
// so Bryson never opens Netlify for a new client. Without it, the OS tells him the one Netlify step.
// Read-only: is the Netlify key there and still working? Used by the OS card (so Bryson can see it is
// connected before his first website client) and by the daily check (a key that expires or is revoked
// would otherwise only show up the day a client's address fails to add).
export async function netlifyStatus({ fetchFn, token, siteId }) {
  if (!token) return { connected: false, set: false, note: "Not connected. Each new client address needs one step in Netlify." };
  try {
    const r = await fetchFn(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId || NETLIFY_TARGET)}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) return { connected: false, set: true, note: r.status === 401 || r.status === 403 ? "The Netlify key was refused. It may have expired or been deleted. Make a new one and replace NETLIFY_API_TOKEN." : `Netlify answered ${r.status}.` };
    const site = await r.json();
    return { connected: true, set: true, site: site.custom_domain || site.name || "", aliases: Array.isArray(site.domain_aliases) ? site.domain_aliases.length : 0,
      note: "Connected to Netlify. Client addresses are added for you." };
  } catch (e) { return { connected: false, set: true, note: `Couldn't reach Netlify (${e.message}).` }; }
}

// 🔴 ONLY EVER ADDS. The alias list is read first and written back whole with the new names appended,
// so an existing client's address (quote.stencilandthread.com) can never be dropped by this. If the read
// fails nothing is written.
export async function addNetlifyAlias(hosts, { fetchFn, token, siteId }) {
  if (!token) return { ok: false, manual: true, note: "Add it in Netlify by hand (no Netlify token set)." };
  const api = `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId || NETLIFY_TARGET)}`;
  const auth = { authorization: `Bearer ${token}` };
  const cur = await fetchFn(api, { headers: auth });
  if (!cur.ok) return { ok: false, note: `Netlify wouldn't read the site (${cur.status}).` };
  const site = await cur.json();
  const have = Array.isArray(site.domain_aliases) ? site.domain_aliases : [];
  const want = (hosts || []).map(cleanDomain).filter(Boolean).filter((h) => !have.includes(h) && h !== site.custom_domain);
  if (!want.length) return { ok: true, added: [] };
  const up = await fetchFn(api, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ domain_aliases: [...have, ...want] }) });
  if (!up.ok) return { ok: false, note: `Netlify wouldn't add it (${up.status}).` };
  return { ok: true, added: want };
}
