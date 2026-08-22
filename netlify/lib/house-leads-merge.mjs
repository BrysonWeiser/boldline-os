// The pure merge behind the house-leads job, kept OUT of the function file on purpose.
//
// `house-leads.mjs` imports Supabase at module load, so a test cannot import it without
// credentials. The first version of `tests/verify-house-leads.mjs` therefore re-implemented
// this merge and tried to pin the original with regexes over the source. That failed the
// standard in KB `repo-tests`: deleting the hand-set-status guard and renaming the dedupe
// key BOTH left the suite green, because the copy in the test was still correct and the
// pins matched unrelated lines. A guard that cannot fail is not a guard.
//
// So the logic lives here, with no I/O and no imports, and the test runs the real thing.
// Every rule below is load-bearing; the reasoning for each is in `house-leads.mjs`.

// Read the whole website_leads table in one page. If a run ever comes back full we are no
// longer looking at everything, so that run must not prune — deleting a lead because it
// fell off the end of a page would be data loss, not cleanup.
export const PRUNE_LIMIT = 1000;

// 🔴 NOT EVERY ROW IN `website_leads` IS A LEAD, and the first version of this job mirrored
// all of them. Two kinds of row are in that table without being enquiries:
//   • `newsletter` — the durable backup of the Resend subscriber list. The OS Leads screen
//     has always filtered these out; this job did not, so every newsletter subscriber was
//     landing on the house account as a lead, inflating the count AND the cost-per-lead
//     that is calculated from it.
//   • `deleted`    — a lead the owner deleted, stripped of every personal field and re-filed
//     under this form so the Calendly poller can still see its event id and knows not to
//     recreate the booking. It carries that id and nothing else.
// A DENYLIST, not an allowlist: real enquiry rows are named after whichever Netlify form
// they came from, so a new form must arrive as a lead by default rather than vanish.
export const NON_LEAD_FORMS = ["newsletter", "deleted"];
export const isLeadRow = (row) => !NON_LEAD_FORMS.includes(String((row && row.form) || "").toLowerCase());

// website_leads statuses are new | contacted | meeting | won | lost | archived. The house
// Leads tab offers new | contacted | meeting | won | lost, so archived folds into lost and
// anything unrecognised falls back to new.
export const HOUSE_STATUSES = ["new", "contacted", "meeting", "won", "lost"];
export const mapStatus = (s) => {
  const v = String(s || "new").toLowerCase();
  if (v === "archived") return "lost";
  return HOUSE_STATUSES.includes(v) ? v : "new";
};

const clean = (v) => (v == null ? "" : String(v).trim());

// Where the lead came from, in the words the Leads tab already knows how to show.
export const sourceOf = (row) => {
  const form = String((row && row.form) || "").toLowerCase();
  if (form === "calendly") return "calendly";
  if (form === "recommendation") return "quiz";
  return "website";
};

// A phone number is not a column on website_leads — the marketing form puts it in `payload`.
const phoneOf = (row) => {
  const p = (row && row.payload) || {};
  return clean(p.phone || p.Phone || p.phoneNumber || p.tel);
};

// Shape matches appendLead() in report-shared.mjs, because the Leads tab, the billing
// toggles and the follow-up tools all read that shape.
export const toLeadEntry = (row) => ({
  status: mapStatus(row.status),
  followUps: [],
  name: clean(row.name),
  phone: phoneOf(row),
  email: clean(row.email),
  business: clean(row.business),
  message: clean(row.message),
  source: sourceOf(row),
  receivedAt: row.created_at || new Date().toISOString(),
  websiteLeadId: row.id,
  mirroredStatus: mapStatus(row.status),
});

// Fold the website leads into the house account's existing leadsLog.
//
// `existing` — the house account's current leadsLog (may hold hand-entered leads and
//              leads posted to the client lead webhook; neither is ours to touch).
// `leads`    — the website_leads rows this run read, newest first.
// `limit`    — the page size that read used, so we know whether we saw everything.
export function mergeHouseLeads(existing, leads, { limit = PRUNE_LIMIT } = {}) {
  const all = Array.isArray(leads) ? leads : [];
  // Measured on the RAW page, before filtering. Filtering first would make a page that
  // came back full look short, which would re-enable pruning on an incomplete read —
  // the exact data loss the gate exists to prevent.
  const complete = all.length < limit;
  const rows = all.filter(isLeadRow);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const prior = Array.isArray(existing) ? existing : [];

  let added = 0, updated = 0, pruned = 0;
  const seen = new Set();
  const kept = [];

  for (const entry of prior) {
    const wid = entry && entry.websiteLeadId ? String(entry.websiteLeadId) : "";
    if (!wid) { kept.push(entry); continue; }        // not mirrored, not ours
    const row = byId.get(wid);
    if (!row) {
      if (complete) { pruned++; continue; }          // he deleted it from the Leads screen
      kept.push(entry);                              // partial read: never assume deletion
      continue;
    }
    seen.add(wid);
    const want = mapStatus(row.status);
    const cur = String(entry.status || "new");
    // He moved this one by hand in the house tab, so stop syncing its status. Without
    // this, marking a lead "Meeting Booked" there would silently revert within 15 minutes.
    const touched = entry.mirroredStatus != null && cur !== String(entry.mirroredStatus);
    if (!touched && cur !== want) { kept.push({ ...entry, status: want, mirroredStatus: want }); updated++; continue; }
    if (!touched && entry.mirroredStatus !== want) { kept.push({ ...entry, mirroredStatus: want }); continue; }
    kept.push(entry);
  }

  for (const row of rows) {
    if (seen.has(String(row.id))) continue;
    kept.push(toLeadEntry(row));
    added++;
  }

  // Newest first, matching how appendLead prepends and how the Leads tab reads.
  kept.sort((a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0));
  return { kept, added, updated, pruned, changed: !!(added || updated || pruned) };
}
