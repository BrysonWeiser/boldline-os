// Several landing pages on one account, and the address they answer at.
//
// Bryson, 2026-09-15: *"i want to run an ad targeting car detailers i want to have a landing page
// that fits that ad ... and then I also want the ability to run a seperate ad lets say for roofers
// and have a landing page that fits that ad"*.
import { readFileSync } from "node:fs";
import assert from "node:assert";
import { renderLandingPage, landingTheme, designConfig } from "../netlify/functions/landing.mjs";
import { pageSlug, freeSlug, findPage, listPages, clientForPage, newPage, publicUrlFor, slugsTaken }
  from "../netlify/lib/landing-pages-shared.mjs";

let pass = 0; const fails = [];
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fails.push(`${name} — ${e.message}`); } };
const osToml = readFileSync(new URL("../netlify.toml", import.meta.url), "utf8");
const siteToml = readFileSync(new URL("../marketing-site/netlify.toml", import.meta.url), "utf8");
const landing = readFileSync(new URL("../netlify/functions/landing.mjs", import.meta.url), "utf8");

const ACCOUNT = {
  id: "house", internal: true, name: "BoldLine Media", landingSlug: "boldline", leadToken: "TOK",
  businessPhone: "(602) 555-0100", campaignSetup: { serviceArea: "Phoenix, AZ" },
  landingPage: { headline: "Ads that pay for themselves", subheadline: "S", ctaText: "Book a call", published: true },
  landingPages: [
    newPage({ label: "Car Detailers", slug: "car-detailers",
      page: { headline: "More detailing jobs, booked", subheadline: "For detailers", ctaText: "Get my plan",
        bullets: ["Calls, not clicks"], published: true } }),
    newPage({ label: "Roofers", slug: "roofers",
      page: { headline: "Roofing leads that answer", subheadline: "For roofers", ctaText: "Get my plan",
        bullets: ["Storm season ready"], published: true } }),
  ],
};

// ── 1. Addresses cannot collide ─────────────────────────────────────────────
t("a name becomes a usable address", () => {
  assert.equal(pageSlug("Car Detailers & Valeting!"), "car-detailers-and-valeting");
  assert.equal(pageSlug("   Roofers   "), "roofers");
});

t("🔴 a second page cannot take an address that is already answering", () => {
  // Two pages on one address is a coin flip over which one a paid click lands on, and the
  // loser is invisible: live, listed in the OS, and never visited.
  assert.equal(freeSlug(ACCOUNT, "Roofers"), "roofers-2");
  assert.equal(freeSlug(ACCOUNT, "Car Detailers"), "car-detailers-2");
});

t("🔴 and it cannot take the account's own address either", () => {
  assert.equal(freeSlug(ACCOUNT, "BoldLine"), "boldline-2",
    "the main page would be shadowed by an audience page and nobody would know which won");
  assert.ok(slugsTaken(ACCOUNT).has("boldline"));
});

t("renaming a page keeps its own address available to itself", () => {
  const id = ACCOUNT.landingPages[1].id;
  assert.equal(freeSlug(ACCOUNT, "Roofers", id), "roofers", "editing a page renamed it to roofers-2");
});

// ── 2. The right page renders ───────────────────────────────────────────────
t("each audience page renders its own words, through the real renderer", () => {
  for (const p of listPages(ACCOUNT)) {
    const html = renderLandingPage(clientForPage(ACCOUNT, p));
    assert.match(html, new RegExp(p.page.headline.slice(0, 18)), `${p.slug} rendered the wrong headline`);
    assert.ok(!html.includes("Ads that pay for themselves"),
      `${p.slug} rendered the ACCOUNT's main page instead of its own`);
  }
});

t("the account's own page is untouched by any of this", () => {
  assert.match(renderLandingPage(ACCOUNT), /Ads that pay for themselves/);
});

t("looking a page up is case-insensitive and misses cleanly", () => {
  assert.equal(findPage(ACCOUNT, "ROOFERS").slug, "roofers");
  assert.equal(findPage(ACCOUNT, "plumbers"), null);
  assert.equal(findPage(ACCOUNT, ""), null);
});

// ── 3. 🔴 THE PROXY, AND THE THING THAT SILENTLY BREAKS IT ──────────────────
t("the public address is on the marketing domain, not a netlify.app one", () => {
  assert.equal(publicUrlFor({ slug: "roofers" }), "https://boldlinemedia.com/for/roofers");
});

t("the marketing site proxies /for/ to the OS", () => {
  assert.match(siteToml, /from = "\/for\/:slug"/);
  assert.match(siteToml, /to = "https:\/\/boldlinemedia\.netlify\.app\/lp\/:slug"/);
  assert.match(siteToml, /from = "\/for\/:slug\/"/, "a trailing slash would 404");
});

t("🔴 and it proxies the lead endpoint, which is the one that gets forgotten", () => {
  // The form posts to a RELATIVE path. Served on boldlinemedia.com it posts THERE, where no
  // such thing exists, so every enquiry 404s while the ads keep spending and the visitor just
  // sees "something went wrong".
  assert.match(siteToml, /from = "\/lead"/);
  assert.match(siteToml, /to = "https:\/\/boldlinemedia\.netlify\.app\/lead"/);
});

t("the OS actually answers at /lead, or the proxy points at nothing", () => {
  assert.match(osToml, /from = "\/lead"\s*\n\s*to = "\/\.netlify\/functions\/lead-intake"\s*\n\s*status = 200/);
});

t("the form does not post to a Netlify-reserved path", () => {
  assert.ok(!/fetch\('\/\.netlify\/functions\/lead-intake/.test(landing),
    "/.netlify/* is reserved by Netlify and cannot be proxied from another site");
  assert.match(landing, /fetch\('\/lead\?token=/);
});

// 🔴 THE GENERAL GUARD, AND THE REASON THIS FILE EXISTS RATHER THAN A ONE-OFF CHECK.
// Any relative address on this page resolves against whatever domain is showing it. Today
// exactly one exists and it is proxied. A second one added later would work perfectly in
// testing on our own domain and fail only on the proxied address, where the money is.
t("🔴 a landing page uses exactly ONE relative address, and it is the proxied one", () => {
  const html = renderLandingPage(clientForPage(ACCOUNT, ACCOUNT.landingPages[0]));
  const rel = new Set();
  for (const m of html.matchAll(/(?:src|href|action)=["'](\/[^"']*)["']/g)) rel.add(m[1]);
  for (const m of html.matchAll(/fetch\(\s*['"`](\/[^'"`]*)['"`]/g)) rel.add(m[1]);
  const paths = [...rel].map((u) => u.split("?")[0]);
  assert.deepEqual([...new Set(paths)], ["/lead"],
    `every one of these must be proxied on the marketing domain or it 404s there: ${paths.join(", ")}`);
});

// ── 4. 🔴 THE PAGE SELLS TO THE TRADE, IT DOES NOT SELL THE TRADE ───────────
{
  const gen = readFileSync(new URL("../netlify/functions/generate-landing.mjs", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const card = ui.slice(ui.indexOf("function AudiencePagesCard"), ui.indexOf("function PageArchiveCard"));

  t("🔴 the card asks for an AUDIENCE, never a niche", () => {
    // Sending `niche: "Roofers"` to this generator writes a page advertising ROOFING to
    // homeowners. On Bryson's own domain, paid for by Bryson's own ads. The whole feature is
    // wrong in a way that reads fine until you notice who the page is talking to.
    assert.match(card, /audience:\s*p\.label/, "the card does not send an audience at all");
    assert.ok(!/niche:/.test(card), "the card sends a niche, which points the page the wrong way");
  });

  t("the generator only takes the audience route when it is given one", () => {
    assert.match(gen, /const audience = clip\(body\.audience, 100\);/);
    assert.match(gen, /const system = audience \? audienceSystem :/,
      "the two prompts are not selected by the audience being present");
  });

  t("🔴 an ordinary client page is untouched by this", () => {
    // The existing prompt must still be the one used with no audience, word for word.
    assert.match(gen, /You are writing the on-page copy for a single-page ad landing page for a local service business/);
    const aud = gen.slice(gen.indexOf("const audienceSystem"), gen.indexOf("const system = audience"));
    assert.ok(!/local service business/.test(aud),
      "the audience prompt still describes a local service business, so it points the wrong way");
  });

  t("🔴 the audience page may not invent proof, because there is none to invent", () => {
    const aud = gen.slice(gen.indexOf("const audienceSystem"), gen.indexOf("const system = audience"));
    assert.match(aud, /NEVER invent results, numbers, case studies, client names, testimonials/);
    assert.match(aud, /almost no track record/,
      "without the reason, this reads as a style note rather than a hard rule");
    assert.match(aud, /NEVER use a dash/, "the no-dash rule has to be on both prompts, not just one");
    // The colour is guaranteed in code. A prompt that still ASKS for it reads as though the
    // model decides, which is how the next person ends up debugging the wrong half.
    assert.match(aud, /applied in code, so do not set brandColor or theme/,
      "the prompt implies the writer controls the brand colour, which it does not");
  });

  t("the location lookup is skipped for an audience page", () => {
    assert.match(gen, /const cond = audience \? \{ block: "" \} :/,
      "it spends an external lookup on an empty service area");
  });

  // ── 5. The card itself ────────────────────────────────────────────────────
  t("the card is mounted, and only on Bryson's own account", () => {
    const at = ui.indexOf("<AudiencePagesCard client={client} onUpdate={onUpdate}/>");
    assert.ok(at > 0, "the card is written but never rendered");
    // 🔴 PROVED, NOT GUESSED AT BY LOOKING A FIXED NUMBER OF CHARACTERS BACK. The first
    // version of this checked a 2000-character window and failed because the branch was 2354
    // away, which would have been "fixed" by widening the window until it passed — a test
    // tuned to its answer. Instead: find the nearest `client.internal ? (` before the mount
    // and assert the else-arm has not opened in between. If the card ever moves to the other
    // side of the branch, a client's Assets tab starts offering to write pages that advertise
    // BoldLine, and this fails.
    const branch = ui.lastIndexOf("client.internal ? (", at);
    assert.ok(branch > 0, "there is no internal branch before the mount at all");
    const between = ui.slice(branch, at);
    assert.ok(!/\n\s*\) : \(/.test(between),
      "the else-arm opens before the card, so it renders for real clients too");
  });

  // 🔴 SCOPE, not just presence. Deal Prep shipped broken because handlers landed in the
  // neighbouring component and every grep still passed (KB `deal-prep-to-client`).
  t("🔴 every handler lives INSIDE the card, not in a neighbour", () => {
    for (const fn of ["const add = ", "const write = async", "const togglePublish", "const rename = ", "const remove = ", "const freeSlug = "]) {
      assert.ok(card.includes(fn), `${fn.trim()} is not inside AudiencePagesCard`);
    }
  });

  t("🔴 two pages cannot be given the same address, in the OS as well as the server", () => {
    assert.match(card, /if \(client\.landingSlug\) out\.add/,
      "the account's own address is not counted, so a page can shadow the main page");
    assert.match(card, /for \(let n=2;n<200;n\+\+\)/, "a clash is not resolved, it just collides");
  });

  t("deleting a page warns that ads pointing at it will break", () => {
    assert.match(card, /window\.confirm\(/);
    assert.match(card, /will stop working/, "it deletes a live address with no warning");
  });

  t("writing a page never puts it live", () => {
    // Publishing is its own button. A page that went live the moment it was written would put
    // unreviewed copy on the advertised address.
    assert.match(card, /published:\(x\.page&&x\.page\.published\)\|\|false/,
      "generating a page flips it live");
  });

  // ── 6. 🔴 BOLDLINE'S OWN BRANDING, NOT NOBODY'S ────────────────────────────
  t("🔴 an audience page renders in BoldLine's colours, not the shared fallback", () => {
    // Bryson: "they are matching stencil & threads branding". They carried no brand colour at
    // all, so `landingTheme` fell back to #4f6bed on a light page — the same fallback Stencil &
    // Thread's page lands on. His own ads pointed at a page that looked like another company's.
    const house = { name: "BoldLine Media", internal: true, landingSlug: "boldline",
      landingPage: { headline: "main" } };
    const th = landingTheme(clientForPage(house, ACCOUNT.landingPages[0]));
    assert.equal(th.brand, "#c8a84b", "an audience page is not in BoldLine gold");
    assert.equal(th.mode, "dark", "an audience page is not on BoldLine's dark ground");
    assert.notEqual(th.brand, "#4f6bed", "it is back on the fallback that caused this");
  });

  t("🔴 stamped in code, so it does not depend on the writer complying", () => {
    // The prompt also asks for gold on dark. A prompt is a request; this is the guarantee.
    const house = { name: "BoldLine", landingPage: {} };
    const ignored = { ...ACCOUNT.landingPages[0], page: { headline: "x", brandColor: "#ff0000", theme: "light" } };
    const th = landingTheme(clientForPage(house, ignored));
    assert.equal(th.brand, "#c8a84b", "a colour the model invented overrode BoldLine's own brand");
    assert.equal(th.mode, "dark");
  });

  t("a page may still carry its own colour if one is ever wanted", () => {
    const house = { name: "BoldLine", landingPage: {} };
    const th = landingTheme(clientForPage(house, { ...ACCOUNT.landingPages[0], brandColor: "#112233", theme: "light" }));
    assert.equal(th.brand, "#112233");
    assert.equal(th.mode, "light");
  });

  t("🔴 and a real client's page is untouched by any of it", () => {
    // `landingTheme`'s own rule is that a client page carries the CLIENT's colours and never
    // BoldLine's. That stays true; this is the inverse case, not a change to that one.
    assert.equal(landingTheme({ brandColor: "#4F5BD5", landingPage: { headline: "x" } }).brand, "#4f5bd5");
    assert.equal(landingTheme({ landingPage: { brandColor: "#0A7B54", headline: "x" } }).brand, "#0a7b54");
  });

  // 🔴 THE PREVIEW AND THE LIVE PAGE ARE BUILT THE SAME WAY, PROVED BY RUNNING BOTH.
  //
  // This has been wrong twice for one reason: the OS builds its own version of the page and
  // drifts from `clientForPage` a field at a time. First it missed the brand, so previews were
  // indigo-on-white while the live page was gold-on-dark. Then it missed `design` and the
  // consent flag, so every page previewed with identical furniture and a text-consent box the
  // live page no longer carries. Bryson only ever sees the preview, so both live fixes read to
  // him as no fix at all: *"the landing page still looks the same"*.
  //
  // Asserting the fields one by one is what allowed the second miss. So the OS's own mirror is
  // EXECUTED and deep-compared against the real thing. A field added to either and not the
  // other fails here, whatever it is.
  t("🔴 the OS preview is built exactly like the live page, field for field", () => {
    const src = (card.match(/const previewClient = \(cl,pg\) => \{[\s\S]*?\n  \};/) || [])[0];
    assert.ok(src, "the OS no longer has a preview builder to compare against");
    const previewClient = new Function(`${src} return previewClient;`)();

    const account = { id: "house", internal: true, name: "BoldLine Media", landingSlug: "boldline",
      leadToken: "TOK", brandColor: "#123456", brandTheme: "light",
      campaignSetup: { serviceArea: "US", smsConsentText: "filed wording" },
      landingPage: { headline: "the main page" } };
    const cases = [
      newPage({ label: "Roofers", slug: "roofers",
        page: { headline: "R", ctaText: "Go", published: true,
          design: { layout: "split", background: "glowgrid", motion: "up", benefits: "cards",
            font: "modern", shape: "rounded", order: "a" } } }),
      newPage({ label: "Detailers", slug: "car-detailers", page: { headline: "D" } }),
      { ...newPage({ label: "Custom", slug: "custom", page: { headline: "C" } }),
        brandColor: "#0a0a0a", theme: "light", variants: [{ id: "v1" }] },
    ];
    for (const page of cases) {
      assert.deepEqual(previewClient(account, page), clientForPage(account, page),
        `the OS preview and the live page disagree for "${page.slug}"`);
    }
  });

  t("and that comparison would actually notice a difference", () => {
    // A deepEqual that cannot fail is the same shape of nothing as the assertions it replaced.
    const account = { name: "X", campaignSetup: {}, landingPage: {} };
    const page = newPage({ label: "R", slug: "r", page: { headline: "R", design: { layout: "split" } } });
    // Drifted by forgetting the consent flag, which is exactly how the preview went wrong.
    const drifted = (cl, pg) => ({ ...cl, landingSlug: pg.slug, landingPage: pg.page,
      brandColor: "#c8a84b", brandTheme: "dark",
      campaignSetup: { ...(cl.campaignSetup || {}) },
      landingVariants: [] });
    assert.notDeepEqual(drifted(account, page), clientForPage(account, page),
      "a version missing the consent flag compared equal, so this comparison proves nothing");
  });

  // ── 7. 🔴 EACH PAGE IS ITS OWN PAGE ────────────────────────────────────────
  //
  // Bryson: *"it looks exactly like the landing page for stencil & thread ... they should be
  // unique."* An earlier attempt stripped `design` so a slug seed decided the layout. That was
  // the wrong lever: `generate-landing` already varies deliberately, and a page built from a
  // CHOSEN option carries the layout he picked, so stripping it discarded exactly that. The
  // design is kept; variety comes from asking for it properly.
  t("a page with no design of its own still differs by audience", () => {
    const house = { name: "BoldLine", landingSlug: "boldline", landingPage: { headline: "m" } };
    const seen = new Set();
    for (const slug of ["roofers", "car-detailers", "med-spas", "plumbers", "hvac", "dentists"]) {
      const p = newPage({ label: slug, slug, page: { headline: slug } });
      seen.add(JSON.stringify(designConfig(clientForPage(house, p))));
    }
    assert.ok(seen.size >= 5, `six audiences produced only ${seen.size} distinct layouts`);
  });

  t("🔴 a layout the page actually carries is respected, not thrown away", () => {
    // The three-options flow gives each option its own deliberate layout. Discarding it would
    // mean picking an option and not getting the one you picked.
    const house = { name: "BoldLine", landingSlug: "boldline", landingPage: {} };
    const chosen = { layout: "overlay", background: "mesh", motion: "alt", benefits: "numbered",
      font: "elegant", shape: "sharp", order: "d" };
    const p = newPage({ label: "Roofers", slug: "roofers", page: { headline: "R", design: chosen } });
    const got = designConfig(clientForPage(house, p));
    assert.equal(got.layout, "overlay");
    assert.equal(got.benefits, "numbered");
    assert.equal(got.order, "d");
  });

  t("🔴 the single write asks for variety instead of the same page again", () => {
    // Without a moving seed the model is asked an identical question every time and returns an
    // identical answer, which is the whole reason every page looked the same.
    assert.match(card, /seed:Date\.now\(\)/, "the write sends no seed, so every page is the same question");
    assert.match(card, /exclude:pages\.filter\(x=>x\.id!==p\.id\)/,
      "it does not tell the writer what the other pages already look like");
    assert.match(card, /layout:\(\(x\.page&&x\.page\.design\)\|\|\{\}\)\.layout/,
      "the exclusions carry no layout, so it can hand back the same one");
  });

  t("the same page is still the same page every time it is served", () => {
    const house = { name: "BoldLine", landingSlug: "boldline", landingPage: {} };
    const p = newPage({ label: "Roofers", slug: "roofers", page: { headline: "R" } });
    assert.equal(JSON.stringify(designConfig(clientForPage(house, p))),
      JSON.stringify(designConfig(clientForPage(house, p))));
  });

  // ── 7b. 🔴 THE THREE OPTIONS, ON HIS OWN ACCOUNT AT LAST ───────────────────
  t("🔴 the three-options card reaches audience pages", () => {
    // Bryson: *"what happened to what we made a while ago where we get 3 different versions of
    // the same landing page and I can choose one or modify them as i want"*. It was rendered as
    // `!client.internal && <LandingOptionsCard/>`, so he had never once had it on his own
    // account.
    assert.match(card, /<LandingOptionsCard audience=\{p\.label\}/,
      "the options card is still absent from audience pages");
    assert.match(card, /client=\{previewClient\(client,p\)\}/,
      "it is handed something other than the shim the preview uses, so it can disagree with it");
  });

  t("🔴 and it writes options FOR the trade, not ABOUT it", () => {
    const ui = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const opts = ui.slice(ui.indexOf("function LandingOptionsCard"), ui.indexOf("function LandingOptionsCard") + 3000);
    assert.match(opts, /\.\.\.\(audience\?\{audience\}:\{niche:client\.niche/,
      "the options card sends a niche even for an audience, which writes the opposite page");
  });

  t("choosing an option folds back into that page, not the account", () => {
    assert.match(card, /page:next\.landingPage\|\|x\.page, variants:next\.landingVariants\|\|x\.variants/,
      "the card's writes do not reach landingPages[], so choosing an option would be lost");
  });

  // ── 7c. 🔴 NOT A LOCAL SERVICE BUSINESS'S FURNITURE ────────────────────────
  //
  // Bryson: *"its still sort of using stuff from stencil & threads landing page such as the free
  // quotes with the checkmark, the very top of the page there is a bar that includes what it
  // is."* The eyebrow, trust row, chip row and announcement bar are built by the RENDERER from
  // strings written for a local service business. Two pages carrying all four read as the same
  // page however different the words between them, and choosing between written options could
  // never have touched any of it.
  const HOUSE = { id: "h", internal: true, name: "BoldLine Media", landingSlug: "boldline",
    leadToken: "T", campaignSetup: { serviceArea: "Phoenix, AZ", mainOffer: "Ads managed end to end" },
    landingPage: { headline: "main" } };
  const audHtml = (label) => renderLandingPage(clientForPage(HOUSE,
    newPage({ label, slug: label.toLowerCase().replace(/ /g, "-"),
      page: { headline: label, ctaText: "Get my plan", published: true } })));

  t("🔴 no quotes, no service area, no fast-response promise on BoldLine's pages", () => {
    const h = audHtml("Roofers");
    for (const phrase of ["Free quotes", "Free quote, no obligation", "Serving ", "Fast response"]) {
      assert.ok(!h.includes(phrase), `"${phrase}" is still on BoldLine's own page`);
    }
  });

  t("🔴 and no bar across the top carrying the account's sales line", () => {
    // `announce` is set to "" rather than left absent, because absent means "fall back to the
    // account's main offer", which is exactly the bar he pointed at.
    const h = audHtml("Roofers");
    assert.ok(!/class="ann"/.test(h), "the announcement bar is still there");
    assert.ok(!h.includes("Ads managed end to end"), "the account's main offer is printed on the page");
  });

  t("the furniture is keyed to the audience, so two pages do not say the same thing", () => {
    const chips = (h) => [...h.matchAll(/<div class="chip reveal"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1]);
    const eyebrow = (h) => (h.match(/<div class="eyebrow an">([^<]*)</) || [])[1];
    assert.equal(eyebrow(audHtml("Roofers")), "For roofers");
    assert.equal(eyebrow(audHtml("Car Detailers")), "For car detailers");
    assert.ok(chips(audHtml("Roofers"))[0].includes("roofers"));
    assert.ok(chips(audHtml("Car Detailers"))[0].includes("car detailers"));
  });

  t("a page that wrote its own furniture keeps it", () => {
    const p = newPage({ label: "Roofers", slug: "roofers",
      page: { headline: "R", ctaText: "Go", published: true,
        eyebrow: "Storm season", chips: ["Only chip"], trust: ["Only trust"], announce: "My bar" } });
    const h = renderLandingPage(clientForPage(HOUSE, p));
    assert.match(h, /Storm season/);
    assert.match(h, /Only chip/);
    assert.match(h, /class="ann"><b>My bar/);
  });

  t("🔴 and a real client's page still gets every bit of it", () => {
    // The defaults are unchanged when a page says nothing, so nothing about Stencil & Thread's
    // page moves. This is the assertion that makes the change safe to ship.
    const cli = { id: "c", name: "Stencil & Thread", landingSlug: "st", leadToken: "T",
      campaignSetup: { serviceArea: "Eugene, OR", mainOffer: "25+ piece orders" },
      landingPage: { headline: "S", ctaText: "Q", published: true } };
    const h = renderLandingPage(cli);
    assert.match(h, /Free quotes/);
    assert.match(h, /Free quote, no obligation/);
    assert.match(h, /Serving Eugene, OR/);
    assert.match(h, /class="ann"><b>25\+ piece orders/);
  });

  // ── 7d. 🔴 NOTHING IS SAID TWICE ───────────────────────────────────────────
  //
  // Bryson, 2026-09-15: *"also make sure information isnt listed twice."* True of every page
  // this renderer has ever produced: a client's town appeared in the trust row, again in the
  // chip row and again in the footer, and the audience pages repeated a benefit bullet in the
  // trust row and the same promise in both rows.
  const rowsOf = (h) => ({
    trust: [...((h.match(/<div class="trust an"[^>]*>([\s\S]*?)<\/div>/) || ["", ""])[1])
      .matchAll(/<b>([^<]*)<\/b>/g)].map((m) => m[1].trim()),
    chips: [...h.matchAll(/<div class="chip reveal"[^>]*>([^<]*)<\/div>/g)].map((m) => m[1].trim()),
    bullets: [...h.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1].trim()),
  });
  const norm = (t) => String(t).replace(/&#10003;|\u2713/g, " ").toLowerCase()
    .replace(/^\s*serving\s+/, "").replace(/[^a-z0-9]+/g, " ").trim();

  t("🔴 a client's town is not printed in two rows at once", () => {
    const h = renderLandingPage({ id: "c", name: "S&T", landingSlug: "st", leadToken: "T",
      callTrackingNumber: "(541) 555-0199", campaignSetup: { serviceArea: "Eugene, OR" },
      landingPage: { headline: "S", ctaText: "Q", published: true, bullets: ["Free digital proof"] } });
    const { trust, chips } = rowsOf(h);
    const both = trust.map(norm).filter((k) => chips.map(norm).includes(k));
    assert.deepEqual(both, [], `said in both rows: ${both.join(", ")}`);
    assert.ok(trust.map(norm).includes("eugene or"), "the town vanished entirely, which is the other failure");
  });

  t("🔴 nothing in either row repeats a benefit bullet", () => {
    const house = { id: "h", name: "BoldLine", landingSlug: "boldline", leadToken: "T",
      campaignSetup: {}, landingPage: { headline: "m" } };
    const h = renderLandingPage(clientForPage(house, newPage({ label: "Roofers", slug: "roofers",
      page: { headline: "R", ctaText: "Go", published: true,
        bullets: ["You keep your own ad account", "Calls tracked, not guessed at"] } })));
    const { trust, chips, bullets } = rowsOf(h);
    const keys = bullets.map(norm);
    for (const t2 of [...trust, ...chips]) {
      assert.ok(!keys.includes(norm(t2)), `"${t2}" is already a bullet on the same page`);
    }
    assert.ok(trust.length > 0 && chips.length > 0, "the de-dup emptied a row instead of trimming it");
  });

  t("🔴 and how-it-works is not a local service business's either", () => {
    const house = { id: "h", name: "BoldLine", landingSlug: "boldline", leadToken: "T",
      campaignSetup: {}, landingPage: { headline: "m" } };
    const h = renderLandingPage(clientForPage(house, newPage({ label: "Roofers", slug: "roofers",
      page: { headline: "R", ctaText: "Go", published: true } })));
    assert.ok(!/free quote/i.test(h), "BoldLine's page still offers a free quote somewhere");
    assert.match(h, /We build the plan and the page/);
  });

  t("the de-dup is too strict to drop a merely similar line", () => {
    // Dropping a line off a live client's page because it RESEMBLED another is worse than
    // printing one twice, so "Free quotes" and "Free quote, no obligation" both survive.
    const h = renderLandingPage({ id: "c", name: "S&T", landingSlug: "st", leadToken: "T",
      campaignSetup: { serviceArea: "Eugene, OR" },
      landingPage: { headline: "S", ctaText: "Q", published: true, bullets: ["x"] } });
    assert.match(h, /Free quotes/);
    assert.match(h, /Free quote, no obligation/);
  });

  t("🔴 no canned angle assumes the business gives quotes", () => {
    // The five angles are a fixed creative brief shared by every page. One of them said "Lead
    // with the specific OFFER or the free quote as the hook", which is a local service
    // business's assumption reaching every page written from that angle.
    const angles = readFileSync(new URL("../netlify/lib/landing-variants.mjs", import.meta.url), "utf8");
    const list = angles.slice(angles.indexOf("export const ANGLES"), angles.indexOf("export const angleFor"));
    assert.ok(!/free quote/i.test(list), "an angle still tells the writer to lead on a free quote");
  });

  // ── 8. 🔴 NO CONSENT BOX FOR MESSAGES THAT CANNOT BE SENT ──────────────────
  t("🔴 BoldLine's own page does not ask to text people", () => {
    // Bryson: "it even includes their text thing which we dont have yet." landing.mjs's own
    // rule is that the consent wording "is not ours to word, it is whatever that business
    // filed with the carriers". BoldLine has filed nothing and Twilio is still a free trial,
    // so the page was collecting a consent record under wording never registered, which is
    // worse than useless the day SMS does arrive.
    const house = { id:"h", name:"BoldLine Media", landingSlug:"boldline", leadToken:"T",
      campaignSetup:{ serviceArea:"US" }, landingPage:{ headline:"m" } };
    const html = renderLandingPage(clientForPage(house, ACCOUNT.landingPages[0]));
    assert.ok(!/<input type="checkbox" id="lf-sms"/.test(html), "the consent checkbox is still there");
    assert.ok(!/Msg frequency varies/.test(html), "the carrier wording is still on the page");
    // The submit script reads that box. With it gone the read must not throw, or the form dies.
    assert.match(html, /sc&&sc\.checked/, "the script would throw on the missing checkbox");
  });

  t("🔴 and a real client's page keeps theirs, untouched", () => {
    // Stencil & Thread filed that wording with the carriers. Removing it would be a
    // compliance regression on a paying client, so the flag is opt-OUT and undefined means
    // exactly what it meant before.
    const cli = { id:"c", name:"Stencil & Thread", landingSlug:"st", leadToken:"T",
      campaignSetup:{ serviceArea:"Eugene, OR" },
      landingPage:{ headline:"S", ctaText:"Q", published:true } };
    const html = renderLandingPage(cli);
    assert.match(html, /<input type="checkbox" id="lf-sms"/);
    assert.match(html, /Msg frequency varies/);
  });

  t("the address shown in the OS is the one that actually answers", () => {
    assert.match(card, /https:\/\/boldlinemedia\.com\/for\/\$\{p\.slug\}/);
  });
}

console.log(fails.length ? `✕ ${fails.length} failed, ${pass} passed\n  ` + fails.join("\n  ")
  : `✓ verify-landing-pages: ${pass} checks passed`);
process.exit(fails.length ? 1 : 0);
