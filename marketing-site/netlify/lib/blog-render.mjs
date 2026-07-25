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
<link rel="icon" type="image/png" href="/logo.png">
<link rel="apple-touch-icon" href="/logo.png">
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
