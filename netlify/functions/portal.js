const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const PACKAGES_DB = {
  google: [
    { id:"g-launch",      name:"Launch System",      platform:"Google Ads",    price:400,  setup:750,  leadFee:true, tag:"",            adSpend:"$750–$2,500/mo",     optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:false, multiCampaign:false },
    { id:"g-growth",      name:"Growth System",      platform:"Google Ads",    price:600,  setup:1500, leadFee:true, tag:"Most Popular", adSpend:"$2,000–$8,000/mo",   optimizationFreq:"weekly",  callTracking:true,  weeklyOptimization:true,  customLandingPage:true,  retargeting:false, splitTesting:false, crmIntegration:true,  multiCampaign:false },
    { id:"g-acquisition", name:"Acquisition System", platform:"Google Ads",    price:900,  setup:3000, leadFee:true, tag:"",            adSpend:"$5,000–$20,000+/mo", optimizationFreq:"weekly",  callTracking:true,  weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:true,  multiCampaign:true  },
  ],
  meta: [
    { id:"m-launch",      name:"Launch System",      platform:"Meta Ads",      price:350,  setup:600,  leadFee:true, tag:"",            adSpend:"$500–$2,000/mo",     optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:false, multiCampaign:false },
    { id:"m-growth",      name:"Growth System",      platform:"Meta Ads",      price:550,  setup:1200, leadFee:true, tag:"Most Popular", adSpend:"$1,500–$5,000/mo",   optimizationFreq:"weekly",  callTracking:false, weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:false, multiCampaign:false },
    { id:"m-acquisition", name:"Acquisition System", platform:"Meta Ads",      price:850,  setup:2500, leadFee:true, tag:"",            adSpend:"$4,000–$15,000+/mo", optimizationFreq:"weekly",  callTracking:false, weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:false, multiCampaign:true  },
  ],
  combined: [
    { id:"c-launch", name:"Full System — Launch", platform:"Google + Meta", price:650,  setup:1100, leadFee:true, tag:"Best Value",    adSpend:"$1,000–$4,000/mo",  optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:false, multiCampaign:false, savings:"Save $100/mo" },
    { id:"c-growth", name:"Full System — Growth", platform:"Google + Meta", price:1000, setup:2300, leadFee:true, tag:"Most Powerful", adSpend:"$3,000–$12,000/mo", optimizationFreq:"weekly",  callTracking:true,  weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:false, crmIntegration:true,  multiCampaign:false, savings:"Save $150/mo" },
  ],
  ecom: [
    { id:"e-launch",     name:"Store Launch",     platform:"Meta Ads",      price:450,  setup:800,  leadFee:false, tag:"",            adSpend:"$500–$1,500/mo",     optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:false, multiCampaign:false, roas:"+$200 bonus at 3x ROAS" },
    { id:"e-growth",     name:"Store Growth",     platform:"Meta + Google", price:750,  setup:1400, leadFee:false, tag:"Recommended", adSpend:"$1,500–$5,000/mo",   optimizationFreq:"weekly",  callTracking:false, weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:false, multiCampaign:false, roas:"+$350 bonus at 4x ROAS" },
    { id:"e-domination", name:"Store Domination", platform:"Meta + Google", price:1200, setup:2500, leadFee:false, tag:"",            adSpend:"$4,000–$15,000+/mo", optimizationFreq:"weekly",  callTracking:false, weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:false, multiCampaign:true,  roas:"+$500 bonus at 5x ROAS" },
  ],
};
const ALL_PKGS = Object.values(PACKAGES_DB).flat();
const findPkg = (id) => ALL_PKGS.find((p) => p.id === id);

const ALL_FEATURES = [
  { id:"search_ads",      label:"Google Search Ads",               category:"Google" },
  { id:"meta_ads",        label:"Facebook + Instagram Ads",         category:"Meta" },
  { id:"keyword_research",label:"Keyword Research",                 category:"Google" },
  { id:"ad_variations",   label:"Ad Copy Variations",               category:"Both" },
  { id:"std_landing",     label:"Standard Landing Page",            category:"Both" },
  { id:"custom_landing",  label:"Custom High-Converting Landing Page",category:"Both" },
  { id:"lead_form",       label:"Lead Form + Conversion Tracking",  category:"Both" },
  { id:"pixel",           label:"Pixel + Purchase Event Tracking",  category:"Meta" },
  { id:"call_tracking",   label:"Call Tracking Setup",              category:"Google" },
  { id:"monthly_report",  label:"Monthly Performance Report",       category:"Both" },
  { id:"weekly_opt",      label:"Weekly Optimization",              category:"Both" },
  { id:"monthly_opt",     label:"Monthly Optimization",             category:"Both" },
  { id:"competitor_research",label:"Competitor Research",           category:"Both" },
  { id:"crm_integration", label:"CRM Integration Assistance",       category:"Both" },
  { id:"advanced_targeting",label:"Advanced Audience Targeting",    category:"Both" },
  { id:"retargeting",     label:"Retargeting Campaigns",            category:"Both" },
  { id:"lookalike",       label:"Lookalike Audience Targeting",     category:"Meta" },
  { id:"split_testing",   label:"A/B Split Testing",                category:"Both" },
  { id:"multi_campaign",  label:"Multi-Campaign Strategy",          category:"Both" },
  { id:"google_shopping", label:"Google Shopping + Performance Max",category:"Google" },
  { id:"abandoned_cart",  label:"Abandoned Cart Retargeting",       category:"Meta" },
  { id:"full_funnel",     label:"Full Funnel Strategy (Cold→Hot)",  category:"Both" },
  { id:"ugc_consulting",  label:"UGC / Video Creative Consulting",  category:"Both" },
  { id:"crm_input",       label:"Offer + Pricing Optimization Input",category:"Both" },
  { id:"page_cro",        label:"Product Page CRO Input",           category:"Both" },
  { id:"strategy_calls",  label:"Weekly Strategy Calls",            category:"Both" },
  { id:"slack_access",    label:"Priority Support + Slack Access",  category:"Both" },
  { id:"scaling_roadmap", label:"Strategic Scaling Roadmap",        category:"Both" },
  { id:"priority_comms",  label:"Priority Communication",           category:"Both" },
  { id:"advanced_reporting",label:"Advanced Reporting Dashboard",   category:"Both" },
  { id:"unified_reporting",label:"Unified Cross-Channel Reporting", category:"Both" },
  { id:"cross_retargeting",label:"Cross-Channel Retargeting",       category:"Both" },
];

const PKG_FEATURES = {
  "g-launch":      ["search_ads","keyword_research","ad_variations","std_landing","lead_form","monthly_report","monthly_opt"],
  "g-growth":      ["search_ads","keyword_research","ad_variations","custom_landing","lead_form","call_tracking","weekly_opt","competitor_research","crm_integration","advanced_targeting","advanced_reporting","monthly_report"],
  "g-acquisition": ["search_ads","keyword_research","ad_variations","custom_landing","lead_form","call_tracking","weekly_opt","competitor_research","crm_integration","advanced_targeting","retargeting","split_testing","multi_campaign","advanced_reporting","monthly_report","scaling_roadmap","priority_comms"],
  "m-launch":      ["meta_ads","ad_variations","std_landing","lead_form","pixel","monthly_report","monthly_opt"],
  "m-growth":      ["meta_ads","ad_variations","custom_landing","lead_form","pixel","weekly_opt","retargeting","lookalike","split_testing","advanced_reporting","monthly_report"],
  "m-acquisition": ["meta_ads","ad_variations","custom_landing","lead_form","pixel","weekly_opt","retargeting","lookalike","split_testing","multi_campaign","full_funnel","advanced_reporting","monthly_report","scaling_roadmap","priority_comms"],
  "c-launch":      ["search_ads","meta_ads","keyword_research","ad_variations","std_landing","lead_form","pixel","monthly_report","monthly_opt","unified_reporting"],
  "c-growth":      ["search_ads","meta_ads","keyword_research","ad_variations","custom_landing","lead_form","pixel","call_tracking","weekly_opt","competitor_research","crm_integration","retargeting","cross_retargeting","lookalike","advanced_targeting","unified_reporting","advanced_reporting","monthly_report"],
  "e-launch":      ["meta_ads","ad_variations","pixel","monthly_report","monthly_opt"],
  "e-growth":      ["meta_ads","google_shopping","ad_variations","custom_landing","pixel","weekly_opt","retargeting","lookalike","split_testing","abandoned_cart","advanced_reporting","monthly_report"],
  "e-domination":  ["meta_ads","google_shopping","ad_variations","custom_landing","pixel","weekly_opt","retargeting","lookalike","split_testing","abandoned_cart","full_funnel","ugc_consulting","crm_input","page_cro","strategy_calls","slack_access","advanced_reporting","monthly_report"],
};
const pkgHasFeature = (pkgId, featureId) => (PKG_FEATURES[pkgId] || []).includes(featureId);

const getUpgradeOptions = (currentPkgId) => {
  const cur = findPkg(currentPkgId);
  if (!cur) return [];
  return ALL_PKGS.filter((p) =>
    p.id !== currentPkgId &&
    p.price > cur.price &&
    (p.platform === cur.platform || p.platform.includes(cur.platform.split(" ")[0]) || cur.platform.includes(p.platform.split(" ")[0]) || p.id.startsWith(currentPkgId[0]))
  ).sort((a, b) => a.price - b.price);
};

const PER_LEAD = { Roofing:75, "Med Spa":35, "Auto Detailing":15 };
const STAGES = [
  { id:"onboarding" }, { id:"research" }, { id:"building" }, { id:"review" },
  { id:"active" }, { id:"optimizing" }, { id:"scaling" }, { id:"paused" },
];
const daysUntil = (s) => Math.ceil((new Date(s) - new Date()) / 864e5);

const makePortalHTML = (cl, pkg) => {
  const si = STAGES.findIndex((s) => s.id === cl.stage);
  const pl = PER_LEAD[cl.niche];
  const SC = ["#6366F1","#0891B2","#D97706","#7C3AED","#10B981","#2563EB","#059669","#6B7280"];
  const SL = ["Onboarding","Research","Building","Final Review","Active","Optimizing","Scaling","Paused"];
  const SD = ["We're gathering your business details, brand assets, and goals to get your account ready for launch.","Our team is researching your market, competitors, and ideal customers to shape your campaign strategy.","Your landing pages, ad creatives, and tracking are being built and connected behind the scenes.","Your campaign is going through final quality checks before it goes live.","Your campaign is live and generating leads, which are sent straight to you.","We're testing and refining your campaign to improve lead quality and lower your cost per lead.","Your campaign is performing well, so we're increasing reach and budget to drive more results.","Your campaign is currently paused. Reach out to your account manager with any questions."];
  const upgOpts = getUpgradeOptions(cl.packageId);
  const inclFeats = ALL_FEATURES.filter((f) => pkgHasFeature(cl.packageId, f.id));
  const exclFeats = ALL_FEATURES.filter((f) => !pkgHasFeature(cl.packageId, f.id) && upgOpts.some((p) => pkgHasFeature(p.id, f.id)));
  const dL = daysUntil(cl.contractEnd);

  const stageRows = STAGES.map((s, i) => {
    const tag = i < si ? "Done" : i === si ? "In Progress" : "Upcoming";
    const dot = i <= si ? SC[i] : "#374151";
    const tagColor = i < si ? "#6B7280" : i === si ? SC[i] : "#374151";
    return `<details class="stage-row"><summary class="stage-btn"><span class="stage-dot" style="background:${dot}"></span><span class="stage-name">${SL[i]}</span><span class="stage-tag" style="color:${tagColor}">${tag}</span></summary><div class="stage-desc">${SD[i]}</div></details>`;
  }).join("");
  const fHTML = inclFeats.map((f) => '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#9CA3AF;display:flex;align-items:center;gap:8px"><span style="color:#C8A84B;font-weight:700">✓</span>' + f.label + "</div>").join("");
  const uHTML = exclFeats.slice(0, 8).map((f) => '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#374151;display:flex;align-items:center;gap:8px"><span>○</span>' + f.label + '<span style="margin-left:auto;font-size:9px;padding:1px 6px;border-radius:20px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);color:#C8A84B">Upgrade</span></div>').join("");
  const upgSection = upgOpts.length === 0 ? "" :
    '<div class="card" id="upgrade-section"><div class="lbl">Request an Upgrade</div>' +
    '<div style="font-size:11px;color:#6B7280;margin-bottom:10px">Select a package. Your account manager will confirm and send an invoice — no changes until you approve.</div>' +
    upgOpts.map((p, i) => {
      const newFeats = ALL_FEATURES.filter((f) => pkgHasFeature(p.id, f.id) && !pkgHasFeature(cl.packageId, f.id));
      const shown = newFeats.slice(0, 6);
      const extra = newFeats.length - shown.length;
      const featHTML = shown.length ? `<div class="uopt-feats-top">What you'll add</div><div class="uopt-feats">${shown.map((f) => `<span class="uopt-feat">+ ${f.label}</span>`).join("")}${extra > 0 ? `<span class="uopt-feat uopt-more">+${extra} more</span>` : ""}</div>` : "";
      return `<div class="uopt" id="u${i}" data-name="${p.name} (${p.platform}) $${p.price}/mo" onclick="selUpg(this,${i})"><div style="display:flex;justify-content:space-between"><div><div style="font-size:13px;font-weight:700;color:#F0F2FF">${p.name}</div><div style="font-size:10px;color:#6B7280">${p.platform}</div></div><div style="font-size:18px;font-weight:800;color:#C8A84B">$${p.price}<span style="font-size:10px;font-weight:400;color:#6B7280">/mo</span></div></div>${featHTML}</div>`;
    }).join("") +
    '<button class="btn" id="upgbtn" disabled onclick="submitUpg()" style="opacity:.4">Review Selection →</button></div>';
  const contractAlert = (dL <= 30 && dL >= 0) ? '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);font-size:11px;color:#F59E0B">Contract renewing in ' + dL + " days. Your account manager will be in touch.</div>" : "";
  const css = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#080A0F;color:#F9FAFB;font-size:14px}.hdr{background:#0D0F16;border-bottom:1px solid rgba(255,255,255,.08);padding:12px 16px;display:flex;align-items:center;gap:10px}.logo{width:30px;height:30px;object-fit:contain}.nav{display:flex;overflow-x:auto;background:#0D0F16;border-bottom:1px solid rgba(255,255,255,.07)}.nb{padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:none;background:transparent;color:#6B7280;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;font-family:inherit}.nb.on{color:#C8A84B;border-bottom-color:#C8A84B}.main{padding:14px;max-width:600px;margin:0 auto}.card{background:#0D0F16;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:14px;margin-bottom:10px}.lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#4B5563;margin-bottom:8px}.stage-cur{padding:11px;border-radius:9px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.2);margin-bottom:8px}.stage-cur-top{display:flex;align-items:center;gap:8px;margin-bottom:5px}.stage-cur-name{font-size:13px;font-weight:700}.stage-cur-desc{font-size:11px;color:#9CA3AF;line-height:1.6}.stage-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}.stage-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-left:auto}.stage-list{margin-top:2px}.stage-toggle{padding:9px 4px;font-size:11px;font-weight:700;color:#9CA3AF;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid rgba(255,255,255,.06);margin-top:4px}.stage-toggle::-webkit-details-marker{display:none}.stage-toggle::after{content:"▾";font-size:9px}.stage-list[open]>.stage-toggle::after{content:"▴"}.stage-row{border:1px solid rgba(255,255,255,.06);border-radius:8px;margin-top:6px}.stage-btn{padding:9px 10px;font-size:12px;font-weight:600;color:#E5E7EB;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}.stage-btn::-webkit-details-marker{display:none}.stage-btn::after{content:"▾";font-size:9px;color:#6B7280;margin-left:4px}.stage-row[open]>.stage-btn::after{content:"▴"}.stage-desc{padding:0 10px 10px 26px;font-size:11px;color:#9CA3AF;line-height:1.6}.stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:9px 11px;flex:1}.inp{width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:#F9FAFB;font-size:13px;font-family:inherit;margin-bottom:8px}.btn{width:100%;padding:12px;font-size:13px;font-weight:700;border-radius:10px;border:1px solid rgba(200,168,75,.35);background:rgba(200,168,75,.1);color:#C8A84B;cursor:pointer;font-family:inherit;margin-top:10px}.uopt{padding:12px;border-radius:10px;border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;margin-bottom:8px}.uopt.sel{border-color:#C8A84B;background:rgba(200,168,75,.07)}.uopt-feats-top{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06);margin-bottom:6px}.uopt-feats{display:flex;flex-wrap:wrap;gap:5px}.uopt-feat{font-size:10px;color:#9CA3AF;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:3px 9px;line-height:1.4}.uopt-more{color:#C8A84B;border-color:rgba(200,168,75,.2);background:rgba(200,168,75,.07)}select{background:#0D0F16;color:#F9FAFB}';

  return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"><title>" + cl.name + " Portal</title><style>" + css + "</style></head><body>"
    + '<div class="hdr"><img class="logo" src="/logo.png" alt="BoldLine Media"><div><div style="font-size:13px;font-weight:700;color:#E8E4D0">BoldLine Media</div><div style="font-size:9px;color:#6e6b54">Client Portal</div></div><div style="margin-left:auto;font-size:11px;color:#9CA3AF">' + cl.name + "</div></div>"
    + `<div class="nav"><button class="nb on" onclick="show('status',this)">Status</button><button class="nb" onclick="show('package',this)">My Package</button><button class="nb" onclick="show('intake',this)">My Info</button><button class="nb" onclick="show('contract',this)">Contract</button></div>`
    + '<div class="main">'
    + `<div id="t-status"><div class="card"><div class="lbl">Campaign Progress</div><div class="stage-cur"><div class="stage-cur-top"><span class="stage-dot" style="background:${SC[si] || "#6B7280"}"></span><span class="stage-cur-name" style="color:${SC[si] || "#9CA3AF"}">${SL[si] || "—"}</span><span class="stage-tag" style="color:${SC[si] || "#9CA3AF"}">In Progress</span></div><div class="stage-cur-desc">${SD[si] || "Your campaign status will appear here."}</div></div><details class="stage-list"><summary class="stage-toggle">View all steps</summary>${stageRows}</details></div>`
    + '<div class="card"><div class="lbl">Your Campaign</div><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="stat"><div class="lbl">Package</div><div style="font-size:13px;font-weight:700;color:#E5E7EB">' + ((pkg && pkg.name) || "—") + '</div></div><div class="stat"><div class="lbl">Platform</div><div style="font-size:13px;font-weight:700;color:#E5E7EB">' + ((pkg && pkg.platform) || "—") + "</div></div>" + (pl ? '<div class="stat"><div class="lbl">Per Lead</div><div style="font-size:13px;font-weight:700;color:#C8A84B">$' + pl + "</div></div>" : "") + "</div></div></div>"
    + '<div id="t-package" style="display:none"><div class="card"><div class="lbl">Your Package — ' + ((pkg && pkg.name) || "—") + '</div><div style="font-size:11px;color:#C8A84B;margin-bottom:12px">' + ((pkg && pkg.platform) || "") + (pkg ? " · $" + pkg.price + "/mo" : "") + "</div>" + fHTML + (exclFeats.length > 0 ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)"><div class="lbl">Available with Upgrade</div>' + uHTML + "</div>" : "") + "</div>" + upgSection + "</div>"
    + `<div id="t-intake" style="display:none"><div class="card"><div class="lbl">Business Details</div><input class="inp" placeholder="Business Name *" value="${cl.name}"><input class="inp" placeholder="Contact Name" value="${cl.contactName || ""}"><input class="inp" placeholder="Email" value="${cl.email || ""}"><input class="inp" placeholder="Business Address" value="${cl.businessAddress || ""}"><input class="inp" placeholder="Service Area"></div><div class="card"><div class="lbl">Your Offer</div><input class="inp" placeholder="Main service to advertise *"><input class="inp" placeholder="Average job / ticket value *"><input class="inp" placeholder="What makes you different? *"></div><div class="card"><div class="lbl">Assets</div><select class="inp"><option>Do you have photos of your work?</option><option>Yes — I will send them</option><option>No — use stock images</option></select><input class="inp" placeholder="Where should leads be sent? *"><input class="inp" placeholder="CRM or booking system (if any)"></div><button class="btn" onclick="this.textContent='✓ Saved';this.disabled=true">Save My Information</button></div>`
    + '<div id="t-contract" style="display:none"><div class="card"><div class="lbl">Contract Status</div><div style="font-size:13px;font-weight:700;color:' + (cl.contractStatus === "active" ? "#10B981" : cl.contractStatus === "pending" ? "#F59E0B" : "#EF4444") + ';margin-bottom:6px">' + (cl.contractStatus === "active" ? "Signed and Active" : cl.contractStatus === "pending" ? "Pending Signature" : "Expired") + '</div><div style="font-size:11px;color:#6B7280;line-height:1.6">Start: ' + (cl.contractStart || "—") + " · End: " + (cl.contractEnd || "—") + "</div>" + contractAlert + "</div></div>"
    + "</div>"
    + `<script>var selUpgName=null;function show(n,b){document.querySelectorAll('[id^="t-"]').forEach(e=>e.style.display="none");document.querySelectorAll('.nb').forEach(e=>e.classList.remove('on'));document.getElementById('t-'+n).style.display='block';b.classList.add('on');}function selUpg(el,i){selUpgName=el.getAttribute('data-name');document.querySelectorAll('.uopt').forEach((e,j)=>{e.classList.toggle('sel',i===j)});var b=document.getElementById('upgbtn');if(b){b.disabled=false;b.style.opacity='1';}}function submitUpg(){if(!selUpgName)return;if(confirm('Send upgrade request?\\n'+selUpgName+'\\n\\nYour account manager will be in touch within 1 business day.')){document.getElementById('upgrade-section').innerHTML='<div style="text-align:center;padding:24px"><div style="font-size:30px;margin-bottom:10px">✓</div><div style="font-size:15px;font-weight:700;color:#F0F2FF;margin-bottom:8px">Request Sent</div><div style="font-size:12px;color:#6B7280">Your account manager will be in touch within 1 business day.</div></div>';}}<\/script>`
    + "</body></html>";
};

const errorPage = (title, message) =>
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#080A0F;color:#F9FAFB;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:360px}h1{font-size:18px;margin-bottom:8px}p{font-size:13px;color:#9CA3AF;line-height:1.6}</style></head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`;

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: errorPage("Missing Link", "This portal link is incomplete. Please ask your account manager to resend it.") };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("data")
      .eq("data->>portalToken", token)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error);
      return { statusCode: 500, headers: { "Content-Type": "text/html" }, body: errorPage("Something Went Wrong", "We couldn't load your portal right now. Please try again shortly.") };
    }
    if (!data) {
      return { statusCode: 404, headers: { "Content-Type": "text/html" }, body: errorPage("Portal Not Found", "This link is invalid or has expired. Please contact your account manager for a new one.") };
    }

    const cl = data.data;
    const pkg = findPkg(cl.packageId);
    return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: makePortalHTML(cl, pkg) };
  } catch (err) {
    console.error("Portal function error:", err);
    return { statusCode: 500, headers: { "Content-Type": "text/html" }, body: errorPage("Something Went Wrong", "We couldn't load your portal right now. Please try again shortly.") };
  }
};

exports._internal = { makePortalHTML, findPkg };
