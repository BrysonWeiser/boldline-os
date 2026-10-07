// The sample business shown on BoldLine's own homepage (KB website-builder, "Homepage refresh").
// 🔴 Made up on purpose: never a real client or prospect. Shown labelled as a sample.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { renderSite, THEME_IDS } from "../netlify/lib/site-render.mjs";
export const DEMO = {
  id: "demo", name: "Saguaro Pool Co.", niche: "Pool Construction", leadToken: "demo", businessPhone: "(602) 555-0148",
  businessAddress: "Phoenix, AZ", campaignSetup: { serviceArea: "Phoenix, AZ" },
  website: { brandName: "Saguaro Pool Co.", brandColor: "#1E8FB8", publicEmail: "hello@saguaropools.example",
    stock: [{ url: "https://images.pexels.com/photos/189296/pexels-photo-189296.jpeg?auto=compress&cs=tinysrgb&w=1600", alt: "Pool at dusk" }, { url: "https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1600", alt: "Rooftop pool" }],
    reviews: [{ name: "Dana R.", text: "They built our pool in five weeks and kept us posted the whole way. The yard finally feels like a place to live.", stars: 5 }, { name: "Marcus T.", text: "Clear quote, no surprises, and the crew cleaned up every single day.", stars: 5 }],
    content: {
      hero: { eyebrow: "Custom pools in Phoenix", headline: "Your backyard, finished.", lineA: "Your backyard,", lineB: "finished.", sub: "Custom pools designed around how your family actually uses the yard, built on schedule and backed for ten years." },
      services: [{ name: "Custom pool builds", blurb: "Designed for your yard, your budget and the way you swim." }, { name: "Remodels", blurb: "New finish, tile and lighting for a pool that's seen better days." }, { name: "Spas and water features", blurb: "Add warmth and sound without starting over." }],
      why: [{ title: "Fixed quotes", text: "The number we give you is the number you pay." }, { title: "Weekly updates", text: "Photos and a plain update every Friday." }, { title: "Ten year warranty", text: "On the shell and the plumbing." }],
      about: { headline: "Family run since 2009", story: ["We started with one truck and a promise to answer the phone.", "Fifteen years later we still do."] },
      process: [{ title: "Design visit", text: "We measure, listen and sketch." }, { title: "Fixed quote", text: "Clear scope and one price." }, { title: "Build", text: "Most pools finish in five to eight weeks." }],
      faqs: [{ q: "How long does a build take?", a: "Most pools finish in five to eight weeks once permits are in." }],
      cta: { headline: "Ready for a summer at home?", sub: "Book a free design visit.", button: "Book a design visit" }, marquee: ["Custom pools", "Remodels", "Spas"],
      seo: { title: "Saguaro Pool Co.", description: "Custom pools in Phoenix." } } },
};
// Writes the three designs as HTML into `outDir`, for scripts/build-site-showcase.cjs to photograph.
export function writeDemoPages(outDir) {
  const base = "https://saguaropools.example";
  for (const th of THEME_IDS) writeFileSync(`${outDir}/demo-${th}.html`, renderSite(DEMO, "home", { base, theme: th, noindex: true }));
  return THEME_IDS;
}
// Only when run directly: the marketing site build imports DEMO and must not write anything here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) console.log("wrote", writeDemoPages(process.argv[2]).join(","));
