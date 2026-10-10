// The client portal's "How your customers pay you" card (KB `payments-connect`). Bryson, 2026-10-09: put it "in the
// client portal ... to be able to connect whatever method the client ... use[s] to collect payment".
//
// 🔴 NOT THE "PAYMENT METHOD" CARD. That one is the client paying BoldLine. This one is the client's OWN customers
// paying the client, so every line says "your customers" and "straight to you", and it sits with the website, not
// with billing.
// Shown to a business that has a website or takes bookings. The OS's preview of the portal can look at it but
// never press it: every button checks BL_PREVIEW first, and the preview blocks anything that sends.
import { payOf, PAY_NAMES } from "./payments.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function customerPayCardHTML(cl, ready = {}) {
  const P = payOf(cl);
  const opts = [
    ...(ready.stripe || P.connected === "stripe" ? [["stripe", "Stripe", "Customers pay by card when they book. It shows up on its own."]] : []),
    ...(ready.square || P.connected === "square" ? [["square", "Square", "Customers pay by card when they book. It shows up on its own."]] : []),
    ["link", "A payment link", "PayPal, Venmo, Cash App, Jobber or any payment page you already use."],
    ["inperson", "In person", "No online payment. You take payment at the job."],
  ];
  const sel = P.method || "";
  const tile = ([id, name, sub]) => `<button type="button" class="uopt cp-opt${sel === id ? " sel" : ""}" data-m="${id}" onclick="blPayPick('${id}')" style="width:100%;margin:0;text-align:left;font-family:inherit;color:inherit"><div style="font-size:14.5px;font-weight:700;color:#F5F3ED">${esc(name)}</div><div style="font-size:12.5px;color:#9CA3AF;line-height:1.5;margin-top:2px">${esc(sub)}</div></button>`;
  const conn = P.conn;
  const connected = (p) => conn && conn.provider === p
    ? `<div style="font-size:14px;font-weight:700;color:#10B981;margin:4px 0 6px">&#10003; Connected${conn.name ? `: ${esc(conn.name)}` : ""}</div><div style="font-size:12.5px;color:#9CA3AF;line-height:1.6">Customers who book are asked to pay, and it lands straight in your ${PAY_NAMES[p]} account. You can disconnect any time.</div>`
      + `<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8A90A2;margin:14px 0 6px">When they book, they pay</div>`
      + `<select class="inp" id="cp-charge"><option value="deposit"${P.charge !== "full" ? " selected" : ""}>The deposit set on each package</option><option value="full"${P.charge === "full" ? " selected" : ""}>The full price</option></select>`
      + `<div style="font-size:11.5px;color:#6B7280;line-height:1.55;margin:-2px 0 4px">The full price only works for packages with an exact price, like $199. Anything else, such as "From $150", is never charged online.</div>`
      + `<button class="btn" onclick="blPaySave('${p}',this)">Save</button><button class="btn ghost" onclick="blPayDisconnect(this)">Disconnect ${PAY_NAMES[p]}</button>`
    : `<div style="font-size:12.5px;color:#9CA3AF;line-height:1.6;margin:4px 0 2px">You'll log in to your own ${PAY_NAMES[p]} account and approve it. We never see your password, and we can't move your money.</div><button class="btn" onclick="blPayConnect('${p}',this)">Connect ${PAY_NAMES[p]}</button>`;
  const panel = (id, inner) => `<div class="cp-panel" data-p="${id}" style="max-width:620px${sel === id ? "" : ";display:none"}">${inner}</div>`;
  return `<div class="card" id="cust-pay"><div class="lbl" style="color:#C8A84B;font-size:12.5px">How Your Customers Pay You</div>`
    + `<div style="font-size:13px;color:#9CA3AF;line-height:1.65;margin-bottom:12px">When someone books on your website, how should they pay? The money always goes straight to you. We never touch it.</div>`
    // Four tiles: one column on a phone, two side by side once there is room.
    + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:8px;margin-bottom:10px">${opts.map(tile).join("")}</div>`
    + panel("stripe", connected("stripe"))
    + panel("square", connected("square"))
    + panel("link", `<input class="inp" id="cp-link" type="url" inputmode="url" placeholder="https://your payment page" value="${esc(P.link)}" onblur="blUrl(this)"><div style="font-size:11.5px;color:#6B7280;line-height:1.55;margin:-2px 0 4px">Customers see a Pay button with this link after they book. You mark each one paid yourself, because we can't see payments made there.</div><button class="btn" onclick="blPaySave('link',this)">Save</button>`)
    + panel("inperson", `<div style="font-size:12.5px;color:#9CA3AF;line-height:1.6;margin:4px 0 2px">Customers book without paying online.</div><button class="btn" onclick="blPaySave('inperson',this)">Save</button>`)
    + `<div id="cp-note" style="font-size:12px;color:#9CA3AF;margin-top:8px;line-height:1.5;min-height:1em"></div></div>`;
}

// Uses the portal's own TOKEN, BL_PREVIEW and blUrl.
export const CUSTOMER_PAY_JS = `function blPayNote(t,c){var n=document.getElementById('cp-note');if(n){n.style.color=c||'#9CA3AF';n.textContent=t;}}
function blPayPick(m){var o=document.querySelectorAll('.cp-opt');for(var i=0;i<o.length;i++)o[i].classList.toggle('sel',o[i].getAttribute('data-m')===m);var p=document.querySelectorAll('.cp-panel');for(var j=0;j<p.length;j++)p[j].style.display=p[j].getAttribute('data-p')===m?'block':'none';blPayNote('');}
function blPayPost(body){return fetch('/.netlify/functions/pay-connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({token:TOKEN},body))}).then(function(r){return r.json();});}
function blPayConnect(p,btn){if(BL_PREVIEW){blPayNote('Preview only. Nothing was connected.');return;}var o=btn.textContent;btn.disabled=true;btn.textContent='Opening '+(p==='stripe'?'Stripe':'Square')+'...';blPayPost({action:'start',provider:p}).then(function(d){if(!d||!d.ok||!d.url){btn.disabled=false;btn.textContent=o;blPayNote((d&&d.error)||'That did not open. Please try again in a minute.','#F59E0B');return;}window.location.href=d.url;}).catch(function(){btn.disabled=false;btn.textContent=o;blPayNote('That did not open. Check your connection and try again.','#F59E0B');});}
function blPaySave(m,btn){if(BL_PREVIEW){blPayNote('Preview only. Nothing was saved.');return;}var l=document.getElementById('cp-link'),c=document.getElementById('cp-charge');var o=btn.textContent;btn.disabled=true;btn.textContent='Saving...';blPayPost({action:'save',method:m,link:l?l.value:'',charge:c?c.value:''}).then(function(d){btn.disabled=false;btn.textContent=o;if(!d||!d.ok){blPayNote((d&&d.error)||'That did not save. Please try again.','#F59E0B');return;}blPayNote('Saved.','#10B981');}).catch(function(){btn.disabled=false;btn.textContent=o;blPayNote('That did not save. Check your connection and try again.','#F59E0B');});}
function blPayDisconnect(btn){if(BL_PREVIEW){blPayNote('Preview only. Nothing was changed.');return;}if(!confirm('Disconnect? Customers will stop being asked to pay when they book.'))return;btn.disabled=true;blPayPost({action:'disconnect'}).then(function(d){if(!d||!d.ok){btn.disabled=false;blPayNote((d&&d.error)||'That did not go through. Please try again.','#F59E0B');return;}location.reload();}).catch(function(){btn.disabled=false;blPayNote('That did not go through. Check your connection and try again.','#F59E0B');});}`;
