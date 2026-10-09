// A business's brand kit (Bryson, 2026-10-09: "i need a way to import my businesses or other businesses brand
// colors not by seeing their website but by being able to upload a file and or type in the actual colors as well
// as uploading images videos etc like how they would if they were an ad client for their landing page"; "work only
// on the my business part first"). What has to stay true:
//  1. A colour typed in any common form is read right, and the OS and the server read it the same way.
//  2. A file gives real colours: an SVG's own, a picture's main ones, a PDF/image read by the AI (only real HEX
//     codes come back, and only from a file in this business's own folder).
//  3. The saved main colour wins on the website, the landing page and the emails at once.
//  4. Logo, photos and video upload into the same library an ad client's portal uses.
//  5. Built for his own businesses first (the card is on owned businesses only).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const K = await import("../netlify/lib/brand-kit.mjs");
const slice = (a, b) => UI.slice(UI.indexOf(a), UI.indexOf(b));
const OS = new Function(`${slice("const bkParseColor = ", "// The main colours in a picture")}${slice("const bkSvgColors = ", "// Upload one file into")}; return { bkParseColor, bkSvgColors };`)();

// 1. Typed colours
const CASES = ["#1d4ed8", "1D4ED8", "#abc", "abc", "rgb(29, 78, 216)", "rgba(29,78,216,0.5)", "rgb(300,0,0)", "blue", "#12345", "", " #C8A84B "];
ok("every common way of writing a colour is read", K.parseColor("#1d4ed8") === "#1D4ED8" && K.parseColor("1D4ED8") === "#1D4ED8" && K.parseColor("#abc") === "#AABBCC"
  && K.parseColor("rgb(29, 78, 216)") === "#1D4ED8" && K.parseColor(" #C8A84B ") === "#C8A84B");
ok("anything that is not a colour is refused, never guessed", K.parseColor("blue") === "" && K.parseColor("#12345") === "" && K.parseColor("rgb(300,0,0)") === "" && K.parseColor("") === "");
ok("🔴 the OS reads colours exactly as the server does", CASES.every((c) => OS.bkParseColor(c) === K.parseColor(c)));

// 2. From a file
const SVG = `<svg><path fill="#1D4ED8" d=""/><path fill="#1d4ed8"/><path style="fill:#F59E0B"/><rect fill="#ffffff"/><circle stroke="rgb(0,0,0)"/><stop stop-color="#F59E0B"/></svg>`;
ok("an SVG logo gives its own colours, brand colours before black and white", K.svgColors(SVG).join(",") === "#1D4ED8,#F59E0B,#FFFFFF,#000000");
ok("the OS reads an SVG the same way", OS.bkSvgColors(SVG).join(",") === K.svgColors(SVG).join(","));
const R = K.parseBrandRead('Here you go: {"colors":[{"hex":"#1d4ed8","name":"Primary <b>blue"},{"hex":"1D4ED8","name":"dup"},{"hex":"not a colour"},{"hex":"#F59E0B","name":"Amber"}],"headingFont":"Montserrat; drop table","bodyFont":"Inter"} hope that helps');
ok("🔴 only real HEX codes come back from the AI, no repeats", R.colors.map((c) => c.hex).join(",") === "#1D4ED8,#F59E0B" && R.colors[0].name === "Primary bblue");
ok("names and fonts come back as plain words", !/[<>"]/.test(R.colors[0].name) && R.headingFont === "Montserrat drop table" && R.bodyFont === "Inter");
ok("an answer that is not JSON gives nothing, never an error", K.parseBrandRead("sorry, I can't").colors.length === 0 && K.parseBrandRead("").headingFont === "");
ok("at most eight colours", K.parseBrandRead(JSON.stringify({ colors: Array.from({ length: 12 }, (_, i) => ({ hex: `#0000${String(i).padStart(2, "0")}` })) })).colors.length === 8);
ok("the AI is told to use printed codes and never invent fonts", /use the printed HEX exactly/.test(K.BRAND_READ_PROMPT) && /Never guess a font/.test(K.BRAND_READ_PROMPT) && !/[—–]/.test(K.BRAND_READ_PROMPT));
const F = src("netlify/functions/biz-email.mjs");
ok("🔴 the reader only opens a file in this business's own folder", /if \(!path\.startsWith\(`\$\{row\.id\}\/brand-file\/`\) \|\| path\.includes\("\.\."\)\)/.test(F));
ok("only PDF and picture files go to the AI", K.BRAND_FILE_TYPES["application/pdf"] === "document" && K.BRAND_FILE_TYPES["image/png"] === "image" && !K.BRAND_FILE_TYPES["image/svg+xml"] && /const kind = BRAND_FILE_TYPES\[String\(body\.type \|\| ""\)\];/.test(F));
ok("🔴 only for a business he owns, signed in", F.indexOf('body.action === "read-brand"') > F.indexOf("!isOwned(row.data)") && /db\.auth\.getUser\(jwt\)/.test(F));
ok("the file goes to the AI by its address, and a cheaper model reads it", /source: \{ type: "url", url: pub\.publicUrl \}/.test(F) && /for \(const model of \["claude-sonnet-5-5", "claude-sonnet-5"\]\)/.test(F));
ok("a brand file is uploaded but never added to the photo library", /bkUpload\(client, file, "brand-file", \{ confirm:false \}\)/.test(UI) && /if \(!confirm\) return \{ path: sign\.path \};/.test(UI));

// 3. The main colour wins everywhere
{
  const { brandColorOf, renderSite } = await import("../netlify/lib/site-render.mjs");
  const { bizBrand } = await import("../netlify/lib/biz-email-shell.mjs");
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const cl = { id: "b", internal: true, owned: true, name: "Desert Gloss", brandKit: { primary: "#0F766E" }, website: { brandColor: "#2F6FED" }, brandColor: "#C8A84B",
    landingSlug: "dg", landingPage: { headline: "Mobile detailing", published: true, brandColor: "#111111" } };
  ok("🔴 the website uses the brand kit's main colour over anything a generator chose", brandColorOf(cl) === "#0F766E");
  ok("🔴 so do the emails", bizBrand(cl).color === "#0F766E");
  ok("🔴 and the landing page", /#0f766e/i.test(renderLandingPage(cl)) && !/#c8a84b/i.test(renderLandingPage(cl).replace(/<script[\s\S]*?<\/script>/g, "")));
  ok("without a kit, nothing changes", brandColorOf({ ...cl, brandKit: undefined }) === "#2F6FED");
  ok("saving the kit writes the colour every surface reads", /const next = \{ \.\.\.client, brandKit, brand: \{ \.\.\.br, \.\.\.\(primary \? \{ color: primary \} : \{\}\) \}, \.\.\.\(primary \? \{ brandColor: primary \} : \{\}\) \};/.test(UI)
    && /if \(primary && client\.website && typeof client\.website === "object"\) next\.website = \{ \.\.\.client\.website, brandColor: primary \};/.test(UI));
  ok("a colour code that is wrong is shown in red and never saved", /if \(bad\.length\) \{ say\("kit","Fix the colour codes in red first/.test(UI));
}

// 4. Logo, photos, video
{
  ok("🔴 uploads go through the same library an ad client's portal uses", /fetch\(`\/\.netlify\/functions\/media\?action=sign&token=\$\{tok\}`/.test(UI.slice(UI.indexOf("const bkUpload = "))) && /action=confirm&token=\$\{tok\}/.test(UI.slice(UI.indexOf("const bkUpload = "))));
  ok("a logo is saved where the website, landing page and emails all look", /onUpdate\(\{\.\.\.client, mediaLibrary: r\.mediaLibrary \|\| lib, brandLogo: r\.url \|\| client\.brandLogo, brand:\{\.\.\.br, logoUrl: r\.url \|\| br\.logoUrl\}\}\)/.test(UI));
  ok("photos and videos go in as photos and videos, several at once", /bkUpload\(client, f, \/\^video\\\/\/\.test\(f\.type\) \? "video" : "photo"\)/.test(UI) && /fileBtn\("Upload photos or video","image\/\*,video\/\*",uploadMedia,"media",true\)/.test(UI));
  const { bizBrand } = await import("../netlify/lib/biz-email-shell.mjs");
  ok("a logo already in the library is used by the emails", bizBrand({ name: "X", mediaLibrary: [{ category: "photo", url: "https://x.co/p.jpg" }, { category: "logo", url: "https://x.co/l.png" }] }).logo === "https://x.co/l.png");
}

// 5. His businesses first
ok("🔴 the card is on his own businesses only, for now", /\{isOwned\(client\)&&<BrandKitCard client=\{client\} onUpdate=\{onUpdate\} onOpenAssets=\{\(\)=>setTab\("portal"\)\}\/>\}/.test(UI) && (UI.match(/<BrandKitCard /g) || []).length === 1);
ok("no emojis in the card", !/[\u{1F300}-\u{1FAFF}]/u.test(UI.slice(UI.indexOf("function BrandKitCard("), UI.indexOf("// ─── CUSTOMER EMAILS"))));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-brand-kit: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
