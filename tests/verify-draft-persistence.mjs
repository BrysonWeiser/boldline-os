// The launch card's settings survive leaving the screen.
// Run: node tests/verify-draft-persistence.mjs
//
// Bryson, 2026-09-09: *"make sure when the campaign settings are changed they actually
// save and stay saved"*. They did not, and nothing said so, because nothing was broken:
// the campaign name, daily budget, landing page, match type, locations, negatives, goal,
// the typed service and the whole generated campaign were plain component state. Seeded
// from defaults on mount, gone on unmount. Switching tabs inside the client was enough.
// So was the app reloading while he answered a text message. Losing a generated campaign
// costs a model call and a minute or two of waiting, every time.
//
// THE THREE WAYS AN AUTO-SAVE LIKE THIS GOES WRONG, each asserted by running it:
//   1. It writes on MOUNT, overwriting a real draft with freshly computed defaults —
//      the exact loss it was built to prevent.
//   2. It saves against a STALE client. `onUpdate` replaces the whole record, so a
//      client captured before the debounce fired would silently undo a lead, an approval
//      or a note that arrived in between.
//   3. It only flushes on a TIMER, so leaving right after typing loses the last edit —
//      which is precisely when he expects it kept.
//
// The real hook is extracted from index.html and run against a fake React.

import { readFileSync } from "node:fs";

let pass = 0; const fails = [];
const ok = (l, c, d) => c ? pass++ : fails.push(l + (d ? ` — ${d}` : ""));
const eq = (l, a, b) => ok(l, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const os = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const hookSrc = os.slice(os.indexOf("function useSavedDraft("), os.indexOf("function GoogleLaunchCard("));
ok("the hook was extracted", /useEffect\(\(\) => \(\) => flush\.current\(\)/.test(hookSrc), "the unmount flush is the part that is easy to leave out");

// A React small enough to reason about: effects run in order, cleanups are kept, and
// timers are driven by hand so nothing here is timing-dependent.
//
// 🔴 The fake clearTimeout REALLY cancels. It was a no-op at first, and a no-op cannot
// tell a working debounce from a missing one: both look like a growing pile of pending
// timers, so the assertion below would have passed a card that wrote once per keystroke.
function mount(render) {
  const state = { refs: [], effects: [], cleanups: [], timers: new Map(), timerId: 0, i: 0, prevDeps: [] };
  const React = {
    useRef: (init) => { if (state.refs[state.i] === undefined) state.refs[state.i] = { current: init }; return state.refs[state.i++]; },
    useEffect: (fn, deps) => { state.effects.push([fn, deps]); },
  };
  const api = {
    render(...args) {
      state.i = 0; state.effects = [];
      const out = render(React, api.setTimeoutFake, ...args);
      state.effects.forEach(([fn, deps], k) => {
        const prev = state.prevDeps[k];
        const changed = !prev || !deps || deps.length !== prev.length || deps.some((d, j) => d !== prev[j]);
        if (!changed) return;
        if (state.cleanups[k]) state.cleanups[k]();
        state.prevDeps[k] = deps;
        state.cleanups[k] = fn() || null;
      });
      return out;
    },
    unmount() { state.cleanups.forEach((c) => c && c()); },
    fireTimers() { const t = [...state.timers.values()]; state.timers.clear(); t.forEach((fn) => fn()); return t.length; },
    pendingTimers: () => state.timers.size,
    setTimeoutFake: (fn) => { const id = ++state.timerId; state.timers.set(id, fn); return id; },
    clearTimeoutFake: (id) => { state.timers.delete(id); },
    state,
  };
  return api;
}

// Drives the real hook. `writes` records every onUpdate the hook makes.
function harness({ client, active = true }) {
  const writes = [];
  const onUpdate = (c) => { writes.push(c); };
  let current = client;
  const app = mount((React, setTimeoutFake, value, cl) => {
    const scope = { useRef: React.useRef, useEffect: React.useEffect,
      setTimeout: setTimeoutFake, clearTimeout: app.clearTimeoutFake };
    const fn = new Function(...Object.keys(scope), `${hookSrc}\nreturn useSavedDraft;`)(...Object.values(scope));
    return fn(cl, onUpdate, "campaignDraft", value, active);
  });
  return {
    writes,
    render(value, cl) { current = cl || current; return app.render(value, current); },
    tick() { return app.fireTimers(); },
    pending: () => app.pendingTimers(),
    unmount: () => app.unmount(),
    last: () => writes[writes.length - 1],
  };
}

const CLIENT = { id: "c1", name: "Stencil & Thread", leadsLog: [{ id: "L1" }] };

// ── 1. It does NOT write just because the card appeared ──────────────────────
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  eq("🔴 opening the card writes nothing", h.writes.length, 0,
    "a save on mount would replace a real saved draft with freshly computed defaults");
  eq("and arms no timer", h.pending(), 0);
  h.tick();
  eq("still nothing after the timer", h.writes.length, 0);
}

// ── 2. An edit saves, after the typing stops ─────────────────────────────────
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "AB" } });
  eq("an edit does not write immediately", h.writes.length, 0, "one database write per keystroke");
  ok("but a save is armed", h.pending() > 0);
  h.tick();
  eq("and it lands once the typing stops", h.writes.length, 1);
  eq("the draft is on the client record", h.last().campaignDraft.f, { name: "AB" });
  ok("stamped with when", typeof h.last().campaignDraft.savedAt === "number");
  eq("and nothing else on the client is touched", h.last().leadsLog, CLIENT.leadsLog);
  eq("including its id", h.last().id, "c1");
}

// Typing on does not write once per letter.
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  for (const v of ["Ab", "Abc", "Abcd", "Abcde"]) h.render({ f: { name: v } });
  eq("five more keystrokes are still one pending save", h.pending(), 1);
  h.tick();
  eq("which writes once", h.writes.length, 1);
  eq("with the last value typed", h.last().campaignDraft.f.name, "Abcde");
}

// Re-rendering with the SAME value is not an edit.
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "B" } });
  h.tick();
  const after = h.writes.length;
  h.render({ f: { name: "B" } });
  h.tick();
  eq("an unchanged re-render saves nothing", h.writes.length, after,
    "the client record is rewritten on every save; a render loop would hammer it");
}

// ── 3. 🔴 IT NEVER SAVES AGAINST A STALE CLIENT ──────────────────────────────
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "AB" } });                       // he types; a save is armed
  const withLead = { ...CLIENT, leadsLog: [{ id: "L1" }, { id: "L2" }], commLog: [{ note: "called" }] };
  h.render({ f: { name: "AB" } }, withLead);             // a lead arrives before it fires
  h.tick();
  eq("the save carries the lead that arrived while it was pending",
    h.last().leadsLog.length, 2,
    "spreading a client captured 900ms ago silently undoes whatever landed in between");
  eq("and the note", h.last().commLog, [{ note: "called" }]);
  eq("and still saves what he typed", h.last().campaignDraft.f.name, "AB");
}

// ── 4. 🔴 LEAVING THE SCREEN IS A SAVE, NOT A DISCARD ────────────────────────
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "typed and left immediately" } });
  eq("nothing written yet", h.writes.length, 0);
  h.unmount();
  eq("unmounting flushes the pending edit", h.writes.length, 1,
    "a debounce that only fires on a timer loses the last edit every single time");
  eq("with what he typed", h.last().campaignDraft.f.name, "typed and left immediately");
}

// ...but leaving without editing writes nothing.
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  h.unmount();
  eq("leaving an untouched card writes nothing", h.writes.length, 0);
}

// ...and a flush that already happened does not repeat on the way out.
{
  const h = harness({ client: CLIENT });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "B" } });
  h.tick();
  h.unmount();
  eq("an already-saved draft is not written twice", h.writes.length, 1);
}

// ── 5. It refuses when there is nothing safe to write to ─────────────────────
{
  const h = harness({ client: { name: "no id" } });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "B" } });
  h.tick(); h.unmount();
  eq("a client with no id is never written", h.writes.length, 0,
    "an update with no id cannot address a row and would fail silently");
}
{
  const h = harness({ client: CLIENT, active: false });
  h.render({ f: { name: "A" } });
  h.render({ f: { name: "B" } });
  h.tick();
  eq("switched off, it saves nothing on a timer", h.writes.length, 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. THE CARD ACTUALLY USES IT, AND READS IT BACK
// ══════════════════════════════════════════════════════════════════════════════

const card = os.slice(os.indexOf("function GoogleLaunchCard("), os.indexOf("function MetaLaunchCard("));

ok("the launch card saves its draft", /useSavedDraft\(client, onUpdate, "campaignDraft"/.test(card));
{
  const call = card.slice(card.indexOf('useSavedDraft(client, onUpdate, "campaignDraft"'), card.indexOf("const clearDraft"));
  for (const part of ["f", "gen", "audience", "budgetTouched", "picked"]) {
    ok(`the draft carries ${part}`, new RegExp(`\\b${part}[,:} ]`).test(call), call.slice(0, 200));
  }
  ok("🔴 picked is flattened to an array, not saved as a Set",
    /picked: picked \? \[\.\.\.picked\] : null/.test(call),
    "a Set written to the database comes back as {} — not null, so picked.has would throw");
}

// Read back: every field the form holds must be restored, and merged field by field.
ok("the form is seeded from the saved draft", /const savedF = \(saved && saved\.f\) \|\| null;/.test(card));
ok("🔴 field by field, never a whole-object swap",
  /for\(const k of Object\.keys\(d\)\) if\(savedF\[k\]!==undefined && savedF\[k\]!==null\) out\[k\]=savedF\[k\];/.test(card),
  "a swap means a field added later comes back undefined and React wipes the input");
ok("a card with no saved draft still gets its defaults", /if\(!savedF\) return d;/.test(card));
ok("the generated campaign is restored too", /useState\(\(saved && saved\.gen\) \|\| null\)/.test(card),
  "this is the expensive one — it costs a model call and a minute or two");
ok("the ticked groups come back as a Set", /Array\.isArray\(saved && saved\.picked\) \? new Set\(saved\.picked\) : null/.test(card));
ok("the typed service comes back", /useState\(\(saved && saved\.audience\) \|\| ""\)/.test(card));
ok("and whether he had overridden the budget", /useState\(!!\(saved && saved\.budgetTouched\)\)/.test(card));

// Every field on the form has to round-trip, or one of them silently resets each time.
{
  const formBlock = card.slice(card.indexOf("const [f,setF] = useState(()=>{ const d = {"), card.indexOf("if(!savedF) return d;"));
  const fields = [...formBlock.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
  ok("the form's fields were found", fields.length >= 10, fields.join(","));
  for (const want of ["name", "dailyBudgetDollars", "landingUrl", "matchType", "headlinesText",
                      "descriptionsText", "keywordsText", "locationsText", "negativeKeywordsText", "goal"]) {
    ok(`"${want}" is one of the saved fields`, fields.includes(want));
  }
}

// He must be able to get back to the defaults, because a saved draft goes stale — the
// landing page changes, the budget changes — and there would otherwise be no way out.
ok("there is a way to start over", /const clearDraft = \(\) =>/.test(card));
{
  // clearDraft moved below the derived helpers when the extraction boundaries shifted; the
  // slice ends at its own closing brace rather than at whatever happens to follow it.
  const cStart = card.indexOf("const clearDraft = () =>");
  const clear = card.slice(cStart, card.indexOf("\n  };", cStart) + 5);
  ok("the start-over handler was extracted", clear.length > 200, `got ${clear.length} chars`);
  ok("it asks first, and the answer is what decides", /if\(!confirm\(/.test(clear),
    "clearing a typed campaign by mis-tap is not recoverable");
  ok("it removes the stored draft", /delete next\.campaignDraft/.test(clear));
  ok("and puts the form back to its starting values", /setF\(\{ name:seed0\.name/.test(clear));
  ok("including the generated groups and the ticks", /setGen\(null\); setPicked\(null\);/.test(clear));
}

// An invisible auto-save is indistinguishable from no auto-save, which is the state he
// was complaining about.
ok("the card says the settings are kept", /so these stay put when you leave this screen/.test(card));
ok("and offers the way back", /start over<\/button>/.test(card));

console.log(`verify-draft-persistence: ${pass} passed, ${fails.length} failed`);
if (fails.length) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
