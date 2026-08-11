import { createClient } from "@supabase/supabase-js";

// Same Supabase project as the main OS — duplicated here (not imported across
// the repo) because this is a separate Netlify site with its own "base
// directory" build, so it only ever bundles files under marketing-site/.
export const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

export const SITE_URL = "https://boldlinemedia.com";
export const PAGE_SIZE = 6;

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

export const headerHTML = () => `<header>
  <div class="nav-inner">
    <a class="nav-brand" href="/">
      <img src="/logo.png" alt="BoldLine Media">
      <span class="word">BoldLine Media</span>
    </a>
    <nav class="nav-links">
      <a href="/#services">Services</a>
      <a href="/#process">Process</a>
      <a href="/blog/" class="current">Blog</a>
      <a href="/#contact">Contact</a>
    </nav>
    <div class="nav-right">
      <a class="hdr-cta" href="https://calendly.com/theboldlinemedia/30min" target="_blank" rel="noopener noreferrer">Book a Call</a>
      <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
    </div>
  </div>
  <div class="nav-mobile">
    <a href="/#services">Services</a>
    <a href="/#process">Process</a>
    <a href="/blog/" class="current">Blog</a>
    <a href="/#contact">Contact</a>
    <a class="hdr-cta" href="https://calendly.com/theboldlinemedia/30min" target="_blank" rel="noopener noreferrer">Book a Call</a>
  </div>
</header>
<script>(function(){var h=document.querySelector('header');if(!h)return;h.classList.add('nav-in');var s=function(){h.classList.toggle('scrolled',window.scrollY>12)};s();window.addEventListener('scroll',s,{passive:true});var t=h.querySelector('.nav-toggle'),m=h.querySelector('.nav-mobile');if(t&&m){t.addEventListener('click',function(){var o=m.classList.toggle('open');t.classList.toggle('open',o);t.setAttribute('aria-expanded',o?'true':'false')});m.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){m.classList.remove('open');t.classList.remove('open');t.setAttribute('aria-expanded','false')})})}})();</script>`;

// Email-list signup — self-contained (own <style> + <script>) so it drops into
// any page (blog pages here, plus the homepage footer) with no CSS dependency.
// Posts to /.netlify/functions/subscribe (Resend Audience + website_leads backup).
export const newsletterHTML = (source = "blog") => `<section class="nl-signup" aria-labelledby="nl-h">
  <div class="nl-inner">
    <div class="nl-eyebrow">Free Newsletter</div>
    <h3 id="nl-h">Marketing tips that actually move the needle</h3>
    <p>Practical Google &amp; Meta ads and lead-gen tips for busy business owners — a couple times a month. No spam, unsubscribe anytime.</p>
    <form class="nl-form" data-source="${esc(source)}" onsubmit="return blSubscribe(this,event)">
      <input type="email" name="email" required placeholder="you@business.com" aria-label="Your email address" autocomplete="email">
      <input type="text" name="company" class="nl-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="submit">Subscribe</button>
    </form>
    <div class="nl-msg" role="status" aria-live="polite"></div>
  </div>
</section>
<style>
.nl-signup{background:linear-gradient(160deg,rgba(200,168,75,.07),rgba(13,15,22,.35));border-top:1px solid rgba(200,168,75,.18);border-bottom:1px solid rgba(200,168,75,.18);padding:46px 20px}
.nl-signup .nl-inner{max-width:560px;margin:0 auto;text-align:center}
.nl-signup .nl-eyebrow{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#C8A84B;margin-bottom:10px}
.nl-signup h3{font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:clamp(22px,3.4vw,30px);color:#fff;margin:0 0 10px;line-height:1.2}
.nl-signup p{color:#9CA3AF;font-size:14.5px;line-height:1.6;margin:0 0 20px}
.nl-form{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.nl-form input[type=email]{flex:1 1 260px;max-width:340px;padding:13px 15px;font-size:15px;font-family:inherit;color:#F5F3ED;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.14);border-radius:10px}
.nl-form input[type=email]:focus{outline:none;border-color:rgba(200,168,75,.55)}
.nl-form button{padding:13px 26px;font-size:14px;font-weight:700;letter-spacing:.03em;border:none;border-radius:10px;background:linear-gradient(135deg,#C8A84B,#b8963f);color:#15110A;cursor:pointer;transition:transform .18s,box-shadow .18s}
.nl-form button:hover{transform:translateY(-1px);box-shadow:0 10px 26px -12px rgba(200,168,75,.6)}
.nl-form button:disabled{opacity:.6;cursor:default;transform:none;box-shadow:none}
.nl-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}
.nl-msg{min-height:20px;margin-top:14px;font-size:13.5px;line-height:1.5}
.nl-msg.ok{color:#34D399}
.nl-msg.err{color:#F87171}
@media(max-width:480px){.nl-form input[type=email],.nl-form button{flex:1 1 100%;max-width:none}}
</style>
<script>
window.blSubscribe=window.blSubscribe||function(form,ev){ev.preventDefault();
  var msg=form.parentNode.querySelector('.nl-msg'),btn=form.querySelector('button'),old=btn.textContent;
  if(form.company.value){return false;}
  var email=(form.email.value||'').trim();
  btn.disabled=true;btn.textContent='Subscribing…';
  fetch('/.netlify/functions/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,company:form.company.value,source:form.getAttribute('data-source')||'website'})})
    .then(function(r){return r.json().catch(function(){return{ok:r.ok};});})
    .then(function(d){ if(d&&d.ok){ msg.className='nl-msg ok'; msg.textContent="You're in — thanks! Watch your inbox for the first tips."; form.style.display='none'; }
      else { msg.className='nl-msg err'; msg.textContent=(d&&d.error)||'Something went wrong — please try again.'; btn.disabled=false; btn.textContent=old; } })
    .catch(function(){ msg.className='nl-msg err'; msg.textContent='Network error — please try again.'; btn.disabled=false; btn.textContent=old; });
  return false;
};
</script>`;

export const footerHTML = () => `${newsletterHTML("blog")}
<footer>
  <div class="word">BoldLine Media</div>
  <div class="copy">© 2026 BoldLine Media. All rights reserved.</div>
  <nav>
    <a href="/">Home</a>
    <a href="/blog/">Blog</a>
    <a href="/privacy.html">Privacy</a>
    <a href="/terms.html">Terms</a>
  </nav>
  <div class="social">
    <a href="https://www.instagram.com/boldlinemedia" target="_blank" rel="noopener noreferrer me" aria-label="BoldLine Media on Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z"/></svg></a>
    <a href="https://www.facebook.com/BoldLineMedia" target="_blank" rel="noopener noreferrer me" aria-label="BoldLine Media on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 011.141.195v3.325a8.623 8.623 0 00-.653-.036 26.805 26.805 0 00-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 00-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z"/></svg></a>
    <a href="https://www.linkedin.com/in/brysonweiser" target="_blank" rel="noopener noreferrer me" aria-label="BoldLine Media on LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>
  </div>
</footer>`;

// One consistent CTA on every individual post (the 3 hand-written posts each
// used to carry a bespoke CTA line; standardized on a single generic one here
// since future AI-written posts can't get a hand-tuned line each time).
export const postCtaHTML = () => `<div class="post-cta reveal">
  <h3>Want a second opinion?</h3>
  <p>Book a quick call and we'll look at what you have and give you an honest read on what's working.</p>
  <a class="btn" href="https://calendly.com/theboldlinemedia/30min" target="_blank" rel="noopener noreferrer">Book a Call</a>
</div>`;

export const headTags = ({ title, ogTitle, description, canonical, ogType = "website", jsonLd }) => `<meta charset="UTF-8">
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
<meta property="og:image" content="${SITE_URL}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:image" content="${SITE_URL}/og-image.png">${jsonLd ? `
<script type="application/ld+json">
${JSON.stringify(jsonLd)}
</script>` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog.css">
<link rel="stylesheet" href="/glossary.css">
<script src="/glossary.js" defer></script>`;

export const notFoundPage = () => html(`<!DOCTYPE html>
<html lang="en">
<head>
${headTags({
  title: "Page Not Found | BoldLine Media",
  description: "This page doesn't exist.",
  canonical: `${SITE_URL}/blog/`,
})}
</head>
<body>

${headerHTML()}

<div class="breadcrumb"><a href="/blog/">← Back to Blog</a></div>

<div class="article-head reveal">
  <h1>Page not found</h1>
</div>

<div class="article-body reveal">
<p>That page doesn't exist, or it may have been removed. Head back to the <a href="/blog/">blog</a> to see what's there now.</p>
</div>

${footerHTML()}

</body>
</html>
`, 404);
