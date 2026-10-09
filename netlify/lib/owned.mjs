// BoldLine's own account versus a business Bryson owns (Bryson, 2026-10-07: a car detailing business
// with a friend, run from the OS like a client). Both are records flagged `internal`, which keeps every
// money and relationship rule that protects the house account: never billed or invoiced, no contract,
// no client portal (an owned business has its own view-only business portal, biz-portal.mjs), no client emails, never counted as a client, never the founding offer. An owned business
// also carries `owned`, which says it is NOT BoldLine: its ads, pages and reports speak for that
// business, and nothing that means "BoldLine's own account" may pick it.
//
// No imports on purpose, so anything can use these without an import loop.
export const isHouse = (c) => !!(c && c.internal && !c.owned);
export const isOwned = (c) => !!(c && c.internal && c.owned);
