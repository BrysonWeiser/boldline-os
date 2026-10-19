// The portal's OS look (v4): a layer that can never change what the page does. KB `portal-os-look`.
// Run: node tests/verify-portal-look.mjs
import { PORTAL_LOOK_CSS, PORTAL_LOOK_JS, PORTAL_FONTS_HREF } from "../netlify/lib/portal-look.mjs";
const { _internal } = await import("../netlify/functions/portal.mjs");

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}`); };

const base = { id: "c1", name: "Test <Co>", contactName: "Pat Lee", packageId: "g-launch", portalToken: "t", leadToken: "l", leadsLog: [], commLog: [], mediaLibrary: [], campaignSetup: {}, brandVoice: {} };
const setup = _internal.makePortalHTML({ ...base, stage: "onboarding" }, _internal.findPkg("g-launch"), undefined, {});
const live = _internal.makePortalHTML({ ...base, stage: "active", leadsLog: [{ name: "A", receivedAt: new Date().toISOString() }] }, _internal.findPkg("g-launch"), undefined, {});

ok("the page carries the new look and its script", setup.includes(PORTAL_LOOK_CSS) && setup.includes(PORTAL_LOOK_JS) && setup.includes(PORTAL_FONTS_HREF));
ok("the welcome line says which view it is", /data-k="Campaign status"/.test(setup) && /data-k="Live results"/.test(live));
ok("🔴 the client's name in the header is escaped", /class="hb-client">Test &lt;Co&gt;</.test(setup));
ok("the 3D core only decorates the ring that already exists (no WebGL = the old ring stays)", /class="ring" style="--p:/.test(setup) && /querySelectorAll\('\.ring'\)/.test(PORTAL_LOOK_JS));
ok("🔴 the look script never talks to the server (previews stay harmless)", !/fetch\(|XMLHttpRequest|sendBeacon|blPost|\.submit\(/.test(PORTAL_LOOK_JS));
ok("🔴 reduce motion gets one still frame, slow or low-memory phones get no 3D", /prefers-reduced-motion: reduce/.test(PORTAL_LOOK_JS) && /if\(rm\)\{draw\(performance\.now\(\)\);return;\}/.test(PORTAL_LOOK_JS) && /saveData/.test(PORTAL_LOOK_JS) && /deviceMemory/.test(PORTAL_LOOK_JS) && /if\(lite\)return;/.test(PORTAL_LOOK_JS));
ok("it waits until the page is usable", /addEventListener\('load'/.test(PORTAL_LOOK_JS));
ok("it stops drawing when the core is off screen or the tab is hidden", /IntersectionObserver/.test(PORTAL_LOOK_JS) && /document\.hidden/.test(PORTAL_LOOK_JS));
ok("no library is downloaded for it", !/<script[^>]+src=[^>]*three/i.test(setup) && !/cdnjs|unpkg|jsdelivr/.test(PORTAL_LOOK_JS));
ok("🔴 the shipped script has no internal comments, emojis or dashes", !/(^|[^:'"\\])\/\/[^\n]/.test(PORTAL_LOOK_JS.replace(/https?:\/\//g, "")) && !/\p{Extended_Pictographic}/u.test(PORTAL_LOOK_JS + PORTAL_LOOK_CSS) && !/[—–]/.test(PORTAL_LOOK_JS + PORTAL_LOOK_CSS));
ok("chart bars rise once and sit still for reduce motion", /barUp/.test(PORTAL_LOOK_CSS) && /prefers-reduced-motion:reduce\)\{\.bar::before\{animation:none\}/.test(PORTAL_LOOK_CSS));

console.log(`verify-portal-look: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
