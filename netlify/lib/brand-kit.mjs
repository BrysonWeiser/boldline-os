// A business's brand kit: its exact colours and typefaces, from what Bryson types or a file he uploads
// (Bryson, 2026-10-09: "i need a way to import my businesses or other businesses brand colors not by seeing
// their website but by being able to upload a file and or type in the actual colors as well as uploading
// images videos etc like how they would if they were an ad client for their landing page"). KB `brand-kit`.
//
// Reading a file: an image is sampled in the browser (index.html bkPalette) and an SVG's own colours are read
// from its text; a PDF brand guide, or any image, can also be read by the AI, which returns the colours it
// names and the typefaces it names. Nothing here guesses a colour that is not in the file.

// "#1d4ed8", "1D4ED8", "#abc", "rgb(29, 78, 216)" -> "#1D4ED8"; anything else -> "".
export function parseColor(v) {
  const t = String(v || "").trim();
  let m = t.match(/^#?([0-9a-f]{6})$/i);
  if (m) return `#${m[1].toUpperCase()}`;
  m = t.match(/^#?([0-9a-f]{3})$/i);
  if (m) return `#${m[1].split("").map((c) => c + c).join("").toUpperCase()}`;
  m = t.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (m && [m[1], m[2], m[3]].every((x) => Number(x) <= 255)) return `#${[m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  return "";
}

// The colours an SVG logo actually paints with (fill / stroke / stop-color), most used first. White, black and
// near-greys are left to the end, because a logo's brand colour is almost never its outline.
export function svgColors(svgText) {
  const s = String(svgText || "").slice(0, 400000);
  const counts = new Map();
  for (const m of s.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,6}\b|rgba?\([^)]*\))/gi)) {
    const c = parseColor(m[1]);
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const grey = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) < 16; };
  return [...counts.entries()].sort((a, b) => (grey(a[0]) - grey(b[0])) || (b[1] - a[1])).map(([c]) => c).slice(0, 8);
}

export const BRAND_READ_PROMPT = `You are reading a business's brand file (a brand guide, a logo, or a brand sheet).
List only the brand colours that are actually in it, most important first, and the typefaces it names.
If a colour code is printed (HEX, RGB, or a CMYK value with a HEX next to it), use the printed HEX exactly.
If no code is printed, give your best HEX for each distinct brand colour you can see, but skip plain white, plain black and greys unless the file says they are brand colours.
Give each colour the short name the file uses, or a plain description if it has none. NEVER use a dash in a name.
For typefaces, only give names the file states. Never guess a font from how text looks.
Answer with JSON only, in exactly this shape:
{"colors":[{"hex":"#1D4ED8","name":"Primary blue"}],"headingFont":"","bodyFont":""}`;

// The model's answer, made safe: real HEX codes only, no repeats, at most eight; font names as plain words.
export function parseBrandRead(text) {
  const raw = String(text || "");
  let j = null;
  try { j = JSON.parse(raw); } catch (e) { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch (e2) { j = null; } } }
  if (!j || typeof j !== "object") return { colors: [], headingFont: "", bodyFont: "" };
  const seen = new Set();
  const colors = (Array.isArray(j.colors) ? j.colors : [])
    .map((c) => ({ hex: parseColor(c && c.hex), name: String((c && c.name) || "").replace(/[<>"]/g, "").trim().slice(0, 40) }))
    .filter((c) => c.hex && !seen.has(c.hex) && seen.add(c.hex))
    .slice(0, 8);
  const font = (f) => String(f || "").replace(/[^A-Za-z0-9 \-']/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
  return { colors, headingFont: font(j.headingFont), bodyFont: font(j.bodyFont) };
}

export const BRAND_FILE_TYPES = { "application/pdf": "document", "image/png": "image", "image/jpeg": "image", "image/webp": "image", "image/gif": "image" };
