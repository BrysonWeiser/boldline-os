// What makes a saved landing page safe to look at, and how one is named.
//
// Pure functions, so the neutralising can be tested against a REAL rendered page without a
// database, a browser or a network. That matters more here than in most places: this is the
// code that decides whether opening an old archive can create a lead on a live client.

export const ARCHIVE_BUCKET = "page-archives";

export const archivePath = (clientId, id) => `${clientId}/${id}.html`;

export function archiveEntry({ label, headline, clientId, now = new Date() } = {}) {
  const at = now.toISOString();
  const id = `${at.slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    at,
    // A saved page with no name is a row of identical timestamps nobody can pick from. The
    // headline is what he would recognise it by, so it is the default.
    label: String(label || headline || "Saved page").trim().slice(0, 120),
    path: archivePath(clientId, id),
  };
}

// 🔴 EVERYTHING HERE EXISTS BECAUSE A LANDING PAGE IS NOT AN INERT DOCUMENT.
//
// The live page carries a submit handler pointing at `lead-intake?token=<the client's REAL
// lead token>`, a Netlify form post, tracking pixels, a conversion tag and a phone link. Save
// it verbatim and every one of those still works months later, from a page nobody is running.
// Tapping the form to show somebody what it looked like would put a REAL LEAD on that client's
// record and forward it to their CRM.
//
// So the copy that goes into storage is already dead. Not the copy that gets displayed: doing
// it at display time would leave the live version sitting in a public bucket, one direct link
// away from being real again.
//
// 🔴 THE VISUAL RECORD IS UNTOUCHED. Only the plumbing is cut. That is the whole point of
// archiving the page rather than a screenshot, so anything that changes how it LOOKS would
// defeat the exercise.
export function neutraliseArchive(html, entry = {}) {
  let out = String(html == null ? "" : html);

  // 1. Every script. The submit handler, the click-id capture, the conversion tag, the pixel.
  //    A saved page needs to be looked at, never to run.
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "");

  // 2. Inline handlers, which survive the above because they are attributes, not scripts.
  out = out.replace(/\son(?:click|submit|change|input|load|error|focus|blur)\s*=\s*"[^"]*"/gi, "");
  out = out.replace(/\son(?:click|submit|change|input|load|error|focus|blur)\s*=\s*'[^']*'/gi, "");

  // 3. The form itself. `action` and `method` go, and it is disabled, so even a browser that
  //    somehow ran it has nowhere to send anything.
  out = out.replace(/<form\b([^>]*)>/gi, (m, attrs) => {
    const cleaned = String(attrs)
      .replace(/\saction\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "")
      .replace(/\smethod\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "")
      .replace(/\sdata-netlify\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "")
      .replace(/\snetlify(-honeypot)?\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, "");
    return `<form${cleaned} onsubmit="return false"><fieldset disabled style="border:0;margin:0;padding:0;min-width:0">`;
  });
  out = out.replace(/<\/form>/gi, "</fieldset></form>");

  // 4. 🔴 THE LEAD TOKEN MUST NOT SURVIVE IN THE TEXT. The scripts are gone, but the token was
  //    inside one of them, and this file lands in a PUBLIC bucket. Anyone holding it can post
  //    leads to that client for as long as it is valid. Belt and braces against a script tag
  //    this stripper ever fails to match.
  out = out.replace(/lead-intake\?token=[A-Za-z0-9_-]+/gi, "lead-intake?token=REMOVED");

  // 5. Links out. A saved page is a record, not a working brochure: a booking link still takes
  //    a real booking, and a phone link still rings the client.
  out = out.replace(/<a\b([^>]*?)\shref\s*=\s*("[^"]*"|'[^']*')/gi, "<a$1 data-archived-href=$2");

  const when = entry.at ? new Date(entry.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  // 🔴 SAY WHAT IT IS, ON THE PAGE. Without this, a saved page is pixel-identical to the live
  // one, and the first time somebody opens the wrong tab they will believe they are looking at
  // a live site and act on it.
  const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#12131F;color:#C8A84B;font:700 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:7px 12px;text-align:center;border-bottom:1px solid rgba(200,168,75,.35)">Saved copy${when ? ` from ${when}` : ""}. Nothing on this page works, it is a record of how it looked.</div><div style="height:30px"></div>`;
  out = /<body[^>]*>/i.test(out) ? out.replace(/(<body[^>]*>)/i, `$1${banner}`) : banner + out;
  return out;
}
