// Saved copies of a client's landing page, and the showcase rights that let us publish them.
//
// Bryson, 2026-09-04: *"have aria take screenshots of published landing pages... that way we
// can use it for content and case studies"*, then *"make sure there is a way for me to access
// the saved page and delete them when I want"*, and *"should we also add in future contracts
// that we are able to use any work we've done for content purposes... but will not sell
// information"*.
//
// 🔴 WHY THE PAGE AND NOT A SCREENSHOT. `landing.mjs` rebuilds every landing page from the
// database on every single request. There is no stored copy anywhere. That is why an edit
// goes live instantly, and it is also why the version that produced leads exists only until
// somebody edits the record. A screenshot is a low-resolution picture of that; the page is
// the thing, and an image can be made from it later.
//
// 🔴 AND WHY A SAVED PAGE IS DANGEROUS. A landing page is not an inert document. It carries a
// submit handler pointing at `lead-intake?token=<the client's REAL lead token>`. Save it
// verbatim, open it months later to show somebody, tap the form, and a REAL LEAD lands on
// that client's record and is forwarded to their CRM from a page nobody is running. That is
// the standing preview-safety rule, and this is the sharpest case of it in the codebase,
// because the archive also sits in a PUBLIC bucket.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
const FN = readFileSync(join(ROOT, "netlify/functions/page-archive.mjs"), "utf8");
const code = (src) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const UI = code(S), F = code(FN);
let n = 0;
// 🔴 AN ASYNC TEST BODY MUST NOT BE ABLE TO PASS BY DEFAULT. This was `fn(); n++;`, which
// calls an async body, throws its result away and counts it as a pass — a rejected assertion
// would surface as an unhandled rejection, or not at all. Every promise is now collected and
// awaited before the suite can report success, so a test whose `await` is forgotten at the
// call site still fails the run rather than quietly inflating the count.
const pending = [];
const t = (name, fn) => {
  const r = fn(); n++;
  if (r && typeof r.then === "function") {
    const p = r.catch((e) => { e.message = `${name}: ${e.message}`; throw e; });
    pending.push(p);
    return p;
  }
  return r;
};

const { neutraliseArchive, archiveEntry, ARCHIVE_BUCKET, isArchivePath, archiveViewUrl } = await import("../netlify/lib/page-archive-shared.mjs");
const { renderLandingPage } = await import("../netlify/functions/landing.mjs");

// A REAL page from the REAL renderer. Neutralising tested against a hand-written sample would
// only prove the sample was easy.
const CLIENT = {
  id: "c1", name: "Stencil & Thread", landingSlug: "st", leadToken: "REAL_LEAD_TOKEN_abc123",
  businessPhone: "(541) 555-0100",
  campaignSetup: { serviceArea: "Eugene, OR", bookingUrl: "https://calendly.com/x",
    privacyUrl: "https://stencilandthread.com/privacy.html", conversionId: "AW-123" },
  landingPage: { headline: "Custom shirts, fast.", subheadline: "25 pieces or more.",
    ctaText: "Get My Free Quote", published: true },
};
const LIVE = renderLandingPage(CLIENT);
const SAFE = neutraliseArchive(LIVE, archiveEntry({ headline: "Custom shirts, fast.", clientId: "c1" }));

// ── 1. 🔴 THE SAVED PAGE CANNOT DO ANYTHING ─────────────────────────────────
t("🔴 the live page really does carry the machinery, so this is not a theoretical risk", () => {
  assert.match(LIVE, /<script/i, "if the live page had no scripts, none of these checks mean anything");
  assert.ok(LIVE.includes("REAL_LEAD_TOKEN_abc123"), "the live page must carry the token for the test to be real");
});

t("🔴 no script survives into the archive", () => {
  assert.ok(!/<script/i.test(SAFE),
    "the submit handler, the click-id capture and the conversion tag all still fire, from a "
    + "page nobody is running");
});

t("🔴 THE LEAD TOKEN IS GONE FROM THE TEXT", () => {
  // The scripts are stripped, but the token lived inside one. This file lands in a PUBLIC
  // bucket: anyone holding it can post leads to that client for as long as it is valid.
  assert.ok(!SAFE.includes("REAL_LEAD_TOKEN_abc123"),
    "a public file carries a working lead token, so anyone with the link can create leads on "
    + "that client");
  // 🔴 AND THE SCRUB IS TESTED ON ITS OWN, not just through the script strip. Removing the
  // scrub line entirely still passed this, because the token happens to live inside a script
  // today. That makes it look redundant and invites deleting it. It is not redundant: one
  // odd script tag this stripper fails to match, or a token that ever appears in markup,
  // and the scrub is the only thing left. So it is exercised where the strip cannot help.
  const bare = neutraliseArchive(
    '<body><p>see /.netlify/functions/lead-intake?token=REAL_LEAD_TOKEN_abc123 here</p></body>',
    archiveEntry({ clientId: "c1" }));
  assert.ok(!bare.includes("REAL_LEAD_TOKEN_abc123"),
    "a token sitting in the markup rather than inside a script survives into a public file");
});

t("🔴 the form cannot be submitted, three ways over", () => {
  assert.ok(!/<form[^>]*\saction\s*=/i.test(SAFE), "the form still has somewhere to post to");
  assert.match(SAFE, /onsubmit="return false"/, "submitting is not blocked");
  assert.match(SAFE, /<fieldset disabled/, "the fields are still fillable, which invites the tap");
});

t("no inline handler survives", () => {
  assert.ok(!/\son(?:click|submit|change|load)\s*=\s*["'][^"']*[a-z(]/i.test(SAFE.replace(/onsubmit="return false"/g, "")),
    "an attribute handler is not a script tag and survives a script-only strip");
});

t("🔴 links do not go anywhere", () => {
  // A booking link still takes a real booking and a phone link still rings the client.
  assert.ok(!/<a[^>]*\shref\s*=/i.test(SAFE), "a saved page can still book a meeting or ring the client");
  assert.match(SAFE, /data-archived-href/, "the destination was destroyed rather than parked, so the record is incomplete");
});

// ── 2. But it still LOOKS like the page ─────────────────────────────────────
t("🔴 the visual record is intact, which is the entire point", () => {
  assert.ok(SAFE.includes("Custom shirts, fast."), "the headline is gone");
  assert.ok(SAFE.includes("Get My Free Quote"), "the call to action is gone");
  assert.match(SAFE, /<style/i, "the styling is gone, so the archive is not a record of how it looked");
  assert.ok(SAFE.length > LIVE.length * 0.5,
    "half the page vanished, which means the stripper is eating content and not just plumbing");
});

t("🔴 it says on the page that it is a saved copy", () => {
  // Pixel-identical to the live page otherwise. The first time somebody opens the wrong tab
  // they will believe it is live and act on it.
  assert.match(SAFE, /Saved copy/, "nothing distinguishes it from the live site");
  assert.match(SAFE, /Nothing on this page works/, "it does not say the page is inert");
});

t("the banner survives a page with no body tag", () => {
  const odd = neutraliseArchive("<div>hello</div>", archiveEntry({ clientId: "c1" }));
  assert.match(odd, /Saved copy/, "a malformed page silently loses its warning");
});

// ── 3. Naming and storage ───────────────────────────────────────────────────
t("each saved page is named by something he would recognise", () => {
  const e = archiveEntry({ headline: "Custom shirts, fast.", clientId: "c1" });
  assert.equal(e.label, "Custom shirts, fast.", "a list of identical timestamps cannot be chosen from");
  assert.match(e.path, /^c1\//, "archives are not filed under their client");
  assert.match(e.id, /^\d{4}-\d{2}-\d{2}-/, "the id carries no date, so storage cannot be read by eye");
});

t("two saves in the same second do not collide", () => {
  const a = archiveEntry({ clientId: "c1" }), b = archiveEntry({ clientId: "c1" });
  assert.notEqual(a.id, b.id, "a same-second save would overwrite the earlier one");
});

// ── 4. 🔴 DELETING, which Bryson asked for in the same breath ───────────────
t("🔴 the file is removed BEFORE the record", () => {
  // Clearing the record first and failing on the file leaves a page in a public bucket with
  // nothing in the OS pointing at it: the one outcome nobody can find again to fix.
  const i = F.indexOf('action === "delete"');
  assert.ok(i > 0, "there is no delete path at all");
  const body = F.slice(i, F.indexOf("// ── SAVE", i));
  assert.ok(body.indexOf(".remove([hit.path])") < body.indexOf('.update({ data: next })'),
    "the record is cleared first, so a failed file delete strands a public page forever");
});

t("a failed save does not strand a file either", () => {
  assert.match(F, /remove\(\[entry\.path\]\)\.catch/, "a written file with no record is an orphan nobody can reach");
});

t("deleting something already gone says so instead of pretending", () => {
  assert.match(FN, /That saved page is not there any more/);
});

// ── 5. Reachable, and only by the owner ─────────────────────────────────────
t("it is behind the owner's login and refuses anything but a POST", () => {
  assert.match(F, /auth\.getUser\(jwt\)/, "anyone on the internet can archive or delete a client's pages");
  assert.match(F, /Method not allowed/);
});

t("🔴 nothing is saved from an unpublished page", () => {
  assert.match(FN, /The page has to be published first/,
    "archiving a draft stores a Coming Soon placeholder as though it were the client's page");
});

t("the card is rendered, and can save, view and delete", () => {
  assert.match(UI, /function PageArchiveCard\(\{client,onUpdate\}\)/, "the card does not exist");
  assert.match(UI, /<PageArchiveCard client=\{client\} onUpdate=\{onUpdate\}\/>/, "the card is never rendered");
  assert.match(S, /Save how it looks now/);
  assert.match(UI, /action:"delete", archiveId: a\.id/, "there is no way to delete one");
  // 🔴 Pin the GATE, not the word. `/window.confirm/` passed with the call behind `false&&`,
  // because the text was still in the file. Checking a line exists is not checking it runs.
  assert.match(UI, /if \(!window\.confirm\(/,
    "deleting is irreversible and nothing keeps another copy, so it must ask first");
});

// ── 5b. 🔴 SEEING IT AT THE SIZE PEOPLE SEE IT ──────────────────────────────
// Bryson chose this over a paid screenshot service and over a card generator: with one
// client, what he needs is to open a saved page at phone width and screenshot it himself.
// A real screenshot, no new service, no credential, no monthly fee.
t("🔴 the phone view exists and is reachable from the row", () => {
  assert.match(UI, /const wrapperHTML = \(a\) =>/, "there is no framed viewer");
  assert.match(UI, /onClick=\{\(\)=>openFramed\(a\)\}/, "the viewer is never reachable");
  assert.match(S, /Phone view/, "the button has no label he would recognise");
});

t("🔴 it opens at PHONE width by default", () => {
  // Opening at desktop width and asking him to switch defeats the point: the screenshot he
  // wants is the one people actually see.
  assert.match(UI, /iframe\{[^}]*width:390px/, "the frame does not start at phone width");
  assert.match(UI, /id=\\"w1\\" checked/, "phone is not the selected size on open");
});

t("and tablet and desktop are one tap away", () => {
  assert.match(UI, /#w2:checked~\.stage iframe\{width:768px\}#w3:checked~\.stage iframe\{width:1280px\}/,
    "the other widths are advertised but do nothing");
});

t("🔴 THE WRAPPER CONTAINS NO SCRIPT, and that is a deliberate constraint", () => {
  // A script here would need `</scr`+`ipt>` escaping inside a file that is itself one giant
  // script block, which is the exact shape of edit that has blanked this whole app before.
  // The width switch is CSS radios for that reason, so this is pinned rather than assumed.
  const i = UI.indexOf("const wrapperHTML = (a) =>");
  const body = UI.slice(i, UI.indexOf("\n  };", i));
  assert.ok(!/<script/i.test(body), "the wrapper carries a script, which needs escaping this file cannot safely hold");
  assert.match(body, /input type=\\"radio\\"/, "the width switch is not the CSS-only one");
});

t("🔴 the frame is sandboxed as well", () => {
  // The archive is already dead when written. This is the second lock on a bolted door, and
  // it costs nothing.
  const i = UI.indexOf("const wrapperHTML = (a) =>");
  const body = UI.slice(i, UI.indexOf("\n  };", i));
  assert.match(body, /sandbox title=/, "the frame grants the archive full privileges");
});

t("🔴 the label and URL are escaped into the wrapper", () => {
  // A client's business name goes into this document. An apostrophe or an angle bracket in
  // it would otherwise break the page, and a quote in the URL would break out of the src.
  const i = UI.indexOf("const wrapperHTML = (a) =>");
  const body = UI.slice(i, UI.indexOf("\n  };", i));
  assert.match(body, /replace\(\/\[<>&\]\/g/, "the page title is injected raw");
  assert.match(body, /replace\(\/"\/g, "&quot;"\)/, "the archive URL is injected raw into an attribute");
  assert.match(body, /viewHref\(a\)/, "the phone view still points at Supabase, which serves the source code");
});

t("a blocked pop-up says so instead of doing nothing", () => {
  assert.match(S, /Your browser blocked the new tab/,
    "the button silently does nothing, which reads as broken");
});

t("🔴 a saved page opens in a new tab, never inside the OS", () => {
  // It carries the client's own full-page styling. Dropping that into the OS is how a preview
  // ends up restyling or navigating the app around it.
  assert.match(UI, /href=\{viewHref\(a\)\} target="_blank" rel="noopener noreferrer"/,
    "the archive is embedded in the OS, where its own styles and layout apply to our app");
});

// ── 🔴 SUPABASE WILL NOT SERVE HTML, SO WE HAVE TO ─────────────────────────
// Bryson, 2026-09-15: *"i just saved a copy of the landing page for stencil & thread and i
// went to view it and it only shows code not the actual visual landing page"*. Supabase
// Storage returns `text/plain` for a stored `.html` object whatever content type it was
// uploaded with, on purpose, so its storage cannot be used to host web pages. Every saved
// page was therefore painted as source code. The saving was never wrong; the delivery was.
//
// 🔴 AND THE TEST ABOVE USED TO PIN THE BROKEN VERSION. It asserted `href={a.url}` — the
// Supabase public URL — as proof the viewer opened in a new tab, which was true and useless.
// It proved the link's TARGET WINDOW and said nothing about whether the link rendered.
// A feature can be fully tested and still have never once worked.
t("🔴 the saved page is served as HTML by our own route, not by Supabase", () => {
  assert.match(UI, /const viewHref = \(a\) =>/, "the UI has no way to build the viewing address");
  // Derived from the PATH, so every page saved before this route existed starts rendering
  // too. Reading a stored `url` would leave those pointing at Supabase forever.
  assert.match(UI, /a\.path\)\s*\?\s*`\/\.netlify\/functions\/page-archive\?file=\$\{encodeURIComponent\(a\.path\)\}`/,
    "the address is read off the record instead of derived, so older saves stay broken");
  assert.doesNotMatch(FN, /getPublicUrl/,
    "the function still hands out a Supabase public URL, which serves text/plain");
  assert.match(FN, /content-type": "text\/html; charset=utf-8/, "the viewer does not set an HTML content type");
  assert.match(FN, /"content-security-policy": "sandbox"/,
    "the served page is not sandboxed, and it now comes from our own origin");
  assert.match(FN, /public: false/, "the bucket is still world-readable");
});

// 🔴 RUN THE ROUTE. Everything above this point is still reading source, which is exactly
// what failed to notice that saved pages had never rendered. So the viewer is EXECUTED here
// against a fake database and a fake bucket, and its real Response object is inspected.
{
  const { viewArchive } = await import("../netlify/functions/page-archive.mjs");
  // 🔴 THE FIXTURE IS BUILT BY THE REAL CODE, NOT WRITTEN OUT BY HAND, AND THAT IS THE WHOLE
  // POINT. The first version of this hard-coded a UUID for the client id. Client ids are
  // `uid()` — `Math.random().toString(36).slice(2, 9)` — so every real saved page was refused
  // with "that is not a saved page" while this suite stayed green. The test had confirmed my
  // assumption instead of the code's behaviour.
  const uid = () => Math.random().toString(36).slice(2, 9);      // exactly as index.html makes them
  const CID = uid();
  const GOOD = archiveEntry({ label: "x", clientId: CID }).path;
  const PAGE = "<!DOCTYPE html><html><body><h1>Stencil &amp; Thread</h1></body></html>";

  // Records every call, so "it never even asked storage" is a thing the test can assert
  // rather than assume.
  const fake = ({ archives = [{ path: GOOD }], body = PAGE, dlError = null } = {}) => {
    const seen = { selected: 0, downloaded: [] };
    return { seen, sb: {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
        seen.selected++; return { data: { data: { pageArchives: archives } } };
      } }) }) }),
      storage: { from: () => ({ download: async (p) => {
        seen.downloaded.push(p);
        return dlError ? { data: null, error: dlError } : { data: { text: async () => body }, error: null };
      } }) },
    } };
  };
  const get = (file) => new Request(`https://os.example/.netlify/functions/page-archive?file=${encodeURIComponent(file)}`);

  await t("🔴 every path the saver produces is one the viewer accepts", () => {
    // The two functions are the two halves of one contract and nothing else was checking that
    // they agree. `c1` is a seeded client; the rest are the ids `uid()` actually returns,
    // including the short ones it produces when Math.random() lands on a short decimal.
    for (const cid of ["c1", "k3m9xz2", "0abc123", "5", "zzzzzzz", uid(), uid(), uid()]) {
      const path = archiveEntry({ label: "Saved page", clientId: cid }).path;
      assert.ok(isArchivePath(path), `the saver produced "${path}" and the viewer rejects it`);
      assert.equal(path.slice(0, path.indexOf("/")), cid, "the client id is not recoverable from the path");
    }
  });

  await t("🔴 a saved page comes back as real HTML, not as text/plain", async () => {
    const { sb, seen } = fake();
    const res = await viewArchive(get(GOOD), sb);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8",
      "this is the exact header Supabase would not give us, and the reason the page showed code");
    assert.equal(await res.text(), PAGE, "the bytes served are not the bytes stored");
    assert.deepEqual(seen.downloaded, [GOOD]);
  });

  await t("the served page can run nothing, even from our own origin", async () => {
    const { sb } = fake();
    const res = await viewArchive(get(GOOD), sb);
    assert.equal(res.headers.get("content-security-policy"), "sandbox",
      "no sandbox: a script that survived the stripper would run same-origin with the OS");
    assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow", "a client's saved page is indexable");
  });

  await t("🔴 a path that is not an archive is refused before storage is touched", async () => {
    for (const bad of [
      "../../secrets.html",                 // traversal
      `${CID}/../x.html`,                   // traversal past a valid prefix
      `${GOOD}/../x.html`,                  // and past a wholly valid path
      "..%2F..%2Fsecrets.html",             // the decoded form is what we are handed
      `${CID}/a/b.html`,                    // deeper than an archive ever is
      GOOD.replace(/\.html$/, ".js"),       // some other object in the bucket
      `.hidden/${CID}.html`,
      `${CID}/.env.html`,
      "",
    ]) {
      const { sb, seen } = fake();
      const res = await viewArchive(get(bad), sb);
      assert.equal(res.status, 404, `"${bad}" was served`);
      assert.equal(seen.selected, 0, `"${bad}" reached the database`);
      assert.equal(seen.downloaded.length, 0, `"${bad}" reached the bucket`);
    }
  });

  await t("🔴 a deleted archive stops serving even if the file is still there", async () => {
    const { sb, seen } = fake({ archives: [{ path: `${CID}/2026-01-01-zzzzzz.html` }] });
    const res = await viewArchive(get(GOOD), sb);
    assert.equal(res.status, 404);
    assert.equal(seen.downloaded.length, 0, "a file nothing points at was still handed out");
    assert.match(await res.text(), /deleted/);
  });

  // 🔴 THE WHOLE CHAIN, EXECUTED, BECAUSE EVERY FAILURE OF THIS FEATURE HAS BEEN A JOINT.
  // Each half was fine on its own each time: the saver wrote a good file, the viewer served
  // good HTML, the UI built a link. What broke was where they meet — Supabase in the middle,
  // then a path format the two halves disagreed about. So this runs the REAL renderer, the
  // REAL neutraliser, the REAL entry builder, the REAL link the OS puts on the button, and
  // the REAL route, with only the bucket and the database faked, and asserts the client's
  // own headline comes back out the far end.
  await t("🔴 save a real page, click the real View link, get the real page back", async () => {
    // The link is the OS's own code, lifted out of index.html and run, not re-implemented
    // here. Re-implementing it is how a test agrees with itself instead of with the app.
    const src = (S.match(/const viewHref = \(a\) =>[\s\S]*?;\n/) || [])[0];
    assert.ok(src, "viewHref is not in the OS any more, so this proves nothing");
    const viewHref = new Function(`${src} return viewHref;`)();

    const cid = uid();
    const entry = archiveEntry({ label: "Case study", headline: "x", clientId: cid });
    const stored = neutraliseArchive(renderLandingPage(CLIENT), entry);
    assert.match(stored, /Saved copy/, "the fixture never got through the neutraliser");

    const bucket = new Map([[entry.path, stored]]);
    // The saver writes `url` with its own helper and the UI builds the href with its own
    // code. Nothing reads the stored one today, so the two can drift apart unnoticed until
    // the day something does. Pin them equal.
    const record = { data: { pageArchives: [{ ...entry, url: archiveViewUrl(entry.path) }] } };
    assert.equal(record.data.pageArchives[0].url, viewHref(entry),
      "the address the saver records and the address the button uses have drifted apart");
    const sb = {
      from: () => ({ select: () => ({ eq: (_c, v) => ({ maybeSingle: async () =>
        ({ data: v === cid ? record : null }) }) }) }),
      storage: { from: () => ({ download: async (k) => bucket.has(k)
        ? { data: { text: async () => bucket.get(k) }, error: null }
        : { data: null, error: { message: "not found" } } }) },
    };

    const href = viewHref(entry);
    assert.ok(href.startsWith("/.netlify/functions/page-archive?"), `the button links to ${href}`);
    const res = await viewArchive(new Request(`https://os.example${href}`), sb);
    assert.equal(res.status, 200, "the page the OS just saved is refused by the OS's own viewer");
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    const out = await res.text();
    assert.match(out, /<html/i, "what came back is not a web page");

    // 🔴 AND IT HAS TO BE VISIBLE, WHICH THE BYTES ALONE NEVER SHOWED. This assertion used to
    // stop at "HTML came back", and HTML came back the whole time Bryson was looking at a
    // header over a blank page: the landing page's scroll reveals rest at `opacity:0` behind
    // a `.js` gate that was hard-coded into the markup, and the script that undoes them is
    // one of the scripts an archive strips on purpose. Nothing about the response was wrong.
    // Only a browser could see it, so the served bytes go into one.
    let chromium = null, exe = "";
    try {
      ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
      exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
    } catch { /* no browser here */ }
    if (chromium) {
      const browser = await chromium.launch({ executablePath: exe });
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.setContent(out, { waitUntil: "load" });
      await page.waitForTimeout(600);
      const seen = await page.evaluate(() => {
        const blank = [...document.querySelectorAll("body *")].filter((e) => {
          const st = getComputedStyle(e);
          return e.getBoundingClientRect().height > 2 && st.display !== "none"
            && st.visibility !== "hidden" && Number(st.opacity) === 0;
        }).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`);
        return { blank, height: document.documentElement.scrollHeight,
          text: (document.body.innerText || "").length };
      });
      await browser.close();
      assert.deepEqual(seen.blank, [],
        `🔴 ${seen.blank.length} parts of the saved page are invisible — this is the header-and-nothing-else page`);
      // A page that is only the banner and a header is short. Pin a floor so "nothing is
      // invisible" cannot be satisfied by a page with nothing on it.
      assert.ok(seen.height > 900, `the saved page is only ${seen.height}px tall`);
      assert.ok(seen.text > 200, `the saved page has only ${seen.text} characters of visible text`);
    }
    assert.match(out, new RegExp(CLIENT.landingPage.headline.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "the client's own headline did not survive the round trip");
    assert.doesNotMatch(out, /<script/i, "a script survived into the served page");
  });

  // 🔴 THE PAGES ALREADY IN STORAGE. Every archive saved before 2026-09-15 was written with
  // `js` baked onto its body tag and every script stripped, so it renders as a header over a
  // blank page. Fixing the renderer does nothing for those: they are files, already written.
  // Only the strip applied when they are SERVED brings them back, and that is the difference
  // between Bryson's existing saves working and him re-saving every one. So the fixture here
  // is deliberately an OLD-STYLE file, built by putting the class back.
  await t("🔴 a page saved the old way renders in full when it is served", async () => {
    let chromium = null, exe = "";
    try {
      ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
      exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
    } catch { return; }

    const cid = uid();
    const entry = archiveEntry({ label: "Saved in September", clientId: cid });
    const old = neutraliseArchive(renderLandingPage(CLIENT), entry)
      .replace(/<body class="/i, '<body class="js ');
    assert.match(old, /<body class="js /, "the fixture is not actually an old-style file");

    const sb = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () =>
        ({ data: { data: { pageArchives: [entry] } } }) }) }) }),
      storage: { from: () => ({ download: async () => ({ data: { text: async () => old }, error: null }) }) },
    };
    const res = await viewArchive(new Request(`https://os.example/x?file=${encodeURIComponent(entry.path)}`), sb);
    const served = await res.text();

    const browser = await chromium.launch({ executablePath: exe });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(served, { waitUntil: "load" });
    await page.waitForTimeout(600);
    const blank = await page.evaluate(() => [...document.querySelectorAll("body *")]
      .filter((e) => { const st = getComputedStyle(e);
        return e.getBoundingClientRect().height > 2 && st.display !== "none"
          && st.visibility !== "hidden" && Number(st.opacity) === 0; })
      .map((e) => `${e.tagName}.${String(e.className).slice(0, 40)}`));
    await browser.close();
    assert.deepEqual(blank, [],
      `🔴 ${blank.length} parts still invisible, so every page saved before today stays broken`);
  });

  await t("a page whose file has gone says so instead of serving nothing", async () => {
    const { sb } = fake({ dlError: { message: "not found" } });
    const res = await viewArchive(get(GOOD), sb);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert.match(await res.text(), /could not be opened/);
  });
}

t("the card explains why saving is needed at all", () => {
  assert.match(S, /rebuilt fresh every time somebody opens it, so nothing keeps the old version/,
    "without the reason, this looks like a pointless extra button and never gets pressed");
});

// ── 6. 🔴 THE CONTRACT RIGHT THAT MAKES PUBLISHING THEM LEGAL ───────────────
{
  const cs = await import("../netlify/lib/contract-shared.cjs");
  const make = cs.default && typeof cs.default === "function" ? cs.default
    : (cs.makeContractHTML || Object.values(cs.default || cs).find((v) => typeof v === "function"));
  const base = { name: "X", packageId: "g-launch", billingMonthly: 400, billingSetup: 750, billingPerLead: 50, contractTermMonths: 3 };
  const txt = (cl) => make(cl, {}).replace(/<[^>]+>/g, " ").replace(/&rsquo;/g, "'").replace(/\s+/g, " ");
  const v3 = txt({ ...base, contractTermsVersion: 3 });
  const v4 = txt({ ...base, contractTermsVersion: 4 });
  const out = txt({ ...base, contractTermsVersion: 4, showcaseOptOut: true });

  t("🔴 a client who signed v3 never gains the clause", () => {
    // A signed agreement must never grow a term it was not signed with. This is the whole
    // reason terms are versioned.
    assert.ok(!/Showcase and case study/.test(v3), "an already-signed contract gained a new grant");
    assert.match(v3, /Portfolio rights/, "the older clause vanished, leaving v3 with no portfolio right at all");
  });

  t("v4 grants the showcase right in plain terms", () => {
    assert.match(v4, /Showcase and case study rights/);
    assert.match(v4, /landing pages, advertisements, creative assets and campaign structure/);
    assert.match(v4, /screenshots, recordings, written case studies/);
  });

  t("🔴 AND PROMISES THE LEAD DATA IS NEVER SOLD, which is what makes it signable", () => {
    assert.match(v4, /will not publish, share, license or sell the personal information/,
      "the grant is broad with no carve-out, which is the version a client refuses to sign");
    assert.match(v4, /names, email addresses, telephone numbers/,
      "a vague promise about 'data' is not a promise about their customers' phone numbers");
  });

  t("their confidential business information is excluded", () => {
    assert.match(v4, /costs, margins, supplier terms, pricing to its own customers/);
  });

  t("results can be published without naming them", () => {
    assert.match(v4, /describe Client generically rather than by name/,
      "a client whose competitors would learn their cost per lead has no option but to refuse");
  });

  t("and any single item can be pulled on request", () => {
    assert.match(v4, /stop publishing any specified item/);
    assert.match(v4, /not required to recall material already distributed/,
      "an unlimited recall obligation is one nobody can actually honour");
  });

  t("🔴 a client can decline it without losing the deal", () => {
    assert.match(out, /has not granted Agency the right to publish/, "there is no way to opt out");
    assert.ok(!/Showcase and case study/.test(out),
      "the opt-out shows the refusal AND the grant, so the contract says both at once");
  });
}

await Promise.all(pending);
console.log(`✓ verify-page-archive: ${n} checks passed`);
