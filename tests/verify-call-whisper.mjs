// The call-tracking whisper (Bryson, 2026-11-16, KB springbok-wellness-deal): when the business answers a call to the
// tracking number, THEY hear "New (patient) call from your Google ad." before the caller is connected, so the front
// desk can mark ad patients on the spot. Run: node tests/verify-call-whisper.mjs
import { readFileSync } from "node:fs";
const V = await import("../netlify/functions/voice.mjs");
let pass = 0; const fails = [];
const ok = (what, cond, detail = "") => { if (cond) pass++; else fails.push(`${what}${detail ? " — " + detail : ""}`); };

ok("Google plan says Google ad", V.whisperText(V.whisperKey({ packageId: "g-launch" }), false) === "New call from your Google ad.");
ok("Meta plan says Facebook or Instagram ad", V.whisperText(V.whisperKey({ packageId: "m-growth" }), false) === "New call from your Facebook or Instagram ad.");
ok("both platforms says online ad", V.whisperText(V.whisperKey({ packageId: "c-growth" }), false) === "New call from your online ad.");
ok("a health client hears 'new patient'", V.whisperText("g", true) === "New patient call from your Google ad.");
const tw = V.dialTwiml("(480) 555-0100", "https://os.example.com/.netlify/functions/voice?whisper=1&k=g&p=1");
ok("🔴 the whisper plays to the business only (a <Number url>, not a <Say> before the dial)", /<Dial><Number url="https:\/\/os\.example\.com\/\.netlify\/functions\/voice\?whisper=1&amp;k=g&amp;p=1">\(480\) 555-0100<\/Number><\/Dial>/.test(tw) && !/<Say>/.test(tw));
ok("switched off: a plain forward", V.dialTwiml("(480) 555-0100", "") === '<?xml version="1.0" encoding="UTF-8"?><Response><Dial>(480) 555-0100</Dial></Response>');
const say = async (q) => (await (await V.default(new Request("https://os.example.com/.netlify/functions/voice?" + q, { method: "POST", body: "" }))).text());
ok("the whisper URL answers with the line", (await say("whisper=1&k=g&p=1")).includes("<Say voice=\"Polly.Joanna\">New patient call from your Google ad.</Say>"));
ok("🔴 it can only ever say a fixed line, whatever the URL holds", (await say("whisper=1&k=%3CSay%3Ehi&p=0")).includes(">New call from your online ad.</Say>") && !(await say("whisper=1&k=%3CSay%3Ehi")).includes("hi<"));
const src = readFileSync(new URL("../netlify/functions/voice.mjs", import.meta.url), "utf8");
ok("on by default, off only with callWhisper: false, patient wording from the health switch", /client\.callWhisper === false \? ""/.test(src) && /healthModeOf\(client\)\.on \? 1 : 0/.test(src));

// The OS switch (Bryson, 2026-11-16): only the announcement turns off; tracking stays.
const UI = readFileSync(new URL("../index.html", import.meta.url), "utf8");
ok("the Call Tracking card has the announce switch, saving callWhisper", /onChange=\{e=>onUpdate&&onUpdate\(\{\.\.\.client,callWhisper:e\.target\.checked\}\)\}/.test(UI) && /Announce ad calls to/.test(UI));
ok("it says the same words the phone says", UI.includes('const line=`New ${healthModeOf(client).on?"patient ":""}call from your ${where}.`') && /where=id\.startsWith\("g-"\)\?"Google ad":id\.startsWith\("m-"\)\?"Facebook or Instagram ad":"online ad"/.test(UI));
ok("off still tracks", /Calls still ring straight through and are still tracked as leads/.test(UI));
if (fails.length) { console.log(`✕ ${fails.length} failed, ${pass} passed`); fails.forEach((f) => console.log("  ✕ " + f)); process.exit(1); }
console.log(`✓ verify-call-whisper: ${pass} checks passed`);
