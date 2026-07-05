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
    },
    required: ["headline", "subheadline", "bullets", "ctaText"],
  },
};

const clip = (s, n) => String(s || "").slice(0, n);

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
${dataBlock}${mediaBlock}

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

    const { headline, subheadline, bullets, ctaText, heroIndex } = toolUse.input;
    const chosen = Number.isInteger(heroIndex) && heroIndex >= 0 && heroIndex < media.length && media[heroIndex].category !== "video"
      ? media[heroIndex]
      : null;
    return json({
      ok: true,
      landingPage: {
        headline: clip(headline, 100),
        subheadline: clip(subheadline, 200),
        bullets: Array.isArray(bullets) ? bullets.slice(0, 5).map((b) => clip(b, 100)) : [],
        ctaText: clip(ctaText, 50) || "Get My Free Quote",
        heroPath: chosen ? chosen.path : "",
      },
    }, 200);
  } catch (err) {
    console.error("Landing copy generation failed:", err);
    return json({ ok: false, error: "AI request failed" }, err.status || 500);
  }
};
