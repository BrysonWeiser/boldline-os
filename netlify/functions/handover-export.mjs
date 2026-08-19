// Landing-page export for a Launch & Hand Off client.
//
// Bryson, 2026-08-19: "for hosting the landing page i will have the client host it but
// how do I tell them and cleanly hand it off"
//
// WHY AN EXPORT AND NOT A LINK. The live page at /lp/<slug> is rendered on request from
// BoldLine's database, on BoldLine's domain, by BoldLine's serverless function. It is not
// a file, and it cannot be "given" to anyone. The moment BoldLine stops running that
// function the page is gone. So the hand-off has to produce something that stands alone.
//
// WHAT WOULD BREAK IF YOU JUST SAVED THE PAGE (all three fail QUIETLY, which is why this
// exists rather than a "right click, save as" instruction):
//   1. The lead form posts to a RELATIVE BoldLine path. On their host it 404s and every
//      enquiry dies with a "something went wrong" the business owner never sees.
//   2. The phone number is a Twilio number BoldLine rents. It stops working when the
//      rental stops, and until then their calls route through an account they don't own.
//   3. Conversions reach Google through that same dead path. A Google campaign with no
//      conversion data cannot bid — it degrades over weeks while appearing to run fine.
//
// So this renders the page in HAND-OFF MODE (see renderLandingPage's `opts.handoff`) and
// ships it with a hosting guide written for someone who has never deployed anything.
//
// Netlify was chosen as the recommended host for one reason that matters more than the
// others: it handles the FORM. Drag the folder on, submissions appear in a dashboard and
// arrive by email, no account configuration, free at this volume. Any other static host
// leaves the form dead unless they wire up a third-party service, and a business owner
// with a $400 ad budget is not going to do that.
//
// POST { clientId, phone, conversionId?, conversionLabel?, domain? }
// Env: SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { renderLandingPage } from "./landing.mjs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

// A US number typed any way a person types one. Kept deliberately loose — this is a
// human-entered field and rejecting "(602) 555-0199" would be worse than useless.
const looksLikePhone = (s) => (String(s || "").match(/\d/g) || []).length >= 10;

const guide = ({ name, domain, conversionId, hasConversion, adsAccount }) => `HOW TO PUT YOUR PAGE ONLINE
For ${name}

You own this page. It is one file, it does not depend on us, and nothing here expires.
Follow these steps once and it is live.

────────────────────────────────────────────────────────
WHAT YOU HAVE
────────────────────────────────────────────────────────

One file: index.html

That is the whole page. Photos, text, layout, the lot. You do not need anything else.

────────────────────────────────────────────────────────
STEP 1 — PUT THE FILE IN A FOLDER ON ITS OWN
────────────────────────────────────────────────────────

1. On your computer, make a new folder. Call it "my-landing-page".
2. Move index.html into it.
3. Make sure that folder has nothing else in it.

That is it for this step. The folder is what you upload.

────────────────────────────────────────────────────────
STEP 2 — PUT IT ONLINE (about 3 minutes, free)
────────────────────────────────────────────────────────

We recommend Netlify. Not because it is fancy, but because it handles your contact
form for you. Most other options leave the form dead unless you pay for a separate
service, and then you would never know the form was broken.

1. Go to  https://app.netlify.com/drop
2. Drag your "my-landing-page" folder onto the big dotted box on that page.
3. Wait about 20 seconds. It will show you a web address ending in .netlify.app
4. Open that address on your phone. Your page should load. Fill the form in as a test.
5. It will ask you to make a free account so the page stays up. Do that. Use an email
   you actually check, because that is where your leads will go.

Your page is now live at that .netlify.app address.

────────────────────────────────────────────────────────
STEP 3 — TURN ON EMAIL FOR YOUR LEADS  ← DO NOT SKIP THIS
────────────────────────────────────────────────────────

Without this, form enquiries are collected but nobody tells you they arrived.

1. In Netlify, click your site.
2. Top menu: click "Forms".
3. You should see a form called "leads" with your test submission in it.
4. Click "Settings and usage", then "Form notifications", then "Add notification",
   then "Email notification".
5. Put in the email address you want new leads sent to. Save.

Send yourself one more test through the form and check the email arrives. If it does,
you are done with the hard part.

${domain ? `────────────────────────────────────────────────────────
STEP 4 — USE YOUR OWN WEB ADDRESS (${domain})
────────────────────────────────────────────────────────

The .netlify.app address works fine. If you would rather use your own domain:

1. In Netlify: your site, then "Domain management", then "Add a domain".
2. Type ${domain} and follow what it tells you.
3. It will give you settings to enter wherever you bought your domain
   (GoDaddy, Namecheap, Squarespace, whoever). Copy them across exactly.
4. It can take a few hours to start working. That is normal.

IMPORTANT: if you change the web address, your ad has to be updated to point at the
new one, or you will be paying for clicks that go to the old address. See step 5.

` : ""}────────────────────────────────────────────────────────
STEP ${domain ? "5" : "4"} — POINT YOUR ADS AT THE NEW ADDRESS
────────────────────────────────────────────────────────

Your ads currently point at the page we were hosting. That has to change or your
clicks will stop arriving.

1. Sign in to Google Ads${adsAccount ? ` (account ${adsAccount})` : ""}.
2. Left menu: Campaigns, then click your campaign, then "Ads".
3. For each ad, click the pencil icon to edit.
4. Find "Final URL" and replace what is there with your new address.
5. Save.

Do this for every ad. If you miss one, that ad sends people to a page that will
eventually stop working.

────────────────────────────────────────────────────────
STEP ${domain ? "6" : "5"} — CHECK CONVERSIONS ARE STILL COUNTING
────────────────────────────────────────────────────────

${hasConversion
  ? `Your conversion tracking is already built into the page (tag ${conversionId}).

To confirm it is working:
1. Fill in the form on your live page as a test.
2. Wait a few hours. Google is slow to report this.
3. In Google Ads: Goals, then Conversions. You should see the count go up by one.

If it does not move after a day, tell whoever manages your Google Ads account. Do not
ignore it: Google uses conversions to decide who to show your ad to, and a campaign
that cannot see conversions gets worse at finding customers over time.`
  : `⚠️  THERE IS NO CONVERSION TRACKING ON THIS PAGE YET, AND YOU SHOULD FIX THAT.

Google uses conversions to work out which clicks are worth buying. Without them your
campaign is guessing, and it gets worse at finding you customers over the following
weeks. It will not look broken. It will just quietly cost more per lead.

To set it up:
1. Google Ads: Goals, then Conversions, then "New conversion action", then "Website".
2. Follow it through. It will give you a conversion ID (starts with AW-) and a label.
3. Send both to us and we will paste them into your page.`}

────────────────────────────────────────────────────────
WHAT NOT TO DO
────────────────────────────────────────────────────────

• Do not rename index.html. Netlify looks for that exact name.
• Do not delete the hidden field near the top of the form. It is what stops spam bots,
  and removing it will fill your inbox with junk.
• Do not edit the page in Microsoft Word. Word rewrites the file and breaks it. If you
  want text changed, use a plain text editor, or ask us.
• Do not take the page down and put it back up at a different address without updating
  your ads first.

────────────────────────────────────────────────────────
IF SOMETHING GOES WRONG
────────────────────────────────────────────────────────

The form is not sending → check the file is called index.html, and check the "Forms"
section in Netlify. If the form does not appear there at all, the file was edited and
the hidden form-name field was removed.

The page will not load → make sure the folder you dragged had ONLY index.html in it.

Leads are arriving but not by email → step 3 was skipped or the address was mistyped.

Clicks dropped to nothing → your ads are still pointing at the old address. Step 5.

────────────────────────────────────────────────────────

BoldLine Media
brysonaweiser@gmail.com
`;

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);

  const authHeader = req.headers.get("authorization") || "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ ok: false, error: "Not authenticated" }, 401);
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData || !userData.user) return json({ ok: false, error: "Invalid session" }, 401);

  let body;
  try { body = JSON.parse((await req.text()) || "{}"); }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const clientId = String(body.clientId || "");
  if (!clientId) return json({ ok: false, error: "clientId required" }, 400);

  const { data: row, error } = await supabase.from("clients").select("data").eq("id", clientId).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!row || !row.data) return json({ ok: false, error: "Client not found." }, 404);
  const cl = row.data;

  if (!(cl.landingPage && cl.landingPage.headline))
    return json({ ok: false, error: "There is no landing page built for this client yet." }, 400);

  // 🔴 The phone number is REQUIRED, and refusing without it is the point. Exporting with
  // the Twilio tracking number baked in would hand the client a page that stops taking
  // calls the day the rental lapses, and neither of them would connect the two.
  const phone = String(body.phone || "").trim();
  if (!looksLikePhone(phone))
    return json({ ok: false, error: "Enter the client's OWN phone number. The tracking number stops working once you hand over, so it must not go on their page." }, 400);

  const conversionId = String(body.conversionId || "").trim();
  const conversionLabel = String(body.conversionLabel || "").trim();
  if (conversionId && !/^AW-\d+$/i.test(conversionId))
    return json({ ok: false, error: "A Google Ads conversion ID looks like AW-123456789." }, 400);

  const html = renderLandingPage(cl, { handoff: { phone, conversionId, conversionLabel } });

  // Belt and braces. These three strings are the whole reason this endpoint exists, and
  // a future edit to the renderer could reintroduce any of them without anyone noticing
  // until a client's leads quietly stopped arriving.
  const leaks = [];
  if (html.includes("lead-intake")) leaks.push("the BoldLine lead endpoint");
  if (cl.leadToken && html.includes(cl.leadToken)) leaks.push("the lead token");
  if (cl.callTrackingNumber && html.includes(cl.callTrackingNumber)) leaks.push("the call tracking number");
  if (leaks.length) {
    console.error("handover-export: refusing to ship a page containing", leaks);
    return json({ ok: false, error: `Export blocked: the page still contains ${leaks.join(" and ")}. This is a bug, not something you did wrong.` }, 500);
  }

  return json({
    ok: true,
    filename: "index.html",
    html,
    guide: guide({
      name: cl.name || "your business",
      domain: String(body.domain || "").trim(),
      conversionId, hasConversion: !!(conversionId && conversionLabel),
      adsAccount: cl.googleAdsCustomerId || "",
    }),
    warnings: [
      ...(conversionId && conversionLabel ? [] : ["No conversion tag: their campaign will stop receiving conversions and will get worse at bidding. Get the AW- id and label from their Google Ads account."]),
      ...(cl.callTrackingNumber ? ["Release the call tracking number after handover, or you keep paying for a number nobody uses."] : []),
    ],
  });
};
