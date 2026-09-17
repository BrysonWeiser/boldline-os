// The monthly/weekly performance report a CLIENT reads, checked for a store client.
//
// Bryson, 2026-09-17: *"can we make sure that the branded emails match what would be needed
// for constantine ... ex. the lead milestone doesnt work or make sense because he isnt getting
// leads its e-commerce"*.
//
// 🔴 THE REPORT IS THE LONGEST THING A CLIENT READS FROM US, AND IT IS WRITTEN BY A MODEL.
// That is what makes this different from a template. A template with the wrong noun prints the
// wrong noun. A PROMPT with the wrong noun produces a whole section of confident, invented
// commentary about lead quality and follow-up speed for a business that has never received a
// lead, and it will do it differently every month, so nobody can pattern-match it later.
//
// Worse, the ad platforms DO report "conversions" on a store campaign. Handed a data block
// headed "Leads Generated", a writer will reach for that number and tell the client their
// campaign generated sales that BoldLine cannot see and did not count. The counts come from
// the client's own order records; the agreement says exactly that and so must the report.
//
// Rendered and read, never pattern-matched (KB `repo-tests`).

import { buildDataBlock, buildClientPrompt, buildOwnerPrompt } from "../netlify/lib/report-shared.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};
const eq = (name, got, want) =>
  ok(name, got === want, got === want ? "" : `got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`);

const PKG = { name: "Growth System", platform: "Google", optimizationFreq: "monthly" };
const log = (n) => Array.from({ length: n }, () => ({ receivedAt: new Date().toISOString() }));
const CLIENT = (extra) => ({
  name: "Air Suds", contactName: "Constantine", niche: "ecommerce", stage: "live",
  leads: 0, leadsLog: log(40), billingPerLead: 25,
  adPerf: { syncedAt: "2026-09-17T00:00:00Z", totals: { spend30d: 1000, clicks: 900, impressions: 20000, liveCampaigns: 2, conversions: 12 } },
  contractStart: "2026-10-01", contractEnd: "2027-01-01", ...extra,
});

const store = buildDataBlock(CLIENT({ billingResultKind: "sale", billingSaleDefinition: "any order placed on airsuds.com" }), PKG);
const leadgen = buildDataBlock(CLIENT({ niche: "roofing" }), PKG);

// ── 1. The data block names what the client actually gets ────────────────────
{
  eq("a store client's unit is a sale", store.unit, "sale");
  eq("a lead-gen client's unit is a lead", leadgen.unit, "lead");

  ok("🔴 the store block counts sales recorded", /^Sales Recorded: 40$/m.test(store.text), store.text);
  // The one line that may say "lead" is the instruction FORBIDDING them, checked in full
  // below. Every other line is a fact about the account and must not mention one.
  // Three lines are excluded and each for a stated reason: the instruction FORBIDDING leads
  // (checked in full below), the niche, which is the client's own industry word, and the
  // pipeline line, whose step names are INTERNAL bot names ("Lead Quality Analyst") that the
  // prompt separately forbids repeating as jargon. Every other line is a fact about the
  // account presented to the writer, and none may mention a lead.
  const storeFacts = store.text.split("\n").filter((l) => !/^How these sales are counted:/.test(l) && !/^Niche:/.test(l) && !/^Pipeline Progress:/.test(l)).join("\n");
  ok("🔴 and no line of fact about the account mentions a lead", !/\b[Ll]eads?\b/.test(storeFacts),
    (storeFacts.match(/.{0,60}\b[Ll]eads?\b.{0,30}/) || [""])[0]);
  ok("the lead-gen block still counts leads generated", /^Leads Generated: 40$/m.test(leadgen.text), leadgen.text);
  ok("and says nothing about sales", !/\b[Ss]ales?\b/.test(leadgen.text),
    (leadgen.text.match(/.{0,60}\b[Ss]ales?\b.{0,30}/) || [""])[0]);

  ok("cost per sale is labelled as such", /Average Cost Per Sale: \$25/.test(store.text), store.text);
  ok("and the target comes from their own agreed rate", /Target Cost Per Sale: \$25 \(per-sale rate\)/.test(store.text), store.text);
}

// ── 2. 🔴 The writer is told where the number came from ──────────────────────
//
// Without this the report claims the campaign produced the sales. It did not: the customer
// bought on the client's own store, which is precisely why the counts are recorded by hand and
// why the agreement makes the client's own order records govern. A client who reads that we
// tracked their sales will ask us for figures we do not have.
{
  ok("🔴 the store block says the counts come from the client's own order records",
    /own order records/.test(store.text), store.text);
  ok("🔴 and forbids passing a platform conversion off as a sale",
    /NEVER write that the campaign tracked, reported, or generated a sale/.test(store.text)
    && /never quote a conversion figure from the ad platforms/.test(store.text), store.text);
  ok("🔴 and says this client receives no leads at all",
    /receives no leads at all/.test(store.text), store.text);
  ok("a lead-gen client is told none of that, because for them it is false",
    !/own order records/.test(leadgen.text));
}

// ── 3. The section the writer is asked to fill ───────────────────────────────
//
// The data block can be perfect and still be overridden by an OUTPUT FORMAT that literally
// says to write about leads and CPL. That instruction is the more specific of the two, so it
// is the one a writer follows.
{
  for (const [who, build] of [["client", buildClientPrompt], ["owner", buildOwnerPrompt]]) {
    const sale = build(CLIENT({ billingResultKind: "sale" }), "monthly", store).system;
    const lead = build(CLIENT({}), "monthly", leadgen).system;
    ok(`🔴 the ${who} report asks for sales, not leads, for a store client`,
      /cost per sale vs target/.test(sale) && !/— leads, /.test(sale),
      (sale.match(/- \*\*Performance.*/) || [""])[0]);
    ok(`and still asks for leads for a lead-gen client`,
      /cost per lead vs target/.test(lead), (lead.match(/- \*\*Performance.*/) || [""])[0]);
    ok(`the ${who} prompt carries the data block`, sale.includes(store.text));
  }
}

console.log(`verify-report-vocabulary: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
