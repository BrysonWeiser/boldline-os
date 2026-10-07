// BoldLine's look in an email, in ONE place (Bryson, 2026-10-07: "lets look at the email branding",
// then "fix it"). Before this the header was written out three times (client emails, the newsletter,
// the reports) in two different designs, and the reports a client gets every week looked like they
// came from a different company. Every client and subscriber email now takes its header from here.
//
// No imports on purpose: report-shared, client-emails-shared and newsletter-shared all use this,
// and report-shared is imported by the other two, so anything here that imported back would loop.
//
// The mark is the gold B from the website, hosted on the marketing site. Email apps that block
// images still show the wordmark beside it, so nothing reads as broken when pictures are off.

export const EMAIL_GOLD = "#C8A84B";
// The site's typeface is Inter. Most email apps cannot load a web font, so the stack falls back
// to each device's own clean sans serif rather than the old Georgia serif, which read dated.
export const EMAIL_SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const EMAIL_LOGO_URL = "https://boldlinemedia.com/logo.png";
export const EMAIL_DARK = { bg: "#070810", card: "#0C0D18", cardBorder: "rgba(255,255,255,.08)", head: "#F5F3EA", body: "#C6CAE0", muted: "#8B91B8", faint: "#5A6078", chip: "#12131F" };

// The header row: logo mark + "BoldLine Media", centred. Returns a <tr>, to sit first in the
// 560px column table every BoldLine email uses.
export const brandHeaderRow = () => `<tr><td align="center" style="padding:4px 0 24px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto"><tr>
          <td style="padding-right:11px;vertical-align:middle"><img src="${EMAIL_LOGO_URL}" width="26" height="30" alt="" style="display:block;border:0;outline:none;width:26px;height:30px"></td>
          <td style="vertical-align:middle;font-family:${EMAIL_SANS};font-size:18px;font-weight:700;letter-spacing:-.01em;color:${EMAIL_DARK.head}">BoldLine <span style="color:${EMAIL_GOLD}">Media</span></td>
        </tr></table>
      </td></tr>`;

// Headlines inside the card: the site's heading style (tight, bold sans), not a serif.
export const emailH1 = (t) => `<h1 style="margin:0 0 16px;font-family:${EMAIL_SANS};font-size:24px;font-weight:700;letter-spacing:-.02em;line-height:1.25;color:${EMAIL_DARK.head}">${t}</h1>`;
