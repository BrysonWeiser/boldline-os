---
name: nav-parity
topic: OS/App
task: add a destination to the OS navigation, or work out why something is missing on mobile
keywords: [my ads missing mobile, no my ads tab, More sheet, MoreSheet, BottomNav, SideNav, nav parity, mobile navigation, desktop sidebar, openMyAds, phone navigation]
status: built
summary: My Ads was in the desktop sidebar and on the dashboard but had no entry in the mobile navigation at all, reachable only by scrolling the dashboard and spotting a card. The More sheet was simply never handed the action that already existed. Now added, and parity between the two navigations is asserted rather than described in a comment. 6 checks, five mutations caught.
verified: 2026-09-04
---

## What was wrong

Bryson, 2026-09-04: *"In the os on mobile there isn't a my ads tab just campaigns and the
other tabs"*.

`openMyAds` existed and worked. It was wired to the **desktop sidebar** and to a **card on the
dashboard**. The mobile `MoreSheet` was never handed it. So on a phone, **the account he checks
most often had no entry in the navigation at all** and could only be reached by scrolling the
dashboard and spotting a card.

🔴 **A COMMENT WAS PART OF WHY IT SURVIVED.** The note above `SideNav` read *"same destinations
as BottomNav plus a first-class Revenue entry"*, which made the split look accounted for. It
was wrong twice: the mobile equivalent is **BottomNav PLUS MoreSheet**, never the bar alone,
and the two had drifted apart. **A comment cannot fail.**

## The shape of the navigation

| Surface | Holds |
|---|---|
| `SideNav` | desktop only, every destination |
| `BottomNav` | phone, five primary entries |
| `MoreSheet` | phone, everything else |

**Adding a destination means touching `SideNav` AND one of the two mobile pieces**, plus the
`MoreSheet` wiring in the app root, which must both navigate and `setShowMore(false)`. A sheet
left open over the screen it just opened is a screen he cannot use.

## Testing note

`tests/verify-nav-parity.mjs`, 6 checks, five mutations all caught. It lists every destination
by **handler name rather than label**, so a wording change on one surface does not fail it,
and it asserts the sidebar genuinely offers each one first, or the list would demand things on
mobile for no reason. Also verified in a real 390px browser: the row appears, opens My Ads,
and the sheet closes behind it.

🔴 **He works from his phone most of the day.** The phone is the surface that matters and the
one nobody is looking at while building on a laptop, which is exactly why this needs a test
rather than care.
