---
name: portal-script-parse
topic: Client Portal
task: debug a client portal button that does nothing, or edit the portal's inline browser script
keywords: [portal button does nothing, nothing happens when I press, tab does not switch, account tab dead, buttons dead, inline script, template literal escape, backslash eaten, regex escape, blUrl, show(), syntax error, script does not parse, emittedPortalScript, verify-portal-script-parses, preview account tab]
status: built
summary: Every button in the client portal was dead for about a day, on the LIVE portal as well as the OS preview. The portal's browser script is assembled inside a template literal, and a template literal eats `\/`, so `/^https?:\/\//i` shipped as `/^https?:///i`. A script with a syntax error defines NOTHING, so the tabs, Save, photo upload, Approve and Request Changes, Save a Card on File and the help chat all stopped at once. Introduced the same day by the field-formatting change that added blUrl. Two escapes in that literal are deliberate and must NOT be doubled. 23 checks, nine mutations caught, and verify-field-formats was itself reading the raw source, which is why it passed throughout.
verified: 2026-09-10
---

**Bryson, 2026-09-10:** *"When I'm in the os in my client and I was looking at his client portal preview I pressed account and it didn't do anything."*

## What was actually broken

Not the Account tab. **The entire script, in both copies of the portal.**

The portal's browser script is assembled inside a **template literal**, and a template literal treats `\/` as an escape that collapses to `/`. So this, written correctly in the source:

```
/^https?:\/\//i
```

shipped to the browser as `/^https?:///i`, which is a syntax error. **A script with a syntax error defines nothing at all**, so every function in it was missing and every button was dead:

| | |
|---|---|
| Tabs | `show()` never existed |
| Your Information | Save did nothing |
| Media | upload and delete did nothing |
| Review | 🔴 **Approve and Request Changes did nothing** |
| Account | Save a Card on File did nothing |
| Help | the chat did nothing |

🔴 **Including on Sebastian's real portal.** The campaign we had spent the week waiting for him to approve **could not be approved**, because the button did not work. The chase ladder built the previous evening would have kept emailing him to press a dead button.

**Introduced the same day** by commit `2345de3` (the field-formatting work), which added `blUrl` with two such regexes. It had been live for roughly a day.

## Why nobody saw it

- **Status is the tab already showing.** Pressing it changes nothing, so it reads as working. Only Account showed the fault, and only as silence.
- **Reading the source proves nothing.** `\/` is exactly what you write in a regex. The damage happens at a level the eye does not see.
- 🔴 **`verify-field-formats` was reading the RAW SOURCE and running it.** It pulled `blUrl` out of the file text and evalled it, which **only worked because the escapes were collapsing**. The test passed on a string that parses only in its broken form, and broke the moment the bug was fixed. A test that reads the source of generated code tests the generator's input, not its output.

## The two escapes that MUST stay single

Not every backslash in that literal is a mistake:

| | |
|---|---|
| `\\` | survives as one backslash, which is what `/\\n/g` needs |
| `<\/script>` | collapses to `</script>` **on purpose**, so the OUTER html parser does not close the script block early |

Doubling either of those breaks it the other way. The first attempt at the fix did exactly that to the script terminator and emitted a literal backslash into the page.

## The guard

`tests/verify-portal-script-parses.mjs` — **23 checks, nine mutations, all caught.** It evaluates the real template literal out of **both** files and calls `new Function` on what comes out. That is the only check that can see this class of bug, because the fault exists only in the emitted text.

`tests/helpers/portal-script.mjs` is now the one extractor, shared, so no suite reads the raw source again.

**The general rule:** when code is generated as a string, test the STRING THAT SHIPS. Anything else is testing the recipe rather than the meal.
