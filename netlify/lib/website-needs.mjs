// "What we need from you": the one list of things a website client sends us (KB `website-needs`).
//
// Bryson, 2026-10-13: "build the what i need from you list so i can ask for it on a call and also have it in the
// website client portal". ONE list, used three ways: the questions he asks on the call (the OS card), the
// message he can paste to the client (the same card's Copy button), and the checklist in the client's portal,
// where each item ticks itself off the moment the client sends it.
//
// 🔴 DERIVED FROM WHAT THE WEBSITE ACTUALLY USES, not a generic intake form. Every item feeds something real:
// the logo and photos are what the site shows (mediaLibrary), the written answers go straight into the
// builder's facts (site-build-background reads `websiteIntake`), the hours and the phone and email land on the
// Contact page, the reviews on the Reviews page, the web address on the domain card. Nothing is asked that is
// not used. If the builder starts using a new fact, it belongs here too.
//
// "Done" is read from the record, never ticked by hand, so the list can never say something is in when it
// is not. Mirrored in index.html (WN-MIRROR); `verify-website-needs` runs both copies against each other.

const s = (v) => String(v == null ? "" : v).trim();

// The written answers the portal collects, with how long each may be.
export const INTAKE_FIELDS = { services: 2000, different: 1500, area: 500, hours: 300, reviews: 3000, domain: 200, likes: 800 };

export const intakeOf = (cl) => ((cl && cl.websiteIntake && typeof cl.websiteIntake === "object") ? cl.websiteIntake : {});

// What the portal sends, cleaned and merged over what is already there. An empty answer clears that answer;
// a field that was not sent is left alone, so saving one box never wipes another.
export function cleanIntake(input, current = {}, at = new Date().toISOString()) {
  const out = { ...(current && typeof current === "object" ? current : {}) };
  let changed = false;
  for (const [k, max] of Object.entries(INTAKE_FIELDS)) {
    if (!input || !(k in input)) continue;
    const v = s(input[k]).replace(/\r\n/g, "\n").slice(0, max);
    if ((out[k] || "") !== v) changed = true;
    if (v) out[k] = v; else delete out[k];
  }
  if (changed) out.updatedAt = at;
  return { intake: out, changed };
}

const photosOf = (cl) => ((cl && cl.mediaLibrary) || []).filter((m) => m && m.category === "photo").length;
const hasLogo = (cl) => ((cl && cl.mediaLibrary) || []).some((m) => m && m.category === "logo");
const cs = (cl) => (cl && cl.campaignSetup) || {};
const bv = (cl) => (cl && cl.brandVoice) || {};
const web = (cl) => (cl && cl.website) || {};

// `where`: "photos" = uploaded in Photos & Video, "info" = typed in Your Information, otherwise the item has
// its own answer box (`field`). `ask` is what Bryson says on the call; `tip` is what the client reads.
export const WEBSITE_NEEDS = [
  { id: "logo", title: "Your logo", where: "photos",
    ask: "Do you have a logo? Send me the best file you've got. A PNG with no background is perfect.",
    tip: "It goes at the top of every page. No logo yet? We'll set your business name in a clean typeface instead.",
    done: (cl) => hasLogo(cl) },
  { id: "photos", title: "5 to 10 photos of your work", where: "photos",
    ask: "Can you send me 5 to 10 photos of real jobs? Before and afters, you and your team, your truck or shop.",
    tip: "Real photos win more customers than stock ones. Phone photos are fine. Until yours arrive, we use stock photos.",
    done: (cl) => photosOf(cl) >= 5, progress: (cl) => `${Math.min(photosOf(cl), 10)} of 5 sent` },
  { id: "services", title: "Your services and prices", field: "services",
    ask: "Walk me through what you offer, and roughly what each one costs or starts at.",
    tip: "List each service, with a price or a starting price if you're happy to show one.",
    placeholder: "e.g. Full detail, from $199\nInterior only, $129\nCeramic coating, quoted per car",
    done: (cl) => !!(s(intakeOf(cl).services) || s(cl && cl.services) || s(cs(cl).services)) },
  { id: "different", title: "What makes you different", field: "different",
    ask: "Why do customers pick you over the other guys? And how did you get started?",
    tip: "A few lines in your own words. This becomes your About page, so the more it sounds like you, the better.",
    placeholder: "e.g. Family run since 2015. We show up when we say we will and we text photos when the job's done.",
    done: (cl) => !!(s(intakeOf(cl).different) || s(bv(cl).differentiator)) },
  { id: "area", title: "Where you work", field: "area",
    ask: "Which towns or areas do you cover?",
    tip: "The towns or areas you serve, so the right customers find you.",
    placeholder: "e.g. Gilbert, Mesa, Chandler and Queen Creek",
    done: (cl) => !!(s(intakeOf(cl).area) || s(cs(cl).serviceArea) || s(cs(cl).targetLocations)) },
  { id: "hours", title: "Your hours", field: "hours",
    ask: "What are your hours?",
    tip: "When customers can reach you.",
    placeholder: "e.g. Mon to Fri 8am to 6pm, Sat 9am to 2pm",
    done: (cl) => !!(s(intakeOf(cl).hours) || s(web(cl).hours) || (cl && cl.booking && cl.booking.on)) },
  { id: "contact", title: "Phone and email for the website", where: "info",
    ask: "Which phone number and email should customers use?",
    tip: "The number and email customers will see on your website.",
    done: (cl) => !!(s(cl && cl.businessPhone) && s(cl && cl.email)) },
  { id: "reviews", title: "Your reviews", field: "reviews",
    ask: "Can you send me your Google reviews link, or paste in 3 to 5 of your best reviews?",
    tip: "Your Google reviews link, or paste 3 to 5 of your favourite reviews with the customer's first name.",
    placeholder: "Paste your Google reviews link, or your best reviews here",
    done: (cl) => !!(s(intakeOf(cl).reviews) || (web(cl).reviews || []).length || s(cl && cl.googleReviewUrl)) },
  { id: "domain", title: "Your web address", field: "domain",
    ask: "Do you already own a web address, like yourbusiness.com? If not, I'll send you how to get one. It takes five minutes.",
    tip: "If you already own one, type it here. Don't have one? Type \"none\" and we'll send you a 5 minute guide to get one in your own name.",
    placeholder: "e.g. yourbusiness.com, or none",
    done: (cl) => !!(s(intakeOf(cl).domain) || s((((cl && cl.websiteDeal) || {}).domain || {}).host)) },
  { id: "likes", title: "Websites you like", field: "likes", optional: true,
    ask: "Any websites you like the look of? Even a competitor's.",
    tip: "Optional. Links to any websites you like the look of, even a competitor's.",
    placeholder: "Paste a link or two",
    done: (cl) => !!s(intakeOf(cl).likes) },
];

export function needsStatus(cl) {
  const items = WEBSITE_NEEDS.map((n) => ({ ...n, isDone: !!n.done(cl), note: n.progress ? n.progress(cl) : "" }));
  const required = items.filter((i) => !i.optional);
  return { items, done: required.filter((i) => i.isDone).length, total: required.length, complete: required.every((i) => i.isDone) };
}

// The message Bryson can paste to a client: only what is still missing, in plain words, no dashes, no emojis.
export function needsMessage(cl, { portalUrl = "" } = {}) {
  const first = s((cl && (cl.contactName || cl.name)) || "").split(/\s+/)[0] || "there";
  const missing = needsStatus(cl).items.filter((i) => !i.isDone && !i.optional);
  if (!missing.length) return `Hi ${first}, thanks for sending everything over. We have all we need to build your website.`;
  const lines = missing.map((i, k) => `${k + 1}. ${i.title}: ${i.tip}`);
  return `Hi ${first}, here's what I need from you to build your website:\n\n${lines.join("\n")}\n\n`
    + (portalUrl ? `The easiest way is your client portal, Website tab: ${portalUrl}\nEach one ticks off as you send it. ` : "")
    + "Or just reply here with whatever you have. Photos can come straight from your phone.";
}
