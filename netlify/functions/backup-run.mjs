// The nightly backup. Runs at 1:00am Phoenix, keeps the last five, emails the result.
//
// Bryson, 2026-09-11: *"I want to start keeping a backup data base of everything we have
// (the os, website, data base, etc.) I want to keep the last 5 and have you manage it but I
// also get an email each morning. I want you to run this everyday at 1am."*
//
// 🔴 READ ONLY AGAINST THE BUSINESS. Every table is SELECTed and nothing is ever written back
// to one. The only things this job writes are its own file in the backups bucket and the
// deletion of files past the fifth. A backup job with write access to the data it is
// protecting is the one job that can destroy everything in a single bad run.
//
// Why the copy is verified before anything is deleted: see the comment above the prune.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, sendEmail, GOLD, escapeHTML } from "../lib/report-shared.mjs";
import { dispatchAlert, withFailureAlert } from "../lib/alerts-shared.mjs";
import {
  BACKUP_BUCKET, BACKUP_TABLES, INVENTORY_BUCKETS, KEEP,
  backupName, isBackupName, toPrune, countWarnings, summarizeBackup,
  packSnapshot, unpackSnapshot, humanBytes, backupEmailText, verifyAgainst,
} from "../lib/backup-shared.mjs";

const PHOENIX = "America/Phoenix";
const phoenixStamp = (d = new Date()) =>
  d.toLocaleString("en-GB", { timeZone: PHOENIX, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

const emailHTML = ({ text, ok }) => {
  const bar = ok ? GOLD : "#DC2626";
  const body = String(text).split("\n").map((l) =>
    l.trim() === "" ? "<div style='height:10px'></div>"
      : `<p style="margin:0 0 6px;line-height:1.6;color:#1F2937;font-size:14px">${escapeHTML(l).replace(/^(\s+)/, (m) => "&nbsp;".repeat(m.length))}</p>`).join("");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
  <div style="margin-bottom:16px;text-align:center">
    <div style="font-size:15px;font-weight:700;letter-spacing:.06em;color:${GOLD};text-transform:uppercase">BoldLine Media</div>
    <div style="font-size:11px;color:#6B7280;margin-top:6px">Nightly Backup</div>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-left:4px solid ${bar};border-radius:12px;padding:22px">${body}</div>
  <div style="margin-top:16px;font-size:11px;color:#9CA3AF;text-align:center">Sent automatically every morning by BoldLine OS.</div>
</div></body></html>`;
};

export default async () => withFailureAlert("backup-run", async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const startedAt = new Date();

  // ── 1. Read every table ────────────────────────────────────────────────────
  // 🔴 FAIL-SOFT PER TABLE, LOUD IN THE SUMMARY. One unreadable table must not throw away the
  // twelve that read fine, and it must never pass silently either: a table missing from a
  // backup is only discovered on the morning somebody needs it back, which is the worst
  // possible morning to discover it. So it is recorded as an error and turns the email red.
  const data = {};
  const tables = [];
  for (const spec of BACKUP_TABLES) {
    const { table, order, cap } = spec;
    try {
      let q = supabase.from(table).select("*", { count: "exact" });
      if (cap) { if (order) q = q.order(order, { ascending: false }); q = q.limit(cap); }
      const { data: rows, error, count } = await q;
      if (error) throw new Error(error.message);
      data[table] = rows || [];
      tables.push({
        table, rows: (rows || []).length,
        bytes: JSON.stringify(rows || []).length,
        ...(cap ? { cap, total: count ?? null, truncated: (count ?? 0) > (rows || []).length } : {}),
      });
    } catch (e) {
      data[table] = null;
      tables.push({ table, rows: 0, error: String((e && e.message) || e).slice(0, 140) });
    }
  }

  // ── 2. Inventory the file buckets ──────────────────────────────────────────
  // Files, not rows. Recording what exists is what tells you later what is missing; copying
  // every image five times over would be five copies of the same megabytes for no extra safety.
  const buckets = [];
  for (const b of INVENTORY_BUCKETS) {
    try {
      const { data: files, error } = await supabase.storage.from(b).list("", { limit: 1000 });
      if (error) throw new Error(error.message);
      buckets.push({ bucket: b, files: (files || []).map((f) => ({ name: f.name, size: (f.metadata && f.metadata.size) || null })) });
    } catch (e) { buckets.push({ bucket: b, files: [], error: String((e && e.message) || e).slice(0, 140) }); }
  }

  const manifest = {
    takenAt: startedAt.toISOString(),
    phoenix: phoenixStamp(startedAt),
    // Which code this data belongs with. Restoring rows into a different version of the OS is
    // how a "successful" restore produces a broken system.
    commit: process.env.COMMIT_REF || null,
    tables,
    buckets: buckets.map((b) => ({ bucket: b.bucket, files: b.files.length, error: b.error || null })),
  };

  const name = backupName(startedAt);
  const packed = packSnapshot({ manifest, data, bucketFiles: buckets });

  // ── 3. Write it ────────────────────────────────────────────────────────────
  // 🔴 public: false, AND NEVER ANYTHING ELSE. This file is every client's contact details and
  // lead list in one document. The other two buckets in this project are public because they
  // hold images meant to be looked at; copying that flag here would publish the customer
  // database on a guessable URL.
  await supabase.storage.createBucket(BACKUP_BUCKET, { public: false }).catch(() => {});
  const { error: upErr } = await supabase.storage.from(BACKUP_BUCKET)
    .upload(name, packed, { contentType: "application/gzip", upsert: true });
  if (upErr) throw new Error(`could not write the backup: ${upErr.message}`);

  // ── 4. Read it back before trusting it ─────────────────────────────────────
  // 🔴 AN UNVERIFIED BACKUP IS A GUESS. The classic way this fails is a job that has been
  // "succeeding" for months writing a file that is truncated, empty or unreadable, discovered
  // on the one day it is needed. So the file is downloaded again and unpacked, and the row
  // counts inside it are compared with what was read. Nothing is deleted until that passes.
  let verified = false, verifyWhy = "";
  try {
    const { data: blob, error } = await supabase.storage.from(BACKUP_BUCKET).download(name);
    if (error) throw new Error(error.message);
    const back = unpackSnapshot(Buffer.from(await blob.arrayBuffer()));
    const v = verifyAgainst(tables, back && back.data);
    if (!v.ok) throw new Error(v.why);
    verified = true;
  } catch (e) { verifyWhy = String((e && e.message) || e).slice(0, 160); }

  // ── 5. Compare with yesterday ──────────────────────────────────────────────
  // The quiet failure this catches: the job keeps running, the file keeps being written, and
  // what is inside it has been emptying out. Also how a wiped table gets noticed at all.
  const { data: listed } = await supabase.storage.from(BACKUP_BUCKET).list("", { limit: 100 });
  const all = (listed || []).map((f) => f.name).filter(isBackupName).sort((a, b) => b.localeCompare(a));
  let previous = null;
  const prevName = all.find((n) => n !== name);
  if (prevName) {
    try {
      const { data: blob } = await supabase.storage.from(BACKUP_BUCKET).download(prevName);
      if (blob) previous = unpackSnapshot(Buffer.from(await blob.arrayBuffer())).manifest;
    } catch (e) { /* no comparison is a missing warning, not a failed backup */ }
  }
  const warnings = countWarnings(manifest, previous);
  if (!verified) warnings.unshift({ table: "", level: "red", text: `tonight's file could not be read back and checked (${verifyWhy}). Treat it as unreliable.` });

  // ── 6. Keep the last five ──────────────────────────────────────────────────
  // 🔴 ONLY AFTER A VERIFIED WRITE. A job that has stopped working must not spend its failing
  // runs deleting the last good copies it made while it still worked.
  let pruned = [];
  if (verified) {
    pruned = toPrune(listed, KEEP);
    if (pruned.length) await supabase.storage.from(BACKUP_BUCKET).remove(pruned).catch(() => { pruned = []; });
  }
  const kept = all.filter((n) => !pruned.includes(n));

  // A private bucket needs a signed link, so the file is one tap away from the email and the
  // link dies on its own. Seven days outlives a weekend without leaving a permanent door open.
  let link = "";
  try {
    const { data: signed } = await supabase.storage.from(BACKUP_BUCKET).createSignedUrl(name, 7 * 24 * 3600);
    link = (signed && signed.signedUrl) || "";
  } catch (e) { /* the backup is still fine without a link */ }

  const sum = summarizeBackup(manifest);
  // 🔴 THE SLOW-CREEP FAILURE. A scheduled function is killed at 30 seconds. Today this job
  // handles a few clients in a second or two; it will handle a hundred clients one day, and
  // the run that first goes over the line just stops, mid-copy, with no file. Printing how
  // long it took every morning is how that gets noticed while there is still room to fix it,
  // rather than on the night it silently stops producing a backup.
  const seconds = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
  if (Number(seconds) > 20) warnings.push({ table: "", level: "note",
    text: `the backup took ${seconds} seconds and it gets cut off at 30. Tell Claude, it needs splitting up before it grows further.` });

  const red = warnings.filter((w) => w.level === "red");
  const text = backupEmailText({ manifest, warnings, kept, pruned, link, phoenixDate: manifest.phoenix })
    + `\n\nSize of tonight's copy: ${humanBytes(packed.length)}, took ${seconds} seconds.`;

  // ── 7. Say so every morning ────────────────────────────────────────────────
  // 🔴 IT REPORTS EVEN WHEN NOTHING IS WRONG, BY DESIGN. A backup that only speaks up when it
  // breaks is indistinguishable from a backup that has itself stopped running, and that is
  // exactly the state you cannot afford to be in about backups. He asked for a mail every
  // morning; the silence is the bug it prevents.
  if (process.env.RESEND_API_KEY && process.env.REPORTS_FROM_EMAIL && process.env.OWNER_EMAIL) {
    await sendEmail({
      to: process.env.BACKUP_EMAIL || process.env.OWNER_EMAIL,
      subject: red.length ? `Backup needs a look: ${sum.line}` : `Backup done: ${sum.line}`,
      html: emailHTML({ text, ok: red.length === 0 }),
      text,
    }).catch((e) => console.error("backup email failed:", e.message));
  } else {
    console.error("backup-run: email not configured (RESEND_API_KEY / REPORTS_FROM_EMAIL / OWNER_EMAIL)");
  }

  // A red finding also goes down the alert channels, because "a table emptied overnight" is
  // not a thing to find in an inbox at leisure.
  if (red.length) {
    await dispatchAlert({
      title: `Backup: ${red[0].text.slice(0, 90)}`,
      body: red.map((w) => w.text).join("\n\n") + "\n\nThe nightly backup at 1am found this. Check the OS before anything overwrites it.",
      severity: "red",
    });
  }

  console.log(`backup-run: ${sum.line}, verified=${verified}, kept=${kept.length}, pruned=${pruned.join(",") || "none"}`);
  return new Response(JSON.stringify({ ok: verified && !red.length, summary: sum.line, verified, kept, pruned, warnings }),
    { headers: { "content-type": "application/json" } });
});
