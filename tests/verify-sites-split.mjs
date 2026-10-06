// Client websites live on their OWN Netlify site, apart from the OS (KB `website-builder`, "Client websites
// have their own home"). Bryson, 2026-10-06: "yes lets seperate them and then if you can think of any
// safeties we should add". Pins the separation (its own config, never the OS's jobs, only redeploys when
// website code changes), and the two safeties: an enquiry is never lost when the OS is down, and every live
// client website is checked hourly.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sitesInputs } from "../sites/deps.mjs";
import { relayLead, sweepQueue, MAX_TRIES } from "../netlify/lib/lead-relay.mjs";
import { nextUptime, siteIsUp, DOWN_AFTER } from "../netlify/functions/site-uptime.mjs";
import { deliverVia } from "../netlify/functions/lead-queue-sweep.mjs";
import { sitesTarget, dnsRecords, checkDomain, NETLIFY_TARGET } from "../netlify/lib/site-domain.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

// ── 1. Its own site, its own config ─────────────────────────────────────────────────────
const TOML = src("sites/netlify.toml");
ok("its own Netlify config, serving its own functions folder", /functions = "functions"/.test(TOML) && /publish = "public"/.test(TOML) && /node_bundler = "esbuild"/.test(TOML));
ok("🔴 it schedules NOTHING (a second copy of the OS's jobs would send every email twice)", !/schedule\s*=/.test(TOML));
ok("🔴 it skips a deploy when nothing it uses changed", /ignore = "node ignore\.mjs"/.test(TOML));
ok("it installs the shared packages before building, and checks its files first", /npm ci --prefix \.\./.test(TOML) && /node check\.mjs/.test(TOML));
ok("the OS's own config never deploys the websites' functions (separate folder)", /functions = "netlify\/functions"/.test(src("netlify.toml")) && !src("netlify.toml").includes('functions = "sites'));

const inputs = sitesInputs();
for (const f of ["netlify/lib/site-render.mjs", "netlify/functions/site.mjs", "netlify/functions/site-hit.mjs", "netlify/lib/lead-relay.mjs", "netlify/lib/site-domain.mjs"])
  ok(`the websites site is built from ${f}`, inputs.includes(f));
ok("🔴 and NOT from the OS's report code, so OS report changes never redeploy client websites", !inputs.includes("netlify/lib/report-shared.mjs"), inputs.join(", "));
ok("🔴 nor from the OS app itself", !inputs.some((f) => f === "index.html" || f.includes("lead-intake")));
ok("the website code reads the Supabase address from its own tiny file", /from "\.\.\/lib\/supabase-url\.mjs"/.test(src("netlify/functions/site.mjs")) && /from "\.\.\/lib\/supabase-url\.mjs"/.test(src("netlify/functions/site-hit.mjs")));
ok("the OS's report code still offers the same address (one source)", /import \{ SUPABASE_URL \} from "\.\/supabase-url\.mjs";\s*export \{ SUPABASE_URL \};/.test(src("netlify/lib/report-shared.mjs")));

// The ignore step, run for real against two commits in this repo's history.
const ignore = (from, to) => { try { execFileSync("node", [join(ROOT, "sites/ignore.mjs")], { env: { ...process.env, CACHED_COMMIT_REF: from, COMMIT_REF: to }, stdio: "ignore" }); return 0; } catch (e) { return e.status; } };
{
  const git = (...a) => execFileSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).trim();
  // A commit that only touched the deploy log.
  const logOnly = git("log", "-50", "--format=%H", "--", "docs/DEPLOYS.md").split("\n").find((h) => { try { return git("diff", "--name-only", `${h}^`, h) === "docs/DEPLOYS.md"; } catch { return false; } });
  if (logOnly) eq("🔴 an OS-only change (the deploy log) does NOT redeploy client websites", ignore(`${logOnly}^`, logOnly), 0);
  else ok("found a log-only commit to test with", false);
  const siteCommit = git("log", "-1", "--format=%H", "--", "netlify/lib/site-render.mjs");
  eq("🔴 a change to the website code DOES redeploy them", ignore(`${siteCommit}^`, siteCommit), 1);
  eq("a first deploy (nothing to compare) always deploys", ignore("", ""), 1);
}

// ── 2. The function that serves every page ──────────────────────────────────────────────
{
  const W = await import("../sites/functions/website.mjs");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = await W.default(new Request("https://x.netlify.app/__health"));
  ok("it answers a health check that names no client", h.status === 200 && /"service":"client-websites"/.test(await h.text()));
  const own = await W.default(new Request("https://boldline-sites.netlify.app/", { headers: { host: "boldline-sites.netlify.app" } }));
  ok("its own netlify address is nobody's website", own.status === 404);
  const post = await W.default(new Request("https://www.acme.com/", { method: "POST", headers: { host: "www.acme.com" }, body: "x" }));
  ok("pages are only ever looked at, never posted to", post.status === 405);
  const nokey = await W.default(new Request("https://www.acme.com/", { headers: { host: "www.acme.com" } }));
  ok("missing setup is a quiet 'temporarily unavailable', not a crash", nokey.status === 503 && !/boldline/i.test(await nokey.text()));
  if (key) process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  eq("🔴 every path is a page except the form and the visitor count", W.config, { path: "/*", excludedPath: ["/lead", "/site-hit", "/.netlify/*"] });
  const L = await import("../sites/functions/lead.mjs"); const H = await import("../sites/functions/site-hit.mjs");
  ok("the form and the visitor count have their own routes there", L.config.path === "/lead" && H.config.path === "/site-hit");
}

// ── 3. 🔴 An enquiry is never lost because the OS is down ─────────────────────────────────
const mem = () => { const m = new Map(); return { m, write: async (p, o) => { m.set(p, JSON.parse(JSON.stringify(o))); }, read: async (p) => (m.has(p) ? JSON.parse(JSON.stringify(m.get(p))) : null), list: async (dir) => [...m.keys()].filter((k) => k.startsWith(dir + "/")), remove: async (p) => { m.delete(p); } }; };
const form = (q = "?token=abcdef123456") => new Request(`https://www.acme.com/lead${q}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Jo", phone: "6025550100" }) });
{
  let sentTo = "";
  const okOS = await relayLead(form(), { fetchFn: async (u, o) => { sentTo = u; return new Response('{"ok":true}', { status: 200 }); }, store: mem() });
  ok("with the OS up, the enquiry goes straight to its lead intake", okOS.status === 200 && sentTo === "https://os.boldlinemedia.com/lead?token=abcdef123456");
  const st = mem();
  const bad = await relayLead(form(), { fetchFn: async () => new Response('{"ok":false,"error":"Invalid token"}', { status: 404 }), store: st });
  ok("a real refusal from the OS is passed back, not queued", bad.status === 404 && st.m.size === 0);
  const s1 = mem();
  const down = await relayLead(form(), { fetchFn: async () => { throw new Error("ECONNREFUSED"); }, store: s1 });
  const qd = [...s1.m.values()][0];
  ok("🔴 with the OS down, the visitor still sees thanks", down.status === 200 && (await down.json()).queued === true);
  ok("🔴 and the enquiry is kept, word for word, with its token", s1.m.size === 1 && qd.token === "abcdef123456" && /"name":"Jo"/.test(qd.body) && qd.attempts === 0);
  const s2 = mem();
  await relayLead(form(), { fetchFn: async () => new Response("boom", { status: 502 }), store: s2 });
  ok("🔴 an OS server error is kept too", s2.m.size === 1);
  const broken = await relayLead(form(), { fetchFn: async () => { throw new Error("down"); }, store: { write: async () => { throw new Error("storage down"); } } });
  ok("if even the safe copy can't be written, the visitor is asked to try again (never a fake thanks)", broken.status === 503);
  ok("a form with no token is refused", (await relayLead(form(""), { fetchFn: async () => { throw new Error("no"); }, store: mem() })).status === 400);
  ok("the browser's preflight is answered", (await relayLead(new Request("https://www.acme.com/lead", { method: "OPTIONS" }), { fetchFn: null, store: null })).status === 204);
}
{
  const st = mem();
  await st.write("queue/1-a.json", { token: "t1aaaaaaaa", body: "{}", attempts: 0, at: "x" });
  await st.write("queue/2-b.json", { token: "t2aaaaaaaa", body: '{"name":"Lost"}', attempts: MAX_TRIES - 1, at: "x" });
  await st.write("queue/3-c.json", { token: "t3aaaaaaaa", body: "{}", attempts: 0, at: "x" });
  await st.write("queue/4-d.json", { token: "t4aaaaaaaa", body: "{}", attempts: 0, at: "x" });
  const alerts = [];
  const status = { t1aaaaaaaa: 200, t2aaaaaaaa: 500, t3aaaaaaaa: 404, t4aaaaaaaa: 503 };
  const r = await sweepQueue({ store: st, deliver: async (e) => status[e.token], alert: async (a) => alerts.push(a) });
  ok("🔴 a delivered enquiry leaves the queue", !st.m.has("queue/1-a.json") && r.delivered === 1);
  ok("🔴 one that keeps failing is set aside after three tries and Bryson gets it in a red alert, word for word", r.parked === 1 && st.m.has("failed/2-b.json") && alerts.some((a) => a.severity === "red" && /"name":"Lost"/.test(a.body)));
  ok("a refused one is set aside with a yellow alert", r.rejected === 1 && st.m.has("failed/3-c.json") && alerts.some((a) => a.severity === "yellow"));
  ok("an OS still struggling just counts a try and waits", st.m.get("queue/4-d.json").attempts === 1 && r.retry === 1);
  let req;
  await deliverVia(async (rq) => { req = rq; return new Response("{}", { status: 200 }); })({ token: "tok123456", body: '{"a":1}', contentType: "application/json" });
  ok("🔴 delivery goes through the REAL lead intake, with the same token and body", new URL(req.url).searchParams.get("token") === "tok123456" && (await req.text()) === '{"a":1}' && req.method === "POST");
  ok("the delivery job runs every 10 minutes", /\[functions\."lead-queue-sweep"\]\s*\n\s*schedule = "\*\/10 \* \* \* \*"/.test(src("netlify.toml")));
  ok("the queue is private", /createBucket\(QUEUE_BUCKET, \{ public: false \}\)/.test(src("netlify/lib/lead-relay.mjs")));
}

// ── 4. 🔴 Every live client website, checked hourly ─────────────────────────────────────
{
  const t = new Date("2026-10-06T19:00:00Z");
  const a = nextUptime(undefined, false, t);
  ok("one miss is not an alert (blips happen)", a.alert === null && a.state.fails === 1);
  const b = nextUptime(a.state, false, t);
  ok(`🔴 ${DOWN_AFTER} misses in a row is a red alert`, b.alert === "down" && b.state.alerted === true);
  ok("it does not shout again every hour while it stays down", nextUptime(b.state, false, t).alert === null);
  const c = nextUptime(b.state, true, t);
  ok("and says when it is back", c.alert === "up" && c.state.fails === 0 && !c.state.alerted);
  ok("a healthy site writes nothing", nextUptime({ fails: 0 }, true, t).changed === false);
  ok("🔴 up means THIS client's site answered, not just anything", (await siteIsUp("www.acme.com", "acme", async () => new Response("", { headers: { "x-site": "acme" } }))) === true
    && (await siteIsUp("www.acme.com", "acme", async () => new Response("parked domain", { status: 200 }))) === false
    && (await siteIsUp("www.acme.com", "acme", async () => { throw new Error("cert"); })) === false);
  ok("it runs hourly", /\[functions\."site-uptime"\]\s*\n\s*schedule = "20 \* \* \* \*"/.test(src("netlify.toml")));
  const DC = src("netlify/functions/daily-check.mjs");
  ok("the morning check also checks the websites site answers", /add\("The client websites site answers", h\.ok/.test(DC) && /__health/.test(DC));
}

// ── 5. New client addresses go to the websites site ─────────────────────────────────────
eq("unset: everything stays where it was", sitesTarget({}), NETLIFY_TARGET);
eq("set: the websites site's address", sitesTarget({ SITES_NETLIFY_SITE: "https://BoldLine-Sites.netlify.app/" }), "boldline-sites.netlify.app");
eq("🔴 anything that isn't a netlify address is ignored", sitesTarget({ SITES_NETLIFY_SITE: "evil.com" }), NETLIFY_TARGET);
eq("their DNS points at the websites site", dnsRecords("acme.com", "boldline-sites.netlify.app")[1], { type: "CNAME", name: "www", value: "boldline-sites.netlify.app" });
ok("and the check knows to look for it there", (await checkDomain("www.acme.com", "acme", { fetchFn: async () => new Response("", { headers: { "x-site": "acme" } }), resolve: async (h, t) => (t === "CNAME" ? ["boldline-sites.netlify.app."] : []), target: "boldline-sites.netlify.app" })).dns === "ok");
const FN = src("netlify/functions/website-deal.mjs");
ok("🔴 the server adds new addresses to the websites site once it exists", /siteId: sitesTarget\(\) !== "boldlinemedia\.netlify\.app" \? sitesTarget\(\)/.test(FN));
ok("every check and every set of records uses that target", (FN.match(/resolve: resolveDns, target: sitesTarget\(\)/g) || []).length === 2 && (FN.match(/dnsRecords\([^)]*, sitesTarget\(\)\)/g) || []).length === 2);
const UI = src("index.html");
ok("the OS card shows the records for wherever the server says", /siteDnsRecords\(d\.host,\(nf&&nf\.target\)\|\|SITE_DNS_TARGET\)/.test(UI));

if (fails.length) console.error(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-sites-split: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
