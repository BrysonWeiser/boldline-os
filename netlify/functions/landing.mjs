import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";

const GOLD = "#C8A84B";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

const notFoundPage = () => html(
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#F9FAFB;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:360px}h1{font-size:20px;margin-bottom:8px}p{font-size:14px;color:#6B7280;line-height:1.6}</style></head><body><div><h1>Page not found</h1><p>This link may have expired or is no longer active.</p></div></body></html>`,
  404,
);

const comingSoonPage = (name) => html(
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#F9FAFB;color:#111827;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:360px}h1{font-size:20px;margin-bottom:8px}p{font-size:14px;color:#6B7280;line-height:1.6}</style></head><body><div><h1>${esc(name)}</h1><p>This page is being finished up. Check back shortly.</p></div></body></html>`,
);

export default async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return notFoundPage();

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>landingSlug", slug).maybeSingle();
  if (error) {
    console.error("Landing page lookup failed:", error);
    return notFoundPage();
  }
  if (!data) return notFoundPage();

  const cl = data.data;
  const lp = cl.landingPage || {};
  if (!lp.published || !lp.headline) return comingSoonPage(cl.name);

  const media = cl.mediaLibrary || [];
  // AI-chosen hero first (if it still exists), then first photo, then logo
  const hero = (lp.heroPath && media.find((m) => m.path === lp.heroPath)) || media.find((m) => m.category === "photo") || media.find((m) => m.category === "logo");
  const bullets = Array.isArray(lp.bullets) ? lp.bullets : [];
  const phone = cl.callTrackingNumber || "";

  const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Helvetica,Arial,sans-serif;background:#fff;color:#111827;line-height:1.5}.wrap{max-width:480px;margin:0 auto}.hero{padding:28px 20px 22px;text-align:center;background:linear-gradient(180deg,#FAFAF7,#fff)}.bizname{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${GOLD};margin-bottom:10px}.headline{font-size:27px;font-weight:800;color:#0F172A;line-height:1.25;margin-bottom:10px}.subhead{font-size:15px;color:#4B5563;margin-bottom:18px}.heroimg{width:100%;border-radius:14px;object-fit:cover;height:200px;margin-bottom:18px;display:block}.cta{display:block;width:100%;padding:15px;font-size:15px;font-weight:700;border-radius:11px;border:none;background:${GOLD};color:#1A1502;cursor:pointer;text-align:center;text-decoration:none}.callrow{margin-top:10px;font-size:13px;color:#6B7280}.callrow a{color:#0F172A;font-weight:700;text-decoration:none}.bullets{padding:6px 20px 22px;max-width:480px;margin:0 auto}.bullet{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;font-size:14px;color:#1F2937}.check{flex-shrink:0;width:20px;height:20px;border-radius:50%;background:rgba(200,168,75,.15);color:${GOLD};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}.formsec{padding:22px 20px 36px;background:#F8F8F4}.formtitle{font-size:17px;font-weight:800;margin-bottom:4px;color:#0F172A;text-align:center}.formsub{font-size:13px;color:#6B7280;text-align:center;margin-bottom:16px}.inp{width:100%;padding:13px 14px;border:1px solid #E5E7EB;border-radius:10px;font-size:15px;margin-bottom:10px;font-family:inherit;background:#fff}.err{display:none;font-size:12px;color:#DC2626;margin-bottom:10px;text-align:center}.thanks{display:none;text-align:center;padding:20px 10px}.thanks h2{font-size:18px;margin-bottom:6px;color:#0F172A}.thanks p{font-size:13px;color:#6B7280}`;

  const heroImg = hero ? `<img class="heroimg" src="${esc(hero.url)}" alt="">` : "";
  const bulletsHTML = bullets.map((b) => `<div class="bullet"><span class="check">✓</span><span>${esc(b)}</span></div>`).join("");
  const callRow = phone ? `<div class="callrow">or call <a href="tel:${esc(phone.replace(/[^0-9+]/g, ""))}">${esc(phone)}</a></div>` : "";

  const page = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>${esc(lp.headline)} — ${esc(cl.name)}</title><style>${css}</style></head><body>
<div class="wrap">
  <div class="hero">
    <div class="bizname">${esc(cl.name)}</div>
    <div class="headline">${esc(lp.headline)}</div>
    <div class="subhead">${esc(lp.subheadline || "")}</div>
    ${heroImg}
    <a class="cta" href="#lead-form">${esc(lp.ctaText || "Get My Free Quote")}</a>
    ${callRow}
  </div>
  <div class="bullets">${bulletsHTML}</div>
  <div class="formsec" id="lead-form">
    <div class="formtitle">${esc(lp.ctaText || "Get My Free Quote")}</div>
    <div class="formsub">Fill this out and we'll be in touch shortly.</div>
    <form id="lf">
      <input class="inp" id="lf-name" placeholder="Your name" required>
      <input class="inp" id="lf-phone" placeholder="Phone number" required>
      <input class="inp" id="lf-email" type="email" placeholder="Email (optional)">
      <div class="err" id="lf-err">Something went wrong — please try again.</div>
      <button class="cta" type="submit" id="lf-btn" style="border:none;width:100%">${esc(lp.ctaText || "Get My Free Quote")}</button>
    </form>
    <div class="thanks" id="lf-thanks"><h2>Got it — thank you!</h2><p>We'll be in touch shortly.</p></div>
  </div>
</div>
<script>
document.getElementById('lf').addEventListener('submit',function(e){
  e.preventDefault();
  var btn=document.getElementById('lf-btn'),err=document.getElementById('lf-err');
  err.style.display='none';btn.disabled=true;btn.textContent='Sending…';
  fetch('/.netlify/functions/lead-intake?token=${encodeURIComponent(cl.leadToken || "")}',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:document.getElementById('lf-name').value,phone:document.getElementById('lf-phone').value,email:document.getElementById('lf-email').value,source:'landing_page'})
  }).then(function(r){if(!r.ok)throw 0;document.getElementById('lf').style.display='none';document.getElementById('lf-thanks').style.display='block';})
  .catch(function(){err.style.display='block';btn.disabled=false;btn.textContent=${JSON.stringify(lp.ctaText || "Get My Free Quote")};});
});
<\/script>
</body></html>`;

  return html(page);
};
