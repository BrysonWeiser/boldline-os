---
name: visual-editor
topic: OS app
task: edit blog posts and newsletter emails as readable content instead of raw HTML
keywords: [visual editor, WYSIWYG, contentEditable, splitDoc, blog editor, newsletter editor, body_html, edit raw HTML, readable, review content, BlogManagementCard, NewsletterManagementCard]
status: verified
summary: The blog and newsletter editors used to show the raw HTML of body_html in a textarea, which Bryson couldn't read. Both now use a shared VisualEditor (index.html, just above the BLOG MANAGEMENT section) — a contentEditable WYSIWYG that renders the content formatted and lets you edit the words in place, with a one-tap "Edit raw HTML ▶" toggle kept for power edits. For a full-document email, splitDoc peels off the <body> wrapper before editing and re-stitches prefix+editedInner+suffix on save so the email's <head>/styles/<body> attributes are never lost; blog posts are HTML fragments and edit directly. Built 2026-07-29.
verified: 2026-07-29
---

**Why (Bryson, 2026-07-29):** "for the blogs and newsletter when I go into edit or review the content it shows me the html file which I don't know how to read. I just want to see the exact words and layout where I can read it and edit specific words and then save the changes and from there the AI puts it in the correct format."

**What was built (index.html):**
- `splitDoc(html)` helper + `VisualEditor` React component, inserted just before the `// ─── BLOG MANAGEMENT ───` section (~line 3650).
- `VisualEditor({html, onChange, itemKey, light, disabled})`:
  - Renders a `contentEditable` div showing the content **formatted** (headings, bold, lists, links render as real elements — no visible `<tags>`). `onInput`/`onBlur` call `emit()` which sends the full HTML back through `onChange`.
  - A small **"Edit raw HTML ▶"** toggle (top-right) swaps to a monospace `<textarea>` of the raw HTML for power edits, and **"◀ Visual editor"** swaps back.
  - `itemKey` (the post/email id) re-seeds the editable area when a different item is opened; the raw-toggle effect re-seeds on toggle back.
  - `light` gives the newsletter a white page (emails are light-themed); `disabled` makes it read-only.
- **`splitDoc`** — the key trick for emails. A newsletter `body_html` is a *full* HTML document (`<!doctype><html><head><style>…</style></head><body …>…</body></html>`). Editing the whole doc in a contentEditable would corrupt/drop the head + body attributes. So splitDoc regex-splits into `{prefix: everything up to and including <body…>, inner: the body contents, suffix: </body>…}`. Only `inner` goes into the editable; on save we re-stitch `prefix + editedInner + suffix`, so head/styles/`<body style/background>` survive untouched. If there's no `<body>` (a blog post — just an HTML **fragment**), prefix/suffix are empty and the whole thing edits directly.

**Wiring:**
- Blog (`BlogManagementCard` modal): label "Article — edit the words right here; the formatting is kept automatically" + `<VisualEditor html={editor.body_html||""} onChange={v=>setEd("body_html",v)} itemKey={editor.id}/>`.
- Newsletter (`NewsletterManagementCard` modal): label "Email — edit the words right here; the formatting is kept automatically" + `<VisualEditor … itemKey={editor.id} light disabled={editor.status==="sent"}/>` (sent emails are view-only).
- Save path is unchanged — the editors still `call("update",{…,body_html:editor.body_html})`; VisualEditor just feeds a clean, formatting-preserved `body_html` into that same state.

**Verified 2026-07-29:** splitDoc round-trips a full email doc exactly and returns a blog fragment untouched (unit test); headless render (ve-render.js) — blog editor renders h2/list/bold + readable words with no literal tags, raw toggle shows the HTML; newsletter editor renders h1/link/words with the `<body>` wrapper NOT leaked into the editable; an in-place edit of the headline, read back through the raw toggle, still keeps doctype + `<body …background>` + `</html>` and contains the edit — wrapper preserved on save. No page errors.

**Note:** contentEditable is a lightweight WYSIWYG (edit existing words/structure). It has no formatting toolbar (bold/heading buttons) — the AI produces the formatting; this surface is for reading + word-level edits, which is exactly what Bryson asked for. A toolbar could be added later if he wants to restyle by hand.
