// Online booking on a business's website (Bryson, 2026-10-07, for the detailing business he owns: "our
// number is displayed if they want to call us but they can book by just pressing what package they want
// ... and then choose a date and time and put in the location plus their info"). What has to stay true:
//  1. Open times are the working hours, minus the soonest-allowed window, minus every live booking with
//     travel time around it, minus blocked time, on the business's own clock. A slot can never sell twice.
//  2. The server checks everything again against the record as it is right now, and reads it again right
//     before writing, so two customers a second apart cannot both get the same time.
//  3. The booking is saved before any email; it becomes a lead, so the OS, the partner page and the
//     alerts all see it; the customer gets a confirmation as the business.
//  4. On the website: a Book page only when booking is on with a package, every main button goes to it,
//     the phone number is right there, and a preview never books anything.
//  5. It is reachable on every host the website lives on.
//  7. A deposit goes to the business's own payment page; the link only reaches the customer after booking.
//  8. The address question fits the business, or is left out for one customers come to.
//  9. A landing page follows the same choice, with the same booking steps, and stays safe in a preview.
// 10. His own businesses' bookings show on the OS Calendar and in the morning digest.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const B = await import("../netlify/lib/booking.mjs");

const NOW = Date.parse("2026-10-08T04:00:00Z");   // Wednesday 9:00 PM in Phoenix
const PKG = { id: "full", name: "Full Detail", price: "$199", minutes: 180 };
const base = (o = {}) => ({ id: "b", internal: true, owned: true, name: "Desert Gloss Detailing", landingSlug: "desert-gloss", leadToken: "TOKEN1", businessPhone: "(480) 555-0100",
  campaignSetup: { serviceArea: "Gilbert, AZ" }, booking: { on: true, packages: [PKG] }, bookings: [], ...o });
const labels = (cl, day) => (B.bookingDays(cl, "full", NOW).find((d) => d.date === day) || { slots: [] }).slots.map((s) => s.label);

// 1. Open times
ok("Arizona never shifts its clock; a daylight-saving zone does", B.tzOffsetMin("America/Phoenix", NOW) === -420 && B.tzOffsetMin("America/Phoenix", Date.parse("2026-07-01T12:00:00Z")) === -420
  && B.tzOffsetMin("America/New_York", Date.parse("2026-07-01T12:00:00Z")) === -240 && B.tzOffsetMin("America/New_York", Date.parse("2026-12-01T12:00:00Z")) === -300);
ok("8:00 AM in Phoenix is 3:00 PM UTC", new Date(B.zonedToUtc("2026-10-09", 480, "America/Phoenix")).toISOString() === "2026-10-09T15:00:00.000Z");
ok("and 9:00 AM in New York in summer is 1:00 PM UTC", new Date(B.zonedToUtc("2026-07-01", 540, "America/New_York")).toISOString() === "2026-07-01T13:00:00.000Z");
ok("🔴 nothing sooner than the allowed window (12 hours by default)", labels(base(), "2026-10-07").length === 0 && labels(base(), "2026-10-08")[0] === "9:00 AM");
ok("a 3 hour job must finish by closing: the last start on a 5 PM day is 2 PM", labels(base(), "2026-10-09").slice(-1)[0] === "2:00 PM");
ok("Sundays are closed by default", labels(base(), "2026-10-11").length === 0);
{
  const busy = base({ bookings: [{ id: "x", start: "2026-10-09T17:00:00Z", end: "2026-10-09T20:00:00Z", status: "booked" }] });
  ok("🔴 a booked job and the travel time around it never show again", labels(busy, "2026-10-09").join(",") === "1:30 PM,2:00 PM");
  const cancelled = base({ bookings: [{ id: "x", start: "2026-10-09T17:00:00Z", end: "2026-10-09T20:00:00Z", status: "cancelled" }] });
  ok("a cancelled booking frees its time", labels(cancelled, "2026-10-09").length === labels(base(), "2026-10-09").length);
  const blocked = base({ booking: { on: true, packages: [PKG], blocks: [{ start: "2026-10-09T15:00:00Z", end: "2026-10-10T00:00:00Z" }] } });
  ok("🔴 blocked time never shows", labels(blocked, "2026-10-09").length === 0);
  const hrs = base({ booking: { on: true, packages: [PKG], hours: [null, null, null, null, null, [600, 840], null] } });
  ok("custom hours are followed (Friday 10 to 2: one 3 hour start at 10, 10:30 or 11)", labels(hrs, "2026-10-09").join(",") === "10:00 AM,10:30 AM,11:00 AM");
  ok("it looks ahead the set number of days (21 by default)", B.bookingDays(base(), "full", NOW).length === 21);
}
ok("🔴 off, or on with no package yet, means no booking at all", !B.bookingOn(base({ booking: { on: false, packages: [PKG] } })) && !B.bookingOn(base({ booking: { on: true, packages: [] } })) && B.bookingOn(base()));
ok("the website learns the packages, never anyone else's booking", Object.keys(B.publicBooking(base({ bookings: [{ name: "Secret" }] }))).sort().join(",") === "cta,note,on,packages,tz" && !JSON.stringify(B.publicBooking(base())).includes("Secret"));

// 2. The server's own check
{
  const slot = B.bookingDays(base(), "full", NOW)[1].slots[0].start;
  const body = { packageId: "full", start: slot, name: "Maria Lopez", phone: "480 555 0141", email: "m@x.example", address: "123 Main St, Gilbert", notes: "Black Tahoe" };
  const r = B.makeBooking(base(), body, NOW, "id1");
  ok("a good booking is accepted, for the package's length", !r.error && r.booking.minutes === 180 && Date.parse(r.booking.end) - Date.parse(r.booking.start) === 180 * 60000);
  ok("🔴 it becomes a lead with everything the partner needs", r.lead.source === "booking" && r.lead.leadId === "id1" && /Booked: Full Detail \(\$199\) on Thursday, October 8 at 9:00 AM\./.test(r.lead.message) && /Address: 123 Main St, Gilbert\./.test(r.lead.message));
  const again = B.makeBooking(base({ bookings: [r.booking] }), { ...body, name: "Bo" }, NOW);
  ok("🔴 the same time can never be booked twice", again.taken === true && /just taken/.test(again.error));
  ok("a time that was never offered is refused", B.makeBooking(base(), { ...body, start: "2026-10-08T15:07:00Z" }, NOW).taken === true);
  ok("a package that does not exist is refused", /pick a package/.test(B.makeBooking(base(), { ...body, packageId: "nope" }, NOW).error));
  ok("it needs a name, a way to reach them, and the address", /name/.test(B.makeBooking(base(), { ...body, name: "" }, NOW).error)
    && /phone number or an email/.test(B.makeBooking(base(), { ...body, phone: "", email: "" }, NOW).error) && /address/.test(B.makeBooking(base(), { ...body, address: "" }, NOW).error));
  ok("booking off refuses even a valid slot", /not open/.test(B.makeBooking(base({ booking: { on: false, packages: [PKG] } }), body, NOW).error));
  const F = src("netlify/functions/book.mjs");
  ok("🔴 it reads the record again and checks the time against it right before writing", F.indexOf("fresh = await load(db, token)") > 0 && F.indexOf("makeBooking(fresh.data, body)") > F.indexOf("fresh = await load(db, token)") && F.indexOf("makeBooking(fresh.data") < F.indexOf(".update({ data: next"));
  ok("a taken time answers 409 so the page offers fresh times", /made\.taken \? 409 : 400/.test(F) && /if\(o\.s===409\)\{d\.getElementById\('bkf'\)\.hidden=true;bdays\(\);\}/.test(src("netlify/lib/booking-widget.mjs")));

  // 3. Saved, then told
  ok("🔴 saved before any email", F.indexOf(".update({ data: next") < F.indexOf("notifyOwnerOfLead(next"));
  ok("the booking is kept, and added as a lead and to the account log", /bookings: \[made\.booking, \.\.\.\(cur\.bookings \|\| \[\]\)\]/.test(F) && /leadsLog: \[\{ status: "new", followUps: \[\], \.\.\.made\.lead \}/.test(F));
  ok("Bryson, the partner and the customer are each told", /notifyOwnerOfLead\(next, made\.lead\)/.test(F) && /notifyTeamOfLead\(next, made\.lead, \{ send: sendEmail/.test(F) && /sendEmail\(\{ to: made\.booking\.email, subject: mail\.subject/.test(F));
  ok("🔴 the confirmation goes out as the business, replies to the business", /fromName: next\.name, replyTo: next\.email \|\| undefined/.test(F));
  const mail = B.bookingConfirmEmail(base(), r.booking);
  ok("the confirmation says what, when and where, and how to change it", /Full Detail \(\$199\)/.test(mail.html) && /Thursday, October 8 at 9:00 AM/.test(mail.html) && /123 Main St/.test(mail.html) && /tel:4805550100/.test(mail.html));
  ok("no emojis, no dashes, nothing about BoldLine in it", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(mail.html) && !/[—–]/.test(mail.html + mail.subject) && !/boldline/i.test(mail.html));
  ok("a customer's words are escaped in it", !B.bookingConfirmEmail(base(), { ...r.booking, address: "<script>x</script>" }).html.includes("<script>x"));
}

// 4. On the website
{
  const { renderSite, pagesFor, RESERVED_SLUGS } = await import("../netlify/lib/site-render.mjs");
  const on = base(), off = base({ booking: { on: false, packages: [PKG] } });
  ok("🔴 the Book page exists only when booking is on with a package", pagesFor(on).some((p) => p.id === "book") && !pagesFor(off).some((p) => p.id === "book"));
  ok("no extra page can take its address", RESERVED_SLUGS.includes("book"));
  for (const theme of ["cinematic", "aurora", "editorial"]) {
    const home = renderSite(on, "home", { base: "https://desertgloss.example", theme });
    const homeOff = renderSite(off, "home", { base: "https://desertgloss.example", theme });
    const book = renderSite(on, "book", { base: "https://desertgloss.example", theme });
    ok(`🔴 ${theme}: every main button goes to booking once it is on`, (home.match(/href="https:\/\/desertgloss\.example\/book\/" data-page="book" class="btn"/g) || []).length >= 3 && !/data-page="book"/.test(homeOff));
    ok(`${theme}: the main button says Book now`, />Book now</.test(home));
    ok(`🔴 ${theme}: the number is beside the button on a computer`, home.includes('<a class="hph" href="tel:4805550100">(480) 555-0100</a>'));
    ok(`${theme}: the Book page has the packages, the steps and a big call button`, /data-id="full" data-name="Full Detail"><b>Full Detail<\/b><span>\$199 · 3 hr<\/span>/.test(book)
      && /Service address<input class="bk-in" name="ad"/.test(book) && /<a class="btn ghost" href="tel:4805550100">Call \(480\) 555-0100<\/a>/.test(book));
    ok(`${theme}: Book stays out of the top bar (the button already goes there)`, !/<nav class="nav"[^]*?data-page="book"[^]*?<\/nav>/.test(book.slice(0, book.indexOf("</header>"))));
    ok(`${theme}: no emojis, no dashes, nothing pointing at BoldLine`, !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(book) && !/[—–]/.test(book.replace(/<script>[\s\S]*?<\/script>/g, "")) && !/boldline/i.test(book));
  }
  const S = src("netlify/lib/site-render.mjs");
  const W = await import("../netlify/lib/booking-widget.mjs");
  const script = W.bookingWidgetJS(base());
  ok("🔴 a preview never books: inside the OS (about:) or on a ?preview= link", script.includes("var BKP=String(location.href).indexOf('about:')===0||/[?&]preview=/.test(location.search)") && script.includes("if(BKP){bdone('Preview only. Nothing was booked.');return;}")
    && script.indexOf("if(BKP)") < script.indexOf("fetch('/book?token=TOKEN1',{method:'POST'"));
  ok("the shipped script carries no internal comments", !/\/\/ /.test(script.replace(/\/\^https:\//g, "")));
  ok("open times are asked for the chosen package only", script.includes("fetch('/book?token=TOKEN1&pkg='+encodeURIComponent(BS.pkg))"));
  ok("🔴 one booking widget for the website and the landing page, so they can never work differently", /import \{ bookingWidgetHTML, bookingWidgetJS, BOOKING_WIDGET_CSS \} from "\.\/booking-widget\.mjs";/.test(S)
    && /import \{ bookingWidgetHTML, bookingWidgetJS, BOOKING_WIDGET_CSS \} from "\.\.\/lib\/booking-widget\.mjs";/.test(src("netlify/functions/landing.mjs")));
  ok("the booking script only ships on the Book page of a site that takes bookings", S.includes('${C.bookOn && page === "book" ? `<script>${bookingWidgetJS(cl)}</script>` : ""}')
    && !renderSite(on, "home", { base: "https://desertgloss.example", theme: "aurora" }).includes("var BKP=") && !renderSite(off, "home", { base: "https://desertgloss.example", theme: "aurora" }).includes("var BKP="));
  ok("a token with odd characters cannot break out of the script", !W.bookingWidgetJS(base({ leadToken: "x');alert(1);('" })).includes("alert(1);('"));
}

// 4b. Every way a business takes customers (Bryson: "whatever booking system they have whether it is requesting
//     a quote ... or they do what I just described ... and any other possible ways to get clients")
{
  const { renderSite } = await import("../netlify/lib/site-render.mjs");
  const plain = base({ booking: {}, intake: undefined });
  const R = (cl) => renderSite(cl, "home", { base: "https://desertgloss.example", theme: "aurora" });
  ok("default: the quote form, as every site worked before", B.intakeOf(plain).how === "quote" && /href="https:\/\/desertgloss\.example\/contact\/" data-page="contact" class="btn"/.test(R(plain)));
  const link = base({ intake: { how: "link", link: "https://squareup.com/appointments/book/abc", linkLabel: "Book a detail" } });
  ok("🔴 their own booking system: every main button opens it, in a new tab", (R(link).match(/<a href="https:\/\/squareup\.com\/appointments\/book\/abc" class="btn" target="_blank" rel="noopener">/g) || []).length >= 3 && />Book a detail</.test(R(link)));
  ok("🔴 an address that is not https (or is a script) is never used; the quote form stands in", B.intakeOf(base({ intake: { how: "link", link: "javascript:alert(1)" } })).how === "quote" && B.intakeOf(base({ intake: { how: "link", link: "squareup.com/x" } })).how === "quote");
  const call = base({ intake: { how: "call" } });
  ok("🔴 call first: every main button calls them", (R(call).match(/<a href="tel:4805550100" class="btn">/g) || []).length >= 3 && />Call now</.test(R(call)));
  ok("call first with no phone number falls back to the quote form", B.intakeOf(base({ intake: { how: "call" }, businessPhone: "" })).how === "quote");
  ok("book chosen before any package exists falls back to the quote form", B.intakeOf(base({ intake: { how: "book" }, booking: { packages: [] } })).how === "quote");
  ok("the phone number shows whichever way is picked (not twice when the button already calls)", /class="hph"/.test(R(plain)) && /class="hph"/.test(R(link)) && !/class="hph"/.test(R(call)));
  ok("the quote form stays on the Contact page whatever is picked", ["quote", "book", "link", "call"].every((how) => /id="sf"/.test(renderSite(base({ intake: { how, link: "https://x.example/b" } }), "contact", { base: "https://desertgloss.example", theme: "aurora" }))));
  // The OS card shows the same outcome the site renders
  const a = UI.indexOf("const osIntake = "), b2 = UI.indexOf("function BookingCard(");
  const osI = new Function(`${UI.slice(a, b2)}\nreturn osIntake;`)();
  const cases = [plain, link, call, base(), base({ intake: { how: "book" }, booking: { packages: [] } }), base({ intake: { how: "link", link: "http://x.example" } }), base({ intake: { how: "call" }, businessPhone: "" })];
  ok("🔴 the OS card and the website agree on where the buttons go", cases.every((c) => osI(c).how === B.intakeOf(c).how && osI(c).wanted === B.intakeOf(c).wanted));
  ok("the agreement says this is never a round of changes", /It never counts as a round of changes and is never charged separately\./.test(src("netlify/lib/website-deal.mjs")));
}

// 5. Reachable
ok("/book reaches the OS endpoint", /from = "\/book"\n  to = "\/\.netlify\/functions\/book"\n  status = 200/.test(src("netlify.toml")));
ok("a client domain served by the OS lets /book through", /const PASS_PATHS = \["\/lead", "\/site-hit", "\/book"\];/.test(src("netlify/lib/client-domain.mjs")));
ok("🔴 the websites site has its own /book, passed to the OS", /export const config = \{ path: "\/book" \};/.test(src("sites/functions/book.mjs")) && /fetch\(`\$\{base\}\/book\$\{u\.search\}`/.test(src("sites/functions/book.mjs")));
ok("and it ships with that site", /"functions\/book\.mjs"\]/.test(src("sites/deps.mjs")));
ok("if the OS does not answer, the page says to call", /Online booking is down for a moment\. Please call us\./.test(src("sites/functions/book.mjs")));

// 6. In the OS
ok("🔴 the how-customers-book card is on every website's Website tab, clients and his own businesses", /\{tab==="website"&&<BookingCard client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
ok("🔴 it says changing it never counts as one of the client's website changes", /Changing this never counts as one of the client's website changes\./.test(UI));
ok("it says plainly where the buttons go while a choice is not ready yet", /Until then the buttons go to the quote form\./.test(UI));
ok("cancelling frees the time and reminds him to tell the customer", /status:"cancelled",cancelledAt:/.test(UI) && /This does not tell them, so call or text them yourself\./.test(UI));
{
  const a = UI.indexOf("const bkTzOffsetMin = "), b = UI.indexOf("const BK_DAYS = ");
  const os = new Function(`${UI.slice(a, b)}\nreturn { bkTzOffsetMin, bkZonedToUtc };`)();
  const same = [["2026-10-09", 480, "America/Phoenix"], ["2026-03-08", 150, "America/New_York"], ["2026-11-01", 90, "America/New_York"], ["2026-07-01", 600, "America/Los_Angeles"]]
    .every(([d, m, z]) => os.bkZonedToUtc(d, m, z) === B.zonedToUtc(d, m, z));
  ok("🔴 blocked time is turned into the same moments the server uses", same);
}

// 7. Deposits (Bryson, 2026-10-07: "do all those next", the second being a deposit at booking). The money goes to the
//    business's own payment page; BoldLine never holds it (CLAUDE.md hard constraint).
{
  const DEP = { ...PKG, deposit: "$50", depositLink: "https://buy.stripe.com/test_abc" };
  const cl = base({ booking: { on: true, packages: [DEP] } });
  const body = { packageId: "full", start: "2026-10-08T16:00:00Z", name: "Ana Ruiz", phone: "(480) 555-0199", email: "ana@x.example", address: "123 Main St, Gilbert" };
  const r = B.makeBooking(cl, body, NOW, "bk2");
  ok("🔴 a package with a deposit link records a deposit, not paid yet", r.booking && r.booking.deposit && r.booking.deposit.amount === "$50" && r.booking.deposit.link === "https://buy.stripe.com/test_abc" && r.booking.deposit.paid === false);
  ok("the lead says the deposit is not paid yet", /Deposit of \$50 not paid yet\./.test(r.lead.message));
  ok("no deposit link, no deposit", B.makeBooking(base(), body, NOW, "bk3").booking.deposit === null);
  ok("🔴 only an https payment page counts (a script or a bare domain is dropped)", B.bookingConfig(base({ booking: { on: true, packages: [{ ...DEP, depositLink: "javascript:alert(1)" }] } })).packages[0].depositLink === ""
    && B.bookingConfig(base({ booking: { on: true, packages: [{ ...DEP, depositLink: "buy.stripe.com/x" }] } })).packages[0].deposit === "");
  ok("🔴 the payment link never goes out with the open times, only after booking", !("depositLink" in B.publicBooking(cl).packages[0]) && B.publicBooking(cl).packages[0].deposit === "$50");
  const F = src("netlify/functions/book.mjs");
  ok("the booking answer hands the page the deposit to pay", /deposit: made\.booking\.deposit \? \{ amount: made\.booking\.deposit\.amount, link: made\.booking\.deposit\.link \} : null/.test(F));
  const mail = B.bookingConfirmEmail(cl, r.booking);
  ok("🔴 the confirmation carries a Pay the deposit button to the business's own page", mail.html.includes('href="https://buy.stripe.com/test_abc"') && />Pay the deposit</.test(mail.html) && /Pay the \$50 deposit to lock it in: https:\/\/buy\.stripe\.com\/test_abc/.test(mail.text));
  ok("Gmail's dark mode cannot turn that button invisible (a gradient keeps its colour)", /background-image:linear-gradient\(#111827,#111827\)/.test(mail.html));
  ok("no amount set still reads right", B.depositPhrase("") === "the deposit" && B.depositPhrase("$50") === "the $50 deposit" && !/Pay the  deposit|a deposit deposit/.test(B.bookingConfirmEmail(cl, { ...r.booking, deposit: { link: DEP.depositLink, amount: "" } }).text));
  ok("no emojis or dashes in the deposit wording", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(mail.html) && !/[—–]/.test(mail.html + mail.text));
  const W = await import("../netlify/lib/booking-widget.mjs");
  const js = W.bookingWidgetJS(cl);
  ok("🔴 the page shows the deposit button only for an https link it was handed", js.includes("if(dep&&dep.link&&/^https:/.test(dep.link))") && js.includes("a.className='bk-dep';a.href=dep.link;a.target='_blank';a.rel='noopener';"));
  ok("the package card says there is a deposit", W.bookingWidgetHTML(cl).includes("<span>$199 · 3 hr · $50 deposit</span>"));
  ok("🔴 the OS takes the deposit and the link per package, and says the money goes straight to the business", /placeholder="https:\/\/buy\.stripe\.com\/\.\.\."/.test(UI) && /The money goes straight to the business, never through BoldLine\./.test(UI)
    && /depositLink:bkHttps\(p\.depositLink\)\?String\(p\.depositLink\)\.trim\(\):""/.test(UI));
  ok("he can mark a deposit paid (the OS cannot see it land on the business's own page)", /const markPaid = \(bk,paid\) => onUpdate\(\{\.\.\.client, bookings:\(client\.bookings\|\|\[\]\)\.map\(x=>x\.id===bk\.id\?\{\.\.\.x,deposit:\{\.\.\.x\.deposit,paid,/.test(UI) && /"Mark unpaid":"Mark paid"/.test(UI));
}

// 8. The address question fits the business (a detailer goes to the car; a salon's customers come in)
{
  const W = await import("../netlify/lib/booking-widget.mjs");
  const body = { packageId: "full", start: "2026-10-08T16:00:00Z", name: "Ana", phone: "4805550199" };
  ok("the default asks for a service address, never a vehicle", W.bookingWidgetHTML(base()).includes(">Service address<input") && !/vehicle/i.test(W.bookingWidgetHTML(base())));
  ok("his own wording is used, escaped", W.bookingWidgetHTML(base({ booking: { on: true, packages: [PKG], addressLabel: "Where will the <car> be?" } })).includes(">Where will the &lt;car&gt; be?<input"));
  const walkIn = base({ booking: { on: true, packages: [PKG], askAddress: false } });
  ok("🔴 a business customers come to never asks for an address, and books without one", !W.bookingWidgetHTML(walkIn).includes('name="ad"') && W.bookingWidgetHTML(walkIn).includes("Your details")
    && !!B.makeBooking(walkIn, body, NOW, "w1").booking && !/Where/.test(B.bookingConfirmEmail(walkIn, B.makeBooking(walkIn, body, NOW, "w1").booking).text));
  ok("a business that goes to them still needs the address", /address/.test(B.makeBooking(base(), body, NOW).error));
  ok("the page copes with no address box", W.bookingWidgetJS(base()).includes("if(bf.ad&&!bf.ad.value.trim())") && W.bookingWidgetJS(base()).includes("address:bf.ad?bf.ad.value:''"));
  ok("the OS lets him switch it", /<option value="no">No, they come to us<\/option>/.test(UI) && /askAddress:b0\.askAddress!==false/.test(UI));
}

// 9. Landing pages follow "How customers book" (Bryson, 2026-10-07, the first of "do all those next")
{
  const { renderLandingPage } = await import("../netlify/functions/landing.mjs");
  const LP = { headline: "Mobile detailing that comes to you", subheadline: "Book in a minute", published: true };
  const page = (o = {}, design = {}) => renderLandingPage(base({ landingPage: { ...LP, design }, ...o }));
  const relHref = (h) => (h.match(/href="([^"]*)"/g) || []).map((x) => x.slice(6, -1)).filter((u) => !/^(https:|http:|tel:|mailto:|sms:|#)/.test(u));
  ok("not chosen: exactly the page it was (the quote form)", /id="lf"/.test(page()) && !/id="bk"/.test(page()) && /Get My Free Quote/.test(page()));
  for (const layout of ["split", "centered", "overlay", "capture"]) {
    const h = page({ intake: { how: "book" } }, { layout });
    ok(`🔴 ${layout}: book online puts the booking steps on the page in place of the form`, /id="bk"/.test(h) && !/id="lf"/.test(h) && (h.match(/id="lead-form"/g) || []).length === 1 && /href="#lead-form"/.test(h) && />Book now</.test(h));
    ok(`🔴 ${layout}: no relative link, nothing pointing at BoldLine, no emojis, no dashes`, relHref(h).length === 0 && !/boldline/i.test(h) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h)
      && !/[—–]/.test(h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")));
    ok(`🔴 ${layout}: a preview never books there either`, h.includes("var BKP=String(location.href).indexOf('about:')===0") && h.includes("if(BKP){bdone('Preview only. Nothing was booked.');return;}"));
  }
  const bk = page({ intake: { how: "book" } });
  ok("the number is right beside the booking steps for anyone who would rather call", /Rather call\? <a href="tel:4805550100">\(480\) 555-0100<\/a>/.test(bk));
  ok("🔴 the row of days never pushes the page sideways (it was 1,772px wide on a phone without this)", bk.includes(".form-g>*,#lead-form{min-width:0}"));
  ok("the closing copy matches booking", /Pick a package and a time, and it's booked\./.test(bk));
  const link = page({ intake: { how: "link", link: "https://squareup.com/appointments/book/abc", linkLabel: "Book a detail" } });
  ok("🔴 their own booking link: the main button goes there", link.includes('href="https://squareup.com/appointments/book/abc"') && />Book a detail</.test(link));
  const call = page({ intake: { how: "call" } });
  ok("🔴 call first: the main button calls them", /href="tel:4805550100"[^>]*>[^<]*Call now/.test(call) || (call.includes('href="tel:4805550100"') && />Call now</.test(call)));
  ok("a choice that cannot work yet keeps the quote form", /id="lf"/.test(page({ intake: { how: "book" }, booking: { on: true, packages: [] } })) && /id="lf"/.test(page({ intake: { how: "link", link: "javascript:alert(1)" } })));
  ok("🔴 a hand-off page keeps its client's own form", /id="lf"/.test(renderLandingPage(base({ landingPage: LP, intake: { how: "book" } }), { handoff: { domain: "quote.example.com" } })) && !/id="bk"/.test(renderLandingPage(base({ landingPage: LP, intake: { how: "book" } }), { handoff: { domain: "quote.example.com" } })));
  ok("a shop keeps its shop", !/id="bk"/.test(page({ intake: { how: "book" }, storeUrl: "https://shop.example.com" })));
  // The morning check must not call a booking page broken (KB daily-check: never cry wolf)
  const D = src("netlify/functions/daily-check.mjs");
  const cond = (D.match(/const hasForm = [\s\S]*?const hasPhone = .*?;/) || [])[0];
  const judge = cond && new Function("body", `const lp={body};${cond.replace(/lp\.body/g, "body")}return hasForm && hasPhone;`);
  ok("🔴 the morning page check passes a page that takes bookings", !!judge && judge(bk) && judge(page()) && !judge(bk.replace(/id="bk-phone"/g, "")));
}

// 10. Bookings on the OS Calendar and the morning digest (the third of "do all those next")
{
  const a = UI.indexOf("function buildCalendarEvents(");
  ok("🔴 the Calendar puts his own businesses' bookings on it, never a client's", a > 0 && /if \(isOwned\(c\)\) \{\n\s+const tz = \(c\.booking && c\.booking\.tz\) \|\| "America\/Phoenix";/.test(UI.slice(a, a + 2000)) && /kind:"booking", title:`\$\{b\.packageName\} · \$\{c\.name\}`/.test(UI));
  ok("cancelled bookings stay off it", /\(c\.bookings\|\|\[\]\)\.filter\(b=>b&&b\.status!=="cancelled"&&b\.start\)/.test(UI));
  ok("an unpaid deposit shows on the day", /b\.deposit&&!b\.deposit\.paid\?"deposit not paid yet":""/.test(UI));
  ok("the Calendar is handed his businesses as well as clients", /<CalendarScreen clients=\{\[\.\.\.realClients,\.\.\.myBusinesses\]\}/.test(UI));
  ok("bookings have their own colour and legend entry", /booking:"#F472B6" \}/.test(UI) && /\["Bookings","#F472B6"\]/.test(UI));
  const G = src("netlify/lib/calendar-digest-shared.mjs");
  ok("🔴 the morning digest lists today's bookings too", /import \{ isOwned \} from "\.\/owned\.mjs";/.test(G) && /if \(isOwned\(c\)\) \{[\s\S]{0,200}b\.status !== "cancelled"/.test(G) && /kind: "booking"/.test(G) && /booking:"#F472B6"/.test(G));
  ok("and the digest still skips the house account after that", G.indexOf("if (isOwned(c))") < G.indexOf("if (c.internal) return;"));
}

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-booking: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
