// Special Terms: what Bryson agreed on a call, written into the agreement.
//
// Bryson, 2026-09-02: *"I need a way for the ai to edit the contracts on the go before I
// send them. So what I mean is I want there to be a section where I input the agreed upon
// price or any other details i want and the ai will add them to the contract"*.
//
// 🔴 THE SAFETY MODEL, WHICH IS WHAT MOST OF THIS SUITE IS ABOUT. Nothing may rewrite the
// agreement. Additions land in ONE bounded section at the end and nowhere else. A model with
// a free hand over contract text could quietly weaken the limitation of liability, move the
// governing law, or undo the arbitration clause, and a signed contract is the last place on
// earth where a silent change should be possible. Nobody would notice until it mattered.
//
// The rendered document is built by running BOTH real copies of the contract generator, the
// server one and the one extracted out of index.html, over the same clients.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { makeContractHTML: server } = require("../netlify/lib/contract-shared.cjs");
const S = readFileSync(join(ROOT, "index.html"), "utf8");
let n = 0;
const t = (name, fn) => { fn(); n++; };

// The browser copy, lifted out of the shipping file exactly as verify-founding-terms does.
const decl = (start, end) => {
  const i = S.indexOf(`const ${start}`);
  assert.ok(i > 0, `could not find ${start} in index.html`);
  return S.slice(i, S.indexOf(end, i) + end.length);
};
const browser = new Function([
  'var LOGO="";',
  decl("ALL_FEATURES = [", "\n];"),
  decl("PKG_FEATURES = {", "\n};"),
  decl("PER_LEAD ", "};"),
  decl("monthsLabel", "\n};"),
  decl("makeContractHTML=", "\n};"),
].join("\n") + "\nreturn makeContractHTML;")();

const PKG = { id: "g-growth", name: "Growth", price: 1200, setup: 500 };
const base = { id: "c1", name: "Stencil & Thread", contactName: "Sebastian", niche: "Apparel",
  packageId: "g-growth", billingMonthly: 1200, billingSetup: 500, contractTermMonths: 3 };
const both = (cl) => [server(cl, PKG, ""), browser(cl, PKG, "")];

// ── It shows up, and it is the only thing that changed ────────────────────────
t("with no special terms the document is exactly what it was", () => {
  for (const html of both(base)) {
    assert.ok(!/Special Terms/.test(html), "an empty Special Terms section is rendered into every contract");
  }
});

t("a clause appears in both copies of the contract", () => {
  const cl = { ...base, specialTerms: { clauses: [{ heading: "First Month Discount", text: "The first monthly minimum is reduced to $600." }] } };
  for (const html of both(cl)) {
    assert.match(html, /Special Terms/, "the clause was saved and does not appear in the agreement");
    assert.match(html, /First Month Discount/);
    assert.match(html, /reduced to \$600/);
  }
});

t("🔴 the two copies of the contract agree", () => {
  // The browser renders what Bryson reads; the server renders what the CLIENT reads in the
  // portal and what DocuSign sends. This repo has been bitten by these drifting apart.
  const cl = { ...base, specialTerms: { clauses: [
    { heading: "Free Logo Refresh", text: "Agency will deliver one logo refresh in month two at no charge." },
    { heading: "Notice Period", text: "Either party may end this Agreement on sixty (60) days written notice." },
  ] } };
  const [a, b] = both(cl);
  const sec = (h) => h.slice(h.indexOf("Special Terms"), h.indexOf("<h2>Signatures"));
  assert.equal(sec(a), sec(b), "the client's copy of the Special Terms does not match Bryson's");
});

// ── 🔴 IT MAY ONLY ADD, NEVER REWRITE ─────────────────────────────────────────
t("🔴 the base agreement is byte-identical with and without special terms", () => {
  // This is the guarantee the whole feature rests on, and the only way to state it is to
  // render both and compare everything that is not the new section. If a clause could reach
  // any other part of the document, this fails.
  const plain = server(base, PKG, "");
  const withTerms = server({ ...base, specialTerms: { clauses: [
    { heading: "Anything", text: "Agency will do a thing." },
  ] } }, PKG, "");
  const strip = (h) => h.replace(/<h2>\d+\. Special Terms<\/h2>[\s\S]*?(?=<h2>Signatures<\/h2>)/, "");
  assert.equal(strip(withTerms), plain,
    "adding a special term changed some other part of the agreement, which is the one thing it must never do");
});

t("a clause cannot inject markup into the contract", () => {
  const cl = { ...base, specialTerms: { clauses: [
    { heading: "<script>x</script>", text: '</p><h2>1. Services and Scope</h2><p>Agency provides nothing.' },
  ] } };
  for (const html of both(cl)) {
    assert.ok(!/<script>x<\/script>/.test(html), "a heading was rendered as live markup");
    // 🔴 The real danger is not a script tag, it is a clause that closes the paragraph and
    // opens a fake SECTION, so the contract appears to say something it does not.
    assert.ok(!/<h2>1\. Services and Scope<\/h2><p>Agency provides nothing/.test(html),
      "a clause forged a section heading, so the document can be made to say anything");
    assert.match(html, /&lt;script&gt;/, "the text was dropped rather than escaped");
  }
});

// ── Shape and hygiene ─────────────────────────────────────────────────────────
t("empty and malformed clauses are dropped, not rendered blank", () => {
  const cl = { ...base, specialTerms: { clauses: [
    { heading: "Kept", text: "This one is real." },
    { heading: "No text", text: "   " }, { heading: "x" }, null, "nope", { text: "" },
  ] } };
  for (const html of both(cl)) {
    const sec = html.slice(html.indexOf("Special Terms"));
    assert.equal((sec.match(/<p>\([a-z]\)/g) || []).length, 1, "a blank clause was rendered as a lettered term");
  }
});

t("clauses are lettered in order", () => {
  const cl = { ...base, specialTerms: { clauses: [
    { heading: "One", text: "First." }, { heading: "Two", text: "Second." }, { heading: "Three", text: "Third." },
  ] } };
  const sec = server(cl, PKG, "").slice(server(cl, PKG, "").indexOf("Special Terms"));
  assert.ok(sec.indexOf("(a)") < sec.indexOf("(b)") && sec.indexOf("(b)") < sec.indexOf("(c)"));
});

t("🔴 the section says it controls over the rest", () => {
  // Without this a special term that varies an earlier section leaves TWO readings of the
  // same point, which is exactly what a dispute turns on. A later clause stating that it
  // controls is the standard, unambiguous way to vary an earlier one.
  const cl = { ...base, specialTerms: { clauses: [{ heading: "H", text: "T." }] } };
  for (const html of both(cl)) {
    assert.match(html, /these Special Terms control/,
      "the section does not say what happens when it conflicts with the agreement above it");
  }
});

t("it sits before the signatures, not after them", () => {
  const cl = { ...base, specialTerms: { clauses: [{ heading: "H", text: "T." }] } };
  for (const html of both(cl)) {
    assert.ok(html.indexOf("Special Terms") < html.indexOf("<h2>Signatures</h2>"),
      "the terms are printed after the signature block, so nobody signs them");
  }
});

t("a hand-off agreement gets it too, with its own numbering", () => {
  // The one-time product swaps sections 2, 3 and 4 wholesale, so its numbers differ.
  const cl = { ...base, packageId: "h-handoff", specialTerms: { clauses: [{ heading: "H", text: "T." }] } };
  const html = server(cl, { id: "h-handoff", name: "Launch & Hand Off", price: 0, setup: 2500 }, "");
  assert.match(html, /\d+\. Special Terms/, "a hand-off agreement cannot carry special terms");
});

// ── The drafter ───────────────────────────────────────────────────────────────
const FN = readFileSync(join(ROOT, "netlify/functions/contract-terms.mjs"), "utf8");
const { flagRisky, SYSTEM } = await import("../netlify/functions/contract-terms.mjs");

t("🔴 the prompt forbids rewriting the agreement and forbids fronting ad spend", () => {
  assert.match(SYSTEM, /never rewrite/i, "the model is not told to leave the agreement alone");
  assert.match(SYSTEM, /Invent nothing/i, "the model is not told to invent nothing");
  // The hard business constraint. A clause putting BoldLine on the hook for a client's ad
  // spend is the single most expensive sentence this tool could produce.
  assert.match(SYSTEM, /fronting, holding, or being billed/i, "the model is not told it may never agree to fund ad spend");
  assert.match(SYSTEM, /vague/i, "the model is not told to refuse a vague note rather than guess");
});

t("high-risk topics are flagged rather than blocked", () => {
  // 🔴 Not blocked on purpose: he is entitled to negotiate any of these, and a tool that
  // refuses to write what he agreed is one he stops using. Flagging puts the warning on the
  // clause that deserves a second read.
  assert.deepEqual(flagRisky([{ heading: "Notice", text: "Either party may terminate on sixty days notice." }]),
    ["how the agreement ends"]);
  assert.deepEqual(flagRisky([{ heading: "Cap", text: "Agency's liability is capped at fees paid." }]),
    ["limits on what BoldLine can be held liable for"]);
  assert.deepEqual(flagRisky([{ heading: "Spend", text: "Agency will front the media spend." }]),
    ["who pays for the ads"]);
  assert.deepEqual(flagRisky([{ heading: "Logo", text: "Agency will deliver one logo refresh." }]), []);
});

t("each risk is named once even across several clauses", () => {
  const hits = flagRisky([
    { heading: "A", text: "Either party may terminate on notice." },
    { heading: "B", text: "No refund is due on cancellation." },
  ]);
  assert.deepEqual(hits, ["how the agreement ends"]);
});

t("🔴 a signed agreement refuses new terms", () => {
  // The OS renders the contract fresh every time, so editing terms after signature would
  // silently rewrite the document the client already put their name to.
  assert.match(FN, /contractSigned/, "the drafter does not check whether the contract is already signed");
  assert.match(FN, /already signed, so its terms cannot be changed/, "there is no message explaining the refusal");
  assert.match(FN, /409/, "it does not fail with a distinct status, so the OS cannot tell this apart from a generic error");
  assert.match(S, /const locked = !!client\.contractSigned;/, "the card lets him keep typing into a signed agreement");
});

t("nothing is written to the client record by the server", () => {
  // 🔴 The function READS the record to check the signature and never updates it. Bryson
  // reviews the draft and saves it himself; a contract term that appeared without a person
  // reading it is the same bug with a friendlier face.
  assert.ok(!/\.update\(/.test(FN), "the drafter writes to the client record, so a clause could land without being read");
  assert.match(S, /Add to the agreement/, "there is no explicit step where he accepts the draft");
});

t("drafted clauses are de-dashed like every other written surface", () => {
  assert.match(FN, /humanizeDeep/, "contract clauses skip the no-dash rule the rest of the copy follows");
});

console.log(`✓ verify-special-terms: ${n} checks passed`);
