---
name: website-needs
topic: Sales
task: collect what a new website client must send (logo, photos, services, story, area, hours, contact, reviews, web address), ask for it on a call, or change the website intake checklist in the portal or the OS
keywords: [what we need from you, website intake, intake checklist, onboarding checklist, client checklist, website client onboarding, logo, photos, services and prices, about us, service area, hours, reviews, web address, domain, websites you like, websiteIntake, website-needs, needsStatus, WN_NEEDS, copy as a message, call questions]
status: verified
summary: Built 2026-10-13 (Bryson - "build the what i need from you list so i can ask for it on a call and also have it in the website client portal"). ONE list of 10 items (9 required + optional "websites you like") used three ways - the OS card "What we need from them" on a website client's Website tab (call questions + "Copy what's missing as a message"), and the portal card "What we need from you" on the client's Website tab, where each item ticks itself off from the record. Written answers save to `websiteIntake` (server-owned in the OS) and feed the website builder; logo/photos link to Photos & Video, phone/email to Your Information. Bryson gets a blue alert when a client sends details. Shown until the site is live.
verified: 2026-10-13
---

## The list (derived from what the website actually uses)
| Item | Done when | Feeds |
|---|---|---|
| Your logo | a `logo` upload in mediaLibrary | header of every page |
| 5 to 10 photos | 5+ `photo` uploads ("2 of 5 sent" shown) | the site's images instead of stock |
| Services and prices | `websiteIntake.services`, or services already on the record | builder facts |
| What makes you different | `websiteIntake.different` or brandVoice.differentiator | About page |
| Where you work | `websiteIntake.area` or campaignSetup service area | builder + Contact |
| Your hours | `websiteIntake.hours`, website.hours, or booking switched on | Contact page (render falls back to intake hours) |
| Phone and email | businessPhone + email (Your Information) | Contact page |
| Your reviews | intake reviews, typed reviews, or googleReviewUrl | Reviews page (Bryson types them in the editor) |
| Your web address | intake domain or websiteDeal.domain.host | domain card ("none" = send the buy guide) |
| Websites you like (optional) | intake likes | design direction |

"Done" is always read from the record, never ticked by hand.

## Where
- **Portal** (`needsCardHTML` in portal-website.mjs): under the status card on the Website tab, hidden once live.
  Save posts `{websiteIntake}`; the server refuses non-website clients, merges (saving one box never wipes
  another), logs it, and alerts only when something changed. Preview cannot save (portal preview blocks POSTs).
- **OS** (`WebsiteNeedsCard`, WN-MIRROR of `netlify/lib/website-needs.mjs`): under the agreement card on both
  Website tab layouts, for paying website clients only (not his own businesses). Shows the call question for
  each missing item, "See what they sent" for answers, and copies a plain message listing only what's missing
  with their portal link.

## Tests
`tests/verify-website-needs.mjs` (45): the list, done rules (4 photos is not 5, logo-as-photo is not a logo),
merge/clear/cap, the message (first name, only missing, no dashes or emojis), the portal card and script, the
server handler, the builder prompt, and the OS copy run against the server copy. Portal driven at
390/768/1280/1600: no sideways scroll, the Photos button opens the right card, no console errors.
