// KEEPING THE DOCUMENT THAT WAS ACTUALLY SIGNED.
//
// Bryson, 2026-09-16, after asking what happens in DocuSign when a contract date changes in
// the OS: *"make it so it only ever shows the correct version"*.
//
// 🔴 THE PROBLEM, STATED PLAINLY. There were two copies of every agreement and only one of
// them was the contract.
//
//   • The OS copy RE-RENDERS from the client record every time it is opened. Change a start
//     date, a package or a fee and the OS copy changes with it, silently and instantly.
//   • The DocuSign copy is a SNAPSHOT. `docusign-send` renders the agreement once, base64s
//     that HTML into the envelope and uploads it. DocuSign flattens it to a PDF. It never
//     re-renders and nothing changed afterwards reaches it. THAT frozen PDF is the legally
//     operative document.
//
// So the OS could show Bryson, and the portal could show the CLIENT, a document that
// confidently disagreed with what they had both signed, with nothing anywhere saying so.
// The OS only recorded THAT a client signed and WHEN, never WHAT.
//
// The fix is to fetch the completed PDF out of DocuSign the moment the envelope closes and
// keep it against the client. After that the OS and the portal show that file and nothing
// else, and the live re-render is never again presented as the agreement.
//
// 🔴 EVERYTHING HERE IS PURE. No network, no Supabase. The watcher does the fetching and the
// storing; this decides what should happen, so the branches that only fire on a bad day are
// exercised by the real code in tests rather than reasoned about.

// 🔴 A PRIVATE BUCKET, AND DELIBERATELY NOT THE ONE PHOTOS GO IN. `client-media` is created
// with `public: true` because a landing page has to load those images from anywhere. A signed
// agreement carries the client's business address, their fee and their signature, and it must
// never sit at a URL that works for whoever has it. This bucket is private and every read
// goes through a short-lived signed link.
export const CONTRACT_BUCKET = "client-contracts";

// How long a viewing link stays good. Long enough to read the document and to reload the
// page once, short enough that a link pasted somewhere it should not be stops working.
export const VIEW_URL_TTL_SECONDS = 3600;

// A completed agreement is a handful of pages. Anything wildly past that is not the document
// we asked for, and storing it would mean the OS shows something nobody has read.
export const MAX_CONTRACT_BYTES = 20 * 1024 * 1024;

// And a floor. DocuSign answering 200 with almost nothing is a real failure mode that
// `contract-pdf` already guards against; a signed agreement is never this small.
export const MIN_CONTRACT_BYTES = 1000;

// 🔴 IT MUST ACTUALLY BE A PDF. DocuSign answers an error with a JSON body and a 200 is not
// guaranteed to be the file. Storing that would leave a client record pointing at something
// the OS would then present as their signed contract, which is the exact failure this module
// exists to end. Every PDF begins with these five bytes.
export function looksLikePdf(bytes) {
  if (!bytes || typeof bytes.length !== "number" || bytes.length < 5) return false;
  const head = Array.from(bytes.slice(0, 5)).map((b) => String.fromCharCode(b)).join("");
  return head === "%PDF-";
}

// Which clients still owe us a stored copy.
//
// 🔴 THIS IS SEPARATE FROM `needsCheck` ON PURPOSE, and it is the whole retry story. The
// status watcher stops looking at a client the moment `contractSigned` is true, so if the
// document fetch failed on the one run that mattered — an expired token, a rate limit, a
// network blip — nothing would ever have tried again and that client would have no signed
// copy for the life of the agreement. This pass runs on every sweep and keeps trying.
export const needsArchive = (client) => {
  const c = client || {};
  if (!c.contractSigned) return false;          // nothing has been signed to fetch
  if (!c.docusignEnvelopeId) return false;      // signed on paper or ticked by hand
  if (c.internal) return false;                 // the house account has no counterparty
  if (c.signedContractPath) return false;       // already have it
  return true;
};

// Where the file lives. Keyed by envelope rather than by date, so a client who signs a second
// agreement later gets a second file instead of overwriting the first one.
export const archivePath = (clientId, envelopeId) =>
  `${String(clientId || "unknown")}/${String(envelopeId || "envelope").replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;

// What to merge onto the client record once the file is safely stored.
export const archivePatch = ({ path, bytes, at = new Date() }) => ({
  signedContractPath: path,
  signedContractBytes: Number(bytes) || 0,
  signedContractStoredAt: (at instanceof Date ? at : new Date(at)).toISOString(),
});

// 🔴 WHAT THE READER IS ALLOWED TO CLAIM, and the reason this file is worth having at all.
// Three states, and the middle one is the one that used to be a lie:
//
//   "signed"   — we hold the document that was signed. Show it, and only it.
//   "pending"  — they signed, we have not got the file yet (it can be a few minutes, or the
//                fetch is failing). SAY SO. A re-render shown here without a word is the OS
//                asserting terms nobody agreed to.
//   "draft"    — nothing is signed. The re-render IS the document, because it is what will
//                be sent. Showing it is correct and needs no caveat.
export function contractView(client) {
  const c = client || {};
  if (c.signedContractPath) return "signed";
  if (c.contractSigned) return "pending";
  return "draft";
}

// 🔴 FETCH THE SIGNED DOCUMENT AND PUT IT SOMEWHERE IT WILL STILL BE IN FIVE YEARS.
//
// Lives here rather than in the watcher because TWO callers need it and a second copy of
// this logic is exactly the drift that has bitten this project before: the scheduled sweep
// (which stores it within fifteen minutes of a signature) and the OS viewer (which stores it
// the instant Bryson opens a contract that has not been picked up yet, so he never waits).
//
// Throws on anything it will not vouch for. The callers each decide what a failure means;
// neither of them may let it undo a correctly recorded signature.
export async function fetchAndStore({ client, id, fetchDocument, storeDocument, now = () => new Date() }) {
  const cl = client || {};
  if (!cl.docusignEnvelopeId) throw new Error("no envelope to fetch");
  const path = archivePath(id, cl.docusignEnvelopeId);
  const bytes = await fetchDocument(cl.docusignEnvelopeId);
  // 🔴 A zero-byte 200 and a JSON error page are both real DocuSign failure modes, and either
  // one stored here becomes a file the OS then presents as a client's signed agreement.
  if (!looksLikePdf(bytes)) throw new Error(`document for ${cl.name || id} was not a PDF (${bytes ? bytes.length : 0} bytes)`);
  if (bytes.length < MIN_CONTRACT_BYTES) throw new Error(`document for ${cl.name || id} is only ${bytes.length} bytes`);
  if (bytes.length > MAX_CONTRACT_BYTES) throw new Error(`document for ${cl.name || id} is ${bytes.length} bytes, past the ceiling`);
  await storeDocument(path, bytes);
  return archivePatch({ path, bytes: bytes.length, at: now() });
}

// The path every caller asks DocuSign for. `combined` is the signed document AND the
// Certificate of Completion in one file, which is the pair that matters in a dispute; asking
// for the document alone drops the audit trail.
export const combinedDocumentPath = (envelopeId) =>
  `/envelopes/${encodeURIComponent(envelopeId)}/documents/combined`;
