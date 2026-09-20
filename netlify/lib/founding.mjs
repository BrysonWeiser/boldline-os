// Whether BoldLine's founding-client offer is still open, decided by the CLIENTS THEMSELVES
// rather than by a constant somebody has to remember to flip.
//
// Bryson, 2026-09-07: *"Make sure once I land a third client that once the contract is signed
// that triggers the copy and website banner to take down the offer."*
//
// 🔴 WHY THIS EXISTS. The offer (setup fee waived, no monthly minimum, a fixed number of clients)
// began life as one hardcoded sentence on the marketing site. Nothing in code knew it, so Deal
// Prep quoted the standard prices to a real prospect. That was fixed with a switch, and a
// switch is still something to forget: the day the third client signs, the site would keep
// advertising a free build worth $1,500 to $4,900 to everyone who lands on it, and Bryson
// would find out when somebody asked for it.
//
// So the source of truth is the count of signed clients. It cannot drift from reality because
// it IS reality.
// 🔴 CHANGE THE NUMBER HERE AND NOWHERE ELSE. Bryson widened it from 3 to 5 on 2026-09-20.
// Everything that quotes the figure reads it from this constant or is checked against it:
// the OS mirror below in index.html, the Deal Prep sales prompt, the "offer is spent" alert,
// and the two banners on the marketing site, whose English wording is pinned to this number by
// `verify-founding-offer` so the site can never advertise a different count from the one the
// code enforces.
//
// 🔴 RAISING IT RE-OPENS THE OFFER. `foundingOfferActive` compares a live count against this,
// so going from 3 to 5 with three already signed turns the banner back on and starts quoting
// founding terms again. That is the intended effect. Lowering it below the number already
// signed simply closes the offer, which is also correct.
export const FOUNDING_CLIENT_COUNT = 5;

// Who counts. Real, signed, non-internal, non-demo. `contractSigned` OR an active contract,
// because a client can be signed on paper (Stencil & Thread signed an emailed PDF) without
// ever passing through DocuSign.
export const isFoundingClient = (c) => {
  const cl = c || {};
  if (cl.internal || cl.demo) return false;
  return !!cl.contractSigned || cl.contractStatus === "active";
};

export const countFoundingClients = (clients) => (clients || []).filter(isFoundingClient).length;

// 🔴 MONOTONIC ON PURPOSE. Once the places are taken the offer is spent forever, even if one
// later churns. "We gave our first clients a free build" is a statement about history, and
// re-opening it because a client left would be re-advertising something already given away.
export const foundingOfferActive = (clients) => countFoundingClients(clients) < FOUNDING_CLIENT_COUNT;

// How many places are honestly left. Never negative, never used to invent urgency: the offer's
// limit is a count, not a deadline (see the Deal Prep prompt).
export const foundingSlotsLeft = (clients) =>
  Math.max(0, FOUNDING_CLIENT_COUNT - countFoundingClients(clients));
