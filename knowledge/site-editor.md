---
name: site-editor
topic: Website
task: edit a website from the OS (any text, show/hide/reorder home page sections, add sections like prices, gallery, video, areas, team, text; choose photos per spot) or by talking to the AI, which edits a draft, suggests ideas and pushes back on bad ones; undo a save
keywords: [site editor, edit website, sections, layout, reorder, hide section, add section, blocks, pricing section, gallery, video, areas we serve, team, photo pick, AI editor, talk to the AI, site-ai, applySiteOps, homeLayout, SiteEditorCard, SiteAIChat, undo, history, custom website]
status: verified
summary: 2026-10-09 (later the same day) - CLIENT SIDE + SIGNATURE TIER LIVE: every website now has the editor (words, sections show/hide/reorder, photos); the AI editor and new sections are for his own businesses and clients on the new Signature website ($3,500 build, $150/mo care, 8 pages incl. 3 extra, 3 rounds, 4 care edits a month, designed around their brand); clients' Assets tab has the Brand kit. Original: Bryson, 2026-10-09 - wanted to "modify my own website and a clients own website more" (all of edit any text, show/hide/reorder, add new sections, choose each photo) plus "talk to the ai like how I talk to you and have it edit the website based off of what I say and then also have it give suggestions and also tell me if it's a bad idea and why". Built for HIS OWN businesses first (the card and the AI endpoint are owned-only); clients next. An "Edit the website" card on the Website tab with four tabs (Ask the AI, Sections, Words, Photos) editing a DRAFT shown in a live preview; Save puts it on the site and keeps the previous version for Undo (15 kept). The AI answers with a fixed menu of changes, each checked by applySiteOps, so it can only ever produce a draft he throws away.
verified: 2026-10-09
---

## What he asked (2026-10-09)

- "I also want to be able to modify my own website and a clients own website more."
- When asked which kinds of edits, he picked all four: edit any text; show, hide and reorder sections; add
  new sections; choose each photo.
- Plus: "I want to be able to talk to the ai like how I talk to you and have it edit the website based off
  of what I say and then also have it give suggestions and also tell me if it's a bad idea and why (this is
  for my own website and then if clients want to buy a custom built website or to add a specific page)".
- Earlier: "work only on the my business part first ... then we will go to clients side". So the editor
  card (`isOwned`) and `site-ai-background` (refuses non-owned) are owned-only for now.

## How the home page is built now: `netlify/lib/site-render.mjs`

- **`HOME_SECTIONS`** lists the built-ins in their original order: hero, marquee, services, story,
  beforeafter, why, steps, faq, reviews, cta.
- **`website.layout.home = [{key, hidden}]`.** `homeLayout(cl)` resolves it:
  - unknown keys are dropped, and duplicates are dropped;
  - built-ins missing from the list are put back after their nearest earlier neighbour;
  - added blocks without a place go just before `cta`;
  - 🔴 `hero` is always first and never hidden.
  - 🔴 With no saved layout, the order is the original one and nothing is hidden, so a site nobody
    edited renders as before.
- **`website.blocks = [{id, type, ...}]`**, at most 12, cleaned by `cleanBlock`:
  - `text` {heading, body; a blank line starts a paragraph}
  - `gallery` {photos; none picked uses his own photos, never stock}
  - `pricing` {items [{name, price, text}], note, plus the main button}
  - `video` {url: YouTube goes via youtube-nocookie, Vimeo via the player, an uploaded file plays in a
    `<video>`}
  - `areas` {text, places}
  - `team` {people [{name, role, photo}]}
  - 🔴 A block with nothing to show is not drawn: no empty frames on a live site.
  - Area names use class `area-chip`. `.pill` is the site's floating button bar, and reusing that class
    hid them (caught in a browser check, now pinned).
- **`website.photoPick = {hero, story, about}`.** A URL is only used if it is one of the site's own
  photos (`photoPicks`). The About page takes `cl` for this.
- `homeBody` builds each built-in once and walks the layout.

## The OS card: `SiteEditorCard` (Website tab, after the domain card)

- **Four tabs:**
  - **Ask the AI** (the default tab).
  - **Sections:** up and down arrows, Hide/Show, Edit and Remove for added sections, "+ Text / Photo
    gallery / Prices / Video / Areas we serve / Team", and Prices has "Fill from your booking packages".
  - **Words:** every field of `website.content`: the top of the page, buttons and closing, About, the
    Google listing, services, why, story paragraphs, how it works, questions, the moving strip.
  - **Photos:** Auto or a pick per spot.
- **The draft:** everything edits a DRAFT (`seDraftOf`), and the preview (`SiteFrame` with the draft
  client, sandboxed) shows it. "Not saved" shows while the draft differs.
- **Save:** writes `content` (dash-cleaned), `layout`, `blocks` and `photoPick`, plus
  `history: [previous, ...].slice(0,15)`. **Undo the last save** restores `history[0]`.
- 🔴 **`seDeDashBlocks`** cleans the words only. The dash cleaner rewrites things like "same-day", which
  would break a photo or link address.
- **`seLayout`** mirrors `homeLayout`. verify-site-editor runs both on the same records.

## The AI: `SiteAIChat`, `netlify/functions/site-ai-background.mjs`, `site-ai-poll.mjs`, `netlify/lib/site-ai.mjs`

- **The round trip:** the OS posts the conversation (last 12 turns) and the current DRAFT. The background
  function (owned-only, signed in) calls `claude-opus-5-5` with the one tool `answer`, which it must use
  (`tool_choice`, no thinking, because a forced tool can't be combined with it). The tool returns
  `{reply, suggestions (up to 3), changes}`.
- **The system prompt** (`siteAISystem`):
  - push back plainly with why, and offer a better way; if he insists later, do it and note the risk;
  - never invent facts; never mention BoldLine; no dashes or emojis; phones first;
  - what it can't do and where he does it instead (Brand kit for colours and fonts, Extra pages for new
    pages);
  - the business facts, the photo list, and the draft as JSON.
- **`applySiteOps`** (pure) checks every change against the menu:
  - `set_text` (named fields only), `set_list`, `add_section`, `update_section`, `remove_section` (a
    built-in is hidden, never deleted), `move_section` (`top` means right under the hero),
    `hide_section` / `show_section` (never the hero), `pick_photo` (own photos only);
  - at most 20 changes; anything else goes into `skipped`, said in plain words;
  - the draft it is given is never changed.
- **The answer:** stored on `siteAiJob` (added to SERVER_OWNED_KEYS) with `{reply, suggestions, done,
  skipped, draft}`. The OS polls `site-ai-poll` with its own job id, then puts the draft into the editor.
  🔴 **It never writes the website itself**; Save is his.
- **The conversation** is kept in localStorage on his device (last 30). Each answer costs a few cents.

## Client side and the Signature tier (2026-10-09, same day: "add it for the client side now" + "Also add the new premium package")

- **The editor is on every website's Website tab.** `custom = isOwned || wdTerms(client).tier === "signature"`.
  - **Every client** gets Words, Sections (show, hide, reorder) and Photos.
  - **Only `custom`** gets the AI editor and adding new sections.
  - A standard client sees `SignatureUpsell` in the AI tab: what Signature adds and how to offer it (pick
    Signature on the deal card before sending, or a new agreement if one is already out).
  - The card tells him a client's changes count toward their rounds or care plan edits, except how
    customers book.
- **Server:** `site-ai-background` refuses a non-owned client unless `termsOf(cl).tier === "signature"`
  (403 "The AI editor comes with the Signature website").
- **The Brand kit** is also on every client's **Assets** tab (`{!client.internal&&<BrandKitCard/>}`).
  `biz-email` `read-brand` now works for any client; test-sender and samples stay owned-only.
- **The Signature website** (`WEBSITE_SIGNATURE` in pricing-shared, mirrored in index.html):
  - **Price and inclusions:** $3,500 build, $150/mo care, 8 pages (the 5 plus 3 extra included), 3 rounds
    of changes, 4 care edits a month, designed around their brand, and a design call before building.
  - **Terms:** `websiteDeal.tier` / terms `tier` (`normTerms`: no tier means standard). The tier sets the
    default price and care, and anything typed still wins. `tierIncludes` and `extraPageAllowance` give
    extra pages plus the included 3, used by the page writer and the OS Extra pages card.
  - **Agreement WA-4:** the wording changes by tier. Key terms gets a "Website" row; section 1 gets eight
    pages plus the Signature paragraph; section 4 says three rounds; section 7 says four edits.
  - **OS:** the deal card has tier tiles (Standard / Signature). Picking one moves the price and care to
    that tier's defaults unless he had changed them.
  - **Public:** the `/pricing` page website section has a full-width "Signature website $3,500" card
    (`.wp-sig`), from the same price list.
  - **Deal Prep:** `websitePromptBlock` includes when to pitch it.
- **verify-marketing-pages** now reads the FAQ claims from the RENDERED standard agreement, because the
  wording varies by tier.

## Not built yet

- Sections on pages other than Home.
- Using the second and accent colours in new sections.

## Verification

- `tests/verify-site-editor.mjs` (44 checks).
- New sections rendered at 390 / 768 / 1280 / 1600: no sideways scroll, no script errors.
- The editor card driven on laptop and phone: Sections, Hide, + Prices, Fill from booking packages,
  Words, Photos. No sideways scroll.
