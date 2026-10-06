---
name: website-design-bar
topic: Working preferences
task: design or build any website (a client site from the website builder, or BoldLine's own), or decide how much animation, 3D or effects to use
keywords: [website design, modern website, micro animations, 3d graphics, webgl, three.js, motion, scroll animation, premium design, website builder, client website, design quality, page speed, core web vitals, reduce motion, website themes]
status: standing rule
summary: Bryson, 2026-10-06, before the website builder was started - every site we build (clients and BoldLine's own) must be the most modern, best-looking site possible, micro animations and 3D included, "thinking outside the box". Agreed with guardrails - motion and 3D are layered on AFTER the page is fast and readable, and drop out on slow phones and for reduce-motion, because a slow small-business site loses both Google ranking and the call. Several distinct looks rather than one template, the client's own photos over effects, and all existing copy/safety rules still apply.
verified: 2026-10-06
---

## What he asked for

*"When we are building websites for other people (we will also need to do this for our own soon) I want
it to be the most up to date modern website meaning it looks the best this can include micro animations
3d graphics etc basically thinking outside the box."*

## How we deliver it (agreed approach, given to Bryson)

- **Premium motion, done right:** micro-interactions on buttons and cards, scroll-choreographed reveals,
  smooth section transitions, subtle depth and parallax, one tasteful 3D/WebGL accent where it earns its
  place (usually the hero). Abstract 3D (light, glass, particles, gradients), because no small business
  has 3D models of its own work and fake ones would mislead.
- 🔴 **Fast first, effects second.** The page must be readable and tappable almost instantly on a phone.
  Heavy pieces (3D) load after, are skipped on slow devices and data saver, and switch off for
  "reduce motion". Most of these visitors are on phones from an ad or a search, and a slow site loses
  them and its Google ranking.
- **Not one template.** Several distinct looks, the client's logo and colors applied, so two clients'
  sites never look the same. Offer a choice of looks, the way landing pages already offer three options.
- **Real photos beat effects.** The client's own photos of their work are the strongest thing on the
  page. Stock or AI imagery only for atmosphere, never presented as their work.
- **All the old rules still hold:** no emojis, no em dashes or AI-sounding copy, no links back to
  BoldLine or the OS, preview never changes anything real, responsive at 390/768/1280/1600.
- **BoldLine's own site** gets rebuilt to the same bar; it doubles as the portfolio piece prospects (and
  Shaun) wanted to see.

## Open questions put to Bryson
1. Two or three sites whose look he loves (links or screenshots), to calibrate taste.
2. Will clients supply photos; what to do when they have none.
3. Whether clients pick from a few looks (recommended) or he picks for them.

## 🔴 2026-10-06 CLARIFICATION (Bryson, after seeing step 1): it's the MOTION, not the layout
*"the main reason I sent the first website was the layout but mainly the animations. It made it feels unique,
luxury, and immersive but those were just examples of what I was talking about with thinking outside of the
box and then 3d stuff as well when applicable."*
So jeskojets.com is the bar for FEEL (immersive, cinematic, luxury, unique), not a layout to copy, and 3D is
used where it fits the business. Step 1's designs borrowed the references' layouts too literally and their
motion was polite. Next pass: scroll-driven scenes (pinned sections you scroll INTO, like Jesko's window),
smooth inertial scrolling, mask/clip reveals, motion-blur type, horizontal scroll galleries, page wipes,
and an industry-aware 3D scene per client where it earns its place. Fast-first guardrails unchanged.

🔴 **NO SIGNATURE MOVE TWICE (Bryson, 2026-10-06: "make sure we aren't only ever using the same animation like
how it went through the window").** Build a LIBRARY of scroll scenes, reveals, transitions and 3D scenes and
mix them per client, so no two sites share the same headline effect. The window fly-through is one option
among many, never the default.

**Tools question (same day):** he saw "UI UX Pro Max" on TikTok. Verified: a real, very popular community
skill (github.com/nextlevelbuilder/ui-ux-pro-max-skill) that loads design GUIDELINES and data (UI styles,
palettes, font pairings, UX rules). Useful for taste and consistency; it is not an animation library.
The real gains for motion are libraries the sites themselves load: GSAP with ScrollTrigger and SplitText
(free since 2025), Lenis smooth scrolling, Three.js for 3D; plus Spline for designing custom 3D scenes.
Recommended: add the skill to the repo only after reading it (third-party instructions run in every session).

## ✅ 2026-10-06 INSTALLED: two design skills in .claude/skills (every session gets them)
- **ui-ux-pro-max** (third party, MIT, commit 477bcb2): read first. Scripts only search its own CSV data
  (stdlib only, no network, no env vars). ONLY the core skill was copied; the repo's other bundled skills
  call outside image APIs and read .env files, so they were left out. Path fixed to $CLAUDE_PROJECT_DIR.
  Use: `python3 "$CLAUDE_PROJECT_DIR/.claude/skills/ui-ux-pro-max/scripts/search.py" "<industry> <keywords>"
  --design-system` per client for palette/type/pattern ideas; its motion.csv has GSAP presets.
- **frontend-design** (Anthropic, Apache 2.0, commit 683bc88): instructions only. 🔴 It names the tells of
  AI-generated design, and step 1's designs have several: Aurora = near-black + one acid-green accent, mono
  data labels, numbered [01] cards on content that is not a sequence, ALL-CAPS eyebrows, "→" in buttons;
  Editorial = warm cream + high-contrast serif + one italic accent word. The motion/3D upgrade should also
  fix these. Where it says "use motion sparingly", Bryson's brief wins: motion stays rich, but orchestrated
  (one strong moment per section), not scattered fade-ups.
- `/.claude/*` now 404s on the public site (publish = "." serves the whole repo).
- Nothing else worth installing now: GSAP (+ScrollTrigger, SplitText, free since the Webflow deal), Lenis
  and Three.js are loaded BY the websites, not installed by Bryson. Optional later: Spline (custom 3D),
  Context7 (live library docs) if library APIs ever trip us up.

## 🔴 2026-10-06 "THE RIGHT AMOUNT" (Bryson): *"don't use to much motion but also don't use to little basically using it at the right times"*
How that is applied (and built, KB `website-builder` "The motion system"):
- Each page gets ONE arrival (the headline entrance) and at most two scroll moments; the home page has
  exactly one big scene (portal, rail or stack). Everything else is quiet: short reveals, hover details.
- Motion answers something the visitor does (scrolls, points, clicks). Only the strip and the 3D backdrop
  move on their own, and both stop when off screen.
- Mixed per client from a library so no two sites share a signature move; the jet-window move ("portal")
  is one of three scenes, never the default.
- Tools actually used: our own small scroll engine (sticky sections + a progress value, no heavy library),
  Lenis for smooth scrolling, plain WebGL shaders for 3D. GSAP/Three.js were considered and not needed:
  they would add ~100KB+ to every client page for effects we get in a few KB.
