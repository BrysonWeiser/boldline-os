// Fully-automated "Lead-Leak Check" bot.
//
// When a prospect requests a free Lead-Leak Check on boldlinemedia.com, the
// marketing-site function (audit.mjs) captures the lead AND fires a best-effort
// POST to this endpoint. This background function then:
//   1. fetches the prospect's homepage and extracts on-page signals,
//   2. asks Claude (+ web search) for an honest, specific 2-4 "leak" mini-audit,
//   3. renders it into a branded DARK email, and
//   4. emails it straight to the prospect (copying Bryson), then marks the lead
//      audited so it's never double-sent.
//
// Runs as a Netlify BACKGROUND function (filename ends in "-background" -> async,
// returns 202, up to 15 min) because fetch + Claude + web search takes far longer
// than the ~10s synchronous limit.
//
// AUTH: the marketing site is unauthenticated, so there's no owner JWT here.
// Instead both sites share a secret (AUDIT_TRIGGER_SECRET, set identically on
// each Netlify site); a request without the matching secret is rejected.
//
// SAFETY / "full auto": by default this SENDS the audit straight to the prospect
// (they asked for it — fast response is the whole point) and copies Bryson so he
// sees exactly what went out. To switch to "review first" (audit emailed to
// Bryson only, nothing sent to the prospect), set LEAD_LEAK_REVIEW_ONLY=1 in the
// OS site's Netlify env.

import { createClient } from "@supabase/supabase-js";
import { humanize } from "../lib/humanize.mjs";
import Anthropic from "@anthropic-ai/sdk";
import { SUPABASE_URL, sendEmail, escapeHTML, GOLD } from "../lib/report-shared.mjs";
import { emailShell } from "../lib/client-emails-shared.mjs";
import { lookAtSite, metricLines } from "../lib/site-vision.mjs";

const BOOK_URL = "https://calendly.com/theboldlinemedia/30min";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const DARK = { head: "#F5F3EA", body: "#C6CAE0", muted: "#8B91B8" };

const anthropic = new Anthropic();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return String(u || ""); } };

// ── 1. inspect the prospect's homepage ──────────────────────────────────────
const normalizeUrl = (raw) => {
  let u = String(raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).href; } catch { return null; }
};

const inspectSite = async (rawUrl) => {
  const url = normalizeUrl(rawUrl);
  if (!url) return { url: String(rawUrl || ""), ok: false, error: "no valid URL provided" };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; BoldLineAudit/1.0; +https://boldlinemedia.com)" },
    });
    clearTimeout(timer);
    const finalUrl = res.url || url;
    const raw = (await res.text()).slice(0, 300000);
    const pick = (re) => { const m = raw.match(re); return m ? m[1].trim().replace(/\s+/g, " ") : ""; };
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i).slice(0, 200);
    const metaDesc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i).slice(0, 300);
    const h1 = pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "").slice(0, 200);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(raw);
    const hasTel = /href=["']tel:/i.test(raw);
    const hasMailto = /href=["']mailto:/i.test(raw);
    const imgCount = (raw.match(/<img[\s>]/gi) || []).length;
    const scriptCount = (raw.match(/<script[\s>]/gi) || []).length;

    // ── 🔴 NEVER CLAIM A SITE HAS NO FORM. WE CANNOT SEE ONE THAT IS NOT THERE YET. ──
    //
    // Bryson, 2026-09-04, after reading a report that had already gone to a real prospect:
    // *"I looked through their website and if you scroll down all the way to the bottom there
    // is a form people can fill out"*. The report said there was none.
    //
    // This check reads the FIRST HTML RESPONSE. Wix, Squarespace, GoDaddy, Webflow, HubSpot,
    // JotForm and every React site render their forms afterwards, with JavaScript or inside
    // an iframe, so the markup simply is not in what we fetched. The check was right about
    // what it saw and wrong about the world, and it handed the model "Contact form on
    // homepage: not found" as a FACT.
    //
    // 🔴 IT IS THE WORST POSSIBLE THING TO GET WRONG IN A FREE AUDIT. Every other finding
    // asks the prospect to take our word for it. This one they can disprove in four seconds
    // by scrolling their own homepage, and the moment they do, every other finding in the
    // report is worthless too. One checkable mistake costs the whole document.
    //
    // Two fixes, and the second matters more than the first. Look harder, and then REFUSE TO
    // ASSERT THE NEGATIVE: absence of evidence is reported as exactly that.
    const FORM_HINTS = [
      /<form[\s>]/i,
      /<input[^>]+type=["'](?:email|tel)["']/i,                        // a form by any other name
      /wpcf7|gravity_?form|hs-form|hbspt|jotform|typeform|wufoo|formstack|formidable|ninja_?forms/i,
      /docs\.google\.com\/forms|forms\.gle/i,
      /name=["'](?:your-email|your-name|entry\.\d|contact\[)/i,        // Contact Form 7, Google Forms
      /data-(?:testid|hook)=["'][^"']*form/i,                          // Wix and friends
    ];
    const hasForm = FORM_HINTS.some((re) => re.test(raw));
    // A page whose visible words are thin next to its script count is being assembled in the
    // browser, so anything we did NOT find proves nothing at all about the live page.
    const bodyText = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const jsRendered = scriptCount >= 8 && bodyText.length < 1500;
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
    return {
      url: finalUrl, ok: true, status: res.status,
      title, metaDesc, h1, hasViewport, hasTel, hasMailto, hasForm, jsRendered,
      imgCount, scriptCount, bytesKB: Math.round(raw.length / 1024), text,
    };
  } catch (e) {
    return { url, ok: false, error: String((e && e.message) || e) };
  }
};

// ── 2. generate the audit (Claude + web search) ─────────────────────────────
const buildSystem = () => `You are the analyst behind BoldLine Media's free "Lead-Leak Check" — a quick, genuinely helpful mini-audit of a prospect's website and online presence that shows them where they are likely LOSING potential customers, plus the highest-impact fixes. BoldLine Media is a digital marketing agency (owner: Bryson Weiser) that runs managed Google & Meta ads and builds custom landing pages for businesses of any size. It works with them remotely and nationally, so NEVER say "local businesses" and never suggest it only serves one city.

The reader is a business owner who just requested this audit on our website. This email IS the audit — it must deliver real value on its own, feel personal to THEIR site, and leave them thinking "these people clearly know what they're doing." It is also a first impression, so be helpful and encouraging — never insulting, never generic.

You are given: (a) a SCREENSHOT of their homepage as a phone renders it, when one is available, plus Google's own speed measurements of the live page, (b) what we pulled from their homepage (title, meta description, main headline, whether it has a mobile viewport tag, a click-to-call link, a contact form, image/script counts, page weight, and a text sample, where anything reported as not visible in the page source means WE COULD NOT SEE IT rather than that it does not exist), and (c) web search, which you should use to check their Google Business Profile, reviews, and whether they appear to be running ads.

HARD ACCURACY RULES — this goes to a real stranger, so a single wrong claim kills the deal and the brand:
- Base every observation on the actual page data provided or something you genuinely confirmed via web search. If you did NOT confirm something, do not assert it — either leave it out or phrase it as a question ("I couldn't find a Google Business Profile — if you don't have one yet, that's the single biggest quick win").
- NEVER invent specifics: no made-up review counts, star ratings, owner names, traffic numbers, or "you're losing $X per month." No fabricated statistics of any kind.
- 🔴 WHEN A SCREENSHOT IS ATTACHED, IT IS THE TRUTH AND THE PAGE SOURCE IS NOT. The screenshot is the page after it finished loading in a real browser on a phone, which is what their customer actually gets. The page source is the skeleton that arrived first. Where the two disagree, believe the screenshot, and you may then describe what you can SEE as fact: the layout, what is above the fold, how the buttons read, whether a form is visible, how it looks on a phone. Say what you noticed looking at it, because that is what proves you really looked. If there is NO screenshot this time, you are back to the source alone and the rule below applies at full strength.
- 🔴 NEVER TELL THEM SOMETHING IS MISSING FROM THEIR SITE. You are reading the first HTML response only. Wix, Squarespace, GoDaddy, Webflow and every JavaScript site add their contact forms, phone links and half their page after that, so a thing you cannot see is very often sitting right there on the live page. Anything marked NOT VISIBLE IN THE PAGE SOURCE is UNKNOWN, not absent, and you must not build a finding on it. This is the single most damaging mistake available to you: every other point in this email asks them to take your word for it, but "you have no contact form" is something they can disprove in four seconds by scrolling their own homepage, and the moment they do, everything else you wrote is worthless too. If you want to raise it anyway, ASK: "I could not see a form on the homepage, though it may be further down or added by your site builder. If people can only reach you by calling, adding one short form is the quickest win there is." Never state it as fact.
- NEVER use a dash to join or interrupt a sentence. That means the em dash, the en dash, and a plain hyphen with spaces around it. All three read as machine-written, and the spaced hyphen is the most common tell of all. Write two sentences, or use a comma. Hyphens INSIDE a word are fine and expected: done-for-you, no-obligation, 24-hour.
- Do not claim they are or aren't running ads unless web search actually shows it; otherwise frame it conditionally ("if you're running Google Ads...").
- If their site is genuinely strong, say so honestly and focus the audit on the next level up (ads, landing pages, conversion tracking) instead of inventing problems.

STYLE:
- Warm, plain-English, confident, concise. Sound like a helpful expert, not a salesperson and not a robot. No hype, no jargon dumps.
- NO emojis and no decorative symbols anywhere.
- Be specific to THEIR site — reference their actual headline / title / what they appear to do so it is obviously not a template.

OUTPUT — respond with EXACTLY this and nothing before it:
First line, alone: SUBJECT: <a specific, non-spammy subject line, about 6-9 words, referencing their site or business>
Then a blank line, then the audit body in light markdown. Formatting rules for the body:
- Open with one or two sentences that prove you actually looked at their specific site.
- Then 2 to 4 findings. Format EACH finding as three parts on their own lines:
    **<short leak name>**
    One or two sentences on what is happening and why it is costing them leads.
    - Fix: the concrete, specific fix.
- Close with 2-3 sentences: which single fix to do first, and a low-pressure invitation to book a quick free call with Bryson to walk through it. Do NOT paste any URL or booking link — a button is added automatically below your text.
Use only "**bold**" for the leak names and "- " for bullets. No top-level "#" headings. Keep the whole thing tight — a busy owner should read it in under two minutes.`;

const generateReport = async (site, vision) => {
  // 🔴 The exact words handed to the model for anything we looked for and did not find.
  // Written out once so no single line can drift back into asserting an absence.
  const NOT_SEEN = "NOT VISIBLE IN THE PAGE SOURCE (this may simply mean it is added by "
    + "JavaScript, which this check cannot see, so treat it as UNKNOWN and never tell them "
    + "they do not have one)";
  const facts = [
    `Website: ${site.url}`,
    site.ok
      ? `Homepage fetched OK (HTTP ${site.status}, ~${site.bytesKB} KB).`
      : `NOTE: We could not fetch the homepage automatically (${site.error}). Work from web search and gently note we could not load the page directly.`,
    `Page title: ${site.title || "(none found)"}`,
    `Main headline (H1): ${site.h1 || "(none found)"}`,
    `Meta description: ${site.metaDesc || "(missing)"}`,
    `Mobile viewport tag: ${site.hasViewport ? "present" : "MISSING — page may not be mobile-friendly"}`,
    // 🔴 A THING WE FOUND IS A FACT. A THING WE DID NOT FIND IS NOT.
    // These three are read out of the first HTML response, and every site builder on earth
    // (Wix, Squarespace, GoDaddy, Webflow) renders them afterwards with JavaScript. Reporting
    // "not found" as "you do not have one" is how a report told a real roofing company they
    // had no contact form while one sat at the bottom of their own homepage.
    `Click-to-call (tel:) link: ${site.hasTel ? "present" : NOT_SEEN}`,
    `Contact form on homepage: ${site.hasForm ? "present" : NOT_SEEN}`,
    `Email link: ${site.hasMailto ? "present" : NOT_SEEN}`,
    site.jsRendered
      ? "🔴 THIS PAGE IS BUILT IN THE BROWSER (heavy scripts, very little text in the source). Anything above marked as not seen is UNKNOWN, not absent. Do not comment on it at all."
      : null,
    site.ok ? `Homepage weight: ~${site.bytesKB} KB, ${site.imgCount} images, ${site.scriptCount} scripts.` : null,
    site.text ? `Homepage text sample: "${site.text.slice(0, 1500)}"` : null,
    // 🔴 WHAT A REAL BROWSER SAW, WHICH IS A DIFFERENT AND BETTER SOURCE. Everything above is
    // read out of the first HTML response; these are measured after the page has finished
    // assembling itself, which is the page a customer actually gets.
    ...(vision && vision.ok ? ["", "MEASURED IN A REAL BROWSER ON A PHONE:", ...metricLines(vision)] : []),
    vision && vision.ok && vision.screenshot
      ? `A SCREENSHOT OF THE ${vision.screenshot.kind.toUpperCase()} IS ATTACHED. It shows the page AFTER it finished loading, so it is the truth about what a visitor sees. Where the screenshot and the page source disagree, THE SCREENSHOT WINS.`
      : `NOTE: no screenshot this time (${(vision && vision.note) || "the visual check did not run"}), so you are working from the page source alone and must be correspondingly careful about anything you cannot see.`,
  ].filter(Boolean).join("\n");

  const userMsg = `Here is the prospect's site data. Research their online presence with web search (Google Business Profile, reviews, whether they appear to run ads), then write the Lead-Leak Check exactly as specified.\n\n${facts}`;

  // The picture goes FIRST, because it is the thing the rest is describing.
  const shot = vision && vision.ok && vision.screenshot;
  const content = shot
    ? [{ type: "image", source: { type: "base64", media_type: shot.mediaType, data: shot.data } },
       { type: "text", text: userMsg }]
    : userMsg;
  let messages = [{ role: "user", content }];
  let response;
  // web_search runs a server-side loop; a pause_turn means "re-send to resume."
  for (let i = 0; i < 4; i++) {
    response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      system: buildSystem(),
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages = [...messages, { role: "assistant", content: response.content }];
      continue;
    }
    break;
  }

  // Goes straight to a prospect's inbox as BoldLine's first impression.
  const text = humanize((response.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(), { join: ", " });
  let subject = "Your free Lead-Leak Check from BoldLine Media";
  let bodyMd = text;
  const m = text.match(/^\s*SUBJECT:\s*(.+?)\s*(?:\n|$)/i);
  if (m) { subject = m[1].trim().slice(0, 120); bodyMd = text.slice(m[0].length).replace(/^\s+/, ""); }
  return { subject, bodyMd };
};

// ── 3. render the audit markdown into the branded dark email ────────────────
const inlineMd = (s) =>
  escapeHTML(s).replace(/\*\*(.+?)\*\*/g, `<strong style="color:${DARK.head};font-weight:700">$1</strong>`);

const mdToBody = (text) => {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let bullets = null;
  const flush = () => {
    if (bullets && bullets.length) {
      blocks.push(`<ul style="margin:0 0 16px;padding-left:20px;color:${DARK.body}">${bullets
        .map((b) => `<li style="margin:0 0 7px;font-family:${SANS};font-size:15px;line-height:1.6">${inlineMd(b)}</li>`)
        .join("")}</ul>`);
    }
    bullets = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const headerOnly = line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (headerOnly) {
      flush();
      blocks.push(`<div style="margin:22px 0 7px;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:.01em;color:${GOLD}">${escapeHTML(headerOnly[1])}</div>`);
      continue;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) { (bullets = bullets || []).push(bulletMatch[1]); continue; }
    flush();
    blocks.push(`<p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:${DARK.body}">${inlineMd(line)}</p>`);
  }
  flush();
  return blocks.join("");
};

const button = (label, url) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto 4px"><tr><td align="center" style="border-radius:10px;background:${GOLD}"><a href="${escapeHTML(url)}" style="display:inline-block;padding:13px 30px;font-family:${SANS};font-size:14px;font-weight:700;color:#15110A;text-decoration:none;border-radius:10px">${escapeHTML(label)} &rarr;</a></td></tr></table>`;

const buildEmailHtml = ({ bodyMd, siteLabel }) => {
  const intro = `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${DARK.body}">Thanks for requesting a free Lead-Leak Check${siteLabel ? " for " + escapeHTML(siteLabel) : ""}. Here is a quick, honest look at where your site may be leaving leads on the table — and the fixes that matter most.</p>`;
  const closing = `<p style="margin:16px 0 0;font-family:${SANS};font-size:12.5px;line-height:1.6;color:${DARK.muted}">No pressure and no obligation — if even one of these fixes helps you land another customer, this audit did its job. Prefer email? Just reply to this message and it comes straight to Bryson.</p>`;
  const bodyHtml = intro + mdToBody(bodyMd) + button("Book a Free 30-Minute Call", BOOK_URL) + closing;
  return emailShell({
    preheader: "Your free Lead-Leak Check — where your site may be losing customers, and the top fixes.",
    bodyHtml,
    footerNote: "BoldLine Media. Google &amp; Meta ads and landing pages, managed for you.",
  });
};

// ── One lead, audited and sent ──────────────────────────────────────────────
//
// 🔴 LIFTED OUT OF THE HANDLER ON 2026-09-04 SO A SECOND CALLER CAN REACH IT, and the
// reason is worth keeping. The only way to start this bot was a POST from the marketing
// site, gated on a secret that has to be set IDENTICALLY on two separate Netlify sites.
// It was not set. So the gate on the marketing site was simply false, no request was ever
// made, and a real prospect asked for a free report and got NOTHING, in total silence.
// Nobody found out until Bryson opened the lead an hour later and there was no audit stamp
// on it. `lead-leak-sweep.mjs` now runs the same function on a schedule from inside the OS,
// where no shared secret exists to be missing.
export async function auditLead(supabase, { leadId, website, email, name }) {
  // Load the lead + de-dupe: never audit the same request twice (background
  // functions can be retried, and the trigger is best-effort fire-and-forget).
  const { data: lead, error: loadErr } = await supabase
    .from("website_leads").select("id, email, payload").eq("id", leadId).single();
  if (loadErr || !lead) return { ok: false, error: "lead not found", status: 404 };
  const payload = lead.payload || {};
  if (payload.auditedAt) return { ok: true, skipped: "already audited" };

  // Claim it right away (best-effort optimistic lock) so a duplicate trigger that
  // lands while we're working bails out at the guard above.
  const tries = Number(payload.auditTries || 0) + 1;
  await supabase.from("website_leads")
    .update({ payload: { ...payload, auditedAt: new Date().toISOString(), auditStatus: "running", auditTries: tries } })
    .eq("id", leadId);

  try {
    if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL) {
      throw new Error("Email is not configured (RESEND_API_KEY / REPORTS_FROM_EMAIL).");
    }
    const site = await inspectSite(website || payload.website);
    // Fail-soft on purpose: a report without the picture is the report we sent yesterday, and
    // that is far better than no report at all.
    const vision = await lookAtSite(site.url || website || payload.website);
    console.log("lead-leak-audit vision:", vision.note);
    const { subject, bodyMd } = await generateReport(site, vision);
    const siteLabel = site.ok && site.url ? hostOf(site.url) : hostOf(website || payload.website || "");
    const html = buildEmailHtml({ bodyMd, siteLabel });

    const reviewOnly = process.env.LEAD_LEAK_REVIEW_ONLY === "1";
    if (reviewOnly) {
      // Safe mode: email Bryson only, so he can review + forward. Nothing to the prospect.
      if (process.env.OWNER_EMAIL) {
        await sendEmail({ to: process.env.OWNER_EMAIL, subject: `[Review before sending] Lead-Leak Check — ${email}`, html, text: bodyMd });
      }
    } else {
      // Full auto: send the audit to the prospect...
      await sendEmail({ to: email, subject, html, text: bodyMd });
      // ...and copy Bryson so he sees exactly what went out and can follow up.
      if (process.env.OWNER_EMAIL && process.env.OWNER_EMAIL.toLowerCase() !== email) {
        await sendEmail({ to: process.env.OWNER_EMAIL, subject: `[Auto-sent to prospect] Lead-Leak Check — ${email}`, html, text: bodyMd });
      }
    }

    await supabase.from("website_leads")
      .update({ payload: { ...payload, website: payload.website || website, auditedAt: new Date().toISOString(), auditStatus: reviewOnly ? "review_sent" : "sent", auditTries: tries, auditSubject: subject, auditLooked: vision.note } })
      .eq("id", leadId);
    return { ok: true, id: leadId, mode: reviewOnly ? "review" : "sent" };
  } catch (e) {
    const msg = String((e && e.message) || e);
    console.error("lead-leak-audit failed:", msg);
    // Release the claim so a retry can run, and record what went wrong. 🔴 The try count
    // is KEPT, or a permanently broken step (an unfunded AI account, say) would be retried
    // forever and the sweep would never be able to say "this one needs a person".
    await supabase.from("website_leads")
      .update({ payload: { ...payload, auditedAt: null, auditStatus: "error", auditTries: tries, auditError: msg } })
      .eq("id", leadId);
    return { ok: false, error: msg, tries, status: 500 };
  }
}

// ── handler ─────────────────────────────────────────────────────────────────
export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const secret = process.env.AUDIT_TRIGGER_SECRET;
  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  // Shared-secret gate — the marketing site is unauthenticated, so this is what
  // stops anyone from invoking the bot. If the secret isn't configured, refuse
  // rather than run open to the world. 🔴 A refusal here is no longer the end of the
  // story: the scheduled sweep picks the lead up regardless, so a missing secret now
  // costs a few minutes rather than the whole report.
  if (!secret || String(body.secret || "") !== secret) return json({ ok: false, error: "Unauthorized" }, 401);

  const leadId = String(body.leadId || "").trim();
  const website = String(body.website || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!leadId || !email) return json({ ok: false, error: "leadId and email are required" }, 400);

  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const r = await auditLead(supabase, { leadId, website, email, name: body.name });
  return json(r, r.status || 200);
};
