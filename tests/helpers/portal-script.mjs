// The portal's browser script is assembled inside a TEMPLATE LITERAL, so the text in the
// file is NOT the text the browser runs: `\/` in the source becomes `/` in the output.
//
// Any test that wants to read or run that script has to evaluate the literal first.
// Reading the raw source instead is what hid the 2026-09-10 outage, where every button in
// the portal was dead for a day: `verify-field-formats` pulled `blUrl` straight out of the
// file and ran it, which only worked BECAUSE the escapes were collapsing. The test passed on
// a string that parses only in its broken form.
import { readFileSync } from "node:fs";

export const PORTAL_FILES = {
  live: "netlify/functions/portal.mjs",   // what Sebastian opens
  preview: "index.html",                  // the copy inside the OS
};

// Returns { lit, html, code } for a file, or null if the anchor has moved.
export function emittedPortalScript(file) {
  const s = readFileSync(new URL("../../" + file, import.meta.url), "utf8");
  const start = s.indexOf("`<script>var selUpgName");
  if (start < 0) return null;
  let i = start + 1, end = -1;
  while (i < s.length) {
    if (s[i] === "\\") { i += 2; continue; }
    if (s[i] === "`") { end = i; break; }
    i++;
  }
  if (end < 0) return null;
  const cl = { portalToken: "tok" };            // the one interpolation in the literal
  // eslint-disable-next-line no-eval
  const html = eval(s.slice(start, end + 1));
  return {
    lit: s.slice(start + 1, end),
    html,
    code: html.replace(/^<script>/, "").replace(/<\/script>$/, ""),
  };
}

// 🔴 ONE PORTAL (2026-10-07). The OS used to carry a hand-kept second copy of the portal for its
// preview, and a dozen suites checked that copy matched. It drifted anyway. The OS preview now
// fetches the real portal page and shows it in a srcdoc frame (PortalPreview in index.html), so
// "the preview has it too" is true by construction, as long as THIS stays true. Every suite that
// used to compare the two copies asserts this instead.
export function osShowsServedPortal(indexSrc) {
  const s = indexSrc ?? readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  return !/const makePortalHTML\s*=/.test(s)
    && /function PortalPreview\(/.test(s)
    && /fetch\("\/\.netlify\/functions\/portal\?token=" \+ encodeURIComponent\(tok\)/.test(s)
    && /<iframe srcDoc=\{html\}/.test(s)
    && /<PortalPreview client=\{client\}\/>/.test(s);
}
