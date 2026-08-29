---
name: dedash-ai-voice
topic: Marketing site
task: remove em-dashes and de-AI the copy, and keep future AI blog posts clean
keywords: [em-dash, deDash, dedash-posts.sql, writing-style, regexp_replace, on-conflict-do-nothing]
status: verified
summary: All em-dashes and AI-sounding phrasing were stripped site-wide (homepage, glossary, blog chrome, legal). blog-shared.mjs got a WRITING STYLE prompt block + a deterministic deDash() that strips "—" before save. Live posts fixed via docs/sql/dedash-posts.sql (the seed's ON CONFLICT DO NOTHING won't update them). 2026-08-29: the homepage and the ad landing page had REGRESSED to 35 visible dashes; re-cleaned and now pinned by a rendered check in tests/verify-no-dashes.mjs so it cannot drift again silently.
verified: 2026-08-29
---

## 🔴 2026-08-29: it drifted back, and nothing noticed for eight weeks

This entry said "0 em-dashes in visible copy" and it was true when written. By 2026-08-29 the
homepage carried **35 visible dashes** and the ad landing page carried 11, including the hero
paragraph, every price card ("Or a fee per qualified lead — whichever is higher"), every
coming-soon notice, and every form's error message. They came back the ordinary way: every
edit since July added one or two, and each individual one looked fine.

**Why the existing guards all missed it.** `verify-no-dashes` was thorough about the model's
output and about the client portal, and it checked the marketing site for *hyphenated
marketing compounds* only. It never looked for the character Bryson actually named on the
site's own hardcoded copy. Meanwhile a plain `grep "—"` over `marketing-site/index.html`
returns ~50 lines of which two thirds are CSS and JS comments explaining the animations, so
the one time it was run the signal was buried and the result was dismissed.

**What was rewritten** (all in `marketing-site/index.html` and `marketing-site/get-started/`):
hero paragraph, the four coming-soon Meta notices, the three "Estimated availability" chips,
all eleven greater-of price notes, the Lead-Leak Check pitch, the newsletter pitch, the
"Heads up" gate, and every JS status/error string a visitor can see. Sentinel blocks were
edited **in place**, never removed, so the Meta flip still works (`verify-meta-flip` passes).

**Number ranges lost the en dash too.** `$500–$2,500/mo` now reads `$500 to $2,500/mo`,
everywhere: the site, `netlify/lib/pricing-shared.mjs`, and the OS copy in `index.html`.
Checked at 390/768/1280/1600px, the longer string still sits on one line on every card.

**The guard that replaces the memory.** `verify-no-dashes` now strips `<script>`, `<style>`
and HTML comments, decodes `&mdash;`/`&ndash;`, and reads the marketing site the way a
visitor reads it. Each stripper was verified by deleting it and watching the check fail, and
a companion assertion checks the extractor still sees the real page copy, so it can never
degrade into a check that passes on an empty string. Package NAMES ("Full System — Growth")
are the one exemption: that is Bryson's product name, not copy.

---

A reviewer flagged two AI tells that lower trust: **em-dashes (—)** and generally "AI-sounding" voice. Fixes (v3.3):

- **Homepage `index.html`:** removed all 60+ em-dashes; killed the "it's not X, it's Y" construction, trimmed rule-of-three triads, cut repeated "honestly/actually," softened the founder quote; rewrote SEO `<title>` + meta/OG/Twitter + JSON-LD (Organization + FAQ) to match. 0 em-dashes in visible copy.
- **`glossary.js`:** all 13 definitions rewritten dash-free and plainer.
- **Blog chrome:** de-dashed the blog index hero, post CTA, page `<title>`s (now use `|` not `—`), and meta descriptions in `blog-render.mjs` / `blog-index.mjs` / `blog-post.mjs`.
- **Legal:** `privacy.html` / `terms.html` / `404.html` de-dashed.
- **Future AI posts (`netlify/lib/blog-shared.mjs`):** added an explicit **WRITING STYLE** block to the generation system prompt (never use em-dashes; vary sentence length; avoid the listed AI tics) **plus a deterministic safety net** — `deDash()` strips any "—" from the generated title/excerpt/meta/body **before save**. Covers both weekly auto-publish and the "Rewrite all" button.
- **Existing 3 live posts:** the seed uses `ON CONFLICT DO NOTHING`, so re-running it won't update them. Added **`docs/sql/dedash-posts.sql`** — a one-paste `UPDATE` (uses `regexp_replace` with clean spacing) to strip em-dashes from the live rows (run once in Supabase). Optional fuller refresh: click "Rewrite all" in the OS Blog panel. (Ran 2026-06-30; 0 em-dashes live.)
