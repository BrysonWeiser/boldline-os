// Meta counted two leads; one existed. Why, and the fix.
// Run: node tests/verify-lead-double-count.mjs
//
// Bryson, 2026-09-09, on his own house campaign: *"why the os is showing two leads but I
// only got one"*. Meta reported 2 conversions on the Roofers campaign; the OS held 1.
//
// 🔴 THE BACKUP FORM ON THE MARKETING SITE HAD TWO SUBMIT LISTENERS.
//   1. An AJAX one that preventDefaults, posts to Netlify by fetch, and shows the
//      thank-you only if the post is accepted.
//   2. A separate one that fired the conversion on the submit EVENT, under a comment
//      reading "Netlify posts it normally, so fire just before it leaves".
//
// That comment was FALSE. The form is intercepted; nothing posts normally. So every submit
// told Meta a lead had happened before anything was saved, and:
//   - a HONEYPOT hit (Netlify answers 200 and silently bins it) counted as a lead,
//   - a refused post or dropped connection counted as a lead,
//   - and the missing person was invisible, because nothing anywhere recorded them.
// The cost per lead reads better than it is, which is the expensive part.
//
// The same bug was found and fixed on the AUDIT form on 2026-09-05. This copy was left
// behind, which is exactly what a second implementation of one thing costs.
//
// A third, quieter defect: the dedupe was PER KIND, so one visitor filling the audit form
// and the backup form sent Meta two Lead events.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const page = readFileSync(new URL("../marketing-site/get-started/index.html", import.meta.url), "utf8");
const code = page.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");

// ══════════════════════════════════════════════════════════════════════════════
// 1. THE LISTENER THAT FIRED TOO EARLY IS GONE
// ══════════════════════════════════════════════════════════════════════════════

ok("🔴 nothing reports a conversion straight off the submit event",
  !/addEventListener\('submit',\s*function\(\)\{\s*window\.blConversion/.test(code),
  "that is the listener that told Meta about leads that were never saved");
eq("the backup form reports its conversion exactly once in the whole page",
  [...code.matchAll(/blConversion\('form'\)/g)].length, 1);

// It has to sit in the SUCCESS branch, after the response was checked.
{
  const i = code.indexOf("fetch('/', { method:'POST'");
  const block = code.slice(i, i + 900);
  ok("the backup form's post was found", i >= 0);
  const iThrow = block.indexOf("if(!r.ok) throw 0");
  const iFire = block.indexOf("blConversion('form')");
  ok("both the check and the report are in the success branch", iThrow >= 0 && iFire >= 0);
  ok("🔴 the conversion is reported only after the post is accepted", iThrow < iFire,
    "reporting first means a refused post still counts as a lead");
  ok("and before the thank-you is shown", iFire < block.indexOf("ok.style.display='block'"));
  ok("the failure branch reports nothing", !/catch\(function\(\)\{[^}]*blConversion/.test(block),
    "a lead we did not save is not a lead");
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. 🔴 A BOT IS NOT A LEAD
// ══════════════════════════════════════════════════════════════════════════════
// Netlify answers a honeypot hit with 200 and then bins it. So `r.ok` is TRUE for a
// submission that never becomes a lead, and the success branch alone is not enough.

ok("the form still has its honeypot", /netlify-honeypot="bot-field"/.test(page));
ok("🔴 a filled honeypot reports no conversion", /!data\['bot-field'\]\s*&&\s*window\.blConversion/.test(code),
  "Netlify returns 200 for a honeypot hit and then throws it away, so an accepted post is not a saved lead");

// The audit form's guard, which was right all along, must stay right.
{
  const i = code.indexOf("fetch('/.netlify/functions/audit'");
  const block = code.slice(i, i + 700);
  ok("the audit form's post was found", i >= 0);
  ok("it still checks the response first", block.indexOf("if(!r.ok) throw new Error('save refused')") < block.indexOf("blConversion('audit')"));
  ok("and still reports through the shared tracker, not a raw pixel call",
    !/fbq\('track','Lead'\)/.test(block), "a second implementation is how half of it stops happening");
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. ONE PERSON IS ONE LEAD, RUN
// ══════════════════════════════════════════════════════════════════════════════

{
  // The real dedupe, lifted out and exercised.
  const i = page.indexOf("window.blConversion = function(kind){");
  const body = page.slice(i, page.indexOf("fired[slot] = true;", i) + 20);
  ok("the dedupe was extracted", /var slot = kind === 'book'/.test(body));
  const gate = new Function(`var fired = {};
    return function(kind){ ${body.slice(body.indexOf("var slot")).replace(/window\./g, "")} return true; };`)();

  ok("the first lead counts", gate("form") === true);
  ok("🔴 the same visitor's audit form does NOT count again", gate("audit") === undefined,
    "per-kind dedupe made one person two Meta leads");
  ok("nor does the backup form a second time", gate("form") === undefined);
  ok("a booking is still its own event", gate("book") === true,
    "Schedule is genuinely different from Lead and must not be swallowed");
  ok("but only once", gate("book") === undefined);
}

// Meta gets Lead for a form and Schedule for a booking, unchanged.
ok("a booking reports Schedule", /kind === 'book' \? 'Schedule' : 'Lead'/.test(code));

// And GA4 plus Google Ads still ride along, which is why the shared tracker exists.
ok("GA4 still hears about it", /gtag\('event', 'generate_lead'/.test(code));
ok("Google Ads still hears about it", /send_to: T\.googleAdsId/.test(code));

console.log(`verify-lead-double-count: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
