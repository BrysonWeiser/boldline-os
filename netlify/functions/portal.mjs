import { createClient } from "@supabase/supabase-js";
import { makeContractHTML } from "../lib/contract-shared.cjs";
import { withLambda } from "../lib/lambda-adapter.mjs";

const SUPABASE_URL = "https://ahcrpxuwdyrxlethpdns.supabase.co";

const MIN_AD_BUDGET   = 500;   // hard floor to be a managed client at all
const COMBO_MIN_BUDGET = 5000; // below this, one platform only
// Hand-off ranks BELOW Launch: it is the entry point, and every managed tier is a
// step up from it.
const TIER_RANK = { handoff: 0, launch: 1, growth: 2, acquisition: 3 };

const PACKAGES_DB = {
  google: [
    { id:"g-launch",      name:"Launch System",      platform:"Google Ads",    price:400,  setup:750,  leadFee:true, pricingModel:"per_lead", tier:"launch",      minBudget:500,   maxBudget:2500,  tag:"",            adSpend:"$500–$2,500/mo",   optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:true, multiCampaign:false },
    { id:"g-growth",      name:"Growth System",      platform:"Google Ads",    price:700,  setup:1500, leadFee:true, pricingModel:"per_lead", tier:"growth",      minBudget:2500,  maxBudget:10000, tag:"Most Popular", adSpend:"$2,500–$10,000/mo", optimizationFreq:"weekly",  callTracking:true,  weeklyOptimization:true,  customLandingPage:true,  retargeting:false, splitTesting:false, crmIntegration:true,  multiCampaign:false },
    { id:"g-acquisition", name:"Acquisition System", platform:"Google Ads",    price:1200, setup:3000, leadFee:true, pricingModel:"per_lead", tier:"acquisition", minBudget:10000, maxBudget:null,  tag:"",            adSpend:"$10,000+/mo",      optimizationFreq:"weekly",  callTracking:true,  weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:true,  multiCampaign:true  },
  ],
  meta: [
    { id:"m-launch",      name:"Launch System",      platform:"Meta Ads",      price:400,  setup:750,  leadFee:true, pricingModel:"per_lead", tier:"launch",      minBudget:500,   maxBudget:2500,  tag:"",            adSpend:"$500–$2,500/mo",   optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:true, multiCampaign:false },
    { id:"m-growth",      name:"Growth System",      platform:"Meta Ads",      price:700,  setup:1500, leadFee:true, pricingModel:"per_lead", tier:"growth",      minBudget:2500,  maxBudget:10000, tag:"Most Popular", adSpend:"$2,500–$10,000/mo", optimizationFreq:"weekly",  callTracking:false, weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:true, multiCampaign:false },
    { id:"m-acquisition", name:"Acquisition System", platform:"Meta Ads",      price:1200, setup:3000, leadFee:true, pricingModel:"per_lead", tier:"acquisition", minBudget:10000, maxBudget:null,  tag:"",            adSpend:"$10,000+/mo",      optimizationFreq:"weekly",  callTracking:false, weeklyOptimization:true,  customLandingPage:true,  retargeting:true,  splitTesting:true,  crmIntegration:true, multiCampaign:true  },
  ],
  // No combined Launch tier on purpose — see rule 3 above. Combined costs MORE to
  // build (two campaign sets) but carries the SAME monthly minimum as one platform
  // at the same tier, which is the whole point of rule 2.
  combined: [
    { id:"c-growth", name:"Full System — Growth", platform:"Google + Meta", price:700,  setup:2300, leadFee:true, pricingModel:"per_lead", tier:"growth",      minBudget:5000,  maxBudget:10000, tag:"Best Value",    adSpend:"$5,000–$10,000/mo", optimizationFreq:"weekly", callTracking:true, weeklyOptimization:true, customLandingPage:true, retargeting:true, splitTesting:true, crmIntegration:true, multiCampaign:true, savings:"Both channels, same monthly minimum" },
    { id:"c-acquisition", name:"Full System — Acquisition", platform:"Google + Meta", price:1200, setup:4900, leadFee:true, pricingModel:"per_lead", tier:"acquisition", minBudget:10000, maxBudget:null, tag:"Most Powerful", adSpend:"$10,000+/mo", optimizationFreq:"weekly", callTracking:true, weeklyOptimization:true, customLandingPage:true, retargeting:true, splitTesting:true, crmIntegration:true, multiCampaign:true, savings:"Both channels, same monthly minimum" },
  ],
  // E-commerce cannot use per-lead pricing: there is no lead, there is a sale, and it
  // happens without BoldLine touching it. So the performance half is a % of ad spend.
  // The old ROAS bonus is gone — it was a second fee stacked on a retainer, which is
  // the exact thing this rewrite removes. Store Growth is Meta-only because adding
  // Google Shopping below COMBO_MIN_BUDGET splits a budget that cannot afford it.
  ecom: [
    { id:"e-launch",     name:"Store Launch",     platform:"Meta Ads",      price:400,  setup:800,  leadFee:false, pricingModel:"ad_spend_pct", adSpendPct:15, tier:"launch",      minBudget:500,   maxBudget:2500,  tag:"",            adSpend:"$500–$2,500/mo",   optimizationFreq:"monthly", callTracking:false, weeklyOptimization:false, customLandingPage:false, retargeting:false, splitTesting:false, crmIntegration:false, multiCampaign:false },
    { id:"e-growth",     name:"Store Growth",     platform:"Meta Ads",      price:700,  setup:1400, leadFee:false, pricingModel:"ad_spend_pct", adSpendPct:15, tier:"growth",      minBudget:2500,  maxBudget:10000, tag:"Recommended", adSpend:"$2,500–$10,000/mo", optimizationFreq:"weekly", callTracking:false, weeklyOptimization:true, customLandingPage:true, retargeting:true, splitTesting:true, crmIntegration:false, multiCampaign:false },
    { id:"e-domination", name:"Store Domination", platform:"Meta + Google", price:1200, setup:2500, leadFee:false, pricingModel:"ad_spend_pct", adSpendPct:12, tier:"acquisition", minBudget:10000, maxBudget:null,  tag:"",            adSpend:"$10,000+/mo",      optimizationFreq:"weekly", callTracking:false, weeklyOptimization:true, customLandingPage:true, retargeting:true, splitTesting:true, crmIntegration:false, multiCampaign:true },
  ],
  // ─── ONE-TIME BUILD, NO MANAGEMENT ────────────────────────────────────────
  // Bryson, 2026-08-18: "build the hand off and properly price it."
  //
  // The honest answer for a business below MIN_AD_BUDGET, or one that wants the build
  // without the monthly. Stencil & Thread was exactly this prospect: willing to pay for
  // the work, unwilling to pay a fee bigger than his ad budget every month. Turning that
  // away is turning away cash and a future managed client.
  //
  // PRICED AT $1,500 for three reasons, in order:
  //  1. It must not undercut managed. Managed Launch across its 3-month minimum is
  //     $750 setup + 3 x $400 = $1,950, so hand-off is genuinely the cheaper door while
  //     buying strictly less: no ongoing management at all.
  //  2. It is ABOVE the $750 managed setup on purpose. That setup fee is deliberately
  //     underpriced because it buys a recurring client. With no recurring revenue behind
  //     it, the build has to pay for itself.
  //  3. A one-time campaign + landing page build from an agency runs $1,500-$3,500.
  //     This sits at the honest bottom of that range.
  //
  // `price: 0` because there IS no monthly — not because it is free. Every surface that
  // quotes a price checks `pricingModel` first.
  handoff: [
    { id:"h-handoff", name:"Launch & Hand Off", platform:"Google Ads", price:0, setup:1500, leadFee:false, pricingModel:"one_time", tier:"handoff", minBudget:0, maxBudget:null, tag:"One-Time Build", adSpend:"Any budget", optimizationFreq:"none", callTracking:true, weeklyOptimization:false, customLandingPage:true, retargeting:false, splitTesting:false, crmIntegration:true, multiCampaign:false, savings:"Setup waived if you move to managed within 6 months" },
  ],
};
const ALL_PKGS = Object.values(PACKAGES_DB).flat();

// ─── THE ONE BILLING CALCULATION ─────────────────────────────────────────────
// "Whichever is more" — the floor or what the month actually earned. Every surface
// that quotes a number (deal prep, the billing card, the contract, the portal, the
// marketing site) runs this, so none of them can disagree with the invoice.
const calcMonthlyBill = (pkg, { qualifiedLeads = 0, perLeadFee = 0, adSpend = 0 } = {}) => {
  if (!pkg) return { floor:0, earned:0, billed:0, atFloor:false, model:"none", basis:"" };
  // A one-time build has no monthly side at all. Returning a zero floor rather than
  // falling through matters: `atFloor` false stops the billing card telling the owner a
  // hand-off client is "under the minimum" every month forever.
  if (pkg.pricingModel === "one_time")
    return { floor:0, earned:0, billed:0, atFloor:false, model:"one_time",
             basis:`one-time build, $${Number(pkg.setup||0).toLocaleString()}` };
  const floor = Number(pkg.price) || 0;
  const pctModel = pkg.pricingModel === "ad_spend_pct";
  const pct = Number(pkg.adSpendPct) || 0;
  const spend = Number(adSpend) || 0;
  const leads = Number(qualifiedLeads) || 0;
  const fee = Number(perLeadFee) || 0;
  const earned = pctModel ? Math.round((spend * pct) / 100) : Math.round(leads * fee);
  return {
    floor, earned, billed: Math.max(floor, earned), atFloor: earned < floor,
    model: pctModel ? "ad_spend_pct" : "per_lead",
    basis: pctModel ? `${pct}% of $${spend.toLocaleString()} ad spend`
                    : `${leads} qualified lead${leads === 1 ? "" : "s"} × $${fee}`,
  };
};
// How heavy the bill is against what they spend on ads — the number Stencil ran and
// BoldLine did not. Shown wherever a deal is priced so a lopsided one is visible.
const feeAsPctOfSpend = (billed, adSpend) => {
  const s = Number(adSpend) || 0;
  return s > 0 ? Math.round((Number(billed) || 0) / s * 100) : null;
};

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
  { id:"crm_integration", label:"Leads sent straight to your CRM", category:"Both" },
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
  // Renamed 2026-08-17 (Bryson: "yea rename it"). This used to read "Priority Support +
  // Slack Access" and was the only sold feature naming a tool that does not exist — there is
  // no BoldLine Slack workspace. The id stays `slack_access` because feature ids are never
  // persisted per client (clients store packageId only), so renaming it would be churn for
  // nothing. Distinct from `priority_comms` below, and no single client ever sees both:
  // this one is e-commerce only, that one is lead-gen only, and upgrade ladders never cross.
  { id:"slack_access",    label:"Priority Support (same day replies)", category:"Both" },
  { id:"handover_docs",   label:"Written Handover Playbook + Training Call", category:"Both" },
  { id:"settle_in",       label:"30-Day Settle-In (two optimization passes)",category:"Both" },
  { id:"scaling_roadmap", label:"Strategic Scaling Roadmap",        category:"Both" },
  { id:"priority_comms",  label:"Priority Communication",           category:"Both" },
  { id:"advanced_reporting",label:"Advanced Reporting Dashboard",   category:"Both" },
  { id:"unified_reporting",label:"Unified Cross-Channel Reporting", category:"Both" },
  { id:"cross_retargeting",label:"Cross-Channel Retargeting",       category:"Both" },
];

const PKG_FEATURES = {
  "g-launch":      ["search_ads","keyword_research","ad_variations","std_landing","lead_form","crm_integration","monthly_report","monthly_opt"],
  "g-growth":      ["search_ads","keyword_research","ad_variations","custom_landing","lead_form","call_tracking","weekly_opt","competitor_research","crm_integration","advanced_targeting","advanced_reporting","monthly_report"],
  "g-acquisition": ["search_ads","keyword_research","ad_variations","custom_landing","lead_form","call_tracking","weekly_opt","competitor_research","crm_integration","advanced_targeting","retargeting","split_testing","multi_campaign","advanced_reporting","monthly_report","scaling_roadmap","priority_comms"],
  "m-launch":      ["meta_ads","ad_variations","std_landing","lead_form","crm_integration","pixel","monthly_report","monthly_opt"],
  "m-growth":      ["meta_ads","ad_variations","custom_landing","lead_form","crm_integration","pixel","weekly_opt","retargeting","lookalike","split_testing","advanced_reporting","monthly_report"],
  "m-acquisition": ["meta_ads","ad_variations","custom_landing","lead_form","crm_integration","pixel","weekly_opt","retargeting","lookalike","split_testing","multi_campaign","full_funnel","advanced_reporting","monthly_report","scaling_roadmap","priority_comms"],
  "c-growth":      ["search_ads","meta_ads","keyword_research","ad_variations","custom_landing","lead_form","pixel","call_tracking","weekly_opt","competitor_research","crm_integration","retargeting","cross_retargeting","lookalike","advanced_targeting","split_testing","multi_campaign","unified_reporting","advanced_reporting","monthly_report"],
  "c-acquisition": ["search_ads","meta_ads","keyword_research","ad_variations","custom_landing","lead_form","pixel","call_tracking","weekly_opt","competitor_research","crm_integration","advanced_targeting","retargeting","cross_retargeting","lookalike","split_testing","multi_campaign","full_funnel","scaling_roadmap","priority_comms","unified_reporting","advanced_reporting","monthly_report"],
  // One-time build: the good build minus everything ongoing. Keep in step with index.html.
  "h-handoff":     ["search_ads","keyword_research","competitor_research","ad_variations","custom_landing","lead_form","crm_integration","call_tracking","handover_docs","settle_in"],
  "e-launch":      ["meta_ads","ad_variations","pixel","monthly_report","monthly_opt"],
  // Meta-only below $10k of ad budget — Google Shopping would split a budget that
  // cannot afford two platforms. Keep in step with index.html.
  "e-growth":      ["meta_ads","ad_variations","custom_landing","pixel","weekly_opt","retargeting","lookalike","split_testing","abandoned_cart","advanced_reporting","monthly_report"],
  "e-domination":  ["meta_ads","google_shopping","ad_variations","custom_landing","pixel","weekly_opt","retargeting","lookalike","split_testing","multi_campaign","abandoned_cart","full_funnel","ugc_consulting","crm_input","page_cro","strategy_calls","slack_access","advanced_reporting","monthly_report"],
};
const pkgHasFeature = (pkgId, featureId) => (PKG_FEATURES[pkgId] || []).includes(featureId);

// Family-scoped upgrade ladders — keep in step with index.html's copy of this.
// The old `platform` string matching leaked across product lines ("Meta + Google"
// contains "Google"), so the portal offered a lead-gen client on c-growth exactly
// one upgrade: "Store Domination", an e-commerce package. E-commerce and lead gen
// never cross-sell, and a combined client is never offered a single-platform
// package that would drop a channel they already pay for.
const PKG_FAMILY = (id) => String(id || "").split("-")[0];
// `h` moves onto any managed lead-gen plan; nothing ever upgrades INTO a hand-off.
const UPGRADE_FAMILIES = { g: ["g","c"], m: ["m","c"], c: ["c"], e: ["e"], h: ["g","m","c"] };

// An upgrade must never take something away — this is the surface where it matters most,
// because the portal shows the client only what an upgrade GAINS. Offering a package that
// quietly drops their call tracking would be a misrepresentation. Two features are
// replaced by a better version rather than lost; everything else lost is really lost.
// Keep in step with index.html's copy of this.
const FEATURE_SUPERSEDES = {
  custom_landing: ["std_landing"],
  weekly_opt:     ["monthly_opt"],
};
const coversFeature = (targetFeats, feat) =>
  targetFeats.indexOf(feat) >= 0 ||
  targetFeats.some((t) => (FEATURE_SUPERSEDES[t] || []).indexOf(feat) >= 0);
const keepsEverything = (fromId, toId) => {
  const to = PKG_FEATURES[toId] || [];
  return (PKG_FEATURES[fromId] || []).every((f) => coversFeature(to, f));
};

const getUpgradeOptions = (currentPkgId) => {
  const cur = findPkg(currentPkgId);
  if (!cur) return [];
  const allowed = UPGRADE_FAMILIES[PKG_FAMILY(currentPkgId)] || [];
  const curFeats = PKG_FEATURES[currentPkgId] || [];
  // Everything in a hand-off is a one-time deliverable the client already owns, so no
  // managed plan can take it away and the ongoing-entitlement rule must not apply.
  // Keep in step with index.html.
  const oneTimeSource = cur.pricingModel === "one_time";
  // Ranked by TIER, not price: a single platform and the combined system share a
  // monthly minimum at the same tier, so `p.price > cur.price` would hide the best
  // upsell there is (same minimum, one more channel). Keep in step with index.html.
  return ALL_PKGS.filter((p) =>
    p.id !== currentPkgId &&
    (oneTimeSource || (TIER_RANK[p.tier] || 0) >= (TIER_RANK[cur.tier] || 0)) &&
    allowed.includes(PKG_FAMILY(p.id)) &&
    (oneTimeSource || keepsEverything(currentPkgId, p.id)) &&
    (PKG_FEATURES[p.id] || []).some((f) => curFeats.indexOf(f) < 0)
  ).sort((a, b) => (TIER_RANK[a.tier]||0) - (TIER_RANK[b.tier]||0) || a.price - b.price || a.setup - b.setup);
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

const makePortalHTML = (cl, pkg, notice) => {
  // 🔴 A CLIENT WHO FINISHES ON STRIPE HAS TO BE TOLD IT WORKED. Before this they were
  // returned to the OS, an admin login they cannot use, so a completed action read as a
  // failure. Landing back on their own portal is only half the fix; the other half is
  // saying, in words, what just happened.
  const noticeHTML = notice === "card"
    ? '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.07)"><div style="font-size:13px;font-weight:700;color:#10B981;margin-bottom:4px">Your card is saved</div><div style="font-size:11.5px;color:#9CA3AF;line-height:1.65">Nothing has been charged. You are only billed for qualified leads we deliver, and you will receive an invoice by email each time.</div></div>'
    : notice === "success"
    ? '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.07)"><div style="font-size:13px;font-weight:700;color:#10B981;margin-bottom:4px">Payment set up</div><div style="font-size:11.5px;color:#9CA3AF;line-height:1.65">Thank you. Your billing is active and a receipt is on its way to your email.</div></div>'
    : notice === "cancel"
    ? '<div class="card" style="border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.07)"><div style="font-size:13px;font-weight:700;color:#F59E0B;margin-bottom:4px">Nothing was saved</div><div style="font-size:11.5px;color:#9CA3AF;line-height:1.65">You closed the payment page before finishing. Nothing has been charged. Ask your account manager to resend the link whenever you are ready.</div></div>'
    : "";

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
  const RECOMMENDED_ASSETS = ["Your logo", "3 to 5 strong photos of your work, product, or space", "A short video, even phone footage works great", "2 to 3 of your best customer reviews or quotes", "Before/after photos, if that fits your business"];

  const stageRows = STAGES.map((s, i) => {
    const tag = i < si ? "Done" : i === si ? "In Progress" : "Upcoming";
    const dot = i <= si ? SC[i] : "#374151";
    const tagColor = i < si ? "#6B7280" : i === si ? SC[i] : "#374151";
    return `<details class="stage-row"><summary class="stage-btn"><span class="stage-dot" style="background:${dot}"></span><span class="stage-name">${SL[i]}</span><span class="stage-tag" style="color:${tagColor}">${tag}</span></summary><div class="stage-desc">${SD[i]}</div></details>`;
  }).join("");
  const trackerHTML = STAGES.map((s, i) => '<div class="tk ' + (i < si ? "tk-done" : i === si ? "tk-cur" : "tk-up") + '"><span class="tk-dot"></span></div>').join("");
  const pf = STAGES.length > 1 ? (Math.max(si, 0) / (STAGES.length - 1)).toFixed(3) : "0";
  const fHTML = inclFeats.map((f) => '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#9CA3AF;display:flex;align-items:center;gap:8px"><span style="color:#C8A84B;font-weight:700">✓</span>' + f.label + "</div>").join("");
  const uHTML = exclFeats.slice(0, 8).map((f) => '<div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#374151;display:flex;align-items:center;gap:8px"><span>○</span>' + f.label + '<span style="margin-left:auto;font-size:9px;padding:1px 6px;border-radius:20px;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);color:#C8A84B">As you scale</span></div>').join("");
  // ── Upgrades ────────────────────────────────────────────────────────────────
  // 🔴 A TIER IS UNLOCKED BY AD BUDGET, NOT CHOSEN FROM A MENU. This section used to show
  // a flat "$700/mo" next to every option, which was wrong twice over: that figure is a
  // monthly MINIMUM the performance fee counts toward, not a price, and a client on $500 a
  // month of ad spend cannot move to Growth at all until their budget reaches $2,500.
  // Offering an upgrade someone does not qualify for, at a number they would never pay, is
  // how a portal turns into a complaint. Bryson caught it 2026-08-26.
  const budgetOf = (v) => {
    const n = Number(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const curBudget  = budgetOf(cl.adBudget);
  const perLeadNow = cl.billingPerLead != null ? Number(cl.billingPerLead) : (pl || 0);
  const usd = (n) => "$" + Number(n || 0).toLocaleString();

  const upgSection = upgOpts.length === 0 ? "" :
    '<div class="card" id="upgrade-section"><div class="lbl">Ready to Scale</div>' +
    '<div style="font-size:11.5px;color:#9CA3AF;line-height:1.65;margin-bottom:6px">Your plan is set by your <strong style="color:#F0F2FF">monthly ad budget</strong>, not chosen from a list. Raise the budget and the next tier unlocks, along with everything in it.</div>' +
    '<div style="font-size:11px;color:#6B7280;line-height:1.65;margin-bottom:12px">Each figure below is a <strong style="color:#9CA3AF">monthly minimum</strong>, not an added fee. You pay that minimum or your per-lead total, <strong style="color:#9CA3AF">whichever is higher, never both</strong>. Ad spend is paid by you directly to Google and Meta and is never part of it.</div>' +
    (curBudget > 0
      ? '<div style="font-size:11px;color:#6B7280;margin-bottom:12px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">Your current ad budget: <strong style="color:#C8A84B">' + usd(curBudget) + '/mo</strong></div>'
      : '<div style="font-size:11px;color:#6B7280;margin-bottom:12px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)">Tell us your monthly ad budget in My Info and we can show you exactly which tiers are open to you.</div>') +
    upgOpts.map((p, i) => {
      const newFeats = ALL_FEATURES.filter((f) => pkgHasFeature(p.id, f.id) && !pkgHasFeature(cl.packageId, f.id));
      const shown = newFeats.slice(0, 6);
      const extra = newFeats.length - shown.length;
      const featHTML = shown.length ? `<div class="uopt-feats-top">What you'll add</div><div class="uopt-feats">${shown.map((f) => `<span class="uopt-feat">+ ${f.label}</span>`).join("")}${extra > 0 ? `<span class="uopt-feat uopt-more">+${extra} more</span>` : ""}</div>` : "";

      // Combined packages need BOTH the tier floor and the two-platform unlock, and the
      // higher of the two is the real requirement. Saying only the tier floor would set up
      // a client to raise their budget and still be told no.
      const isCombo = /google/i.test(p.platform || "") && /meta/i.test(p.platform || "");
      const needed  = Math.max(Number(p.minBudget) || 0, isCombo ? COMBO_MIN_BUDGET : 0);
      const qualifies = curBudget > 0 && curBudget >= needed;
      const shortfall = Math.max(0, needed - curBudget);

      const qualHTML = needed > 0
        ? (curBudget <= 0
            ? `<div class="uopt-qual">Unlocks at <strong>${usd(needed)}/mo</strong> of ad budget</div>`
            : qualifies
              ? `<div class="uopt-qual uopt-qual-yes">You qualify. Your ${usd(curBudget)} budget meets the ${usd(needed)} needed</div>`
              : `<div class="uopt-qual">Unlocks at <strong>${usd(needed)}/mo</strong> of ad budget. That is ${usd(shortfall)}/mo more than you run today</div>`)
        : "";

      const feeHTML = `<div class="uopt-fee">${usd(p.price)}<span class="uopt-fee-sub">/mo minimum</span>`
        + (perLeadNow > 0 ? `<div class="uopt-fee-alt">or ${usd(perLeadNow)} per qualified lead, whichever is higher</div>` : "")
        + (Number(p.setup) > 0 ? `<div class="uopt-fee-alt">${usd(p.setup)} one-time build</div>` : "")
        + `</div>`;

      // A locked option stays visible and readable, because knowing what the next step costs
      // is the point of showing it, but it cannot be selected.
      return `<div class="uopt${qualifies ? "" : " uopt-locked"}" id="u${i}" data-name="${p.name} (${p.platform}) ${usd(p.price)}/mo minimum"${qualifies ? ` onclick="selUpg(this,${i})"` : ""}><div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:13px;font-weight:700;color:#F0F2FF">${p.name}</div><div style="font-size:10px;color:#6B7280">${p.platform}</div></div>${feeHTML}</div>${qualHTML}${featHTML}</div>`;
    }).join("") +
    '<div style="font-size:10.5px;color:#4B5563;line-height:1.6;margin-top:10px">Ready to raise your budget? Mention it on your next check-in and we will walk through whether the extra spend is worth it in your market before anything changes.</div>' +
    '<div id="upg-action"><button class="btn" id="upgbtn" disabled onclick="askUpg()" style="opacity:.4">Ask About Scaling Up</button></div></div>';
  const contractAlert = (dL <= 30 && dL >= 0) ? '<div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);font-size:11px;color:#F59E0B">Contract renewing in ' + dL + " days. Your account manager will be in touch.</div>" : "";
  const reportSection = cl.latestReport && cl.latestReport.text
    ? '<div class="card"><div class="lbl">' + (cl.latestReport.period === "monthly" ? "Monthly" : "Weekly") + ' Performance Report</div><div style="font-size:10px;color:#6B7280;margin-bottom:12px">Sent ' + new Date(cl.latestReport.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + "</div>" + reportTextToHTML(cl.latestReport.text) + "</div>"
    : '<div class="card"><div class="lbl">Performance Reports</div><div style="font-size:12px;color:#6B7280;line-height:1.6">Your first performance report will appear here once it\'s sent.</div></div>';
  // Connect Your Ad Accounts — shown ONLY for the platform(s) this client's package runs.
  const hasGoogle = /google/i.test((pkg && pkg.platform) || "");
  const hasMeta = /meta|facebook|instagram/i.test((pkg && pkg.platform) || "");
  const gVid = process.env.GOOGLE_CONNECT_VIDEO || "";
  const mVid = process.env.META_CONNECT_VIDEO || "";
  const mBiz = process.env.META_BUSINESS_ID || "";
  // Optional embedded video if a URL is ever set; otherwise nothing (the written
  // steps + the AI helper below replace the walkthrough video — no "coming soon"
  // placeholder to make a promise we're not keeping).
  const videoBox = (url, label) => url
    ? `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:10px;overflow:hidden;margin-bottom:12px;background:#000"><iframe src="${esc(url)}" title="${esc(label)}" allow="fullscreen" style="position:absolute;inset:0;width:100%;height:100%;border:none"></iframe></div>`
    : "";
  const olS = "margin:2px 0 10px;padding-left:18px;color:#9CA3AF;font-size:11.5px;line-height:1.9";
  const googleConnect = hasGoogle ? `<div class="card"><div class="lbl" style="color:#C8A84B;font-size:11px">Connect Your Google Ads</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:12px;line-height:1.6">So we can run and manage your Google Ads, we need your <b style="color:#E5E7EB">Customer ID</b> and manager access. You always own the account and pay Google directly. We only manage it.</div>${videoBox(gVid, "How to connect Google Ads")}<ol style="${olS}"><li>Sign in at <b>ads.google.com</b>. No account yet? Tell us and we'll set one up with you.</li><li>Find your <b>Customer ID</b>: top-right corner, a 10-digit number like <b>123-456-7890</b>.</li><li><b>Add a payment method</b> if you haven't yet: <b>Billing → Payments → Add payment method</b>. You pay Google directly for ad spend. We never hold or touch it.</li><li>Enter your Customer ID below and tap <b>Save</b>.</li><li>We'll send a <b>manager link request</b>. Approve it under <b>Admin → Access and security → Managers</b>.</li></ol><input class="inp" data-key="googleAdsCustomerId" placeholder="Google Ads Customer ID (123-456-7890)" value="${esc(cl.googleAdsCustomerId || "")}"></div>` : "";
  const metaConnect = hasMeta ? `<div class="card"><div class="lbl" style="color:#C8A84B;font-size:11px">Connect Your Facebook &amp; Instagram Ads</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:12px;line-height:1.6">So we can run and manage your Meta ads, we need your <b style="color:#E5E7EB">Ad Account ID</b>, your <b style="color:#E5E7EB">Facebook Page ID</b>, and partner access. You always own the account and pay Meta directly. We only manage it.</div>${videoBox(mVid, "How to connect Meta Ads")}<ol style="${olS}"><li>Go to <b>business.facebook.com</b> → <b>Settings</b>.</li><li><b>Ad Account ID:</b> Accounts → Ad accounts → your account → copy the number (digits only).</li><li><b>Page ID:</b> Accounts → Pages → your Page → copy the Page ID.</li><li><b>Add a payment method</b> to your ad account: <b>Billing → Payment settings → Add payment method</b>. You pay Meta directly for ad spend. We never hold or touch it.</li><li>For Instagram ads, make sure your <b>Instagram account is linked</b> to your Page: <b>Page → Settings → Linked accounts</b>.</li><li>Share access: <b>Partners → Add</b>${mBiz ? `, enter our Business ID <b>${esc(mBiz)}</b>` : ", enter the Business ID we give you"}, and share your ad account + Page as <b>Manage</b>.</li><li>Enter both IDs below and tap <b>Save</b>.</li></ol><input class="inp" data-key="metaAdAccountId" placeholder="Meta Ad Account ID (digits only)" value="${esc(cl.metaAdAccountId || "")}"><input class="inp" data-key="metaPageId" placeholder="Facebook Page ID" value="${esc(cl.metaPageId || "")}"></div>` : "";
  // Onboarding AI helper — a sandboxed chat (text + screenshot) that walks the
  // client through connecting their ad account. Shown only when there's a
  // platform to connect. Talks to netlify/functions/portal-assistant.
  const assistantWidget = (hasGoogle || hasMeta) ? `<div class="card"><div class="lbl" style="color:#C8A84B;font-size:11px">Stuck? Ask our AI Helper</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:10px;line-height:1.6">Not sure where to click? Ask a question or send a screenshot of your screen and we'll walk you through it, one step at a time.</div><div id="bl-help-thread" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div><div id="bl-help-img" style="display:none;font-size:10px;color:#C8A84B;margin-bottom:6px"></div><textarea id="bl-help-input" class="inp" rows="2" placeholder="Type your question…" style="resize:vertical;margin-bottom:6px"></textarea><div style="display:flex;gap:6px"><input type="file" id="bl-help-file" accept="image/*" style="display:none" onchange="blHelpPickImg(this)"><button type="button" class="btn" style="margin-top:0;width:auto;flex:0 0 auto;padding:10px 12px;font-size:11px" onclick="document.getElementById('bl-help-file').click()">Attach Screenshot</button><button type="button" class="btn" id="bl-help-send" style="margin-top:0;flex:1" onclick="blHelpSend()">Send</button></div></div>` : "";
  const connectSection = googleConnect + metaConnect + assistantWidget;

  const css = '*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#080A0F;color:#F9FAFB;font-size:14px}.hdr{background:#0D0F16;border-bottom:1px solid rgba(255,255,255,.08);padding:12px 16px;display:flex;align-items:center;gap:10px}.logo{width:30px;height:30px;object-fit:contain}.nav{display:flex;overflow-x:auto;background:#0D0F16;border-bottom:1px solid rgba(255,255,255,.07)}.nb{padding:11px 14px;font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border:none;background:transparent;color:#6B7280;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;font-family:inherit}.nb.on{color:#C8A84B;border-bottom-color:#C8A84B}.main{padding:14px;max-width:600px;margin:0 auto}.card{background:#0D0F16;border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:14px;margin-bottom:10px}.lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#4B5563;margin-bottom:8px}.stage-cur{padding:11px;border-radius:9px;background:rgba(200,168,75,.08);border:1px solid rgba(200,168,75,.2);margin-bottom:8px}.stage-cur-top{display:flex;align-items:center;gap:8px;margin-bottom:5px}.stage-cur-name{font-size:13px;font-weight:700}.stage-cur-desc{font-size:11px;color:#9CA3AF;line-height:1.6}.stage-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}.stage-tag{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-left:auto}.stage-list{margin-top:2px}.stage-toggle{padding:9px 4px;font-size:11px;font-weight:700;color:#9CA3AF;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:center;gap:6px;border-top:1px solid rgba(255,255,255,.06);margin-top:4px}.stage-toggle::-webkit-details-marker{display:none}.stage-toggle::after{content:"▾";font-size:9px}.stage-list[open]>.stage-toggle::after{content:"▴"}.stage-row{border:1px solid rgba(255,255,255,.06);border-radius:8px;margin-top:6px}.stage-btn{padding:9px 10px;font-size:12px;font-weight:600;color:#E5E7EB;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px}.stage-btn::-webkit-details-marker{display:none}.stage-btn::after{content:"▾";font-size:9px;color:#6B7280;margin-left:4px}.stage-row[open]>.stage-btn::after{content:"▴"}.stage-desc{padding:0 10px 10px 26px;font-size:11px;color:#9CA3AF;line-height:1.6}.stat{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:9px 11px;flex:1}.inp{width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:#F9FAFB;font-size:13px;font-family:inherit;margin-bottom:8px}.btn{width:100%;padding:12px;font-size:13px;font-weight:700;border-radius:10px;border:1px solid rgba(200,168,75,.35);background:rgba(200,168,75,.1);color:#C8A84B;cursor:pointer;font-family:inherit;margin-top:10px}.uopt{padding:12px;border-radius:10px;border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);cursor:pointer;margin-bottom:8px}.uopt.sel{border-color:#C8A84B;background:rgba(200,168,75,.07)}.uopt-feats-top{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06);margin-bottom:6px}.uopt-feats{display:flex;flex-wrap:wrap;gap:5px}.uopt-feat{font-size:10px;color:#9CA3AF;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:3px 9px;line-height:1.4}.uopt-more{color:#C8A84B;border-color:rgba(200,168,75,.2);background:rgba(200,168,75,.07)}.uopt-locked{cursor:default;opacity:.62;border-style:dashed}.uopt-locked:hover{border-color:rgba(255,255,255,.08)}.uopt-fee{text-align:right;flex-shrink:0;font-size:18px;font-weight:800;color:#C8A84B;line-height:1.15}.uopt-fee-sub{font-size:10px;font-weight:600;color:#6B7280;margin-left:2px}.uopt-fee-alt{font-size:9.5px;font-weight:500;color:#6B7280;line-height:1.5;margin-top:3px;max-width:190px;margin-left:auto}.uopt-qual{margin-top:9px;font-size:10.5px;line-height:1.55;color:#9CA3AF;padding:6px 9px;border-radius:7px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}.uopt-qual strong{color:#F0F2FF}.uopt-qual-yes{color:#7FAE95;background:rgba(127,174,149,.08);border-color:rgba(127,174,149,.22)}.uopt-qual-yes strong{color:#7FAE95}select{background:#0D0F16;color:#F9FAFB}option{background:#0D0F16;color:#F9FAFB}.reco-list{margin:0 0 12px;padding-left:18px;color:#9CA3AF;font-size:11px;line-height:1.8}.media-item{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px;color:#D1D5DB}.media-cat{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#C8A84B;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.2);border-radius:6px;padding:2px 6px;flex-shrink:0}.media-card{border:1px solid rgba(200,168,75,.4);background:rgba(200,168,75,.05)}.media-empty{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#F59E0B;font-size:11px;padding:9px 11px;border-radius:8px;margin-bottom:12px;line-height:1.6}.media-thumb{width:36px;height:36px;border-radius:7px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.06)}.media-thumb-vid{display:flex;align-items:center;justify-content:center;font-size:12px;color:#C8A84B}.media-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.media-del{flex-shrink:0;width:24px;height:24px;border-radius:7px;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.08);color:#EF4444;font-size:11px;cursor:pointer;font-family:inherit;line-height:1}.hdr,.nav,.main{position:relative;z-index:1}body{position:relative;min-height:100vh;overflow-x:hidden}.ambient{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}.topglow{position:fixed;top:-220px;left:50%;transform:translateX(-50%);width:760px;height:440px;max-width:150vw;background:radial-gradient(ellipse at center,rgba(200,168,75,.17),transparent 70%);z-index:0;pointer-events:none}.ambient .orb{position:absolute;border-radius:50%;filter:blur(55px);will-change:transform}.ambient .o1{width:440px;height:440px;top:-150px;left:-130px;background:radial-gradient(circle,rgba(200,168,75,.22),transparent 66%);animation:orbDrift 42s ease-in-out infinite alternate}.ambient .o2{width:380px;height:380px;top:36%;right:-150px;background:radial-gradient(circle,rgba(200,168,75,.14),transparent 66%);animation:orbDrift 56s ease-in-out -12s infinite alternate-reverse}.ambient .o3{width:420px;height:420px;bottom:-190px;left:14%;background:radial-gradient(circle,rgba(180,150,90,.17),transparent 64%);animation:orbDrift 68s ease-in-out -28s infinite alternate}@keyframes orbDrift{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(50px,-36px,0) scale(1.12)}100%{transform:translate3d(-44px,44px,0) scale(.94)}}.ambient .grain{position:absolute;inset:0;opacity:.04;background-size:170px 170px;background-image:url(\"data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'170\' height=\'170\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E\")}.card{position:relative;overflow:hidden;background:rgba(14,16,24,.5);backdrop-filter:blur(14px) saturate(1.25);-webkit-backdrop-filter:blur(14px) saturate(1.25);transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}.card::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(200,168,75,.4),transparent)}.card:hover{transform:translateY(-2px);border-color:rgba(200,168,75,.28);box-shadow:0 20px 46px -26px rgba(0,0,0,.9)}.hdr{background:rgba(13,15,22,.72);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.nav{background:rgba(13,15,22,.64);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}.welcome{margin:6px 2px 16px}.welcome b{display:block;font-size:19px;font-weight:800;color:#F5F3ED;letter-spacing:-.01em}.welcome span{display:block;font-size:12px;color:#9CA3AF;margin-top:3px}.prog-hero{display:flex;align-items:center;gap:18px;padding:6px 2px 4px}.ring{position:relative;width:104px;height:104px;border-radius:50%;flex-shrink:0;background:conic-gradient(from -90deg,#C8A84B calc(var(--p,0)*1%),rgba(255,255,255,.06) 0);box-shadow:0 0 30px -8px rgba(200,168,75,.45);animation:ringGlow 3.6s ease-in-out infinite}.ring-in{position:absolute;inset:9px;border-radius:50%;background:#0B0D13;display:flex;flex-direction:column;align-items:center;justify-content:center}.ring-n{font-size:27px;font-weight:800;color:#F5F3ED;line-height:1}.ring-n span{font-size:13px;font-weight:600;color:#6B7280}.ring-l{font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9C8A5A;margin-top:3px}@keyframes ringGlow{0%,100%{box-shadow:0 0 24px -8px rgba(200,168,75,.4)}50%{box-shadow:0 0 36px -4px rgba(200,168,75,.72)}}.prog-info{flex:1;min-width:0}.prog-stage{display:flex;align-items:center;gap:8px;font-size:19px;font-weight:800;color:#F5F3ED;margin-bottom:3px;letter-spacing:-.01em}.prog-stage .d{width:9px;height:9px;border-radius:50%;flex-shrink:0}.prog-tag{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#C8A84B;margin-bottom:8px}.tracker{position:relative;display:flex;justify-content:space-between;align-items:center;margin:18px 6px 2px;padding:0 4px;height:16px}.tracker::before{content:"";position:absolute;left:8px;right:8px;top:50%;height:2px;background:rgba(255,255,255,.09);transform:translateY(-50%);border-radius:2px}.tracker::after{content:"";position:absolute;left:8px;top:50%;height:2px;width:calc((100% - 16px) * var(--pf,0));background:linear-gradient(90deg,#C8A84B,#E4CE93);transform:translateY(-50%);border-radius:2px;box-shadow:0 0 9px rgba(200,168,75,.55);transition:width 1.2s cubic-bezier(.2,.7,.2,1)}.tk{position:relative;z-index:1}.tk-dot{display:block;width:10px;height:10px;border-radius:50%;background:#2A2E3A;box-shadow:0 0 0 3px #0D0F16}.tk-done .tk-dot{background:#C8A84B}.tk-cur .tk-dot{width:14px;height:14px;background:#E4CE93;animation:tkPulse 2.4s ease-in-out infinite}@keyframes tkPulse{0%,100%{box-shadow:0 0 0 3px #0D0F16,0 0 0 5px rgba(200,168,75,.18),0 0 10px rgba(200,168,75,.5)}50%{box-shadow:0 0 0 3px #0D0F16,0 0 0 8px rgba(200,168,75,.04),0 0 18px rgba(200,168,75,.85)}}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.tab-anim>*{animation:fadeUp .42s ease both}.tab-anim>*:nth-child(2){animation-delay:.06s}.tab-anim>*:nth-child(3){animation-delay:.12s}.tab-anim>*:nth-child(4){animation-delay:.18s}.tab-anim>*:nth-child(5){animation-delay:.24s}@media (prefers-reduced-motion:reduce){.ambient .orb,.ring,.tab-anim>*{animation:none!important}.card{transition:none}}@media(min-width:960px){.cwide{width:min(94vw,980px);margin-left:calc((100% - min(94vw,980px))/2)}}';

  // ── Approvals ("Needs Your Review") — items the owner pushes for the client to
  //    approve (landing page, or anything). Client Approves / Requests Changes;
  //    decisions POST back and surface to the owner. A red badge shows the count.
  const approvals = Array.isArray(cl.approvals) ? cl.approvals : [];
  const pendingApprovals = approvals.filter((a) => a && a.status === "pending");
  const apCount = pendingApprovals.length;
  const apBadge = apCount ? ` <span style="display:inline-block;min-width:15px;height:15px;line-height:15px;padding:0 4px;border-radius:8px;background:#EF4444;color:#fff;font-size:9px;font-weight:800;text-align:center;vertical-align:top">${apCount}</span>` : "";
  const apPill = (s) => s === "approved"
    ? '<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#10B981;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:6px;padding:2px 7px;flex-shrink:0">✓ Approved</span>'
    : s === "changes"
    ? '<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#F59E0B;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:2px 7px;flex-shrink:0">Changes sent</span>'
    : '<span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#C8A84B;background:rgba(200,168,75,.1);border:1px solid rgba(200,168,75,.3);border-radius:6px;padding:2px 7px;flex-shrink:0">Needs review</span>';
  const apCardHTML = (a) => {
    const pending = a.status === "pending";
    const preview = a.previewUrl ? `<a href="${esc(a.previewUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:2px 0 12px;font-size:12px;font-weight:700;color:#C8A84B;text-decoration:none;border-bottom:1px solid rgba(200,168,75,.4)">${esc(a.kind === "landing_page" ? "Open your landing page" : "Open preview")} &#8599;</a><div style="font-size:10px;color:#6B7280;margin:-6px 0 12px">Opens in a new tab.</div>` : "";
    const actions = pending
      ? `<textarea id="apnote-${esc(a.id)}" class="inp" rows="2" placeholder="Optional note. Add this if you're requesting changes…" style="margin-top:4px"></textarea><div style="display:flex;gap:8px"><button class="btn" style="margin-top:0;flex:1;background:transparent;border-color:rgba(255,255,255,.15);color:#9CA3AF" onclick="decideApproval('${esc(a.id)}','changes',this)">Request Changes</button><button class="btn" style="margin-top:0;flex:1" onclick="decideApproval('${esc(a.id)}','approved',this)">✓ Approve</button></div>`
      : (a.note ? `<div style="font-size:11px;color:#9CA3AF;margin-top:6px;line-height:1.5">Your note: ${esc(a.note)}</div>` : "");
    return `<div class="card" id="ap-card-${esc(a.id)}"><div style="display:flex;align-items:center;gap:8px;margin-bottom:${a.body || preview ? "8px" : "0"}"><div style="font-size:14px;font-weight:700;color:#F5F3ED;flex:1;min-width:0">${esc(a.title || "Approval needed")}</div>${apPill(a.status)}</div>${a.body ? `<div style="font-size:12.5px;color:#C7CBD9;line-height:1.65;margin-bottom:12px">${esc(a.body).replace(/\n/g, "<br>")}</div>` : ""}${preview}${actions}</div>`;
  };
  const apOrder = { pending: 0, changes: 1, approved: 2 };
  const apPanel = approvals.length
    ? (apCount ? "" : '<div class="card"><div style="font-size:13px;color:#9CA3AF;line-height:1.6">You\'re all caught up. Nothing needs your review right now.</div></div>')
      + approvals.slice().sort((x, y) => (apOrder[x.status] ?? 3) - (apOrder[y.status] ?? 3)).map(apCardHTML).join("")
    : '<div class="card"><div style="font-size:13px;color:#9CA3AF;line-height:1.6">Nothing needs your review right now. When we have something for you, like your new landing page, it\'ll show up here for you to approve.</div></div>';

  return "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"><title>" + cl.name + " Portal</title><style>" + css + "</style></head><body>" + '<div class="topglow" aria-hidden="true"></div><div class="ambient" aria-hidden="true"><div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div><div class="grain"></div></div>'
    + '<div class="hdr"><img class="logo" src="/logo.png" alt="BoldLine Media"><div><div style="font-size:13px;font-weight:700;color:#E8E4D0">BoldLine Media</div><div style="font-size:9px;color:#6e6b54">Client Portal</div></div><div style="margin-left:auto;font-size:11px;color:#9CA3AF">' + cl.name + "</div></div>"
    + `<div class="nav"><button class="nb on" onclick="show('status',this)">Status</button><button class="nb" onclick="show('approvals',this)">Review${apBadge}</button><button class="nb" onclick="show('reports',this)">Reports</button><button class="nb" onclick="show('package',this)">My Package</button><button class="nb" onclick="show('intake',this)">My Info</button><button class="nb" onclick="show('contract',this)">Contract</button></div>`
    + '<div class="main">'
    + noticeHTML + `<div id="t-status"><div class="welcome"><b>Welcome back${firstName ? ", " + firstName : ""}</b><span>Here's where your campaign stands today.</span></div><div class="card"><div class="lbl">Campaign Progress</div><div class="prog-hero"><div class="ring" style="--p:${prog}"><div class="ring-in"><div class="ring-n">${si >= 0 ? si + 1 : "—"}<span>/${STAGES.length}</span></div><div class="ring-l">Stage</div></div></div><div class="prog-info"><div class="prog-stage"><span class="d" style="background:${scol}"></span>${SL[si] || "—"}</div><div class="prog-tag">In Progress</div><div class="stage-cur-desc">${SD[si] || "Your campaign status will appear here."}</div></div></div><div class="tracker" style="--pf:${pf}">${trackerHTML}</div><details class="stage-list"><summary class="stage-toggle">View all steps</summary>${stageRows}</details></div>`
    + '<div class="card"><div class="lbl">Your Campaign</div><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="stat"><div class="lbl">Package</div><div style="font-size:13px;font-weight:700;color:#E5E7EB">' + ((pkg && pkg.name) || "—") + '</div></div><div class="stat"><div class="lbl">Platform</div><div style="font-size:13px;font-weight:700;color:#E5E7EB">' + ((pkg && pkg.platform) || "—") + "</div></div>" + (pl ? '<div class="stat"><div class="lbl">Per Lead</div><div style="font-size:13px;font-weight:700;color:#C8A84B">$' + pl + "</div></div>" : "") + "</div></div></div>"
    + '<div id="t-approvals" style="display:none"><div class="welcome"><b>Needs Your Review</b><span>Approve what we\'ve prepared, or ask for changes. Nothing goes live without your OK.</span></div>' + apPanel + "</div>"
    + '<div id="t-reports" style="display:none">' + reportSection + "</div>"
    + '<div id="t-package" style="display:none"><div class="card"><div class="lbl">Your Package: ' + ((pkg && pkg.name) || "—") + '</div><div style="font-size:11px;color:#C8A84B;margin-bottom:12px">' + ((pkg && pkg.platform) || "") + (pkg ? " · $" + pkg.price + "/mo" : "") + "</div>" + fHTML + (exclFeats.length > 0 ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06)"><div class="lbl">Unlocks As You Scale</div>' + uHTML + "</div>" : "") + "</div>" + upgSection + "</div>"
    + `<div id="t-intake" style="display:none">`
    + `<div class="card"><div class="lbl">Business Details</div><input class="inp" data-key="contactName" placeholder="Contact Name" value="${esc(cl.contactName || "")}"><input class="inp" data-key="email" placeholder="Email" value="${esc(cl.email || "")}"><input class="inp" data-key="businessPhone" placeholder="Business phone number (for call forwarding)" value="${esc(cl.businessPhone || "")}"><input class="inp" data-key="businessAddress" placeholder="Business Address" value="${esc(cl.businessAddress || "")}"><input class="inp" data-key="campaignSetup.serviceArea" placeholder="Service Area" value="${esc(cs.serviceArea || "")}"></div>`
    + connectSection
    + `<div class="card media-card"><div class="lbl" style="color:#C8A84B;font-size:11px">Your Photos &amp; Video</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:10px;line-height:1.6">This is the media we'll use in your ads and landing page. Add your logo, photos, and a short video so everything looks like you. Files upload as soon as you tap Upload (no need to press Save).</div>${mediaItems.length ? "" : '<div class="media-empty" id="media-empty">No media from you yet. Add your photos, logo, or a short video below so we can start building your ads.</div>'}<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-bottom:6px">Worth adding, if you have them</div><ul class="reco-list">${RECOMMENDED_ASSETS.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin:4px 0 6px">What are you uploading?</div><select class="inp" id="media-cat"><option value="photo">Photo</option><option value="logo">Logo</option><option value="video">Video</option><option value="review">Review / testimonial</option></select><input class="inp" type="file" id="media-file" accept="image/*,video/*" onchange="autoCat(this)"><button class="btn" id="media-upload-btn" onclick="uploadMedia(this)">Upload File</button><div id="media-status" style="font-size:11px;color:#6B7280;margin-top:6px"></div><div id="media-list" style="margin-top:10px">${mediaItems.length ? mediaItems.map((m) => `<div class="media-item" data-path="${esc(m.path)}">${m.category === "video" ? '<span class="media-thumb media-thumb-vid">▶</span>' : `<img class="media-thumb" src="${esc(m.url)}" alt="">`}<span class="media-cat">${esc(m.category)}</span><span class="media-name">${esc(m.label)}</span><button class="media-del" onclick="delMedia(this)" title="Remove">✕</button></div>`).join("") : '<div style="font-size:11px;color:#6B7280">No files uploaded yet.</div>'}</div></div>`
    + `<div class="card"><div class="lbl">Campaign Setup</div><input class="inp" data-key="adBudget" placeholder="Monthly Ad Budget (e.g. $2,500/mo)" value="${esc(cl.adBudget || "")}"><input class="inp" data-key="campaignSetup.mainOffer" placeholder="Main service to advertise" value="${esc(cs.mainOffer || "")}"><input class="inp" data-key="campaignSetup.avgTicket" placeholder="Average job / ticket value" value="${esc(cs.avgTicket || "")}"><input class="inp" data-key="campaignSetup.targetLocations" placeholder="Target locations (cities, zip codes)" value="${esc(cs.targetLocations || "")}"><input class="inp" data-key="campaignSetup.excludedKeywords" placeholder="Anything we should avoid in your ads?" value="${esc(cs.excludedKeywords || "")}"><input class="inp" data-key="campaignSetup.leadDestination" placeholder="Where should leads be sent? (email or phone)" value="${esc(cs.leadDestination || "")}"><input class="inp" data-key="campaignSetup.crmSystem" placeholder="CRM or booking system (if any)" value="${esc(cs.crmSystem || "")}"></div>`
    + `<div class="card"><div class="lbl">Your Website</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:12px;line-height:1.6">Two quick things about your own site. We do not need access to it.</div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-bottom:6px">Who looks after it</div><input class="inp" data-key="campaignSetup.webContact" placeholder="Name and email of whoever manages your site" value="${esc(cs.webContact || "")}"><div style="font-size:11px;color:#6B7280;margin:-2px 0 14px;line-height:1.55">We sometimes need one small change from them, like pointing a web address at your new landing page. It is usually five minutes of their time.</div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#4B5563;margin-bottom:6px">If you text your leads</div><div style="font-size:11px;color:#6B7280;margin-bottom:9px;line-height:1.55">To send a new lead an instant text, your form has to link these three pages first. That is a phone carrier requirement, not ours. Leave them blank if you do not text your leads. Keep any .html on the end, because the shorter version often will not open.</div><input class="inp" data-key="campaignSetup.privacyUrl" placeholder="Privacy policy page (https://...)" value="${esc(cs.privacyUrl || "")}"><input class="inp" data-key="campaignSetup.termsUrl" placeholder="Terms page (https://...)" value="${esc(cs.termsUrl || "")}"><input class="inp" data-key="campaignSetup.smsOptInUrl" placeholder="Text message consent page (https://...)" value="${esc(cs.smsOptInUrl || "")}"></div>`
    + `<div class="card"><div class="lbl">Brand Voice</div><select class="inp" data-key="brandVoice.tone">${TONES.map((t) => `<option value="${esc(t)}" ${bv.tone === t ? "selected" : ""}>${t || "How would you describe your brand?"}</option>`).join("")}</select><input class="inp" data-key="brandVoice.competitors" placeholder="Top competitors" value="${esc(bv.competitors || "")}"><input class="inp" data-key="brandVoice.differentiator" placeholder="What makes you different?" value="${esc(bv.differentiator || "")}"></div>`
    + `<button class="btn" id="savebtn" onclick="saveInfo(this)">Save My Information</button>`
    + `</div>`
    + '<div id="t-contract" style="display:none"><div class="cwide"><div class="card"><div class="lbl">Contract Status</div><div style="font-size:13px;font-weight:700;color:' + (cl.contractStatus === "active" ? "#10B981" : cl.contractStatus === "pending" ? "#F59E0B" : "#EF4444") + ';margin-bottom:6px">' + (cl.contractStatus === "active" ? "Signed and Active" : cl.contractStatus === "pending" ? "Pending Signature" : "Expired") + '</div><div style="font-size:11px;color:#6B7280;line-height:1.6">Start: ' + (cl.contractStart || "not set") + " · End: " + (cl.contractEnd || "not set") + "</div>" + contractAlert + "</div>"
    // Full agreement, always readable + downloadable by the client (same document
    // the OS renders — shared template in netlify/lib/contract-shared.cjs).
    + '<div class="card"><div class="lbl">Your Agreement</div><div style="font-size:11px;color:#9CA3AF;margin-bottom:10px;line-height:1.6">Your full service agreement, available here anytime. Scroll to read it, or save a copy for your records.</div><button class="btn" style="margin:0 0 10px" onclick="printContract()">Save or Print a Copy</button><div style="font-size:10px;color:#6B7280;margin:-4px 0 10px">Opens your print window. Choose &ldquo;Save as PDF&rdquo; to keep a copy.</div><div style="border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.12)"><iframe id="bl-contract-frame" title="Service Agreement" srcdoc="' + makeContractHTML(cl, pkg, "/logo.png").replace(/&/g, "&amp;").replace(/"/g, "&quot;") + '" style="width:100%;height:70vh;min-height:520px;border:none;display:block;background:#fff"></iframe></div></div></div></div>'
    + "</div>"
    + `<script>var selUpgName=null;var TOKEN=${JSON.stringify(cl.portalToken || "")};function decideApproval(id,decision,btn){var noteEl=document.getElementById('apnote-'+id);var note=noteEl?noteEl.value:'';var card=document.getElementById('ap-card-'+id);var btns=card?card.querySelectorAll('button'):[];for(var i=0;i<btns.length;i++)btns[i].disabled=true;btn.textContent=decision==='approved'?'Approving…':'Sending…';fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approval:{id:id,decision:decision,note:note}})}).then(function(r){if(!r.ok)throw 0;return r.json();}).then(function(d){if(!d||!d.ok)throw 0;if(card){card.innerHTML=decision==='approved'?'<div style="text-align:center;padding:16px 8px"><div style="font-size:26px;margin-bottom:6px">✓</div><div style="font-size:14px;font-weight:700;color:#10B981">Approved, thank you!</div></div>':'<div style="text-align:center;padding:16px 8px"><div style="font-size:22px;margin-bottom:6px">📝</div><div style="font-size:14px;font-weight:700;color:#F59E0B">Changes requested</div><div style="font-size:11px;color:#9CA3AF;margin-top:4px">We will take another pass and send it back to you.</div></div>';}apDecBadge();}).catch(function(){for(var j=0;j<btns.length;j++)btns[j].disabled=false;btn.textContent=decision==='approved'?'✓ Approve':'Request Changes';alert('Something went wrong. Please try again.');});}function apDecBadge(){var nav=document.querySelector('.nav');if(!nav)return;var btns=nav.querySelectorAll('.nb');for(var i=0;i<btns.length;i++){if(btns[i].textContent.indexOf('Review')===0){var span=btns[i].querySelector('span');if(span){var n=parseInt(span.textContent||'0',10)-1;if(n>0){span.textContent=n;}else{span.parentNode.removeChild(span);}}}}}function saveInfo(btn){var obj={};document.querySelectorAll('[data-key]').forEach(el=>{var path=el.getAttribute('data-key').split('.'),cur=obj;for(var i=0;i<path.length-1;i++){cur[path[i]]=cur[path[i]]||{};cur=cur[path[i]];}cur[path[path.length-1]]=el.value;});var orig=btn.textContent;btn.disabled=true;btn.textContent='Saving…';fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:obj})}).then(r=>{if(!r.ok)throw 0;btn.textContent='✓ Saved';setTimeout(()=>{btn.disabled=false;btn.textContent=orig;},1800);}).catch(()=>{btn.textContent='Save failed. Try again';btn.disabled=false;});}function uploadMedia(btn){var fileInput=document.getElementById('media-file'),file=fileInput.files[0],status=document.getElementById('media-status'),category=document.getElementById('media-cat').value;if(!file){status.style.color='#F59E0B';status.textContent='Choose a file first.';return;}btn.disabled=true;status.style.color='#6B7280';status.textContent='Uploading…';fetch('/.netlify/functions/media?action=sign&token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:file.name,category:category})}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(d=>fetch(d.signedUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream'},body:file}).then(r2=>{if(!r2.ok)throw 0;return d;})).then(d=>fetch('/.netlify/functions/media?action=confirm&token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:d.path,category:category,label:file.name})})).then(r=>{if(!r.ok)throw 0;return r.json();}).then(d2=>{status.style.color='#10B981';status.textContent='✓ Uploaded';var entry=(d2.mediaLibrary&&d2.mediaLibrary[0])||{};var mEmpty=document.getElementById('media-empty');if(mEmpty)mEmpty.style.display='none';var list=document.getElementById('media-list');if(list.textContent.indexOf('No files uploaded yet')>=0)list.innerHTML='';var item=document.createElement('div');item.className='media-item';item.setAttribute('data-path',entry.path||'');var thumb;if(category==='video'){thumb=document.createElement('span');thumb.className='media-thumb media-thumb-vid';thumb.textContent='▶';}else{thumb=document.createElement('img');thumb.className='media-thumb';thumb.src=entry.url||'';}var catSpan=document.createElement('span');catSpan.className='media-cat';catSpan.textContent=category;var nameSpan=document.createElement('span');nameSpan.className='media-name';nameSpan.textContent=file.name;var del=document.createElement('button');del.className='media-del';del.textContent='✕';del.setAttribute('onclick','delMedia(this)');item.appendChild(thumb);item.appendChild(catSpan);item.appendChild(nameSpan);item.appendChild(del);list.insertBefore(item,list.firstChild);fileInput.value='';btn.disabled=false;}).catch(()=>{status.style.color='#EF4444';status.textContent='Upload failed. Try again.';btn.disabled=false;});}function delMedia(btn){var row=btn.closest('.media-item'),path=row&&row.getAttribute('data-path');if(!path)return;if(!confirm('Remove this file? It will no longer be available for your ads or landing page.'))return;btn.disabled=true;btn.textContent='…';fetch('/.netlify/functions/media?action=delete&token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:path})}).then(r=>{if(!r.ok)throw 0;return r.json();}).then(()=>{var list=row.parentNode;row.remove();if(list&&!list.querySelector('.media-item'))list.innerHTML='<div style="font-size:11px;color:#6B7280">No files uploaded yet.</div>';}).catch(()=>{btn.disabled=false;btn.textContent='✕';var status=document.getElementById('media-status');if(status){status.style.color='#EF4444';status.textContent='Could not remove. Try again.';}});}function autoCat(input){var f=input.files[0];if(f&&f.type&&f.type.indexOf('video/')===0){document.getElementById('media-cat').value='video';}}function printContract(){var f=document.getElementById('bl-contract-frame');if(!f)return;try{f.contentWindow.focus();f.contentWindow.print();}catch(e){alert('Could not open the print dialog — use your browser menu to print instead.');}}function show(n,b){document.querySelectorAll('[id^="t-"]').forEach(e=>e.style.display="none");document.querySelectorAll('.nb').forEach(e=>e.classList.remove('on'));var p=document.getElementById('t-'+n);p.style.display='block';p.classList.remove('tab-anim');void p.offsetWidth;p.classList.add('tab-anim');b.classList.add('on');}function selUpg(el,i){selUpgName=el.getAttribute('data-name');document.querySelectorAll('.uopt').forEach((e,j)=>{e.classList.toggle('sel',i===j)});var b=document.getElementById('upgbtn');if(b){b.disabled=false;b.style.opacity='1';}}function askUpg(){if(!selUpgName)return;var w=document.getElementById('upg-action');if(!w)return;w.innerHTML='<div style="font-size:12px;color:#9CA3AF;margin:12px 0 10px;line-height:1.55">Ask about moving up to <b style="color:#F0F2FF">'+selUpgName+'</b>? We will confirm what changes and what it costs. Nothing changes until you say yes.</div><div style="display:flex;gap:8px"><button class="btn" style="margin-top:0;flex:1;background:transparent;border-color:rgba(255,255,255,.15);color:#9CA3AF" onclick="cancelUpg()">Cancel</button><button class="btn" id="upg-confirm" style="margin-top:0;flex:1" onclick="confirmUpg()">Send Request</button></div>';}function cancelUpg(){var w=document.getElementById('upg-action');if(w)w.innerHTML='<button class="btn" id="upgbtn" onclick="askUpg()">Ask About Scaling Up</button>';}function confirmUpg(){if(!selUpgName)return;var b=document.getElementById('upg-confirm');if(b){b.disabled=true;b.textContent='Sending…';}fetch('/.netlify/functions/portal?token='+encodeURIComponent(TOKEN),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({upgrade:selUpgName})}).then(function(r){if(!r.ok)throw 0;document.getElementById('upgrade-section').innerHTML='<div style="text-align:center;padding:24px"><div style="font-size:30px;margin-bottom:10px">✓</div><div style="font-size:15px;font-weight:700;color:#F0F2FF;margin-bottom:8px">Request Sent</div><div style="font-size:12px;color:#6B7280">Your account manager will be in touch within 1 business day.</div></div>';}).catch(function(){if(b){b.disabled=false;b.textContent='Send Request';}alert('Something went wrong. Please try again or contact your account manager.');});}function blHelpEsc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}function blHelpBubble(role,text){var t=document.getElementById('bl-help-thread');if(!t)return null;var b=document.createElement('div');b.style.cssText='max-width:88%;padding:8px 11px;border-radius:12px;font-size:12px;line-height:1.55;'+(role==='user'?'align-self:flex-end;background:rgba(200,168,75,.14);border:1px solid rgba(200,168,75,.28);color:#F5F3ED':'align-self:flex-start;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:#D1D5DB');b.innerHTML=blHelpEsc(text).replace(/\\n/g,'<br>');t.appendChild(b);t.scrollTop=t.scrollHeight;return b;}var blHelpHistory=[],blHelpImg=null;function blHelpPickImg(input){var f=input.files&&input.files[0];if(!f)return;var rd=new FileReader();rd.onload=function(e){var img=new Image();img.onload=function(){var mx=1200,w=img.width,h=img.height;if(w>mx||h>mx){if(w>=h){h=Math.round(h*mx/w);w=mx;}else{w=Math.round(w*mx/h);h=mx;}}var c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);blHelpImg=c.toDataURL('image/jpeg',0.85);var ind=document.getElementById('bl-help-img');if(ind){ind.style.display='block';ind.innerHTML='Attach Screenshot attached &nbsp;<a href="#" style="color:#9CA3AF" onclick="blHelpClearImg();return false">remove</a>';}};img.src=e.target.result;};rd.readAsDataURL(f);input.value='';}function blHelpClearImg(){blHelpImg=null;var ind=document.getElementById('bl-help-img');if(ind){ind.style.display='none';ind.innerHTML='';}}function blHelpSend(){var inp=document.getElementById('bl-help-input'),btn=document.getElementById('bl-help-send');if(!inp||!btn)return;var msg=(inp.value||'').trim();if(!msg&&!blHelpImg)return;var shown=msg||'(screenshot)';blHelpBubble('user',shown+(blHelpImg?' 📎':''));var sendImg=blHelpImg;inp.value='';blHelpClearImg();btn.disabled=true;btn.textContent='…';var think=blHelpBubble('assistant','…');fetch('/.netlify/functions/portal-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,message:msg,history:blHelpHistory.slice(-12),image:sendImg||undefined})}).then(function(r){return r.json();}).then(function(d){if(think&&think.parentNode)think.parentNode.removeChild(think);if(!d||!d.ok){blHelpBubble('assistant',(d&&d.error)||'Sorry, something went wrong. Please try again.');}else{blHelpBubble('assistant',d.reply);blHelpHistory.push({role:'user',text:shown});blHelpHistory.push({role:'assistant',text:d.reply});}btn.disabled=false;btn.textContent='Send';}).catch(function(){if(think&&think.parentNode)think.parentNode.removeChild(think);blHelpBubble('assistant','I could not reach the assistant. Please check your connection and try again.');btn.disabled=false;btn.textContent='Send';});}try{var _ts=document.getElementById('t-status');if(_ts)_ts.classList.add('tab-anim');}catch(e){}<\/script>`
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
  // Ad-account IDs the client can self-enter from the Connect Your Ad Accounts section.
  for (const k of ["googleAdsCustomerId", "metaAdAccountId", "metaPageId"]) {
    if (Object.prototype.hasOwnProperty.call(fields, k)) out[k] = clip(fields[k], 60);
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

const handler = async (event) => {
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

      // Approval decision from the portal (client Approves / Requests Changes on an
      // item the owner queued). Update that item in data.approvals + log it so the
      // owner sees the decision (getAlerts raises "changes" as a yellow alert).
      if (body.approval && typeof body.approval === "object" && body.approval.id) {
        const list = Array.isArray(data.data.approvals) ? data.data.approvals : [];
        const decision = body.approval.decision === "approved" ? "approved" : "changes";
        const note = clip(body.approval.note || "", 500);
        let title = "an item"; let found = false;
        const next = list.map((a) => {
          if (a && a.id === body.approval.id && a.status === "pending") {
            found = true; title = a.title || title;
            return { ...a, status: decision, note, decidedAt: new Date().toISOString() };
          }
          return a;
        });
        if (!found) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) }; // already decided / gone — idempotent
        const logEntry = { date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), note: `Client ${decision === "approved" ? "APPROVED" : "requested CHANGES on"} "${title}"${note ? `: ${note}` : ""}`, cat: "update", ts: Date.now() };
        const apData = { ...data.data, approvals: next, commLog: [logEntry, ...((data.data.commLog) || [])] };
        const { error: apErr } = await supabaseAdmin.from("clients").update({ data: apData, updated_at: new Date().toISOString() }).eq("id", data.id);
        if (apErr) { console.error("Portal approval save failed:", apErr); return { statusCode: 500, body: JSON.stringify({ ok: false, error: "save failed" }) }; }
        // Notify the owner IMMEDIATELY so they can follow up (email + SMS-if-enabled). Best-effort.
        try {
          const { dispatchAlert } = await import("../lib/alerts-shared.mjs");
          const who = data.data.name || "A client";
          await dispatchAlert({
            title: decision === "approved" ? `✅ ${who} approved: ${title}` : `📝 ${who} requested changes: ${title}`,
            body: decision === "approved"
              ? `${who} just approved "${title}" in their portal. You're clear to move forward — reach out if there's a next step.`
              : `${who} requested changes on "${title}" in their portal.${note ? ` Their note: "${note}"` : ""} Follow up with them.`,
            severity: "yellow",
          });
        } catch (e) { console.warn("approval owner-alert failed:", e && e.message); }
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
      }

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
    return { statusCode: 200, headers: { "Content-Type": "text/html" }, body: makePortalHTML(cl, pkg, (event.queryStringParameters || {}).billing) };
  } catch (err) {
    console.error("Portal function error:", err);
    return { statusCode: 500, headers: { "Content-Type": "text/html" }, body: errorPage("Something Went Wrong", "We couldn't load your portal right now. Please try again shortly.") };
  }
};

export default withLambda(handler);
export const _internal = { makePortalHTML, findPkg };
