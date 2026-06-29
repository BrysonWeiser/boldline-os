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

export const footerHTML = () => `<footer>
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
  <p>Book a quick call — we'll look at what you have and tell you honestly what's working.</p>
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
<link rel="stylesheet" href="/blog.css">`;

export const notFoundPage = () => html(`<!DOCTYPE html>
<html lang="en">
<head>
${headTags({
  title: "Page Not Found — BoldLine Media",
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
