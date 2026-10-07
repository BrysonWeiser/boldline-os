// One look for every email a client, a lead or a subscriber gets (Bryson, 2026-10-07: "lets look
// at the email branding", then "fix it"). What has to stay true:
//  1. Every client email and the newsletter carry the same header: the gold B logo and the wordmark,
//     in the site's sans type. No Georgia serif left anywhere a client reads.
//  2. The weekly and monthly reports use that same dark design, open with counted numbers, link to the
//     portal, are signed by Bryson, and carry no em dash in the subject or the body.
//  3. An email to a client's CUSTOMER is in that business's own colour, never BoldLine gold.
//  4. Nothing a client, lead or subscriber reads carries an emoji.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CE = await import("../netlify/lib/client-emails-shared.mjs");
const RS = await import("../netlify/lib/report-shared.mjs");
const NL = await import("../netlify/lib/newsletter-shared.mjs");
const B = await import("../netlify/lib/email-brand.mjs");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const visible = (h) => h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
const DASH = /[—–]|&mdash;|&ndash;/;
const allowed = new Set(["✓", "✕", "▶", "→"]);
const emojiIn = (h) => [...h].filter((c) => /\p{Extended_Pictographic}/u.test(c) && !allowed.has(c));

// 1. One header everywhere
const ctx = { businessName: "Desert Gloss", contactName: "Marco Ruiz", packageName: "Launch System", portalUrl: "https://x/portal", setup: 750, monthly: 700, leadCount: 3, leadRate: 40 };
for (const t of CE.EMAIL_TYPES.map((e) => e.id)) {
  let r; try { r = CE.renderClientEmail(t, ctx); } catch (e) { ok(`${t}: renders`, false, e.message); continue; }
  ok(`${t}: carries the logo and wordmark header`, r.html.includes(B.EMAIL_LOGO_URL) && /BoldLine <span style="color:#C8A84B">Media<\/span>/.test(r.html));
  ok(`${t}: no serif left`, !/Georgia/.test(r.html));
  ok(`${t}: no emoji`, emojiIn(r.html).length === 0, emojiIn(r.html).join(""));
}
const nl = NL.renderNewsletterHTML({ post: { title: "T", slug: "t" }, preview: "p", paragraphs: ["a"], ctaText: "Read" });
ok("the newsletter carries the same header", nl.includes(B.EMAIL_LOGO_URL) && !/Georgia/.test(nl));
ok("🔴 the header is defined once, not copied", ["netlify/lib/client-emails-shared.mjs", "netlify/lib/newsletter-shared.mjs"].every((f) => /brandHeaderRow\(\)/.test(src(f)) && !/font-size:22px;font-weight:700;letter-spacing:\.04em;color:\$\{GOLD\}">BoldLine Media/.test(src(f))));
ok("the logo is a real file on the website", /^https:\/\/boldlinemedia\.com\/logo\.png$/.test(B.EMAIL_LOGO_URL) && readFileSync(join(ROOT, "marketing-site/logo.png")).length > 1000);

// 2. The report
{
  const now = Date.now(), ago = (d) => new Date(now - d * 864e5).toISOString();
  const client = { name: "Desert Gloss", contactName: "Marco Ruiz", portalToken: "tok",
    leadsLog: [{ receivedAt: ago(1), qualified: true }, { receivedAt: ago(3) }, { receivedAt: ago(12), qualified: true }, { receivedAt: ago(40) }],
    adPerf: { totals: { spend30d: 300 } } };
  const text = "**Summary**\nGood week.\n\n**What we changed**\n- Paused one keyword";
  const w = CE.renderReportEmail({ period: "weekly", text, client, portalUrl: "https://os/portal?token=tok", now });
  const m = CE.renderReportEmail({ period: "monthly", text, client, portalUrl: "https://os/portal?token=tok", now });
  const vals = (h) => [...h.matchAll(/letter-spacing:-\.03em;line-height:1;color:[^"]+">([^<]+)</g)].map((x) => x[1]);
  ok("🔴 the weekly report uses the same dark design as every other client email", w.html.includes(B.EMAIL_LOGO_URL) && w.html.includes(B.EMAIL_DARK.bg));
  ok("🔴 no em or en dash in the report subject or body", !DASH.test(w.subject) && !DASH.test(m.subject) && !DASH.test(visible(w.html)) && !DASH.test(visible(m.html)));
  ok("leads this week are counted from the log (2 inside 7 days)", vals(w.html)[0] === "2", vals(w.html).join(","));
  ok("the monthly report counts 30 days instead (3)", vals(m.html)[0] === "3", vals(m.html).join(","));
  ok("cost per lead is spend over 30-day leads, worked out", vals(w.html)[3] === "$100", vals(w.html).join(","));
  ok("🔴 spend is labelled as paid by the client to the platform", /paid by you straight to the ad platform/.test(w.html));
  ok("with no ad account, only the lead numbers show, never a made-up $0", vals(CE.renderReportEmail({ text, client: { ...client, adPerf: null }, now }).html).length === 2);
  ok("the report links to their portal", /Open Your Portal/.test(w.html) && w.html.includes("https://os/portal?token=tok"));
  ok("and is signed by Bryson like every other client email", /Bryson, BoldLine Media/.test(w.html) && !/The BoldLine Media Team/.test(w.html));
  ok("the report's own headings and bullets render", /What we changed/.test(w.html) && /<li[^>]*>Paused one keyword<\/li>/.test(w.html));
  ok("a client's name cannot inject into the report", !CE.renderReportEmail({ text, client: { ...client, name: "<script>x</script>" }, now }).html.includes("<script>x"));
  const rs = src("netlify/lib/report-shared.mjs");
  ok("🔴 both client report sends use the new email, never the old light one", (rs.match(/await clientReportEmail\(client, "(weekly|monthly)", clientText\)/g) || []).length === 2 && !/reportToHTML\(clientText/.test(rs));
  ok("and no client report subject is built with a dash any more", !/Performance Report — \$\{client\.name\}/.test(rs));
}

// 3. Emails to a client's customers
{
  const branded = RS.leadEmailHTML({ name: "Desert Gloss", website: { brandColor: "#2F6FED" } }, "Thanks");
  ok("🔴 an email to a client's customer uses that business's colour", branded.includes("#2F6FED") && !branded.includes("#C8A84B"));
  const plain = RS.leadEmailHTML({ name: "Desert Gloss" }, "Thanks");
  ok("and with no brand colour set, a neutral ink, still not BoldLine gold", !plain.includes("#C8A84B"));
  ok("it is headed with the business's name", /DESERT GLOSS|Desert Gloss/.test(branded));
  ok("it uses the same brand-colour rule as the website and landing page", /import \{ brandColorOf \} from "\.\/site-render\.mjs";/.test(src("netlify/lib/report-shared.mjs")));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-email-brand: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
