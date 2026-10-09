// The look of every email a business sends its own customers (Bryson, 2026-10-09: "make sure the email comes
// from the business email for my other business not boldline media (make a way for you to brand the email
// based off of the business name and website when i add it to the my businesses tab)"). KB `business-emails`.
//
// Branded from the business itself: its logo (pulled from its own website, or set by hand), its brand colour,
// its name, phone and website in the footer. 🔴 Nothing in it may say or link BoldLine, and nothing a
// customer sees carries an emoji or a dash (standing rules). The button is filled through a gradient as well
// as a colour, because Gmail's dark mode repaints flat colours but never gradients (KB `email-branding-2026-10`).
//
// No imports on purpose: booking.mjs builds its confirmation with this, and site-render imports booking.mjs.

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const hex6 = (h) => /^#[0-9a-f]{6}$/i.test(String(h || ""));
const https = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const textOn = (hex) => { const L = lum(hex); return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? "#FFFFFF" : "#0B0B0C"; };

// The business's brand, from what it already has: the colour on the site we built (or its own site), the logo
// pulled from its website or set in the OS, and its public details.
export function bizBrand(cl) {
  const c = cl || {};
  const b = c.brand || {};
  const color = [b.color, c.website && c.website.brandColor, c.brandColor, c.landingPage && c.landingPage.brandColor].find(hex6) || "#111827";
  const d = ((c.websiteDeal || {}).domain) || {};
  const website = https(b.website) || (d.live && d.host ? `https://${d.host}/` : "");
  return {
    name: String(c.name || "").trim().slice(0, 80) || "Our team",
    color, on: textOn(color),
    // Brand colour as words: a light colour (a gold, a yellow) is unreadable as text on white.
    ink: textOn(color) === "#FFFFFF" ? color : "#374151",
    logo: https(b.logoUrl) || https(c.brandLogo) || https(c.landingPage && c.landingPage.logo),
    website, phone: String(c.businessPhone || c.callTrackingNumber || "").trim(), email: String(c.email || "").trim(),
    area: String(c.businessAddress || (c.campaignSetup || {}).serviceArea || "").trim(),
  };
}

// One email. Every piece of text is escaped here; callers pass plain words, never HTML.
//   heading      the big line
//   paras        plain paragraphs, in order
//   rows         [label, value] pairs for the details box
//   button       { href, label }  (https, tel or mailto only)
//   after        plain paragraphs under the button
//   unsubscribe  an https link, shown small in the footer (marketing emails must carry one)
export function bizEmailHTML(cl, { preheader = "", heading = "", paras = [], rows = [], button = null, after = [], unsubscribe = "" } = {}) {
  const B = bizBrand(cl);
  const okHref = (h) => /^(https:\/\/|tel:|mailto:)[^\s"'<>]+$/i.test(String(h || ""));
  const p = (t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151">${esc(t)}</p>`;
  const head = B.logo
    ? `<img src="${esc(B.logo)}" alt="${esc(B.name)}" height="44" style="display:block;height:44px;width:auto;max-width:220px;border:0">`
    : `<div style="font-size:19px;font-weight:800;letter-spacing:-.01em;color:${B.ink}">${esc(B.name)}</div>`;
  const box = rows.filter(([, v]) => v).length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;margin:4px 0 18px"><tr><td style="padding:14px 16px 2px">${rows.filter(([, v]) => v).map(([k, v]) => `<div style="margin:0 0 12px"><div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6B7280">${esc(k)}</div><div style="font-size:15px;color:#111827;white-space:pre-wrap">${esc(v)}</div></div>`).join("")}</td></tr></table>`
    : "";
  const btn = button && okHref(button.href)
    ? `<a href="${esc(button.href)}" style="display:inline-block;margin:2px 0 18px;padding:13px 24px;border-radius:10px;background:${B.color};background-image:linear-gradient(${B.color},${B.color});color:${B.on};font-weight:700;font-size:15px;text-decoration:none">${esc(button.label)}</a>`
    : "";
  const foot = [B.name, B.phone, B.website.replace(/^https:\/\//, "").replace(/\/$/, ""), B.area].filter(Boolean).map(esc).join(" &middot; ");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#ffffff;border:1px solid #E5E7EB;border-top:4px solid ${B.color};border-radius:14px">
<tr><td style="padding:22px 24px 4px">${head}</td></tr>
<tr><td style="padding:14px 24px 6px"><div style="font-size:22px;font-weight:700;line-height:1.3;color:#111827;margin:0 0 14px">${esc(heading)}</div>
${paras.filter(Boolean).map(p).join("")}${box}${btn}${after.filter(Boolean).map(p).join("")}</td></tr>
</table>
<div style="max-width:540px;font-size:12px;line-height:1.6;color:#9CA3AF;margin-top:14px;padding:0 12px">${foot}${unsubscribe && https(unsubscribe) ? `<br><a href="${esc(unsubscribe)}" style="color:#9CA3AF">Unsubscribe from these emails</a>` : ""}</div>
</td></tr></table></body></html>`;
}

// The same email as plain text, for mail apps that show text only.
export function bizEmailText(cl, { heading = "", paras = [], rows = [], button = null, after = [], unsubscribe = "" } = {}) {
  const B = bizBrand(cl);
  return [heading, "", ...paras.filter(Boolean).flatMap((t) => [t, ""]),
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), rows.length ? "" : null,
    button && button.href ? `${button.label}: ${button.href.replace(/^tel:/, "")}` : null, button ? "" : null,
    ...after.filter(Boolean).flatMap((t) => [t, ""]),
    [B.name, B.phone, B.website].filter(Boolean).join(" | "),
    unsubscribe ? `Unsubscribe: ${unsubscribe}` : null].filter((x) => x !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
