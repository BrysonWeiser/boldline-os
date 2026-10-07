// Cover art for every blog post, drawn in code so each post has a picture that says what it is about without a
// stock photo: a search result for Google posts, a feed post for Meta, a browser for websites, a lead alert for
// follow-up, a chart for money, a checklist for getting started, a job card for the trade guides. Black and gold
// like the rest of the site, with small differences seeded from the post's address so no two look the same.
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const coverKind = (category = "", title = "") => {
  const t = `${category} ${title}`.toLowerCase();
  if (/website|landing|page|convert|clicked|vanish/.test(t)) return "web";
  if (/weekend|holiday|pause|schedule|first 30|month|days/.test(t)) return "calendar";
  if (/meta|facebook|instagram/.test(t)) return "meta";
  if (/google|keyword|search/.test(t)) return "google";
  if (/lead|follow|call back|calls?\b/.test(t)) return "lead";
  if (/budget|cost|metric|spend|price|profit/.test(t)) return "money";
  if (/trade|detail|handyman|epoxy|tint|pressure/.test(t)) return "trade";
  return "start";
};

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const words = (s, n) => String(s || "").replace(/[^A-Za-z0-9' ]/g, "").split(/\s+/).filter(Boolean).slice(0, n).join(" ").toLowerCase();

export function coverSVG({ slug = "", category = "", title = "" } = {}, { label = true } = {}) {
  const kind = coverKind(category, title), h = hash(slug || title), r = (n) => (h >> (n * 3)) % 7;
  const G = "#C8A84B", GL = "#E8C96A", I = "#F5F3ED", M = "#7D8394", L = "rgba(255,255,255,.10)", C = "#11141C";
  const bg = `<defs><linearGradient id="g${h}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0E1118"/><stop offset="1" stop-color="#07080C"/></linearGradient>
<radialGradient id="r${h}" cx="${0.55 + r(1) * 0.05}" cy="${0.3 + r(2) * 0.04}" r=".75"><stop offset="0" stop-color="rgba(200,168,75,.22)"/><stop offset="1" stop-color="rgba(200,168,75,0)"/></radialGradient></defs>
<rect width="640" height="360" fill="url(#g${h})"/><rect width="640" height="360" fill="url(#r${h})"/>
<g opacity=".5" stroke="rgba(255,255,255,.035)">${[1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="360"/>`).join("")}${[1, 2, 3, 4].map((i) => `<line x1="0" y1="${i * 72}" x2="640" y2="${i * 72}"/>`).join("")}</g>`;
  const card = (x, y, w, hh, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="14" fill="${C}" stroke="${L}"${extra}/>`;
  const bar = (x, y, w, c = L, hh = 9) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="${hh / 2}" fill="${c}"/>`;
  const T = (x, y, s, fill, size, weight = 600) => `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="${weight}">${esc(s)}</text>`;
  let art = "";
  if (kind === "google") {
    const q = words(title, 5) || "best service near me";
    art = card(110, 58, 420, 46) + `<circle cx="138" cy="81" r="8" fill="none" stroke="${M}" stroke-width="2.5"/><line x1="144" y1="87" x2="150" y2="93" stroke="${M}" stroke-width="2.5"/>` + T(162, 87, q, I, 16, 500)
      + card(110, 122, 420, 92, ` stroke="${G}"`) + T(132, 148, "Sponsored", I, 12, 700) + bar(132, 160, 150, M, 7) + T(132, 190, "Booked this week. Call now.", GL, 17, 650) + bar(132, 200, 300, L, 6)
      + card(110, 228, 420, 70) + bar(132, 248, 120, M, 7) + bar(132, 266, 260, L, 8) + bar(132, 282, 200, L, 6);
  } else if (kind === "meta") {
    art = `<rect x="232" y="30" width="176" height="310" rx="26" fill="#0A0C12" stroke="${L}" stroke-width="2"/>` + `<circle cx="258" cy="66" r="11" fill="${G}"/>` + bar(276, 58, 70, I, 7) + bar(276, 72, 44, M, 6)
      + `<rect x="246" y="92" width="148" height="132" rx="12" fill="url(#r${h})" stroke="${L}"/><rect x="246" y="92" width="148" height="132" rx="12" fill="rgba(200,168,75,.10)"/>` + `<circle cx="${300 + r(3) * 6}" cy="150" r="26" fill="none" stroke="${GL}" stroke-width="2"/>`
      + bar(246, 238, 120, I, 8) + bar(246, 254, 90, M, 6) + `<rect x="246" y="276" width="148" height="34" rx="17" fill="${G}"/>` + T(285, 298, "Get a quote", "#15110A", 13, 700);
  } else if (kind === "web") {
    art = card(90, 44, 400, 270) + `<circle cx="112" cy="64" r="5" fill="${M}"/><circle cx="128" cy="64" r="5" fill="${M}"/><circle cx="144" cy="64" r="5" fill="${M}"/>` + bar(170, 59, 140, L, 10)
      + `<rect x="90" y="84" width="400" height="1" fill="${L}"/>` + T(118, 140, "Your phone,", I, 30, 750) + T(118, 176, "ringing more.", GL, 30, 750) + bar(118, 192, 220, M, 8) + bar(118, 208, 170, L, 8)
      + `<rect x="118" y="230" width="128" height="36" rx="18" fill="${G}"/>` + T(140, 253, "Book a visit", "#15110A", 13, 700)
      + `<rect x="430" y="130" width="120" height="196" rx="20" fill="#0A0C12" stroke="${G}" stroke-width="2"/>` + bar(446, 160, 70, I, 9) + bar(446, 176, 88, GL, 9) + bar(446, 198, 80, L, 6) + `<rect x="446" y="282" width="88" height="26" rx="13" fill="${G}"/>`;
  } else if (kind === "lead") {
    const mins = 1 + (r(1) % 3);
    art = card(140, 70, 360, 72, ` stroke="${G}"`) + `<circle cx="178" cy="106" r="18" fill="rgba(200,168,75,.16)" stroke="${G}"/>` + `<path d="M171 100c2 7 6 11 13 13l3-3c1-1 2-1 3 0l4 3c1 1 1 2 0 3l-3 3c-12-2-21-11-23-23l3-3c1-1 2-1 3 0l3 4c1 1 1 2 0 3z" fill="${GL}"/>`
      + T(210, 100, "New lead from your ad", I, 16, 650) + T(210, 122, `Called back in ${mins} min`, GL, 13, 600)
      + card(170, 160, 330, 62) + bar(194, 182, 160, M, 8) + bar(194, 200, 230, L, 7) + card(200, 238, 300, 56) + bar(224, 258, 120, M, 8) + bar(224, 274, 180, L, 6)
      + T(424, 106, `0:${40 + r(2)}`, G, 18, 700);
  } else if (kind === "money") {
    const hs = [0, 1, 2, 3, 4, 5].map((i) => 40 + i * 26 + r(i) * 6);
    art = card(100, 46, 440, 266) + T(126, 84, "Booked jobs per month", M, 14, 600) + T(126, 116, "Going up", I, 24, 750)
      + hs.map((v, i) => `<rect x="${140 + i * 62}" y="${290 - v}" width="34" height="${v}" rx="6" fill="${i === 5 ? G : "rgba(200,168,75,.28)"}"/>`).join("")
      + `<polyline points="${hs.map((v, i) => `${157 + i * 62},${280 - v * 0.9 + 30}`).join(" ")}" fill="none" stroke="${GL}" stroke-width="2.5"/>`;
  } else if (kind === "trade") {
    art = card(120, 54, 400, 250) + `<circle cx="158" cy="94" r="20" fill="rgba(200,168,75,.16)" stroke="${G}"/><path d="M151 99l10-10m-3-4l5 5m-14 14l3-3" stroke="${GL}" stroke-width="3" stroke-linecap="round"/>`
      + T(192, 92, "Job booked", I, 18, 700) + T(192, 112, "Tomorrow, 9:00 am", GL, 13, 600)
      + [0, 1, 2].map((i) => `<rect x="146" y="${142 + i * 46}" width="348" height="34" rx="10" fill="rgba(255,255,255,.03)" stroke="${L}"/><circle cx="166" cy="${159 + i * 46}" r="6" fill="${i === 0 ? G : M}"/>` + bar(184, 154 + i * 46, 130 + r(i) * 18, i === 0 ? I : M, 8)).join("");
  } else if (kind === "calendar") {
    const on = [1 + r(1) % 5, 8 + r(2) % 5, 15 + r(3) % 5];
    art = card(130, 46, 380, 270) + T(156, 86, words(title, 4).replace(/^./, (c) => c.toUpperCase()) || "Your week", I, 17, 700)
      + ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => T(162 + i * 48, 116, d, M, 12, 700)).join("")
      + Array.from({ length: 21 }, (_, n) => { const x = 150 + (n % 7) * 48, y = 128 + Math.floor(n / 7) * 54, hit = on.includes(n);
        return `<rect x="${x}" y="${y}" width="40" height="44" rx="9" fill="${hit ? "rgba(200,168,75,.22)" : "rgba(255,255,255,.03)"}" stroke="${hit ? G : L}"/>${hit ? `<circle cx="${x + 20}" cy="${y + 22}" r="5" fill="${GL}"/>` : ""}`; }).join("");
  } else {
    const head = (words(title, 5) || "before you spend a dollar").replace(/^./, (c) => c.toUpperCase());
    art = card(150, 46, 340, 270) + T(178, 88, head.length > 30 ? head.slice(0, 29).trim() + "..." : head, I, 17, 700)
      + [0, 1, 2, 3].map((i) => `<rect x="178" y="${110 + i * 46}" width="22" height="22" rx="6" fill="${i < 3 ? G : "none"}" stroke="${G}"/>${i < 3 ? `<path d="M183 ${121 + i * 46}l4 4 8-9" stroke="#15110A" stroke-width="2.5" fill="none"/>` : ""}` + bar(214, 117 + i * 46, 160 + r(i) * 14, i < 3 ? M : L, 8)).join("");
  }
  const tag = label && category ? `<g><rect x="24" y="24" width="${Math.max(80, String(category).length * 8 + 30)}" height="28" rx="14" fill="rgba(8,10,15,.7)" stroke="${"rgba(200,168,75,.4)"}"/>${T(39, 43, category, GL, 12, 700)}</g>` : "";
  return `<svg class="bx-art" viewBox="0 0 640 360" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(category || "Blog")} illustration" preserveAspectRatio="xMidYMid slice">${bg}${art}${tag}</svg>`;
}
