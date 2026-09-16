// Every campaign Meta has, and none it no longer has.
// Run: node tests/verify-meta-full-list.mjs
//
// 🔴 Bryson, 2026-09-15: *"I just launched my meta ads campaign for car detailers but when I
// open it through the campaigns tab ... it doesn't show the car detailers [campaign] ... but it
// also shows the first roofers [campaign] that I just deleted."* Two failures in one screen,
// and they are the two halves of the same habit: this file asked Meta for a list, took the
// FIRST PAGE, and trusted Meta to leave out the dead ones.
//
//   1. NO PAGINATION. Every list read sent `limit: 100` and used `res.data` — one page. An
//      account holding more than that silently loses the remainder, and the remainder is
//      exactly where a campaign created five minutes ago can sit.
//   2. NO STATUS FILTER OF OUR OWN. Meta's list edges are documented to omit DELETED and
//      ARCHIVED objects, and this trusted that. Google's identical assumption is what
//      produced the ghost campaigns of 2026-08-14: rows for things that no longer existed,
//      which could never be acted on because every action failed against a removed resource.
//
// 🔴 AND THE TRAP THAT MAKES PAGING DANGEROUS: `paging.cursors.after` is still present on the
// LAST page. Loop until the cursor disappears and you re-request the final page forever —
// inside a serverless function that is an outage, not a bug. Only `paging.next` says there is
// more. A test that never simulates the last page cannot catch this, so one here does.
//
// The real reader runs against a fake Graph API. No network.

process.env.META_SYSTEM_USER_TOKEN = "test-token";
process.env.META_APP_SECRET = "test-secret";

const { getCampaigns, getAdsForCampaign, getCampaignDetail } = await import("../netlify/functions/meta-ads.mjs");

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── A Graph API that pages exactly the way Meta's does ────────────────────────
//
// Including the part that matters: a cursor on every page, and `paging.next` only while
// there is genuinely another page.
const realFetch = globalThis.fetch;
let calls = [];
const serve = (rowsByEdge, { pageSize = 2 } = {}) => {
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    calls.push(u.pathname + u.search);
    const edge = Object.keys(rowsByEdge).find((k) => u.pathname.includes(k));
    if (!edge) return new Response(JSON.stringify({ error: { message: `no fake for ${u.pathname}` } }), { status: 400 });
    const rows = rowsByEdge[edge];
    const after = u.searchParams.get("after") || "";
    const start = after ? Number(after) : 0;
    const slice = rows.slice(start, start + pageSize);
    const end = start + slice.length;
    const more = end < rows.length;
    return new Response(JSON.stringify({
      data: slice,
      // The cursor is ALWAYS here, last page included. That is the whole trap.
      paging: { cursors: { before: String(start), after: String(end) }, ...(more ? { next: "https://graph.facebook.com/next" } : {}) },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
};
const restore = () => { globalThis.fetch = realFetch; calls = []; };

const camp = (id, over = {}) => ({ id: String(id), name: `Campaign ${id}`, status: "PAUSED",
  effective_status: "PAUSED", objective: "OUTCOME_LEADS", daily_budget: "2000", ...over });

// ══════════════════════════════════════════════════════════════════════════════
// 1. 🔴 THE CAMPAIGN HE JUST MADE IS IN THE LIST
// ══════════════════════════════════════════════════════════════════════════════
{
  // Seven campaigns, pages of two: the newest sits on page four and was invisible before.
  const rows = [camp(1), camp(2), camp(3), camp(4), camp(5), camp(6),
                camp(7, { name: "Car Detailers — Leads" })];
  serve({ "/campaigns": rows, "/insights": [] });
  const got = await getCampaigns("123456");
  eq("🔴 every page is read, not just the first", got.length, 7);
  ok("🔴 and the newest campaign is there", got.some((c) => c.name === "Car Detailers — Leads"),
    "this is the exact thing he opened the screen to see");
  ok("more than one request was made", calls.filter((c) => c.includes("/campaigns")).length >= 4,
    "one call cannot have read four pages");
  restore();
}

{
  // 🔴 The termination check. One page of rows, page size larger than the list: the fake
  // still returns a cursor, and a reader that follows cursors alone never stops.
  const rows = [camp(1), camp(2)];
  serve({ "/campaigns": rows, "/insights": [] }, { pageSize: 50 });
  const got = await getCampaigns("123456");
  eq("🔴 a single short page ends the loop", got.length, 2);
  eq("🔴 and it asked exactly once", calls.filter((c) => c.includes("/campaigns")).length, 1,
    "the cursor is present on the last page, so following it re-reads that page forever");
  restore();
}

{
  // The cap exists so a malformed `next` cannot hang a serverless function. 25 pages of 2.
  const rows = Array.from({ length: 200 }, (_, i) => camp(i + 1));
  serve({ "/campaigns": rows, "/insights": [] });
  const got = await getCampaigns("123456");
  ok("🔴 a runaway pager stops rather than hanging", got.length === 50,
    `read ${got.length} rows; the cap is 25 pages of 2`);
  restore();
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 THE CAMPAIGN HE DELETED IS NOT
// ══════════════════════════════════════════════════════════════════════════════
{
  const rows = [
    camp(1, { name: "Roofers — Leads" }),
    camp(2, { name: "Roofers — Leads (first try)", status: "DELETED", effective_status: "DELETED" }),
    camp(3, { name: "Old test", effective_status: "ARCHIVED" }),
    camp(4, { name: "Car Detailers — Leads" }),
  ];
  serve({ "/campaigns": rows, "/insights": [] });
  const got = await getCampaigns("123456");
  eq("🔴 a deleted campaign is gone from the list", got.map((c) => c.name),
    ["Roofers — Leads", "Car Detailers — Leads"]);
  restore();
}

{
  // 🔴 A BLACKLIST, NOT A WHITELIST. Every state nobody thought of must still appear — a
  // campaign spending money while invisible is far worse than one dead row on screen.
  const odd = ["IN_PROCESS", "WITH_ISSUES", "PENDING_REVIEW", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "DISAPPROVED"];
  serve({ "/campaigns": odd.map((st, i) => camp(i + 1, { effective_status: st, status: "ACTIVE" })), "/insights": [] });
  const got = await getCampaigns("123456");
  eq("🔴 no unusual status is filtered away", got.length, odd.length);
  restore();
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE SAME TWO RULES INSIDE A CAMPAIGN
// ══════════════════════════════════════════════════════════════════════════════
const ad = (id, over = {}) => ({ id: String(id), name: `Ad ${id}`, status: "PAUSED",
  effective_status: "PAUSED", adset_id: "set1", created_time: "2026-09-15T00:00:00+0000",
  creative: { object_story_spec: { link_data: { name: "H", message: "M", link: "https://x" } } }, ...over });

{
  const rows = [ad(1), ad(2), ad(3), ad(4), ad(5, { name: "The new one" })];
  serve({ "/ads": rows, "/insights": [] });
  const got = await getAdsForCampaign("123456", "c1");
  eq("every page of ads is read", got.length, 5);
  ok("including the newest ad", got.some((a) => a.name === "The new one"));
  restore();
}

{
  serve({ "/ads": [ad(1), ad(2, { effective_status: "DELETED" }), ad(3, { status: "ARCHIVED" })], "/insights": [] });
  const got = await getAdsForCampaign("123456", "c1");
  eq("a deleted ad is gone from the campaign", got.map((a) => a.id), ["1"]);
  restore();
}

{
  // The detail panel pages its ad sets too, and drops dead ones. Its ads come from the same
  // reader above, so an ad on page three of a busy campaign now appears under its set.
  const sets = [
    { id: "set1", name: "Set one", status: "PAUSED", effective_status: "PAUSED", daily_budget: "2000", targeting: {} },
    { id: "set2", name: "Deleted set", status: "DELETED", effective_status: "DELETED", targeting: {} },
    { id: "set3", name: "Set three", status: "PAUSED", effective_status: "PAUSED", targeting: {} },
  ];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    const after = u.searchParams.get("after") || "";
    const start = after ? Number(after) : 0;
    const page = (rows, size = 2) => {
      const slice = rows.slice(start, start + size), end = start + slice.length;
      return { data: slice, paging: { cursors: { after: String(end) }, ...(end < rows.length ? { next: "x" } : {}) } };
    };
    let body;
    if (u.pathname.endsWith("/adsets")) body = page(sets);
    else if (u.pathname.endsWith("/ads")) body = page([ad(1), ad(2, { adset_id: "set3" }), ad(3, { adset_id: "set3" })]);
    else if (u.pathname.endsWith("/insights")) body = page([]);
    else body = { id: "c1", name: "Car Detailers — Leads", status: "PAUSED", effective_status: "PAUSED" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const d = await getCampaignDetail("123456", "c1");
  eq("the detail panel names the campaign it was asked for", d.campaign.name, "Car Detailers — Leads");
  eq("🔴 a deleted ad set is not drawn", d.adGroups.map((g) => g.name), ["Set one", "Set three"]);
  eq("every ad found its set across pages", d.adGroups.map((g) => g.ads.length), [1, 2]);
  restore();
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. NOTHING ELSE IN THIS FILE STILL READS ONE PAGE
//
// The bug was not in one function, it was a habit repeated at every list read. A fix
// applied to the two he noticed leaves the same hole everywhere else, so this walks the
// whole file: every READ of a campaigns / ads / adsets / insights edge must go through the
// pager. Writes (POST creates) are not list reads and are left alone.
// ══════════════════════════════════════════════════════════════════════════════
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../netlify/functions/meta-ads.mjs", import.meta.url), "utf8");
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  // `graph("stage", \`...\`  ` — the call, its stage, and the start of its path, plus enough
  // of what follows to tell a GET from a POST.
  const reads = [...code.matchAll(/\bawait (graph|graphPaged)\("([^"]+)",\s*(`[^`]*`|"[^"]*")([\s\S]{0,160})/g)]
    .map(([, fn, stage, path, tail]) => ({ fn, stage, path, post: /method:\s*"POST"/.test(tail) }));
  ok("the file was walked and calls were found", reads.length >= 10, `found ${reads.length}`);

  const LIST_EDGE = /\/(campaigns|ads|adsets|insights)\b/;
  const unpaged = reads.filter((r) => !r.post && LIST_EDGE.test(r.path) && r.fn !== "graphPaged");
  eq("🔴 no list read is left on a single page",
    unpaged.map((r) => `${r.stage} ${r.path}`), []);

  // And the reverse, so the check above cannot pass by finding nothing.
  const paged = reads.filter((r) => r.fn === "graphPaged");
  ok("🔴 and reads really do go through the pager", paged.length >= 6,
    `only ${paged.length} paged reads — this check may be matching nothing`);

  ok("the pager stops on paging.next, not on the cursor", /if \(!paging\.next \|\| !cursor\) break;/.test(code),
    "the cursor is present on the last page, so following it alone re-reads that page forever");
  ok("and it is capped", /page < MAX_PAGES/.test(code),
    "an unbounded loop inside a serverless function is an outage, not a bug");
}

restore();
if (fails.length) { console.error(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.error("  " + f)); process.exit(1); }
console.log(`✓ verify-meta-full-list: ${pass} checks passed`);
