---
name: content-studio
topic: OS app
task: generate video ideas and shootable scripts for BoldLine's channels and Bryson's personal brand
keywords: [content studio, video ideas, video scripts, short form, reels, tiktok, shorts, youtube, podcast, personal brand, content pillars, contentIdeas, content-studio.mjs, no fake results]
status: verified
summary: `ContentStudioScreen` (nav item "Content") + `netlify/functions/content-studio.mjs` generate 6 video ideas at a time — short-form (Reels/TikTok/Shorts) or long-form (YouTube/podcast) — each with the literal opening hook, 3-5 beats, audience (business vs personal) and shoot effort; then write a full block-by-block script with timings, camera direction, caption, hashtags, on-screen text and shoot notes. Six content pillars. Saved ideas + scripts persist on the My Ads house-account record (`contentIdeas`) — no new Supabase table, no migration, syncs across devices. Hard guardrail: the model may NEVER invent client results, testimonials or case studies, because BoldLine has no clients yet. Built 2026-08-13. 27-case Playwright suite, all passing.
verified: 2026-08-13
---

**Why (Bryson, 2026-08-13):** *"build an ai within the os that will generate video ideas as well as scripts… for short form content/videos and for longer videos (mainly YouTube videos, podcasts, etc.) anything that'll help grow my personal brand as well as the business."*

**Where it lives:** desktop SideNav **"Content"** (below Campaigns) and the mobile **More** sheet; `screen==="content"`. Two tabs — **New ideas** and **Saved**.

**Flow:** pick short-form or long-form → optionally pick one of six **pillars** (Building in public · Teaching ads · Teardowns · Contrarian takes · Personal brand · Sales + cold calling) or "Mix it up" → optionally type a topic → **Generate 6 ideas**. Each idea card shows the title, the **literal first sentence to say on camera**, an audience chip (Business / Personal / Both), an effort chip (Easy shoot / Medium / Involved), length + platforms, the beats, and why it earns attention. Then **Write the script** on any idea, and **Save** to keep it.

**Scripts** come back as labelled blocks with timings (`0:00-0:04` for short-form, minute ranges for long-form), what to *say*, and a camera/edit direction per block — plus CTA, caption, hashtags, alternate titles, on-screen text overlays and pre-shoot notes. "Copy all" flattens the whole thing to plain text. Long-form has a 4-20 minute slider that drives the block structure; the hook and close are written verbatim while the middle stays as talking points so he doesn't sound read-aloud.

**HARD GUARDRAIL — no invented proof.** `GROUND_RULES` in the function forbids any client result, revenue figure, lead count, ROAS, testimonial, case study or "I helped X get Y" — not even as an example or placeholder. BoldLine has zero clients as of 2026-08-13, so every one of those would be a lie, and a young founder caught inventing social proof loses more than he'd gain. Where a results hook would normally sit, the prompt redirects to build-in-public, teaching, a teardown of a PUBLIC business's visible marketing, or a contrarian opinion. Also enforced: **no emojis** anywhere in the output (standing brand rule — this is public-facing), no hype-bro voice, and every idea must be shootable **alone, on a phone, with no crew or b-roll he doesn't have**. The empty state states the no-fake-results promise to Bryson directly so the constraint is visible, not hidden in a prompt.

**Repeat presses give NEW ideas.** Every title currently on screen plus every saved title is sent as an `avoid` list, so "Give me 6 more" doesn't reword the first batch.

**Persistence without a migration — the notable design call.** Saved entries go to `client.contentIdeas` on the **internal My Ads house-account record**, riding the existing clients-table save path (`updateClient`). No new Supabase table, nothing for Bryson to run in the SQL editor (a missing migration is exactly what caused the Lead Scout silent hang), and it syncs phone↔desktop for free. Entry shape: `{id, savedAt, mode, idea, script|null}`. With no house account yet, the Saved tab explains how to create one rather than failing.

**Model + cost:** `claude-sonnet-5` first, falling back to `claude-opus-4-8` only if the id is rejected (the pinned SDK predates the model list) — content writing sits inside Sonnet's range and the standing preference is to keep credit burn down. Bounded outputs on purpose: 6 ideas (`max_tokens` 2000) or 1 script (2600), which is what makes a **synchronous** function viable — same pattern as `aria.mjs`.

**KNOWN RISK, stated rather than hidden:** these are sync Netlify functions. If generation ever starts timing out, the fix is to convert to the `deal-research-background` + poll pattern (background function + a status row). The handler already detects timeout-shaped errors and says so in plain English instead of failing blankly, and detects credit exhaustion by name — the single most common cause, and the one that cost an afternoon during the Lead Scout build.

**Verified 2026-08-13 — 27 Playwright cases, all passing**, driving the real component in real Chromium with the AI call and Supabase session stubbed: renders, generates 6 cards, sends `mode:"short"` by default, sends an empty avoid list first and 6 titles on the second press, switches to `mode:"long"` with the minutes slider, renders a full script (hook, timings, directions, CTA, hashtags, shoot notes), saves exactly one entry with its script onto the house-account record without touching other fields, re-renders it from the Saved tab **with no further network calls**, explains itself when no house account exists, surfaces the out-of-credits error instead of swallowing it, and holds **0px horizontal overflow at 390/768/1280/1600**.

**GOTCHA for future harnesses:** `contentCall` reads `supabaseClient.auth.getSession()` **before** it ever reaches `fetch`, so stubbing fetch alone makes every call fail with "Session expired" and the stub never fires. Stub `window.supabaseClient.auth.getSession` too.
