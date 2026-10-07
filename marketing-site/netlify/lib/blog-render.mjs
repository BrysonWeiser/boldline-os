import { createClient } from "@supabase/supabase-js";
import { HEAD_ASSETS, AMBIENT, FOOTER, STICKY, SCRIPTS, CAL, CAL_WEB } from "./site-chrome.mjs";
export { CAL, CAL_WEB };

// Same Supabase project as the main OS — duplicated here (not imported across
// the repo) because this is a separate Netlify site with its own "base
// directory" build, so it only ever bundles files under marketing-site/.
export const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

export const SITE_URL = "https://boldlinemedia.com";
export const PAGE_SIZE = 24;

export const getSupabase = () => createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const html = (body, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const formatMonthYear = (iso) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
export const isoDate = (iso) => new Date(iso).toISOString().slice(0, 10);

export const headerHTML = () => `${AMBIENT}<header>
  <div class="nav-inner">
    <a class="nav-brand" href="/">
      <img src="/logo.png" alt="BoldLine Media">
      <span class="word">BoldLine Media</span>
    </a>
    <nav class="nav-links">
      <a href="/ads/">Ads</a>
      <a href="/websites/">Websites</a>
      <a href="/pricing/">Pricing</a>
    </nav>
    <div class="nav-right">
      <a class="hdr-cta" href="https://calendly.com/theboldlinemedia/30min" target="_blank" rel="noopener noreferrer">Book a Call</a>
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
  <div class="nav-mobile">
    <div class="nm-main">
      <a class="nm-big" href="/ads/"><b>Ads</b><span>Google and Meta ads, run for you</span></a>
      <a class="nm-big" href="/websites/"><b>Websites</b><span>Built to turn visits into calls</span></a>
    </div>
    <div class="nm-grid">
      <a href="/pricing/">Pricing</a>
      <a href="/how-it-works/">How it works</a>
      <a href="/industries/">Industries</a>
      <a href="/about/">About</a>
      <a class="current" aria-current="page" href="/blog/">Blog</a>
      <a href="/contact/">Contact</a>
    </div>
    <div class="nm-ctas">
      <a class="hdr-cta" href="https://calendly.com/theboldlinemedia/30min" target="_blank" rel="noopener noreferrer">Book a Call</a>
      <a class="nm-check" href="/free-check/">Free Lead-Leak Check</a>
    </div>
  </div>
</header>
<main id="main">`;

// Email-list signup — self-contained (own <style> + <script>) so it drops into
// any page (blog pages here, plus the homepage footer) with no CSS dependency.
// Posts to /.netlify/functions/subscribe (Resend Audience + website_leads backup).
// Email-list signup. Posts to /.netlify/functions/subscribe (Resend Audience + website_leads backup). Styled by
// site.css (.nl2); the guard in /test-copy.js stops the POST on the test copy.
export const newsletterHTML = (source = "blog") => `<section class="nl-wrap" aria-labelledby="nl-h"><div class="nl2 reveal">
  <div>
    <div class="eyebrow">Newsletter</div>
    <h3 id="nl-h">One useful email, twice a month.</h3>
    <p>What's working in Google and Meta ads and on websites for service businesses, written plainly. Unsubscribe any time.</p>
  </div>
  <form class="nl-form" data-source="${esc(source)}" onsubmit="return blSubscribe(this,event)">
    <input type="email" name="email" required placeholder="you@business.com" aria-label="Your email address" autocomplete="email">
    <input type="text" name="company" class="nl-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button type="submit">Subscribe</button>
    <div class="nl-msg" role="status" aria-live="polite"></div>
  </form>
</div></section>
<script>
window.blSubscribe=window.blSubscribe||function(form,ev){ev.preventDefault();
  var msg=form.querySelector('.nl-msg'),btn=form.querySelector('button'),old=btn.textContent;
  if(form.company.value){return false;}
  var email=(form.email.value||'').trim();
  btn.disabled=true;btn.textContent='Subscribing...';
  fetch('/.netlify/functions/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,company:form.company.value,source:form.getAttribute('data-source')||'website'})})
    .then(function(r){return r.json().catch(function(){return{ok:r.ok};});})
    .then(function(d){ if(d&&d.ok){ msg.className='nl-msg ok'; msg.textContent="You're in. The next one lands in your inbox."; btn.style.display='none'; form.email.style.display='none'; }
      else { msg.className='nl-msg err'; msg.textContent=(d&&d.error)||'Something went wrong. Please try again.'; btn.disabled=false; btn.textContent=old; } })
    .catch(function(){ msg.className='nl-msg err'; msg.textContent='Network error. Please try again.'; btn.disabled=false; btn.textContent=old; });
  return false;
};
</script>`;

export const footerHTML = () => `${newsletterHTML("blog")}
</main>
${FOOTER}${STICKY}${SCRIPTS}`;

// The offer at the end of an article follows what it was about: a website article offers the designs and the
// website booking; everything else offers the free check and an ads call.
const btn = (href, label, cls = "btn") => `<a class="${cls}" href="${href}"${/^https:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
export const offerHTML = (category = "", title = "") => /website|landing/i.test(`${category} ${title}`)
  ? `<div class="art-offer reveal"><div><h3>Want a site that turns visits into calls?</h3><p>Click through a full sample site, or book a call and we'll show you the three designs on your own business.</p></div>
  <div class="hero-ctas">${btn(CAL_WEB, "Book a website call")}${btn("/websites/", "See the designs", "btn btn-ghost")}</div></div>`
  : `<div class="art-offer reveal"><div><h3>Want to know where your calls are leaking?</h3><p>Send us your website and we'll show you where customers slip away, plus the quickest fixes. Free, and no call needed.</p></div>
  <div class="hero-ctas">${btn("/free-check/", "Free Lead-Leak Check")}${btn(CAL, "Book a Call", "btn btn-ghost")}</div></div>`;
export const postCtaHTML = () => offerHTML();

export const authorHTML = () => `<div class="art-author reveal">
  <img src="/founder.jpg" alt="Bryson Weiser, founder of BoldLine Media" width="64" height="64" loading="lazy">
  <p><b>Bryson Weiser</b>, founder of BoldLine Media. Bryson builds and runs Google and Meta ads, the landing pages behind them and the websites businesses send people to, for service businesses across the U.S. <a href="/about/">More about BoldLine</a></p>
</div>`;

// Analytics on every blog page. GA4 was previously only on the homepage, so
// blog traffic — the whole point of the SEO work — went unmeasured. Both IDs
// are public by design, so they are inline rather than env vars.
const ANALYTICS = `<!-- Analytics (GA4 + Microsoft Clarity), deferred off the critical path.
     gtag.js alone is ~499KB and was the bulk of mobile main-thread time. The
     command queues below are defined synchronously, so any early gtag()/clarity()
     call is buffered and replayed once the real scripts land. Loading starts on
     the first user interaction, or when the browser goes idle after load,
     whichever happens first. -->
<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','G-MG7T0687RT');
window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments)};
(function(){var done=false;
  function load(){if(done||window.__TEST_COPY)return;done=true;
    ['https://www.googletagmanager.com/gtag/js?id=G-MG7T0687RT','https://www.clarity.ms/tag/y0tivdizq8']
      .forEach(function(src){var s=document.createElement('script');s.async=true;s.src=src;document.head.appendChild(s);});}
  ['pointerdown','keydown','touchstart','scroll'].forEach(function(e){addEventListener(e,load,{once:true,passive:true});});
  addEventListener('load',function(){(window.requestIdleCallback||function(f){setTimeout(f,1800);})(load,{timeout:3500});});
})();
</script>`;

export const headTags = ({ title, ogTitle, description, canonical, ogType = "website", jsonLd }) => `<meta charset="UTF-8">
<script src="/test-copy.js"></script>
${ANALYTICS}
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" href="/icon.png">
<link rel="apple-touch-icon" href="/icon.png">
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="BoldLine Media">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE_URL}/og-boldline.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:image" content="${SITE_URL}/og-boldline.jpg">${jsonLd ? `
<script type="application/ld+json">
${JSON.stringify(jsonLd)}
</script>` : ""}
${HEAD_ASSETS}<link rel="stylesheet" href="/glossary.css">`;

export const notFoundPage = () => html(`<!DOCTYPE html>
<html lang="en">
<head>
${headTags({
  title: "Page Not Found | BoldLine Media",
  description: "This page doesn't exist.",
  canonical: `${SITE_URL}/blog/`,
})}
</head>
<body class="page" data-page="blog">
${headerHTML()}
<section class="page-hero ph-centre"><div class="wrap-x reveal">
  <div class="eyebrow">Blog</div>
  <h1>That page <em>isn't here.</em></h1>
  <p>It may have been moved or taken down. Everything we've written is on the blog.</p>
  <div class="hero-ctas"><a class="btn" href="/blog/">Back to the blog</a></div>
</div></section>
${footerHTML()}

</body>
</html>
`, 404);
