// Handing each lead onward to the client's OWN follow-up system.
//
// Shaun Smith, who runs Stencil & Thread's site, 2026-08-25: *"every lead that comes
// through Stencil & Thread routes into Sebastian's CRM, where the follow-up automation
// lives... Ad leads that get a response within a minute or two convert at a much higher
// rate."* He is right, and that automation is worth more than anything we would bolt on.
//
// 🔴 BUT IT CANNOT BE THE ONLY DESTINATION, AND THAT IS NOT A PREFERENCE. The landing page
// captures the Google click id at the moment of arrival, and that id is the ONLY way an
// order weeks later can be credited back to the search that produced it (KB
// `conversion-loop`). Post the form straight to the client's CRM and the id is never
// captured: the ads keep spending and stop learning, the per-qualified-lead billing has
// nothing to count, and the scorecard has nothing to report.
//
// So it is BOTH. The lead is stored here first, with its click id, and THEN forwarded.
// The client's automation fires within a second exactly as it does today.
//
// Three rules the ordering exists to enforce:
//   1. STORE BEFORE FORWARD. A CRM that is down must never cost us a lead.
//   2. FORWARD ONCE. A retry that duplicates a lead in someone's sales pipeline is worse
//      than one that never arrives, because a human then works the same lead twice.
//   3. A FAILURE IS VISIBLE. Silence here looks identical to "no leads yet", which is the
//      same trap the lead-count heartbeat exists to close.
//
// Pure module: every rule below is executed by the test suite, not re-described in it.

import { utmFields, hasClickId } from "./attribution.mjs";
import { consentField } from "./sms-consent.mjs";

// The visitor is staring at a "Sending..." button while this runs. A slow CRM must not
// become a slow form, so the whole attempt is capped and a timeout is a failure we record
// rather than an error the visitor ever sees.
export const CRM_TIMEOUT_MS = 6000;

// One retry, and only for failures a retry can actually fix.
export const CRM_MAX_ATTEMPTS = 2;

// 🔴 RETRY POLICY. A 4xx means the request itself was wrong: the URL, the shape, the
// signature. Sending it again produces the identical rejection, and on an endpoint that
// half-accepted it, a duplicate lead. Only a transport failure or the server having a bad
// moment is worth a second attempt.
export const shouldRetry = ({ status, networkError } = {}) => {
  if (networkError) return true;
  const s = Number(status);
  if (!s) return true;                    // no response at all
  if (s === 408 || s === 429) return true; // the server explicitly said "later"
  return s >= 500 && s < 600;
};

// What the client's system receives. Flat and stable on purpose: whoever is on the other
// end has to map these fields once and never think about it again. Everything the OS knows
// about the lead is here, including the ad attribution, because a CRM that can see which
// campaign produced a contact is far more useful than one that cannot.
export const crmPayload = (client, lead, { source = "boldline" } = {}) => {
  const c = client || {};
  const l = lead || {};
  const str = (v) => (v == null ? "" : String(v));
  return {
    source,
    event: "lead.created",
    // 🔴 THE DEDUPE KEY. Stable for the life of the lead, so a retry, a replay or a future
    // backfill of the same lead arrives carrying the same id and can be dropped on sight.
    // Older leads predate the field, so they fall back to the timestamp they arrived at,
    // which is unique to the millisecond and was already being sent.
    leadId: str(l.leadId) || str(l.receivedAt),
    receivedAt: str(l.receivedAt) || new Date().toISOString(),
    business: str(c.name),
    lead: {
      name: str(l.name),
      email: str(l.email),
      phone: str(l.phone),
      message: str(l.message),
      source: str(l.source) || "unknown",
    },
    // The ad attribution. Passed along so the CRM can report by campaign too, and so
    // nobody has to ask us where a contact came from.
    //
    // Shaun Smith, 2026-08-26: *"include the gclid and UTM fields alongside the contact
    // info... so when Sebastian looks at an order weeks later, the source is right there
    // on the record."* Every key below is always present, even when empty, so whoever
    // maps this on the other end never has to branch on a field that sometimes vanishes.
    attribution: {
      gclid: str(l.gclid),
      wbraid: str(l.wbraid),
      gbraid: str(l.gbraid),
      clickAt: str(l.clickAt),
      // The UTM tags. Labels we put on our own links, useful to a human reading the
      // contact record. 🔴 THEY ARE NOT A SUBSTITUTE FOR A CLICK ID and must never be
      // read as one: Google never reads a UTM back, so a lead carrying only these can
      // never have an outcome credited to the search that produced it.
      ...utmFields(l),
      // True when Google can actually credit an outcome back to an ad. A CRM row without
      // this is a lead that arrived some other way, which is useful to know at a glance.
      fromAd: hasClickId(l),
    },
  };
};

// ─── A SECOND WIRE FORMAT, BECAUSE ONE CLIENT'S CRM WANTS ONE ────────────────
//
// Shaun's endpoint (2026-08-29 spec) takes FLAT form-urlencoded with his own field names,
// not the nested JSON above. That is not "rename a few keys", it is a different content
// type, a different shape and a different vocabulary, so it is a named format rather than
// edits to the default.
//
// 🔴 AND IT STAYS A PER-CLIENT OPTION, NEVER THE NEW DEFAULT. Sebastian happens to have a
// competent developer with opinions. Most clients will have neither a developer nor a CRM,
// and reshaping BoldLine's engineering around one client's stack is exactly the work that
// does not scale. Existing clients keep the JSON they were set up with, untouched.
export const crmFormat = (client) => {
  const cs = (client || {}).campaignSetup || {};
  return String(cs.crmFormat || (client || {}).crmFormat || "json").trim().toLowerCase() === "form"
    ? "form"
    : "json";
};

// Shaun, 2026-08-29: *"Do NOT send `source` or `business`. I set both server-side so
// everything feeding the CRM keeps one shape."* So they are absent here on purpose, and a
// test asserts their absence rather than trusting the omission to survive a future edit.
export const crmFormPayload = (client, lead) => {
  const l = lead || {};
  const str = (v) => (v == null ? "" : String(v));
  const name = str(l.name).trim();
  return {
    // Contact.
    name,
    // Optional in his spec and derived from the full name when we have nothing better, so
    // his greeting line is never "Hi ,".
    first_name: str(l.firstName).trim() || (name ? name.split(/\s+/)[0] : ""),
    email: str(l.email),
    phone: str(l.phone),
    details: str(l.message),
    page: str(l.page),
    // Attribution. Every key always present, empty when unknown, so the mapping on his side
    // never has to branch on a field that sometimes vanishes.
    gclid: str(l.gclid),
    wbraid: str(l.wbraid),
    gbraid: str(l.gbraid),
    click_timestamp: str(l.clickAt),
    ...utmFields(l),
    // Idempotency. Same value as the JSON format's leadId, same fallback, because the whole
    // point is that a replay of one lead is recognisable as the same lead.
    lead_id: str(l.leadId) || str(l.receivedAt),
    // Consent, as the literal yes/no strings his spec asks for. Absent means "no": we hold
    // no documented consent for that person, so his side must not text them.
    sms_consent_transactional: consentField(l, "smsConsentTransactional"),
    sms_consent_marketing: consentField(l, "smsConsentMarketing"),
  };
};

// The exact bytes to send, and what to call them. Kept together because the signature is
// computed over these bytes: splitting the body from its content type is how a signature
// ends up covering something other than what was transmitted.
export function crmBody(client, lead) {
  if (crmFormat(client) === "form") {
    const p = crmFormPayload(client, lead);
    const params = new URLSearchParams();
    // Every key, including the empty ones, for the stable-shape reason above.
    for (const k of Object.keys(p)) params.append(k, p[k]);
    return { text: params.toString(), contentType: "application/x-www-form-urlencoded" };
  }
  return { text: JSON.stringify(crmPayload(client, lead)), contentType: "application/json" };
}

// A shared secret lets the receiving end prove the request really came from us rather
// than from anyone who guessed the URL. Signed over the EXACT bytes that are sent, so a
// re-serialization on either side cannot silently invalidate it.
export async function signBody(bodyText, secret) {
  if (!secret) return "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(bodyText));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// What gets written onto the lead afterwards. This is the record that makes a failure
// visible in the OS instead of ending its life in a log nobody reads.
export const forwardResult = ({ ok, status, error, attempts, at } = {}) => ({
  ok: !!ok,
  at: at || new Date().toISOString(),
  ...(status ? { status: Number(status) } : {}),
  ...(attempts ? { attempts: Number(attempts) } : {}),
  // Trimmed: this is shown on a lead row, not in a log viewer.
  ...(error ? { error: String(error).slice(0, 200) } : {}),
});

// Only a client who has actually been given a webhook gets one attempted, and only over
// https. An http endpoint would put a customer's name, email and phone across the open
// internet, which is not a thing to do quietly on someone else's behalf.
export const crmTarget = (client) => {
  const c = client || {};
  // Lives with the rest of the campaign configuration, which is where it is edited. The
  // root-level fallback is for a record written before it moved there.
  const cs = c.campaignSetup || {};
  const raw = String(cs.crmWebhook || c.crmWebhook || "").trim();
  if (!raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  return { url: u.toString(), secret: String(cs.crmWebhookSecret || c.crmWebhookSecret || "") };
};

// 🔴 FORWARD ONCE, EVER. Re-running the intake for a lead that already went (a retried
// submit, a replay, a future backfill) must not put a second copy in someone's sales
// pipeline. The lead itself carries the record, so the check survives restarts.
export const alreadyForwarded = (lead) => !!((lead || {}).crm || {}).ok;

// ─── The send itself ──────────────────────────────────────────────────────────
// Returns a forwardResult and NEVER throws. A CRM problem is not the visitor's problem:
// their lead is already stored, and the form must still say thank you.
export async function forwardLead(client, lead, { fetchImpl = fetch, now } = {}) {
  const target = crmTarget(client);
  if (!target) return null;                       // nothing configured, nothing to report
  if (alreadyForwarded(lead)) return null;        // already delivered

  // 🔴 The signature is over the EXACT bytes sent, whatever the serialisation, so the body
  // and its content type are decided once, together, before signing.
  const { text: bodyText, contentType } = crmBody(client, lead);
  let signature = "";
  try { signature = await signBody(bodyText, target.secret); } catch (_) { signature = ""; }

  let last = { error: "not attempted" };
  for (let attempt = 1; attempt <= CRM_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CRM_TIMEOUT_MS);
    try {
      const res = await fetchImpl(target.url, {
        method: "POST",
        headers: {
          "content-type": contentType,
          "user-agent": "BoldLine-OS",
          ...(signature ? { "x-boldline-signature": signature } : {}),
        },
        body: bodyText,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res && res.ok) {
        return forwardResult({ ok: true, status: res.status, attempts: attempt, at: now });
      }
      last = { status: res && res.status, error: `the CRM replied ${res && res.status}` };
      if (!shouldRetry({ status: res && res.status })) break;
    } catch (e) {
      clearTimeout(timer);
      const aborted = e && (e.name === "AbortError" || /abort/i.test(String(e.message || "")));
      last = { error: aborted ? `no answer within ${CRM_TIMEOUT_MS / 1000} seconds` : String((e && e.message) || e) };
      if (!shouldRetry({ networkError: true })) break;
    }
  }
  return forwardResult({ ok: false, ...last, attempts: CRM_MAX_ATTEMPTS, at: now });
}
