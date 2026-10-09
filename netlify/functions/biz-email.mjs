// The OS side of a business's customer emails (KB `business-emails`). Signed-in only.
//   POST {action:"sniff", url}                 pull the logo, brand colour and name from its own website
//   POST {action:"test-sender", clientId}      prove the business's own From address works (a real send to Bryson)
//   POST {action:"sample", clientId, kind}     email Bryson a sample: confirmation | reminder | review | rebook
//   POST {action:"read-brand", clientId, path, type}   read colours and typefaces out of an uploaded brand file (KB brand-kit)
// 🔴 Only the test send writes, and only `emailSenderStatus` (server-owned; the OS never saves over it).
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { BRAND_READ_PROMPT, BRAND_FILE_TYPES, parseBrandRead } from "../lib/brand-kit.mjs";
import { humanize } from "../lib/humanize.mjs";
import { SUPABASE_URL, sendEmail } from "../lib/report-shared.mjs";
import { isOwned } from "../lib/owned.mjs";
import { bookingConfirmEmail } from "../lib/booking.mjs";
import { bizEmailHTML, bizEmailText } from "../lib/biz-email-shell.mjs";
import { EMAIL_RE, brandFromHTML, safePublicUrl, buildCustomerEmail, sendAsBusiness, customerEmailsOf } from "../lib/biz-email.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// Fetch a public page, following at most three redirects by hand so every hop passes the same check.
async function fetchPage(url) {
  let u = safePublicUrl(url);
  for (let hop = 0; u && hop < 4; hop++) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(u, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; brand-check)", accept: "text/html" } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = safePublicUrl(new URL(r.headers.get("location"), u).href); continue; }
      if (!r.ok) return { error: `The site answered ${r.status}.` };
      const reader = r.body.getReader(); const parts = []; let n = 0;
      while (n < 1500000) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; }
      try { reader.cancel(); } catch (e) {}
      return { html: Buffer.concat(parts.map((p) => Buffer.from(p))).toString("utf8"), url: u };
    } catch (e) { return { error: "The site did not answer in time." }; }
    finally { clearTimeout(t); }
  }
  return { error: "That address has to be a public website starting with https://." };
}

const SAMPLE = (now) => ({ id: "sample", packageId: "sample", packageName: "Full Detail", price: "$199", minutes: 180,
  start: new Date(now + 26 * 36e5).toISOString(), end: new Date(now + 29 * 36e5).toISOString(), name: "Sam Sample", email: "sample@example.com",
  phone: "(480) 555-0100", address: "123 Main St, Gilbert, AZ", status: "booked", deposit: null });

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "Not signed in" }, 401);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: u, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !u || !u.user) return json({ ok: false, error: "Not signed in" }, 401);
  let body = {}; try { body = await req.json(); } catch (e) {}

  if (body.action === "sniff") {
    const page = await fetchPage(body.url);
    if (page.error) return json({ ok: false, error: page.error });
    return json({ ok: true, brand: brandFromHTML(page.html, page.url), website: page.url });
  }

  const { data: row, error } = await db.from("clients").select("id, data").eq("id", String(body.clientId || "")).maybeSingle();
  if (error || !row || !row.data) return json({ ok: false, error: "That business could not be found." }, 404);
  // Reading a brand file works for every client's Brand kit; the customer-email actions are his own businesses only.
  if (body.action !== "read-brand" && !isOwned(row.data)) return json({ ok: false, error: "That business could not be found." }, 404);
  const cl = { ...row.data, id: row.data.id || row.id };
  const owner = process.env.OWNER_EMAIL;
  if (!owner) return json({ ok: false, error: "OWNER_EMAIL is not set, so there is nowhere to send it." }, 500);

  if (body.action === "test-sender") {
    // The address typed in the OS a moment ago may not have reached the database yet, so it comes along too.
    const address = String(body.address || ((cl.emailSender || {}).address) || "").trim();
    if (!EMAIL_RE.test(address)) return json({ ok: false, error: "Add the email address to send from first." });
    const parts = { heading: "Your emails are set up.", paras: [`This test came from ${address}. From now on, emails to ${cl.name}'s customers come from this address.`] };
    let status, err = "";
    try {
      await sendEmail({ to: owner, subject: `Test from ${cl.name}`, html: bizEmailHTML(cl, parts), text: bizEmailText(cl, parts), fromName: cl.name, fromAddress: address, replyTo: address });
      status = { address, verified: true, verifiedAt: new Date().toISOString() };
    } catch (e) {
      err = String((e && e.message) || e);
      status = { address, verified: false, failedAt: new Date().toISOString(), error: err.slice(0, 300) };
    }
    // Read again right before writing, and touch only this key.
    const { data: fresh } = await db.from("clients").select("data").eq("id", row.id).maybeSingle();
    if (fresh && fresh.data) await db.from("clients").update({ data: { ...fresh.data, emailSenderStatus: status }, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (status.verified) return json({ ok: true, status });
    const domain = address.split("@")[1];
    return json({ ok: false, status, error: /domain|verif/i.test(err)
      ? `${domain} isn't set up in the email service yet, so it can't send as ${address}. Finish the domain setup, then test again.`
      : "The test email did not send. Try again in a minute." });
  }

  // Read the colours and typefaces out of an uploaded brand file (KB brand-kit). The file was uploaded to this
  // business's own storage folder a moment ago; only a path inside that folder is accepted.
  if (body.action === "read-brand") {
    const path = String(body.path || "");
    if (!path.startsWith(`${row.id}/brand-file/`) || path.includes("..")) return json({ ok: false, error: "That file could not be found." }, 400);
    const kind = BRAND_FILE_TYPES[String(body.type || "")];
    if (!kind) return json({ ok: false, error: "Use a PDF, PNG, JPG or WEBP file." }, 400);
    const { data: pub } = db.storage.from("client-media").getPublicUrl(path);
    const block = { type: kind, source: { type: "url", url: pub.publicUrl } };
    const anthropic = new Anthropic();
    let lastErr = null;
    for (const model of ["claude-sonnet-5-5", "claude-sonnet-5"]) {
      try {
        const msg = await anthropic.messages.create({ model, max_tokens: 1200, messages: [{ role: "user", content: [block, { type: "text", text: BRAND_READ_PROMPT }] }] });
        const text = (msg.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
        const read = parseBrandRead(text);
        read.colors = read.colors.map((c) => ({ ...c, name: humanize(c.name) }));   // house rule: NEVER use a dash in anything shown
        if (!read.colors.length && !read.headingFont && !read.bodyFont) return json({ ok: false, error: "No brand colours or fonts were found in that file. Type them in instead." });
        return json({ ok: true, ...read });
      } catch (e) { lastErr = e; }
    }
    console.error("read-brand failed:", lastErr && lastErr.message);
    return json({ ok: false, error: "The file could not be read just now. Try again in a minute, or type the colours in." });
  }

  if (body.action === "sample") {
    const kind = String(body.kind || "");
    const now = Date.now();
    const b = { ...SAMPLE(now), deposit: (cl.booking && (cl.booking.packages || []).find((p) => p.depositLink)) ? { amount: "$50", link: "https://example.com/deposit", paid: false } : null };
    let mail;
    if (kind === "confirmation") mail = bookingConfirmEmail(cl, b);
    else if (kind === "reminder" || kind === "rebook") mail = buildCustomerEmail(cl, kind, b, { base: process.env.URL, key: "sample" });
    else if (kind === "review") {
      if (!customerEmailsOf(cl).reviewUrl) return json({ ok: false, error: "Add the Google review link first." });
      mail = buildCustomerEmail(cl, kind, b, { base: process.env.URL, key: "sample" });
    } else return json({ ok: false, error: "Unknown email" }, 400);
    try {
      const r = await sendAsBusiness(cl, { to: owner, subject: `Sample: ${mail.subject}`, html: mail.html, text: mail.text }, { send: sendEmail });
      return json({ ok: true, via: r.via });
    } catch (e) { return json({ ok: false, error: "The sample did not send. Try again in a minute." }); }
  }
  return json({ ok: false, error: "Unknown action" }, 400);
};
