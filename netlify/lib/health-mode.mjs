// ── HEALTH CLIENTS: the HIPAA safeguards (Bryson, 2026-11-09, KB hipaa-health-clients) ──────────────────────────
// "make sure it's automatically turned on for springbok wellness and for any niches that are medical or under HIPAA
// rules ... I also want a way to be able to change them if I want".
//
// The plan is to stay OUT of holding patient health details, rather than becoming a HIPAA business associate. A
// client is a health client when its niche or name reads as medical (AUTO), or when Bryson says so on its record.
// Each safeguard can then be switched off on its own, from the client's "Health and privacy" card in the OS.
//
// Stored on the client record:
//   healthMode:        "auto" (or missing) | "on" | "off"
//   healthSafeguards:  { <key>: false } for any safeguard he has switched off. Missing = on.
//
// 🔴 This file is the ONE place the medical niche list lives. index.html carries a copy of HEALTH_NICHE_SRC,
// HEALTH_NOT_SRC and SAFEGUARDS for the OS screen, and verify-health-mode fails if they drift apart.

// Words that mark a medical / HIPAA business. Matched against niche, niche group and business name.
export const HEALTH_NICHE_SRC = "chiro|dental|dentist|orthodon|endodon|periodon|med ?spa|medical|clinic|therap|physio|wellness|dermatolog|optom|ophthalm|eye care|vision care|lasik|audiolog|hearing|\\baba\\b|counsel|psych|mental health|behavioral health|doctor|physician|pediatric|podiat|acupunct|urgent care|primary care|family practice|pharm|hospice|home health|home care|nursing|\\bnurse|fertility|ivf|obgyn|ob-gyn|gynecolog|urolog|cardiolog|oncolog|orthoped|sleep center|weight loss|bariatric|hormone|\\bhrt\\b|\\biv (?:drip|hydration|therapy)|botox|aesthetic (?:clinic|medicine)|rehabilitation|rehab center|physical rehab|addiction|recovery center|detox|telehealth|health ?care|healthcare|hospital|surgery|surgeon|cosmetic surg|plastic surg|lab testing|diagnostic|imaging|radiolog|chiropract";
// Not a human health business even though a word above matches (a vet clinic, a car "clinic").
export const HEALTH_NOT_SRC = "veterinar|\\bvets?\\b|\\banimals?\\b|\\bpets?\\b|\\bdogs?\\b|\\bcats?\\b|equine|\\bauto\\b|automotive|\\bcars?\\b|\\btrucks?\\b|\\blawns?\\b|\\btrees?\\b|\\bplants?\\b|\\bpools?\\b|computer|phone repair|appliance|\\blaw\\b|lawyers?|attorneys?|\\blegal\\b|insurance agen|\\bmassage\\b|day spa|spa (?:&|and) wellness";
const HEALTH_RE = new RegExp(HEALTH_NICHE_SRC, "i"), NOT_RE = new RegExp(HEALTH_NOT_SRC, "i");

// The safeguards, in the order the OS card shows them. `plain` is what Bryson reads.
export const SAFEGUARDS = [
  { key: "form", label: "No symptom box on forms", plain: "Their landing page and website ask for name, phone and email only. Anything typed about a condition is dropped before it is saved." },
  { key: "pixel", label: "No Meta tracking pixel", plain: "The Meta Pixel is left off their pages, so Meta never learns who visited a health page." },
  { key: "autoReply", label: "No automatic texts or emails to their leads", plain: "Our instant reply and follow-up messages are off. The practice contacts the lead itself." },
  { key: "patientEmails", label: "No emails to their patients", plain: "Review requests and past-customer emails are off (a patient list is patient information)." },
  { key: "reviewReplies", label: "Review replies never confirm a patient", plain: "Drafted Google review replies thank people without confirming they were treated or mentioning a condition." },
  { key: "adRules", label: "Health ad rules when writing ads", plain: "Ad copy never implies the reader has a condition (Meta rejects that), and avoids drug names and claims that need certification." },
];
export const SAFEGUARD_KEYS = SAFEGUARDS.map((s) => s.key);

const text = (cl) => [cl && cl.niche, cl && cl.nicheGroup, cl && cl.industry, cl && cl.name].filter(Boolean).join(" ");

// Does this business read as medical? (The AUTO answer, before any override.)
export const looksHealth = (cl) => { const t = text(cl); return !!t && HEALTH_RE.test(t) && !NOT_RE.test(t); };

// The whole picture for one client: on or off, why, and which safeguards apply.
export const healthModeOf = (cl) => {
  const mode = ["on", "off"].includes(cl && cl.healthMode) ? cl.healthMode : "auto";
  const auto = looksHealth(cl);
  const on = mode === "on" || (mode === "auto" && auto);
  const off = (cl && cl.healthSafeguards) || {};
  const active = on ? SAFEGUARD_KEYS.filter((k) => off[k] !== false) : [];
  const why = mode === "on" ? "Switched on by hand" : mode === "off" ? "Switched off by hand" : auto ? `On automatically: "${(cl && (cl.niche || cl.name)) || ""}" reads as a health business` : "Off: not a health business";
  return { mode, auto, on, active, why };
};

// Is one safeguard in force for this client? The single question every part of the OS asks.
export const healthBlocks = (cl, key) => healthModeOf(cl).active.includes(key);

// ── What the safeguards say to the writers ──────────────────────────────────────────────────────────────────────
export const HEALTH_AD_RULES = `THIS IS A HEALTH BUSINESS. HEALTH AD RULES (both platforms reject ads that break these):
- Never imply the reader has a condition or a personal health problem. "Struggling with back pain?", "Your migraines", "Tired of your knee pain?" are rejected by Meta. Talk about the service and the place instead: "Back pain treatment in Mesa", "Same week chiropractic appointments".
- Never name a prescription drug or a brand of one (Botox, Ozempic, semaglutide, tirzepatide). Say "wrinkle relaxer" or "medical weight loss" if needed.
- No promised outcomes or cures ("pain free in 3 visits", "guaranteed results"), no before/after claims, no diagnosis.
- No targeting or remarketing ideas based on a health condition.`;

export const HEALTH_REPLY_RULE = "This is a health practice. Never confirm or suggest the reviewer is or was a patient, never mention a condition, treatment or visit detail even if they did, and never repeat anything personal. Thank them warmly in general terms and invite anyone with questions to call the office.";
