---
name: client-email-center
topic: OS app
task: send branded, professional client emails (welcome, invoice, renewal, thank-you, etc.) from within the OS with one click
keywords: [client emails, email center, EmailCenterTab, client-email, client-emails-shared, welcome email, invoice email, receipt, past due, renewal, thank you, onboarding, ad account access, branded email, dark theme email, lifecycle emails, EMAIL_TYPES]
status: verified
summary: A per-client "Emails" tab lets Bryson preview, edit, and one-click-send 8 polished DARK-THEME lifecycle emails with the client's details auto-filled — welcome+portal, ad-account access, contract-signed, invoice, receipt, past-due, renewal, thank-you/offboarding. Templates + branding live server-side (client-emails-shared.mjs); client-email.mjs (owner-JWT) renders/sends via the existing Resend sender (report-shared.sendEmail), so they send today with no new config. Built 2026-07-30.
verified: 2026-07-30
---

**Why (Bryson, 2026-07-30):** wanted everything sent to clients to look professional + clean (not a plain email), **dark-themed** (not bright), sendable **from inside the OS with one click**, with client-specific info **auto-filled**, plus a **preview** and a way to **edit** before sending.

**The 8 emails (client lifecycle):** `welcome` (welcome + portal login + what's next), `onboarding_access` (grant BoldLine manager access to their ad account — reinforces "you own + pay for the account"), `contract_signed`, `invoice` (itemized setup + monthly, gold "Pay Securely Online" button → Stripe), `receipt` (payment confirmation), `past_due` (polite dunning + update-payment link), `renewal` (term-ending nudge), `thank_you` (offboarding + "your ad account stays yours" + final report). Catalog = `EMAIL_TYPES` in client-emails-shared.mjs; add a new one by adding a `T.<id>` template fn + an `EMAIL_TYPES` entry.

**Files:**
- `netlify/lib/client-emails-shared.mjs` — the **dark email shell** (`emailShell()`: #070810 bg, #0C0D18 card w/ gold top-border, serif "BoldLine Media" wordmark, table-based + all-inline styles so it survives email clients; `<meta color-scheme dark>`), content helpers (h1/p/button/detailBox/steps/signoff), the `T` template map, `EMAIL_TYPES` catalog, and `renderClientEmail(type, ctx)` → `{subject, html}`. Imports only `GOLD` + `escapeHTML` from report-shared. Signoff = "Bryson — BoldLine Media".
- `netlify/functions/client-email.mjs` — owner-JWT gated (same pattern as blog-admin/newsletter-admin). Actions: `types` (→ EMAIL_TYPES), `render` ({type, ctx} → subject+html), `send` ({to, subject, html} → sends via **report-shared `sendEmail`** = Resend + REPORTS_FROM_EMAIL). Sending needs only the already-set RESEND_API_KEY + REPORTS_FROM_EMAIL (client reports already use them), so **no new env vars / not gated on the domain move**.
- `index.html` `EmailCenterTab` — the **Emails** tab in ClientHub (added to TABS after Contract; hidden for `client.internal` My Ads). Lists the 8 with Preview buttons; opens a modal with a **Preview/Edit toggle** — Preview renders the real email in an `<iframe srcDoc>`, Edit uses the shared **VisualEditor** (WYSIWYG) on the body + an editable Subject; plus **Reset** (re-render defaults) and **Send Now**. On send it appends a `commLog` entry ("Sent \"<label>\" email to <email>"). `ctx` auto-fills from the client: businessName=client.name, contactName, packageName (pkg.name), monthly (billingMonthly||pkg.price), setup (billingSetup||pkg.setup), portalUrl (`origin/portal?token=<portalToken>`), date. `payUrl` is empty for now → templates fall back to the portal link for the Pay button.

**Verified 2026-07-30:** both new .mjs `node --check` clean; OS babel-compiles; all 8 templates rendered headlessly to PNG (dark brand correct, gold buttons, itemized invoice box, numbered steps) and sent to Bryson to review.

**Possible next touches (not built):** real Stripe payment-link/hosted-invoice URL wired into `payUrl` (right now the invoice Pay button → portal); a QR/"barcode" of the pay link in the invoice (Bryson mentioned "link or barcode" — link is done, QR is a future add); auto-send hooks (e.g., fire `welcome` on contract-signed, `receipt` on Stripe payment) instead of manual one-click. Light-mode note: emails are intentionally DARK per Bryson; a few email clients may force-light them, which is acceptable.
