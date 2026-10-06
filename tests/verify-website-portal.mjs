// The client portal's Website tab, and the visitor counting behind it.
// Run: node tests/verify-website-portal.mjs
//
// Bryson, 2026-10-06: *"add a way for the client to view the analytics and other details (in the client
// portal)"*. KB `website-builder`. Every check runs the code; the 🔴 ones cost a client money or trust.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { websitePortalHTML, websiteStatus, hasWebsite, WEBSITE_PORTAL_JS } from "../netlify/lib/portal-website.mjs";
import { summarize, sourceOf, deviceOf, BOT_UA, visitorHash } from "../netlify/lib/site-stats.mjs";
import { renderSite } from "../netlify/lib/site-render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");

const T = { price: 1500, plan: "half", care: 99, blog: true, blogMonthly: 149, blogPosts: 4 };
const ag = (status) => ({ status, envelopeId: "e", terms: T });
const paid = { paidAt: "2026-10-01T00:00:00Z", amount: 750 };
const base = { id: "c1", name: "Acme", packageId: "w-site", landingSlug: "acme", website: {} };
const st = (deal, website = {}) => websiteStatus({ ...base, websiteDeal: deal, website });
const SITE = "https://boldlinemedia.netlify.app/site/acme/";

// ── 1. Where it stands, in words the client understands ─────────────────────────────────────
ok("every stage has its own plain status", [
  st({}).key === "none", st({ agreement: ag("sent") }).key === "sign", st({ agreement: ag("completed") }).key === "pay",
  st({ agreement: ag("completed"), invoices: { deposit: paid } }).key === "build",
  st({ agreement: ag("completed"), invoices: { deposit: paid } }, { content: {} }).key === "review",
  st({ agreement: ag("completed"), invoices: { deposit: paid, final: paid } }, { content: {} }).key === "launch",
  st({ agreement: ag("completed"), invoices: { deposit: paid, final: paid }, launchedAt: "x" }, { content: {}, published: true }).key === "live",
].every(Boolean));
ok("🔴 only clients buying a website get the tab (an ads client with just a draft site does not)", hasWebsite({ ...base }) && !hasWebsite({ ...base, packageId: "g-launch", website: { content: {} } }) && hasWebsite({ ...base, packageId: "g-launch", websiteDeal: { agreement: ag("sent") } }) && !hasWebsite({ id: "x", packageId: "g-launch" }) && !hasWebsite({ ...base, internal: true }));

const live = { ...base, website: { content: {}, published: true, previewKey: "K" }, websiteDeal: { agreement: ag("completed"), invoices: { deposit: paid, final: paid }, launchedAt: "2026-10-02T00:00:00Z", careSub: { status: "active" } },
  leadsLog: [{ source: "website", receivedAt: new Date().toISOString() }, { source: "landing", receivedAt: new Date().toISOString() }, { source: "website", receivedAt: "2020-01-01T00:00:00Z" }],
  websiteRequests: [{ id: "r1", text: "<b>Change hours</b>", at: new Date().toISOString(), status: "open" }] };
const stats = summarize([{ at: new Date().toISOString(), path: "/", source: "Search", device: "mobile", visitor: "a" }]);
const H = websitePortalHTML(live, { siteUrl: SITE, stats, posts: [{ slug: "tip", title: "A tip", publishAt: "2026-10-01T00:00:00Z" }] });
ok("the live site links to the live site", H.includes(`href="${SITE}"`) && /Visit your website/.test(H));
ok("🔴 enquiries count only website ones from the last 30 days", /<div class="lbl">Enquiries<\/div><div[^>]*>1<\/div>/.test(H));
ok("a blog article links straight to its live page", H.includes(`href="${SITE}blog/tip/"`));
ok("🔴 the client's own words are escaped, never run", !/<b>Change hours<\/b>/.test(H) && /&lt;b&gt;Change hours/.test(H));
ok("the care plan shows how many small changes are left this month", /2 small changes a month \(1 used this month\)/.test(H));
ok("🔴 no dashes, no emojis anywhere on the tab", !/[—–]/.test(text(H)) && !/\p{Extended_Pictographic}/u.test(text(H)));
const review = { ...base, website: { content: {}, previewKey: "K" }, websiteDeal: { agreement: ag("completed"), invoices: { deposit: paid, final: { url: "https://invoice.stripe.com/i/x" } } } };
const R = websitePortalHTML(review, { siteUrl: SITE });
ok("🔴 before it is live they can see it through the preview link, and pay the balance on Stripe's own page", R.includes(`${SITE}?preview=K`) && R.includes('href="https://invoice.stripe.com/i/x"') && /Pay now/.test(R));
ok("🔴 a pay link that is not https is never shown", !/Pay now/.test(websitePortalHTML({ ...review, websiteDeal: { ...review.websiteDeal, invoices: { deposit: paid, final: { url: "javascript:alert(1)" } } } }, { siteUrl: SITE })));
ok("🔴 no visitor numbers before it is live (nothing honest to show)", !/Visitors/.test(R));
ok("when the numbers are not ready yet it says so instead of showing zeros", /Visitor numbers will show here soon/.test(websitePortalHTML(live, { siteUrl: SITE, stats: null })));
ok("before signing there is no payments card", !/Payments/.test(websitePortalHTML({ ...base, websiteDeal: { agreement: ag("sent") } }, { siteUrl: SITE })));
ok("the request script posts to the portal like every other portal action", /fetch\('\/\.netlify\/functions\/portal\?token='\+encodeURIComponent\(TOKEN\)/.test(WEBSITE_PORTAL_JS) && /websiteRequest:\{text:t\}/.test(WEBSITE_PORTAL_JS));

const fut = new Date(Date.now() + 2 * 86400e3).toISOString();
const BL = websitePortalHTML(live, { siteUrl: SITE, stats, posts: [
  { slug: "soon", title: "Coming up", publishAt: fut },
  { slug: "held", title: "Held one", publishAt: "2026-10-01T00:00:00Z", held: true },
  { slug: "tip", title: "A tip", publishAt: "2026-10-01T00:00:00Z", editedBy: "client" }] });
ok("🔴 the client sees an article before it goes out, with the day it goes out", /Coming up/.test(BL) && /Goes out [A-Z][a-z]+day, /.test(BL));
ok("🔴 an article that has not gone out has no live link (it would be a dead page)", !BL.includes(`${SITE}blog/soon/`) && !BL.includes(`${SITE}blog/held/`));
ok("a held article says so plainly and offers to release it", /On hold, not published/.test(BL) && /blBlogHold\('held',false,this\)/.test(BL) && /blBlogHold\('soon',true,this\)/.test(BL));
ok("every article can be opened, read and edited", (BL.match(/blBlogOpen\('/g) || []).length === 3);
ok("the client's own edits are marked", /edited by you/.test(BL));
ok("🔴 no dashes, no emojis on the blog card", !/[—–]/.test(text(BL)) && !/\p{Extended_Pictographic}/u.test(text(BL)));
let parsed = true; try { new Function("var TOKEN='t';" + WEBSITE_PORTAL_JS); } catch (e) { parsed = String(e.message); }
ok("🔴 the portal script parses (one broken quote kills every button on the page)", parsed === true, parsed);
ok("the editor sends only the article's own fields, through the portal's token", /blPost\(\{blogEdit:\{slug:slug,title:t,blocks:blocks\}\}\)/.test(WEBSITE_PORTAL_JS) && /blPost\(\{blogGet:\{slug:slug\}\}\)/.test(WEBSITE_PORTAL_JS));
ok("🔴 the article's words are escaped before they go into the editor", /value="'\+blEsc\(p\.title\)\+'"/.test(WEBSITE_PORTAL_JS) && /'\+blEsc\(b\.text\)\+'<\/textarea>/.test(WEBSITE_PORTAL_JS));
ok("🔴 the Save button quotes the article name, so pressing it actually saves", WEBSITE_PORTAL_JS.includes(`onclick="blBlogSave(\\''+slug+'\\',this)"`));
ok("holding an article asks first", /confirm\('Hold this article\?/.test(WEBSITE_PORTAL_JS));

// ── 2. Counting visits, privately ──────────────────────────────────────────────────────────
ok("sources read in plain terms", sourceOf("https://www.google.com/", "x.app", false) === "Search" && sourceOf("", "x.app", false) === "Direct" && sourceOf("https://l.facebook.com/x", "x.app", false) === "Social"
  && sourceOf("https://x.app/site/acme/", "x.app", false) === "Internal" && sourceOf("https://www.google.com/", "x.app", true) === "Google Ads" && sourceOf("https://news.example/", "x.app", false) === "Other sites");
ok("phones, tablets and computers are told apart", deviceOf("Mozilla/5.0 (iPhone)") === "mobile" && deviceOf("Mozilla/5.0 (iPad)") === "tablet" && deviceOf("Mozilla/5.0 (Windows NT 10.0)") === "desktop");
ok("🔴 bots are not counted as people", ["Googlebot/2.1", "facebookexternalhit/1.1", "HeadlessChrome", "curl/8"].every((u) => BOT_UA.test(u)) && !BOT_UA.test("Mozilla/5.0 (iPhone) Safari"));
ok("🔴 the visitor hash changes every day and never stores the address", visitorHash("1.2.3.4", "ua", "acme", new Date("2026-10-01T12:00:00Z"), "s") !== visitorHash("1.2.3.4", "ua", "acme", new Date("2026-10-02T12:00:00Z"), "s")
  && !visitorHash("1.2.3.4", "ua", "acme", new Date(), "s").includes("1.2.3.4") && visitorHash("1.2.3.4", "ua", "acme", new Date(), "s").length === 16);
const now = Date.parse("2026-10-10T18:00:00Z");
const S = summarize([
  { at: "2026-10-10T17:00:00Z", path: "/", source: "Search", device: "mobile", visitor: "a" },
  { at: "2026-10-10T17:05:00Z", path: "/services/", source: "Internal", device: "mobile", visitor: "a" },
  { at: "2026-10-09T17:00:00Z", path: "/", source: "Direct", device: "desktop", visitor: "b" },
  { at: "2026-08-01T17:00:00Z", path: "/", source: "Direct", device: "desktop", visitor: "old" },
], { now });
ok("🔴 a click between pages of their own site is a page view, not a new arrival", S.views === 3 && S.visitors === 2 && S.sources.reduce((a, r) => a + r.n, 0) === 2);
ok("every one of the 30 days is there, zeros included, ending today", S.byDay.length === 30 && S.byDay[29].day === "2026-10-10" && S.byDay[29].visitors === 1 && S.byDay[0].views === 0);
ok("old visits fall outside the window", !S.pages.some((p) => p.n > 2));

// ── 3. The page view beacon ────────────────────────────────────────────────────────────────
const cl = { id: "c", name: "A", landingSlug: "acme", website: { content: { hero: { headline: "x" } } } };
const tracked = renderSite(cl, "home", { base: "https://boldlinemedia.netlify.app/site/acme", track: { url: "https://boldlinemedia.netlify.app/site-hit", slug: "acme" } });
const untracked = renderSite(cl, "home", { base: "https://boldlinemedia.netlify.app/site/acme" });
ok("🔴 only a page served as the live site counts visits; previews never do", /sendBeacon/.test(tracked) && !/sendBeacon|site-hit/.test(untracked));
ok("🔴 the beacon itself skips the OS preview, preview links and automated browsers", /h\.indexOf\('about:'\)===0\|\|\/\[\?&\]preview=\/\.test\(location\.search\)\|\|navigator\.webdriver/.test(tracked));
ok("it sends plain text, so the browser asks no permission and the page can never break", /new Blob\(\[b\],\{type:'text\/plain'\}\)/.test(tracked) && /catch\(e\)\{\}\}\)\(\);/.test(tracked));
ok("🔴 an address that is not https is never used for the beacon", !/sendBeacon/.test(renderSite(cl, "home", { base: "https://a.b/site/acme", track: { url: "http://evil.example/x", slug: "acme" } })));
const SITEFN = src("netlify/functions/site.mjs");
ok("🔴 the server only turns tracking on for the published public site, never a preview link", /const track = !view\.previewing && cl\.website\.published \? \{ url: `https:\/\/\$\{url\.host\}\/site-hit`, slug: where\.slug \} : null;/.test(SITEFN));
const HIT = src("netlify/functions/site-hit.mjs");
ok("the counter always answers quietly and skips bots and bad slugs", /return done\(\);/.test(HIT) && /BOT_UA\.test\(ua\)/.test(HIT) && /\^\[a-z0-9-\]\{1,80\}\$/.test(HIT));
const { default: hit } = await import("../netlify/functions/site-hit.mjs");
const r = await hit(new Request("https://x.app/site-hit", { method: "POST", body: "{}" }));
ok("🔴 with nothing configured it still answers 204 (a visitor never sees an error)", r.status === 204);
const SQL = existsSync(join(ROOT, "docs/sql/site-visits-schema.sql")) ? src("docs/sql/site-visits-schema.sql") : "";
ok("🔴 the visits table is owner-only and stores no address", /create table if not exists public\.site_visits/.test(SQL) && /enable row level security/.test(SQL) && !/\bip\b\s+text/.test(SQL));
const TOML = src("netlify.toml");
ok("the counter has its address", /from = "\/site-hit"\s*\n\s*to = "\/\.netlify\/functions\/site-hit"/.test(TOML));

// ── 4. The portal ──────────────────────────────────────────────────────────────────────────
const { _internal } = await import("../netlify/functions/portal.mjs");
const P = _internal.makePortalHTML({ ...live, portalToken: "tok", email: "a@b.c" }, null, null, { siteUrl: SITE, stats, posts: [] });
const tabs = [...P.matchAll(/<div class="nav">([\s\S]*?)<\/div>/g)].map((m) => [...m[1].matchAll(/show\('(\w+)'/g)].map((x) => x[1]))[0] || [];
ok("🔴 a website-only client's portal opens on Website, with Enquiries and Account, and no campaign tabs", tabs.join() === "website,leads,account" && /<div id="t-status" style="display:none">/.test(P) && /<div id="t-website" class="tab-anim">/.test(P));
const adsWithSite = _internal.makePortalHTML({ ...live, packageId: "g-launch", portalToken: "tok" }, _internal.findPkg("g-launch"), null, { siteUrl: SITE, stats, posts: [] });
const tabs2 = [...adsWithSite.matchAll(/<div class="nav">([\s\S]*?)<\/div>/g)].map((m) => [...m[1].matchAll(/show\('(\w+)'/g)].map((x) => x[1]))[0] || [];
ok("an ads client with a website gets a Website tab beside their usual five", tabs2.join() === "status,approvals,leads,website,reports,account");
const adsOnly = _internal.makePortalHTML({ id: "x", name: "B", packageId: "g-launch", portalToken: "tok" }, _internal.findPkg("g-launch"), null);
ok("🔴 an ads client without a website sees no change at all", !/show\('website'/.test(adsOnly) && !/blWebReq/.test(adsOnly));
const PSRC = src("netlify/functions/portal.mjs");
ok("the website-only Account tab drops the ad-account connections but keeps the help chat", /\+ \(webOnly \? assistantWidget : connectSection\)/.test(PSRC));
const reqBlock = PSRC.slice(PSRC.indexOf("if (body.websiteRequest"), PSRC.indexOf("// Approval decision from the portal"));
ok("🔴 a change request must say something, is capped at 10 open, saves before alerting", /if \(!text\) return/.test(reqBlock) && />= 10\)/.test(reqBlock)
  && reqBlock.indexOf(".update({ data: next") < reqBlock.indexOf("dispatchAlert(") && /if \(ue\) return/.test(reqBlock));
ok("🔴 visitor numbers and articles never break the portal (each read is best effort)", /if \(!ve\) site\.stats = summarize/.test(PSRC) && /catch \{ site\.posts = \[\]; \}/.test(PSRC));
const UI = src("index.html");
ok("open change requests raise an OS alert for every kind of client", /\.\.\.webRequestAlerts\(cl\)\];\n  const d = \(cl\.websiteDeal\)/.test(UI) && /const a = \[\.\.\.\(cl\.alerts\|\|\[\]\), \.\.\.webRequestAlerts\(cl\)\];\n  if \(!cl\.intakeComplete\)/.test(UI));
ok("Bryson can mark a request done, which the client then sees", /status:"done",doneAt:new Date\(\)\.toISOString\(\)/.test(UI) && /r\.status === "done" \? "Done"/.test(src("netlify/lib/portal-website.mjs")));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-website-portal: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
