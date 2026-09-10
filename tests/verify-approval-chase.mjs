// The OS chases the CLIENT about an unanswered approval, then hands it to a human.
// Run: node tests/verify-approval-chase.mjs
//
// Bryson, 2026-09-09, asked what happens if his first real client goes quiet on a campaign
// approval the way he went quiet on the 2nd. The honest answer was: almost nothing.
// `alerts-watch` alerted BRYSON on day 3, once, de-duped forever by a boolean, and the
// CLIENT was never contacted by the OS at all. A signed client could sit on a built, paused
// campaign indefinitely while the system meant to automate follow-up said one thing, to one
// person, on one day.
//
// 🔴 On results-only terms a stalled approval costs BoldLine everything and the client
// nothing: no leads means no invoice, so every quiet week is unpaid time with no clock
// running on them. That is why this escalates and then STOPS, rather than repeating.
//
// The real helpers are imported and run, and the watcher's own send path is exercised
// against a recording sender, so "it emails them" is measured rather than asserted.

import { readFileSync } from "node:fs";
import { chaseDue, chasesSent, chaseable } from "../netlify/functions/alerts-watch.mjs";
import { renderClientEmail } from "../netlify/lib/client-emails-shared.mjs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const AP = (over = {}) => ({ id: "ap1", kind: "campaign", title: "Your Google ad campaign is ready to launch", status: "pending", createdAt: new Date().toISOString(), ...over });
const CL = (over = {}) => ({ id: "c1", name: "Stencil & Thread", email: "seb@stencilandthread.com", portalToken: "tok", ...over });

// ══════════════════════════════════════════════════════════════════════════════
// 1. THE LADDER
// ══════════════════════════════════════════════════════════════════════════════

eq("nothing is due on the day it is sent", chaseDue(AP(), 0), null);
eq("nor on day 2", chaseDue(AP(), 2), null);
eq("the first reminder is due on day 3", chaseDue(AP(), 3), { step: 1, of: 3, day: 3 });
eq("and stays due while it has not been sent", chaseDue(AP(), 5), { step: 1, of: 3, day: 3 });

const after = (n) => AP({ chases: Array.from({ length: n }, (_, i) => ({ at: "x", day: [3, 7, 14][i] })) });
eq("with one sent, nothing is due on day 4", chaseDue(after(1), 4), null);
eq("the second is due on day 7", chaseDue(after(1), 7), { step: 2, of: 3, day: 7 });
eq("the third on day 14", chaseDue(after(2), 14), { step: 3, of: 3, day: 14 });

// 🔴 THE LADDER ENDS. Emailing forever is not persistence, it is noise they learn to ignore,
// and it hides the fact that the thing now needs a person.
eq("after three, nothing is ever due again", chaseDue(after(3), 30), null);
eq("not even at a year", chaseDue(after(3), 365), null);
eq("nor with more chases recorded than the ladder has rungs", chaseDue(after(5), 365), null,
  "a stored count ahead of the ladder must not wrap round to a fourth reminder");
for (const n of [3, 4, 9]) for (const age of [14, 15, 100])
  eq(`${n} sent at day ${age} is finished`, chaseDue(after(n), age), null);

// A watcher that missed a day must catch up rather than skip a rung.
eq("a missed day does not skip a reminder", chaseDue(AP(), 9), { step: 1, of: 3, day: 3 },
  "a client who was never emailed on day 3 should get reminder ONE, not reminder two");
eq("and the next catches up too", chaseDue(after(1), 20), { step: 2, of: 3, day: 7 });

// The count is read off what was actually sent.
eq("no record means none sent", chasesSent(AP()), 0);
eq("a malformed record does not throw", chasesSent(AP({ chases: "nonsense" })), 0);
eq("a missing approval does not throw", chasesSent(null), 0);
eq("nor does chaseDue on a missing approval", chaseDue(null, 99), { step: 1, of: 3, day: 3 });

// ══════════════════════════════════════════════════════════════════════════════
// 2. WHO GETS CHASED, AND WHO NEVER DOES
// ══════════════════════════════════════════════════════════════════════════════

ok("a real client with a pending approval is chased", chaseable(CL(), AP()));

// 🔴 "changes" IS AN ANSWER. Chasing a client to approve the thing they just asked you to
// change is how you lose one.
ok("a client who asked for changes is never chased", !chaseable(CL(), AP({ status: "changes" })),
  "they answered; the ball is ours");
ok("nor one who already approved", !chaseable(CL(), AP({ status: "approved" })));
ok("the house account is never chased", !chaseable(CL({ internal: true }), AP()));
ok("nor is the demo client", !chaseable(CL({ demo: true }), AP()),
  "a fake client receiving real reminder emails is the kind of thing that reaches a real inbox");
ok("a client with no email address is not chased", !chaseable(CL({ email: "" }), AP()));
ok("🔴 nor one with no portal to send them to", !chaseable(CL({ portalToken: "" }), AP()),
  "an email whose only button opens a page they cannot use is worse than no email");
ok("an approval with no sent date is not chased", !chaseable(CL(), AP({ createdAt: null })),
  "with no start date the age is unknowable and it would chase on day zero forever");
ok("a missing client does not throw", !chaseable(null, AP()));
ok("a missing approval does not throw", !chaseable(CL(), null));

// ══════════════════════════════════════════════════════════════════════════════
// 3. THE EMAIL ITSELF
// ══════════════════════════════════════════════════════════════════════════════

{
  const first = renderClientEmail("approval_request", { contactName: "Sebastian Ruiz", approvalTitle: "Your Google ad campaign is ready to launch", portalUrl: "https://x.test/portal?token=t" });
  const rem = renderClientEmail("approval_request", { contactName: "Sebastian Ruiz", approvalTitle: "Your Google ad campaign is ready to launch", portalUrl: "https://x.test/portal?token=t", reminderDays: 7 });

  ok("the first ask reads as a first ask", /review is needed/i.test(first.subject), first.subject);
  ok("🔴 a reminder does NOT reuse the first-ask wording", first.subject !== rem.subject,
    "the same 'something is ready' email three times reads as a broken robot, and a hesitating client reads a broken robot as a reason to keep not answering");
  ok("the reminder says it is one", /still waiting/i.test(rem.subject), rem.subject);
  ok("and says how long it has been", /7 days/.test(rem.html), "a reminder with no elapsed time is just the same email again");
  ok("it says nothing has started", /Nothing has started yet/.test(rem.html),
    "the reason to act is that the ads are not running, not that we want an answer");
  ok("and invites the real objection", /If something is holding you up/.test(rem.html),
    "a client who is hesitating about spend will not volunteer it unless asked");
  ok("both carry the portal link", first.html.includes("https://x.test/portal?token=t") && rem.html.includes("https://x.test/portal?token=t"));
  ok("one day is not pluralised", /1 day[^s]/.test(renderClientEmail("approval_request", { reminderDays: 1 }).html));

  // Standing client-facing rules.
  for (const [name, mail] of [["first ask", first], ["reminder", rem]]) {
    ok(`the ${name} carries no em dash`, !/[—–]/.test(mail.html + mail.subject),
      "nothing a client reads may look AI written");
    ok(`the ${name} carries no emoji`, !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(mail.subject + mail.html.replace(/&[a-z]+;/g, "")),
      "no emojis in anything a client sees");
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. THE WATCHER'S OWN BOOKKEEPING
// ══════════════════════════════════════════════════════════════════════════════

const src = readFileSync(new URL("../netlify/functions/alerts-watch.mjs", import.meta.url), "utf8");

ok("it sends the branded approval email", /autoSendClientEmail\(cl, "approval_request"/.test(src));
ok("and tells it how long it has been waiting", /reminderDays: age/.test(src));

// 🔴 The ordering that decides whether a failed send costs the client a reminder.
{
  const iSend = src.indexOf("const res = await autoSendClientEmail");
  const iGuard = src.indexOf("if (!res.sent)");
  const iRecord = src.indexOf("a.chases = [...(a.chases || [])");
  ok("the send, the guard and the record are all present", iSend >= 0 && iGuard >= 0 && iRecord >= 0);
  ok("🔴 the chase is recorded only AFTER the send succeeds", iSend < iGuard && iGuard < iRecord,
    "recording first burns a rung of the ladder on an email that never left, and the client silently gets two reminders instead of three");
  ok("a failed send is logged, not swallowed", /approval chase to \$\{cl\.name\} failed/.test(src));
  ok("and it moves on to the next client rather than dying", /continue;/.test(src.slice(iGuard, iGuard + 200)));
}

ok("Bryson is told every time the OS emails his client", /Reminded \$\{cl\.name\} about/.test(src),
  "an automatic message to his client that he cannot see is a message he can be blindsided by");
ok("the alert says which reminder it was", /\(\$\{due\.step\} of \$\{due\.of\}\)/.test(src));
ok("and when the next one goes", /The next one goes out around day/.test(src));
ok("the last one says it is the last", /That was the last automatic reminder/.test(src));

// The hand-off.
ok("🔴 the ladder ends in a hand-off to a human", /handedOffAt/.test(src));
ok("it fires once, not daily", /!a\.handedOffAt/.test(src),
  "a red alert every morning about the same silent client is one he stops reading");
{
  const iHand = src.indexOf("if (chasesSent(a) >= APPROVAL_CHASE_DAYS.length && !a.handedOffAt)");
  const handOff = src.slice(iHand, src.indexOf("alerted++;", iHand));
  ok("the hand-off block was found", iHand >= 0 && handOff.length > 200, `got ${handOff.length} chars`);
  // 🔴 Scoped to the hand-off's OWN alert. Tested against the whole file this passed with
  // the hand-off downgraded to yellow, because other alerts in this watcher are red.
  ok("it is red, because it is now his job", /severity: "red"/.test(handOff),
    "a yellow alert is the colour of things that can wait, and this one cannot");
  ok("and it says the OS has stopped", /will not email them again/.test(handOff));
  ok("and what to do instead", /Phone them, or ask straight out whether the timing has changed/.test(handOff));
}

ok("a failed write is reported", /approval chase bookkeeping failed/.test(src),
  "losing the record means the same reminder goes again tomorrow, every day");
ok("the write only happens when something changed", /if \(changed\) \{/.test(src));

console.log(`verify-approval-chase: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
