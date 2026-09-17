// The client can hand over their Meta dataset (pixel) id themselves.
// Run: node tests/verify-portal-pixel.mjs
//
// 🔴 WHY THIS IS NOT A COSMETIC FIELD. `createCampaign` decides what a Meta campaign is FOR
// with `goal: client.metaPixelId ? "leads" : "traffic"`. A client with no dataset id on record
// therefore gets a campaign that buys **clicks** instead of chasing buyers — which looks like a
// working campaign right up until the month ends with nothing sold.
//
// Until 2026-09-16 the only way it could be set was Bryson typing it into the OS edit sheet, so
// it was missed whenever he did not think to ask. The portal already walked the client through
// finding their Ad Account ID and Page ID and let them paste both in; the one id that decides
// whether the ads chase buyers was the one it never asked for.
//
// 🔴 AND THE WHITELIST IS WHY A NEW BOX IS NEVER JUST A NEW BOX. `sanitizeFields` drops anything
// it does not name, silently — the client presses Save, sees "✓ Saved", and the value is gone.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));

const SRV = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
const OS  = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── 1. 🔴 The box exists, and Save actually keeps it ──────────────────────────
ok("🔴 the portal asks for the dataset id", /data-key="metaPixelId"/.test(SRV),
  "the client can find every id except the one that decides whether the ads chase buyers");
ok("🔴 and sanitizeFields lets it through", /"metaAdAccountId", "metaPageId", "metaPixelId"/.test(SRV),
  "anything not on the whitelist is dropped with no error: Save says ✓ and the value is gone");

// The claim above, proved by running the real filter rather than reading it.
{
  // It is `const sanitizeFields = (fields) => {`, and it leans on `clip` declared just above
  // it, so both come along. Lifting the filter without its helper throws rather than failing,
  // which reads like a broken test instead of a broken whitelist.
  const c = SRV.indexOf("const clip = ");
  const i = SRV.indexOf("const sanitizeFields");
  ok("sanitizeFields was found", i > 0 && c > 0 && c < i);
  const body = SRV.slice(c, SRV.indexOf("\n};", SRV.indexOf("return out;", i)) + 3);
  const fn = new Function(body + "\nreturn sanitizeFields;")();
  const out = fn({ metaPixelId: "  2164699294444030 ", metaAdAccountId: "act_1", nonsense: "x" });
  ok("🔴 a pasted dataset id survives Save", String(out.metaPixelId || "").includes("2164699294444030"),
    "it is dropped on the way in, which is indistinguishable from the client never typing it");
  ok("and junk is still dropped", !("nonsense" in out),
    "the whitelist stopped whitelisting, which is worse than the bug this fixed");
}

// ── 2. The instructions tell them where to find it ────────────────────────────
ok("🔴 the steps say where the dataset id lives", /Events Manager/.test(SRV) && /Data sources/.test(SRV),
  "a box with no instruction is a box that gets left blank");
ok("and they name Shopify, which is where this client's is created",
  /Shopify/.test(SRV) && /sales channel/.test(SRV));
ok("🔴 including the data-sharing setting that makes sales report back",
  /data sharing[\s\S]{0,40}Maximum/i.test(SRV),
  "with the default setting only the browser half reports, and purchases go missing");
ok("the intro lists it alongside the other two ids", /Dataset \(Pixel\) ID/.test(SRV));
ok("and no longer says 'both IDs' now there are three", !/Enter both IDs below/.test(SRV),
  "the client counts the boxes, finds three, and wonders which two were meant");

// ── 3. 🔴 Dual copy. The OS preview is a second implementation of this page ───
for (const frag of ['data-key="metaPixelId"', "Events Manager", "Dataset (Pixel) ID"]) {
  ok(`🔴 the OS preview carries "${frag}"`, OS.includes(frag),
    "the Live Client View shows a different page from the one the client is looking at");
}

// ── 4. The reason it matters is still true ────────────────────────────────────
ok("🔴 a missing dataset id really does downgrade the campaign to traffic",
  /goal: client\.metaPixelId \? "leads" : "traffic"/.test(OS),
  "if this ever stops being true, rewrite the reasoning above rather than deleting the check");

if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-portal-pixel: ${pass} checks passed`);
