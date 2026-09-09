// The owner's Approve button waits for the client before spending the client's money.
// Run: node tests/verify-launch-gate.mjs
//
// Bryson, 2026-09-09, having built his first real client's campaign and seen it queued on
// both sides: *"does it go live right away when Sebastian approves it or do I still need to
// approve it afterwards?"*
//
// The client's approval alone starts it. That half was right and is what he wanted. The
// other direction was the problem, and nobody had looked at it: HIS OWN Approve button ran
// the same activation with no reference to the client at all. Whoever pressed first
// launched it. Pressing his own button would have started spending SEBASTIAN'S money on ads
// Sebastian had never seen, while Sebastian's portal sat there still asking him to approve
// them, under a line reading "Nothing goes live without your OK."
//
// 🔴 Not a missing feature — the product saying something untrue, and straight across the
// standing rule that the client pays for every penny of ad spend and therefore decides.
//
// It is a WAIT, not a block. A client who will not answer is real, and so is a go-live that
// failed on Google's side after they said yes. Overriding is one press, with the
// consequence written on the button rather than hidden in a dialog.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// ── The real gate, extracted and RUN ─────────────────────────────────────────
const src = os.slice(os.indexOf("const clientApprovalFor = (cl, campaignId) =>"),
                     os.indexOf("\n// Deleting a campaign has to take its paperwork with it."));
ok("the gate was extracted", /const launchGate = \(cl, action\)/.test(src) && /launchGateWords/.test(src));
const { launchGate, launchGateWords, clientApprovalFor } =
  new Function(`${src}\nreturn { launchGate, launchGateWords, clientApprovalFor };`)();

const enable = (id = "77") => ({ id: "a1", title: "Launch Google campaign", exec: { platform: "google", campaignId: id, kind: "enable_campaign" } });
const approval = (status, id = "77") => ({ id: "ap-1", kind: "campaign", campaignId: id, status });
const CL = (over = {}) => ({ id: "c1", name: "Stencil & Thread", googleAdsCustomerId: "924", ...over });

// ── 1. It waits ──────────────────────────────────────────────────────────────
{
  const g = launchGate(CL({ approvals: [approval("pending")] }), enable());
  ok("🔴 a client who has not answered stops the button", !!g);
  eq("and the reason is named", g.state, "not-answered");
  ok("in words he can read", /has not answered yet/.test(launchGateWords(CL(), g)), launchGateWords(CL(), g));
  ok("naming the client", /Stencil & Thread/.test(launchGateWords(CL(), g)));
}
{
  const g = launchGate(CL({ approvals: [approval("changes")] }), enable());
  ok("🔴 a client who asked for CHANGES stops it too", !!g,
    "asking for changes is a clearer no than silence, and used to launch anyway");
  eq("named as such", g.state, "wants-changes");
  ok("and said plainly", /asked for CHANGES/.test(launchGateWords(CL(), g)));
}
{
  const g = launchGate(CL({ approvals: [] }), enable());
  ok("🔴 NO approval at all is the strongest reason to wait, not a reason to skip", !!g,
    "an empty list means the client was never asked; skipping there is the worst case");
  eq("and it says so", g.state, "never-asked");
  ok("in words", /never been asked/.test(launchGateWords(CL(), g)));
}
{
  ok("a client record with no approvals field at all still waits", !!launchGate(CL(), enable()));
  ok("and one whose approvals are junk does not throw",
    !!launchGate(CL({ approvals: "nonsense" }), enable()));
  ok("nor does a null entry in the list",
    !!launchGate(CL({ approvals: [null, approval("pending")] }), enable()));
}
// An approval for a DIFFERENT campaign is not this campaign's approval.
{
  const g = launchGate(CL({ approvals: [approval("approved", "99")] }), enable("77"));
  ok("🔴 an approval for another campaign does not unlock this one", !!g,
    "matching on kind alone would launch campaign 77 on the strength of a yes to 99");
  eq("it reads as never asked", g.state, "never-asked");
}
// Ids arrive as numbers from one path and strings from another.
ok("a numeric id still matches its approval",
  !launchGate(CL({ approvals: [approval("approved", 77)] }), enable("77")),
  "a type mismatch here would make an approved campaign look unapproved forever");

// ── 2. It gets out of the way ────────────────────────────────────────────────
ok("🔴 a client who approved does NOT stop the button",
  !launchGate(CL({ approvals: [approval("approved")] }), enable()),
  "this is the retry case: they said yes and Google refused, so the queue item is still there");
ok("the house account is never gated",
  !launchGate(CL({ internal: true, approvals: [approval("pending")] }), enable()),
  "there is no client to ask about BoldLine's own ads");
ok("pausing a campaign is his call alone",
  !launchGate(CL({ approvals: [approval("pending")] }), { exec: { kind: "pause_campaign", campaignId: "77" } }),
  "waiting for permission to STOP spending their money is backwards");
ok("so is a budget change",
  !launchGate(CL({ approvals: [approval("pending")] }), { exec: { kind: "set_daily_budget", campaignId: "77" } }));
ok("an item with no exec is not gated", !launchGate(CL(), { id: "x", title: "Call them" }));
ok("no client, no gate", !launchGate(null, enable()));

// clientApprovalFor on its own.
eq("it finds the campaign's approval", clientApprovalFor(CL({ approvals: [approval("pending")] }), "77").id, "ap-1");
eq("and returns null when there is none", clientApprovalFor(CL({ approvals: [] }), "77"), null);
ok("it ignores approvals of other kinds",
  clientApprovalFor(CL({ approvals: [{ id: "z", kind: "landing_page", campaignId: "77", status: "approved" }] }), "77") === null,
  "a yes to the landing page is not a yes to spending money");

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE BUTTON SAYS WHAT IT DOES, BEFORE IT IS PRESSED
// ══════════════════════════════════════════════════════════════════════════════

ok("the notification panel computes the gate", /const gate=launchGate\(cl,action\);/.test(os));
ok("🔴 the button is relabelled rather than silently overriding",
  /gate\?"Start without them":"Approve"/.test(os),
  'a button that says "Approve" and overrides a client is one he learns not to trust');
ok("the card warns before he presses", /It goes live by itself the moment they approve in their portal/.test(os));
ok("and says whose money it is", /spends their money on ads they have not agreed to/.test(os));
ok("the card is coloured as a warning", /\$\{gate\?C\.amber\+"55":C\.gold\+"33"\}/.test(os));

// ── 4. Overriding is possible, deliberate, and honest afterwards ─────────────
{
  const dec = os.slice(os.indexOf("const decideAction=async(cl,action,decision)=>{"), os.indexOf("const confirmUpgrade="));
  // 🔴 indexOf RETURNS -1, AND -1 IS LESS THAN EVERYTHING. Written as a bare `<` this
  // passed when the gate call was deleted outright, which is the exact regression it is
  // supposed to catch. Both positions are proved real before they are compared.
  {
    const iGate = dec.indexOf("const gate=launchGate(cl,action);");
    const iCall = dec.indexOf('metaCall({action:"campaigns"');
    ok("the gate is actually there", iGate >= 0);
    ok("and so is the platform call it has to precede", iCall >= 0);
    ok("the gate runs before anything is sent to the platform", iGate >= 0 && iCall >= 0 && iGate < iCall,
      "checking after the call would have already changed the account");
  }
  ok("it asks, and the answer decides", /if\(gate&&!confirm\(/.test(dec));
  ok("the question names the consequence", /spends THEIR money on ads they have not agreed to/.test(dec));
  ok("and reminds him what the portal promised them", /nothing goes live without their OK/.test(dec));
  ok("🔴 it does not BLOCK him", /Start it anyway\?/.test(dec),
    "a client who will not answer is a real situation and he still has to be able to act");

  // 🔴 The half that makes the override honest.
  ok("overriding closes the client's request too", /status:"approved",decidedAt:/.test(dec),
    "otherwise their portal keeps asking them to approve something already live and spending");
  ok("and records that BoldLine did it, not them", /decidedBy:"owner"/.test(dec));
  ok("and tells them so in the portal", /Started by BoldLine before you replied/.test(dec));
  ok("only the matching approval is touched", /\(cl\.approvals\|\|\[\]\)\.map\(a=>a&&a\.id===gAp\.id/.test(dec));
  ok("nothing is written to approvals when there was no gate", /\.\.\.\(gAp\?\{approvals:/.test(dec),
    "a normal approve must not invent an approvals list");

  ok("the activity log says it was an override", /⚠ OVERRODE \$\{cl\.name\} and started it anyway/.test(dec));
  ok("and which state it overrode", /never been asked.*asked for changes.*not answered/s.test(dec));
  ok("a non-gated approval still logs normally", /Approved \+ EXECUTED: \$\{action\.title\}/.test(dec));
}

// ── 5. The client's own approval still launches it by itself ────────────────
// The half he asked about. If this ever regresses, the gate turns into a deadlock where
// each side is waiting for the other.
{
  const portal = readFileSync(new URL("../netlify/functions/portal.mjs", import.meta.url), "utf8");
  ok("🔴 a client approving still starts the campaign", /if \(ap\.kind === "campaign" && ap\.campaignId\)/.test(portal),
    "with the owner's button now waiting on the client, this is the ONLY path that launches on time");
  ok("it activates on Google", /const \{ getAccessToken, activateCampaign \} = await import\("\.\/google-ads\.mjs"\)/.test(portal));
  ok("and clears the owner's queued item so he cannot double-approve",
    /pendingActions: \(apData\.pendingActions \|\| \[\]\)\.filter\(\(p\) => !\(p && p\.exec && String\(p\.exec\.campaignId\) === String\(ap\.campaignId\)\)\)/.test(portal));
  ok("a failure to start is reported as a failure, not a tick", /COULD NOT START THE CAMPAIGN/.test(portal));
}

console.log(`verify-launch-gate: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
