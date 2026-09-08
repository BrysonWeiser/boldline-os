// Whether BoldLine's founding-client offer is still open, decided by the CLIENTS THEMSELVES
// rather than by a constant somebody has to remember to flip.
//
// Bryson, 2026-09-07: *"Make sure once I land a third client that once the contract is signed
// that triggers the copy and website banner to take down the offer."*
//
// 🔴 WHY THIS EXISTS. The offer (setup fee waived, no monthly minimum, first three clients)
// began life as one hardcoded sentence on the marketing site. Nothing in code knew it, so Deal
// Prep quoted the standard prices to a real prospect. That was fixed with a switch, and a
// switch is still something to forget: the day the third client signs, the site would keep
// advertising a free build worth $1,500 to $4,900 to everyone who lands on it, and Bryson
// would find out when somebody asked for it.
//
// So the source of truth is the count of signed clients. It cannot drift from reality because
// it IS reality.
export const FOUNDING_CLIENT_COUNT = 3;

// Who counts. Real, signed, non-internal, non-demo. `contractSigned` OR an active contract,
// because a client can be signed on paper (Stencil & Thread signed an emailed PDF) without
// ever passing through DocuSign.
export const isFoundingClient = (c) => {
  const cl = c || {};
  if (cl.internal || cl.demo) return false;
  return !!cl.contractSigned || cl.contractStatus === "active";
};

export const countFoundingClients = (clients) => (clients || []).filter(isFoundingClient).length;

// 🔴 MONOTONIC ON PURPOSE. Once three clients have signed the offer is spent forever, even if
// one later churns. "We gave the first three a free build" is a statement about history, and
// re-opening it because a client left would be re-advertising something already given away.
export const foundingOfferActive = (clients) => countFoundingClients(clients) < FOUNDING_CLIENT_COUNT;

// How many places are honestly left. Never negative, never used to invent urgency: the offer's
// limit is a count, not a deadline (see the Deal Prep prompt).
export const foundingSlotsLeft = (clients) =>
  Math.max(0, FOUNDING_CLIENT_COUNT - countFoundingClients(clients));
