// What to do when DocuSign tells us where an envelope got to.
//
// Bryson, 2026-08-27, minutes after going live: *"can you make it so the os automatically
// knows when he signed and updates it and sends me a notification."*
//
// 🔴 THE DECISION IS PURE AND LIVES HERE, SEPARATE FROM THE FETCHING. Everything that
// decides whether a client's contract flips to active takes an envelope and a client and
// returns what should change. Nothing here talks to a network, so every branch — including
// the ones that only happen when a client declines at 2am — is testable without pretending
// to be DocuSign. The fetching lives in the scheduled function and does nothing else.

// DocuSign's envelope states, and what each one means for a client record.
//   created / sent / delivered  — in flight. "delivered" means OPENED, not signed.
//   completed                   — every signer has signed. This is the one that matters.
//   declined                    — a signer refused. Urgent: a deal just died or stalled.
//   voided                      — cancelled, or it expired unsigned. Also urgent.
// 🔴 "delivered" IS NOT SIGNED. It is the single most misread status in this API, and
// treating it as signed would mark contracts active the moment a client opened the email.
export const IN_FLIGHT = ["created", "sent", "delivered"];
export const TERMINAL = ["completed", "declined", "voided"];

export const isSigned = (status) => String(status || "").toLowerCase() === "completed";

// Which clients are worth asking DocuSign about at all. Anything else is a wasted call, and
// on a plan with a monthly send ceiling the API budget is not free.
export const needsCheck = (client) => {
  const c = client || {};
  if (!c.docusignEnvelopeId) return false;      // never sent through DocuSign
  if (c.contractSigned) return false;           // 🔴 already done: never re-flip, never re-alert
  if (c.internal) return false;                 // the house account has no counterparty
  return true;
};

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ""; }
};

// The whole decision, as data. Returns:
//   { patch, alert, email, note }  — patch is what to merge onto the client (null = nothing),
//                                    alert is what to tell Bryson (null = stay quiet),
//                                    email is a client email type to auto-send (null = none).
//
// 🔴 A CLIENT RECORD IS NEVER TOUCHED ON UNCERTAINTY. An unknown status, a missing envelope,
// or a failed lookup all return an empty decision. A contract silently flipping to active
// because an API hiccuped is far worse than one Bryson ticks by hand.
export function decideFromEnvelope(client, envelope, now = new Date()) {
  const c = client || {};
  const none = { patch: null, alert: null, email: null, note: "" };
  if (!needsCheck(c)) return { ...none, note: "not awaiting a signature" };

  const status = String((envelope || {}).status || "").toLowerCase();
  if (!status) return { ...none, note: "no status returned" };

  const name = c.name || "This client";
  const at = (envelope || {}).completedDateTime || (envelope || {}).statusChangedDateTime || now.toISOString();

  if (status === "completed") {
    return {
      patch: {
        contractSigned: true,
        contractStatus: "active",
        contractSignedAt: at,
        docusignStatus: "completed",
      },
      alert: {
        severity: "green",
        title: `${name} signed the agreement`,
        body: `${name} completed the DocuSign envelope on ${fmtDate(at)}. Their contract is now active in the OS. Next: get their ad account open and the campaign built.`,
        smsText: `${name} just signed. Contract is active.`,
      },
      // The moment a client signs is exactly when a confirmation is worth having, and
      // sending it by hand is the kind of thing that gets forgotten on a busy day.
      email: "contract_signed",
      note: "signed",
    };
  }

  // 🔴 DECLINED AND VOIDED MUST BE LOUD. The failure mode this whole job exists to prevent
  // is a contract sitting in limbo that nobody looks at. A dead envelope is MORE urgent
  // than a signed one, because it needs a phone call today.
  if (status === "declined") {
    const who = (envelope || {}).declinedReason || "";
    return {
      patch: { docusignStatus: "declined", contractStatus: "pending" },
      alert: {
        severity: "red",
        title: `${name} DECLINED the agreement`,
        body: `${name} declined to sign the DocuSign envelope${who ? `. Reason given: ${who}` : ", with no reason given"}. Call them today, do not email. Nothing in the OS has been changed beyond recording the decline.`,
        smsText: `${name} declined the agreement. Call them.`,
      },
      email: null,
      note: "declined",
    };
  }

  if (status === "voided") {
    const why = (envelope || {}).voidedReason || "";
    return {
      patch: { docusignStatus: "voided", contractStatus: "pending" },
      alert: {
        severity: "red",
        title: `${name}'s agreement was voided`,
        body: `The DocuSign envelope for ${name} is voided${why ? `. Reason: ${why}` : ""}. That usually means it expired unsigned or was cancelled. Send a fresh one from their Contract tab.`,
        smsText: `${name}'s agreement voided. Send a new one.`,
      },
      email: null,
      note: "voided",
    };
  }

  if (IN_FLIGHT.includes(status)) {
    // Worth recording so the OS can show "opened but not signed", which is a genuinely
    // different thing from "sent and ignored" when deciding whether to chase.
    const already = c.docusignStatus === status;
    return {
      patch: already ? null : { docusignStatus: status },
      alert: null,
      email: null,
      note: already ? "unchanged" : `now ${status}`,
    };
  }

  return { ...none, note: `unknown status: ${status}` };
}

// How long an envelope has sat unsigned, for the chase reminder.
export const daysWaiting = (client, now = new Date()) => {
  const sent = (client || {}).docusignSentAt;
  if (!sent) return null;
  const d = (now.getTime() - new Date(sent).getTime()) / 864e5;
  return Number.isFinite(d) && d >= 0 ? Math.floor(d) : null;
};

// 🔴 A NUDGE, ONCE, NOT EVERY RUN. This job runs several times an hour; alerting on every
// pass about the same unsigned contract would train Bryson to ignore the channel, which
// would then swallow the signature alert too.
export const NUDGE_AFTER_DAYS = 3;
export function decideNudge(client, now = new Date()) {
  if (!needsCheck(client)) return null;
  const d = daysWaiting(client, now);
  if (d == null || d < NUDGE_AFTER_DAYS) return null;
  if ((client || {}).docusignNudgedAt) return null;      // said once already
  const name = (client || {}).name || "A client";
  return {
    patch: { docusignNudgedAt: now.toISOString() },
    alert: {
      severity: "yellow",
      title: `${name} has not signed yet`,
      body: `The agreement for ${name} has been sitting unsigned for ${d} days. Worth a short call rather than another email. Their envelope is still open, so they can sign the original link.`,
      smsText: `${name} still has not signed (${d} days).`,
    },
  };
}
