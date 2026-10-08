// The booking steps a customer sees, shared by the website's Book page (site-render.mjs) and a landing page
// that takes bookings (landing.mjs), so the two can never work differently (KB `website-booking-intake`).
// 1 pick a package, 2 pick a day and an open time, 3 where and who, then booked (and the deposit button
// when the package has one). Colours come in through --bk-* custom properties set by each page.
//
// 🔴 A preview never books: an about: document (every OS preview iframe) or any ?preview= link shows the
// finished state without sending anything. The shipped script carries no comments (it is delivered to the
// client's own domain) and only ever uses the relative /book path.
import { bookingConfig } from "./booking.mjs";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const durLabel = (m) => { const h = Math.floor(m / 60), r = m % 60; return h ? `${h} hr${r ? ` ${r} min` : ""}` : `${r} min`; };

export function bookingWidgetHTML(cl, { btnClass = "btn", headClass = "bk-h" } = {}) {
  const cfg = bookingConfig(cl);
  const pk = (p) => [p.price, durLabel(p.minutes), p.deposit ? `${p.deposit} deposit` : ""].filter(Boolean).join(" · ");
  return `<div class="bk" id="bk">
<div class="bk-step" id="bkp"><h2 class="${headClass}"><span>1</span>Pick a package</h2><div class="bk-pk">${cfg.packages.map((p) =>
    `<button type="button" class="bk-p" data-id="${esc(p.id)}" data-name="${esc(p.name)}"><b>${esc(p.name)}</b><span>${esc(pk(p))}</span>${p.desc ? `<em>${esc(p.desc)}</em>` : ""}</button>`).join("")}</div></div>
<div class="bk-step" id="bkd" hidden><h2 class="${headClass}"><span>2</span>Pick a day and time</h2><div class="bk-days" id="bkdays"></div><div class="bk-times" id="bktimes"></div><p class="bk-msg" id="bkdm"></p></div>
<div class="bk-step" id="bkf" hidden><h2 class="${headClass}"><span>3</span>${cfg.askAddress ? "Where and who" : "Your details"}</h2><div class="bk-sum" id="bksum"></div>
<form id="bkform" class="bk-form" novalidate>
${cfg.askAddress ? `<label class="bk-lb">${esc(cfg.addressLabel)}<input class="bk-in" name="ad" autocomplete="street-address" required></label>
` : ""}<label class="bk-lb">Your name<input class="bk-in" name="nm" autocomplete="name" required></label>
<label class="bk-lb">Phone<input class="bk-in" id="bk-phone" name="ph" type="tel" autocomplete="tel" inputmode="tel"></label>
<label class="bk-lb">Email<input class="bk-in" name="em" type="email" autocomplete="email"></label>
<label class="bk-lb">Anything we should know? (optional)<textarea class="bk-in" name="no" rows="3"></textarea></label>
<p class="bk-err" role="alert"></p><button class="${btnClass}" type="submit">Book it</button></form></div>
<div class="bk-ok" id="bkok"><h3>You're booked.</h3><p id="bkokt"></p><div id="bkdep"></div></div>
</div>`;
}

export const BOOKING_WIDGET_CSS = `.bk,.bk-step{min-width:0}
.bk-step{margin-bottom:30px}.bk-step[hidden]{display:none}.bk-step,.bk-ok{scroll-margin-top:96px}
.bk-h{font-size:clamp(20px,2.4vw,28px);font-weight:700;display:flex;align-items:center;gap:12px;margin:0 0 14px;color:var(--bk-ink)}
.bk-h span{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--bk-ac);color:var(--bk-on);font-size:14px;flex:0 0 auto;font-weight:700}
.bk-pk{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.bk-p{text-align:left;font:inherit;color:var(--bk-ink);background:var(--bk-card);border:1px solid var(--bk-line);border-radius:var(--bk-r);padding:16px;cursor:pointer;display:grid;gap:5px;transition:border-color .2s,box-shadow .2s}
.bk-p b{font-size:17px}.bk-p span{color:var(--bk-ac);font-weight:600;font-size:14.5px}.bk-p em{font-style:normal;color:var(--bk-mute);font-size:14px;line-height:1.5}
.bk-p:hover{border-color:var(--bk-ink)}.bk-p.on{border-color:var(--bk-ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--bk-ac) 25%,transparent)}
.bk-days{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px}
.bk-d{flex:0 0 auto;min-width:92px;font:inherit;font-size:14px;font-weight:600;color:var(--bk-ink);background:var(--bk-card);border:1px solid var(--bk-line);border-radius:calc(var(--bk-r) * .6);padding:10px 12px;cursor:pointer}
.bk-d[disabled]{opacity:.35;cursor:default}.bk-d.on{background:var(--bk-ac);color:var(--bk-on);border-color:var(--bk-ac)}
.bk-times{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:12px}
.bk-t{font:inherit;font-size:15px;font-weight:600;color:var(--bk-ink);background:var(--bk-bg2);border:1px solid var(--bk-line);border-radius:calc(var(--bk-r) * .5);min-height:48px;cursor:pointer}
.bk-t.on{background:var(--bk-ac);color:var(--bk-on);border-color:var(--bk-ac)}
.bk-msg{color:var(--bk-mute);font-size:15px;margin-top:10px}
.bk-sum{padding:13px 15px;border-radius:calc(var(--bk-r) * .6);background:var(--bk-bg2);border:1px solid var(--bk-line);margin-bottom:12px;font-size:15px;color:var(--bk-ink)}
.bk-form{display:grid;gap:12px}
.bk-lb{display:grid;gap:6px;font-size:13px;font-weight:600;color:var(--bk-mute)}
.bk-in{font:inherit;font-size:16px;color:var(--bk-ink);background:var(--bk-bg2);border:1px solid var(--bk-line);border-radius:calc(var(--bk-r) * .5);padding:13px 14px;min-height:50px;width:100%;box-sizing:border-box}
.bk-in:focus{outline:0;border-color:var(--bk-ac);box-shadow:0 0 0 4px color-mix(in srgb,var(--bk-ac) 18%,transparent)}
.bk-err{display:none;color:#E5484D;font-size:14px}
.bk-ok{display:none;padding:26px;border:1px solid var(--bk-line);border-radius:var(--bk-r);background:var(--bk-card);color:var(--bk-ink)}
.bk-ok h3{font-size:28px;margin:0}.bk-ok p{color:var(--bk-mute);margin-top:8px}
.bk-dep{display:inline-flex;align-items:center;justify-content:center;margin-top:14px;padding:13px 22px;border-radius:999px;background:var(--bk-ac);color:var(--bk-on);font-weight:700;text-decoration:none}`;

export function bookingWidgetJS(cl) {
  const token = encodeURIComponent((cl && cl.leadToken) || "");
  return `(function(){var d=document,bk=d.getElementById('bk');if(!bk)return;
var BKP=String(location.href).indexOf('about:')===0||/[?&]preview=/.test(location.search),BS={},bf=d.getElementById('bkform');
function bq(s){return [].slice.call(bk.querySelectorAll(s));}
function bshow(id){d.getElementById(id).hidden=false;}
function bmsg(t){d.getElementById('bkdm').textContent=t||'';}
function bgo(id){try{d.getElementById(id).scrollIntoView({behavior:'smooth',block:'start'});}catch(e){}}
function bdays(){var dl=d.getElementById('bkdays'),tl=d.getElementById('bktimes');dl.innerHTML='';tl.innerHTML='';bmsg('Finding open times...');
fetch('/book?token=${token}&pkg='+encodeURIComponent(BS.pkg)).then(function(r){return r.json();}).then(function(j){if(!j||!j.ok){bmsg((j&&j.error)||'Online booking is down for a moment. Please call us.');return;}
var days=j.days||[],first=null;bmsg(days.some(function(x){return x.slots.length;})?'':'No open times in the next few weeks. Please call us and we will find one.');
days.forEach(function(x){var b=d.createElement('button');b.type='button';b.className='bk-d';b.textContent=x.label;if(!x.slots.length)b.disabled=true;else if(!first)first=b;
b.onclick=function(){bq('.bk-d').forEach(function(y){y.classList.toggle('on',y===b);});btimes(x);};dl.appendChild(b);});if(first)first.click();})
.catch(function(){bmsg('Online booking is down for a moment. Please call us.');});}
function btimes(x){var tl=d.getElementById('bktimes');tl.innerHTML='';x.slots.forEach(function(s){var b=d.createElement('button');b.type='button';b.className='bk-t';b.textContent=s.label;
b.onclick=function(){bq('.bk-t').forEach(function(y){y.classList.toggle('on',y===b);});BS.start=s.start;BS.when=x.label+' at '+s.label;
d.getElementById('bksum').textContent=BS.name+', '+BS.when;bshow('bkf');bgo('bkf');};tl.appendChild(b);});}
bq('.bk-p').forEach(function(p){p.onclick=function(){bq('.bk-p').forEach(function(y){y.classList.toggle('on',y===p);});BS.pkg=p.getAttribute('data-id');BS.name=p.getAttribute('data-name');BS.start=null;
d.getElementById('bkf').hidden=true;bshow('bkd');bdays();bgo('bkd');};});
function bdone(t,dep){['bkp','bkd','bkf'].forEach(function(id){d.getElementById(id).hidden=true;});d.getElementById('bkokt').textContent=t;
var dp=d.getElementById('bkdep');dp.innerHTML='';if(dep&&dep.link&&/^https:/.test(dep.link)){var n=d.createElement('p');n.textContent='Your time is held. Pay the '+(dep.amount?dep.amount+' ':'')+'deposit to lock it in.';var a=d.createElement('a');a.className='bk-dep';a.href=dep.link;a.target='_blank';a.rel='noopener';a.textContent='Pay the deposit';dp.appendChild(n);dp.appendChild(a);}
d.getElementById('bkok').style.display='block';bgo('bkok');}
bf.addEventListener('submit',function(e){e.preventDefault();var er=bf.querySelector('.bk-err'),b=bf.querySelector('button'),ph=bf.ph.value.trim(),em=bf.em.value.trim();
function bad(t){er.textContent=t;er.style.display='block';}
if(!BS.start)return bad('Please pick a time first.');if(bf.ad&&!bf.ad.value.trim())return bad('Please add the address.');
if(!bf.nm.value.trim())return bad('Please add your name.');if(!ph&&!em)return bad('Please add a phone number or an email so we can confirm.');
er.style.display='none';if(BKP){bdone('Preview only. Nothing was booked.');return;}
var lbl=b.textContent;b.disabled=true;b.textContent='Booking...';
var p={packageId:BS.pkg,start:BS.start,address:bf.ad?bf.ad.value:'',name:bf.nm.value,phone:ph,email:em,notes:bf.no.value};try{p.page=location.href.split('#')[0];}catch(x){}
fetch('/book?token=${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}).then(function(r){return r.json().then(function(j){return {s:r.status,j:j};});})
.then(function(o){if(o.j&&o.j.ok){bdone(BS.name+', '+o.j.when+'. '+(em?'A confirmation is on its way to your email.':'We will be in touch to confirm.'),o.j.deposit);return;}
b.disabled=false;b.textContent=lbl;bad((o.j&&o.j.error)||'Something went wrong. Please try again or call us.');if(o.s===409){d.getElementById('bkf').hidden=true;bdays();}})
.catch(function(){b.disabled=false;b.textContent=lbl;bad('Something went wrong. Please try again or call us.');});});})();`;
}
