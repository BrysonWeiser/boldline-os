// The partner's page for one of Bryson's own businesses (Bryson, 2026-10-07: "can you make those two
// ideas", after "a view for your buddy so he can see new leads"). Bryson runs the website and the ads
// for the car detailing business; his friend does the work. This is a private link the friend keeps on
// his phone: every lead, newest first, with Call and Text buttons, and Contacted / Won / Lost so the
// OS and the partner always see the same status. Leads only: no ad accounts, no money, no notes.
//
// 🔴 It is a real page that changes real data, so the OS never embeds it as a preview (KB
// `preview-safety`). The OS shows the link and opens it in a new tab, which is the real thing.
import { isOwned } from "./owned.mjs";
import { brandColorOf } from "./site-render.mjs";

export const TEAM_STATUSES = ["new", "contacted", "won", "lost"];
export const TEAM_MAX_LEADS = 200;
const STATUS_LABEL = { new: "New", contacted: "Contacted", won: "Won", lost: "Lost" };

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
// In a <script> block a lead's own words must never be able to close the tag.
const jsonForScript = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export const teamOn = (cl) => !!(isOwned(cl) && cl.team && cl.team.on && cl.team.token);
export const teamUrl = (base, token) => `${String(base || "").replace(/\/$/, "")}/team?t=${encodeURIComponent(token)}`;

// The identity a status change points at. New leads carry a leadId (lead-intake); older ones are
// told apart by the moment they arrived, which is what every other writer already matches on.
export const leadKey = (l) => String((l && (l.leadId || l.receivedAt)) || "");

export const teamLeads = (cl) => ((cl && cl.leadsLog) || [])
  .filter((l) => l && (l.receivedAt || l.leadId))
  .slice()
  .sort((a, b) => String(b.receivedAt || "").localeCompare(String(a.receivedAt || "")))
  .slice(0, TEAM_MAX_LEADS)
  .map((l) => ({
    key: leadKey(l), name: String(l.name || "").slice(0, 120), phone: String(l.phone || "").slice(0, 40),
    email: String(l.email || "").slice(0, 160), message: String(l.message || "").slice(0, 600),
    source: String(l.source || "").slice(0, 40), at: l.receivedAt || "",
    status: TEAM_STATUSES.includes(l.status) ? l.status : "new",
  }));

// Returns the record with one lead's status changed, or null when nothing should be written.
export function applyTeamStatus(data, key, status) {
  if (!TEAM_STATUSES.includes(status) || !key) return null;
  const log = ((data && data.leadsLog) || []).slice();
  const i = log.findIndex((l) => l && leadKey(l) === String(key));
  if (i < 0) return null;
  if ((log[i].status || "new") === status) return data;
  log[i] = { ...log[i], status, statusBy: "partner", statusAt: new Date().toISOString() };
  return { ...data, leadsLog: log };
}

export function renderTeamPage(cl, { token }) {
  const accent = brandColorOf(cl) || "#1F2937";
  const name = esc(cl.name || "Your business");
  const boot = { token, statuses: TEAM_STATUSES, labels: STATUS_LABEL, leads: teamLeads(cl) };
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#ffffff">
<title>${name}: leads</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#F4F5F7;color:#111827;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%}
.top{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #E5E7EB;padding:14px 16px 12px;padding-top:max(14px,env(safe-area-inset-top))}
.top .row{display:flex;align-items:center;gap:10px;max-width:760px;margin:0 auto}
.biz{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${accent}}
h1{margin:2px 0 0;font-size:22px;line-height:1.15;letter-spacing:-.01em}
.grow{flex:1;min-width:0}.ref{border:1px solid #D1D5DB;background:#fff;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px;font-weight:600;color:#374151}
.wrap{max-width:760px;margin:0 auto;padding:14px 16px 40px}
.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}
.sum div{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:10px 12px}.sum b{display:block;font-size:22px;line-height:1.1}.sum span{font-size:12px;color:#6B7280}
.tabs{display:flex;gap:8px;margin-bottom:12px}.tab{flex:1;border:1px solid #D1D5DB;background:#fff;border-radius:999px;padding:9px 10px;font-family:inherit;font-size:13px;font-weight:700;color:#374151}
.tab.on{background:${accent};border-color:${accent};color:#fff}
.lead{background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:14px;margin-bottom:10px}
.lead.new{border-left:4px solid ${accent}}
.lh{display:flex;align-items:flex-start;gap:10px}.ln{font-size:17px;font-weight:700;line-height:1.25}.lt{font-size:12.5px;color:#6B7280}
.pill{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:#F3F4F6;color:#374151;white-space:nowrap}
.pill.new{background:${accent};color:#fff}.pill.won{background:#DCFCE7;color:#166534}.pill.lost{background:#F3F4F6;color:#9CA3AF}
.msg{margin:9px 0 0;color:#374151;white-space:pre-wrap;word-wrap:break-word}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.btn{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:11px;font-weight:700;font-size:15px;text-decoration:none;border:1px solid #D1D5DB;color:#111827;background:#fff}
.btn.p{background:${accent};border-color:${accent};color:#fff}
.st{display:flex;gap:6px;margin-top:10px}.st button{flex:1;min-height:40px;border-radius:10px;border:1px solid #D1D5DB;background:#fff;font-family:inherit;font-size:13px;font-weight:600;color:#374151}
.st button.on{background:#111827;border-color:#111827;color:#fff}
.mail{display:block;margin-top:8px;font-size:13.5px;color:${accent};word-break:break-all}
.empty{text-align:center;color:#6B7280;padding:40px 10px}
.note{font-size:12px;color:#9CA3AF;text-align:center;margin-top:18px}
</style></head><body>
<div class="top"><div class="row"><div class="grow"><div class="biz">${name}</div><h1>Leads</h1></div><button class="ref" id="ref" type="button">Refresh</button></div></div>
<div class="wrap">
  <div class="sum"><div><b id="sNew">0</b><span>waiting for a call</span></div><div><b id="sWeek">0</b><span>this week</span></div><div><b id="sWon">0</b><span>won this month</span></div></div>
  <div class="tabs"><button class="tab on" data-f="new" type="button">Waiting</button><button class="tab" data-f="all" type="button">All leads</button></div>
  <div id="list"></div>
  <div class="note" id="note">Updates on its own every minute.</div>
</div>
<script>
(function(){
  var B=${jsonForScript(boot)}, F="new", L=B.leads, list=document.getElementById("list");
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
  function ago(iso){var t=Date.parse(iso);if(!t)return "";var m=Math.round((Date.now()-t)/60000);if(m<1)return "just now";if(m<60)return m+" min ago";var h=Math.round(m/60);if(h<24)return h+" hr ago";
    return new Date(t).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"America/Phoenix"})+" at "+new Date(t).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/Phoenix"});}
  function digits(p){return String(p||"").replace(/[^0-9+]/g,"");}
  function phxKey(t){return new Date(t).toLocaleDateString("en-CA",{timeZone:"America/Phoenix"});}
  function sums(){var now=Date.now(),wk=0,won=0,nw=0,mo=phxKey(now).slice(0,7);
    L.forEach(function(l){var t=Date.parse(l.at)||0;if(l.status==="new")nw++;if(now-t<=7*864e5)wk++;if(l.status==="won"&&phxKey(t||now).slice(0,7)===mo)won++;});
    document.getElementById("sNew").textContent=nw;document.getElementById("sWeek").textContent=wk;document.getElementById("sWon").textContent=won;}
  function card(l){var c=el("div","lead"+(l.status==="new"?" new":""));var h=el("div","lh");var g=el("div");g.style.flex="1";g.style.minWidth="0";
    g.appendChild(el("div","ln",l.name||"No name given"));g.appendChild(el("div","lt",ago(l.at)+(l.source?" \\u00b7 "+l.source.replace(/_/g," "):"")));h.appendChild(g);
    h.appendChild(el("span","pill "+l.status,B.labels[l.status]||l.status));c.appendChild(h);
    if(l.message)c.appendChild(el("p","msg",l.message));
    var d=digits(l.phone);if(d){var a=el("div","acts");var call=el("a","btn p","Call");call.href="tel:"+d;var tx=el("a","btn","Text");tx.href="sms:"+d;a.appendChild(call);a.appendChild(tx);c.appendChild(a);}
    if(l.email){var m=el("a","mail",l.email);m.href="mailto:"+l.email;c.appendChild(m);}
    var st=el("div","st");["contacted","won","lost"].forEach(function(s){var b=el("button",l.status===s?"on":"",B.labels[s]);b.type="button";b.onclick=function(){setStatus(l,l.status===s?"new":s,b);};st.appendChild(b);});c.appendChild(st);return c;}
  function draw(){list.innerHTML="";var rows=L.filter(function(l){return F==="all"||l.status==="new";});
    if(!rows.length){list.appendChild(el("div","empty",F==="new"?"Nobody is waiting for a call. New leads show up here the moment they come in.":"No leads yet. They show up here the moment someone gets in touch."));}
    rows.forEach(function(l){list.appendChild(card(l));});sums();}
  function post(body){return fetch(location.pathname+"?t="+encodeURIComponent(B.token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json();});}
  function setStatus(l,s,btn){btn.disabled=true;post({action:"status",key:l.key,status:s}).then(function(d){if(d&&d.ok&&d.leads){L=d.leads;draw();}else{btn.disabled=false;alert("That did not save. Check your signal and try again.");}}).catch(function(){btn.disabled=false;alert("That did not save. Check your signal and try again.");});}
  function refresh(){post({action:"list"}).then(function(d){if(d&&d.ok&&d.leads){L=d.leads;draw();}}).catch(function(){});}
  document.getElementById("ref").onclick=refresh;
  Array.prototype.forEach.call(document.querySelectorAll(".tab"),function(t){t.onclick=function(){F=t.getAttribute("data-f");Array.prototype.forEach.call(document.querySelectorAll(".tab"),function(x){x.className="tab"+(x===t?" on":"");});draw();};});
  setInterval(function(){if(!document.hidden)refresh();},60000);
  draw();
})();
</script>
</body></html>`;
}

export const teamOffPage = () => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Link turned off</title>
<style>body{margin:0;background:#F4F5F7;color:#111827;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}div{max-width:420px;text-align:center}h1{font-size:21px;margin:0 0 8px}p{margin:0;color:#6B7280}</style></head>
<body><div><h1>This link is turned off</h1><p>Ask for a new link to see the leads again.</p></div></body></html>`;

// An email to the partner the moment a lead lands, sent as the business, with replies going straight
// to the customer, and a button to the full list. No emojis and no dashes: it is the business's mail.
export function teamLeadEmail(cl, lead, url) {
  const accent = brandColorOf(cl) || "#1F2937";
  const rows = [["Name", lead.name], ["Phone", lead.phone], ["Email", lead.email], ["Message", lead.message]].filter(([, v]) => v);
  const body = rows.map(([k, v]) => `<tr><td style="padding:0 0 12px"><div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6B7280">${esc(k)}</div><div style="font-size:15px;color:#111827;white-space:pre-wrap">${esc(v)}</div></td></tr>`).join("")
    || `<tr><td style="padding:0 0 12px;font-size:14px;color:#6B7280">They did not leave any details beyond the form itself.</td></tr>`;
  const phone = String(lead.phone || "").replace(/[^0-9+]/g, "");
  const btn = (href, label) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:10px;background:${accent};background-image:linear-gradient(${accent},${accent});color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${esc(label)}</a>`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border:1px solid #E5E7EB;border-top:4px solid ${accent};border-radius:14px">
<tr><td style="padding:22px 22px 6px"><div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${accent}">${esc(cl.name || "")}</div>
<div style="font-size:21px;font-weight:700;color:#111827;margin-top:2px">New lead</div></td></tr>
<tr><td style="padding:12px 22px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr>
<tr><td style="padding:4px 22px 22px">${phone ? btn("tel:" + phone, "Call them") : ""}${url ? btn(url, "See all leads") : ""}</td></tr>
</table>
<div style="font-size:12px;color:#9CA3AF;margin-top:12px">Reply to this email to answer them directly.</div>
</td></tr></table></body></html>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + (url ? `\n\nAll leads: ${url}` : "");
  return { subject: `New lead${lead.name ? ": " + String(lead.name).slice(0, 60) : ""}`, html, text };
}

export async function notifyTeamOfLead(cl, lead, { send, base }) {
  if (!teamOn(cl) || !cl.team.email || typeof send !== "function") return { sent: false };
  const mail = teamLeadEmail(cl, lead, teamUrl(base, cl.team.token));
  try {
    await send({ to: cl.team.email, subject: mail.subject, html: mail.html, text: mail.text, fromName: cl.name, replyTo: lead.email || undefined });
    return { sent: true };
  } catch (e) {
    console.error("team lead email failed:", e && e.message);
    return { sent: false };
  }
}
