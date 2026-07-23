import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const anthropic = new Anthropic();

const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const LANDING_COPY_TOOL = {
  name: "landing_page_copy",
  description: "Submit the finished copy for a local-business ad landing page.",
  input_schema: {
    type: "object",
    properties: {
      headline: { type: "string", description: "Punchy headline, under 60 characters. No business name needed — it appears separately." },
      subheadline: { type: "string", description: "One supporting sentence, under 120 characters." },
      bullets: { type: "array", items: { type: "string" }, description: "3-4 short benefit bullets, each under 60 characters." },
      ctaText: { type: "string", description: "Lead-form button text, e.g. 'Get My Free Quote'. Under 30 characters." },
      heroIndex: { type: "integer", description: "Optional. Number of the ONE asset from AVAILABLE MEDIA to feature as the hero image — pick the strongest photo of real work/results, or the logo only if no photo fits. Use -1 if none of the assets would strengthen the page. Never pick a video." },
      brandColor: { type: "string", description: "The business's primary BRAND accent color as a 6-digit hex (e.g. '#C21807'). If a logo or photos are attached, derive it from the dominant brand color you SEE in them. Otherwise pick a confident, professional color that fits THIS specific business and industry — not a generic default. This becomes the page's accent (buttons, highlights). Never return gold/tan near #C8A84B (that's another company's color); avoid pure black/white unless the brand is genuinely monochrome." },
      theme: { type: "string", enum: ["light", "dark"], description: "The overall page theme (background + surfaces), chosen to MATCH the client's EXISTING brand aesthetic — their logo, photos, and what a business like this typically looks like on its website/social. Use 'dark' when the brand reads dark, premium, luxury, bold, or automotive/nightlife, or when the logo/branding you see is on a dark background. Use 'light' when the brand is clean, bright, medical, or approachable. Do NOT default to light — a dark-branded business should get a DARK page (with their accent color), not a bright one. Judge from the actual branding, not a generic template." },
      steps: { type: "array", items: { type: "string" }, description: "Exactly 3 very short 'how it works' steps (each under ~34 characters) describing the customer's path to becoming a lead for THIS business — e.g. ['Request your free quote','We reach out fast','Get it done right']. Action-oriented, no fabricated specifics." },
      design: {
        type: "object",
        description: "DESIGN DIRECTIVES that shape this page's LAYOUT and feel so it fits THIS business and does NOT look like a clone of other clients' pages. Choose each to match the brand's personality — and deliberately VARY your choices from business to business; do not default to the same combo every time.",
        properties: {
          layout: { type: "string", enum: ["split", "centered", "overlay", "capture"], description: "Overall page layout. 'split' = hero copy beside a photo; 'centered' = centered copy with a wide photo banner below; 'overlay' = full-bleed photo hero with text on top (premium/visual brands with a strong photo); 'capture' = the lead form sits IN the hero above the fold (highest-converting for lead-gen; great when there's no strong photo or the goal is maximum form fills)." },
          font: { type: "string", enum: ["modern", "elegant", "bold"], description: "Type mood. 'modern' clean sans; 'elegant' serif headings (spa/luxury/legal/wellness); 'bold' heavy sans (trades/fitness/automotive)." },
          motion: { type: "string", enum: ["up", "side", "zoom"], description: "Scroll + entrance motion style." },
          background: { type: "string", enum: ["glowgrid", "mesh", "dots", "clean"], description: "Hero background treatment." },
          benefits: { type: "string", enum: ["cards", "list", "numbered"], description: "How the 'why choose us' points are laid out." },
          shape: { type: "string", enum: ["rounded", "soft", "sharp"], description: "Corner style. 'rounded' friendly/approachable; 'sharp' modern/premium." },
          order: { type: "string", enum: ["a", "b", "c", "d"], description: "Section order variant (arranges benefits / how-it-works / gallery / offer differently; 'c' leads with the offer as a hook)." },
        },
      },
    },
    required: ["headline", "subheadline", "bullets", "ctaText"],
  },
};

const clip = (s, n) => String(s || "").slice(0, n);

// Fetch the client's real website and pull branding SIGNALS (accent color candidates,
// theme-color, light/dark hint) so the AI grounds brandColor + theme in reality instead
// of guessing. Best-effort with a hard timeout — never throws, returns null on any issue.
async function scrapeBrand(url) {
  try {
    let u = String(url || "").trim();
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(u, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; BoldLineBot/1.0; +https://boldlinemedia.com)" } }).catch(() => null);
    clearTimeout(timer);
    if (!r || !r.ok) return null;
    const text = (await r.text().catch(() => "")).slice(0, 500000);
    if (!text) return null;
    const themeColor = (text.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i) || [])[1] || "";
    const hexes = (text.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase());
    const counts = {};
    for (const h of hexes) counts[h] = (counts[h] || 0) + 1;
    const rgbOf = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const isGray = (h) => { const [r, g, b] = rgbOf(h); return Math.max(r, g, b) - Math.min(r, g, b) < 18; };
    const lumOf = (h) => { const [r, g, b] = rgbOf(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const accents = sorted.filter(([h]) => !isGray(h) && lumOf(h) > 0.06 && lumOf(h) < 0.94).slice(0, 6).map(([h, c]) => `${h} (x${c})`);
    // light/dark hint: among the most-used colors, are the bulk dark or light?
    const top = sorted.slice(0, 12);
    let darkVotes = 0, lightVotes = 0;
    for (const [h, c] of top) { if (isGray(h) || lumOf(h) < 0.2 || lumOf(h) > 0.8) { (lumOf(h) < 0.5 ? (darkVotes += c) : (lightVotes += c)); } }
    const themeHint = darkVotes > lightVotes * 1.3 ? "dark" : lightVotes > darkVotes * 1.3 ? "light" : "unclear";
    return { url: u, themeColor, accents, themeHint };
  } catch { return null; }
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  let body;
  try {
    body = JSON.parse(await req.text() || "{}");
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const name = clip(body.name, 200) || "this business";
  const niche = clip(body.niche, 100);
  const cs = body.campaignSetup || {};
  const bv = body.brandVoice || {};
  const media = (Array.isArray(body.mediaLibrary) ? body.mediaLibrary : [])
    .slice(0, 30)
    .map((m) => ({ category: clip(m && m.category, 30), label: clip(m && m.label, 200), path: clip(m && m.path, 300), url: clip(m && m.url, 500) }));

  // Ground brandColor + theme in the client's ACTUAL website when we have a URL.
  const website = clip(body.website, 300);
  const scrape = website ? await scrapeBrand(website) : null;
  const websiteBlock = scrape
    ? `\n\nWEBSITE BRANDING SIGNALS (scraped from the client's real site ${scrape.url} — trust these OVER a guess for brandColor + theme):\n- theme-color meta: ${scrape.themeColor || "none"}\n- most-used non-neutral colors (likely brand accents): ${scrape.accents.length ? scrape.accents.join(", ") : "none detected"}\n- overall light/dark feel of the site: ${scrape.themeHint}\nUse the dominant accent above as brandColor when it clearly reads as the brand color, and set theme to match the site's light/dark feel.`
    : (website ? `\n\n(Client website ${website} was provided but could not be read — infer brandColor + theme from the logo/photos/industry.)` : "");

  // Images the model can actually look at: our own storage only, no videos, capped to bound cost
  const viewable = media
    .map((m, i) => ({ ...m, index: i }))
    .filter((m) => m.category !== "video" && m.url.startsWith(`${SUPABASE_URL}/`))
    .slice(0, 10);

  const dataBlock = `Business: ${name}
Niche: ${niche || "Not specified"}
Main offer: ${clip(cs.mainOffer, 300) || "Not specified"}
Average job/ticket value: ${clip(cs.avgTicket, 100) || "Not specified"}
Service area: ${clip(cs.targetLocations, 200) || clip(cs.serviceArea, 200) || "Not specified"}
Brand tone: ${clip(bv.tone, 50) || "Professional"}
Top competitors: ${clip(bv.competitors, 300) || "Not specified"}
What makes them different: ${clip(bv.differentiator, 300) || "Not specified"}
Things to avoid mentioning: ${clip(cs.excludedKeywords, 300) || "None"}`;

  const mediaBlock = media.length
    ? `\n\nAVAILABLE MEDIA (uploaded by the client — using any of it is OPTIONAL; pick only what makes the page stronger, never feel obligated to use everything):\n${media.map((m, i) => `${i}. [${m.category || "photo"}] ${m.label || "untitled"}`).join("\n")}${viewable.length ? "\n\nThe images themselves are attached to the user message, each preceded by its asset number. Judge them VISUALLY when picking heroIndex: choose the sharpest, best-lit photo that shows real work or results (a logo only if no photo is strong enough). Skip anything blurry, dark, cluttered, or off-topic — picking nothing (-1) is better than picking a weak image. Videos are never attached and can never be the hero." : ""}`
    : "";

  const system = `You are writing the on-page copy for a single-page ad landing page for a local service business. This page is the destination for paid Google/Meta ad clicks — visitors should immediately understand the offer and want to fill out the lead form. Write in the business's brand tone. Never mention AI, bots, or automation. Never invent specific facts (awards, years in business, exact pricing) that were not provided — stay general if data is missing. Avoid anything listed under "Things to avoid mentioning."

BUSINESS DATA:
${dataBlock}${mediaBlock}${websiteBlock}

Match the page to the client's OWN brand identity — set brandColor and theme (light/dark) from their actual logo/photos/industry, not a generic look. A dark, premium, or bold brand should get a dark page with their accent color; a clean, bright brand should get a light one. Never impose a default bright/white theme on a brand that isn't bright.

Also fill in the DESIGN directives (layout, font, motion, background, benefits, shape, order) so this page's STRUCTURE and feel suit THIS business specifically. Two different clients should end up with visibly different pages, not the same template recolored — so vary these choices to fit each brand's personality (e.g. an elegant med spa: overlay or centered layout, elegant serif type, soft shapes; a bold roofing company: split layout, bold type, sharp shapes, cards). Reuse good ideas, but do not pick the same combination every time.

Call the landing_page_copy tool with your finished copy. Do not write any other text.`;

  // Attach the actual images so the model judges the pixels, not just filenames
  const visionContent = [
    ...viewable.flatMap((m) => [
      { type: "text", text: `Asset ${m.index} — [${m.category || "photo"}] ${m.label || "untitled"}:` },
      { type: "image", source: { type: "url", url: m.url } },
    ]),
    { type: "text", text: "Write the landing page copy." },
  ];

  const callModel = (content) => anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 600,
    system,
    messages: [{ role: "user", content }],
    tools: [LANDING_COPY_TOOL],
    tool_choice: { type: "tool", name: "landing_page_copy" },
  });

  try {
    let response;
    try {
      response = await callModel(visionContent);
    } catch (visionErr) {
      // A broken/unfetchable image fails the whole request — degrade to text-only rather than erroring out
      if (!viewable.length) throw visionErr;
      console.error("Vision generation failed, retrying text-only:", visionErr);
      response = await callModel("Write the landing page copy.");
    }

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse) return json({ ok: false, error: "No copy generated" }, 500);

    const { headline, subheadline, bullets, ctaText, heroIndex, brandColor, theme, steps, design } = toolUse.input;
    const dIn = design || {};
    const keep = (v, arr) => (arr.includes(v) ? v : undefined);
    const designOut = {};
    const dm = {
      layout: ["split", "centered", "overlay", "capture"], font: ["modern", "elegant", "bold"], motion: ["up", "side", "zoom"],
      background: ["glowgrid", "mesh", "dots", "clean"], benefits: ["cards", "list", "numbered"], shape: ["rounded", "soft", "sharp"], order: ["a", "b", "c", "d"],
    };
    for (const k of Object.keys(dm)) { const v = keep(dIn[k], dm[k]); if (v) designOut[k] = v; }
    const chosen = Number.isInteger(heroIndex) && heroIndex >= 0 && heroIndex < media.length && media[heroIndex].category !== "video"
      ? media[heroIndex]
      : null;
    const bcRaw = String(brandColor || "").trim();
    const brandHex = /^#?[0-9a-fA-F]{6}$/.test(bcRaw) ? `#${bcRaw.replace(/^#/, "").toLowerCase()}` : "";
    return json({
      ok: true,
      landingPage: {
        headline: clip(headline, 100),
        subheadline: clip(subheadline, 200),
        bullets: Array.isArray(bullets) ? bullets.slice(0, 5).map((b) => clip(b, 100)) : [],
        ctaText: clip(ctaText, 50) || "Get My Free Quote",
        heroPath: chosen ? chosen.path : "",
        brandColor: brandHex,
        theme: String(theme).toLowerCase() === "dark" ? "dark" : "light",
        steps: Array.isArray(steps) ? steps.slice(0, 3).map((s) => clip(s, 60)) : [],
        design: designOut,
      },
    }, 200);
  } catch (err) {
    console.error("Landing copy generation failed:", err);
    return json({ ok: false, error: "AI request failed" }, err.status || 500);
  }
};
