// Health clients and the HIPAA safeguards (Bryson, 2026-11-09, KB hipaa-health-clients): "make sure it's
// automatically turned on for springbok wellness and for any niches that are medical or under HIPAA rules ... I also
// want a way to be able to change them if I want". Run: node tests/verify-health-mode.mjs
//
// What has to stay true:
//  1. Every medical niche in the OS dropdown (and Springbok Wellness) is a health client automatically, and no
//     trade, legal, retail or beauty niche is.
//  2. Bryson can override it per client (Always on / Off) and switch any one safeguard off, from the OS card.
//  3. The OS screen's copy of the niche list and safeguards is identical to the server's.
//  4. Each safeguard really reaches the part of the OS it names: the form, the Meta Pixel, our texts and emails to
//     leads, emails to patients, review replies and the ad writer.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const H = await import("../netlify/lib/health-mode.mjs");
const S = read("index.html");

// ── 1. Who is a health client ────────────────────────────────────────────────────────────────────────────────────
const SPRING = { id: "sp", name: "Springbok Wellness", niche: "Chiropractic" };
ok("🔴 Springbok Wellness is a health client automatically", H.healthModeOf(SPRING).on && H.healthModeOf(SPRING).mode === "auto");
ok("by its name alone too", H.looksHealth({ name: "Springbok Wellness" }));
const gi = S.indexOf("const NICHE_GROUPS = {"), ge = S.indexOf("};", gi);
const GROUPS = eval("(" + S.slice(gi + "const NICHE_GROUPS = ".length, ge + 1) + ")");
const med = GROUPS["Health & Medical"] || [];
ok("the OS has a Health & Medical niche group", med.length >= 10, String(med.length));
const missed = med.filter((n) => !H.looksHealth({ niche: n }));
ok("🔴 every Health & Medical niche switches on by itself", !missed.length, missed.join(", "));
const wrong = Object.entries(GROUPS).filter(([g]) => g !== "Health & Medical").flatMap(([, l]) => l).filter((n) => H.looksHealth({ niche: n }));
ok("no other niche in the dropdown does", !wrong.length, wrong.join(", "));
for (const n of ["Dentist", "Med spa", "Physical therapy", "Counseling", "IV therapy", "Weight loss clinic", "Pharmacy", "Urgent care", "Pediatrics", "Main Street Dental"])
  ok(`"${n}" is health`, H.looksHealth({ niche: n }));
for (const n of ["Car detailing", "Handyman", "Epoxy floors", "Window tint", "Pool construction", "Roofing", "Veterinary clinic", "Personal injury law", "Medical malpractice attorney", "Massage therapy", "Day spa", "House rehab"])
  ok(`"${n}" is not`, !H.looksHealth({ niche: n }));

// ── 2. Overrides ─────────────────────────────────────────────────────────────────────────────────────────────────
ok("Off by hand wins over the niche", !H.healthModeOf({ ...SPRING, healthMode: "off" }).on);
ok("Always on by hand wins over the niche", H.healthModeOf({ name: "Summit Pools", niche: "Pool construction", healthMode: "on" }).on);
ok("an unknown stored value means Auto", H.healthModeOf({ ...SPRING, healthMode: "maybe" }).mode === "auto");
ok("all six safeguards on by default", H.healthModeOf(SPRING).active.length === 6 && H.SAFEGUARD_KEYS.length === 6);
const lessOne = { ...SPRING, healthSafeguards: { autoReply: false } };
ok("one safeguard can be switched off alone", !H.healthBlocks(lessOne, "autoReply") && H.healthBlocks(lessOne, "form") && H.healthBlocks(lessOne, "pixel"));
ok("a switched-off client blocks nothing", H.SAFEGUARD_KEYS.every((k) => !H.healthBlocks({ ...SPRING, healthMode: "off" }, k)));
ok("a non-health client blocks nothing", H.SAFEGUARD_KEYS.every((k) => !H.healthBlocks({ name: "Apex Roofing", niche: "Roofing" }, k)));
ok("it says why, in words", /On automatically: "Chiropractic"/.test(H.healthModeOf(SPRING).why) && /by hand/.test(H.healthModeOf({ ...SPRING, healthMode: "off" }).why));
ok("the plain words carry no dashes", !/[—–]/.test(JSON.stringify(H.SAFEGUARDS)));

// ── 3. The OS copy matches ───────────────────────────────────────────────────────────────────────────────────────
const lit = (src, name) => { const m = src.match(new RegExp(`const ${name} = ("(?:[^"\\\\]|\\\\.)*");`)); return m ? JSON.parse(m[1]) : null; };
const lib = read("netlify/lib/health-mode.mjs");
ok("🔴 OS niche list = server niche list", lit(S, "HEALTH_NICHE_SRC") === H.HEALTH_NICHE_SRC && lit(lib, "HEALTH_NICHE_SRC") === H.HEALTH_NICHE_SRC);
ok("🔴 OS exclusions = server exclusions", lit(S, "HEALTH_NOT_SRC") === H.HEALTH_NOT_SRC);
const si = S.indexOf("const HEALTH_SAFEGUARDS = "), se = S.indexOf("\n];", si);
const OS_SAFE = eval(S.slice(si + "const HEALTH_SAFEGUARDS = ".length, se + 3));
ok("🔴 OS safeguards = server safeguards", JSON.stringify(OS_SAFE) === JSON.stringify(H.SAFEGUARDS));
const bi = S.indexOf("const healthText="), be = S.indexOf("const healthBlocks=", bi);
const osFns = new Function("HEALTH_NICHE_SRC", "HEALTH_NOT_SRC", "HEALTH_SAFEGUARDS", S.slice(bi, S.indexOf("\n", be)) + "\nreturn {healthModeOf, healthBlocks};")(H.HEALTH_NICHE_SRC, H.HEALTH_NOT_SRC, H.SAFEGUARDS);
const sample = [SPRING, { ...SPRING, healthMode: "off" }, lessOne, { name: "Apex Roofing", niche: "Roofing" }, { name: "Summit Pools", niche: "Pool construction", healthMode: "on" }, { name: "Luxe Med Spa", niche: "Med Spa" }, {}];
ok("OS and server give the same answer for every sample", sample.every((c) => JSON.stringify(osFns.healthModeOf(c)) === JSON.stringify(H.healthModeOf(c))));

// The card: render it, press its buttons, read what it saves.
{
  const start = S.indexOf("function HealthPrivacyCard({"), end = S.indexOf("function GoogleListingCard({", start);
  const { transform } = await import("@babel/standalone");
  const compiled = transform(S.slice(start, end), { presets: ["react"] }).code;
  const flat = (kids) => kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true);
  const React = { createElement: (type, props, ...kids) => typeof type === "function" ? type({ ...(props || {}), children: flat(kids) }) : ({ type, props: props || {}, children: flat(kids) }), Fragment: "frag" };
  const walk = (n, out = []) => { if (!n || typeof n !== "object") return out; out.push(n); (n.children || []).forEach((k) => walk(k, out)); return out; };
  const textOf = (n) => (n.children || []).map((k) => (typeof k === "object" ? textOf(k) : String(k))).join("");
  const mount = (client) => {
    let saved = null; const cells = []; let i = 0;
    const useState = (init) => { const k = i++; if (cells.length <= k) cells[k] = init; return [cells[k], (v) => { cells[k] = typeof v === "function" ? v(cells[k]) : v; }]; };
    const Card = (p) => ({ type: "Card", props: p, children: p.children });
    const Label = (p) => ({ type: "Label", props: p, children: p.children });
    const C = { gold: "#C8A84B", border: "#333", borderAccent: "#C8A84B", text: "#fff", textDim: "#aaa", textMuted: "#888", red: "#f44" };
    const Fn = new Function("React", "useState", "Card", "Label", "C", "healthModeOf", "HEALTH_SAFEGUARDS", `${compiled}\nreturn HealthPrivacyCard;`)(React, useState, Card, Label, C, osFns.healthModeOf, H.SAFEGUARDS);
    const render = () => { i = 0; return Fn({ client, onUpdate: (c) => { saved = c; } }); };
    return { render, get saved() { return saved; } };
  };
  const m = mount(SPRING); const tree = m.render(), txt = walk(tree).map(textOf).join(" ");
  ok("Springbok's card reads On, 6 of 6, and why", /On · 6 of 6/.test(txt) && /On automatically/.test(txt), txt.slice(0, 200));
  ok("it lists every safeguard with a tick box", walk(tree).filter((n) => n.type === "input" && n.props.type === "checkbox").length === 6);
  walk(tree).find((n) => n.type === "button" && textOf(n) === "Off").props.onClick();
  ok("🔴 pressing Off saves healthMode off", m.saved && m.saved.healthMode === "off");
  const box = walk(m.render()).filter((n) => n.type === "input")[2];
  box.props.onChange({ target: { checked: false } });
  ok("🔴 unticking one safeguard saves it as off, and only it", m.saved && m.saved.healthSafeguards && m.saved.healthSafeguards[H.SAFEGUARD_KEYS[2]] === false && Object.keys(m.saved.healthSafeguards).length === 1);
  const m2 = mount({ ...SPRING, healthSafeguards: { autoReply: false } });
  walk(m2.render()).filter((n) => n.type === "input")[2].props.onChange({ target: { checked: true } });
  ok("ticking it again removes the override", m2.saved && !("autoReply" in m2.saved.healthSafeguards));
  const roof = mount({ name: "Apex Roofing", niche: "Roofing" }); const rt = roof.render();
  ok("a non-health client shows a quiet Off line with a Change button", /Off/.test(walk(rt).map(textOf).join(" ")) && walk(rt).some((n) => n.type === "button" && textOf(n) === "Change") && !walk(rt).some((n) => n.type === "input"));
  walk(rt).find((n) => n.type === "button" && textOf(n) === "Change").props.onClick();
  walk(roof.render()).find((n) => n.type === "button" && textOf(n) === "Always on").props.onClick();
  ok("and can be switched on by hand", roof.saved && roof.saved.healthMode === "on");
  ok("the card is on both client overviews", (S.match(/<HealthPrivacyCard client=\{client\} onUpdate=\{onUpdate\}\/>/g) || []).length === 2);
}

// ── 4. Each safeguard reaches what it names ──────────────────────────────────────────────────────────────────────
// Pixel: the real landing page renderer.
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const base = { id: "x", landingSlug: "x", leadToken: "T", metaPixelId: "1234567890", campaignSetup: {}, landingPage: { headline: "Feel better", ctaText: "Book", published: true } };
  const hp = renderLandingPage({ ...base, name: "Springbok Wellness", niche: "Chiropractic" });
  const rp = renderLandingPage({ ...base, name: "Apex Roofing", niche: "Roofing" });
  const offp = renderLandingPage({ ...base, name: "Springbok Wellness", niche: "Chiropractic", healthSafeguards: { pixel: false } });
  ok("🔴 no Meta Pixel on a health client's page, even with an id set", !/fbq\(|connect\.facebook\.net/.test(hp));
  ok("a roofer's page still has it", /fbq\('init'/.test(rp));
  ok("switching the pixel safeguard off brings it back", /fbq\('init'/.test(offp));
  ok("the health page has no free-text box", !/<textarea/.test(hp));
}
// Review replies.
{
  const { replyPrompt } = await import("../netlify/lib/gbp.mjs");
  const rv = { stars: 5, reviewer: "Ann", comment: "My back pain is gone after three visits" };
  ok("🔴 review replies for a health client never confirm a patient", replyPrompt(SPRING, rv).system.includes(H.HEALTH_REPLY_RULE));
  ok("a roofer's replies are unchanged", !replyPrompt({ name: "Apex Roofing", niche: "Roofing" }, rv).system.includes(H.HEALTH_REPLY_RULE));
}
// Ad writer.
{
  const A = await import("../netlify/lib/ad-gen-shared.mjs");
  ok("🔴 the ad writer gets the health rules", A.systemFor(false, true).includes(H.HEALTH_AD_RULES) && !A.systemFor(false, false).includes("HEALTH AD RULES"));
  ok("never for BoldLine's own ads", !A.systemFor(true, true).includes("HEALTH AD RULES"));
  const fake = (data) => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { data } }) }) }) }) });
  ok("it looks the client up when the screen didn't say", await A.healthForAds(fake(SPRING), { clientId: "sp" }) === true && await A.healthForAds(fake({ name: "Apex Roofing", niche: "Roofing" }), { clientId: "r" }) === false);
  ok("and respects the ad-rules switch", await A.healthForAds(fake({ ...SPRING, healthSafeguards: { adRules: false } }), { clientId: "sp" }) === false);
  ok("both ad functions pass it", ["netlify/functions/ad-generator.mjs", "netlify/functions/ad-generator-background.mjs"].every((f) => /const health = await healthForAds\(supabase, body\);/.test(read(f)) && !/systemFor\(!!body\.agency\)[,)]/.test(read(f))));
  ok("the OS creative button sends the flag", /action:"creatives", agency: !!isHouse\(client\), clientId: client\.id, health: healthBlocks\(client,"adRules"\)/.test(S));
}
// Patient emails.
{
  const R = await import("../netlify/lib/review-requests.mjs");
  const B = await import("../netlify/lib/biz-email.mjs");
  ok("patient emails off for a health client", R.isHealthBusiness(SPRING) && !R.isHealthBusiness({ ...SPRING, healthSafeguards: { patientEmails: false } }));
  const now = Date.now();
  const plan = R.planReviewSends([{ id: 1, client_id: "sp", email: "a@b.co", status: "queued", created_at: new Date(now - 1e6).toISOString() }], { clientsById: { sp: { ...SPRING, googleReviewUrl: "https://g.page/r/abc/review" } }, now });
  ok("🔴 review requests already queued for a health client are stopped", (plan.stops || []).some((x) => x.reason === "health") && !(plan.sends || []).length, JSON.stringify(plan).slice(0, 200));
  ok("the review-request screen refuses to add a health client's patients", /if \(isHealthBusiness\(client\)\) return json\(\{ ok: false, error: "Review requests are off for this health client/.test(read("netlify/functions/review-requests.mjs")));
  ok("past-customer emails are refused too", typeof B.customerEmailsHealthBlocked === "function" && /isHealthBusiness/.test(read("netlify/lib/biz-email.mjs")));
}
// Lead intake and follow-ups.
{
  const LI = read("netlify/functions/lead-intake.mjs"), LF = read("netlify/functions/lead-followup.mjs");
  const drop = LI.indexOf('if (healthBlocks(data.data, "form")) lead.message = "";'), save = LI.indexOf("nextData = await appendLead(");
  ok("🔴 what a visitor typed is dropped BEFORE the lead is saved or sent anywhere", drop > 0 && save > drop);
  ok("🔴 no instant text or email to a health client's lead", /const notifyLead = async \(client, lead\) => \{\n[^\n]*\n  if \(healthBlocks\(client, "autoReply"\)\) return;/.test(LI));
  ok("🔴 no follow-up sequence either", /if \(healthBlocks\(client, "autoReply"\)\) return \{ id: row\.id, skipped: "health client" \};/.test(LF) && LF.indexOf('skipped: "health client"') < LF.indexOf("for (const lead of leadsLog)"));
  ok("the website form reads the same switch", /const isHealth = \(cl\) => healthBlocks\(cl, "form"\);/.test(read("netlify/lib/site-render.mjs")));
  ok("the blog writer reads it", /const isHealth = \(cl\) => healthModeOf\(cl\)\.on;/.test(read("netlify/lib/site-blog.mjs")));
  ok("no second copy of the niche list left anywhere on the server", !/chiro\|dental/.test(read("netlify/lib/site-render.mjs") + read("netlify/lib/site-blog.mjs") + read("netlify/lib/review-requests.mjs")));
}

if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-health-mode: ${pass} checks passed`);
