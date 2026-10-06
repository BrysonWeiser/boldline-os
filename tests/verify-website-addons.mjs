// Website add-ons: extra pages and the blog (price, agreement, pages, articles).
// Run: node tests/verify-website-addons.mjs
//
// Bryson, 2026-10-06: *"what if a client wants to add extra pages such as a blog page? We should charge an
// extra for blog page creation and then ai blog post creations"*. KB `website-builder`. Every check runs
// the code; the 🔴 ones cost a client money or trust if they slip.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as L from "../netlify/lib/website-deal.mjs";
import * as B from "../netlify/lib/site-blog.mjs";
import { renderSite, pagesFor, pageByPath } from "../netlify/lib/site-render.mjs";
import { WEBSITE_OFFER } from "../netlify/lib/pricing-shared.mjs";
import { dueClients } from "../netlify/functions/site-blog-run.mjs";
import { extraPageRoom, PAGE_SCHEMA } from "../netlify/functions/site-build-background.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const t = async (l, fn) => { try { await fn(); } catch (e) { fails.push(`${l} — threw ${e.message}`); } };
const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");

const BASE = "https://boldlinemedia.netlify.app/site/acme";
const addons = { price: 1500, plan: "half", care: 99, extraPages: 2, extraPagePrice: 200, blog: true, blogSetup: 300, blogMonthly: 149, blogPosts: 4 };
const signed = (terms, extra = {}) => ({ agreement: { status: "completed", envelopeId: "e", terms }, ...extra });
const paid = (a) => ({ id: "in", amount: a, paidAt: "2026-10-01T00:00:00Z", status: "paid" });
const base = { id: "c1", name: "Acme Roofing LLC", niche: "Roofing", email: "o@acme.test", landingSlug: "acme",
  website: { content: { hero: { headline: "Roofs done right" }, services: [{ name: "Repairs", blurb: "Fixed fast." }] } } };

// ── 1. Price and terms ─────────────────────────────────────────────────────────────────────
ok("defaults come from the one price list", WEBSITE_OFFER.extraPage === 200 && WEBSITE_OFFER.blogSetup === 300 && WEBSITE_OFFER.blogMonthly === 149 && WEBSITE_OFFER.blogPostsPerMonth === 4);
ok("🔴 the build total adds extra pages and the blog setup", L.buildTotal(addons) === 1500 + 400 + 300);
ok("🔴 the monthly total adds the blog plan to care", L.monthlyTotal(addons) === 99 + 149 && L.monthlyTotal({ ...addons, blog: false }) === 99);
ok("🔴 half and half splits the WHOLE build, add-ons included", (({ first, final }) => first === 1100 && final === 1100)(L.amountsOf(addons)));
ok("🔴 an agreement signed before add-ons existed reads as no extra pages and no blog", (({ extraPages, blog }) => extraPages === 0 && blog === false)(L.termsOf({ websiteDeal: signed({ price: 1500, plan: "full", care: 99 }) })));
ok("silly numbers are clamped (pages 0 to 20, articles 1 to 8)", L.normTerms({ extraPages: 99, blogPosts: 0 }).extraPages === 20 && L.normTerms({ blogPosts: 0 }).blogPosts === 1 && L.normTerms({ blogPosts: 50 }).blogPosts === 8);
ok("the blog is only on when it is exactly true", L.normTerms({ blog: "yes" }).blog === false && L.normTerms({ blog: true }).blog === true);

// The OS computes the same totals.
const block = UI.slice(UI.indexOf("// ─── Website deal (mirror"), UI.indexOf("// WD-MIRROR-END"));
const M = new Function(`${block}; return { wdBuildTotal, wdMonthlyTotal, wdTerms, wdAmounts, wdNorm };`)();
for (const terms of [addons, { ...addons, plan: "full" }, { price: 999.99, plan: "half", extraPages: 3, extraPagePrice: 175.5 }, {}, { blog: "yes", blogMonthly: 99 }]) {
  ok(`🔴 OS and server agree on totals (${JSON.stringify(terms).slice(0, 40)})`, M.wdBuildTotal(terms) === L.buildTotal(terms) && M.wdMonthlyTotal(terms) === L.monthlyTotal(terms)
    && JSON.stringify(M.wdNorm(terms)) === JSON.stringify(L.normTerms(terms)) && JSON.stringify(M.wdAmounts(terms)) === JSON.stringify(L.amountsOf(terms)));
}

// ── 2. The agreement ───────────────────────────────────────────────────────────────────────
const ag = L.websiteAgreementHTML({ ...base, websiteDeal: addons });
const agPlain = L.websiteAgreementHTML({ ...base, websiteDeal: { price: 1500, plan: "full", care: 99 } });
ok("🔴 the agreement states the whole build fee and what it is made of", /\$2,200/.test(ag) && /2 extra pages at \$200 each/.test(ag) && /\$300 blog setup/.test(ag));
ok("🔴 the blog plan is its own key term and section, starting at launch", /Blog Plan<\/td><td>\$149 per month for about 4 articles a month/.test(ag) && /7a\. The blog/.test(ag) && /starts on the day the Website goes live/.test(ag));
ok("🔴 the client can change, remove or cancel articles, and the blog makes no promises", /change or remove any article Client asks it to/.test(ag) && /will not promise results/.test(ag) && /cancel the Blog Plan at any time/.test(ag));
ok("extra pages are on subjects agreed in writing", /2 extra pages on subjects Client and BoldLine agree in writing/.test(ag));
ok("an agreement without add-ons mentions neither", !/Blog Plan|extra page/.test(agPlain));
ok("🔴 no dashes or emojis with the add-ons in", !/[—–]/.test(text(ag)) && !/\p{Extended_Pictographic}/u.test(text(ag)));

// ── 3. The monthly plan includes the blog ──────────────────────────────────────────────────
const fakeApi = () => { const calls = []; return { calls, ensureCustomer: async () => "cus", resolvePaymentMethod: async () => null,
  stripe: async (path, o) => { calls.push({ path, body: (o || {}).body }); if (path === "products") return { id: `prod_${calls.length}` }; if (path === "subscriptions") return { id: "sub", status: "active" }; return {}; } }; };
const live = (terms) => ({ ...base, websiteDeal: { ...signed(terms), invoices: { deposit: paid(1), final: paid(1), full: paid(1) }, launchedAt: "2026-10-02T00:00:00Z" } });
await t("care", async () => {
  const a = fakeApi(); await L.startCarePlan(live(addons), a);
  const items = a.calls.find((c) => c.path === "subscriptions").body.items;
  ok("🔴 care and blog are two lines on one monthly subscription", items.length === 2 && items[0].price_data.unit_amount === 9900 && items[1].price_data.unit_amount === 14900);
  const b = fakeApi(); await L.startCarePlan(live({ ...addons, care: 0 }), b);
  ok("care waived but blog bought: the blog is still billed", b.calls.find((c) => c.path === "subscriptions").body.items.length === 1);
});

// ── 4. Pages on the website ────────────────────────────────────────────────────────────────
const withPages = { ...base, websiteDeal: addons, website: { ...base.website, published: true,
  extraPages: [{ slug: "service-areas", title: "Service Areas", content: { headline: "Where we work", intro: "Across the valley.", sections: [{ heading: "Phoenix", text: "We cover it." }] } },
    { slug: "about", title: "Sneaky", content: { headline: "Should not render" } }, { slug: "gallery", title: "Gallery" }] } };
const ids = pagesFor(withPages).map((p) => p.id);
ok("🔴 extra pages and the blog join the site; a page using a main page's address or with no words never does", ids.join() === "home,services,about,reviews,contact,x-service-areas,blog");
ok("the address finds the page", pageByPath(withPages, "service-areas").id === "x-service-areas" && pageByPath(withPages, "blog").id === "blog" && pageByPath(withPages, "gallery") === null);
const ex = renderSite(withPages, "x-service-areas", { base: BASE });
ok("an extra page renders its own words, with its own title", /Where we work/.test(ex) && /<title>Service Areas \| Acme Roofing<\/title>/.test(ex));
const posts = [{ slug: "pick-a-roofer", title: "How to pick a roofer", excerpt: "Five questions.", publishAt: "2026-10-01T15:00:00Z" }];
const bl = renderSite(withPages, "blog", { base: BASE, posts });
ok("the blog lists its articles with absolute links", bl.includes(`href="${BASE}/blog/pick-a-roofer/"`) && /How to pick a roofer/.test(bl));
ok("an empty blog says so honestly", /first articles are on their way/.test(renderSite(withPages, "blog", { base: BASE, posts: [] })));
const ar = renderSite(withPages, "blog", { base: BASE, post: { slug: "pick-a-roofer", title: "How to pick a roofer", excerpt: "x", publishAt: "2026-10-01T15:00:00Z", blocks: [{ kind: "h2", text: "Ask this" }, { kind: "p", text: "<script>alert(1)</script>" }] } });
ok("🔴 an article is escaped, never run", !/<script>alert/.test(ar) && /&lt;script&gt;/.test(ar));
ok("an article tells Google what it is, and links to itself", /"@type":"BlogPosting"/.test(ar) && /<link rel="canonical" href="https:\/\/boldlinemedia\.netlify\.app\/site\/acme\/blog\/pick-a-roofer\/">/.test(ar));
const all = [ex, bl, ar];
ok("🔴 every link is absolute and stays on the client's site (or phone/email/Google)", all.every((h) => [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))
  .every((u) => u.startsWith(BASE + "/") || /^tel:|^mailto:|^https:\/\/(fonts\.|www\.google\.com|maps\.app)/.test(u))));
ok("🔴 no dashes or emojis on the new pages", all.every((h) => !/[—–]/.test(text(h)) && !/\p{Extended_Pictographic}/u.test(text(h).replace(/[✦★©]/g, ""))));
const many = { ...withPages, website: { ...withPages.website, extraPages: [1, 2, 3, 4].map((i) => ({ slug: `p${i}`, title: `Page ${i}`, content: { headline: "H" } })) } };
const nav = (renderSite(many, "home", { base: BASE }).match(/<nav class="nav"[\s\S]*?<\/nav>/) || [""])[0];
ok("the top bar stays readable: past seven links, extra pages move to the menu and footer", !/Page 1/.test(nav) && /Blog/.test(nav) && /Page 4/.test(renderSite(many, "home", { base: BASE }).match(/<footer[\s\S]*?<\/footer>/)[0]));

// ── 5. Articles: published means published ─────────────────────────────────────────────────
const now = Date.parse("2026-10-10T12:00:00Z");
ok("🔴 a held article is never published, whatever its date", !B.isPublished({ publishAt: "2026-10-01T00:00:00Z", held: true }, now));
ok("🔴 a scheduled article is not published before its time", !B.isPublished({ publishAt: "2026-10-11T00:00:00Z" }, now) && B.isPublished({ publishAt: "2026-10-09T00:00:00Z" }, now));
ok("the public list is published only, newest first", B.publishedPosts([{ slug: "a", publishAt: "2026-10-01T00:00:00Z" }, { slug: "b", publishAt: "2026-10-05T00:00:00Z" }, { slug: "c", publishAt: "2026-10-20T00:00:00Z" }, { slug: "d", publishAt: "2026-10-02T00:00:00Z", held: true }], now).map((p) => p.slug).join() === "b,a");
const cl4 = live(addons);
const n0 = B.nextDue(cl4, [], now);
ok("🔴 the first article is due at once, and goes live 48 hours after it is written", n0.due && Date.parse(n0.publishAt) === now + 48 * 3600e3);
const n1 = B.nextDue(cl4, [{ publishAt: new Date(now - 2 * 864e5).toISOString() }], now);
ok("articles are spaced across the month (4 a month = about a week apart)", !n1.due);
const n2 = B.nextDue(cl4, [{ publishAt: new Date(now - 6 * 864e5).toISOString() }], now);
ok("and the next is written ahead so it lands on time, never inside the 48-hour review window", n2.due && Date.parse(n2.publishAt) === Math.max(now + 48 * 3600e3, now - 6 * 864e5 + 7 * 864e5));
const four = ["01", "08", "15", "22"].map((d) => ({ publishAt: `2026-10-${d}T12:00:00Z` }));
ok("🔴 never more articles in a month than they pay for (spacing alone would allow a fifth)", !B.nextDue(cl4, four, Date.parse("2026-10-28T12:00:00Z")).due
  && B.nextDue(cl4, four.slice(1), Date.parse("2026-10-28T12:00:00Z")).due);
ok("titles never collide", B.uniqueSlug("How to pick a roofer", [{ slug: "how-to-pick-a-roofer" }]) === "how-to-pick-a-roofer-2");

// ── 6. Who gets articles ───────────────────────────────────────────────────────────────────
ok("🔴 only a client who bought the blog, signed, paid in full and is live", B.blogActive(cl4) && !B.blogActive({ ...base, websiteDeal: signed(addons) })
  && !B.blogActive(live({ ...addons, blog: false })) && !B.blogActive({ ...cl4, websiteDeal: { ...cl4.websiteDeal, launchedAt: null } }));
ok("🔴 a cancelled monthly plan stops the articles", !B.blogActive({ ...cl4, websiteDeal: { ...cl4.websiteDeal, careSub: { status: "canceled" } } }));
ok("demo accounts never get articles", !B.blogActive({ ...cl4, demo: true }));
ok("the daily job picks exactly the clients who are due", JSON.stringify(dueClients([{ id: "c1", data: cl4 }, { id: "c2", data: { ...base, id: "c2" } }], { c1: [] }, now)) === JSON.stringify([{ id: "c1", name: "Acme Roofing LLC" }])
  && dueClients([{ id: "c1", data: cl4 }], { c1: [{ publishAt: new Date(now - 864e5).toISOString() }] }, now).length === 0);

// ── 7. Storage, with a Map standing in for the bucket ──────────────────────────────────────
await t("store", async () => {
  const m = new Map(); const store = { read: async (p) => (m.has(p) ? JSON.parse(m.get(p)) : null), write: async (p, o) => { m.set(p, JSON.stringify(o)); } };
  await B.savePost(store, "c1", { slug: "a", title: "A", excerpt: "x", publishAt: "2026-10-01T00:00:00Z", blocks: [] });
  await B.savePost(store, "c1", { slug: "b", title: "B", excerpt: "y", publishAt: "2026-10-08T00:00:00Z", blocks: [] });
  ok("saving keeps one index line per article", (await B.loadIndex(store, "c1")).map((p) => p.slug).join() === "a,b");
  await B.setHeld(store, "c1", "a", true);
  ok("🔴 holding marks BOTH the index and the article (the public page reads the article)", (await B.loadIndex(store, "c1"))[0].held === true && (await B.loadPost(store, "c1", "a")).held === true);
  await B.removePost(store, "c1", "b");
  ok("deleting takes it off the list", (await B.loadIndex(store, "c1")).length === 1);
});

// ── 8. Writing an article ──────────────────────────────────────────────────────────────────
const P = B.postPrompt({ ...base, niche: "Chiropractic" }, ["Old title"]);
ok("🔴 the article prompt forbids invented facts and has no dashes itself", /DON'T INVENT ANYTHING ABOUT THE BUSINESS/.test(P) && !/[—–]/.test(P) && /Never say "local businesses"/.test(P));
ok("it is told what is already on the blog, so topics don't repeat", /- Old title/.test(P));
ok("🔴 a health business gets the no diagnosing, no cures rule", /Don't diagnose, don't promise cures/.test(P) && !/Don't diagnose/.test(B.postPrompt(base, [])));
const fakeModel = (out, stop = "end_turn") => ({ beta: { messages: { create: async () => ({ stop_reason: stop, content: [{ type: "text", text: JSON.stringify(out) }] }) } }, messages: { create: async () => ({}) } });
await t("write", async () => {
  const a = await B.writePost(base, [], fakeModel({ title: "Fix it fast — before rain", excerpt: "x", blocks: [{ kind: "h2", text: "One" }, { kind: "p", text: "A — b." }, { kind: "p", text: "C." }, { kind: "p", text: "D." }] }));
  ok("🔴 dashes the model slips in are removed before anything is saved", !/[—–]/.test(JSON.stringify(a)));
  let e = ""; try { await B.writePost(base, [], fakeModel({ title: "T", excerpt: "x", blocks: [{ kind: "p", text: "Only one." }] })); } catch (x) { e = x.message; }
  ok("a thin article is refused, not published", /too short/.test(e));
  e = ""; try { await B.writePost(base, [], fakeModel({}, "refusal")); } catch (x) { e = x.message; }
  ok("a refusal is said plainly", /declined/.test(e));
});

// ── 9. Extra pages: only as many as they paid for ──────────────────────────────────────────
const two = { ...base, websiteDeal: signed(addons), website: { extraPages: [{ slug: "a", content: {} }, { slug: "b", content: {} }] } };
ok("🔴 a third extra page is refused when they paid for two", !extraPageRoom(two, "c") && extraPageRoom(two, "a") && extraPageRoom({ ...two, website: { extraPages: [] } }, "c"));
ok("BoldLine's own site has no limit", extraPageRoom({ ...two, internal: true }, "c"));
ok("the page schema is strict", PAGE_SCHEMA.additionalProperties === false && PAGE_SCHEMA.properties.sections.items.additionalProperties === false);
const SB = src("netlify/functions/site-build-background.mjs");
ok("🔴 the limit is checked before any work starts", SB.indexOf("if (!extraPageRoom(") > 0 && SB.indexOf("if (!extraPageRoom(") < SB.indexOf('kind: "page", status: "running"') && SB.indexOf("const lock = buildLock(") < SB.indexOf("if (body.extraPage)"));

// ── 10. Server wiring ──────────────────────────────────────────────────────────────────────
const S = src("netlify/functions/site.mjs");
ok("🔴 a held or unpublished article is a 404 on the public site", /if \(!post \|\| !isPublished\(post\)\) return plain\("Page not found"/.test(S));
ok("🔴 the public blog list is published articles only", /posts = publishedPosts\(await loadIndex\(store, cl\.id\)\)/.test(S));
ok("the OS preview never shows a held article", /\.filter\(\(p\) => !p\.held\)/.test(S));
const W = src("netlify/functions/site-blog-write-background.mjs");
ok("🔴 the writer needs the owner or the internal key, and checks the blog is active before writing", /timingSafeEqual/.test(W) && W.indexOf("if (!allowed) return json") > 0 && W.indexOf("if (!allowed) return json") < W.indexOf("writePost(") && W.indexOf("if (!blogActive(cl)) return json") > 0 && W.indexOf("if (!blogActive(cl)) return json") < W.indexOf("writePost("));
ok("🔴 the internal key refuses to exist without the real secret behind it", /if \(!process\.env\.SUPABASE_SERVICE_ROLE_KEY \|\| !process\.env\.ANTHROPIC_API_KEY\) return json/.test(W) && W.indexOf("SUPABASE_SERVICE_ROLE_KEY ||") < W.indexOf("internalKey()"));
const TOML = src("netlify.toml");
ok("blog article addresses route before the page route", TOML.indexOf('from = "/site/:slug/blog/:post/"') > 0 && TOML.indexOf('from = "/site/:slug/blog/:post/"') < TOML.indexOf('from = "/site/:slug/:page/"'));
ok("the daily blog job is scheduled", /\[functions\."site-blog-run"\]\s*\n\s*schedule = "5 16 \* \* \*"/.test(TOML));

// ── 11. The OS ─────────────────────────────────────────────────────────────────────────────
const tabsFn = new Function(`${block}; ${UI.slice(UI.indexOf("const SITE_PAGE_TABS="), UI.indexOf("const siteSlug="))}; return siteTabsFor;`)();
ok("the preview tabs include written extra pages and the blog, matching the website", tabsFn(withPages).map((x) => x[0]).join() === "home,services,about,reviews,contact,x-service-areas,x-about,blog");
const EP = UI.slice(UI.indexOf("function ExtraPagesCard("), UI.indexOf("function BlogCard("));
ok("🔴 the OS won't offer more extra pages than they paid for", /const full=pages\.length>=room;/.test(EP) && /\{!full&&\(/.test(EP));
const BC = UI.slice(UI.indexOf("function BlogCard("), UI.indexOf("const SITE_THEME_LIST="));
ok("Bryson can read, hold, release and delete every article", /call\("blog-post"/.test(BC) && /call\("blog-hold",\{slug:p\.slug,held:!p\.held\}\)/.test(BC) && /call\("blog-delete"/.test(BC));
ok("🔴 deleting an article asks first", /window\.confirm\("Delete this article\?/.test(BC));
ok("set-terms sends every add-on field", /extraPages:Number\(form\.extraPages\|\|0\),extraPagePrice:Number\(form\.extraPagePrice\),blog:!!form\.blog,blogSetup:Number\(form\.blogSetup\),blogMonthly:Number\(form\.blogMonthly\),blogPosts:Number\(form\.blogPosts\)/.test(UI));

// ── 12. Editing an article (the client in their portal, Bryson in the OS) ─────────────────
await t("edit", async () => {
  const m = new Map(); const store = { read: async (p) => (m.has(p) ? JSON.parse(m.get(p)) : null), write: async (p, o) => { m.set(p, JSON.stringify(o)); } };
  await B.savePost(store, "c1", { slug: "a", title: "Old", excerpt: "old", publishAt: "2026-10-09T16:00:00Z", held: true, writtenAt: "2026-10-07T16:00:00Z", blocks: [{ kind: "p", text: "old" }] });
  const { post } = await B.applyEdit(store, "c1", "a", { title: "  New   title ", blocks: [{ kind: "h2", text: "Why" }, { kind: "p", text: "Fast — and clean." }, { kind: "p", text: "   " }, { kind: "script", text: "x" }] }, "client");
  ok("🔴 an edit keeps the article's date (it does not jump the queue or go out early)", post.publishAt === "2026-10-09T16:00:00Z");
  ok("🔴 an edit keeps a hold (editing never releases an article)", post.held === true && (await B.loadIndex(store, "c1"))[0].held === true);
  ok("an edit replaces the words, tidies spacing and drops empty blocks", post.title === "New title" && post.blocks.length === 3 && post.blocks[0].kind === "h2");
  ok("an unknown block kind becomes a paragraph, never raw markup", post.blocks[2].kind === "p");
  ok("🔴 dashes are taken out of a client's edit like everywhere a visitor reads", !/[—–]/.test(JSON.stringify(post)));
  ok("the edit is recorded with who made it, on the article and the list", post.editedBy === "client" && !!post.editedAt && (await B.loadIndex(store, "c1"))[0].editedBy === "client");
  ok("the summary follows the new first paragraph", /^Fast/.test(post.excerpt));
  let threw = ""; try { await B.applyEdit(store, "c1", "a", { title: "", blocks: [{ kind: "p", text: "x" }] }); } catch (e) { threw = e.message; }
  ok("an article cannot be saved without a title", /title/.test(threw));
  threw = ""; try { await B.applyEdit(store, "c1", "a", { title: "T", blocks: [{ kind: "h2", text: "only a heading" }] }); } catch (e) { threw = e.message; }
  ok("an article cannot be saved without a paragraph", /paragraph/.test(threw));
  threw = ""; try { await B.applyEdit(store, "c1", "nope", { title: "T", blocks: [{ kind: "p", text: "x" }] }); } catch (e) { threw = e.message; }
  ok("editing an article that is not there fails instead of creating one", /No such/.test(threw) && !m.has("c1/posts/nope.json"));
  ok("🔴 a slug cannot reach another client's articles", (await B.loadPost(store, "c1", "../../c2/posts/a")) === null);
});
const PF = src("netlify/functions/portal.mjs");
const PB = PF.slice(PF.indexOf("if (body.blogGet || body.blogEdit || body.blogHold)"), PF.indexOf("if (body.websiteRequest"));
ok("🔴 the portal refuses blog changes from a client without the blog, before touching anything", PB.indexOf("if (!termsOf(cur).blog) return") > 0 && PB.indexOf("if (!termsOf(cur).blog) return") < PB.indexOf("supabaseStore("));
ok("🔴 the portal only ever reads and edits the token holder's own articles", /loadPost\(store, data\.id,/.test(PB) && /applyEdit\(store, data\.id,/.test(PB) && /setHeld\(store, data\.id,/.test(PB) && !/body\.clientId/.test(PB));
ok("a client's change is logged and Bryson is told", /commLog:/.test(PB) && /dispatchAlert\(/.test(PB));
ok("the portal shows the client every article, coming up and held too", /site\.posts = await loadIndex\(/.test(PF));
ok("Bryson can edit an article from the OS", /call\("blog-save",\{slug:draft\.slug,title:draft\.title,blocks:draft\.blocks\}\)/.test(BC) && /"blog-save"\]\.includes\(body\.action\)/.test(S) && /applyEdit\(store, id, String\(body\.slug \|\| ""\), body, "boldline"\)/.test(S));
ok("the OS shows when the client has edited an article", /p\.editedBy==="client"\?" · edited by the client"/.test(BC));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-website-addons: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
