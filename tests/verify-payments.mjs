// A business's own customers paying it through the website we built (KB payments-connect). Bryson, 2026-10-09:
// "put in the client portal (or my own businesses portal) to be able to connect whatever method the client (or my
// businesses use) to collect payment".
//
// What has to stay true:
//  1. 🔴 The money is the business's. Every charge is made ON the business's own Stripe or Square account, never on
//     BoldLine's, and BoldLine takes no share (CLAUDE.md: the client pays for everything, BoldLine never holds it).
//  2. 🔴 A price that is not exact ("From $150") is never charged. Stripe's 50 cent minimum is respected.
//  3. 🔴 Paid status lives in a server-owned log, never inside `bookings`, so an OS screen opened before the customer
//     paid cannot write "not paid" back over it.
//  4. Pay links are signed per booking, live on the business's own domain once it has one, and a GET (a mail app
//     scanning the link) never creates a checkout or an order.
//  5. Connecting is the business's own approval on Stripe's or Square's page, with a signed, expiring state.
//     Square's keys are encrypted and kept out of the client record.
//  6. The portal card is the business's customers paying the business, not the business paying BoldLine, and the
//     OS's preview of the portal can never connect, save or disconnect.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

const P = await import("../netlify/lib/payments.mjs");
const BK = await import("../netlify/lib/booking.mjs");
const PP = await import("../netlify/lib/portal-payments.mjs");
const WD = await import("../netlify/lib/website-deal.mjs");

// ── 2. Amounts ───────────────────────────────────────────────────────────────────────────────
ok("$50 is 5000 cents", P.cents("$50") === 5000);
ok("$49.99 and $1,200 read exactly", P.cents("$49.99") === 4999 && P.cents("$1,200") === 120000 && P.cents("75") === 7500 && P.cents("$7.5") === 750);
ok("🔴 'From $150', '$150+' and ranges are never amounts", ["From $150", "$150+", "$100-$200", "$100 to $200", "call", "", "free"].every((v) => P.cents(v) === 0));
ok("money reads naturally", P.money(5000) === "$50" && P.money(4999) === "$49.99" && P.money(120000) === "$1,200");

// ── The choice and the connection ───────────────────────────────────────────────────────────────
const conn = { provider: "stripe", account: "acct_123", name: "Desert Gloss" };
ok("nothing chosen, nothing connected", P.payOf({}).method === "" && !P.payOf({}).connected);
ok("connecting IS choosing when nothing was picked", P.payOf({ payConnect: conn }).connected === "stripe" && P.payOf({ payConnect: conn }).method === "stripe");
ok("🔴 a connection does not charge once the business switched to a payment link", P.payOf({ payConnect: conn, payments: { method: "link" } }).connected === "");
ok("a link must be https", P.payOf({ payments: { method: "link", link: "javascript:alert(1)" } }).link === "" && P.payOf({ payments: { method: "link", link: "https://paypal.me/x" } }).link === "https://paypal.me/x");

const pkg = { id: "p1", name: "Full Detail", price: "$199", deposit: "$50", minutes: 180 };
const cl = { id: "c1", payConnect: conn, payments: { method: "stripe" } };
ok("connected: the package's deposit is charged", JSON.stringify(P.chargeFor(cl, pkg)) === JSON.stringify({ cents: 5000, kind: "deposit", label: "$50" }));
ok("connected, full price: the whole $199", P.chargeFor({ ...cl, payments: { method: "stripe", charge: "full" } }, pkg).cents === 19900);
ok("🔴 full price with a 'From $150' package charges nothing, not a guess", P.chargeFor({ ...cl, payments: { method: "stripe", charge: "full" } }, { ...pkg, price: "From $150", deposit: "" }) === null);
ok("full price falls back to the deposit when the price is not exact", P.chargeFor({ ...cl, payments: { method: "stripe", charge: "full" } }, { ...pkg, price: "From $150" }).cents === 5000);
ok("🔴 under Stripe's 50 cent minimum is never charged", P.chargeFor(cl, { ...pkg, deposit: "$0.25" }) === null);
ok("not connected: nothing is charged online", P.chargeFor({ payments: { method: "stripe" } }, pkg) === null);

// ── Several ways at once (Bryson, 2026-10-09: "the option to choose multiple ways") ─────────────────────
const multi = { payConnect: conn, payments: { card: "stripe", links: [{ url: "https://venmo.com/u/desertgloss" }, { label: "Zelle", url: "https://enroll.zellepay.com/x" }, { url: "https://www.paypal.me/dg" }, { url: "https://cash.app/$dg" }], inperson: true } };
const M = P.payOf(multi);
ok("🔴 card, links and in person can all be on together", M.connected === "stripe" && M.links.length === 3 && M.inperson === true && M.online);
ok("links are named for the customer when the business didn't name them", M.links[0].label === "Venmo" && M.links[1].label === "Zelle" && M.links[2].label === "PayPal");
ok("at most three links", M.links.length === P.MAX_LINKS && P.MAX_LINKS === 3);
ok("links only (no card account): customers still pay online, by link", P.payOf({ payments: { card: "", links: [{ url: "https://paypal.me/x" }] } }).online && !P.payOf({ payments: { card: "", links: [{ url: "https://paypal.me/x" }] } }).connected);
ok("🔴 card ticked but not connected yet is not a way to pay", !P.payOf({ payments: { card: "square" } }).connected && !P.payOf({ payments: { card: "square" } }).online);
ok("🔴 in person alone asks for nothing online", P.payAmountFor({ payments: { inperson: true } }, pkg) === null);
ok("links only: the deposit is still asked for, by link", P.payAmountFor({ payments: { links: [{ url: "https://paypal.me/x" }] } }, pkg).cents === 5000);
ok("unticking the card stops card charges even with an account connected", P.payOf({ payConnect: conn, payments: { card: "", links: [], inperson: true } }).connected === "");
const cp = P.cleanPayments({ card: "stripe", links: [{ label: " Venmo ", url: "https://venmo.com/u/x" }, { url: "javascript:alert(1)" }, { url: "" }], inperson: true, charge: "full", method: "link" });
ok("🔴 the saved shape drops bad links and anything unknown", JSON.stringify(cp) === JSON.stringify({ card: "stripe", links: [{ label: "Venmo", url: "https://venmo.com/u/x" }], inperson: true, charge: "full" }));
ok("an old single choice is carried into the new shape when one part changes", JSON.stringify(P.cleanPayments({ card: "stripe" }, { method: "link", link: "https://paypal.me/x" }).links) === JSON.stringify([{ label: "PayPal", url: "https://paypal.me/x" }]));

// ── Bookings ─────────────────────────────────────────────────────────────────────────────────
const hours = [null, [480, 1020], [480, 1020], [480, 1020], [480, 1020], [480, 1020], [480, 1020]];
const biz = { id: "c1", name: "Desert Gloss", intake: { how: "book" }, payConnect: conn, payments: { method: "stripe" },
  booking: { on: true, tz: "America/Phoenix", hours: [[480, 1020], ...hours.slice(1)], leadHours: 0, packages: [pkg] } };
const cfg = BK.bookingConfig(biz);
ok("connected: the deposit amount is kept without a link", cfg.packages[0].deposit === "$50" && cfg.packages[0].depositLink === "");
ok("the booking page says what is paid", cfg.packages[0].payNote === "$50 deposit" && BK.bookingConfig({ ...biz, payments: { method: "stripe", charge: "full" } }).packages[0].payNote === "Paid when you book");
ok("not connected and no link: no deposit shown (nothing to pay it with)", BK.bookingConfig({ ...biz, payConnect: null, payments: {} }).packages[0].deposit === "");
ok("the public booking answer never carries a payment link", !("depositLink" in BK.publicBooking(biz).packages[0]));
const day = BK.bookingDays(biz, "p1").find((d) => d.slots && d.slots.length);
const slot = day && day.slots[0];
const made = slot && BK.makeBooking(biz, { packageId: "p1", start: slot.start, name: "Ana Ruiz", phone: "4805550100", address: "1 Main St" });
ok("a booking was made to test with", made && made.booking, made && made.error);
if (made && made.booking) {
  ok("🔴 the booking's deposit is charged through the business's own Stripe", made.booking.deposit.via === "stripe" && made.booking.deposit.amount === "$50" && made.booking.deposit.kind === "deposit" && made.booking.deposit.paid === false);
  ok("its lead note says the deposit is not paid yet", /Deposit of \$50 not paid yet/.test(made.lead.message));
  const full = BK.makeBooking({ ...biz, payments: { method: "stripe", charge: "full" } }, { packageId: "p1", start: slot.start, name: "Ana", phone: "1", address: "x" });
  ok("full price: the booking says payment, not deposit", full.booking.deposit.kind === "full" && full.booking.deposit.amount === "$199" && /Payment of \$199/.test(full.lead.message));
  const mail = BK.bookingConfirmEmail(biz, { ...made.booking, deposit: { ...made.booking.deposit, link: "https://x.example/pay?c=1" } });
  ok("the confirmation email has a Pay the deposit button", /Pay the deposit/.test(mail.html) && /Pay the \$50 deposit to lock it in/.test(mail.text));
  const fm = BK.bookingConfirmEmail(biz, { ...full.booking, deposit: { ...full.booking.deposit, link: "https://x.example/pay" } });
  ok("full price email says Pay now and the amount", /Pay now/.test(fm.html) && /Pay the \$199 to lock it in/.test(fm.text) && !/deposit/i.test(fm.text));
  ok("🔴 no dashes or emojis in what the customer reads", ![mail.text, fm.text].some((t) => /[\u2013\u2014]|\p{Extended_Pictographic}/u.test(t)));
}

// ── 3. Paid status ───────────────────────────────────────────────────────────────────────────
const b = { id: "b1", deposit: { amount: "$50", via: "stripe", paid: false } };
ok("not paid until the log says so", !P.depositPaid({ bookings: [b] }, b));
const paidCl = { bookings: [b], payLog: { b1: { provider: "stripe", status: "paid", paidAt: "2026-10-09T20:00:00Z" } } };
ok("🔴 paid when the server-owned log says paid", P.depositPaid(paidCl, b));
ok("withPayStatus marks it paid for the screens that read deposit.paid", P.withPayStatus(paidCl).bookings[0].deposit.paid === true && P.withPayStatus(paidCl).bookings[0].deposit.online === "stripe");
ok("an open checkout is not paid", !P.depositPaid({ payLog: { b1: { status: "open" } } }, b));
const big = Object.fromEntries(Array.from({ length: 320 }, (_, i) => [`b${i}`, { createdAt: new Date(2026, 0, 1, 0, i).toISOString() }]));
ok("the log keeps the newest 300", Object.keys(P.trimLog(big)).length === 300 && "b319" in P.trimLog(big) && !("b0" in P.trimLog(big)));
const UI = src("index.html");
ok("🔴 the OS never saves over the connection or the paid log", /const SERVER_OWNED_KEYS=\[[^\]]*"payConnect","payLog"\]/.test(UI));
ok("the OS booking list reads paid-online from the log and drops Mark unpaid for it", /const online = \(bk\) => \{ const e=\(client\.payLog\|\|\{\}\)\[bk\.id\]; return e&&e\.status==="paid"\?e:null; \};/.test(UI) && /\{bk\.deposit&&!online\(bk\)&&<button onClick=\{\(\)=>markPaid/.test(UI));
ok("the OS Calendar counts a deposit paid online as paid", /b\.deposit&&!b\.deposit\.paid&&!\(\(c\.payLog\|\|\{\}\)\[b\.id\]&&c\.payLog\[b\.id\]\.status==="paid"\)/.test(UI));
ok("the business portal shows online payments as paid", /const cl = withPayStatus\(row\.data\);/.test(src("netlify/functions/biz.mjs")));
ok("the reminder email asks for payment only when it is not paid online either", /!depositPaid\(cl, b\)/.test(src("netlify/lib/biz-email.mjs")));
const osPayFn = UI.slice(UI.indexOf("function osPayLabel("), UI.indexOf("function CustomerPayCard("));
const bkH = UI.match(/const bkHttps = [^\n]+/)[0];
let osPay; try { osPay = new Function(`${bkH}\n${osPayFn}; return osPay;`)(); } catch (e) {}
ok("the OS's copy of payOf agrees with the server's", !!osPay && [{}, { payConnect: conn }, { payConnect: conn, payments: { method: "link" } }, { payments: { method: "square", charge: "full" } }, { payments: { method: "link", link: "https://paypal.me/x" } }, multi,
  { payments: { card: "square", links: [{ label: "My Venmo", url: "https://venmo.com/u/z" }, { url: "http://bad" }] } }, { payConnect: conn, payments: { card: "", inperson: true } }]
  .every((c) => { const a = P.payOf(c), o = osPay(c); return ["method", "connected", "charge", "card", "inperson", "online", "link"].every((k) => a[k] === o[k]) && JSON.stringify(a.links) === JSON.stringify(o.links); }));

// ── 4. Pay links ─────────────────────────────────────────────────────────────────────────────
const key = "test-key";
const u = P.payUrl({ id: "c1" }, "b1", "https://os.example.com/", key);
ok("the pay link is signed per business and booking", u.startsWith("https://os.example.com/pay?c=c1&b=b1&s=") && P.payCheck(key, "c1", "b1", new URL(u).searchParams.get("s")));
ok("🔴 a signature for one booking does not open another", !P.payCheck(key, "c1", "b2", new URL(u).searchParams.get("s")) && !P.payCheck("", "c1", "b1", new URL(u).searchParams.get("s")));
ok("🔴 on the business's own domain once its website is live there", P.payBase({ websiteDeal: { domain: { live: true, host: "desertgloss.com" } } }, "https://os.example.com").startsWith("https://desertgloss.com"));
const PAY = src("netlify/functions/pay.mjs");
ok("🔴 a GET only shows the page; the checkout is made on POST", /if \(req\.method !== "POST"\) return page\(/.test(PAY) && PAY.indexOf('if (req.method !== "POST")') < PAY.indexOf("stripeCheckout(P.conn.account"));
ok("a cancelled booking is never charged, a paid one never twice", /bk\.status === "cancelled"\) return page/.test(PAY) && /if \(depositPaid\(cl, bk\)\) return page/.test(PAY));
ok("🔴 card switched off since booking: no card charge, the other ways still show", /const P = payOf\(cl\), provider = P\.connected;/.test(PAY) && /if \(!card\.length\) return page\(/.test(PAY) && PAY.indexOf("if (!card.length) return page(") < PAY.indexOf("stripeCheckout(P.conn.account"));
ok("🔴 every way the business takes payment is offered and the customer picks", /const ways = \[\.\.\.card, \.\.\.links\];/.test(PAY) && /label: `Pay with \$\{l\.label\}`/.test(PAY) && /Pick how you'd like to pay\./.test(PAY) && /You can also pay at the job\./.test(PAY));
ok("a business's own payment link opens in a new tab", /target="_blank" rel="noopener noreferrer"/.test(PAY));
ok("the pay page speaks for the business: no BoldLine, no emojis, no dashes", !/BoldLine/i.test(PAY.replace(/^\s*\/\/.*$/gm, "")) && !/[\u2013\u2014]|\p{Extended_Pictographic}/u.test(PAY.replace(/^\s*\/\/.*$/gm, "")));
ok("the websites site passes /pay through, redirect and all", /path: "\/pay"/.test(src("sites/functions/pay.mjs")) && /redirect: "manual"/.test(src("sites/functions/pay.mjs")) && /functions\/pay\.mjs/.test(src("sites/deps.mjs")));
ok("a client domain served by the OS lets /pay through", /"\/optout", "\/pay"\]/.test(src("netlify/lib/client-domain.mjs")));
ok("the OS routes /pay and /pay-connect/done", /from = "\/pay"\s+to = "\/\.netlify\/functions\/pay"/.test(src("netlify.toml")) && /from = "\/pay-connect\/done"/.test(src("netlify.toml")));
ok("a sweep every 15 minutes catches payments whose page was closed early", /\[functions\."pay-sweep"\]\s+schedule = "4,19,34,49 \* \* \* \*"/.test(src("netlify.toml")));
const BOOK = src("netlify/functions/book.mjs");
ok("a new booking charged online gets its pay link", /if \(made\.booking\.deposit && made\.booking\.deposit\.pay\) made\.booking\.deposit\.link = payUrl\(/.test(BOOK));

// ── 1. The money is the business's ───────────────────────────────────────────────────────────
const API = src("netlify/lib/payments-api.mjs");
ok("🔴 Stripe checkouts are made ON the connected account (Stripe-Account header)", /stripeCheckout\(account,[\s\S]{0,120}stripeCall\("checkout\/sessions", \{ \.\.\.opts, account,/.test(API) && /"stripe-account": account/.test(API));
ok("🔴 no BoldLine cut: no application fee, no transfer to BoldLine", !/application_fee|transfer_data|on_behalf_of|destination/.test(API));
ok("🔴 Square links are made with the business's own key at its own location", /squareCall\("\/v2\/online-checkout\/payment-links", \{ \.\.\.opts, method: "POST", token: tokens\.access/.test(API));
ok("the website agreement says so (WA-5)", WD.AGREEMENT_VERSION === "WA-5" && /Every such payment goes straight from the customer to Client&rsquo;s own account/.test(src("netlify/lib/website-deal.mjs")) && /BoldLine never receives, holds or handles that money, takes no share of it/.test(src("netlify/lib/website-deal.mjs")));

// ── 5. Connecting ────────────────────────────────────────────────────────────────────────────
const st = P.makeState(key, { clientId: "c1", provider: "square", from: "portal" });
ok("the state reads back", JSON.stringify(P.readState(key, st)) === JSON.stringify({ clientId: "c1", provider: "square", from: "portal" }));
ok("🔴 a changed state is refused", P.readState(key, st.replace(/^./, (c) => (c === "e" ? "f" : "e"))) === null && P.readState("other", st) === null);
ok("🔴 an old state is refused (30 minutes)", P.readState(key, st, Date.now() + 31 * 60000) === null);
const env = { STRIPE_CONNECT_CLIENT_ID: "ca_test", STRIPE_SECRET_KEY: "sk", SQUARE_APP_ID: "sq0", SQUARE_APP_SECRET: "sec", SUPABASE_SERVICE_ROLE_KEY: "srv" };
ok("Stripe's own approval page, Standard read_write", P.authorizeUrl("stripe", { state: st, redirectUri: "https://os.example.com/pay-connect/done", env }).startsWith("https://connect.stripe.com/oauth/authorize?response_type=code&client_id=ca_test&scope=read_write&redirect_uri="));
ok("Square's own approval page with only the payment and order permissions", /^https:\/\/connect\.squareup\.com\/oauth2\/authorize\?client_id=sq0&scope=MERCHANT_PROFILE_READ\+PAYMENTS_READ\+PAYMENTS_WRITE\+ORDERS_READ\+ORDERS_WRITE&session=false/.test(P.authorizeUrl("square", { state: st, redirectUri: "x", env })));
ok("sandbox Square when asked", P.squareHost({ SQUARE_ENV: "sandbox" }) === "https://connect.squareupsandbox.com");
ok("a provider is offered only once BoldLine has switched it on", JSON.stringify(P.providersReady({})) === JSON.stringify({ stripe: false, square: false }) && P.providersReady(env).stripe && P.providersReady(env).square);
const sealed = P.seal({ access: "EAAA-secret", refresh: "r" }, env);
ok("🔴 Square keys are encrypted at rest", !sealed.includes("EAAA") && P.unseal(sealed, env).access === "EAAA-secret" && P.unseal(sealed, { ...env, SQUARE_APP_SECRET: "other" }) === null);
ok("🔴 and kept in private storage, not the client record", P.SECRET_BUCKET === "client-contracts" && /saveSquare\(db, row\.id, r\.tokens\)/.test(src("netlify/functions/pay-connect-done.mjs")) && !/tokens:/.test(src("netlify/functions/pay-connect-done.mjs").match(/payConnect: \{[^}]*\}/)[0]));
const PC = src("netlify/functions/pay-connect.mjs");
ok("the portal's save only ever writes the choice, in the several-ways shape", /if \(body\.action === "save" && from === "portal"\)/.test(PC) && /const next = cleanPayments\(\{ card: body\.card, links: body\.links, inperson: body\.inperson === true, charge: body\.charge \}\);/.test(PC) && /await write\(\(d\) => \(\{ \.\.\.d, payments: next \}\)\);/.test(PC));
ok("connecting a card keeps the business's payment links and in person", /const payments = cleanPayments\(\{ card: st\.provider \}, d\.payments \|\| \{\}\);/.test(src("netlify/functions/pay-connect-done.mjs")));
ok("connecting a new account lets go of the old one", /A different account connected before is let go first/.test(src("netlify/functions/pay-connect-done.mjs")));

// ── 6. The portal card ───────────────────────────────────────────────────────────────────────
const card = PP.customerPayCardHTML({ payConnect: conn, payments: { card: "stripe", links: [{ url: "https://venmo.com/u/x" }], inperson: true } }, { stripe: true, square: false });
ok("the card is about the business's own customers", /How Your Customers Pay You/.test(card) && /goes straight to you\. We never touch it\./.test(card));
ok("connected shows who, and a disconnect", /Connected: Desert Gloss/.test(card) && /blPayDisconnect\(this\)/.test(card));
ok("a provider BoldLine has not switched on is not offered to the client", !/data-m="square"/.test(card) && /data-m="stripe"/.test(card));
ok("🔴 the client ticks several ways at once", (card.match(/type="checkbox" class="cp-cb"/g) || []).length === 3 && /data-m="stripe" checked/.test(card) && /data-m="links" checked/.test(card) && /data-m="inperson" checked/.test(card));
ok("their payment link is filled in, with room for up to three", /value="https:\/\/venmo\.com\/u\/x"/.test(card) && /rows\.length>=3/.test(PP.CUSTOMER_PAY_JS));
ok("one card account at a time: ticking one unticks the other, and says so", /One card account at a time, so the other one was unticked\./.test(PP.CUSTOMER_PAY_JS));
ok("🔴 no emojis or dashes in the card", !/[\u2013\u2014]|\p{Extended_Pictographic}/u.test(card));
ok("🔴 every button in the OS's preview of the portal does nothing", ["blPayConnect", "blPaySave", "blPayDisconnect"].every((f) => new RegExp(`function ${f}\\([^)]*\\)\\{if\\(BL_PREVIEW\\)\\{blPayNote\\('Preview only`).test(PP.CUSTOMER_PAY_JS)));
const PORTAL = src("netlify/functions/portal.mjs");
ok("the portal shows it with the website, or under Your Information for a booking-only business", /\$\{webHTML\}\$\{custPay\}<\/div>/.test(PORTAL) && /\+ \(webHTML \? "" : custPay\)/.test(PORTAL) && /hasWebsite\(cl\) \|\| bookingOn\(cl\) \? customerPayCardHTML/.test(PORTAL));
ok("back from Stripe or Square, the portal says what happened", /notice === "pay-connected"/.test(PORTAL) && /"pay-" \+ event\.queryStringParameters\.pay/.test(PORTAL));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-payments: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
