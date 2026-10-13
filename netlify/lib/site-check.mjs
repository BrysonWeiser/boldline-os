// Lead Scout's free website check (KB `website-prospects`).
//
// Bryson, 2026-10-12: "for the lead scout section I want to make a category for companies that need
// websites and or need better websites and then I also want to be able to categorize them in outreach".
//
// It reads a business's public homepage exactly as a visitor's browser would, and reports only what it
// SAW: no website of their own, a website that does not load, or a website with specific problems anyone
// can check for themselves (no mobile layout, no padlock, a footer stuck in 2019, a free builder address).
// No AI and no API key, so it costs nothing and runs on every prospect. In website mode it runs BEFORE the
// paid research, so a business whose site is already fine never costs a research credit.
//
// 🔴 NEVER A NEGATIVE FROM MISSING EVIDENCE, the same rule as the ad checks. A site that times out or
// blocks us is "unknown", never "broken": Bryson says these lines to the owner on a cold call, and "your
// website is down" said to somebody whose website is fine ends the call. Likewise the checks that look for
// things ON the page (a call button, a quote form) only run when the page arrived with its words in it,
// because a site that builds itself in the browser shows us an empty shell, and an empty shell has no
// buttons in it.
//
// The words each problem is described with are STORED on the result, not looked up later, so the Lead
// Scout card, the Outreach card and the message writer all say exactly the same thing.

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
export const CHECK_VERSION = 1;

// ─── Places that are not a website of their own ─────────────────────────────
// A listing that points here is a business without a site, said kindly and accurately.
export const SOCIAL_HOSTS = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/i, "a Facebook page"],
  [/(^|\.)instagram\.com$/i, "an Instagram page"],
  [/(^|\.)yelp\.com$/i, "a Yelp page"],
  [/(^|\.)linktr\.ee$/i, "a Linktree page"],
  [/(^|\.)nextdoor\.com$/i, "a Nextdoor page"],
  [/(^|\.)(angi\.com|angieslist\.com|homeadvisor\.com|thumbtack\.com|houzz\.com|porch\.com|bark\.com)$/i, "a directory listing"],
  [/(^|\.)(bbb\.org|yellowpages\.com|mapquest\.com|manta\.com|chamberofcommerce\.com)$/i, "a directory listing"],
  [/(^|\.)(google\.com|g\.page|goo\.gl)$/i, "their Google listing"],
  [/(^|\.)(tiktok\.com|x\.com|twitter\.com|linkedin\.com|youtube\.com)$/i, "a social media page"],
];
// Google's free "business.site" websites were switched off in 2024, so a listing still pointing at one
// has no working website at all.
const GOOGLE_FREE_SITE = /(^|\.)business\.site$/i;
// Still on the free address a website builder hands out, rather than their own name.
export const BUILDER_HOSTS = [
  [/\.wixsite\.com$/i, "Wix"], [/\.godaddysites\.com$/i, "GoDaddy"], [/\.weebly(site)?\.com$/i, "Weebly"],
  [/\.square\.site$/i, "Square"], [/\.wordpress\.com$/i, "WordPress"], [/\.webflow\.io$/i, "Webflow"],
  [/\.carrd\.co$/i, "Carrd"], [/^sites\.google\.com$/i, "Google Sites"], [/\.squarespace\.com$/i, "Squarespace"],
  [/\.jimdosite\.com$/i, "Jimdo"], [/\.site123\.me$/i, "Site123"], [/\.mystrikingly\.com$/i, "Strikingly"],
];

// ─── What a dead website looks like when it does answer ─────────────────────
const PARKED = /(this domain|the domain|domain name)\s+(is|may be|might be)\s+for sale|buy this domain|this domain (is|has been) parked|domain (has|is) expired|this domain name has expired|parked free|sedoparking|hugedomains|parkingcrew|bodis\.com|afternic|dan\.com\/buy-domain/i;
const SUSPENDED = /account (has been |is )?suspended|this (site|website|account) (has been )?suspended|bandwidth limit exceeded/i;
const DEFAULT_PAGE = /welcome to nginx|apache2? (ubuntu |debian )?default page|^\s*it works!|index of \/|default web site page|future home of something quite cool|web server'?s default page/i;
const COMING_SOON = /coming soon|under construction|launching soon|site is being built|website is being built|check back soon/i;
// A way to ask for a quote or book, on the homepage. Any form counts too.
const QUOTE_PATH = /calendly\.com|housecallpro|getjobber|jobber\.com|servicetitan|acuityscheduling|setmore|booksy|vagaro|schedulicity|squareup\.com\/appointments|square\.site\/book|mindbodyonline|fresha\.com|book (now|online|an appointment|a service)|schedule (now|online|service|an appointment)|request (a |an )?(free )?(quote|estimate)|get (a |an |your )?(free )?(quote|estimate)|free (quote|estimate)/i;
const OLD_TECH = [/<frameset/i, /<marquee/i, /<blink/i, /\.swf\b/i, /<font\s/i, /<center>/i, /\bbgcolor\s*=/i];

// ─── The problems, in the words Bryson would use ────────────────────────────
// `label` is the short version for a list; `says` finishes the sentence "Their website ...".
// `strong` problems on their own make a site worth replacing; two minor ones together do.
export const problem = (id, extra = {}) => {
  const P = {
    bad_cert:      { strong: true,  label: "Broken security certificate", says: "shows a security warning before it even opens" },
    no_https:      { strong: true,  label: "No padlock, so browsers mark it Not secure", says: "has no padlock, so browsers mark it Not secure" },
    no_mobile:     { strong: true,  label: "Not built for phones", says: "isn't built for phones" },
    builder:       { strong: true,  label: `Still on a free ${extra.builder || "builder"} address`, says: `is still on a free ${extra.builder || "builder"} address${extra.host ? ` (${extra.host})` : ""}` },
    old_copyright: { strong: true,  label: `Footer still says ${extra.year || "an old year"}`, says: `still says © ${extra.year || "an old year"} in the footer` },
    old_tech:      { strong: true,  label: "Built with very old web code", says: "is built with web code from the early 2000s" },
    slow:          { strong: false, label: `Took ${extra.secs || "several"} seconds to load`, says: `took ${extra.secs || "several"} seconds to load` },
    no_call_link:  { strong: false, label: "No tap-to-call button", says: "has no tap-to-call button" },
    no_quote_path: { strong: false, label: "No quote form or online booking on the homepage", says: "has no quote form or online booking on the homepage" },
    no_description:{ strong: false, label: "No description for Google to show", says: "has no description for Google to show in search results" },
    listing_missing_site: { strong: false, label: "Their Google listing doesn't link to it", says: "isn't linked from their Google listing" },
  }[id];
  return P ? { id, ...P } : null;
};

export const hostOf = (u) => {
  const raw = String(u || "").trim();
  if (!raw) return "";
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
};
const socialLabel = (host) => { const hit = SOCIAL_HOSTS.find(([re]) => re.test(host)); return hit ? hit[1] : ""; };
const builderOf = (host) => { const hit = BUILDER_HOSTS.find(([re]) => re.test(host)); return hit ? hit[1] : ""; };

// The words a visitor actually reads, without scripts, styles or markup.
export const visibleText = (html) => String(html || "")
  .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&copy;|&#169;|&#xa9;/gi, "©")
  .replace(/\s+/g, " ").trim();

// The newest year in any copyright line. A footer that writes its year with code has none in the HTML,
// so it simply never trips this.
export const copyrightYear = (html) => {
  const src = String(html || "").replace(/&copy;|&#0*169;|&#xa9;/gi, "©");
  let best = 0;
  const re = /(?:©|\(c\)|\bcopyright\b)([^<]{0,48})/gi;
  let m;
  while ((m = re.exec(src))) {
    for (const y of (m[1].match(/\b(?:199\d|20\d\d)\b/g) || [])) best = Math.max(best, Number(y));
  }
  return best;
};

const base = (extra) => ({ v: CHECK_VERSION, checkedAt: new Date(extra.now || Date.now()).toISOString(), problems: [], readable: false, ...extra });

// ─── Reading one page that did arrive ────────────────────────────────────────
// ctx: { url, finalUrl, ms, now, insecure, certBroken, builder, builderHost, listingMissing }
export const analyzeSite = (html, ctx = {}) => {
  const now = Number(ctx.now) || Date.now();
  const src = String(html || "").slice(0, 600000);
  const text = visibleText(src);
  const words = text ? text.split(" ").length : 0;
  const readable = words >= 60;
  const title = ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(src) || [])[1] || "").replace(/\s+/g, " ").trim();
  const head = `${title} ${text.slice(0, 600)}`;
  const out = base({ now, url: ctx.finalUrl || ctx.url || "", ms: Math.round(Number(ctx.ms) || 0), words, readable });

  // A page that answered but is not their website.
  const dead = (reason) => ({ ...out, state: "broken", reason });
  if (PARKED.test(src) && words < 400) return dead("Their domain is parked or up for sale");
  if (SUSPENDED.test(head) && words < 250) return dead("Their website's hosting has been suspended");
  if (DEFAULT_PAGE.test(head) && words < 300) return dead("Their web address shows a blank server page instead of a website");
  if (COMING_SOON.test(head) && words < 150) return dead("Their website is just a 'coming soon' page");

  const P = [];
  if (ctx.certBroken) P.push(problem("bad_cert"));
  else if (ctx.insecure) P.push(problem("no_https"));
  if (!/<meta\b[^>]*\bname\s*=\s*["']?viewport/i.test(src)) P.push(problem("no_mobile"));
  if (ctx.builder) P.push(problem("builder", { builder: ctx.builder, host: ctx.builderHost }));
  const year = copyrightYear(src);
  const thisYear = new Date(now).getUTCFullYear();
  if (year && year <= thisYear - 3) P.push(problem("old_copyright", { year }));
  if (OLD_TECH.filter((re) => re.test(src)).length >= 2 || /<frameset|\.swf\b/i.test(src)) P.push(problem("old_tech"));
  if (Number(ctx.ms) > 6000) P.push(problem("slow", { secs: Math.round(Number(ctx.ms) / 1000) }));
  // Only judged when the page arrived with its words in it (see the header).
  if (readable && !/href\s*=\s*["']?\s*tel:/i.test(src)) P.push(problem("no_call_link"));
  if (readable && !/<form\b/i.test(src) && !QUOTE_PATH.test(src)) P.push(problem("no_quote_path"));
  if (!/<meta\b[^>]*\bname\s*=\s*["']?description/i.test(src) && !/<meta\b[^>]*\bproperty\s*=\s*["']?og:description/i.test(src)) P.push(problem("no_description"));
  if (ctx.listingMissing) P.push(problem("listing_missing_site"));

  const problems = P.filter(Boolean).sort((a, b) => Number(b.strong) - Number(a.strong));
  const strong = problems.filter((p) => p.strong).length, minor = problems.length - strong;
  if (strong >= 1 || minor >= 2) return { ...out, state: "weak", problems };
  if (!readable) return { ...out, state: "unknown", problems,
    note: "Their site builds itself in the browser, so only the basics could be checked, and those were fine. Look at it on your phone before you call." };
  return { ...out, state: "ok", problems };
};

// ─── Fetching it ─────────────────────────────────────────────────────────────
const errKind = (e) => {
  const code = String((e && e.cause && e.cause.code) || (e && e.code) || "");
  if ((e && e.name) === "AbortError") return "timeout";
  if (code === "ENOTFOUND") return "dns";
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY|ALTNAME/i.test(code + " " + String((e && e.cause && e.cause.message) || ""))) return "cert";
  return code ? code.toLowerCase() : "network";
};

const fetchPage = async (target, fetchImpl, timeoutMs) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetchImpl(target, {
      redirect: "follow", signal: ctrl.signal,
      headers: { "user-agent": BROWSER_UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" },
    });
    const html = res.ok ? String(await res.text()).slice(0, 600000) : "";
    return { ok: res.ok, status: res.status, html, finalUrl: res.url || target, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, kind: errKind(e), ms: Date.now() - started };
  } finally { clearTimeout(timer); }
};

// website: whatever the listing or the research said. from: "places" when it came off a Google listing,
// so an empty value there is a FACT about the listing rather than a gap in our knowledge.
export const checkWebsite = async (website, { from = "", listingMissing = false, fetchImpl = fetch, now = Date.now(), timeoutMs = 8000 } = {}) => {
  const raw = String(website || "").trim();
  const said = raw.toLowerCase();
  if (!raw || /^(unknown|n\/a|na|-)$/.test(said)) {
    if (from === "places") return base({ now, state: "none", reason: "Their Google listing has no website on it" });
    return base({ now, state: "unknown", note: "No website on file, so there was nothing to check." });
  }
  if (/^(none|no website|no)$/.test(said)) return base({ now, state: "none", reason: "Our research found no website of their own" });

  const host = hostOf(raw);
  if (!host || !/\./.test(host)) return base({ now, state: "unknown", note: "That website address could not be read." });
  const social = socialLabel(host);
  if (social) return base({ now, state: "none", url: raw, reason: social === "their Google listing" ? "Their only web presence is their Google listing" : `Their only website is ${social}` });
  if (GOOGLE_FREE_SITE.test(host)) return base({ now, state: "none", url: raw, reason: "Their website was one of Google's free sites, which Google switched off in 2024" });

  const builder = builderOf(host);
  // Their HOMEPAGE, whatever page the listing linked. A deep link that 404s says nothing about the site.
  let given = "";
  try { given = `https://${new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw).hostname}/`; } catch { given = `https://${host}/`; }
  let r = await fetchPage(given, fetchImpl, timeoutMs);
  // Some hosts only answer on www (or only without it). DNS failing on both is checked below.
  if (!r.ok && r.kind !== "cert") {
    let alt = "";
    try { const u = new URL(given); u.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : "www." + u.hostname; alt = u.href; } catch {}
    if (alt) { const r2 = await fetchPage(alt, fetchImpl, timeoutMs); if (r2.ok || (r2.status && !r.status)) r = { ...r2, firstKind: r.kind }; else r.altKind = r2.kind; }
  }
  // No secure version at all: try the plain one. Working only that way IS the finding.
  let insecure = false, certBroken = false;
  if (!r.ok && (r.kind === "cert" || ["econnrefused", "econnreset", "timeout", "network"].includes(r.kind) || r.status >= 500)) {
    const plain = await fetchPage(given.replace(/^https:\/\//i, "http://"), fetchImpl, timeoutMs);
    if (plain.ok) { certBroken = r.kind === "cert"; insecure = !certBroken; r = plain; }
  }

  if (!r.ok) {
    if (r.kind === "dns" && (r.altKind === "dns" || r.firstKind === "dns" || !r.altKind)) {
      // 🔴 Only a Google listing's own link is trusted to be THEIR address. An address the research
      // found could simply be the wrong one, and "your website doesn't load" said to an owner whose
      // site is fine ends the call.
      if (from !== "places") return base({ now, state: "unknown", url: raw, note: "The website address on file doesn't load. It may be the wrong address, so look them up before you call." });
      return base({ now, state: "broken", url: raw, reason: "Their web address doesn't load at all (the domain isn't connected to anything)" });
    }
    if ([404, 410].includes(r.status)) return base({ now, state: "broken", url: raw, reason: `Their website's homepage shows an error page (${r.status} not found)` });
    if (r.status >= 500) return base({ now, state: "broken", url: raw, reason: `Their website shows a server error (${r.status})` });
    // A block, a timeout or a hiccup tells us nothing about THEIR site. Said as unknown, with why.
    const why = r.status ? `it answered with ${r.status}, which usually means it blocks automated checks` : r.kind === "timeout" ? "it didn't answer within 8 seconds" : `it couldn't be reached (${r.kind})`;
    return base({ now, state: "unknown", url: raw, note: `Couldn't read their website: ${why}. Open it on your phone before you call.` });
  }

  const finalHost = hostOf(r.finalUrl);
  const forwards = socialLabel(finalHost);
  if (forwards) return base({ now, state: "none", url: raw, reason: `Their website just forwards to ${forwards}` });
  if (/^http:\/\//i.test(r.finalUrl || "") && !certBroken) insecure = true;
  return analyzeSite(r.html, { url: raw, finalUrl: r.finalUrl, ms: r.ms, now, insecure, certBroken,
    builder: builder || builderOf(finalHost), builderHost: builder ? host : finalHost, listingMissing });
};

// ─── How much this business needs a website, as a score factor ──────────────
// In website mode this REPLACES the AI's "gap" factor, the same way the money math replaces "budget":
// the number comes from what was checked, so it can never disagree with the reasons shown beside it.
// A site that already does the job caps the whole score, so it cannot sit at the top of a website list.
export const SITE_OK_CAP = 40;
export const siteNeed = (check) => {
  const c = check && typeof check === "object" ? check : null;
  const says = (list) => { const s = list.map((p) => p.says); return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`; };
  if (!c) return { points: 10, cap: 100, why: "Their website hasn't been checked yet, so look at it before you call." };
  if (c.state === "none") return { points: 25, cap: 100, why: `${c.reason}, so the website is the whole pitch.` };
  if (c.state === "broken") return { points: 25, cap: 100, why: `${c.reason}.` };
  const probs = Array.isArray(c.problems) ? c.problems : [];
  if (c.state === "weak") {
    const strong = probs.filter((p) => p.strong).length, minor = probs.length - strong;
    return { points: Math.min(23, 9 + 5 * strong + 2 * minor), cap: 100, why: `Their website ${says(probs.slice(0, 3))}.` };
  }
  if (c.state === "ok") return { points: 3, cap: SITE_OK_CAP,
    why: "Their website passed the checks (works on phones, has a padlock, nothing obviously out of date), so a new one is a hard sell.",
    capWhy: "their website already passed the checks, so a new one is a hard sell." };
  return { points: 10, cap: 100, why: c.note || "Their website couldn't be checked, so look at it before you call." };
};

// Which candidates to research first in website mode: no site, then a dead one, then the most broken.
export const siteRank = (check) => {
  const s = check && check.state;
  if (s === "none") return 0;
  if (s === "broken") return 1;
  if (s === "weak") return 2 + (30 - siteNeed(check).points) / 100;
  if (s === "unknown" || !s) return 3;
  return 9;   // "ok": skipped in website mode
};
