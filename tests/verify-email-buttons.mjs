// The gold email button stays gold everywhere (Bryson, 2026-10-07, a screenshot of the free website
// check in Gmail on his iPhone: "the button is too dark"). Gmail's iPhone app in dark mode recolours
// every email, and turned the gold button olive. It never recolours pictures, so every fixed label is a
// picture of the button. What has to stay true:
//  1. Every fixed button label in a client email has its picture, at the size the email says.
//  2. The picture sits on a gold cell, so with pictures off it is still a gold button with the words on it.
//  3. A label with no picture (the newsletter's, written by the AI) still gets a button whose gold
//     Gmail leaves alone.
//  4. All three email builders use the one button, so none can drift back to the old one.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanEmailButtonLabels } from "../scripts/email-button-labels.mjs";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const { EMAIL_BUTTON_IMAGES, EMAIL_BUTTON_VERSION } = await import("../netlify/lib/email-button-images.mjs");
const { emailButton, EMAIL_BUTTON_BASE } = await import("../netlify/lib/email-button.mjs");
const pngSize = (f) => { const b = readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

// 1. Every fixed label has its picture
const labels = scanEmailButtonLabels(ROOT);
ok("the email code has fixed button labels to check", labels.length >= 20, String(labels.length));
for (const label of labels) {
  const pic = EMAIL_BUTTON_IMAGES[label];
  if (!pic) { fails.push(`🔴 "${label}" has no picture: run scripts/build-email-buttons.mjs`); continue; }
  const file = join(ROOT, "marketing-site/email", EMAIL_BUTTON_VERSION, pic.file);
  if (!existsSync(file)) { fails.push(`🔴 the picture for "${label}" is missing from the website: ${pic.file}`); continue; }
  const px = pngSize(file);
  ok(`"${label}" is drawn sharp for phone screens (twice the size it shows at)`, Math.abs(px.w - pic.w * 2) <= 2 && Math.abs(px.h - pic.h * 2) <= 2, `${px.w}x${px.h} vs ${pic.w}x${pic.h}`);
}
ok("no leftover pictures for buttons that no longer exist", Object.keys(EMAIL_BUTTON_IMAGES).every((l) => labels.includes(l)),
  Object.keys(EMAIL_BUTTON_IMAGES).filter((l) => !labels.includes(l)).join(", "));
ok("the pictures are served from BoldLine's own website, in a versioned folder", EMAIL_BUTTON_BASE === `https://boldlinemedia.com/email/${EMAIL_BUTTON_VERSION}/`);
ok("the website caches them for good (a new look gets a new folder)", /\/email\/\*\n  Cache-Control: public, max-age=31536000, immutable/.test(src("marketing-site/_headers")));

// 2. A picture button
{
  const h = emailButton("Book a Free 30-Minute Call", "https://cal.example/x?a=1&b=2");
  const pic = EMAIL_BUTTON_IMAGES["Book a Free 30-Minute Call"];
  ok("🔴 a fixed label is sent as its picture", h.includes(`<img src="${EMAIL_BUTTON_BASE}${pic.file}" width="${pic.w}" height="${pic.h}"`));
  ok("🔴 with the words as its alt text, so pictures-off still reads as the button", /alt="Book a Free 30-Minute Call &rarr;"/.test(h));
  ok("🔴 on a gold cell that Gmail leaves gold", /<td align="center" style="border-radius:10px;background:#C8A84B;background-image:linear-gradient\(#C8A84B,#C8A84B\)">/.test(h));
  ok("pictures-off words are dark on that gold", /color:#15110A/.test(h));
  ok("the link is escaped", h.includes('href="https://cal.example/x?a=1&amp;b=2"'));
  ok("no link, no button", emailButton("Pick a Time", "") === "");
}
// 3. A label with no picture
{
  const h = emailButton("Read the full post", "https://boldlinemedia.com/blog/x/");
  ok("🔴 an AI-written label gets the drawn button, its gold locked as a background image", !/<img/.test(h) && /background-image:linear-gradient\(#C8A84B,#C8A84B\)/.test(h) && />Read the full post &rarr;<\/a>/.test(h));
  ok("its words are escaped", emailButton("A <b> & C", "https://x.example/").includes("A &lt;b&gt; &amp; C &rarr;"));
}

// 4. One button everywhere
for (const f of ["netlify/lib/client-emails-shared.mjs", "netlify/functions/lead-leak-audit-background.mjs", "netlify/lib/newsletter-shared.mjs"]) {
  const s = src(f);
  ok(`🔴 ${f.split("/").pop()} uses the one shared button`, /import \{ emailButton \} from "\.\.?\/(lib\/)?email-button\.mjs";/.test(s) && /emailButton\(/.test(s));
  ok(`${f.split("/").pop()} has no hand-drawn gold button left`, !/background:\$\{GOLD\}"><a href/.test(s));
}
{
  const { renderClientEmail } = await import("../netlify/lib/client-emails-shared.mjs");
  const html = renderClientEmail("welcome", { businessName: "Apex", contactName: "Mike", portalUrl: "https://os.example/p?t=1" }).html;
  ok("🔴 a real client email carries the picture button", html.includes(`${EMAIL_BUTTON_BASE}open-your-client-portal.png`));
  const N = await import("../netlify/lib/newsletter-shared.mjs");
  const nl = N.renderNewsletterHTML({ post: { title: "T", slug: "s" }, preview: "p", paragraphs: ["a"], ctaText: "Read it" });
  ok("the newsletter's button keeps its gold in Gmail", /background-image:linear-gradient\(#C8A84B,#C8A84B\)/.test(nl) && />Read it &rarr;<\/a>/.test(nl));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-email-buttons: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
