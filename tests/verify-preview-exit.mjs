// A way out of a website preview (Bryson, 2026-11-04: "add an exit button in a clients portal when I'm viewing the
// preview for the website"). KB website-builder. Run: node tests/verify-preview-exit.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withPreviewBar, PREVIEW_BAR } from "../netlify/functions/site.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = readFileSync(join(ROOT, "netlify/functions/site.mjs"), "utf8"), PORTAL = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}`); };
const out = withPreviewBar('<html><body data-theme="showcase"><main>x</main></body></html>');
ok("the bar sits at the top of the page with an Exit preview button", /<body data-theme="showcase">\n<style>/.test(out) && /<button type="button" id="bl-exit">Exit preview<\/button>/.test(out));
ok("🔴 only a preview link gets it, never the live site", /return html\(view\.previewing \? withPreviewBar\(page\) : page,/.test(SITE));
ok("exit goes back to the portal this browser opened, else back, else closes the tab", /indexOf\('\/portal\?token='\)===0/.test(PREVIEW_BAR) && /history\.back\(\)/.test(PREVIEW_BAR) && /window\.close\(\)/.test(PREVIEW_BAR));
ok("🔴 it only ever returns to a portal address on the same site, never anywhere a link could point it", /v\.u\.indexOf\('\/portal\?token='\)===0/.test(PREVIEW_BAR) && /location\.pathname\+location\.search/.test(PORTAL));
ok("🔴 the OS's own portal preview remembers nothing", /if\(!BL_PREVIEW\)\{try\{localStorage\.setItem\('bl_portal_back'/.test(PORTAL));
ok("the header moves down so the bar never covers it", /\.hd\{inset:44px 0 auto!important\}/.test(PREVIEW_BAR));
const shown = PREVIEW_BAR.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ");
ok("🔴 no dashes or emojis a client reads", !/[—–]/.test(shown) && !/\p{Extended_Pictographic}/u.test(shown));
console.log(`verify-preview-exit: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
