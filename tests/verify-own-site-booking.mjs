// Booking and payments on a website the client bought outright (KB `own-site-booking`).
// Run: node tests/verify-own-site-booking.mjs
//
// Bryson, 2026-10-21: "build that that way they dont get a website they cant use because they cant book people or
// take payments and make sure its fully automated so i dont have to do anything on my end for that", and switching
// apps later "without having to contact us".
//
// What this pins:
//  1. the links they paste are cleaned, and a link back to BoldLine is refused;
//  2. nothing downloads until they choose how customers book, and a link that goes nowhere is refused;
//  3. the handed-over files really use the choice: every Book button, the "Pay online" link, the read-me;
//  4. the card remembers the choice and the download button actually works (run in a fake browser: until
//     2026-10-21 it read the server's answer twice and showed "That did not work" on every successful download).

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanLink, cleanSetup, checkLinks, setupOf, setupWords, appName, applySetup } from "../netlify/lib/own-site-setup.mjs";
import { exportSiteFiles } from "../netlify/lib/site-export.mjs";
import { renderSite } from "../netlify/lib/site-render.mjs";
import * as PW from "../netlify/lib/portal-website.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const PORTAL = read("netlify/functions/portal.mjs"), SITE = read("netlify/functions/site.mjs"), UI = read("index.html");
const { DEMO_DETAIL } = await import("../scripts/site-showcase-demo.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const throws = (fn) => { try { fn(); return ""; } catch (e) { return e.message; } };
const athrows = async (p) => { try { await p; return ""; } catch (e) { return e.message; } };

const SQ = "https://desertshine.square.site/book";
const PP = "https://paypal.me/desertshine";
const biz = { ...DEMO_DETAIL, businessPhone: "(480) 555-0141" };

// ── 1. The links they paste ──────────────────────────────────────────────────
{
  ok("a link copied without https:// gets it", cleanLink("desertshine.square.site/book") === "https://desertshine.square.site/book");
  ok("http becomes https", cleanLink("http://calendly.com/desert") === "https://calendly.com/desert");
  ok("junk is not a link", cleanLink("call me") === "" && cleanLink("") === "" && cleanLink("javascript:alert(1)") === "" && cleanLink("https://1.2.3.4/x") === "" && cleanLink("https://a:b@x.com") === "");
  ok("the app behind a link is named in plain words", appName(SQ) === "Square" && appName("https://calendly.com/x") === "Calendly" && appName(PP) === "PayPal" && appName("https://buy.stripe.com/abc") === "Stripe" && appName("https://example.com") === "");
}

// ── 2. Choosing, and what is refused ─────────────────────────────────────────
{
  ok("🔴 nothing is chosen for them", /Choose how your customers will book/.test(throws(() => cleanSetup({}, biz))) && /Choose how/.test(throws(() => cleanSetup({ how: "book" }, biz))));
  ok("a booking app needs its link", /Paste the link to your booking page/.test(throws(() => cleanSetup({ how: "link", link: "" }, biz))));
  ok("calling needs a real phone number on file", /business phone number/.test(throws(() => cleanSetup({ how: "call" }, { ...biz, businessPhone: "", callTrackingNumber: "" }))) && cleanSetup({ how: "call" }, biz).how === "call");
  ok("a payment link that isn't one is refused, not dropped", /payment link doesn't look right/.test(throws(() => cleanSetup({ how: "quote", pay: "my venmo" }, biz))));
  ok("🔴 a link back to BoldLine is refused (a client's page never points at us)", ["https://boldlinemedia.com/book", "https://os.boldlinemedia.com/x", "https://boldlinemedia.netlify.app/"].every((u) => /goes to BoldLine/.test(throws(() => cleanSetup({ how: "link", link: u }, biz)))) && /goes to BoldLine/.test(throws(() => cleanSetup({ how: "quote", pay: "https://www.boldlinemedia.com/pay" }, biz))));
  const s = cleanSetup({ how: "link", link: SQ, pay: PP }, biz);
  ok("a good choice comes back clean", s.how === "link" && s.link === SQ && s.pay === PP);
  ok("a link given for another choice is not kept", cleanSetup({ how: "call", link: SQ }, biz).link === "");
  const res = (status) => async () => ({ status });
  ok("🔴 a booking page that doesn't exist is refused", /page doesn't exist/.test(await athrows(checkLinks(s, { fetchImpl: res(404) }))));
  ok("🔴 a website that isn't there is refused", /couldn't open that booking link/.test(await athrows(checkLinks(s, { fetchImpl: async () => { throw new TypeError("fetch failed"); } }))));
  ok("a page that turns robots away still counts (plenty of booking pages do)", (await athrows(checkLinks(s, { fetchImpl: res(403) }))) === "" && (await athrows(checkLinks(s, { fetchImpl: res(200) }))) === "");
  ok("a slow page is not held against them", (await athrows(checkLinks(s, { fetchImpl: async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; } }))) === "");
  let n = 0; await checkLinks(s, { fetchImpl: async () => { n++; return { status: 200 }; } });
  ok("both links are opened", n === 2);
  ok("plain words for the card and the log", /Square booking page/.test(setupWords(s, biz)) && /"Pay online" link opens your PayPal payment page/.test(setupWords(s, biz)) && /calls \(480\) 555-0141/.test(setupWords({ how: "call", pay: "" }, biz)) && !/[—–]/.test(setupWords(s, biz)));
}

// ── 3. The files they download ───────────────────────────────────────────────
const fake = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array(1000).buffer });
const pagesOf = (out) => out.files.filter((f) => f.name.endsWith(".html")).map((f) => String(f.data));
const readme = (out) => String(out.files.find((f) => f.name === "README.txt").data);
const opts = (setup) => ({ domain: "desertshine.com", email: "hi@desertshine.example", setup, fetchImpl: fake });
{
  const out = await exportSiteFiles({ ...biz, intake: { how: "book" } }, opts(cleanSetup({ how: "link", link: SQ, pay: PP }, biz)));
  const pages = pagesOf(out);
  const btns = (h) => [...h.matchAll(/<a href="([^"]+)" class="btn[^"]*"/g)].map((m) => m[1]);
  ok("🔴 every page's Book buttons open their booking app", pages.every((h) => btns(h).includes(SQ)) && pages.every((h) => (h.split(`href="${SQ}"`).length - 1) >= 2), btns(pages[0]).join(" "));
  ok("🔴 and open it in a new tab, safely", pages.every((h) => new RegExp(`href="${SQ.replace(/[./]/g, "\\$&")}" class="btn[^"]*" target="_blank" rel="noopener"`).test(h)));
  ok("our own Book page is never in their files", pages.every((h) => !/desertshine\.com\/book\//.test(h)) && !out.files.some((f) => f.name.startsWith("book/")));
  ok("🔴 'Pay online' is on every page (footer) and on the contact page", pages.every((h) => h.includes(`<a href="${PP}" target="_blank" rel="noopener">Pay online</a>`)) && /<dt>Pay<\/dt><dd><a href="https:\/\/paypal\.me\/desertshine"/.test(pages.find((h) => /<form id="sf"/.test(h))));
  ok("🔴 still no link to BoldLine and nothing relative", pages.every((h) => [...h.matchAll(/<a [^>]*href="([^"]*)"/g)].every((m) => /^(https:|tel:|mailto:|#)/.test(m[1]))) && pages.every((h) => !/boldline/i.test(h.replace(/<!--[\s\S]*?-->/g, ""))));
  ok("the read-me says where customers book and how to switch apps", /Square booking page/.test(readme(out)) && /Change it on the Website tab of your BoldLine portal and download a fresh copy/.test(readme(out)) && readme(out).includes(SQ) && readme(out).includes(PP));
  ok("the read-me has no dash or emoji", !/[—–]/.test(readme(out)) && !/\p{Extended_Pictographic}/u.test(readme(out)));

  const call = pagesOf(await exportSiteFiles(biz, opts(cleanSetup({ how: "call" }, biz))));
  ok("'they call me': the Book buttons call them", call.every((h) => /<a href="tel:4805550141" class="btn/.test(h)) && call.every((h) => !h.includes("Pay online")));
  const quote = pagesOf(await exportSiteFiles({ ...biz, intake: { how: "link", link: SQ } }, opts(cleanSetup({ how: "quote" }, biz))));
  ok("'they send a request': the buttons go to the form, which emails them", quote.every((h) => /href="https:\/\/desertshine\.com\/contact\/"[^>]*class="btn"/.test(h)) && quote.every((h) => !h.includes(SQ)) && /var MAILTO="hi@desertshine\.example"/.test(quote.find((h) => /<form id="sf"/.test(h))));
  const none = await exportSiteFiles({ ...biz, intake: { how: "book" } }, opts(null));
  ok("without a choice (Bryson's copy, nothing chosen yet) it falls back to the form as before", pagesOf(none).every((h) => !h.includes("Pay online") && !/\/book\//.test(h)));
  ok("🔴 a hosted site never shows the pay link (it takes payment through its Book page)", !renderSite({ ...biz, __payLink: "" }, "home", { base: "https://desertshine.com" }).includes("Pay online") && renderSite(applySetup(biz, { how: "quote", pay: PP }), "home", { base: "https://desertshine.com" }).includes("Pay online"));
}

// ── 4. The card and its button ───────────────────────────────────────────────
const terms = { mgmt: "own", plan: "full", price: 2500, care: 0 };
const paid = { id: "c1", name: "Desert Shine", packageId: "w-site", email: "hi@desertshine.example", businessPhone: "(480) 555-0141", website: { content: DEMO_DETAIL.website.content },
  websiteDeal: { ...terms, agreement: { status: "completed", signedAt: "2026-10-20T18:00:00Z", terms }, invoices: { full: { id: "in_1", amount: 2500, paidAt: "2026-10-20T19:00:00Z" } } } };
{
  const card = PW.siteFilesCardHTML(paid);
  ok("the card asks the three ways, in plain words", /value="link"/.test(card) && /value="call"/.test(card) && /value="quote"/.test(card) && /Online, with my booking app/.test(card) && /They call or text me/.test(card) && /They send a request and I reply/.test(card));
  ok("🔴 nothing is ticked until they choose", !/ checked/.test(card) && /id="wf-link-wrap" style="display:none/.test(card));
  ok("it asks for an optional payment link and says when they don't need one", /id="wf-pay"/.test(card) && /Leave it empty if your booking app takes payment/.test(card));
  ok("🔴 it tells them how to switch apps later without asking us", /Switching apps later/.test(card) && /go to Deploys and drag the new folder/.test(card) && /never need to ask us/.test(card));
  ok("the phone it will call is shown", /Every Book button calls \(480\) 555-0141/.test(card));
  ok("no phone on file: it points them to where to add it", /blGoTo\('phone'\)/.test(PW.siteFilesCardHTML({ ...paid, businessPhone: "" })));
  const saved = { ...paid, websiteDeal: { ...paid.websiteDeal, siteSetup: { how: "link", link: SQ, pay: PP, savedAt: "2026-10-21T01:00:00Z" } } };
  const card2 = PW.siteFilesCardHTML(saved);
  ok("🔴 it remembers their choice next time", /value="link" checked/.test(card2) && card2.includes(`value="${SQ}"`) && card2.includes(`value="${PP}"`) && /id="wf-link-wrap" style="display:block/.test(card2) && /Square booking page/.test(card2));
  ok("a booking link Bryson set in the OS is filled in for them", /value="link" checked/.test(PW.siteFilesCardHTML({ ...paid, intake: { how: "link", link: SQ } })) && setupOf({ ...paid, intake: { how: "link", link: SQ } }).saved === false);
  ok("no emoji or dash on the card", !/\p{Extended_Pictographic}/u.test(card.replace(/<[^>]+>/g, " ")) && !/[—–]/.test(card));

  // The button, in a fake browser.
  const make = (answer, picked = "link") => {
    const els = { "wf-d": { value: "desertshine.com" }, "wf-d2": { value: "www.desertshine.com" }, "wf-msg": { style: {}, textContent: "" }, "wf-link": { value: SQ }, "wf-pay": { value: PP }, "wf-link-wrap": { style: {} } };
    const sent = [], saved = [];
    const btn = { disabled: false, textContent: "Download my website" };
    const doc = { getElementById: (id) => els[id] || null, querySelector: (q) => (/wf-how/.test(q) && picked ? { value: picked } : null),
      createElement: () => ({ click() { saved.push(this.download); }, remove() {} }), body: { appendChild() {} } };
    const fetchFn = async (url, o) => { sent.push(JSON.parse(o.body)); return { ok: answer.ok !== false, json: async () => answer }; };
    const fns = new Function("document", "fetch", "TOKEN", "atob", "URL", "Blob", "setTimeout", PW.WEBSITE_PORTAL_JS + ";return {blFiles:blFiles,blHostAsk:blHostAsk,blHow:blHow};")(
      doc, fetchFn, "tok", (b) => Buffer.from(b, "base64").toString("binary"), { createObjectURL: () => "blob:x", revokeObjectURL() {} }, class {}, () => 0);
    return { els, sent, saved, btn, fns };
  };
  const tick = () => new Promise((r) => setTimeout(r, 20));
  {
    const t = make({ ok: true, zip: Buffer.from("PK").toString("base64"), filename: "desertshine.com-website.zip", words: "Every Book button opens your Square booking page." });
    t.fns.blFiles(t.btn); await tick();
    ok("🔴 a successful download actually downloads (this was broken)", t.saved[0] === "desertshine.com-website.zip" && /^Downloaded\./.test(t.els["wf-msg"].textContent) && t.els["wf-msg"].style.color === "#10B981", t.els["wf-msg"].textContent);
    ok("it says where customers will book", /Square booking page/.test(t.els["wf-msg"].textContent));
    ok("the choice goes to the server with the address", t.sent[0].siteFiles.setup.how === "link" && t.sent[0].siteFiles.setup.link === SQ && t.sent[0].siteFiles.setup.pay === PP && t.sent[0].siteFiles.domain === "desertshine.com");
    ok("the button comes back for the next time", t.btn.disabled === false && t.btn.textContent === "Download my website");
  }
  {
    const t = make({ ok: false, error: "That booking link says the page doesn't exist. Copy it again from your booking app." });
    t.fns.blFiles(t.btn); await tick();
    ok("🔴 the server's reason is shown, word for word", /page doesn't exist/.test(t.els["wf-msg"].textContent) && t.saved.length === 0);
  }
  {
    const t = make({ ok: true }, "");
    t.fns.blFiles(t.btn); await tick();
    ok("no choice: it asks first and never calls the server", /Choose how your customers will book/.test(t.els["wf-msg"].textContent) && t.sent.length === 0);
  }
  {
    const t = make({ ok: true }); t.els["wf-link"].value = "  ";
    t.fns.blFiles(t.btn); await tick();
    ok("booking app picked but no link: it asks for the link", /Paste the link to your booking page/.test(t.els["wf-msg"].textContent) && t.sent.length === 0);
  }
  {
    const t = make({ ok: true }, "call");
    t.fns.blFiles(t.btn); await tick();
    ok("a link typed before switching to 'call' is not sent", t.sent[0].siteFiles.setup.how === "call" && t.sent[0].siteFiles.setup.link === "");
  }
  {
    const t = make({ ok: true }); const b = { disabled: false, textContent: "Have BoldLine host it for me" };
    t.fns.blHostAsk(b); await tick();
    ok("🔴 'Have BoldLine host it' says thanks when it worked (this was broken too)", /Thanks, we'll be in touch/.test(b.textContent));
  }
}

// ── 5. The server ────────────────────────────────────────────────────────────
{
  const h = PORTAL.slice(PORTAL.indexOf("if (body.siteFiles && typeof body.siteFiles"), PORTAL.indexOf("if (body.hostRequest === true)"));
  ok("🔴 the choice is checked and both links opened before any file is made", h.indexOf("cleanSetup(body.siteFiles.setup, cl)") > 0 && h.indexOf("await checkLinks(setup)") > 0 && h.indexOf("await checkLinks(setup)") < h.indexOf("exportSiteFiles("));
  ok("the files are made with it", /exportSiteFiles\(cl, \{[^}]*setup,/.test(h));
  ok("🔴 it is saved on the deal (server-owned, so an OS save can't wipe it)", /siteSetup: \{ \.\.\.setup, savedAt: at \}/.test(h) && /const SERVER_OWNED_KEYS=\["websiteDeal"/.test(UI));
  ok("switching apps is logged, and Bryson is not pinged for it", /Changed how customers book or pay/.test(h) && /if \(first \|\| again\) \{ try \{ await dispatchAlert/.test(h));
  ok("the handover alert tells him there's nothing to do", /The handover is done, nothing for you to do\./.test(h));
  ok("his own download from the OS uses their choice too", /const su = setupOf\(cl\);[\s\S]{0,200}setup: su\.how \? su : null/.test(SITE));
  ok("the OS shows what they chose", /const setupLine=\(s\)=>/.test(UI) && /\{setupLine\(d\.siteSetup\)&&/.test(UI));
}

console.log(`verify-own-site-booking: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
