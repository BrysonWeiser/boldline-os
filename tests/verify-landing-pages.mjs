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
    const drifted = (cl, pg) => ({ ...cl, landingSlug: pg.slug, landingPage: pg.page,
      brandColor: "#c8a84b", brandTheme: "dark",
      campaignSetup: { ...(cl.campaignSetup || {}), smsConsent: false },
      landingVariants: [] });
    assert.notDeepEqual(drifted(account, page), clientForPage(account, page),
      "keeping the writer's design would have compared equal, so this proves nothing");
  });

  // ── 7. 🔴 EACH PAGE IS ITS OWN PAGE ────────────────────────────────────────
  t("🔴 two audience pages do not share a layout, even when the writer picks one for them", () => {
    // Bryson: "it looks exactly like the landing page for stencil & thread ... no matter what
    // each landing page should not just be a copy and paste they should be unique."
    // `designConfig` prefers `landingPage.design`, and a model asked the same question returns
    // the same answer, so every page came out split/glowgrid/up/cards/modern/rounded/a.
    // Identical furniture, different words. Dropping `design` hands all seven choices to a
    // seed derived from the page's own slug.
    const same = { layout:"split", background:"glowgrid", motion:"up", benefits:"cards",
      font:"modern", shape:"rounded", order:"a" };
    const house = { name:"BoldLine", landingSlug:"boldline", landingPage:{ headline:"m" } };
    const seen = new Set();
    for (const slug of ["roofers","car-detailers","med-spas","plumbers","hvac","dentists"]) {
      const p = newPage({ label: slug, slug, page: { headline: slug, design: same } });
      seen.add(JSON.stringify(designConfig(clientForPage(house, p))));
    }
    assert.ok(seen.size >= 5, `six audiences produced only ${seen.size} distinct layouts`);
  });

  t("the same page is still the same page every time it is served", () => {
    // Varied, not random. A page whose furniture moved between two visits would be a bug.
    const house = { name:"BoldLine", landingSlug:"boldline", landingPage:{} };
    const p = newPage({ label:"Roofers", slug:"roofers", page:{ headline:"R" } });
    assert.equal(JSON.stringify(designConfig(clientForPage(house, p))),
      JSON.stringify(designConfig(clientForPage(house, p))));
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
