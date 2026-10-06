// The "Website" tab of the client portal (KB `website-builder`).
//
// Bryson, 2026-10-06: *"Wed also need to add a way for the client to view the analytics and other details
// (in the client portal)"*. One place a client sees everything about their website: where it stands, the
// link, what they have paid and what is due (with a pay button), their monthly plan, how many people
// visited and from where, the enquiries it brought in, their blog, and a box to ask for a change.
//
// Written for the client, so: plain words, no emojis, no dashes. Every number on it is read from the
// record or from site_visits; nothing is estimated or invented, and when a number is not available yet the
// tab says so rather than showing a zero that looks like a failure.

import { dealOf, termsOf, amountsOf, buildTotal, monthlyTotal, isSigned, firstPaid, fullyPaid, agreementLive, exempt } from "./website-deal.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const date = (iso) => { try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" }); } catch { return ""; } };
const httpsOnly = (u) => (/^https:\/\//.test(String(u || "")) ? String(u) : "");
export const CARE_EDITS_PER_MONTH = 2;

// Show the tab at all? A client with a website deal, a website being built, or a website-only client.
export const hasWebsite = (cl) => !!(cl && !exempt(cl) && (agreementLive(cl) || (cl.website && cl.website.content) || cl.packageId === "w-site"));

// Where it stands, in one line for the client.
export function websiteStatus(cl) {
  const d = dealOf(cl), w = (cl && cl.website) || {}, a = d.agreement;
  if (w.published && d.launchedAt) return { key: "live", label: "Live", text: "Your website is live." };
  if (!a || !["sent", "delivered", "completed"].includes(a.status)) return { key: "none", label: "Getting started", text: "Your website agreement is on its way to you." };
  if (!isSigned(cl)) return { key: "sign", label: "Waiting for your signature", text: "Check your email for the agreement from DocuSign. Signing takes a minute." };
  if (!firstPaid(cl)) return { key: "pay", label: "Signed, thank you", text: "Your first invoice is in your email. We start building as soon as it's paid." };
  if (!w.content) return { key: "build", label: "Being built", text: "We're building your website now. You'll get a link to see it before anything goes live." };
  if (!fullyPaid(cl)) return { key: "review", label: "Ready for you to look at", text: "Have a look using the link below and tell us what you'd like changed. The final payment is due before it goes live." };
  return { key: "launch", label: "Paid in full", text: "Thank you. We're putting your website live now." };
}

// Sparkline-style daily bars as inline SVG. One series, one color, a hover title on every bar, and a
// text summary for screen readers (KB dataviz rules: single series needs no legend; the title names it).
function dayBars(byDay) {
  const max = Math.max(1, ...byDay.map((d) => d.visitors));
  const W = 300, H = 70, gap = 2, bw = (W - gap * (byDay.length - 1)) / byDay.length;
  const bars = byDay.map((d, i) => {
    const h = d.visitors ? Math.max(3, Math.round((d.visitors / max) * (H - 4))) : 0;
    const x = (i * (bw + gap)).toFixed(1);
    return `<rect x="${x}" y="${H - h}" width="${bw.toFixed(1)}" height="${h}" rx="2" fill="#C8A84B"><title>${esc(date(d.day + "T12:00:00Z"))}: ${d.visitors} visitor${d.visitors === 1 ? "" : "s"}</title></rect>`
      + `<rect x="${x}" y="0" width="${bw.toFixed(1)}" height="${H}" fill="transparent"><title>${esc(date(d.day + "T12:00:00Z"))}: ${d.visitors} visitor${d.visitors === 1 ? "" : "s"}</title></rect>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" role="img" aria-label="Visitors per day for the last ${byDay.length} days, highest ${max}">${bars}<line x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}" stroke="rgba(255,255,255,.12)" stroke-width="1"/></svg>`;
}

const share = (rows, total, label) => rows.map((r) => {
  const pct = total ? Math.round((r.n / total) * 100) : 0;
  return `<div style="margin:7px 0"><div style="display:flex;justify-content:space-between;font-size:12px;color:#D1D5DB"><span>${esc(label(r.key))}</span><span style="color:#9CA3AF">${r.n} &middot; ${pct}%</span></div><div style="height:6px;border-radius:3px;background:rgba(255,255,255,.06);margin-top:4px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#C8A84B;border-radius:3px"></div></div></div>`;
}).join("");

const PAGE_NAMES = { "/": "Home", "/services/": "Services", "/about/": "About", "/reviews/": "Reviews", "/contact/": "Contact", "/blog/": "Blog" };
const pageName = (p) => PAGE_NAMES[p] || (String(p).startsWith("/blog/") ? "Blog article" : String(p).replace(/^\/|\/$/g, "").replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()) || "Home");

// The whole tab. `ctx` = { siteUrl, stats (from site-stats.summarize, or null), posts (published), now }.
export function websitePortalHTML(cl, ctx = {}) {
  const now = ctx.now || Date.now();
  const d = dealOf(cl), t = termsOf(cl), m = amountsOf(t), w = cl.website || {};
  const st = websiteStatus(cl);
  const siteUrl = httpsOnly(ctx.siteUrl);
  const link = st.key === "live" ? siteUrl : st.key === "review" || st.key === "launch" ? (siteUrl && w.previewKey ? `${siteUrl}?preview=${encodeURIComponent(w.previewKey)}` : "") : "";
  const statusCard = `<div class="card"><div class="lbl">Your website</div><div style="font-size:19px;font-weight:800;color:${st.key === "live" ? "#10B981" : "#F5F3ED"};margin-bottom:4px">${esc(st.label)}</div><div style="font-size:12px;color:#9CA3AF;line-height:1.6">${esc(st.text)}</div>${link ? `<a class="btn" style="display:block;text-align:center;text-decoration:none" href="${esc(link)}" target="_blank" rel="noopener">${st.key === "live" ? "Visit your website" : "See your website"}</a>` : ""}</div>`;

  // Payments: what was agreed, what is paid, what is due (with Stripe's own pay page).
  const lines = m.stages.map((s) => {
    const due = s === "final" ? m.final : m.first;
    const inv = d.invoices[s] || {};
    const name = s === "deposit" ? "First half" : s === "final" ? "Second half" : "Website build";
    const right = !(due > 0) ? "Nothing to pay" : inv.paidAt ? `<span style="color:#10B981">Paid ${esc(date(inv.paidAt))}</span>` : httpsOnly(inv.url) ? `<a href="${esc(inv.url)}" target="_blank" rel="noopener" style="color:#C8A84B;font-weight:700">Pay now</a>` : `<span style="color:#9CA3AF">${s === "final" ? "Due before it goes live" : "Invoice coming"}</span>`;
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12.5px"><span style="color:#D1D5DB">${name} &middot; ${money(due)}</span><span>${right}</span></div>`;
  }).join("");
  const monthly = monthlyTotal(t);
  const care = d.careSub || {};
  const careLine = monthly > 0 ? `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12.5px"><span style="color:#D1D5DB">Monthly plan &middot; ${money(monthly)}/mo</span><span style="color:${care.status === "past_due" ? "#F59E0B" : "#9CA3AF"}">${care.status === "active" ? "Active" : care.status === "past_due" ? "Payment failed, Stripe will retry" : care.status === "canceled" ? "Ended" : "Starts when it goes live"}</span></div>` : "";
  const payCard = isSigned(cl) ? `<div class="card"><div class="lbl">Payments</div><div style="font-size:12px;color:#9CA3AF;margin-bottom:6px">Build total ${money(buildTotal(t))}${t.extraPages ? `, including ${t.extraPages} extra page${t.extraPages > 1 ? "s" : ""}` : ""}${t.blog ? ", including your blog" : ""}.</div>${lines}${careLine}</div>` : "";

  // Visitors. Only once the site is live; before that there is nothing honest to show.
  let visitCard = "";
  if (st.key === "live") {
    const s = ctx.stats;
    const enq = (cl.leadsLog || []).filter((l) => l && l.source === "website" && l.receivedAt && now - Date.parse(l.receivedAt) <= 30 * 864e5).length;
    if (!s) visitCard = `<div class="card"><div class="lbl">Visitors</div><div style="font-size:12px;color:#9CA3AF;line-height:1.6">Visitor numbers will show here soon.</div><div style="font-size:12px;color:#D1D5DB;margin-top:8px">Enquiries from your website in the last 30 days: <b style="color:#F5F3ED">${enq}</b></div></div>`;
    else {
      const tiles = [["Visitors", s.visitors], ["Page views", s.views], ["Enquiries", enq]]
        .map(([k, v]) => `<div class="stat"><div class="lbl">${k}</div><div style="font-size:20px;font-weight:800;color:#F5F3ED">${Number(v).toLocaleString("en-US")}</div></div>`).join("");
      const srcTotal = s.sources.reduce((a, r) => a + r.n, 0);
      const dev = s.devices || {}; const devTotal = (dev.mobile || 0) + (dev.tablet || 0) + (dev.desktop || 0);
      const devRows = [["Phone", dev.mobile || 0], ["Tablet", dev.tablet || 0], ["Computer", dev.desktop || 0]].filter(([, n]) => n).map(([k, n]) => ({ key: k, n }));
      visitCard = `<div class="card"><div class="lbl">Visitors, last 30 days</div><div style="display:flex;gap:8px;margin-bottom:12px">${tiles}</div>${dayBars(s.byDay)}<div style="display:flex;justify-content:space-between;font-size:10px;color:#6B7280;margin-top:4px"><span>${esc(date(s.byDay[0].day + "T12:00:00Z"))}</span><span>Today</span></div>${enq && s.visitors ? `<div style="font-size:12px;color:#9CA3AF;margin-top:10px">About ${Math.max(1, Math.round((enq / s.visitors) * 100))} in every 100 visitors sent you an enquiry.</div>` : ""}</div>`
        + (s.sources.length ? `<div class="card"><div class="lbl">Where visitors came from</div>${share(s.sources, srcTotal, (k) => ({ Search: "Google and other search", "Google Ads": "Your Google ads", Social: "Social media", Direct: "Typed it in, or a saved link", "Other sites": "Other websites" }[k] || k))}</div>` : "")
        + (s.pages.length ? `<div class="card"><div class="lbl">Most visited pages</div>${share(s.pages, s.views, pageName)}</div>` : "")
        + (devRows.length ? `<div class="card"><div class="lbl">What they used</div>${share(devRows, devTotal, (k) => k)}</div>` : "");
    }
  }

  // The blog: every article, coming up and published, with when it goes out. They can read and edit any
  // of them, or hold one back (Bryson, 2026-10-06: "a way to see when they go out and what is written
  // that way they can edit it if they want"). `ctx.posts` is the full list, held and scheduled included.
  const all = (ctx.posts || []).slice().sort((a, b) => Date.parse(b.publishAt) - Date.parse(a.publishAt)).slice(0, 24);
  const postRow = (p) => {
    const out = !p.held && Date.parse(p.publishAt) <= now;
    const when = p.held ? "On hold, not published" : out ? `Published ${date(p.publishAt)}` : `Goes out ${new Date(p.publishAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Phoenix" })}`;
    const view = out && siteUrl ? ` &middot; <a href="${esc(`${siteUrl}blog/${encodeURIComponent(p.slug)}/`)}" target="_blank" rel="noopener" style="color:#C8A84B">View it live</a>` : "";
    return `<div class="bl-post" data-slug="${esc(p.slug)}" style="padding:9px 0;border-top:1px solid rgba(255,255,255,.06)"><div style="font-size:13px;font-weight:700;color:#F5F3ED">${esc(p.title)}</div><div style="font-size:11px;color:${p.held ? "#F59E0B" : out ? "#10B981" : "#9CA3AF"};margin-top:2px">${esc(when)}${p.editedBy === "client" ? " &middot; edited by you" : ""}${view}</div><div style="display:flex;gap:8px;margin-top:7px"><button class="btn" style="margin-top:0;padding:8px;font-size:12px" onclick="blBlogOpen('${esc(p.slug)}',this)">Read and edit</button><button class="btn" style="margin-top:0;padding:8px;font-size:12px;background:transparent;border-color:rgba(255,255,255,.14);color:#9CA3AF" onclick="blBlogHold('${esc(p.slug)}',${p.held ? "false" : "true"},this)">${p.held ? "Release it" : "Hold it"}</button></div><div class="bl-edit"></div></div>`;
  };
  const blogCard = t.blog ? `<div class="card"><div class="lbl">Your blog &middot; about ${t.blogPosts} new articles a month</div><div style="font-size:11.5px;color:#9CA3AF;line-height:1.6;margin-bottom:4px">Each article goes out two days after it is written, and we email you when one is ready. Read it, change anything you like, or hold it back.</div>${all.length ? all.map(postRow).join("") : `<div style="font-size:12px;color:#9CA3AF;line-height:1.6;padding-top:6px">Your first articles start once your website is live.</div>`}<div style="font-size:11px;color:#6B7280;margin-top:8px;line-height:1.55">Have a topic in mind? Ask below.</div></div>` : "";

  // Ask for a change. The care plan includes a couple of small ones a month; counted so nobody is surprised.
  const monthKey = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Phoenix" }).slice(0, 7);
  const reqs = (cl.websiteRequests || []).filter((r) => r && r.text);
  const used = reqs.filter((r) => r.at && monthKey(Date.parse(r.at)) === monthKey(now)).length;
  const recent = reqs.slice(-4).reverse().map((r) => `<div style="padding:7px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:#D1D5DB;line-height:1.5"><span style="float:right;font-size:10.5px;color:${r.status === "done" ? "#10B981" : "#9CA3AF"}">${r.status === "done" ? "Done" : "Received " + esc(date(r.at))}</span>${esc(String(r.text).slice(0, 160))}</div>`).join("");
  const reqCard = `<div class="card" id="web-req-card"><div class="lbl">Ask for a change</div><div style="font-size:12px;color:#9CA3AF;line-height:1.6;margin-bottom:8px">New hours, a price, a photo, a sentence that's wrong: tell us and we'll do it.${t.care > 0 && st.key === "live" ? ` Your care plan includes ${CARE_EDITS_PER_MONTH} small changes a month (${Math.min(used, CARE_EDITS_PER_MONTH)} used this month). Bigger changes we'll quote first.` : ""}</div><textarea class="inp" id="web-req" rows="3" maxlength="1000" placeholder="What would you like changed?"></textarea><button class="btn" onclick="blWebReq(this)">Send request</button><div id="web-req-msg" style="font-size:11.5px;color:#9CA3AF;margin-top:8px"></div>${recent}</div>`;

  return `<div class="welcome"><b>Your website</b><span>Everything about your website in one place.</span></div>${statusCard}${visitCard}${payCard}${blogCard}${reqCard}`;
}

// The one bit of script the tab needs, for the change request. Posts to the portal like every other
// portal action; the portal preview (about:) already refuses every POST.
export const WEBSITE_PORTAL_JS = `function blPost(o){return fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)}).then(function(r){return r.json().then(function(d){if(!r.ok||!d||!d.ok)throw new Error((d&&d.error)||'That did not work. Please try again.');return d;});});}
function blEsc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
function blBlogOpen(slug,btn){var row=document.querySelector('.bl-post[data-slug="'+slug+'"]');var box=row&&row.querySelector('.bl-edit');if(!box)return;if(box.innerHTML){box.innerHTML='';btn.textContent='Read and edit';return;}btn.disabled=true;btn.textContent='Opening...';blPost({blogGet:{slug:slug}}).then(function(d){var p=d.post||{};var h='<div style="margin-top:10px"><div class="lbl">Title</div><input class="inp bl-t" value="'+blEsc(p.title)+'">';(p.blocks||[]).forEach(function(b){h+=b.kind==='h2'?'<div class="lbl">Heading</div><input class="inp bl-b" data-kind="h2" value="'+blEsc(b.text)+'">':'<textarea class="inp bl-b" data-kind="p" rows="5">'+blEsc(b.text)+'</textarea>';});h+='<button class="btn" onclick="blBlogSave(\\''+slug+'\\',this)">Save changes</button><div class="bl-msg" style="font-size:11.5px;margin-top:8px;color:#9CA3AF"></div></div>';box.innerHTML=h;btn.disabled=false;btn.textContent='Close';}).catch(function(e){btn.disabled=false;btn.textContent='Read and edit';alert(e.message);});}
function blBlogSave(slug,btn){var row=document.querySelector('.bl-post[data-slug="'+slug+'"]');var t=row.querySelector('.bl-t').value;var blocks=[];row.querySelectorAll('.bl-b').forEach(function(el){blocks.push({kind:el.getAttribute('data-kind'),text:el.value});});var msg=row.querySelector('.bl-msg');btn.disabled=true;btn.textContent='Saving...';blPost({blogEdit:{slug:slug,title:t,blocks:blocks}}).then(function(){btn.disabled=false;btn.textContent='Save changes';msg.style.color='#10B981';msg.textContent='Saved. Your changes are on the article now.';}).catch(function(e){btn.disabled=false;btn.textContent='Save changes';msg.style.color='#F59E0B';msg.textContent=e.message;});}
function blBlogHold(slug,held,btn){if(held&&!confirm('Hold this article? It will not go out until you release it.'))return;btn.disabled=true;blPost({blogHold:{slug:slug,held:held}}).then(function(){location.reload();}).catch(function(e){btn.disabled=false;alert(e.message);});}
function blWebReq(btn){var ta=document.getElementById('web-req'),msg=document.getElementById('web-req-msg');var t=(ta&&ta.value||'').trim();if(!t){if(msg)msg.textContent='Tell us what you would like changed first.';return;}btn.disabled=true;btn.textContent='Sending...';fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({websiteRequest:{text:t}})}).then(function(r){return r.json().then(function(d){if(!r.ok||!d||!d.ok)throw new Error((d&&d.error)||'');return d;});}).then(function(){ta.value='';btn.textContent='Sent';if(msg){msg.style.color='#10B981';msg.textContent='Got it. We will be in touch, usually within one business day.';}setTimeout(function(){btn.disabled=false;btn.textContent='Send request';},2500);}).catch(function(e){btn.disabled=false;btn.textContent='Send request';if(msg){msg.style.color='#F59E0B';msg.textContent=(e&&e.message)||'That did not send. Please try again.';}});}`;
