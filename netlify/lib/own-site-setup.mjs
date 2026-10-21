// How customers book and pay on a website the client bought outright (KB `own-site-booking`).
//
// Bryson, 2026-10-21: "build that that way they dont get a website they cant use because they cant book people or
// take payments and make sure its fully automated so i dont have to do anything on my end for that", and on
// switching apps later: "should we give them a way to do that without having to contact us?"
//
// Our Book page and card payments run on our servers (that is what the monthly plan pays for), so they cannot go in
// the handed-over files. Instead the client picks on the download card how their customers will book:
//   link   the booking app they already use (Square, Calendly, Booksy...): every Book button opens it
//   call   their phone
//   quote  the form, which opens the visitor's email app addressed to them
// plus, if they want it, a payment link (PayPal, Venmo, a Square or Stripe link) shown on the site as "Pay online".
// Nothing is picked for them: the download waits for a choice, so nobody ends up with a site that cannot take a
// customer without knowing it. Both links are opened before they are used, because a typo here is a site that
// cannot book.
//
// Switching later is theirs to do: change it on the same card and download a fresh copy. Deliberately NOT a live
// redirect through our servers. Their buttons would then stop working if anything changed on our side, which is the
// opposite of owning it (agreement WA-8 section 7: after handover nothing is ours to keep running).

import { isOwnHost } from "./client-domain.mjs";

export const SETUP_WAYS = ["link", "call", "quote"];

const str = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const phoneOf = (cl) => str(cl && (cl.businessPhone || cl.callTrackingNumber), 40);
const digits = (s) => String(s || "").replace(/[^0-9]/g, "");

// What they typed, as an https address, or "" when it is not one. "square.site/book/x" gets its https:// added,
// because that is how most people copy a link out of an app's share sheet.
export function cleanLink(input) {
  let t = str(input, 600);
  if (!t) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = `https://${t.replace(/^\/+/, "")}`;
  if (/^http:\/\//i.test(t)) t = `https://${t.slice(7)}`;
  if (!/^https:\/\/[^\s"'<>]+$/i.test(t)) return "";
  try {
    const u = new URL(t);
    if (!/\./.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.username || u.password) return "";
    return u.href;
  } catch { return ""; }
}
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
// A client's page never points back at us (CLAUDE.md), and a link to their own new site would just loop.
const isOurs = (h) => isOwnHost(h) || /(^|\.)boldlinemedia\./.test(h);

// The app behind a link, for plain confirmation words ("Your Book buttons open your Square booking page").
const APPS = [
  [/(^|\.)(square\.site|squareup\.com|square\.link)$/, "Square"], [/(^|\.)calendly\.com$/, "Calendly"],
  [/(^|\.)housecallpro\.com$/, "Housecall Pro"], [/(^|\.)booksy\.com$/, "Booksy"], [/(^|\.)urable\.com$/, "Urable"],
  [/(^|\.)(acuityscheduling\.com|as\.me)$/, "Acuity"], [/(^|\.)setmore\.com$/, "Setmore"], [/(^|\.)vagaro\.com$/, "Vagaro"],
  [/(^|\.)(getjobber\.com|jobber\.com)$/, "Jobber"], [/(^|\.)fresha\.com$/, "Fresha"], [/(^|\.)simplybook\.me$/, "SimplyBook"],
  [/(^|\.)(calendar\.app\.google|calendar\.google\.com)$/, "Google Calendar"], [/(^|\.)(paypal\.me|paypal\.com)$/, "PayPal"],
  [/(^|\.)venmo\.com$/, "Venmo"], [/(^|\.)(stripe\.com)$/, "Stripe"], [/(^|\.)cash\.app$/, "Cash App"],
];
export const appName = (url) => { const h = hostOf(url); const hit = APPS.find(([re]) => re.test(h)); return hit ? hit[1] : ""; };

// The saved choice, or a starting point from what Bryson set in the OS ("Their own booking link" / "Call"), which is
// shown already filled in but still has to be confirmed by the client on the card.
export function setupOf(cl) {
  const s = (cl && cl.websiteDeal && cl.websiteDeal.siteSetup) || null;
  if (s && SETUP_WAYS.includes(s.how)) return { how: s.how, link: s.how === "link" ? cleanLink(s.link) : "", pay: cleanLink(s.pay), savedAt: s.savedAt || null, saved: true };
  const i = (cl && cl.intake) || {};
  const how = i.how === "link" && cleanLink(i.link) ? "link" : i.how === "call" && phoneOf(cl) ? "call" : "";
  return { how, link: how === "link" ? cleanLink(i.link) : "", pay: "", savedAt: null, saved: false };
}

// Checks what came from the card. Returns the setup to save, or throws a sentence the client can act on.
export function cleanSetup(input, cl) {
  const o = input && typeof input === "object" ? input : {};
  const how = SETUP_WAYS.includes(o.how) ? o.how : "";
  if (!how) throw new Error("Choose how your customers will book first.");
  const link = how === "link" ? cleanLink(o.link) : "";
  if (how === "link" && !link) throw new Error("Paste the link to your booking page. It starts with https://");
  if (how === "call" && digits(phoneOf(cl)).length < 10) throw new Error("Add your business phone number under Your Information first, so the buttons can call it.");
  const payIn = str(o.pay, 600);
  const pay = payIn ? cleanLink(payIn) : "";
  if (payIn && !pay) throw new Error("That payment link doesn't look right. Copy it again from your payment app.");
  for (const u of [link, pay].filter(Boolean)) {
    if (isOurs(hostOf(u))) throw new Error("That link goes to BoldLine. Use the link from your own booking or payment app.");
  }
  if (link && pay && link === pay) return { how, link, pay: "" };
  return { how, link, pay };
}

// Opens each link once before it goes into their site. Only a link that clearly goes nowhere is refused (no such
// website, or "page not found"); a slow answer or a page that turns robots away still counts, because plenty of
// booking pages do that and the customer's browser will open them fine.
export async function checkLinks(setup, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  for (const [u, what] of [[setup.link, "booking"], [setup.pay, "payment"]]) {
    if (!u) continue;
    let status = 0;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetchImpl(u, { method: "GET", redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; website link check)" } });
        status = r.status;
      } finally { clearTimeout(tm); }
    } catch (e) {
      if (e && e.name === "AbortError") continue;
      throw new Error(`We couldn't open that ${what} link. Check it's copied in full and try again.`);
    }
    if (status === 404 || status === 410) throw new Error(`That ${what} link says the page doesn't exist. Copy it again from your ${what} app.`);
  }
  return true;
}

// The site record the export renders, with the choice applied (site-export.mjs).
export function applySetup(site, setup) {
  const i = { ...((site && site.intake) || {}) };
  if (setup.how === "link") Object.assign(i, { how: "link", link: setup.link });
  else if (setup.how === "call") i.how = "call";
  else i.how = "quote";
  return { ...site, intake: i, __payLink: setup.pay || "" };
}

// Plain words for the card, the read-me and the log.
export function setupWords(setup, cl) {
  const app = appName(setup.link), payApp = appName(setup.pay);
  const book = setup.how === "link" ? `Every Book button opens your ${app ? `${app} ` : ""}booking page.`
    : setup.how === "call" ? `Every Book button calls ${phoneOf(cl) || "your phone"}.`
    : "Every Book button opens your contact form, which sends the request to your email.";
  const pay = setup.pay ? ` A "Pay online" link opens your ${payApp ? `${payApp} ` : ""}payment page.` : "";
  return book + pay;
}
