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

// Renders the same lightweight markdown the report emails use (bold section
// headers, "- " bullets, plain paragraphs), styled for the dark portal theme.
const reportTextToHTML = (text) => {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let bullets = null;
  let first = true;
  const flush = () => {
    if (bullets && bullets.length) {
      blocks.push('<ul style="margin:0 0 12px;padding-left:18px;color:#D1D5DB">' + bullets.map((b) => '<li style="margin-bottom:5px;line-height:1.55;font-size:12px">' + inline(b) + "</li>").join("") + "</ul>");
    }
    bullets = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = line.match(/^\*\*(.+?)\*\*:?$/);
    if (h) {
      flush();
      blocks.push('<div style="margin:' + (first ? "0" : "16px") + ' 0 6px;font-size:10px;font-weight:700;letter-spacing:.06em;color:#C8A84B;text-transform:uppercase">' + esc(h[1]) + "</div>");
      first = false;
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { bullets = bullets || []; bullets.push(li[1]); first = false; continue; }
    flush();
    blocks.push('<p style="margin:0 0 10px;line-height:1.6;font-size:12px;color:#D1D5DB">' + inline(line) + "</p>");
    first = false;
  }
  flush();
  return blocks.join("");
};

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
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const scol = SC[si] || "#C8A84B";
  const prog = si >= 0 ? Math.round(((si + 1) / STAGES.length) * 100) : 0;
  const firstName = esc(String(cl.contactName || cl.name || "").split(" ")[0] || "");
  const cs = cl.campaignSetup || {};
  const bv = cl.brandVoice || {};
  const mediaItems = cl.mediaLibrary || [];
  const TONES = ["", "Professional", "Friendly & Casual", "Bold & Energetic", "Luxury & Premium"];
  const RECOMMENDED_ASSETS = ["Your logo", "3–5 strong photos of your work, product, or space", "A short video — even phone footage works great", "2–3 of your best customer reviews or quotes", "Before/after photos, if that fits your business"];

  const stageRows = STAGES.map((s, i) => {
    const tag = i < si ? "Done" : i === si ? "In Progress" : "Upcoming";
    const dot = i <= si ? SC[i] : "#374151";
    const tagColor = i < si ? "#6B7280" : i === si ? SC[i] : "#374151";
    return `<details class="stage-row"><summary class="stage-btn"><span class="stage-dot" style="background:${dot}"></span><span class="stage-name">${SL[i]}</span><span class="stage-tag" style="color:${tagColor}">${tag}</span></summary><div class="stage-desc">${SD[i]}</div></details>`;
  }).join("");
  const trackerHTML = STAGES.map((s, i) => '<div class="tk ' + (i < si ? "tk-done" : i === si ? "tk-cur" : "tk-up") + '"><span class="tk-dot"></span></div>').join("");
  const pf = STAGES.length > 1 ? (Math.max(si, 0) / (STAGES.length - 1)).toFixed(3) : "0";
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
    '<div id="upg-action"><button class="btn" id="upgbtn" disabled onclick="askUpg()" style="opacity:.4">Upgrade</button></div></div>';
  const contractAlert = (dL <= 30 && dL >= 0) ? '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);font-size:11px;color:#F59E0B">Contract renewing in ' + dL + " days. Your account manager will be in touch.</div>" : "";
  const reportSection = cl.latestReport && cl.latestReport.text
    ? '<div class="card"><div class="lbl">' + (cl.latestReport.period === "monthly" ? "Monthly" : "Weekly") + ' Performance Report</div><div style="font-size:10px;color:#6B7280;margin-bottom:12px">Sent ' + new Date(cl.latestReport.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + "</div>" + reportTextToHTML(cl.latestReport.text) + "</div>"
    : '<div class="card"><div class="lbl">Performance Reports</div><div style="font-size:12px;color:#6B7280;line-height:1.6">Your first performance report will appear here once it\'s sent.</div></div>';
  const css = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#080A0F;color:#F9FAFB;font-size:14px}.hdr{background:#0D0F16;border-bottom:1px solid rgba(255,255,255,.08);padding:12px 16px;display:flex;align-items:center;gap:10px}.logo{width:30px;height:30px;object-fit:contain}.nav{display:flex;overflow-x:auto;background:#0D0F16;border-bottom:1px solid rgba(255,255,255,.07)}.nb{padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:none;background:transparent;color:#6B7280;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;font-family:inherit}.nb.on{color:#C8A84B;border-bottom-color:#C8A84B}.main{padding:14px;max-width:600px;margin:0 auto}.card{background:#0D0F16;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:14px;margin-bottom:10px}.lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#4B5563;margin-bottom:8px}.stage-cur{padding:11px;border-radius:9px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.2);margin-bottom:8px}.stage-cur-top{display:flex;align-items:center;gap:8px;margin-bottom:5px}.stage-cur-name{font-size:13px;font-weight:700}.stage-cur-desc{font-size:11px;color:#9CA3AF;line-height:1.6}.stage-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}.stage-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-left:auto}.stage-list{margin-top:2px}.stage-toggle{padding:9px 4px;font-size:11px;font-weight:700;color:#9CA3AF;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid rgba(255,255,255,.06);margin-top:4px}.stage-toggle::-webkit-details-marker{display:none}.stage-toggle::after{content:"▾";font-size:9px}.stage-list[open]>.stage-toggle::after{content:"▴"}.stage-row{border:1px solid rgba(255,255,255,.06);border-radius:8px;margin-top:6px}.stage-btn{padding:9px 10px;font-size:12px;font-weight:600;color:#E5E7EB;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}.stage-btn::-webkit-details-marker{display:none}.stage-btn::after{content:"▾";font-size:9px;color:#6B7280;margin-left:4px}.stage-row[open]>.stage-btn::after{content:"▴"}.stage-desc{padding:0 10px 10px 26px;font-size:11px;color:#9CA3AF;line-height:1.6}.stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:9px 11px;flex:1}.inp{width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:#F9FAFB;font-size:13px;font-family:inherit;margin-bottom:8px}.btn{width:100%;padding:12px;font-size:13px;font-weight:700;border-radius:10px;border:1px solid rgba(200,168,75,.35);background:rgba(200,168,75,.1);color:#C8A84B;cursor:pointer;font-family:inherit;margin-top:10px}.uopt{padding:12px;border-radius:10px;border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;margin-bottom:8px}.uopt.sel{border-color:#C8A84B;background:rgba(200,168,75,.07)}.uopt-feats-top{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06);margin-bottom:6px}.uopt-feats{display:flex;flex-wrap:wrap;gap:5px}.uopt-feat{font-size:10px;color:#9CA3AF;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:3px 9px;line-height:1.4}.uopt-more{color:#C8A84B;border-color:rgba(200,168,75,.2);background:rgba(200,168,75,.07)}select{background:#0D0F16;color:#F9FAFB}option{background:#0D0F16;color:#F9FAFB}.reco-list{margin:0 0 12px;padding-left:18px;color:#9CA3AF;font-size:11px;line-height:1.8}.media-item{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#D1D5DB}.media-cat{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#C8A84B;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);border-radius:6px;padding:2px 6px;flex-shrink:0}.media-card{border:1px solid rgba(200,168,75,.4);background:rgba(200,168,75,.05)}.media-empty{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#F59E0B;font-size:11px;padding:9px 11px;border-radius:8px;margin-bottom:12px;line-height:1.6}.media-thumb{width:36px;height:36px;border-radius:7px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.06)}.media-thumb-vid{display:flex;align-items:center;justify-content:center;font-size:12px;color:#C8A84B}.media-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.media-del{flex-shrink:0;width:24px;height:24px;border-radius:7px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#EF4444;font-size:11px;cursor:pointer;font-family:inherit;line-height:1}.hdr,.nav,.main{position:relative;z-index:1}body{position:relative;min-height:100vh;overflow-x:hidden}.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}.topglow{position:fixed;top:-220px;left:50%;transform:translateX(-50%);width:760px;height:440px;max-width:150vw;background:radial-gradient(ellipse at center,rgba(200,168,75,.17),transparent 70%);z-index:0;pointer-events:none}.ambient .orb{position:absolute;border-radius:50%;filter:blur(55px);will-change:transform}.ambient .o1{width:440px;height:440px;top:-150px;left:-130px;background:radial-gradient(circle,rgba(200,168,75,.22),transparent 66%);animation:orbDrift 42s ease-in-out infinite alternate}.ambient .o2{width:380px;height:380px;top:36%;right:-150px;background:radial-gradient(circle,rgba(200,168,75,.14),transparent 66%);animation:orbDrift 56s ease-in-out -12s infinite alternate-reverse}.ambient .o3{width:420px;height:420px;bottom:-190px;left:14%;background:radial-gradient(circle,rgba(180,150,90,.17),transparent 64%);animation:orbDrift 68s ease-in-out -28s infinite alternate}@keyframes orbDrift{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(50px,-36px,0) scale(1.12)}100%{transform:translate3d(-44px,44px,0) scale(.94)}}.ambient .grain{position:absolute;inset:0;opacity:.04;background-size:170px 170px;background-image:url(\"data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'170\' height=\'170\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E\")}.card{position:relative;overflow:hidden;background:rgba(14,16,24,.5);backdrop-filter:blur(14px) saturate(1.25);-webkit-backdrop-filter:blur(14px) saturate(1.25);transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}.card::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(200,168,75,.4),transparent)}.card:hover{transform:translateY(-2px);border-color:rgba(200,168,75,.28);box-shadow:0 20px 46px -26px rgba(0,0,0,.9)}.hdr{background:rgba(13,15,22,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.nav{background:rgba(13,15,22,.64);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.welcome{margin:6px 2px 16px}.welcome b{display:block;font-size:19px;font-weight:800;color:#F5F3ED;letter-spacing:-.01em}.welcome span{display:block;font-size:12px;color:#9CA3AF;margin-top:3px}.prog-hero{display:flex;align-items:center;gap:18px;padding:6px 2px 4px}.ring{position:relative;width:104px;height:104px;border-radius:50%;flex-shrink:0;background:conic-gradient(from -90deg,#C8A84B calc(var(--p,0)*1%),rgba(255,255,255,.06) 0);box-shadow:0 0 30px -8px rgba(200,168,75,.45);animation:ringGlow 3.6s ease-in-out infinite}.ring-in{position:absolute;inset:9px;border-radius:50%;background:#0B0D13;display:flex;flex-direction:column;align-items:center;justify-content:center}.ring-n{font-size:27px;font-weight:800;color:#F5F3ED;line-height:1}.ring-n span{font-size:13px;font-weight:600;color:#6B7280}.ring-l{font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9C8A5A;margin-top:3px}@keyframes ringGlow{0%,100%{box-shadow:0 0 24px -8px rgba(200,168,75,.4)}50%{box-shadow:0 0 36px -4px rgba(200,168,75,.72)}}.prog-info{flex:1;min-width:0}.prog-stage{display:flex;align-items:center;gap:8px;font-size:19px;font-weight:800;color:#F5F3ED;margin-bottom:3px;letter-spacing:-.01em}.prog-stage .d{width:9px;height:9px;border-radius:50%;flex-shrink:0}.prog-tag{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#C8A84B;margin-bottom:8px}.tracker{position:relative;display:flex;justify-content:space-between;align-items:center;margin:18px 6px 2px;padding:0 4px;height:16px}.tracker::before{content:"";position:absolute;left:8px;right:8px;top:50%;height:2px;background:rgba(255,255,255,.09);transform:translateY(-50%);border-radius:2px}.tracker::after{content:"";position:absolute;left:8px;top:50%;height:2px;width:calc((100% - 16px) * var(--pf,0));background:linear-gradient(90deg,#C8A84B,#E4CE93);transform:translateY(-50%);border-radius:2px;box-shadow:0 0 9px rgba(200,168,75,.55);transition:width 1.2s cubic-bezier(.2,.7,.2,1)}.tk{position:relative;z-index:1}.tk-dot{display:block;width:10px;height:10px;border-radius:50%;background:#2A2E3A;box-shadow:0 0 0 3px #0D0F16}.tk-done .tk-dot{background:#C8A84B}.tk-cur .tk-dot{width:14px;height:14px;background:#E4CE93;animation:tkPulse 2.4s ease-in-out infinite}@keyframes tkPulse{0%,100%{box-shadow:0 0 0 3px #0D0F16,0 0 0 5px rgba(200,168,75,.18),0 0 10px rgba(200,168,75,.5)}50%{box-shadow:0 0 0 3px #0D0F16,0 0 0 8px rgba(200,168,75,.04),0 0 18px rgba(200,168,75,.85)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.tab-anim>*{animation:fadeUp .42s ease both}.tab-anim>*:nth-child(2){animation-delay:.06s}.tab-anim>*:nth-child(3){animation-delay:.12s}.tab-anim>*:nth-child(4){animation-delay:.18s}.tab-anim>*:nth-child(5){animation-delay:.24s}@media (prefers-reduced-motion:reduce){.ambient .orb,.ring,.tab-anim>*{animation:none!important}.card{transition:none}}';

  return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"><title>" + cl.name + " Portal</title><style>" + css + "</style></head><body>" + '<div class="topglow" aria-hidden="true"></div><div class="ambient" aria-hidden="true"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="grain"></div></div>'
    + '<div class="hdr"><img class="logo" src="/logo.png" alt="BoldLine Media"><div><div style="font-size:13px;font-weight:700;color:#E8E4D0">BoldLine Media</div><div style="font-size:9px;color:#6e6b54">Client Portal</div></div><div style="margin-left:auto;font-size:11px;color:#9CA3AF">' + cl.name + "</div></div>"
    + `<div class="nav"><button class="nb on" onclick="show('status',this)">Status</button><button class="nb" onclick="show('reports',this)">Reports</button><button class="nb" onclick="show('package',this)">My Package</button><button class="nb" onclick="show('intake',this)">My Info</button><button class="nb" onclick="show('contract',this)">Contract</button></div>`
    + '<div class="main">'
    + `<div id="t-status"><div class="welcome"><b>Welcome back${firstName ? ", " + firstName : ""}</b><span>Here's where your campaign stands today.</span></div><div class="card"><div class="lbl">Campaign Progress</div><div class="prog-hero"><div class="ring" style="--p:${prog}"><div class="ring-in"><div class="ring-n">${si >= 0 ? si + 1 : "—"}<span>/${STAGES.length}</span></div><div class="ring-l">Stage</div></div></div><div class="prog-info"><div class="prog-stage"><span class="d" style="background:${scol}"></span>${SL[si] || "—"}</div><div class="prog-tag">In Progress</div><div class="stage-cur-desc">${SD[si] || "Your campaign status will appear here."}</div></div></div><div class="tracker" style="--pf:${pf}">${trackerHTML}</div><details class="stage-list"><summary class="stage-toggle">View all steps</summary>${stageRows}</details></div>`
    + '<div class="card"><div class="lbl">Your Campaign</div><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="stat"><div class="lbl">Package</div><div style="font-size:13px;font-weight:700;color:#E5E7EB">' + ((pkg && pkg.name) || "—") + '</div></div><div class="stat"><div class="lbl">Platform</div><div style="font-size:13px;font-weight:700;color:#E5E7EB">' + ((pkg && pkg.platform) || "—") + "</div></div>" + (pl ? '<div class="stat"><div class="lbl">Per Lead</div><div style="font-size:13px;font-weight:700;color:#C8A84B">$' + pl + "</div></div>" : "") + "</div></div></div>"
    + '<div id="t-reports" style="display:none">' + reportSection + "</div>"
    + '<div id="t-package" style="display:none"><div class="card"><div class="lbl">Your Package — ' + ((pkg && pkg.name) || "—") + '</div><div style="font-size:11px;color:#C8A84B;margin-bottom:12px">' + ((pkg && pkg.platform) || "") + (pkg ? " · $" + pkg.price + "/mo" : "") + "</div>" + fHTML + (exclFeats.length > 0 ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)"><div class="lbl">Available with Upgrade</div>' + uHTML + "</div>" : "") + "</div>" + upgSection + "</div>"
    + `<div id="t-intake" style="display:none">`
    + `<div class="card"><div class="lbl">Business Details</div><input class="inp" data-key="contactName" placeholder="Contact Name" value="${esc(cl.contactName || "")}"><input class="inp" data-key="email" placeholder="Email" value="${esc(cl.email || "")}"><input class="inp" data-key="businessPhone" placeholder="Business phone number (for call forwarding)" value="${esc(cl.businessPhone || "")}"><input class="inp" data-key="businessAddress" placeholder="Business Address" value="${esc(cl.businessAddress || "")}"><input class="inp" data-key="campaignSetup.serviceArea" placeholder="Service Area" value="${esc(cs.serviceArea || "")}"></div>`
    + `<div class="card media-card"><div class="lbl" style="color:#C8A84B;font-size:11px">📸 Your Photos &amp; Video</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:10px;line-height:1.6">This is the media we'll use in your ads and landing page — add your logo, photos, and a short video so everything looks like you. Files upload as soon as you tap Upload (no need to press Save).</div>${mediaItems.length ? "" : '<div class="media-empty" id="media-empty">No media from you yet — add your photos, logo, or a short video below so we can start building your ads.</div>'}<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-bottom:6px">Worth adding, if you have them</div><ul class="reco-list">${RECOMMENDED_ASSETS.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin:4px 0 6px">What are you uploading?</div><select class="inp" id="media-cat"><option value="photo">Photo</option><option value="logo">Logo</option><option value="video">Video</option><option value="review">Review / testimonial</option></select><input class="inp" type="file" id="media-file" accept="image/*,video/*" onchange="autoCat(this)"><button class="btn" id="media-upload-btn" onclick="uploadMedia(this)">Upload File</button><div id="media-status" style="font-size:11px;color:#6B7280;margin-top:6px"></div><div id="media-list" style="margin-top:10px">${mediaItems.length ? mediaItems.map((m) => `<div class="media-item" data-path="${esc(m.path)}">${m.category === "video" ? '<span class="media-thumb media-thumb-vid">▶</span>' : `<img class="media-thumb" src="${esc(m.url)}" alt="">`}<span class="media-cat">${esc(m.category)}</span><span class="media-name">${esc(m.label)}</span><button class="media-del" onclick="delMedia(this)" title="Remove">✕</button></div>`).join("") : '<div style="font-size:11px;color:#6B7280">No files uploaded yet.</div>'}</div></div>`
    + `<div class="card"><div class="lbl">Campaign Setup</div><input class="inp" data-key="adBudget" placeholder="Monthly Ad Budget (e.g. $2,500/mo)" value="${esc(cl.adBudget || "")}"><input class="inp" data-key="campaignSetup.mainOffer" placeholder="Main service to advertise" value="${esc(cs.mainOffer || "")}"><input class="inp" data-key="campaignSetup.avgTicket" placeholder="Average job / ticket value" value="${esc(cs.avgTicket || "")}"><input class="inp" data-key="campaignSetup.targetLocations" placeholder="Target locations (cities, zip codes)" value="${esc(cs.targetLocations || "")}"><input class="inp" data-key="campaignSetup.excludedKeywords" placeholder="Anything we should avoid in your ads?" value="${esc(cs.excludedKeywords || "")}"><input class="inp" data-key="campaignSetup.leadDestination" placeholder="Where should leads be sent? (email or phone)" value="${esc(cs.leadDestination || "")}"><input class="inp" data-key="campaignSetup.crmSystem" placeholder="CRM or booking system (if any)" value="${esc(cs.crmSystem || "")}"></div>`
    + `<div class="card"><div class="lbl">Brand Voice</div><select class="inp" data-key="brandVoice.tone">${TONES.map((t) => `<option value="${esc(t)}" ${bv.tone === t ? "selected" : ""}>${t || "How would you describe your brand?"}</option>`).join("")}</select><input class="inp" data-key="brandVoice.competitors" placeholder="Top competitors" value="${esc(bv.competitors || "")}"><input class="inp" data-key="brandVoice.differentiator" placeholder="What makes you different?" value="${esc(bv.differentiator || "")}"></div>`
    + `<button class="btn" id="savebtn" onclick="saveInfo(this)">Save My Information</button>`
    + `</div>`
    + '<div id="t-contract" style="display:none"><div class="card"><div class="lbl">Contract Status</div><div style="font-size:13px;font-weight:700;color:' + (cl.contractStatus === "active" ? "#10B981" : cl.contractStatus === "pending" ? "#F59E0B" : "#EF4444") + ';margin-bottom:6px">' + (cl.contractStatus === "active" ? "Signed and Active" : cl.contractStatus === "pending" ? "Pending Signature" : "Expired") + '</div><div style="font-size:11px;color:#6B7280;line-height:1.6">Start: ' + (cl.contractStart || "—") + " · End: " + (cl.contractEnd || "—") + "</div>" + contractAlert + "</div></div>"
    + "</div>"
    + `<script>var selUpgName=null;var TOKEN=${JSON.stringify(cl.portalToken || "")};function saveInfo(btn){var obj={};document.querySelectorAll('[data-key]').forEach(el=>{var path=el.getAttribute('data-key').split('.'),cur=obj;for(var i=0;i<path.length-1;i++){cur[path[i]]=cur[path[i]]||{};cur=cur[path[i]];}cur[path[path.length-1]]=el.value;});var orig=btn.textContent;btn.disabled=true;btn.textContent='Saving…';fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:obj})}).then(r=>{if(!r.ok)throw 0;btn.textContent='✓ Saved';setTimeout(()=>{btn.disabled=false;btn.textContent=orig;},1800);}).catch(()=>{btn.textContent='Save failed — try again';btn.disabled=false;});}function uploadMedia(btn){var fileInput=document.getElementById('media-file'),file=fileInput.files[0],status=document.getElementById('media-status'),category=document.getElementById('media-cat').value;if(!file){status.style.color='#F59E0B';status.textContent='Choose a file first.';return;}btn.disabled=true;status.style.color='#6B7280';status.textContent='Uploading…';fetch('/.netlify/functions/media?action=sign&token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:file.name,category:category})}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(d=>fetch(d.signedUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file}).then(r2=>{if(!r2.ok)throw 0;return d;})).then(d=>fetch('/.netlify/functions/media?action=confirm&token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:d.path,category:category,label:file.name})})).then(r=>{if(!r.ok)throw 0;return r.json();}).then(d2=>{status.style.color='#10B981';status.textContent='✓ Uploaded';var entry=(d2.mediaLibrary&&d2.mediaLibrary[0])||{};var mEmpty=document.getElementById('media-empty');if(mEmpty)mEmpty.style.display='none';var list=document.getElementById('media-list');if(list.textContent.indexOf('No files uploaded yet')>=0)list.innerHTML='';var item=document.createElement('div');item.className='media-item';item.setAttribute('data-path',entry.path||'');var thumb;if(category==='video'){thumb=document.createElement('span');thumb.className='media-thumb media-thumb-vid';thumb.textContent='▶';}else{thumb=document.createElement('img');thumb.className='media-thumb';thumb.src=entry.url||'';}var catSpan=document.createElement('span');catSpan.className='media-cat';catSpan.textContent=category;var nameSpan=document.createElement('span');nameSpan.className='media-name';nameSpan.textContent=file.name;var del=document.createElement('button');del.className='media-del';del.textContent='✕';del.setAttribute('onclick','delMedia(this)');item.appendChild(thumb);item.appendChild(catSpan);item.appendChild(nameSpan);item.appendChild(del);list.insertBefore(item,list.firstChild);fileInput.value='';btn.disabled=false;}).catch(()=>{status.style.color='#EF4444';status.textContent='Upload failed — try again.';btn.disabled=false;});}function delMedia(btn){var row=btn.closest('.media-item'),path=row&&row.getAttribute('data-path');if(!path)return;if(!confirm('Remove this file? It will no longer be available for your ads or landing page.'))return;btn.disabled=true;btn.textContent='…';fetch('/.netlify/functions/media?action=delete&token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path})}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(()=>{var list=row.parentNode;row.remove();if(list&&!list.querySelector('.media-item'))list.innerHTML='<div style="font-size:11px;color:#6B7280">No files uploaded yet.</div>';}).catch(()=>{btn.disabled=false;btn.textContent='✕';var status=document.getElementById('media-status');if(status){status.style.color='#EF4444';status.textContent='Could not remove — try again.';}});}function autoCat(input){var f=input.files[0];if(f&&f.type&&f.type.indexOf('video/')===0){document.getElementById('media-cat').value='video';}}function show(n,b){document.querySelectorAll('[id^="t-"]').forEach(e=>e.style.display="none");document.querySelectorAll('.nb').forEach(e=>e.classList.remove('on'));var p=document.getElementById('t-'+n);p.style.display='block';p.classList.remove('tab-anim');void p.offsetWidth;p.classList.add('tab-anim');b.classList.add('on');}function selUpg(el,i){selUpgName=el.getAttribute('data-name');document.querySelectorAll('.uopt').forEach((e,j)=>{e.classList.toggle('sel',i===j)});var b=document.getElementById('upgbtn');if(b){b.disabled=false;b.style.opacity='1';}}function askUpg(){if(!selUpgName)return;var w=document.getElementById('upg-action');if(!w)return;w.innerHTML='<div style="font-size:12px;color:#9CA3AF;margin:12px 0 10px;line-height:1.55">Request an upgrade to <b style="color:#F0F2FF">'+selUpgName+'</b>? Your account manager will confirm and send an invoice — nothing changes until you approve.</div><div style="display:flex;gap:8px"><button class="btn" style="margin-top:0;flex:1;background:transparent;border-color:rgba(255,255,255,.15);color:#9CA3AF" onclick="cancelUpg()">Cancel</button><button class="btn" id="upg-confirm" style="margin-top:0;flex:1" onclick="confirmUpg()">Confirm Upgrade Request</button></div>';}function cancelUpg(){var w=document.getElementById('upg-action');if(w)w.innerHTML='<button class="btn" id="upgbtn" onclick="askUpg()">Upgrade</button>';}function confirmUpg(){if(!selUpgName)return;var b=document.getElementById('upg-confirm');if(b){b.disabled=true;b.textContent='Sending…';}fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({upgrade:selUpgName})}).then(function(r){if(!r.ok)throw 0;document.getElementById('upgrade-section').innerHTML='<div style="text-align:center;padding:24px"><div style="font-size:30px;margin-bottom:10px">✓</div><div style="font-size:15px;font-weight:700;color:#F0F2FF;margin-bottom:8px">Request Sent</div><div style="font-size:12px;color:#6B7280">Your account manager will be in touch within 1 business day.</div></div>';}).catch(function(){if(b){b.disabled=false;b.textContent='Confirm Upgrade Request';}alert('Something went wrong. Please try again or contact your account manager.');});}try{var _ts=document.getElementById('t-status');if(_ts)_ts.classList.add('tab-anim');}catch(e){}<\/script>`
    + "</body></html>";
};

const errorPage = (title, message) =>
  `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;font-family:-apple-system,sans-serif;background:#080A0F;color:#F9FAFB;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}div{max-width:360px}h1{font-size:18px;margin-bottom:8px}p{font-size:13px;color:#9CA3AF;line-height:1.6}</style></head><body><div><h1>${title}</h1><p>${message}</p></div></body></html>`;

const clip = (s, n = 500) => String(s == null ? "" : s).slice(0, n);

const sanitizeFields = (fields) => {
  const out = {};
  if (!fields || typeof fields !== "object") return out;
  for (const k of ["contactName", "email", "businessAddress", "adBudget", "businessPhone"]) {
    if (Object.prototype.hasOwnProperty.call(fields, k)) out[k] = clip(fields[k], k === "businessAddress" ? 300 : 200);
  }
  for (const k of ["campaignSetup", "brandVoice"]) {
    if (fields[k] && typeof fields[k] === "object") {
      out[k] = Object.fromEntries(Object.entries(fields[k]).map(([fk, fv]) => [fk, clip(fv, 500)]));
    }
  }
  return out;
};

const mergeFields = (base, patch) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = v && typeof v === "object" && base[k] && typeof base[k] === "object" ? { ...base[k], ...v } : v;
  }
  return out;
};

exports.handler = async (event) => {
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) {
    if (event.httpMethod === "POST") return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Missing token" }) };
    return { statusCode: 400, headers: { "Content-Type": "text/html" }, body: errorPage("Missing Link", "This portal link is incomplete. Please ask your account manager to resend it.") };
  }

  const supabaseAdmin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (event.httpMethod === "POST") {
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Invalid JSON" }) };
    }
    try {
      const { data, error } = await supabaseAdmin.from("clients").select("id, data").eq("data->>portalToken", token).maybeSingle();
      if (error) {
        console.error("Portal save lookup failed:", error);
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: "lookup failed" }) };
      }
      if (!data) return { statusCode: 404, body: JSON.stringify({ ok: false, error: "Invalid token" }) };

      // Upgrade request from the portal — record it WITHOUT touching intake, so the
      // owner gets a live alert (data.upgradeRequest drives getAlerts / notifCount).
      if (typeof body.upgrade === "string" && body.upgrade.trim()) {
        const upgData = { ...data.data, upgradeRequest: clip(body.upgrade, 120) };
        const { error: upgErr } = await supabaseAdmin.from("clients").update({ data: upgData, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (upgErr) { console.error("Portal upgrade save failed:", upgErr); return { statusCode: 500, body: JSON.stringify({ ok: false, error: "save failed" }) }; }
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
      }

      const nextData = { ...mergeFields(data.data, sanitizeFields(body.fields)), intakeComplete: true };
      const { error: updateError } = await supabaseAdmin.from("clients").update({ data: nextData, updated_at: new Date().toISOString() }).eq("id", data.id);
      if (updateError) {
        console.error("Portal save failed:", updateError);
        return { statusCode: 500, body: JSON.stringify({ ok: false, error: "save failed" }) };
      }
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error("Portal save error:", err);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: "save failed" }) };
    }
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

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
