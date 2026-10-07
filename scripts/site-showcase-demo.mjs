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
// Trade samples for the industry pages on boldlinemedia.com (KB marketing-site-pages, "Trade pages"). Made up on
// purpose, like the pool company: 555 phone numbers, reserved .example email addresses, no real business.
const px = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
export const DEMO_DETAIL = {
  id: "demo-detail", name: "Northline Auto Detailing", niche: "Car Detailing", leadToken: "demo", businessPhone: "(480) 555-0172",
  businessAddress: "Scottsdale, AZ", campaignSetup: { serviceArea: "Scottsdale, AZ" },
  website: { brandName: "Northline Auto Detailing", brandColor: "#C7362F", publicEmail: "book@northlinedetail.example",
    stock: [{ url: px(6873123), alt: "Detailer finishing a white sports car" }, { url: px(6873089), alt: "Pressure washing a car" }, { url: px(6872572), alt: "Hand drying paint with a microfiber towel" }, { url: px(3354648), alt: "White car under the lights" }],
    reviews: [{ name: "Chris M.", text: "They came to my office, and by lunch the car looked better than the day I bought it.", stars: 5 }, { name: "Alyssa P.", text: "Booked online in a minute. The ceramic coating still beads water months later.", stars: 5 }],
    content: {
      hero: { eyebrow: "Mobile detailing in Scottsdale", headline: "Showroom shine, in your driveway.", lineA: "Showroom shine,", lineB: "in your driveway.", sub: "Hand washes, paint correction and ceramic coating, done at your home or office so you never lose a day to the car wash." },
      services: [{ name: "Full detail", blurb: "Inside and out, from the wheel wells to the headliner." }, { name: "Paint correction", blurb: "Swirls and light scratches polished out, so the paint looks deep again." }, { name: "Ceramic coating", blurb: "A hard, glossy layer that keeps the shine and makes every wash easier." }],
      why: [{ title: "We come to you", text: "The van carries its own water and power." }, { title: "Gentle on paint", text: "Soft mitts, clean towels and products made for the finish you have." }, { title: "Book in a minute", text: "Pick a time online and get a reminder the day before." }],
      about: { headline: "One van, done properly", story: ["We started with a bucket, a buffer and a few neighbors' cars.", "Now we run two vans, and every car still gets the same care."] },
      process: [{ title: "Book online", text: "Choose the service and a time that suits you." }, { title: "We arrive", text: "On time, with everything we need." }, { title: "Drive away", text: "A walk around with you before we leave." }],
      faqs: [{ q: "Do you need my water or power?", a: "No. The van carries both." }, { q: "How long does a full detail take?", a: "Most cars take three to four hours." }],
      cta: { headline: "Ready for that new car feeling?", sub: "Pick a time that suits you.", button: "Book a detail" }, marquee: ["Full details", "Paint correction", "Ceramic coating"],
      seo: { title: "Northline Auto Detailing", description: "Mobile car detailing in Scottsdale." } } },
};
export const DEMO_HANDY = {
  id: "demo-handy", name: "Cedar and Nail Home Repair", niche: "Handyman", leadToken: "demo", businessPhone: "(602) 555-0193",
  businessAddress: "Mesa, AZ", campaignSetup: { serviceArea: "Mesa, AZ" },
  website: { brandName: "Cedar and Nail", brandColor: "#2F6B4F", publicEmail: "hello@cedarandnail.example",
    stock: [{ url: px(1249611), alt: "Drilling into a floor" }, { url: px(6474471), alt: "Painting a wall" }, { url: px(5691622), alt: "Smoothing drywall" }, { url: px(5691590), alt: "Wiring an outlet" }],
    reviews: [{ name: "Sandra K.", text: "I sent a list of nine small jobs and they finished all of them in one visit, for the price they quoted.", stars: 5 }, { name: "Ray D.", text: "Showed up when they said, cleaned up after, and the drywall patch is invisible.", stars: 5 }],
    content: {
      hero: { eyebrow: "Handyman services in Mesa", headline: "Small jobs, done right.", lineA: "Small jobs,", lineB: "done right.", sub: "Drywall, painting, fixtures and the to-do list you keep putting off. One call, a fixed price and a tidy finish." },
      services: [{ name: "Drywall and painting", blurb: "Holes patched, walls smoothed and rooms painted so you can't tell where the damage was." }, { name: "Fixtures and fans", blurb: "Lights, ceiling fans, faucets and hardware, swapped and working." }, { name: "Doors, trim and repairs", blurb: "Sticky doors, loose trim and the little things that add up." }],
      why: [{ title: "Fixed prices", text: "You get the price before we start." }, { title: "On time", text: "And if something changes, we call you first." }, { title: "Clean up included", text: "We leave the room the way we found it, minus the problem." }],
      about: { headline: "Built on finishing the list", story: ["Most people don't need a contractor. They need someone reliable who shows up and gets through the list.", "That's the whole idea."] },
      process: [{ title: "Send your list", text: "Photos help, but a few lines is fine." }, { title: "Get a price", text: "One fixed number for the visit." }, { title: "We get it done", text: "Usually in a single trip." }],
      faqs: [{ q: "Is there a minimum job size?", a: "One hour. Most visits take care of several jobs at once." }, { q: "Do you bring the materials?", a: "Yes. They're listed in your price, so there are no surprises." }],
      cta: { headline: "Got a list that keeps growing?", sub: "Send it over and get a fixed price.", button: "Get a price" }, marquee: ["Drywall", "Painting", "Fixtures", "Repairs"],
      seo: { title: "Cedar and Nail Home Repair", description: "Handyman services in Mesa." } } },
};

export const DEMO_EPOXY = {
  id: "demo-epoxy", name: "Ironwood Floor Coatings", niche: "Epoxy Garage Floor Coatings", leadToken: "demo", businessPhone: "(623) 555-0164",
  businessAddress: "Peoria, AZ", campaignSetup: { serviceArea: "Peoria, AZ" },
  website: { brandName: "Ironwood Floor Coatings", brandColor: "#3B6EA8", publicEmail: "quotes@ironwoodfloors.example",
    // Rendered finishes (marketing-src/epoxy-renders.html): no usable free photos of coated floors exist.
    stock: [{ url: "https://boldlinemedia.com/img/sample/epoxy-3.jpg", alt: "Rendering of a finished garage floor" }, { url: "https://boldlinemedia.com/img/sample/epoxy-2.jpg", alt: "Rendering of a metallic epoxy finish" }, { url: "https://boldlinemedia.com/img/sample/epoxy-1.jpg", alt: "Rendering of a flake floor finish up close" }],
    reviews: [{ name: "Jason L.", text: "Two days start to finish and the garage looks like a showroom. Hot tires haven't left a mark.", stars: 5 }, { name: "Priya S.", text: "They ground out the old oil stains completely. Fixed price, no surprises.", stars: 5 }],
    content: {
      hero: { eyebrow: "Garage floor coatings in Peoria", headline: "A garage floor that looks finished.", lineA: "A garage floor", lineB: "that looks finished.", sub: "Epoxy and polyaspartic coatings that shrug off oil, hot tires and Arizona heat. Most garages done in a day or two." },
      services: [{ name: "Garage floor coatings", blurb: "Ground, repaired and coated, with a flake finish that hides dust and grips underfoot." }, { name: "Metallic epoxy", blurb: "A deep, glossy finish for garages, gyms and showrooms that want to stand out." }, { name: "Shops and warehouses", blurb: "Hard wearing floors for workshops and commercial spaces, done around your hours." }],
      why: [{ title: "Done in a day or two", text: "Most two car garages are coated and walkable the next day." }, { title: "Ground, not just painted", text: "We grind the concrete so the coating bonds instead of peeling." }, { title: "Fixed quotes", text: "Measured on site, priced once, no add ons later." }],
      about: { headline: "Floors are all we do", story: ["We started coating our own garage and the neighbors kept asking who did it.", "Now it's a full crew, and every floor still gets ground properly first."] },
      process: [{ title: "Free measure", text: "We check the concrete and talk through finishes." }, { title: "Fixed quote", text: "One price, in writing." }, { title: "Coated and cured", text: "Usually in one or two days." }],
      faqs: [{ q: "How long before I can park on it?", a: "Most floors take light foot traffic the next day and cars after about three days." }, { q: "Will hot tires lift the coating?", a: "Not with a properly ground and coated floor. That's why we grind every one." }],
      cta: { headline: "Ready to love your garage?", sub: "Book a free measure and get a fixed quote.", button: "Book a free measure" }, marquee: ["Garage floors", "Metallic epoxy", "Flake finishes", "Shops"],
      seo: { title: "Ironwood Floor Coatings", description: "Epoxy garage floor coatings in Peoria." } } },
};
export const DEMO_TINT = {
  id: "demo-tint", name: "Blackline Tint and Film", niche: "Window Tint and Paint Protection Film", leadToken: "demo", businessPhone: "(480) 555-0187",
  businessAddress: "Tempe, AZ", campaignSetup: { serviceArea: "Tempe, AZ" },
  website: { brandName: "Blackline Tint and Film", brandColor: "#B8312F", publicEmail: "shop@blacklinetint.example",
    stock: [{ url: px(6872165), alt: "Tail light glowing on a dark car" }, { url: px(6872160), alt: "Installer working on glass with a squeegee" }, { url: px(6872149), alt: "Headlight close up" }, { url: px(6872151), alt: "Tail light detail" }],
    reviews: [{ name: "Marco V.", text: "Full front film on my new car and you honestly can't see the edges. Worth every dollar.", stars: 5 }, { name: "Kelsey T.", text: "Ceramic tint made a huge difference in the Arizona sun. In and out the same afternoon.", stars: 5 }],
    content: {
      hero: { eyebrow: "Tint and paint protection in Tempe", headline: "Cooler inside. Flawless outside.", lineA: "Cooler inside.", lineB: "Flawless outside.", sub: "Ceramic window tint, paint protection film and coatings, installed in a clean bay by people who care about edges." },
      services: [{ name: "Ceramic window tint", blurb: "Blocks the heat you feel without making it hard to see at night." }, { name: "Paint protection film", blurb: "Clear film that takes the rock chips so your paint doesn't." }, { name: "Ceramic coating", blurb: "A glossy, hard layer that keeps the car cleaner for longer." }],
      why: [{ title: "Clean bay installs", text: "Dust free, so there are no specks under the film." }, { title: "Edges you can't find", text: "Wrapped edges where the panel allows it." }, { title: "Warranty in writing", text: "On the film and on our work." }],
      about: { headline: "Obsessed with the details", story: ["We started tinting friends' cars in a single garage bay.", "Today it's two bays, and we still check every edge under the light before you leave."] },
      process: [{ title: "Pick your package", text: "We help you choose the film for how you drive." }, { title: "Drop it off", text: "Most tint jobs are same day." }, { title: "Pick it up", text: "We walk you through care before you go." }],
      faqs: [{ q: "How long does paint protection film take?", a: "A full front usually takes one day. A full car takes two to three." }, { q: "Is ceramic tint legal?", a: "Yes. We install to your state's legal limits and can tell you exactly what they are." }],
      cta: { headline: "Ready to protect the car you love?", sub: "Get a quote in one message.", button: "Get a quote" }, marquee: ["Ceramic tint", "Paint protection film", "Ceramic coating"],
      seo: { title: "Blackline Tint and Film", description: "Window tint and paint protection film in Tempe." } } },
};

// Writes the three designs as HTML into `outDir`, for scripts/build-site-showcase.cjs to photograph.
export function writeDemoPages(outDir) {
  const base = "https://saguaropools.example";
  for (const th of THEME_IDS) writeFileSync(`${outDir}/demo-${th}.html`, renderSite(DEMO, "home", { base, theme: th, noindex: true }));
  return THEME_IDS;
}
// Only when run directly: the marketing site build imports DEMO and must not write anything here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) console.log("wrote", writeDemoPages(process.argv[2]).join(","));
