// The partner view on one of Bryson's own businesses (Bryson, 2026-10-07: "can you make those two
// ideas", the first being a page for his partner on the detailing business to see new leads).
// What has to stay true:
//  1. Only an owned business with the link switched on has a page; off means the old link is dead.
//  2. It shows leads and nothing else, newest first, and a status change lands on the right lead
//     without erasing anything written in between.
//  3. A lead's own words can never break or script the page; it carries no emojis, no dashes and no
//     link back to BoldLine (it is the business's page).
//  4. The partner can be emailed each new lead, as the business, with replies going to the customer.
//  5. The OS opens it as the real thing in a new tab and never embeds it as a preview.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "test";
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const UI = src("index.html");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };
const T = await import("../netlify/lib/team-view.mjs");

const TOKEN = "3f2a1c9e-1111-4a2b-9c3d-abcdefabcdef";
const iso = (minAgo) => new Date(Date.now() - minAgo * 60e3).toISOString();
const BIZ = { id: "b", internal: true, owned: true, name: "Desert Gloss <Detailing>", team: { on: true, token: TOKEN, email: "partner@x.example" },
  leadsLog: [
    { leadId: "L1", name: "Old", phone: "(480) 555-0101", receivedAt: iso(600), status: "won" },
    { leadId: "L2", name: "Newest", phone: "(480) 555-0102", email: "c@x.example", message: "Hi </script><script>alert(1)</script>", receivedAt: iso(5) },
    { name: "No id", receivedAt: iso(60), status: "weird" },
  ] };

// 1. Who has a page
ok("🔴 only an owned business with the link on", T.teamOn(BIZ) && !T.teamOn({ ...BIZ, owned: false }) && !T.teamOn({ ...BIZ, internal: false })
  && !T.teamOn({ ...BIZ, team: { ...BIZ.team, on: false } }) && !T.teamOn({ ...BIZ, team: { ...BIZ.team, token: "" } }));
ok("the link is the OS address plus the token", T.teamUrl("https://os.example/", TOKEN) === `https://os.example/team?t=${TOKEN}`);
ok("🔴 turning it off removes the token, so the old link is dead", /onUpdate\(\{\.\.\.client, team:\{\.\.\.team, on:false, token:""\}\}\)/.test(UI));
ok("the endpoint only answers a well-formed token and an owned business with the link on", /const TOKEN_RE = \/\^\[0-9a-f-\]\{32,64\}\$\/i;/.test(src("netlify/functions/team.mjs")) && /return row && teamOn\(row\.data\) \? row : null;/.test(src("netlify/functions/team.mjs")));
ok("a dead link gets a plain 'turned off' page", /This link is turned off/.test(T.teamOffPage()));

// 2. Leads only, and status changes land right
{
  const L = T.teamLeads(BIZ);
  ok("newest first", L.map((l) => l.name).join(",") === "Newest,No id,Old");
  ok("an unknown status reads as new", L.find((l) => l.name === "No id").status === "new");
  ok("a lead without an id is keyed by when it arrived", L.find((l) => l.name === "No id").key === BIZ.leadsLog[2].receivedAt);
  ok("🔴 only lead fields leave the server", L.every((l) => Object.keys(l).sort().join(",") === "at,email,key,message,name,phone,source,status"));
  ok("capped, so a long history never makes a huge page", T.TEAM_MAX_LEADS === 200);
  const next = T.applyTeamStatus(BIZ, "L2", "contacted");
  ok("🔴 a status change lands on the right lead", next.leadsLog[1].status === "contacted" && next.leadsLog[1].statusBy === "partner" && next.leadsLog[0].status === "won");
  ok("and never edits the record it was given", BIZ.leadsLog[1].status === undefined);
  ok("an unknown status or lead writes nothing", T.applyTeamStatus(BIZ, "L2", "deleted") === null && T.applyTeamStatus(BIZ, "nope", "won") === null);
  ok("no change, no write", T.applyTeamStatus(BIZ, "L1", "won") === BIZ);
  ok("the statuses match the OS's own lead statuses for a business", T.TEAM_STATUSES.join(",") === "new,contacted,won,lost");
  const F = src("netlify/functions/team.mjs");
  ok("🔴 it reads the record again right before writing", F.indexOf("fresh = await load(db, token)") > 0 && F.indexOf("fresh = await load(db, token)") < F.indexOf(".update({ data: next"));
}

// 3. Safe page
{
  const html = T.renderTeamPage(BIZ, { token: TOKEN });
  ok("🔴 a lead's words cannot close the script and run their own", !html.includes("</script><script>alert(1)") && html.includes("\\u003c/script\\u003e"));
  ok("the business name is escaped", html.includes("Desert Gloss &lt;Detailing&gt;"));
  ok("it is never indexed or sent on as a referrer", html.includes('content="noindex,nofollow"') && html.includes('name="referrer" content="no-referrer"') && /"referrer-policy": "no-referrer"/.test(src("netlify/functions/team.mjs")));
  ok("never cached", /"cache-control": "no-store"/.test(src("netlify/functions/team.mjs")));
  ok("no link back to BoldLine on the business's page", !/boldline/i.test(html));
  ok("no emojis", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html));
  ok("no dashes in what the partner reads", !/[\u2014\u2013]/.test(html));
  ok("tap to call and text", html.includes('call.href="tel:"+d') && html.includes('tx.href="sms:"+d'));
  ok("times are Arizona time", html.includes('timeZone:"America/Phoenix"'));
  ok("fits a phone (viewport set, big buttons)", html.includes("width=device-width") && /min-height:44px/.test(html));
}

// 4. The email to the partner
{
  const sent = [];
  const r = await T.notifyTeamOfLead(BIZ, BIZ.leadsLog[1], { send: async (m) => sent.push(m), base: "https://os.example" });
  ok("🔴 the partner is emailed the lead", r.sent && sent.length === 1 && sent[0].to === "partner@x.example");
  ok("as the business, with replies going to the customer", sent[0].fromName === BIZ.name && sent[0].replyTo === "c@x.example");
  ok("with a button to every lead", sent[0].html.includes(`https://os.example/team?t=${TOKEN}`) && sent[0].html.includes("See all leads"));
  ok("the customer's words are escaped in the email", !sent[0].html.includes("<script>alert(1)"));
  ok("no emojis or dashes in the email", !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(sent[0].html) && !/[\u2014\u2013]/.test(sent[0].html + sent[0].subject));
  const none = [];
  await T.notifyTeamOfLead({ ...BIZ, team: { ...BIZ.team, email: "" } }, BIZ.leadsLog[1], { send: async (m) => none.push(m) });
  await T.notifyTeamOfLead({ ...BIZ, owned: false }, BIZ.leadsLog[1], { send: async (m) => none.push(m) });
  ok("🔴 nothing is sent without an email, or for anyone but an owned business", none.length === 0);
  const LI = src("netlify/functions/lead-intake.mjs");
  ok("🔴 every new lead tries it, after the lead is saved", /notifyTeamOfLead\(nextData, lead, \{ send: sendEmail, base: process\.env\.URL \}\)/.test(LI) && LI.indexOf("notifyTeamOfLead(nextData") > LI.indexOf("nextData = await appendLead"));
  ok("🔴 and it is last in the list, so the CRM result is still the third one read", /const \[, , crm\] = await Promise\.all\(\[/.test(LI)
    && LI.indexOf("forwardLead(nextData, lead)") < LI.indexOf("notifyTeamOfLead(nextData, lead"));
}

// 5. In the OS
ok("the card is on the Leads tab of an owned business only", /\{tab==="leads"&&isOwned\(client\)&&<TeamViewCard client=\{client\} onUpdate=\{onUpdate\}\/>\}/.test(UI));
ok("🔴 the OS opens the real page in a new tab and never embeds it", /<a href=\{url\} target="_blank" rel="noopener noreferrer"/.test(UI) && !/<iframe[^>]*team\?t=/.test(UI) && !/srcDoc=\{[^}]*team/i.test(UI));
ok("the link is the OS address, with a long random token", /`\$\{window\.location\.origin\}\/team\?t=\$\{team\.token\}`/.test(UI) && /token: team\.token \|\| crypto\.randomUUID\(\)/.test(UI));
ok("/team reaches the endpoint", /from = "\/team"\n  to = "\/\.netlify\/functions\/team"\n  status = 200/.test(src("netlify.toml")));

if (fails.length) console.log(fails.map((f) => "  FAIL  " + f).join("\n"));
console.log(`verify-team-view: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
