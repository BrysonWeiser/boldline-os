// Removing BoldLine's manager access to a client's Google Ads when they leave.
// Run: node tests/verify-manager-unlink.mjs
//
// Bryson, 2026-11-04, at the end of Stencil & Thread's agreement: "how do i remove boldlines manager access from his
// account or can we make that automated". What this stops, worst first:
//  1. Access removed by accident: it must take two presses, and never fire just because a contract was marked Expired.
//  2. The OS saying "done" when Google still lists us: done is only what Google says afterwards.
//  3. A dead end: when the API refuses, he gets the manual steps.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const UI = readFileSync(join(ROOT, "index.html"), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
const GADS = readFileSync(join(ROOT, "netlify/functions/google-ads.mjs"), "utf8");
process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID = "111-222-3333";
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev";
const { unlinkClientAccount } = await import("../netlify/functions/google-ads.mjs");

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; return; } fail++; console.log(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`); };
const threw = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

// A stand-in for Google: the link rows, which writes succeed, and what it says afterwards.
function google({ rows, managerOk = true, clientOk = true, after }) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body || "{}");
    calls.push({ url, body, headers: init.headers });
    const res = (ok, data) => ({ ok, status: ok ? 200 : 400, json: async () => data });
    if (/googleAds:search$/.test(url)) {
      const done = calls.filter((c) => /:mutate$/.test(c.url) && c.ok).length;
      return res(true, { results: (done && after ? after : rows).map((r) => ({ customerClientLink: r })) });
    }
    if (/customerClientLinks:mutate$/.test(url)) { calls[calls.length - 1].ok = managerOk; return res(managerOk, managerOk ? {} : { error: { message: "manager side refused" } }); }
    if (/customerManagerLinks:mutate$/.test(url)) { calls[calls.length - 1].ok = clientOk; return res(clientOk, clientOk ? {} : { error: { message: "client side refused" } }); }
    return res(false, { error: { message: "unexpected " + url } });
  };
  return calls;
}
const ACTIVE = [{ clientCustomer: "customers/4445556666", status: "ACTIVE", managerLinkId: "987" }];

{
  const calls = google({ rows: ACTIVE, after: [{ clientCustomer: "customers/4445556666", status: "INACTIVE", managerLinkId: "987" }] });
  const r = await unlinkClientAccount("t", "444-555-6666");
  const m = calls.find((c) => /customerClientLinks:mutate$/.test(c.url));
  ok("🔴 a live link is ended from OUR manager account first, as one `operation` setting status INACTIVE", m && /customers\/1112223333\/customerClientLinks:mutate$/.test(m.url) && m.body.operation && m.body.operation.updateMask === "status"
    && m.body.operation.update.resourceName === "customers/1112223333/customerClientLinks/4445556666~987" && m.body.operation.update.status === "INACTIVE" && !m.body.operations, JSON.stringify(m && m.body));
  ok("🔴 and it is only 'removed' because Google says so afterwards", r.removed === true && r.status === "INACTIVE" && /googleAds:search$/.test(calls[calls.length - 1].url));
}
{
  const calls = google({ rows: ACTIVE, managerOk: false, after: [{ clientCustomer: "customers/4445556666", status: "INACTIVE", managerLinkId: "987" }] });
  const r = await unlinkClientAccount("t", "4445556666");
  const c = calls.find((x) => /customerManagerLinks:mutate$/.test(x.url));
  ok("if the manager side is refused, it ends the link from the client side through the access we still hold", c && /customers\/4445556666\/customerManagerLinks:mutate$/.test(c.url) && Array.isArray(c.body.operations)
    && c.body.operations[0].update.resourceName === "customers/4445556666/customerManagerLinks/1112223333~987" && c.body.operations[0].update.status === "INACTIVE" && r.removed && r.how === "client", JSON.stringify(c && c.body));
}
{
  google({ rows: ACTIVE, managerOk: false, clientOk: false });
  const m = await threw(() => unlinkClientAccount("t", "4445556666"));
  ok("both refused: it fails out loud with Google's reasons, never a quiet 'done'", /manager side refused/.test(m || "") && /client side refused/.test(m || ""), m);
}
{
  google({ rows: ACTIVE, after: ACTIVE });
  const r = await unlinkClientAccount("t", "4445556666");
  ok("🔴 a request Google accepted but did not act on still reads as NOT removed", r.removed === false && r.status === "ACTIVE");
}
{
  const calls = google({ rows: [{ clientCustomer: "customers/4445556666", status: "PENDING", managerLinkId: "55" }], after: [{ clientCustomer: "customers/4445556666", status: "CANCELED", managerLinkId: "55" }] });
  const r = await unlinkClientAccount("t", "4445556666");
  const m = calls.find((c) => /customerClientLinks:mutate$/.test(c.url));
  ok("a request they never accepted is withdrawn (CANCELED), not 'ended'", m && m.body.operation.update.status === "CANCELED" && r.removed);
}
{
  const calls = google({ rows: [] });
  const r = await unlinkClientAccount("t", "4445556666");
  ok("no link at all: nothing is sent, and it says there is nothing to remove", r.removed && r.how === "none" && !calls.some((c) => /:mutate$/.test(c.url)));
}
ok("it refuses a short id and BoldLine's own manager account", /10 digits/.test(await threw(() => unlinkClientAccount("t", "12345")) || "") && /BoldLine's own manager account/.test(await threw(() => unlinkClientAccount("t", "1112223333")) || ""));
ok("the endpoint has the action", /action === "unlinkClient"/.test(GADS));

// ── The OS ───────────────────────────────────────────────────────────────────
ok("🔴 two presses: Remove our access, then 'Yes, remove our access' with the number read back", /setRm\("confirm"\)/.test(UI) && /Remove BoldLine's access to <strong[^>]*>\{pretty\}/.test(UI) && /<button onClick=\{remove\}[^>]*>\{rm==="working"\?"Removing…":"Yes, remove our access"\}/.test(UI));
ok("🔴 never fired by marking a contract Expired: Expired only brings the button forward", !/set\("contractStatus"[^\n]{0,200}unlinkClient/.test(UI) && /<LinkRequestRow customerId=\{form\.googleAdsCustomerId\} ended=\{form\.contractStatus==="expired"\} \/>/.test(UI) && /Their agreement has ended, and BoldLine can still reach their Google Ads\./.test(UI));
ok("marking it Expired points him to the button, one tap away on the Campaign tab", /Next: remove BoldLine's access to their Google Ads\. <button type="button" onClick=\{\(\)=>setSection\("campaign"\)\}/.test(UI));
ok("🔴 'Done' only when Google confirms, and it says what the client keeps", /if \(!d\.removed\) throw new Error/.test(UI) && /Google confirms BoldLine no longer has access to \{pretty\}\. They keep their account, their ads and all their history\./.test(UI));
ok("🔴 once a client has ended (or access is gone) the OS stops offering to send a NEW link request", /\{rm==="done"\|\|ended \? null : link&&link\.linked \? null : state==="sent"/.test(UI));
ok("a failure gives the manual steps", /Settings, then Sub-account settings, tick their account, then Unlink\./.test(UI));
ok("only offered while we actually have access (or a request is waiting)", /const hasAccess = link && \(link\.linked \|\| link\.status==="PENDING"\);/.test(UI) && /: !hasAccess \? null/.test(UI));

console.log(`verify-manager-unlink: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
