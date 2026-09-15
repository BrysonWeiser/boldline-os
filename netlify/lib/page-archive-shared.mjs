// What makes a saved landing page safe to look at, and how one is named.
//
// Pure functions, so the neutralising can be tested against a REAL rendered page without a
// database, a browser or a network. That matters more here than in most places: this is the
// code that decides whether opening an old archive can create a lead on a live client.

export const ARCHIVE_BUCKET = "page-archives";

export const archivePath = (clientId, id) => `${clientId}/${id}.html`;

// 🔴 SUPABASE WILL NOT SERVE HTML. A public storage URL for an `.html` object comes back as
// `text/plain` no matter what content type it was uploaded with — Supabase does this on
// purpose so its storage cannot be used to host web pages. So the browser paints the source
// code. Bryson, 2026-09-15: *"i just saved a copy of the landing page for stencil & thread
// and i went to view it and it only shows code not the actual visual landing page"*.
//
// There is no upload option that changes this, so the file is served by our own function
// instead, which sets `text/html` itself. The URL is derived from the stored PATH rather
// than saved alongside it, so every archive saved before today starts rendering too, with
// nothing to re-save.
export const archiveViewUrl = (path) => `/.netlify/functions/page-archive?file=${encodeURIComponent(String(path || ""))}`;

// 🔴 THIS DOES NOT TRY TO RECOGNISE A CLIENT ID, AND THE FIRST VERSION'S BUG WAS THAT IT DID.
// It demanded a UUID. Client ids are `uid()` — `Math.random().toString(36).slice(2, 9)`, so
// `k3m9xz2` — and the seeded ones are `c1`. Every real saved page was refused with "that is
// not a saved page", and the test passed because its fixture was a UUID I had invented rather
// than a path the real code produces. The id format is not this function's business and never
// was: guessing it can only ever be wrong in the direction of locking Bryson out.
//
// What this IS for is making the string safe to hand to storage: exactly one `/`, no `.` in
// the first segment so `..` cannot appear, neither segment able to contain a slash, and an
// `.html` ending. Authorisation is a separate and much stronger check — the viewer looks the
// path up on the client record it names and refuses anything not listed there, which is also
// what makes a deleted archive stop serving even if the file itself lingers.
export const isArchivePath = (p) =>
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.html$/.test(String(p || ""));

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
// Removes the `js` class from the <body> tag, which is what gates the landing page's
// scroll-reveal resting state (`.js .reveal{opacity:0}`). With the scripts gone there is
// nothing left to reveal those sections, so the class has to go with them.
//
// Applied when an archive is WRITTEN and again when one is SERVED. The second is not
// belt-and-braces for its own sake: every page saved before 15 September 2026 is already in
// storage with the class baked in, and re-serving them correctly is the only way those start
// rendering without Bryson re-saving every one.
export const stripJsClass = (html) => String(html == null ? "" : html).replace(
  /(<body\b[^>]*\sclass\s*=\s*)("[^"]*"|'[^']*')/i,
  (m, lead, quoted) => {
    const q = quoted[0];
    const kept = quoted.slice(1, -1).split(/\s+/).filter((c) => c && c !== "js").join(" ");
    return `${lead}${q}${kept}${q}`;
  });

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

  // 🔴 6. THE PAGE HAS TO BE VISIBLE WITH EVERY SCRIPT GONE, AND ONCE IT WAS NOT.
  //    `.js .reveal{opacity:0}` is the landing page's scroll-reveal resting state, and the
  //    class that unhides it is added by a script — one of the scripts stripped above. The
  //    `js` class was also hard-coded onto the <body> server-side, so stripping the scripts
  //    left every revealed section invisible forever. The hero is not a `.reveal`, so a saved
  //    copy showed the header and nothing else. `landing.mjs` no longer writes that class,
  //    but this strips it too: a stored archive has to stand on its own, including one saved
  //    from a future renderer that reintroduces it.
  out = stripJsClass(out);

  const when = entry.at ? new Date(entry.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "";
  // 🔴 SAY WHAT IT IS, ON THE PAGE. Without this, a saved page is pixel-identical to the live
  // one, and the first time somebody opens the wrong tab they will believe they are looking at
  // a live site and act on it.
  const banner = `<div style="position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#12131F;color:#C8A84B;font:700 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:7px 12px;text-align:center;border-bottom:1px solid rgba(200,168,75,.35)">Saved copy${when ? ` from ${when}` : ""}. Nothing on this page works, it is a record of how it looked.</div><div style="height:30px"></div>`;
  out = /<body[^>]*>/i.test(out) ? out.replace(/(<body[^>]*>)/i, `$1${banner}`) : banner + out;
  return out;
}
