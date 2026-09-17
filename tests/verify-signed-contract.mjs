// THE OS MUST NEVER SHOW A RE-RENDER AND CALL IT THE AGREEMENT.
//
// Bryson, 2026-09-16, after working out what happens in DocuSign when a contract date changes
// in the OS: *"make it so it only ever shows the correct version"*.
//
// 🔴 THE DEFECT. There were two copies of every agreement and only one of them was the
// contract.
//
//   • The OS copy RE-RENDERS from the client record every time it is drawn. Change a start
//     date, a fee or a package and it changes with it, silently.
//   • The DocuSign copy is a SNAPSHOT taken at send time. It never re-renders. THAT is the
//     legally operative document.
//
// Both were labelled "Your Agreement", in the OS and in the client's own portal. So an edit on
// our side changed what a client was shown as their contract, with nothing saying so and no
// way for them to notice. The OS recorded THAT they signed and WHEN, never WHAT.
//
// Three things had to be true, and this file holds all three:
//   1. The signed document is fetched out of DocuSign and kept, so it survives DocuSign's own
//      retention policy and does not need a round trip to read.
//   2. Nothing that is not that document is ever presented as the agreement. A re-render shown
//      beside a signed contract has to say what it is.
//   3. A failure anywhere in 1 never undoes a correctly recorded signature.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONTRACT_BUCKET, VIEW_URL_TTL_SECONDS, MAX_CONTRACT_BYTES, MIN_CONTRACT_BYTES,
  looksLikePdf, needsArchive, archivePath, archivePatch, contractView, fetchAndStore,
  combinedDocumentPath,
} from "../netlify/lib/docusign-archive.mjs";
import { runWatch } from "../netlify/functions/docusign-watch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8");
const PORTAL = readFileSync(join(ROOT, "netlify/functions/portal.mjs"), "utf8");
const WATCH = readFileSync(join(ROOT, "netlify/functions/docusign-watch.mjs"), "utf8");
const FILE_FN = readFileSync(join(ROOT, "netlify/functions/contract-file.mjs"), "utf8");
const AUTH = readFileSync(join(ROOT, "netlify/lib/docusign-auth.mjs"), "utf8");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const pdf = (n = 4000) => { const b = new Uint8Array(n); for (const [i, c] of [..."%PDF-"].entries()) b[i] = c.charCodeAt(0); return b; };
const bytesOf = (s) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

// ── 1. Only a real PDF counts as "we have the document" ──────────────────────
// 🔴 DocuSign answers an error with a JSON body, and a zero-byte 200 is a documented failure
// mode that `contract-pdf` already guards against. Either one stored here becomes a file the
// OS then shows a client as their signed agreement.
{
  ok("a real PDF is accepted", looksLikePdf(pdf()));
  ok("🔴 a JSON error body is not a contract", !looksLikePdf(bytesOf('{"errorCode":"NOPE"}')));
  ok("an HTML error page is not a contract", !looksLikePdf(bytesOf("<!DOCTYPE html><html>")));
  ok("nothing at all is not a contract", !looksLikePdf(new Uint8Array(0)) && !looksLikePdf(null) && !looksLikePdf(undefined));
  ok("a truncated header is not a contract", !looksLikePdf(bytesOf("%PD")));
  ok("the floor is above a plausible empty response", MIN_CONTRACT_BYTES >= 1000);
  ok("and the ceiling is generous but finite", MAX_CONTRACT_BYTES > 1e6 && MAX_CONTRACT_BYTES <= 50e6);
}

// ── 2. Who still owes us a copy ──────────────────────────────────────────────
{
  const signed = { contractSigned: true, docusignEnvelopeId: "env-1" };
  ok("a signed client with no stored copy needs one", needsArchive(signed));
  ok("🔴 and is picked up even though the status watcher has finished with them",
    needsArchive({ ...signed, docusignStatus: "completed" }),
    "this is the only retry path: without it one failed fetch means no copy, ever");
  ok("once stored, it stops asking", !needsArchive({ ...signed, signedContractPath: "c/env-1.pdf" }));
  ok("an unsigned client is not asked for", !needsArchive({ docusignEnvelopeId: "env-1" }));
  ok("a client signed on paper has nothing to fetch", !needsArchive({ contractSigned: true }));
  ok("the house account is skipped", !needsArchive({ ...signed, internal: true }));
  ok("junk does not throw", !needsArchive(null) && !needsArchive(undefined) && !needsArchive({}));
}

// ── 3. Where the file goes ───────────────────────────────────────────────────
{
  ok("the path is scoped to the client", archivePath("cl-1", "env-1").startsWith("cl-1/"),
    "contract-file refuses a stored path that does not start with the client's own id");
  ok("🔴 a second agreement does not overwrite the first",
    archivePath("cl-1", "env-1") !== archivePath("cl-1", "env-2"),
    "keying by date or by client alone loses the original on a renewal");
  ok("🔴 a hostile envelope id cannot climb out of the folder",
    archivePath("cl-1", "../../secrets") === "cl-1/secrets.pdf",
    archivePath("cl-1", "../../secrets"));
  ok("and neither can a slash smuggled into it",
    !archivePath("cl-1", "a/b/c").slice("cl-1/".length).includes("/"),
    archivePath("cl-1", "a/b/c"));
  ok("the bucket is its own, not the public photo one", CONTRACT_BUCKET === "client-contracts");
  ok("🔴 the watcher creates it private", /createBucket\(CONTRACT_BUCKET, \{ public: false \}\)/.test(WATCH),
    "a signed agreement in a public bucket is readable by anyone who has the URL");
  ok("and so does the viewer", /createBucket\(CONTRACT_BUCKET, \{ public: false \}\)/.test(FILE_FN));
  ok("a viewing link expires within the hour", VIEW_URL_TTL_SECONDS > 0 && VIEW_URL_TTL_SECONDS <= 3600);
  ok("the patch records enough to find and date the file", (() => {
    const p = archivePatch({ path: "a/b.pdf", bytes: 42, at: new Date("2026-09-16T12:00:00Z") });
    return p.signedContractPath === "a/b.pdf" && p.signedContractBytes === 42
      && p.signedContractStoredAt === "2026-09-16T12:00:00.000Z";
  })());
  {
    const pdfFn = readFileSync(join(ROOT, "netlify/functions/contract-pdf.mjs"), "utf8");
    ok("the client's own download asks for the same document",
      /combinedDocumentPath\(cl\.docusignEnvelopeId\)/.test(pdfFn),
      "three hand-built copies of one URL is the drift this project keeps getting bitten by");
  }
  ok("the document asked for carries the certificate page",
    combinedDocumentPath("env-1") === "/envelopes/env-1/documents/combined",
    "the document alone drops the audit trail, which is the half that matters in a dispute");
}

// ── 4. fetchAndStore refuses what it cannot vouch for ────────────────────────
{
  const client = { name: "Air Suds", docusignEnvelopeId: "env-9" };
  const run = async (bytes) => {
    let stored = null;
    const patch = await fetchAndStore({
      client, id: "cl-9",
      fetchDocument: async () => bytes,
      storeDocument: async (p, b) => { stored = { p, n: b.length }; },
      now: () => new Date("2026-09-16T12:00:00Z"),
    });
    return { patch, stored };
  };
  const rejects = async (bytes) => { try { await run(bytes); return false; } catch { return true; } };

  const good = await run(pdf(5000));
  ok("a good document is stored and recorded", good.stored.p === "cl-9/env-9.pdf" && good.patch.signedContractBytes === 5000);
  ok("🔴 a JSON error body is refused", await rejects(bytesOf('{"errorCode":"ENVELOPE_DOES_NOT_EXIST"}')));
  ok("🔴 a near-empty 200 is refused", await rejects(pdf(400)));
  ok("something absurdly large is refused", await rejects(pdf(MAX_CONTRACT_BYTES + 1)));
  ok("🔴 nothing is stored when the document is refused", await (async () => {
    let stored = false;
    try {
      await fetchAndStore({ client, id: "cl-9", fetchDocument: async () => bytesOf("nope"), storeDocument: async () => { stored = true; } });
    } catch { /* expected */ }
    return !stored;
  })(), "a refused document that still lands in the bucket is the failure this guard exists for");
  ok("a client with no envelope refuses rather than inventing a path", await (async () => {
    try { await fetchAndStore({ client: {}, id: "x", fetchDocument: async () => pdf(), storeDocument: async () => {} }); return false; }
    catch { return true; }
  })());
}

// ── 5. 🔴 THE WATCHER: a file failure NEVER costs a signature ────────────────
{
  // 🔴 ONE ID, BECAUSE THERE IS ONLY ONE. A client row's `id` column and the `id` inside its
  // `data` are the same value: the OS creates a client with `id: uid()` and reads it back with
  // `.eq("id", client.id)`. A first pass gave the fixture two different ids, which made four
  // assertions fail against correct code and would have hidden the real invariant, which is
  // that the file path is keyed on the id the VIEWER validates against.
  const ID = "cl-1";
  const base = (over = {}) => ({
    id: ID,
    data: { id: ID, name: "Air Suds", email: "c@airsuds.test", docusignEnvelopeId: "env-1", docusignSentAt: "2026-09-16T00:00:00Z", ...over },
  });
  const harness = ({ rows, doc, store = async () => {} }) => {
    const saved = [];
    return {
      saved,
      summary: runWatch({
        loadClients: async () => rows,
        fetchEnvelope: async () => ({ status: "completed", completedDateTime: "2026-09-16T10:00:00Z" }),
        saveClient: async (id, data) => { saved.push({ id, data }); },
        alert: async () => {},
        sendEmail: async () => {},
        fetchDocument: doc,
        storeDocument: store,
        now: () => new Date("2026-09-16T12:00:00Z"),
      }),
    };
  };

  {
    const h = harness({ rows: [base()], doc: async () => pdf() });
    const s = await h.summary;
    ok("a signature and its document land in one write", h.saved.length === 1
      && h.saved[0].data.contractSigned === true
      && h.saved[0].data.signedContractPath === "cl-1/env-1.pdf", JSON.stringify(h.saved[0] && h.saved[0].data.signedContractPath));
    ok("and both are counted", s.signed === 1 && s.archived === 1);
  }

  {
    // 🔴 THE ONE THAT MATTERS. DocuSign hands back the envelope status but will not hand over
    // the file. The client HAS signed. Recording that must not depend on the download.
    const h = harness({ rows: [base()], doc: async () => { throw new Error("rate limited"); } });
    const s = await h.summary;
    ok("🔴 a failed download still records the signature", h.saved.length === 1 && h.saved[0].data.contractSigned === true,
      "losing a real signature to a file error is far worse than being a run late with the copy");
    ok("the record does not claim a copy it does not have", !h.saved[0].data.signedContractPath);
    ok("the failure is counted, not swallowed", s.signed === 1 && s.archived === 0 && s.archiveErrors === 1);
  }

  {
    // The catch-up pass: signed on an earlier run, no copy. This also covers every client who
    // signed before any of this existed.
    const rows = [base({ contractSigned: true, contractStatus: "active", docusignStatus: "completed" })];
    const h = harness({ rows, doc: async () => pdf() });
    const s = await h.summary;
    ok("🔴 a client signed earlier is picked up later", h.saved.length === 1
      && h.saved[0].data.signedContractPath === "cl-1/env-1.pdf",
      "without this, one failed fetch means that client never has a stored copy");
    ok("and the status watcher did not touch them", s.pending === 0 && s.archived === 1);
  }

  {
    const rows = [base({ contractSigned: true, signedContractPath: "cl-1/env-1.pdf" })];
    let fetched = 0;
    const h = harness({ rows, doc: async () => { fetched++; return pdf(); } });
    await h.summary;
    ok("a client who already has their copy is left alone", fetched === 0 && h.saved.length === 0);
  }

  {
    // A store that throws must not stop the sweep reaching the next client.
    const rows = [base(), { id: "row-2", data: { id: "cl-2", name: "Second", docusignEnvelopeId: "env-2" } }];
    const h = harness({ rows, doc: async () => pdf(), store: async (p) => { if (p.startsWith("cl-1/")) throw new Error("bucket down"); } });
    const s = await h.summary;
    ok("🔴 one client's storage failure does not strand the next", s.signed === 2 && s.archiveErrors === 1 && s.archived === 1);
  }

  {
    // Nothing is fetched for a client who has not signed.
    const rows = [base()];
    let fetched = 0;
    const saved = [];
    await runWatch({
      loadClients: async () => rows,
      fetchEnvelope: async () => ({ status: "delivered" }),
      saveClient: async (id, data) => { saved.push(data); },
      alert: async () => {}, sendEmail: async () => {},
      fetchDocument: async () => { fetched++; return pdf(); },
      storeDocument: async () => {},
      now: () => new Date("2026-09-16T12:00:00Z"),
    });
    ok("🔴 an opened-but-unsigned envelope is never downloaded", fetched === 0,
      "delivered means OPENED, and a document fetched then would not be signed");
  }
}

// ── 6. The three states, and the one that used to lie ───────────────────────
{
  ok("nothing signed is a draft", contractView({}) === "draft");
  ok("signed and stored is the real thing", contractView({ contractSigned: true, signedContractPath: "a/b.pdf" }) === "signed");
  ok("🔴 signed with no copy is its own state, not a draft and not the agreement",
    contractView({ contractSigned: true }) === "pending",
    "collapsing this into either neighbour is how a re-render gets shown as the contract");
  ok("a stored copy wins even if the flag was never set", contractView({ signedContractPath: "a/b.pdf" }) === "signed");
  ok("junk reads as a draft rather than throwing", contractView(null) === "draft" && contractView(undefined) === "draft");
}

// ── 7. 🔴 THE CLIENT'S OWN COPY, which is the worse half of the bug ─────────
// The portal is what a client reads. Showing them a re-render titled "Your Agreement" after
// they have signed means an edit on our side changes what they believe they agreed to, and
// they have no way to check. Both copies of the portal, as always.
for (const [label, src] of [["the served portal", PORTAL], ["the OS's own copy", UI]]) {
  ok(`🔴 ${label} calls the signed document the signed one`,
    /Your Signed Agreement/.test(src) && /exactly as you signed it/.test(src),
    "the portal exists in two files and a fix in one is absent exactly where it is read");
  ok(`${label} says which one wins if they differ`,
    /the signed copy is the one that applies/.test(src));
  ok(`${label} still offers the signed original to download`,
    /contract-pdf\?token=/.test(src));
  ok(`🔴 ${label} only renames it once there IS a signed one`,
    /cl\.contractSigned\s*&&\s*cl\.docusignEnvelopeId\s*\n?\s*\?\s*'<div class="card"><div class="lbl">Your Signed Agreement/.test(src.replace(/\r/g, "")),
    "an unsigned agreement labelled as signed is a worse lie than the one being fixed");
}

// ── 8. The viewer endpoint keeps the file private ───────────────────────────
{
  ok("🔴 it requires the owner's session", /supabase\.auth\.getUser\(jwt\)/.test(FILE_FN) && /Not authenticated/.test(FILE_FN));
  ok("🔴 the path comes from the record, never from the request",
    /path\.startsWith\(`\$\{row\.id\}\/`\)/.test(FILE_FN) && !/body\.path/.test(FILE_FN),
    "signing whatever path a caller asks for turns one session into every client's contract");
  ok("a missing copy is reported as not-ready, not as an error",
    /ready: false/.test(FILE_FN),
    "a 500 here would push the OS back to showing the re-render");
  ok("it fetches on demand rather than making him wait for the sweep",
    /fetchAndStore\(/.test(FILE_FN));
  ok("🔴 an on-demand failure does not break the page",
    /catch \(e\) \{\s*\n\s*console\.error\(`contract-file: could not fetch/.test(FILE_FN),
    "the page must still render and say plainly that the copy is not here");
}

// ── 9. The bytes are read as bytes ──────────────────────────────────────────
{
  ok("🔴 there is a raw-bytes read separate from the JSON one", /export async function dsGetBytes/.test(AUTH));
  ok("🔴 and it does not parse the PDF as JSON", (() => {
    const fn = AUTH.slice(AUTH.indexOf("export async function dsGetBytes"));
    const body = fn.slice(0, fn.indexOf("\n}"));
    return /arrayBuffer\(\)/.test(body) && !/const data = await resp\.json\(\)\.catch/.test(body);
  })(), "dsGet's json().catch(() => ({})) turns a PDF into an empty object that reads as success");
  ok("the watcher uses the bytes reader for the document", /fetchDocument: \(envelopeId\) => dsGetBytes\(/.test(WATCH));
  ok("and the JSON reader for the status", /fetchEnvelope: \(envelopeId\) => dsGet\(/.test(WATCH));
}

// ── 10. 🔴 THE PATH IS KEYED ON THE ID THE VIEWER CHECKS ────────────────────
// `contract-file` refuses any stored path that does not begin with the client's own row id.
// If the watcher ever keyed the file on something else, every signed copy would be written
// successfully and then refused on every attempt to read it, which reads on screen exactly
// like a contract that was never stored.
{
  ok("the watcher keys the file on the row id it saves against",
    /fetchAndStore\(\{ client: cl, id: row\.id/.test(WATCH),
    "any other id here and the viewer rejects every file it stores");
  ok("and the viewer checks the same one",
    /\.eq\("id", clientId\)/.test(FILE_FN) && /path\.startsWith\(`\$\{row\.id\}\/`\)/.test(FILE_FN));
  ok("the catch-up pass uses it too", /fetchAndStore\(\{ client: cl, id: row\.id[\s\S]{0,120}\}\);\s*\n\s*await saveClient\(row\.id/.test(WATCH));
}

console.log(`verify-signed-contract: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
