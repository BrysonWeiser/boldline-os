// Where a lead came from, recorded at the door and readable on the card.
//
// Bryson, 2026-09-04, on BoldLine's first lead: *"I'm not sure where from yet though because
// the os ad analytics haven't updated"*, then *"make sure I get an alert on my phone as well
// when a new lead lands"*, then *"on the phone when I press the lead in the leads tab no
// information pops up"*.
//
// 🔴 THE AD NUMBERS WERE NEVER GOING TO ANSWER THE FIRST QUESTION, and waiting for them was
// the trap. Spend and clicks are totals for a campaign. They cannot say which click became
// this person. Only what the visitor's browser was carrying when they filled the form can,
// and the marketing site was throwing every bit of it away.
//
// 🔴 AND PRESSING A LEAD DID NOTHING because the card had no handler at all. Everything it
// knew was already printed, so a lead that left no message printed a name and a badge and
// looked empty, and pressing it to find out more was both the obvious thing to do and the
// one thing that did nothing.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const SITE = readFileSync(join(ROOT, "marketing-site/index.html"), "utf8");
const GET = readFileSync(join(ROOT, "marketing-site/get-started/index.html"), "utf8");
const CAP = readFileSync(join(ROOT, "marketing-site/attribution.js"), "utf8");
const AUDIT = readFileSync(join(ROOT, "marketing-site/netlify/functions/audit.mjs"), "utf8");
const RUN = readFileSync(join(ROOT, "netlify/lib/house-leads-run.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S);
let n = 0;
const t = (name, fn) => { fn(); n++; };

const LIB = await import("../netlify/lib/lead-origin.mjs");
const MERGE = await import("../netlify/lib/house-leads-merge.mjs");

// 🔴 THE BROWSER COPY, EXTRACTED AND RUN. index.html cannot import the lib, so there are two
// copies and they must agree. Every case below runs against BOTH.
const start = S.indexOf("const LO_CLICK_IDS = {");
assert.ok(start > 0, "the browser copy of the origin reader is gone");
const end = S.indexOf("const adPerfStats = (cl) => {", start);
assert.ok(end > start, "the browser copy's end anchor moved");
const BROWSER = new Function(S.slice(start, end) + "\nreturn { leadOrigin, originFields, LO_KEYS };")();
const both = (fn) => { fn(LIB, "server"); fn(BROWSER, "browser"); };

// ── 1. 🔴 WHICH AD, NOT JUST WHICH FORM ──────────────────────────────────────
t("🔴 a Facebook ad click is named as a Facebook ad, and counted as paid", () => {
  both((M, w) => {
    const o = M.leadOrigin({ payload: { fbclid: "IwAR123" } });
    assert.equal(o.label, "Facebook or Instagram ad", `[${w}] a Meta ad click is unattributed`);
    assert.equal(o.paid, true, `[${w}] a real ad click is not counted as paid`);
  });
});

t("Google's three click ids all count, including the two iPhones send instead", () => {
  // wbraid/gbraid are what Google sends when the browser blocks gclid, which is most
  // iPhone traffic. Reading only gclid loses roughly half the attribution.
  both((M, w) => {
    for (const k of ["gclid", "wbraid", "gbraid"]) {
      assert.equal(M.leadOrigin({ [k]: "x" }).label, "Google ad", `[${w}] ${k} is ignored`);
    }
  });
});

t("the campaign and the ad are named when we know them", () => {
  both((M, w) => {
    const o = M.leadOrigin({ payload: { fbclid: "x", utm_campaign: "roofer_leads_sept", utm_content: "no_shared_leads" } });
    assert.match(o.detail, /Roofer leads sept/, `[${w}] the campaign is unreadable or missing`);
    assert.match(o.detail, /No shared leads/, `[${w}] which ad it was is missing`);
    assert.ok(!/_/.test(o.detail), `[${w}] it reads like a database field, not a campaign: ${o.detail}`);
  });
});

t("a tagged link with no click id still reads correctly", () => {
  both((M, w) => {
    const paid = M.leadOrigin({ payload: { utm_source: "facebook", utm_medium: "cpc" } });
    assert.equal(paid.label, "Facebook or Instagram ad", `[${w}] a tagged paid link is not read as an ad`);
    assert.equal(paid.paid, true);
    const free = M.leadOrigin({ payload: { utm_source: "newsletter", utm_medium: "email" } });
    assert.equal(free.paid, false, `[${w}] an email link is being counted as ad spend`);
    assert.match(free.label, /Newsletter/i);
  });
});

// ── 2. 🔴 "PAID" IS A CLAIM ABOUT MONEY ──────────────────────────────────────
t("🔴 a Facebook REFERRER is not called an ad", () => {
  // Far more likely a tap on a post. Calling it an ad would quietly poison the cost per
  // lead on the My Ads screen, and a wrong number that looks right is worse than none.
  both((M, w) => {
    const o = M.leadOrigin({ payload: { referrer: "https://m.facebook.com/story" } });
    assert.equal(o.label, "Facebook", `[${w}] a referrer is being dressed up`);
    assert.equal(o.paid, false, `[${w}] 🔴 an organic visit is being counted as a paid click`);
  });
});

t("a search engine referrer is named as a search", () => {
  both((M, w) => {
    assert.equal(M.leadOrigin({ payload: { referrer: "https://www.google.com/search?q=x" } }).label, "Google search", `[${w}]`);
    assert.equal(M.leadOrigin({ payload: { referrer: "https://duckduckgo.com/" } }).label, "DuckDuckGo search", `[${w}]`);
  });
});

t("an unknown site is named by its own domain rather than guessed at", () => {
  both((M, w) => {
    assert.equal(M.leadOrigin({ payload: { referrer: "https://www.someforum.co.uk/thread/9" } }).label, "someforum.co.uk", `[${w}]`);
  });
});

t("someone who typed the address in is told apart from someone we lost", () => {
  both((M, w) => {
    const direct = M.leadOrigin({ payload: { landing_page: "/get-started" } });
    assert.match(direct.label, /Typed the address/, `[${w}] a direct visit reads as unrecorded`);
    assert.equal(direct.known, true);
    const nothing = M.leadOrigin({ payload: {} });
    assert.equal(nothing.known, false, `[${w}] a lead with nothing claims to know something`);
    assert.equal(nothing.label, "Not recorded");
  });
});

// ── 3. BOTH SHAPES, BECAUSE LEADS COME FROM TWO WORLDS ───────────────────────
t("🔴 the site's single JSON field is read, and so are a landing page's flat keys", () => {
  both((M, w) => {
    // BoldLine's own site: one declared field holding JSON (Netlify only records declared
    // fields). A client's landing page: flat keys, as lead-intake has stored since August.
    const blob = M.leadOrigin({ payload: { attribution: JSON.stringify({ gclid: "abc", utm_campaign: "spring" }) } });
    assert.equal(blob.label, "Google ad", `[${w}] the site's own leads are unattributed`);
    assert.match(blob.detail, /Spring/, `[${w}]`);
    const flat = M.leadOrigin({ gclid: "abc" });
    assert.equal(flat.label, "Google ad", `[${w}] a client landing-page lead lost its attribution`);
  });
});

t("🔴 a mirrored house lead keeps its origin, which the payload never travels with", () => {
  both((M, w) => {
    const o = M.leadOrigin({ origin: { fbclid: "x", utm_campaign: "leads" } });
    assert.equal(o.label, "Facebook or Instagram ad",
      `[${w}] the house account's copy of a lead cannot say where it came from`);
  });
});

t("🔴 broken JSON does not blank the card", () => {
  both((M, w) => {
    for (const bad of ["{not json", "", "null", "[]", 7]) {
      assert.doesNotThrow(() => M.leadOrigin({ payload: { attribution: bad } }), `[${w}] threw on ${bad}`);
    }
  });
});

t("malformed leads do not throw anywhere", () => {
  both((M, w) => {
    for (const l of [null, undefined, {}, { payload: "text" }, { payload: null }, { origin: 3 }]) {
      assert.doesNotThrow(() => M.leadOrigin(l), `[${w}] threw on ${JSON.stringify(l)}`);
    }
  });
});

// ── 4. THE SITE ACTUALLY RECORDS IT ──────────────────────────────────────────
t("🔴 EVERY lead form carries the field, or its leads stay unattributed forever", () => {
  const forms = [
    [SITE, 'name="contact"', "the homepage contact form"],
    [SITE, 'name="recommendation"', "the quiz email form"],
    [GET, 'name="get-started"', "the get-started form, which is where the ads land"],
  ];
  for (const [src, marker, label] of forms) {
    const i = src.indexOf(marker);
    assert.ok(i > 0, `${label} is gone`);
    const block = src.slice(i, src.indexOf("</form>", i));
    assert.match(block, /<input type="hidden" name="attribution" value="">/,
      `${label} does not collect where the visitor came from`);
  }
});

t("🔴 THE FIELD IS DECLARED IN THE HTML, NEVER CREATED BY SCRIPT", () => {
  // Netlify Forms only records fields present in the form's HTML. A hidden input added by
  // script at submit time is posted and then silently dropped, which looks exactly like
  // working code and is the obvious way to "improve" this.
  assert.ok(!/createElement\(\s*["']input/.test(CAP),
    "the capture script builds inputs, so Netlify will drop them without a word");
  assert.match(CAP, /form\.querySelector\('input\[name="attribution"\]'\)/,
    "it no longer fills a declared field");
  assert.match(CAP, /if \(!field\) return;/, "a form without the field is not left alone");
});

t("both pages load the capture script", () => {
  for (const [src, label] of [[SITE, "the homepage"], [GET, "the get-started page"]]) {
    assert.match(src, /<script src="\/attribution\.js" defer><\/script>/, `${label} never runs the capture`);
  }
});

t("🔴 first touch wins, unless this visit carries ad parameters", () => {
  // Click the ad, read for a while, come back tomorrow and fill the form: that lead belongs
  // to the ad. Click a NEW ad: it belongs to the new one.
  assert.match(CAP, /if \(stored && !hits\) return stored;/, "a later visit overwrites the ad that won the lead");
  assert.match(CAP, /hits\+\+/, "live ad parameters can never take over from a stored value");
});

t("a link from one page of the site to another is not called a referrer", () => {
  assert.match(CAP, /ref\.indexOf\(window\.location\.origin\) !== 0/,
    "every internal click would overwrite where they actually came from");
});

t("🔴 nothing in the capture can break a form", () => {
  // A lost attribution is a shame. A lost lead is the business.
  const tries = (CAP.match(/try \{/g) || []).length;
  assert.ok(tries >= 5, `only ${tries} guarded blocks: a throw here would take a submission with it`);
  assert.match(CAP, /catch \(e\) \{ \/\* private mode \*\/ \}/, "a browser with storage blocked would throw on write");
});

t("the free audit passes it on, through an allow list rather than a pass-through", () => {
  assert.match(SITE, /attribution:\(window\.blOrigin\?window\.blOrigin\(\):null\)/, "the homepage audit form drops it");
  assert.match(GET, /attribution:\(window\.blOrigin\?window\.blOrigin\(\):null\)/, "the get-started audit form drops it");
  assert.match(AUDIT, /attribution: pickOrigin\(body\.attribution\)/, "the endpoint stores nothing");
  assert.match(AUDIT, /const pickOrigin = \(v\) =>/, "a public endpoint copies whatever arrives onto a stored record");
});

// ── 5. THE MIRROR CARRIES IT, AND A NEW LEAD BUZZES HIS PHONE ────────────────
t("🔴 a mirrored lead keeps where it came from", () => {
  const row = { id: "1", created_at: "2026-09-04T18:00:00Z", form: "contact", name: "Dana", status: "new",
    payload: { attribution: JSON.stringify({ fbclid: "x", utm_campaign: "sept" }) } };
  const e = MERGE.toLeadEntry(row);
  assert.ok(e.origin && e.origin.fbclid === "x", "the mirror drops the attribution, so My Ads cannot show it");
  assert.equal(LIB.leadOrigin(e).label, "Facebook or Instagram ad");
});

t("🔴 the merge hands back WHO arrived, not just how many", () => {
  const rows = [{ id: "9", created_at: "2026-09-04T18:00:00Z", form: "contact", name: "Dana", status: "new" }];
  const r = MERGE.mergeHouseLeads([], rows, { limit: 1000 });
  assert.equal(r.added, 1);
  assert.equal((r.addedLeads || []).length, 1, "nothing can say which lead to announce");
  assert.equal(r.addedLeads[0].name, "Dana");
});

t("🔴 the phone alert fires only AFTER the lead is saved", () => {
  // If the push went first and the save then failed, the next run would see the same lead as
  // new and buzz him again for it, every fifteen minutes, forever.
  const save = RUN.indexOf('.from("clients")');
  const push = RUN.indexOf("sendPushToAll");
  assert.ok(save > 0 && push > save, "the alert is sent before the lead is stored, so it can repeat forever");
  assert.match(RUN, /if \(addedLeads\.length\) \{/, "the alert fires on every run rather than on a new lead");
});

t("the alert says who it is and where they came from", () => {
  assert.match(RUN, /title: `New lead: \$\{who\}`/, "the notification does not name the lead");
  assert.match(RUN, /o\.known \? `From \$\{o\.label\}\.` : null/, "it does not say which ad produced them");
});

t("🔴 a failed buzz never costs the mirror, and it is push only", () => {
  const i = RUN.indexOf("sendPushToAll");
  const block = RUN.slice(i - 900, i + 700);
  assert.match(block, /catch \(e\) \{/, "a push failure would take the whole sync down with it");
  // dispatchAlert would mean a second email and a text for one lead. The website already
  // emails him on every submission, and an alert he learns to ignore is worse than none.
  assert.ok(!/dispatchAlert\(\{[^}]*New lead/.test(RUN), "a new lead is routed through the full alert channel");
});

// ── 6. 🔴 PRESSING A LEAD DOES SOMETHING NOW ─────────────────────────────────
t("🔴 the card opens when he presses it", () => {
  assert.match(UI, /<button onClick=\{\(\)=>setOpen\(v=>!v\)\}/, "pressing a lead still does nothing");
  assert.match(UI, /const \[open,setOpen\]=useState\(false\);/, "there is no open state to toggle");
  assert.ok(!/\{false&&open&&/.test(UI), "the detail block is wired shut");
});

t("🔴 and what opens is EVERYTHING it holds, so 'no information' cannot recur", () => {
  assert.match(UI, /Everything we have/, "the detail block is gone");
  assert.match(UI, /\{open&&\(/, "the detail block never renders");
  assert.match(UI, /const extras = \(\(\)=>\{/, "only the fields somebody thought of are shown");
  // 🔴 Attribution keys are shown as a sentence, not dumped as raw keys he cannot read.
  assert.match(UI, /\.\.\.LO_KEYS\]\);/, "raw tracking codes are printed at him as extra rows");
});

t("where they came from is on the card itself, not only inside the detail", () => {
  assert.match(UI, /Came from<\/span>/, "he has to open every lead to learn the one thing he asked for");
  assert.match(UI, /origin\.paid&&<span/, "a paid click is not marked, so ad leads look like walk-ins");
  assert.match(UI, /const origin = leadOrigin\(lead\);/, "the card works it out somewhere else");
});

t("the house account's Leads tab says it too", () => {
  assert.match(UI, /\? <div style=\{\{fontSize:10,color:o\.paid\?C\.gold:C\.textMuted,marginTop:2\}\}>Came from \{o\.label\}/,
    "My Ads lists leads with no idea which ad produced them");
});

t("a lead from before the site recorded it says so plainly", () => {
  assert.match(S, /arrived before the website started recording where visitors come from/,
    "an old lead reads as a bug rather than as history");
});

console.log(`✓ verify-lead-origin: ${n} checks passed`);
