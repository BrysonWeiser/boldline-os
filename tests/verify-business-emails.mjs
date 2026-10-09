// A business Bryson owns emails its own customers (Bryson, 2026-10-09: "lets do all of them but make sure the
// email comes from the business email for my other business not boldline media (make a way for you to brand the
// email based off of the business name and website when i add it to the my businesses tab) and then for 4. make
// sure it looks that they didnt already sign up for a subscription but that it only goes to the one off
// customers that book a one time detail and dont already have a subscription"). What has to stay true:
//  1. From the business: its own address once a test send proves it; the automatic emails wait until then.
//  2. Branded from the business (logo and colour pulled from its own website), never BoldLine, no emojis or dashes.
//  3. Each email goes once, inside a narrow window, so switching on never sends a backlog.
//  4. 🔴 "Time for another" goes only to one-off customers: never to anyone on a subscription (a plan package,
//     or the list), anyone already booked again, or anyone who unsubscribed.
//  5. Unsubscribe is signed, GET changes nothing, and a client domain passes it through.
//  6. The phone calendar feed is read only and correct.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const E = await import("../netlify/lib/biz-email.mjs");
const S = await import("../netlify/lib/biz-email-shell.mjs");

const NOW = Date.parse("2026-10-09T17:00:00Z");
const H = 36e5, D = 864e5;
const at = (ms) => new Date(NOW + ms).toISOString();
const bk = (id, startIn, o = {}) => ({ id, packageId: "full", packageName: "Full Detail", price: "$199", minutes: 180, start: at(startIn), end: at(startIn + 3 * H),
  name: "Ana Ruiz", email: "ana@x.example", phone: "(480) 555-0199", address: "123 Main St", status: "booked", createdAt: at(startIn - 5 * D), ...o });
const BIZ = (o = {}) => ({ id: "biz1", internal: true, owned: true, name: "Desert Gloss Detailing", email: "hi@desertgloss.com", businessPhone: "(480) 555-0100",
  emailSender: { address: "hi@desertgloss.com" }, emailSenderStatus: { address: "hi@desertgloss.com", verified: true },
  brand: { website: "https://desertgloss.com/", logoUrl: "https://desertgloss.com/logo.png", color: "#1D4ED8" },
  customerEmails: { reviewUrl: "https://g.page/r/abc/review" },
  booking: { on: true, packages: [{ id: "full", name: "Full Detail", price: "$199", minutes: 180 }, { id: "club", name: "Monthly Club", price: "$99/mo", minutes: 120, plan: true }] },
  bookings: [], ...o });
const kinds = (cl, now = NOW) => E.dueCustomerEmails(cl, now).map((x) => `${x.booking.id}:${x.kind}`).sort().join(",");

// 1. From the business
ok("🔴 the business's own address is used only once a test proved it", E.senderOf(BIZ()) === "hi@desertgloss.com"
  && E.senderOf(BIZ({ emailSenderStatus: { address: "hi@desertgloss.com", verified: false } })) === ""
  && E.senderOf(BIZ({ emailSender: { address: "new@desertgloss.com" } })) === "");
ok("🔴 the automatic emails wait until the address is proven", kinds(BIZ({ emailSenderStatus: {}, bookings: [bk("a", 20 * H)] })) === "" && kinds(BIZ({ bookings: [bk("a", 20 * H)] })) === "a:reminder");
{
  const sent = [];
  const send = async (m) => { sent.push(m); if (m.fromAddress === "bad@x.com") throw new Error("Resend error 403: The x.com domain is not verified"); };
  await E.sendAsBusiness(BIZ(), { to: "c@x.example", subject: "s", html: "h", text: "t" }, { send, strict: true });
  ok("🔴 it sends as the business, from its own address, replies to it", sent[0].fromAddress === "hi@desertgloss.com" && sent[0].fromName === "Desert Gloss Detailing" && sent[0].replyTo === "hi@desertgloss.com");
  const r = await E.sendAsBusiness(BIZ({ emailSenderStatus: {} }), { to: "c@x.example", subject: "s", html: "h", text: "t" }, { send, strict: true });
  ok("🔴 strict (the automatic emails): nothing goes from our address", r.sent === false && sent.length === 1);
  const c = await E.sendAsBusiness(BIZ({ emailSenderStatus: {} }), { to: "c@x.example", subject: "s", html: "h", text: "t" }, { send });
  ok("a booking confirmation still reaches the customer, under the business's name", c.sent && c.via === "fallback" && !sent[1].fromAddress && sent[1].fromName === "Desert Gloss Detailing");
  const broke = await E.sendAsBusiness(BIZ({ emailSender: { address: "bad@x.com" }, emailSenderStatus: { address: "bad@x.com", verified: true } }), { to: "c@x.example", subject: "s", html: "h", text: "t" }, { send, strict: true });
  ok("an address that stops working is reported, so the job marks it for a new test", broke.sent === false && broke.senderFailed === true);
  const R = src("netlify/lib/report-shared.mjs");
  ok("the sender takes the business's address only when it looks like one", /const addr = fromAddress && \/\^\[\^\\s@<>"',;\]\+@\[\^\\s@<>"',;\]\+\\\.\[a-z\]\{2,\}\$\/i\.test\(fromAddress\) \? fromAddress : senderAddress\(process\.env\.REPORTS_FROM_EMAIL\);/.test(R));
  const J = src("netlify/functions/biz-customer-emails.mjs");
  ok("🔴 the hourly job sends strictly, records after, and merges into a fresh read", /\{ send: sendEmail, strict: true \}/.test(J) && J.indexOf("sendAsBusiness(") < J.indexOf('select("data").eq("id", row.id)') && /customerEmailLog: \{ \.\.\.\(fresh\.data\.customerEmailLog \|\| \{\}\), \.\.\.log \}/.test(J));
  ok("it runs every hour", /\[functions\."biz-customer-emails"\]\n  schedule = "7 \* \* \* \*"/.test(src("netlify.toml")));
  ok("🔴 what was sent, and whether the address works, are never saved over by an OS screen", /const SERVER_OWNED_KEYS=\["websiteDeal","emailSenderStatus","customerEmailLog","emailOptOut"/.test(UI));
  const F = src("netlify/functions/biz-email.mjs");
  ok("the test send is the only thing that marks an address as working, and only touches that", /status = \{ address, verified: true, verifiedAt:/.test(F) && /data: \{ \.\.\.fresh\.data, emailSenderStatus: status \}/.test(F) && /db\.auth\.getUser\(jwt\)/.test(F));
  ok("samples go to Bryson, never a customer", /sendAsBusiness\(cl, \{ to: owner, subject: `Sample: \$\{mail\.subject\}`/.test(F));
  ok("the booking confirmation goes out as the business too", /sendAsBusiness\(next, \{ to: made\.booking\.email/.test(src("netlify/functions/book.mjs")));
}

// 2. Branded from the business
{
  const cl = BIZ({ bookings: [bk("a", 20 * H, { deposit: { amount: "$50", link: "https://buy.stripe.com/x", paid: false } })] });
  const all = ["reminder", "review", "rebook"].map((k) => E.buildCustomerEmail(cl, k, cl.bookings[0], { base: "https://os.example", key: "k" }));
  const html = all.map((m) => m.html).join(""), text = all.map((m) => m.text + m.subject).join("");
  ok("🔴 its logo, its colour (the button keeps it in dark mode)", html.includes('src="https://desertgloss.com/logo.png"') && html.includes("border-top:4px solid #1D4ED8") && html.includes("background-image:linear-gradient(#1D4ED8,#1D4ED8)"));
  ok("its name, phone and website in the footer", html.includes("Desert Gloss Detailing &middot; (480) 555-0100 &middot; desertgloss.com"));
  ok("🔴 nothing says or links BoldLine", !/boldline/i.test(html + text));
  ok("no emojis, no dashes", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html + text) && !/[—–]/.test(html + text));
  ok("no logo: its name instead, and a colour that is too light to read becomes grey words", S.bizEmailHTML(BIZ({ brand: { color: "#F5D90A" } }), { heading: "x" }).includes("color:#374151\">Desert Gloss Detailing<") && S.bizBrand(BIZ({ brand: { color: "#F5D90A" } })).on === "#0B0B0C");
  ok("a customer's words are escaped", !S.bizEmailHTML(cl, { heading: "<script>x</script>", rows: [["Where", "<img src=x>"]] }).includes("<script>x"));
  ok("the reminder carries the time, the place and the deposit button", /Saturday, October 10 at 6:00 AM/.test(all[0].html) && all[0].html.includes("123 Main St") && all[0].html.includes('href="https://buy.stripe.com/x"'));
  ok("dates are written out, never 'tomorrow'", !/tomorrow/i.test(all.map((m) => m.text).join("")));
  ok("the review request points at the Google review link", all[1].html.includes('href="https://g.page/r/abc/review"'));
  ok("🔴 the review and book-again emails carry an unsubscribe link; the reminder does not need one", all[1].html.includes("Unsubscribe from these emails") && all[2].html.includes("Unsubscribe from these emails") && !all[0].html.includes("Unsubscribe"));
  ok("book again links to its own booking page on its own domain", E.buildCustomerEmail({ ...cl, websiteDeal: { domain: { live: true, host: "desertgloss.com" } } }, "rebook", cl.bookings[0], { base: "https://os.example", key: "k" }).html.includes('href="https://desertgloss.com/book/"'));
  // Pulled from its website
  const page = `<html><head><title>Desert Gloss | Mobile Detailing</title><meta name="theme-color" content="#1d4ed8"><link rel="apple-touch-icon" href="/apple.png"></head><body><img class="site-logo" src="/img/logo.svg" alt="Desert Gloss"></body></html>`;
  const b = E.brandFromHTML(page, "https://desertgloss.com/");
  ok("🔴 the logo and colour are pulled from its own website", b.logoUrl === "https://desertgloss.com/img/logo.svg" && b.color === "#1D4ED8" && b.name === "Desert Gloss | Mobile Detailing");
  ok("no logo image: the app icon", E.brandFromHTML(`<link rel="apple-touch-icon" href="https://cdn.x.com/a.png"><meta name="theme-color" content="#abc">`, "https://x.com/").logoUrl === "https://cdn.x.com/a.png" && E.brandFromHTML(`<meta name="theme-color" content="#abc">`, "https://x.com/").color === "#AABBCC");
  ok("an http logo is never used", E.brandFromHTML(`<img src="http://x.com/logo.png">`, "https://x.com/").logoUrl === "");
  ok("🔴 only public https sites are ever fetched", E.safePublicUrl("https://desertgloss.com") && !E.safePublicUrl("http://desertgloss.com") && !E.safePublicUrl("https://127.0.0.1/") && !E.safePublicUrl("https://localhost/")
    && !E.safePublicUrl("https://169.254.169.254/") && !E.safePublicUrl("https://x.internal/") && !E.safePublicUrl("https://[::1]/") && !E.safePublicUrl("https://desertgloss.com:8443/"));
  ok("every redirect is checked too", /redirect: "manual"/.test(src("netlify/functions/biz-email.mjs")) && /u = safePublicUrl\(new URL\(r\.headers\.get\("location"\), u\)\.href\)/.test(src("netlify/functions/biz-email.mjs")));
  ok("🔴 adding a business takes its website, and its branding is pulled the first time it opens", /field\("website","Website it already has \(optional\)"/.test(UI) && /brand: \{ website: bizWebsiteUrl\(f\.website\) \},/.test(UI)
    && /useEffect\(\(\)=>\{ if\(br\.website && !br\.fetchedAt\) pull\(\); \},\[client\.id\]\)/.test(UI));
  ok("and it sends from its own email once tested", /emailSender: \{ address: String\(f\.email\|\|""\)\.trim\(\) \},/.test(UI));
}

// 3. Once, in its window
{
  ok("reminder: about a day before", kinds(BIZ({ bookings: [bk("a", 25 * H)] })) === "a:reminder" && kinds(BIZ({ bookings: [bk("a", 27 * H)] })) === "" && kinds(BIZ({ bookings: [bk("a", 1 * H)] })) === "");
  ok("no reminder for a job booked in the last day and a half (the confirmation is fresh)", kinds(BIZ({ bookings: [bk("a", 20 * H, { createdAt: at(-5 * H) })] })) === "");
  ok("review: the day after the job, for three days, only with a review link", kinds(BIZ({ bookings: [bk("a", -24 * H)] })) === "a:review" && kinds(BIZ({ bookings: [bk("a", -10 * H)] })) === ""
    && kinds(BIZ({ bookings: [bk("a", -5 * D)] })) === "" && kinds(BIZ({ customerEmails: {}, bookings: [bk("a", -24 * H)] })) === "");
  ok("🔴 never twice", kinds(BIZ({ customerEmailLog: { "a:reminder": at(-H) }, bookings: [bk("a", 20 * H)] })) === "");
  ok("never for a cancelled job, or a customer with no email", kinds(BIZ({ bookings: [bk("a", 20 * H, { status: "cancelled" }), bk("b", 20 * H, { email: "" , phone: "4805550111"})] })) === "");
  ok("🔴 switching it on with months of history sends nothing old", kinds(BIZ({ bookings: [bk("a", -200 * D), bk("b", -90 * D, { email: "b@x.example", phone: "" }), bk("c", -20 * D, { email: "c@x.example", phone: "" })] })) === "");
  ok("each one can be switched off", kinds(BIZ({ customerEmails: { reminder: false, reviewUrl: "https://g.page/r/abc/review" }, bookings: [bk("a", 20 * H)] })) === "");
  ok("never for a client's business, a demo, or BoldLine's own account", kinds(BIZ({ owned: false, bookings: [bk("a", 20 * H)] })) === "" && kinds(BIZ({ demo: true, bookings: [bk("a", 20 * H)] })) === "" && kinds(BIZ({ internal: false, bookings: [bk("a", 20 * H)] })) === "");
}

// 4. Time for another: one-off customers only
{
  const old = (id, o) => bk(id, -61 * D, o);
  ok("a one-off customer, 60 days on, gets it once", kinds(BIZ({ bookings: [old("a")] })) === "a:rebook" && kinds(BIZ({ bookings: [old("a")], customerEmailLog: { "a:rebook": at(-D) } })) === "");
  ok("not before the time he picked", kinds(BIZ({ bookings: [bk("a", -50 * D)] })) === "" && kinds(BIZ({ customerEmails: { rebookDays: 45 }, bookings: [bk("a", -50 * D)] })) === "a:rebook");
  ok("🔴 never to anyone who booked a subscription package, even long ago and under another email", kinds(BIZ({ bookings: [old("a"), bk("p", -300 * D, { packageId: "club", packageName: "Monthly Club", email: "", phone: "480-555-0199" })] })) === "");
  ok("🔴 a booking that recorded it was a plan counts even if the package is gone now", kinds(BIZ({ bookings: [old("a"), bk("p", -300 * D, { packageId: "deleted", plan: true })] })) === "");
  ok("🔴 never to anyone on his list of subscribers, by email or by phone", kinds(BIZ({ customerEmails: { planCustomers: ["ANA@x.example"] }, bookings: [old("a")] })) === ""
    && kinds(BIZ({ customerEmails: { planCustomers: "+1 (480) 555-0199" }, bookings: [old("a")] })) === "");
  ok("🔴 never to anyone who already booked again", kinds(BIZ({ bookings: [old("a"), bk("n", 5 * D, { createdAt: at(-D) })] })) === "");
  ok("only their latest job counts (an older one-off does not trigger it once they came back)", kinds(BIZ({ bookings: [old("a"), bk("b", -10 * D)] })) === "");
  ok("a cancelled booking does not count as coming back", kinds(BIZ({ bookings: [old("a"), bk("x", 5 * D, { status: "cancelled" })] })) === "a:rebook");
  ok("🔴 never to anyone who unsubscribed", kinds(BIZ({ emailOptOut: ["ana@x.example"], bookings: [old("a")] })) === "");
  ok("two different customers are judged apart", kinds(BIZ({ bookings: [old("a"), old("b", { name: "Bo", email: "bo@x.example", phone: "4805550222" })] })) === "a:rebook,b:rebook");
  ok("the OS lets him mark a package as a subscription, and keep a subscriber list", /This is a subscription or membership \(its customers never get "time for another" emails\)/.test(UI) && /Customers on a subscription \(their email or phone, one per line\)/.test(UI));
  const Bk = await import("../netlify/lib/booking.mjs");
  ok("a booking remembers its package was a plan", Bk.makeBooking(BIZ({ booking: { on: true, packages: [{ id: "club", name: "Monthly Club", minutes: 120, plan: true }] } }), { packageId: "club", start: "2026-10-12T15:00:00Z", name: "A", phone: "4805550199", address: "1 Main" }, NOW, "z").booking.plan === true);
}

// 5. Unsubscribe
{
  const url = E.optOutUrl("https://os.example", BIZ(), "Ana@X.example", "secret");
  const q = new URL(url).searchParams;
  ok("the link is signed for this business and address", E.optOutCheck("secret", "biz1", "ana@x.example", q.get("s")) && !E.optOutCheck("secret", "biz1", "bo@x.example", q.get("s")) && !E.optOutCheck("other", "biz1", "ana@x.example", q.get("s")));
  ok("on the business's own domain when it has one", E.optOutUrl("https://os.example", BIZ({ websiteDeal: { domain: { live: true, host: "desertgloss.com" } } }), "a@x.example", "k").startsWith("https://desertgloss.com/optout?"));
  const O = src("netlify/functions/optout.mjs");
  ok("🔴 opening the link changes nothing (mail scanners open links); the button does", /if \(req\.method !== "POST"\) return page\(/.test(O) && O.indexOf('req.method !== "POST"') < O.indexOf(".update("));
  ok("it speaks for the business, never BoldLine", !/boldline/i.test(O.replace(/^\/\/.*$/gm, "")));
  ok("a client domain passes it through", /path: "\/optout"/.test(src("sites/functions/optout.mjs")) && /"\/optout"\]/.test(src("netlify/lib/client-domain.mjs")) && /functions\/optout\.mjs/.test(src("sites/deps.mjs")) && /from = "\/optout"/.test(src("netlify.toml")));
}

// 6. The phone calendar
{
  const P = await import("../netlify/lib/biz-portal.mjs");
  const cl = BIZ({ portal: { on: true, token: "t" }, bookings: [bk("a", 20 * H, { notes: "Gate code 4411, dog; friendly" }), bk("c", 40 * H, { status: "cancelled" }), bk("old", -90 * D)] });
  const ics = P.bookingsIcs(cl, NOW);
  ok("a real calendar file with each booking", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trim().endsWith("END:VCALENDAR") && (ics.match(/BEGIN:VEVENT/g) || []).length === 2);
  ok("start, end, place, and the customer's details", ics.includes("DTSTART:20261010T130000Z") && ics.includes("SUMMARY:Full Detail: Ana Ruiz") && ics.includes("LOCATION:123 Main St") && /Gate code 4411\\, dog\\; friendly/.test(ics.replace(/\r\n /g, "")));
  ok("🔴 a cancelled booking is sent as cancelled so it leaves the phone too", /UID:c@bookings[\s\S]*?STATUS:CANCELLED/.test(ics));
  ok("long lines are folded", ics.split("\r\n").every((l) => l.length <= 75));
  const F = src("netlify/functions/biz-cal.mjs");
  ok("🔴 read only, and only with the portal switched on", /if \(req\.method !== "GET" && req\.method !== "HEAD"\)/.test(F) && /!portalOn\(row\.data\)/.test(F) && !/\.update\(/.test(F) && /from = "\/biz-cal"/.test(src("netlify.toml")));
  ok("the portal and the OS both offer it", P.renderBizPortal(cl, { token: "7c1d2e3f-2222-4a2b-9c3d-abcdefabcdef", base: "https://os.example", now: NOW }).includes('href="webcal://os.example/biz-cal?t=7c1d2e3f-2222-4a2b-9c3d-abcdefabcdef"') && /webcal:\/\/\$\{window\.location\.host\}\/biz-cal\?t=\$\{portal\.token\}/.test(UI));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-business-emails: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
