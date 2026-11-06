// A pitch preview for a business that is ALREADY a client (KB demo-sites, "pitch previews").
// Run: node tests/verify-pitch-preview.mjs
//
// Bryson, 2026-11-03, on Springbok: "I don't want to make the website and him have access to download it or use it
// until he pays but I want to be able to show him and pitch it". What this stops, worst first:
//  1. The preview reaching the client's portal, or becoming their website, before the agreement is signed and paid.
//  2. The preview sending an enquiry or anything else real (same guard and strip as a demo).
//  3. Bryson's private notes or billing terms reaching the words the client reads.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pitchWriterOf, pitchClientOf, DEMO_GUARD_JS } from "../netlify/lib/demo-site.mjs";
import { renderDemo } from "../netlify/functions/demo-site.mjs";
import { buildPrompt } from "../netlify/functions/site-build-background.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const UI = read("index.html"), GET = read("netlify/functions/demo-site.mjs") + read("netlify/lib/demo-page.mjs") /* the page itself moved there 2026-11-05 */, BG = read("netlify/functions/demo-site-background.mjs"), PORTAL = read("netlify/functions/portal.mjs");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const TOKEN = "zyxwvutsrqponmlkjihgfedc";
const client = { id: "sb1", name: "Springbok Chiropractic, LLC", reviewSenderName: "Springbok Wellness", niche: "Chiropractic", services: "Adjustments, TMJ care",
  email: "owner@example.com", businessPhone: "(480) 555-0100", businessAddress: "1 Main St, Gilbert, AZ",
  notes: "Signed the voided envelope by mistake. BAA needed.", qualifiedLeadDef: "$40 per new patient who shows up", billingPerLead: 40,
  campaignSetup: { serviceArea: "Gilbert, Mesa and Chandler, AZ", mainOffer: "New patient exam" }, brandVoice: { tone: "warm" },
  leadToken: "real-lead-token", landingSlug: "springbok", portalToken: "real-portal",
  pitchSite: { token: TOKEN, status: "done", theme: "editorial", builtAt: new Date().toISOString(), content: DEMO_DETAIL.website.content, stock: [] } };

// ── 1. What the writer sees ──────────────────────────────────────────────────
{
  const w = pitchWriterOf(client), prompt = buildPrompt(w);
  ok("🔴 private notes, billing terms and the lead definition never reach the writer", !/voided|BAA|\$40|shows up/.test(prompt), prompt.slice(0, 300));
  ok("the real business facts do", /Springbok Wellness/.test(prompt) && /Gilbert, Mesa and Chandler/.test(prompt) && /TMJ/.test(prompt) && /New patient exam/.test(prompt));
}
// ── 2. What the page is made from, and what it shows ─────────────────────────
{
  const row = { id: "sb1", data: client };
  const cl = pitchClientOf(row, client.pitchSite);
  ok("🔴 nothing on the render copy can reach a real lead path", cl.leadToken === "demo" && cl.landingSlug === "demo" && /^demo-/.test(cl.id) && !cl.portalToken && !cl.email && !cl.notes);
  ok("it is never published", cl.website.published === false && cl.name === "Springbok Wellness");
  const out = renderDemo(row, "", { host: "os.boldlinemedia.com", pitch: true });
  ok("the preview renders with the send-nothing guard first and the preview strip", out.status === 200 && out.html.includes(DEMO_GUARD_JS.slice(0, 60)) && /Preview for Springbok Wellness/.test(out.html));
  ok("noindex, and the designs keep the private link", /noindex/i.test(out.html) && out.html.includes(`/demo/${TOKEN}`));
  ok("🔴 no BoldLine or real lead token in the page", !/real-lead-token|real-portal/.test(out.html));
}
// ── 3. The server: stored apart from the website, found by its own token ────
{
  ok("built onto `pitchSite` only, never `website`", /pitchSite: \{ \.\.\.\(data\.pitchSite \|\| \{\}\), \.\.\.patch \}/.test(BG) && !/website:/.test(BG.slice(BG.indexOf("async function buildPitch"))));
  ok("BoldLine's own businesses can't have one (they build straight from the Website tab)", /if \(row\.data\.internal\) return json\(\{ ok: false/.test(BG));
  ok("the private link finds a client's pitch when it isn't a prospect's demo", /eq\("data->pitchSite->>token", token\)/.test(GET));
  ok("it expires like a demo", /if \(demoExpired\(demo\)\)/.test(GET));
  ok("🔴 the portal never mentions it", !/pitchSite/.test(PORTAL));
}
// ── 4. The OS ────────────────────────────────────────────────────────────────
{
  const comp = UI.slice(UI.indexOf("function PitchPreviewCard"), UI.indexOf("function DemoSiteBox"));
  ok("the preview is server-owned, so a browser save can't overwrite it", /SERVER_OWNED_KEYS=\[[^\]]*"pitchSite"/.test(UI));
  ok("🔴 'Make it their website' only once signed AND paid (the builder's own lock)", /const unlocked=!wdBuildLock\(client\);/.test(comp) && /const adopt=async\(\)=>\{\s*if\(!unlocked\) return;/.test(comp) && /\{unlocked&&<button onClick=\{adopt\}/.test(comp));
  ok("adopting keeps it unpublished", /published:false,fromPitch:/.test(comp));
  ok("hidden on BoldLine's own accounts and once a site is live", /if\(!id\|\|client\.internal\|\|\(client\.website&&client\.website\.published\)\) return null;/.test(comp));
  ok("on the Website tab with the agreement, both layouts", (UI.match(/<WebsiteNeedsCard client=\{client\}\/>\n\s*<PitchPreviewCard client=\{client\} onUpdate=\{onUpdate\}\/>/g) || []).length === 2);
  ok("the website offer on Overview points to it", /Show them a preview<\/button>/.test(UI));
}
console.log(`verify-pitch-preview: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
