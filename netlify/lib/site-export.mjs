// Handing a website over to a client who bought it outright (KB `demo-sites`, agreement WA-8 "Handover").
//
// Bryson, 2026-10-20: "$2500 ... unless they want to buy it straight up and host it and manage it themselves". The
// agreement promises "the complete Website files (every page, ready to put online)". So this renders every page with
// the client's own domain as its address and packs them into one zip, with nothing in it that depends on BoldLine:
//  - links point at THEIR domain, never ours;
//  - the contact form opens the visitor's email app addressed to the business (site-render `__mailto`), because our
//    lead intake will not be there for them;
//  - our online booking runs on our servers, so the buttons go where the client chose on the download card instead
//    (their own booking app, their phone, or the form), plus their payment link if they gave one (own-site-setup);
//  - no visitor counter, no preview guard, nothing indexed as "noindex";
//  - the photos are copied into the zip when they fit, so they keep working if their source ever moves.
// A README tells their developer what is in it and how to connect the form to a form service if they want one.

import { deflateRawSync } from "node:zlib";
import { renderSite, pagesFor } from "./site-render.mjs";
import { sitemapXML, robotsTXT, cleanDomain } from "./site-domain.mjs";
import { applySetup, setupWords } from "./own-site-setup.mjs";

// ── A small zip writer (no dependency). Deflate where it helps, store where it does not (photos). ──────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (buf) => { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

export function zipFiles(files, when = new Date()) {
  const dosTime = ((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()) & 0xFFFF;
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(String(f.name).replace(/^\/+/, ""), "utf8");
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), "utf8");
    const packed = deflateRawSync(raw, { level: 9 });
    const useDeflate = packed.length < raw.length;
    const body = useDeflate ? packed : raw;
    const crc = crc32(raw);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(useDeflate ? 8 : 0, 8);
    head.writeUInt16LE(dosTime, 10); head.writeUInt16LE(dosDate, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18); head.writeUInt32LE(raw.length, 22); head.writeUInt16LE(name.length, 26); head.writeUInt16LE(0, 28);
    locals.push(head, name, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(raw.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    centrals.push(cen, name);
    offset += head.length + name.length + body.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

const IMG = /https:\/\/[^"'\s)<>]+?\.(?:jpe?g|png|webp|gif)(?:\?[^"'\s)<>]*)?/gi;
const extOf = (u) => ((u.split("?")[0].match(/\.(jpe?g|png|webp|gif)$/i) || [, "jpg"])[1]).toLowerCase().replace("jpeg", "jpg");

// The site as files. `fetchImpl` copies the photos in (skipped, and left pointing at their source, if they would make
// the download too big for one response or a photo will not come).
export async function exportSiteFiles(cl, { domain, email, setup = null, fetchImpl = fetch, maxImageBytes = 3.2e6, timeoutMs = 4500 } = {}) {
  const host = cleanDomain(domain);
  if (!host) throw new Error("Type the web address they'll use, like theirbusiness.com.");
  const mail = String(email || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new Error("Add the email their enquiries should go to on the Overview tab first.");
  const base = `https://${host}`;
  const intake = { ...((cl && cl.intake) || {}) };
  if (intake.how === "book") intake.how = "quote";
  let site = { ...cl, intake, booking: { ...((cl && cl.booking) || {}), on: false }, __mailto: mail };
  if (setup) site = applySetup(site, setup);
  const pages = pagesFor(site).filter((p) => p.id !== "blog" && p.id !== "book");
  let rendered = pages.map((p) => ({ name: p.path ? `${p.path}/index.html` : "index.html", html: renderSite(site, p.id, { base }) }));

  // Copy the photos in, once each.
  const urls = [...new Set(rendered.flatMap((r) => r.html.match(IMG) || []).filter((u) => !/fonts\.(googleapis|gstatic)\.com/.test(u)))].slice(0, 24);
  const images = [], kept = [];
  let total = 0;
  await Promise.all(urls.map(async (u, i) => {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetchImpl(u.replace(/&amp;/g, "&"), { signal: ctl.signal }); clearTimeout(tm);
      if (!r.ok) throw new Error(String(r.status));
      const buf = Buffer.from(await r.arrayBuffer());
      images[i] = { u, name: `images/photo-${i + 1}.${extOf(u)}`, buf };
    } catch { kept.push(u); }
  }));
  for (const im of images.filter(Boolean)) {
    if (total + im.buf.length > maxImageBytes) { kept.push(im.u); continue; }
    total += im.buf.length;
    rendered = rendered.map((r) => ({ ...r, html: r.html.split(im.u).join(`${base}/${im.name}`) }));
    im.used = true;
  }

  const readme = [
    `${(cl && cl.name) || "Your"} website`,
    "",
    "What's in here",
    "  index.html and one folder per page. Upload everything to the main (root) folder of your web host, keeping the",
    `  folders as they are. The pages expect to live at ${base}/, so point that address at your host.`,
    "  images/  the photos used on the site.",
    "  sitemap.xml and robots.txt  help search engines find every page.",
    "",
    "Booking and payments",
    `  ${setup ? setupWords(setup, cl) : "Every Book button opens your contact form, which sends the request to your email."}`,
    ...(setup && (setup.link || setup.pay) ? [
      "  Switched to a different app? Change it on the Website tab of your BoldLine portal and download a fresh copy,",
      "  then upload it the same way as before. Or your web developer can replace the address below in every .html file:",
      ...[setup.link, setup.pay].filter(Boolean).map((u) => `  ${u}`),
    ] : ["  To change this, update it on the Website tab of your BoldLine portal and download a fresh copy."]),
    "",
    "The contact form",
    `  It opens the visitor's own email app with their message addressed to ${mail}. If you'd rather it sent`,
    "  straight from the page, your web developer can connect it to any form service (Netlify Forms, Formspree and",
    "  others work with it).",
    "",
    kept.length ? `Photos still loaded from their original source: ${kept.length}. Your developer can download and swap them in.` : "All photos are included.",
    "",
    "Made by BoldLine Media.",
  ].join("\n");

  const files = rendered.map((r) => ({ name: r.name, data: r.html }))
    .concat(images.filter((im) => im && im.used).map((im) => ({ name: im.name, data: im.buf })))
    .concat([{ name: "sitemap.xml", data: sitemapXML(base, pages, []) }, { name: "robots.txt", data: robotsTXT(base) }, { name: "README.txt", data: readme }]);
  return { host, files, pages: pages.length, photos: images.filter((im) => im && im.used).length, linked: kept.length };
}
