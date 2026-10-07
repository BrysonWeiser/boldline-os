// The weekly blog writer can never publish a broken article again.
//
// Found 2026-10-07 while redesigning the blog for Bryson: six LIVE posts were two paragraphs followed by about
// 65 empty headings. The old writer forced a tool call on an older model and trusted whatever came back; when
// `sections` arrived in the wrong shape, each character became an empty <h2>, and nothing checked before
// publishing. Now: structured output on the current model, a shape check with one retry, an HTML check, and a
// last check in blog-autopublish that rewrites (or holds back) a broken draft instead of publishing it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const B = await import("../netlify/lib/blog-shared.mjs");
const src = readFileSync(join(ROOT, "netlify/lib/blog-shared.mjs"), "utf8");
const auto = readFileSync(join(ROOT, "netlify/functions/blog-autopublish.mjs"), "utf8");

const para = (n) => Array.from({ length: n }, (_, i) => `Sentence number ${i} about calls and ads and booked jobs for a business owner.`).join(" ");
const good = () => ({
  title: "How to tell if your website is losing calls", category: "Websites", excerpt: "A short teaser.", meta_description: "Meta.",
  read_minutes: 6, intro: para(8), pull_quote: "Make it easy to call.", conclusion: para(5),
  sections: [1, 2, 3, 4].map((i) => ({ heading: `Heading ${i}`, body: para(12), bullets: i === 2 ? [{ lead: "It loads fast", rest: "under two seconds on a phone." }] : [] })),
});
const reply = (obj) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }] });
const fake = (answers) => { const calls = []; let k = 0; const create = async (req) => { calls.push(req); const a = answers[Math.min(k++, answers.length - 1)]; return typeof a === "function" ? a() : a; };
  return { calls, client: { messages: { create }, beta: { messages: { create } } } }; };

// The checks themselves
ok("🔴 the exact broken shape is caught: sections as text", B.postProblems({ ...good(), sections: "[{\"heading\":\"x\"}]" }).includes("sections is not a list"));
ok("empty headings are caught", B.postProblems({ ...good(), sections: [{ heading: "", body: para(10), bullets: [] }, ...good().sections] }).some((p) => /no heading/.test(p)));
ok("nearly empty sections are caught", B.postProblems({ ...good(), sections: good().sections.map((x) => ({ ...x, body: "Too short." , bullets: [] })) }).some((p) => /nearly empty/.test(p)));
ok("a good post has no problems", B.postProblems(good()).length === 0, B.postProblems(good()).join(","));
const LIVE_BROKEN = "<p>You checked the numbers.</p><p>Somewhere between the moment.</p> " + "<h2></h2> ".repeat(65);
ok("🔴 the live broken article fails the HTML check", B.htmlProblems(LIVE_BROKEN).some((p) => /65 empty headings/.test(p)));

// The writer
{
  const f = fake([reply(good())]);
  const post = await B.generateBlogPost({ client: f.client, lane: B.BLOG_LANES[1] });
  ok("a good answer becomes a post", post && /<h2>Heading 1<\/h2>/.test(post.body_html) && B.htmlProblems(post.body_html).length === 0);
  const req = f.calls[0];
  ok("🔴 it uses the current model with structured output, not a forced tool call", req.model === "claude-opus-5-5" && req.output_config && req.output_config.format && req.output_config.format.type === "json_schema" && !req.tool_choice && !req.tools);
  ok("the shape is strict: sections must be a list of headed sections", (() => { const sc = req.output_config.format.schema; const it = sc.properties.sections.items; return sc.additionalProperties === false && sc.properties.sections.type === "array" && it.required.includes("heading") && it.additionalProperties === false; })());
  ok("room to write a full article", req.max_tokens >= 16000);
  ok("a refusal on one model falls back to another", req.fallbacks === "default" && (req.betas || []).includes("server-side-fallback-2026-07-01"));
  ok("the topic lane reaches the prompt", req.system.includes("Websites: what makes a service business"));
}
{
  const f = fake([reply({ ...good(), sections: "oops" }), reply(good())]);
  const post = await B.generateBlogPost({ client: f.client });
  ok("one malformed answer is retried, and the retry is used", f.calls.length === 2 && post && !/<h2><\/h2>/.test(post.body_html));
}
{
  const f = fake([reply({ ...good(), sections: "oops" })]);
  let threw = ""; try { await B.generateBlogPost({ client: f.client }); } catch (e) { threw = e.message; }
  ok("🔴 two malformed answers throw instead of saving a broken post", /incomplete/.test(threw), threw);
}
{
  const f = fake([{ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"title\":" }] }]);
  let threw = ""; try { await B.generateBlogPost({ client: f.client }); } catch (e) { threw = e.message; }
  ok("a cut-off answer throws", /cut off/.test(threw));
}

// The facts and the voice
ok("🔴 the facts include websites and never call clients local businesses", /Websites: five pages/.test(B.BLOG_FACTS) && /Never describe the clients as "local businesses"/.test(B.BLOG_FACTS));
ok("🔴 no invented proof, including 'every client asks'", /never say things like "a question we hear from every client"/.test(B.BLOG_FACTS));
ok("the lanes cover ads, websites, a trade and lead follow-up", B.BLOG_LANES.length === 4 && /Websites/.test(B.BLOG_LANES[1]) && /trade guide/.test(B.BLOG_LANES[2]));
ok("the lane changes week to week", B.laneFor(0) !== B.laneFor(7 * 864e5));
ok("the old model and forced tool call are gone", !/claude-opus-4-8|tool_choice/.test(src));

// The last line of defence
ok("🔴 autopublish checks every due draft before publishing it", /const bad = htmlProblems\(post\.body_html\);/.test(auto) && auto.indexOf("htmlProblems(post.body_html)") < auto.indexOf('update({ status: "published" })'));
ok("a broken draft is rewritten, or held a week with one email, never published", /post = await regeneratePost\(post\.id\)/.test(auto) && /published_at: later/.test(auto) && /continue;/.test(auto));
ok("the draft query includes the article body", /select\("id, slug, title, category, excerpt, published_at, body_html"\)/.test(auto));

// Self-repair of posts already live
{
  const rows = [{ id: "a", slug: "fine", title: "Fine", body_html: "<p>" + para(60) + "</p><h2>One</h2><p>" + para(10) + "</p>" }, { id: "b", slug: "broken", title: "Broken", body_html: LIVE_BROKEN }];
  const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return Promise.resolve({ data: rows, error: null }); } };
  const sb = { from: () => q };
  const found = rows.find((p) => B.htmlProblems(p.body_html).length);
  ok("🔴 the repair picks the broken live post, not a healthy one", found && found.slug === "broken" && B.htmlProblems(rows[0].body_html).length === 0);
  ok("a repaired post keeps its date and address", /regeneratePost\(broken\.id, \{ keepDate: true \}\)/.test(src) && /target\.status === "draft" \|\| keepDate \? target\.published_at/.test(src) && !/slug:/.test(src.slice(src.indexOf("export async function regeneratePost"), src.indexOf("export async function repairOneBrokenPost"))));
  ok("at most one repair per run, and Bryson gets an email naming it", /const fixed = await repairOneBrokenPost\(supabase\);/.test(auto) && /Blog post repaired:/.test(auto) && (auto.match(/repairOneBrokenPost\(/g) || []).length === 1);
  ok("a failed repair never stops publishing", /catch \(e\) \{ console\.error\("blog-autopublish: repair failed:"/.test(auto));
  void sb;
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-blog-writer: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
