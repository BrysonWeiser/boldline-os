---
name: site-vision
topic: Forms/Leads
task: have the audit LOOK at a prospect's page as a browser renders it, not just read its HTML, and get real speed numbers
keywords: [screenshot, visual audit, PageSpeed Insights, PAGESPEED_API_KEY, lookAtSite, site-vision, lighthouse, LCP, page speed, JS rendered, sees the page, vision, image to Claude]
status: verified
summary: The Lead-Leak audit read only the first HTML response, which is a skeleton on any site builder, and that is how it told a real prospect they had no contact form. `netlify/lib/site-vision.mjs` now asks Google PageSpeed Insights to load the page in a real Chrome on a phone, and hands the resulting SCREENSHOT to Claude as an image plus Lighthouse's own measurements as plain-English facts. So the report can say "the main content takes 4.2 seconds to appear on a phone" instead of guessing the page seems heavy, and the model can describe what it can actually SEE. The free `PAGESPEED_API_KEY` is now set in Netlify (2026-09-21) and restricted to the PageSpeed Insights API with no application restriction, because a Netlify function has no fixed address or referrer; keyless requests are rate limited to an immediate 429 from any shared address, so the key is what makes the look possible at all. 🔴 The first real audit is still the proof the response parses. Entirely fail-soft, and every outcome carries a plain-words note that is logged and written onto the lead, so a visual check that did not run can never be silent. 15 checks, nine mutations caught.
verified: 2026-09-21
---

**Why (Bryson, 2026-09-04):** *"Is there a way we can also have the ai visually look at the site too not just the code that way we hit every possible angle"*, asked right after he caught the audit claiming a roofing company had no contact form when one sat at the bottom of their homepage.

## 🔴 Reading the HTML is not seeing the page

`inspectSite` fetches the first HTML response. Wix, Squarespace, GoDaddy, Webflow and every React site assemble most of what a person sees **afterwards**, in the browser. The check was reading a skeleton and describing it as the house, and it was handing that description to the writer as fact.

## What was built

**`lookAtSite(url)`** calls Google PageSpeed Insights (`strategy=mobile`), which loads the page in a **real Chrome**, waits for it to finish, and returns:

- a **screenshot of the rendered page**, passed to Claude as an actual image content block, and
- **Lighthouse's own measurements**, turned into sentences a business owner can act on ("Time until the main content appears on a phone: 4.2 s") rather than jargon.

Mobile only, deliberately: that is where the traffic is, and a page that works on a phone almost always works on a desktop. A second desktop run would double the time for very little.

### Choices worth keeping

- 🔴 **The full-page screenshot is preferred over the first screenful**, because the thing that started all of this was a form **below the fold**. It falls back to the first screenful when the page is taller than 8000px or the image exceeds ~4.5MB of base64, so a very long site degrades instead of blowing the request.
- 🔴 **The image type is read, not assumed.** Lighthouse has shipped JPEG and WebP over the years; sending the wrong media type is a rejected request and the report silently loses its picture. Anything that is not an image data URI is refused outright.
- 🔴 **A missing measurement never becomes a sentence.** Every metric line is gated on the number actually existing.

### 🔴 The prompt is half the fix

A picture with no rule about it leaves the model two accounts of the same page and no way to choose, which is how the original mistake happened. So:

- **"When a screenshot is attached, IT IS THE TRUTH and the page source is not."** The model may then describe what it can see as fact, and is told to say what it noticed, because that is what proves it really looked.
- **When there is NO screenshot, the note says so and the never-assert-absence rule stays at full strength.** Dropping that rule once a screenshot existed would have reopened the original bug on every failed look, which is the most dangerous state of all.

## 🔴 It says whether it ran

A visual check that quietly does nothing is worse than not having one, because the report goes out sounding exactly as confident. Every return carries a `note` in plain words ("no PageSpeed key set, so nobody looked at the page", "Google is rate limiting the look-up", "it took too long to load"). That note is logged AND written onto the lead as `auditLooked`, so the first real run tells us plainly instead of degrading in silence.

Everything fails soft: a report without the picture is the report we sent yesterday, which is far better than no report at all.

## The key is LIVE (Bryson set it 2026-09-21 Phoenix, night)
**`PAGESPEED_API_KEY`** is now set on the OS Netlify site (`boldlinemedia`) and a clear-cache deploy
has run, so the visual half of the audit is switched on for the first time. Free, 25,000 checks a day,
from Google Cloud, PageSpeed Insights API. **Keyless does not work**: verified from a sandbox, three
attempts, immediate 429 every time, which is exactly what a Netlify function's shared address gets.

**How the key was created, because the restrictions matter and a replacement has to match:**
- Named **`BoldLine OS - PageSpeed`** so it is obvious later which key does what.
- **API restriction: YES, PageSpeed Insights API only.** It shares a Google Cloud project with the
  Google Ads setup, so an unrestricted key that leaked could be pointed at anything else in that project.
- **Application restriction: NONE, on purpose.** Netlify functions run from constantly changing
  addresses, so an IP restriction would pass today and silently break later, and there is no website
  referrer to check on a server-to-server call. The API restriction is what carries the safety here.

## Still not verified against a real response
The exact PageSpeed response shape could not be tested from here, because every keyless request was
rate limited. The parsing is written defensively against both documented screenshot locations and
refuses anything it does not recognise, and the `note` on the lead is there precisely so **the first
real run is the proof rather than a guess**. 🔴 **So the next Lead-Leak Check is the test**: read
`auditLooked` on that lead. "nobody looked at the page" means the key is not reaching the function;
a note about an unrecognised shape means the parsing needs a real sample. Do not assume it works
because the key exists.

## Files
- `netlify/lib/site-vision.mjs` (new).
- `netlify/functions/lead-leak-audit-background.mjs` — the image block, the facts, the prompt rules, `auditLooked`.
- `tests/verify-site-vision.mjs` (new).
