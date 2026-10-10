// The client portal's "How your customers pay you" card (KB `payments-connect`). Bryson, 2026-10-09: put it "in the
// client portal ... to be able to connect whatever method the client ... use[s] to collect payment".
//
// 🔴 NOT THE "PAYMENT METHOD" CARD. That one is the client paying BoldLine. This one is the client's OWN customers
// paying the client, so every line says "your customers" and "straight to you", and it sits with the website, not
// with billing.
// SEVERAL WAYS AT ONCE (Bryson, 2026-10-09: "make sure for payments there is the option to choose multiple ways"):
// a card through its own Stripe or Square, up to three payment links, and in person, each a tick box. The customer
// then picks on the pay page. One card account at a time, because two would only give the customer two card
// buttons that do the same thing.
// Shown to a business that has a website or takes bookings. The OS's preview of the portal can look at it but
// never press it: every button checks BL_PREVIEW first, and the preview blocks anything that sends.
import { payOf, PAY_NAMES, MAX_LINKS } from "./payments.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const small = (t) => `<div style="font-size:12.5px;color:#9CA3AF;line-height:1.6;margin:2px 0 4px">${t}</div>`;

export const linkRowHTML = (l = {}) => `<div class="cp-row" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px"><input class="inp cp-ll" placeholder="Name, like Venmo" maxlength="30" value="${esc(l.label || "")}"><input class="inp cp-lu" type="url" inputmode="url" placeholder="https://your payment page" value="${esc(l.url || "")}" onblur="blUrl(this)"></div>`;

export function customerPayCardHTML(cl, ready = {}) {
  const P = payOf(cl), conn = P.conn;
  const cardOn = (id) => P.card === id;
  const tile = (id, name, sub, on) => `<label class="uopt cp-opt${on ? " sel" : ""}" data-m="${id}" style="display:flex;gap:12px;align-items:flex-start;margin:0;cursor:pointer"><input type="checkbox" class="cp-cb" data-m="${id}"${on ? " checked" : ""} onchange="blPayToggle(this)" style="width:20px;height:20px;margin:2px 0 0;flex-shrink:0;accent-color:#C8A84B"><span style="min-width:0"><span style="display:block;font-size:14.5px;font-weight:700;color:#F5F3ED">${esc(name)}</span><span style="display:block;font-size:12.5px;color:#9CA3AF;line-height:1.5;margin-top:2px">${esc(sub)}</span></span></label>`;
  const panel = (id, on, inner) => `<div class="cp-panel" data-p="${id}" style="padding:10px 2px 0${on ? "" : ";display:none"}">${inner}</div>`;
  const cardPanel = (p) => conn && conn.provider === p
    ? `<div style="font-size:14px;font-weight:700;color:#10B981;margin:0 0 4px">&#10003; Connected${conn.name ? `: ${esc(conn.name)}` : ""}</div>${small(`Card payments land straight in your ${PAY_NAMES[p]} account and mark themselves paid.`)}<button class="btn ghost" style="margin-top:6px" onclick="blPayDisconnect(this)">Disconnect ${PAY_NAMES[p]}</button>`
    : `${small(`You'll log in to your own ${PAY_NAMES[p]} account and approve it. We never see your password, and we can't move your money.`)}<button class="btn" style="margin-top:6px" onclick="blPayConnect('${p}',this)">Connect ${PAY_NAMES[p]}</button>`;
  const block = (id, name, sub, on, inner) => `<div class="cp-block">${tile(id, name, sub, on)}${panel(id, on, inner)}</div>`;
  const cards = ["stripe", "square"].filter((id) => ready[id] || cardOn(id) || (conn && conn.provider === id));
  const links = P.links.length ? P.links : [{}];
  return `<div class="card" id="cust-pay"><div class="lbl" style="color:#C8A84B;font-size:12.5px">How Your Customers Pay You</div>`
    + `<div style="font-size:13px;color:#9CA3AF;line-height:1.65;margin-bottom:12px">Tick every way you take payment. When someone books, they pick the one they want. The money always goes straight to you. We never touch it.</div>`
    // One column on a phone, two side by side once there is room.
    + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:10px;align-items:start;margin-bottom:12px">`
    + cards.map((id) => block(id, `Card, through ${PAY_NAMES[id]}`, "Customers pay by card when they book. It marks itself paid.", cardOn(id), cardPanel(id))).join("")
    + block("links", "Payment links", "PayPal, Venmo, Cash App, Jobber or any payment page you already use. Up to three.", P.links.length > 0,
      `<div id="cp-links" style="display:grid;gap:0">${links.map(linkRowHTML).join("")}</div><button type="button" class="btn ghost" id="cp-add" style="margin-top:2px${links.length >= MAX_LINKS ? ";display:none" : ""}" onclick="blPayAddLink()">Add another link</button>${small("You mark these paid yourself, because we can't see payments made there.")}`)
    + block("inperson", "In person", "You also take payment at the job.", P.inperson, small("Customers are told they can pay when you see them."))
    + `</div>`
    + `<div style="max-width:620px"><div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8A90A2;margin:4px 0 6px">When they book, ask them to pay</div>`
    + `<select class="inp" id="cp-charge"><option value="deposit"${P.charge !== "full" ? " selected" : ""}>The deposit set on each package</option><option value="full"${P.charge === "full" ? " selected" : ""}>The full price</option></select>`
    + `<div style="font-size:11.5px;color:#6B7280;line-height:1.55;margin:-2px 0 4px">The full price only works for packages with an exact price, like $199. Anything else, such as "From $150", is never asked for online.</div>`
    + `<button class="btn" onclick="blPaySave(this)">Save</button></div>`
    + `<div id="cp-note" style="font-size:12px;color:#9CA3AF;margin-top:8px;line-height:1.5;min-height:1em"></div></div>`;
}

// Uses the portal's own TOKEN, BL_PREVIEW and blUrl.
export const CUSTOMER_PAY_JS = `function blPayNote(t,c){var n=document.getElementById('cp-note');if(n){n.style.color=c||'#9CA3AF';n.textContent=t;}}
function blPaySet(m,on){var cb=document.querySelector('.cp-cb[data-m="'+m+'"]');if(!cb)return;cb.checked=on;var l=cb.closest('.cp-opt');if(l)l.classList.toggle('sel',on);var p=document.querySelector('.cp-panel[data-p="'+m+'"]');if(p)p.style.display=on?'block':'none';}
function blPayToggle(cb){var m=cb.getAttribute('data-m');blPaySet(m,cb.checked);blPayNote('');if(cb.checked&&(m==='stripe'||m==='square')){var o=m==='stripe'?'square':'stripe';if(document.querySelector('.cp-cb[data-m="'+o+'"]:checked')){blPaySet(o,false);blPayNote('One card account at a time, so the other one was unticked.');}}}
function blPayAddLink(){var w=document.getElementById('cp-links');if(!w)return;var rows=w.querySelectorAll('.cp-row');if(rows.length>=${MAX_LINKS})return;var c=rows[0].cloneNode(true);var ins=c.querySelectorAll('input');for(var i=0;i<ins.length;i++)ins[i].value='';w.appendChild(c);if(rows.length+1>=${MAX_LINKS}){var b=document.getElementById('cp-add');if(b)b.style.display='none';}}
function blPayCollect(){var on=function(m){var cb=document.querySelector('.cp-cb[data-m="'+m+'"]');return !!(cb&&cb.checked);};var card=on('stripe')?'stripe':on('square')?'square':'';var links=[];if(on('links')){var rows=document.querySelectorAll('#cp-links .cp-row');for(var i=0;i<rows.length;i++){var u=rows[i].querySelector('.cp-lu').value.trim();if(u)links.push({label:rows[i].querySelector('.cp-ll').value.trim(),url:u});}}var c=document.getElementById('cp-charge');return {card:card,links:links,inperson:on('inperson'),charge:c?c.value:'deposit'};}
function blPayPost(body){return fetch('/.netlify/functions/pay-connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({token:TOKEN},body))}).then(function(r){return r.json();});}
function blPaySave(btn){if(BL_PREVIEW){blPayNote('Preview only. Nothing was saved.');return;}var o=btn.textContent;btn.disabled=true;btn.textContent='Saving...';blPayPost(Object.assign({action:'save'},blPayCollect())).then(function(d){btn.disabled=false;btn.textContent=o;if(!d||!d.ok){blPayNote((d&&d.error)||'That did not save. Please try again.','#F59E0B');return;}blPayNote('Saved.','#10B981');}).catch(function(){btn.disabled=false;btn.textContent=o;blPayNote('That did not save. Check your connection and try again.','#F59E0B');});}
function blPayConnect(p,btn){if(BL_PREVIEW){blPayNote('Preview only. Nothing was connected.');return;}var o=btn.textContent;btn.disabled=true;btn.textContent='Opening '+(p==='stripe'?'Stripe':'Square')+'...';var body=blPayCollect();body.card=p;blPayPost(Object.assign({action:'save'},body)).then(function(){return blPayPost({action:'start',provider:p});}).then(function(d){if(!d||!d.ok||!d.url){btn.disabled=false;btn.textContent=o;blPayNote((d&&d.error)||'That did not open. Please try again in a minute.','#F59E0B');return;}window.location.href=d.url;}).catch(function(){btn.disabled=false;btn.textContent=o;blPayNote('That did not open. Check your connection and try again.','#F59E0B');});}
function blPayDisconnect(btn){if(BL_PREVIEW){blPayNote('Preview only. Nothing was changed.');return;}if(!confirm('Disconnect? Customers will stop being able to pay by card when they book. Your other ways stay on.'))return;btn.disabled=true;blPayPost({action:'disconnect'}).then(function(d){if(!d||!d.ok){btn.disabled=false;blPayNote((d&&d.error)||'That did not go through. Please try again.','#F59E0B');return;}location.reload();}).catch(function(){btn.disabled=false;blPayNote('That did not go through. Check your connection and try again.','#F59E0B');});}`;
