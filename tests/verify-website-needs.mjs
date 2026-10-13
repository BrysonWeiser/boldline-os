// "What we need from you": one list for the call, the copied message and the client's portal.
// Run: node tests/verify-website-needs.mjs
//
// Bryson, 2026-10-13: "build the what i need from you list so i can ask for it on a call and also have it in the
// website client portal". The rules are imported and RUN, and the OS's copy is pulled out and run against them,
// so the call and the portal can never ask for different things. KB `website-needs`.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WEBSITE_NEEDS, needsStatus, needsMessage, cleanIntake, INTAKE_FIELDS } from "../netlify/lib/website-needs.mjs";
import { needsCardHTML, websitePortalHTML, WEBSITE_PORTAL_JS } from "../netlify/lib/portal-website.mjs";
import { buildPrompt } from "../netlify/functions/site-build-background.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const PORTAL = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

const EMPTY = { name: "Summit Roofing", contactName: "Dave Mills" };
const FULL = {
  name: "Summit Roofing", contactName: "Dave Mills", businessPhone: "(602) 555-0123", email: "dave@summit.com",
  mediaLibrary: [{ category: "logo" }, ...Array.from({ length: 6 }, () => ({ category: "photo" }))],
  websiteIntake: { services: "Roof repair, from $350", different: "Family run since 2009", area: "Mesa and Gilbert", hours: "Mon to Fri 7 to 5", reviews: "https://g.page/r/x", domain: "summitroofing.com" },
};

// ── 1. The list ─────────────────────────────────────────────────────────────
{
  const ids = WEBSITE_NEEDS.map((n) => n.id);
  eq("the items, in the order a call goes", ids, ["logo", "photos", "services", "different", "area", "hours", "contact", "reviews", "domain", "likes"]);
  ok("every item has a call question and a client tip", WEBSITE_NEEDS.every((n) => n.ask && n.tip && n.title));
  ok("every written item has a field the portal saves", WEBSITE_NEEDS.filter((n) => !n.where).every((n) => n.field in INTAKE_FIELDS));
  ok("🔴 nothing a client reads uses a dash or an emoji",
    WEBSITE_NEEDS.every((n) => !/[—–]/.test(n.tip + n.title + (n.placeholder || "")) && !/\p{Extended_Pictographic}/u.test(n.tip + n.title)));
  eq("a new client has nothing in", needsStatus(EMPTY).done, 0);
  eq("and nine things to send (the tenth is optional)", needsStatus(EMPTY).total, 9);
  ok("a client who sent everything is complete", needsStatus(FULL).complete);
  ok("the optional item never holds it back", !needsStatus(FULL).items.find((i) => i.id === "likes").isDone);
  ok("🔴 four photos is not five", !needsStatus({ mediaLibrary: Array.from({ length: 4 }, () => ({ category: "photo" })) }).items.find((i) => i.id === "photos").isDone);
  eq("and it says how many are in", needsStatus({ mediaLibrary: [{ category: "photo" }, { category: "photo" }] }).items.find((i) => i.id === "photos").note, "2 of 5 sent");
  ok("a logo uploaded as a photo is not a logo", !needsStatus({ mediaLibrary: [{ category: "photo" }] }).items.find((i) => i.id === "logo").isDone);
  ok("what the OS already has counts (services typed on the record)", needsStatus({ services: "Roofing" }).items.find((i) => i.id === "services").isDone);
  ok("a web address set on the domain card counts", needsStatus({ websiteDeal: { domain: { host: "x.com" } } }).items.find((i) => i.id === "domain").isDone);
  ok("booking hours count as hours", needsStatus({ booking: { on: true } }).items.find((i) => i.id === "hours").isDone);
  ok("phone without email is not done", !needsStatus({ businessPhone: "1" }).items.find((i) => i.id === "contact").isDone);
}

// ── 2. Saving answers ───────────────────────────────────────────────────────
{
  const a = cleanIntake({ services: "  Roof repair  ", hours: "9 to 5" }, {}, "T1");
  eq("answers are trimmed and stamped", a.intake, { services: "Roof repair", hours: "9 to 5", updatedAt: "T1" });
  const b = cleanIntake({ hours: "8 to 4" }, a.intake, "T2");
  ok("🔴 saving one box never wipes another", b.intake.services === "Roof repair" && b.intake.hours === "8 to 4");
  ok("an emptied box clears that answer", !("hours" in cleanIntake({ hours: "  " }, a.intake).intake));
  ok("nothing changed means nothing to tell Bryson", cleanIntake({ services: "Roof repair" }, a.intake).changed === false);
  ok("unknown fields are dropped", !("evil" in cleanIntake({ evil: "x", services: "y" }, {}).intake));
  eq("each answer is capped", cleanIntake({ area: "x".repeat(900) }, {}).intake.area.length, INTAKE_FIELDS.area);
}

// ── 3. The copied message ───────────────────────────────────────────────────
{
  const m = needsMessage(EMPTY, { portalUrl: "https://os.example/portal?token=t" });
  ok("it greets them by first name", /^Hi Dave,/.test(m));
  ok("it lists only what is missing", needsMessage({ ...FULL, websiteIntake: { ...FULL.websiteIntake, hours: "" } }).includes("Your hours") && !needsMessage({ ...FULL, websiteIntake: { ...FULL.websiteIntake, hours: "" } }).includes("Your logo"));
  ok("it points at the portal when there is one", m.includes("portal?token=t"));
  ok("🔴 no dashes and no emojis in a message a client reads", !/[—–]/.test(m) && !/\p{Extended_Pictographic}/u.test(m));
  ok("a client with everything in gets a thank-you instead", /thanks for sending everything/.test(needsMessage(FULL)));
}

// ── 4. The portal ───────────────────────────────────────────────────────────
{
  const h = needsCardHTML(EMPTY);
  ok("the card is titled for the client", /What we need from you/.test(h));
  ok("the written items have answer boxes", (h.match(/class="inp wn-f"/g) || []).length === WEBSITE_NEEDS.filter((n) => n.field).length);
  ok("photos and the logo send them to Photos & Video", (h.match(/blGoTo\('media'\)/g) || []).length === 2);
  ok("phone and email send them to Your Information", /blGoTo\('info'\)/.test(h));
  ok("🔴 what they typed is shown back escaped", needsCardHTML({ websiteIntake: { services: "<script>x</script>" } }).includes("&lt;script&gt;"));
  const sent = needsCardHTML(FULL);
  ok("a finished list says so", /That's everything, thank you/.test(sent));
  ok("the script saves through the portal and ticks rows off", /blPost\(\{websiteIntake:o\}\)/.test(WEBSITE_PORTAL_JS) && /function blGoTo\(/.test(WEBSITE_PORTAL_JS));
  const cl = { ...EMPTY, packageId: "w-site", websiteDeal: {} };
  ok("it shows on the Website tab before the site is live", /id="wn-card"/.test(websitePortalHTML(cl, {})));
  ok("and is gone once the site is live", !/id="wn-card"/.test(websitePortalHTML({ ...cl, website: { published: true, content: {} }, websiteDeal: { launchedAt: "x" } }, {})));
  ok("🔴 the server refuses a client without a website, merges, and only alerts on a change",
    /if \(body\.websiteIntake && typeof body\.websiteIntake === "object"\)/.test(PORTAL)
    && /if \(!hasWebsite\(cur\)\) return \{ statusCode: 403/.test(PORTAL.slice(PORTAL.indexOf("if (body.websiteIntake"), PORTAL.indexOf("if (body.websiteIntake") + 400))
    && /cleanIntake\(body\.websiteIntake, cur\.websiteIntake/.test(PORTAL) && /if \(changed\) \{/.test(PORTAL));
  ok("🔴 an OS save can never overwrite what the client sent", /const SERVER_OWNED_KEYS=\[[^\]]*"websiteIntake"[^\]]*\]/.test(UI));
}

// ── 5. The builder uses it ──────────────────────────────────────────────────
{
  const p = buildPrompt({ name: "Summit", niche: "Roofing", websiteIntake: FULL.websiteIntake });
  ok("their services and prices reach the builder", p.includes("Roof repair, from $350"));
  ok("so does their story, their area and their hours", p.includes("Family run since 2009") && p.includes("Mesa and Gilbert") && p.includes("Mon to Fri 7 to 5"));
}

// ── 6. The OS copy agrees, by running it ────────────────────────────────────
{
  const from = UI.indexOf("// WN-MIRROR-START"), to = UI.indexOf("// WN-MIRROR-END");
  ok("the OS copy was found", from > 0 && to > from);
  const os = new Function(`${UI.slice(from, to)}; return { WN_NEEDS, wnStatus, wnMessage };`)();
  eq("same items", os.WN_NEEDS.map((n) => [n.id, n.title, n.ask, n.tip, n.field || n.where, !!n.optional]), WEBSITE_NEEDS.map((n) => [n.id, n.title, n.ask, n.tip, n.field || n.where, !!n.optional]));
  const probes = [EMPTY, FULL, { services: "x" }, { mediaLibrary: [{ category: "photo" }] }, { booking: { on: true } }, { businessPhone: "1", email: "e" }, { websiteDeal: { domain: { host: "a.com" } } }, { website: { reviews: [{}] } }, { googleReviewUrl: "u" }];
  const drift = probes.filter((p) => JSON.stringify(os.wnStatus(p).items.map((i) => [i.id, i.isDone, i.note])) !== JSON.stringify(needsStatus(p).items.map((i) => [i.id, i.isDone, i.note])));
  ok("🔴 the call and the portal tick off the same things", drift.length === 0, drift.map((d) => JSON.stringify(d)).join(" | "));
  ok("and copy the same message", probes.every((p) => os.wnMessage(p, { portalUrl: "u" }) === needsMessage(p, { portalUrl: "u" })));
  ok("the card sits under the agreement on both Website tab layouts", (UI.match(/<WebsiteDealCard client=\{client\} onUpdate=\{onUpdate\}\/>\n\s*<WebsiteNeedsCard client=\{client\}\/>/g) || []).length === 2);
  ok("it is only for paying website clients, never his own businesses", /const shown=!client\.internal&&\(wdAgreementLive\(client\)\|\|isWebsiteOnly\(client\)\)/.test(UI));
}

console.log(`verify-website-needs: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
