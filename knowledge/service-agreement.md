---
name: service-agreement
topic: OS app
task: change the client service agreement / contract template, its clauses, or how it adapts per package
keywords: [makeContractHTML, service agreement, contract template, early termination fee, ETF, holdover, arbitration, no guarantee, indemnification, liability cap, BL_SIGN_HERE, portfolio rights, per-lead, qualified lead, ROAS bonus]
status: verified
summary: Full lawyer-style Advertising Services Agreement — BUILT 2026-07-16, replaces the old one-page stub. One data-driven template (makeContractHTML in index.html) serves every package — fees, term, features, per-lead fee (only when the niche has one), and ROAS bonus (only on ecom packages) all pull from client+package data, with section numbers computed so conditional sections never break the numbering. AZ law + AAA arbitration (remote-friendly) for national/international use. Both-sides exits: 30-day notice; client early exit = 1 month ETF + term-discount clawback; agency early exit = pro-rated refund, no ETF. Strong protections: no-results guarantee, platform-dependency shield, ad-spend liability firewall (hard constraint), liability cap (3 months fees), mutual indemnities, TCPA/consent responsibility on client, chargeback clause, e-sign validity. DRAFT — needs one-hour AZ attorney review before first real signature. /BL_SIGN_HERE/ DocuSign anchor preserved.
verified: 2026-07-16
---

**What/where:** `makeContractHTML(cl,pkg)` in index.html — used by the Contract tab preview
iframe, Copy, Download PDF (print), and docusign-send (which anchors the client signature on
the literal `/BL_SIGN_HERE/` string in the client sig box — NEVER remove it). Branded header
(LOGO + gold rule), Agreement No. `BLM-<last 8 of client id, uppercased>`, key-terms grid,
17-ish numbered sections, footer.

**Fully data-driven (works for every package):** package name/platform, effective monthly
(`cl.billingMonthly || pkg.price` — so term-priced renewals flow in), Standard Rate
(`pkg.price`, quoted inside the ETF clawback), setup fee, committed term
(`cl.contractTermMonths`), start/end, optimization cadence, features (PKG_FEATURES →
ALL_FEATURES labels, 2-column list), per-lead fee (`PER_LEAD[cl.niche]`, section renders ONLY
when the niche has one), ROAS bonus (`pkg.roas`, ecom packages only), ad budget
(`cl.adBudget || pkg.adSpend`). **Section numbers are computed** (`nBase + offsets`) so the
conditional Per-Lead/Bonus sections shift everything correctly; the Holdover clause
cross-references the Termination section via `nTerm`. Client-supplied fields are HTML-escaped
(`esc()`), tested against injected markup.

**Key business decisions embedded (Bryson should ratify; each is one clause to change):**
- **ETF (client leaves early):** 30-day notice + fees accrued + **one month's management fee**
  (liquidated damages, deliberately NOT "all remaining months" — a court could void that as a
  penalty) + **term-discount clawback** (months already billed recalculated at the Standard
  3-month Rate). Ties directly into the term-pricing feature.
- **Agency early exit:** 30-day notice, pro-rated refund of prepaid unused, NO fee owed by client.
- **Holdover:** if the term lapses un-renewed, it AUTO-CONTINUES month-to-month at the
  then-current month-to-month rate (revenue protection, no campaign gap, nudges renewal).
- **Disputes:** AZ law; 30-day good-faith negotiation, then AAA binding arbitration, 1 arbitrator,
  seat AZ, English, remote allowed (international-friendly); small-claims + IP/confidentiality
  injunction carve-outs; jury + class waiver; prevailing party gets fees.
- **Portfolio rights:** agency may name the client + show anonymized results; client can revoke
  prospectively in writing.
- **Platform suspension >30 days (neither party's fault):** either side may exit without ETF.

**Protections checklist:** NO-GUARANTEE callout (caps, projections-are-illustrations);
platform-dependency shield (policy changes/suspensions/misreporting ≠ agency breach);
**ad-spend firewall** (client pays platforms directly, owns accounts, AGENCY NEVER
HOLDS/ADVANCES/LIABLE — the hard business constraint, in caps); setup fee non-refundable once
work begins; fees continue during client-caused delays; suspension for non-payment after
10 days + 1.5%/mo late interest; chargeback-before-dispute = material breach; taxes/VAT +
gross-up on client; USD only; English controls; CISG excluded; Qualified Lead definition
(form / 30-sec call / text-chat, dupes+spam excluded) + 10-day invoice dispute window +
"leads ≠ customers, no refund for non-conversion"; ROAS bonus measured by platform-reported
attribution; client owns Deliverables ON FULL PAYMENT (payment leverage), agency keeps Agency
Tools/know-how with perpetual license into Deliverables; mutual confidentiality (2 yrs);
client is data controller, responsible for consent/TCPA on automated SMS/email follow-up sent
as its agent (Twilio lead-followup!); mutual liability cap = 3 months' fees, no consequentials,
12-month claim window; client indemnifies for its products/claims/compliance, agency for its
own IP infringement + willful misconduct; independent contractors; 12-month non-solicit;
force majeure; e-sign validity (E-SIGN + AZ ETA); notices by email.

**Client portal access (2026-07-16):** the portal's Contract tab now shows the FULL agreement
(not just a status card) — embedded iframe + "Download / Print a Copy" button, in BOTH portal
copies (portal.js and index.html makePortalHTML). Server side renders via
`netlify/lib/contract-shared.cjs` — a CJS port of makeContractHTML (LOGO is a param: portal
passes /logo.png). **If the agreement template changes in index.html, re-sync contract-shared.cjs**
(extraction recipe: grab ALL_FEATURES→PACKAGES_DB block, PER_LEAD, monthsLabel, makeContractHTML
from index.html; swap the LOGO global for a param). srcdoc escaping = only & and " need escaping.
Browser-verified via headless Chromium (iframe renders agreement, print button wired).

**NOT legal advice — before first real client:** (1) one-hour review by an AZ attorney;
(2) confirm the LLC's EXACT registered legal name (template says "BoldLine Media LLC");
(3) consider swapping brysonaweiser@gmail.com → bryson@boldlinemedia.com when custom email
lands. Verified: Babel transpile OK + node render tests across g-growth/Roofing (per-lead),
e-growth (ROAS), c-launch (neither) — strict section ordering, correct conditionals, xref,
escaping — plus headless-Chromium visual check (branded header renders).
