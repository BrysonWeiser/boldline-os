// The gold button in every client email (Bryson, 2026-10-07, a screenshot of the free website check in
// Gmail on his iPhone: "the button is too dark"). Gmail's iPhone app in dark mode recolours every email
// it shows, and it turned the gold button a muddy olive. It never recolours pictures, so each fixed label
// is a picture of the button (drawn by scripts/build-email-buttons.mjs, hosted on the marketing site).
//
// The picture sits on a gold cell, so if pictures are switched off the reader still sees a gold button
// with the words on it. A label with no picture (the newsletter's, which the AI writes) gets the drawn
// button, with the gold also set as a background image, which Gmail leaves alone, so it stays gold.
import { EMAIL_GOLD, EMAIL_SANS } from "./email-brand.mjs";
import { EMAIL_BUTTON_IMAGES, EMAIL_BUTTON_VERSION } from "./email-button-images.mjs";

export const EMAIL_BUTTON_BASE = `https://boldlinemedia.com/email/${EMAIL_BUTTON_VERSION}/`;
export const EMAIL_BUTTON_INK = "#15110A";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const goldCell = `border-radius:10px;background:${EMAIL_GOLD};background-image:linear-gradient(${EMAIL_GOLD},${EMAIL_GOLD})`;

export function emailButton(label, url, { margin = "8px auto 6px" } = {}) {
  if (!url) return "";
  const pic = EMAIL_BUTTON_IMAGES[label];
  const href = esc(url);
  const inner = pic
    ? `<a href="${href}" style="display:block;border-radius:10px;text-decoration:none"><img src="${EMAIL_BUTTON_BASE}${pic.file}" width="${pic.w}" height="${pic.h}" alt="${esc(label)} &rarr;" style="display:block;border:0;outline:none;border-radius:10px;width:${pic.w}px;height:${pic.h}px;font-family:${EMAIL_SANS};font-size:14px;font-weight:700;line-height:${pic.h}px;color:${EMAIL_BUTTON_INK};text-align:center"></a>`
    : `<a href="${href}" style="display:inline-block;padding:13px 32px;font-family:${EMAIL_SANS};font-size:14px;font-weight:700;color:${EMAIL_BUTTON_INK};text-decoration:none;border-radius:10px">${esc(label)} &rarr;</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:${margin}"><tr><td align="center" style="${goldCell}">${inner}</td></tr></table>`;
}
