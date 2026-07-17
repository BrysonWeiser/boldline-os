// Shared service-agreement renderer (CommonJS — required by portal.js).
// This is the SAME document the OS Contract tab renders (makeContractHTML in
// index.html). If you change the agreement there, re-sync this copy — the
// client portal serves its contract from here. LOGO is a parameter because the
// portal uses /logo.png while the OS embeds a data URI.

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

const PER_LEAD  = { Roofing:75, "Med Spa":35, "Auto Detailing":15 };
const monthsLabel = (n) => {
  if (n===1)  return "1 month";
  if (n===3)  return "3 months";
  if (n===6)  return "6 months";
  if (n===12) return "1 year";
  return `${n} months`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TERM-BASED RENEWAL PRICING — Bryson's dials. Edit ONLY the two lines below.
// ───────────────────────────────────────────────────────────────────────────────
// New clients always start on a 3-month term at the standard package rate. At
// RENEWAL the client picks a length: month-to-month carries a small flexibility
// premium, longer commitments earn a discount. Rates are a fraction applied to
// the package's standard monthly (the 3-month rate is the anchor = 0%).
// Charges the management fee only — never ad spend (see business constraint).
//
//  • TERM_PRICING_ENABLED = false  → turns the whole thing OFF: every renewal
//    length bills the plain standard rate (no premium, no discount). This is the
//    "put the rates back to normal" switch — flip it and redeploy, nothing else
//    changes and no future feature is affected.
//  • TERM_RATE  → the percentages, as decimals (0.10 = +10%, -0.10 = -10%). Change
//    any of them any time. Keys are the term lengths in months.

const makeContractHTML=(cl,pkg,LOGO)=>{
  const esc=(s)=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const money=(n)=>"$"+Number(n||0).toLocaleString();
  const pl=PER_LEAD[cl.niche];
  const feats=(PKG_FEATURES[cl.packageId]||[]).map(fid=>{const f=ALL_FEATURES.find(x=>x.id===fid);return f?'<li>'+f.label+'</li>':''}).join('');
  // Effective monthly = the agreed rate (term-priced at renewal) when set, else the standard package rate.
  const effMonthly = cl.billingMonthly || (pkg&&pkg.price) || 0;
  const stdMonthly = (pkg&&pkg.price) || effMonthly;      // the Standard (3-month) Rate
  // Setup fee honors a manual adjustment (billingSetup), including an explicit $0 waiver.
  const setupFee   = (cl.billingSetup!=null?cl.billingSetup:(pkg&&pkg.setup))||0;
  const termMo     = cl.contractTermMonths || 3;
  const clientName = esc(cl.name), signerName = esc(cl.contactName||"Authorized Signatory");
  const agreementNo= esc(String(cl.id||"").slice(-8).toUpperCase() || "—");
  // Section numbering: 1 Services, 2 Term, 3 Fees are fixed; Per-Lead (if any) and
  // Performance Bonus (if any) slot in after 3; everything later shifts accordingly.
  const hasBonus = !!(pkg&&pkg.roas);
  const nBase = 3 + (pl?1:0) + (hasBonus?1:0);
  const nAd=nBase+1, nResp=nBase+2, nNoG=nBase+3, nTerm=nBase+4, nIP=nBase+5, nConf=nBase+6,
        nData=nBase+7, nLiab=nBase+8, nInd=nBase+9, nRel=nBase+10, nLaw=nBase+11, nGen=nBase+12;

  const metaItem=(l,v)=>'<div class="meta-item"><div class="meta-label">'+l+'</div><div class="meta-value">'+v+'</div></div>';
  const meta =
    metaItem("Service Package",(pkg&&pkg.name)||"—")
   +metaItem("Advertising Platform",(pkg&&pkg.platform)||"—")
   +metaItem("Monthly Management Fee",money(effMonthly)+"/mo")
   +metaItem("One-Time Setup Fee",setupFee>0?money(setupFee):"Waived")
   +metaItem("Committed Term",monthsLabel(termMo))
   +metaItem("Start Date",esc(cl.contractStart)||"—")
   +metaItem("End Date",esc(cl.contractEnd)||"—")
   +metaItem("Optimization Cadence",((pkg&&pkg.optimizationFreq)==="weekly"?"Weekly":"Monthly"))
   +(pl?metaItem("Per-Qualified-Lead Fee",money(pl)+" per lead"):"")
   +(pkg&&pkg.roas?metaItem("Performance Bonus",esc(pkg.roas)):"")
   +(cl.adBudget?metaItem("Client Ad Budget (paid to platforms)",esc(cl.adBudget)):(pkg&&pkg.adSpend?metaItem("Recommended Ad Budget (paid to platforms)",esc(pkg.adSpend)):""));

  const perLeadSection = pl ? (
    '<h2>4. Per-Lead Fees</h2>'
   +'<p>4.1 In addition to the Management Fee, Client shall pay the Per-Qualified-Lead Fee stated above for each Qualified Lead generated by the Campaigns. A <strong>&ldquo;Qualified Lead&rdquo;</strong> means a prospective customer who, as a result of the Campaigns, (a) submits a lead form, (b) places a tracked telephone call lasting thirty (30) seconds or longer, or (c) initiates a text or chat conversation. Duplicate submissions from the same person within thirty (30) days, spam, bot traffic, and solicitation inquiries are not Qualified Leads.</p>'
   +'<p>4.2 Per-lead fees are calculated from campaign tracking data and invoiced monthly in arrears. If Client believes a lead was incorrectly counted, Client must notify Agency in writing within ten (10) days of the invoice date; Agency will review in good faith and credit any lead it reasonably determines was not a Qualified Lead. Invoices not disputed within that period are deemed accepted. <strong>Per-lead fees compensate lead generation only; Agency does not warrant that any lead will become a paying customer, and no fee is refundable because a lead did not convert.</strong></p>'
  ) : '';
  const bonusSection = (pkg&&pkg.roas) ? (
    '<h2>'+(pl?'5':'4')+'. Performance Bonus</h2>'
   +'<p>Where the Key Terms state a Performance Bonus, Client shall pay Agency the stated bonus for each calendar month in which the Campaigns achieve the stated return-on-ad-spend (ROAS) threshold, as measured by the advertising platform&rsquo;s reported conversion value divided by ad spend for that month. The bonus is invoiced with the following month&rsquo;s Management Fee. Platform-reported attribution is the definitive measurement for this purpose.</p>'
  ) : '';
  // Section numbers after the conditional ones stay fixed by rendering both slots
  // (empty string when absent) and numbering the rest from 6 onward.
  const css='body{font-family:Georgia,"Times New Roman",serif;font-size:12.5px;line-height:1.75;color:#191919;background:#fff;padding:34px 38px;max-width:100%;word-break:break-word}'
   +'.hd{display:flex;align-items:center;gap:14px;border-bottom:3px solid #C8A84B;padding-bottom:14px;margin-bottom:6px}'
   +'.hd img{width:52px;height:52px;object-fit:contain}'
   +'.hd .co{font-size:21px;font-weight:700;letter-spacing:.04em;color:#111}.hd .co span{color:#8B6914}'
   +'.hd .tag{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#8B6914;margin-top:2px}'
   +'.docmeta{display:flex;justify-content:space-between;font-size:10px;color:#666;margin:8px 0 18px}'
   +'h1{font-size:17px;text-align:center;margin:6px 0 2px;letter-spacing:.02em}'
   +'.sub{text-align:center;font-size:11px;color:#666;margin-bottom:16px}'
   +'h2{font-size:12.5px;margin:20px 0 6px;color:#8B6914;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e0d0;padding-bottom:4px;page-break-after:avoid}'
   +'.parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;padding:12px;background:#f9f8f4;border:1px solid #e5e0d0;border-radius:4px}'
   +'.pl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#8B6914;margin-bottom:4px}'
   +'.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}'
   +'.meta-item{padding:8px 10px;background:#f9f8f4;border:1px solid #e5e0d0;border-radius:4px}'
   +'.meta-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#8B6914}'
   +'.meta-value{font-size:12.5px;font-weight:700;color:#1a1a1a}'
   +'ul{padding-left:18px;margin:6px 0;columns:2;column-gap:24px}li{margin-bottom:4px;font-size:11.5px;break-inside:avoid}'
   +'p{margin-bottom:9px;font-size:11.5px;text-align:justify}'
   +'.caps{font-weight:700}'
   +'.callout{padding:10px 12px;background:#faf6ea;border:1px solid #d9c98f;border-radius:4px;margin:8px 0;font-size:11.5px}'
   +'.sigs{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px;page-break-inside:avoid}'
   +'.sig-box{padding:12px;border:1px solid #e5e0d0;border-radius:4px}'
   +'.sig-line{border-bottom:1px solid #1a1a1a;margin:26px 0 4px}'
   +'.ft{margin-top:22px;padding-top:10px;border-top:1px solid #e5e0d0;font-size:9px;color:#999;text-align:center}'
   +'@media print{body{padding:18px 22px}}';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+css+'</style></head><body>'
   +'<div class="hd"><img src="'+LOGO+'" alt="BoldLine Media"><div><div class="co">BOLDLINE <span>MEDIA</span></div><div class="tag">Paid Advertising Management</div></div></div>'
   +'<div class="docmeta"><span>Agreement No. BLM-'+agreementNo+'</span><span>Effective Date: '+(esc(cl.contractStart)||'the date of last signature')+'</span></div>'
   +'<h1>Advertising Services Agreement</h1>'
   +'<p class="sub">This Advertising Services Agreement (the &ldquo;Agreement&rdquo;) is entered into between the parties below and governs the services described herein.</p>'

   +'<h2>Parties</h2><div class="parties">'
   +'<div><div class="pl">Agency</div><strong>BoldLine Media LLC</strong><br>an Arizona limited liability company<br>Bryson Weiser, Owner<br>brysonaweiser@gmail.com<br>(&ldquo;Agency&rdquo;)</div>'
   +'<div><div class="pl">Client</div><strong>'+clientName+'</strong><br>'+signerName+'<br>'+esc(cl.email)+'<br>'+esc(cl.businessAddress)+'<br>(&ldquo;Client&rdquo;)</div></div>'

   +'<h2>Key Commercial Terms</h2><div class="meta">'+meta+'</div>'

   +'<h2>1. Services and Scope</h2>'
   +'<p>1.1 Agency will provide the paid-advertising management services included in the Service Package identified above (the &ldquo;Services&rdquo;), consisting of the following deliverables:</p>'
   +'<ul>'+feats+'</ul>'
   +'<p>1.2 The Services are limited to the Service Package selected. Work outside that scope (including additional platforms, campaigns, pages, or service tiers) requires a written package upgrade or separate agreement, at Agency&rsquo;s then-current rates. Agency may use subcontractors and automated tooling to perform the Services, and remains responsible for the Services performed.</p>'
   +'<p>1.3 Agency will determine campaign structure, targeting, bidding, and creative in its professional judgment, subject to Client&rsquo;s approval rights over ad copy and landing-page content that names Client or makes claims about Client&rsquo;s products or services. No advertising spend will be initiated or increased without Client&rsquo;s sign-off on the associated budget.</p>'

   +'<h2>2. Term, Renewal, and Holdover</h2>'
   +'<p>2.1 This Agreement begins on the Start Date and continues for the Committed Term shown above. <strong>The initial term is a minimum commitment of three (3) months</strong>; Client acknowledges that paid-advertising results require an initial optimization period and the pricing reflects that commitment.</p>'
   +'<p>2.2 At the end of any term, the parties may renew for a length of one (1), three (3), six (6), or twelve (12) months. The Monthly Management Fee for a renewal depends on the renewal length selected: month-to-month service carries a premium over the standard three-month rate, and longer commitments receive a discounted rate, as quoted by Agency at the time of renewal. The rate for the current term is the Monthly Management Fee stated in the Key Commercial Terms.</p>'
   +'<p>2.3 <strong>Holdover.</strong> If the term expires and the parties have neither renewed nor terminated, this Agreement continues on a month-to-month basis at Agency&rsquo;s then-current month-to-month rate for the same Service Package, until either party terminates under Section '+nTerm+'. This prevents any interruption of live campaigns.</p>'

   +'<h2>3. Fees and Payment</h2>'
   +'<p>3.1 <strong>Setup Fee.</strong> Any one-time Setup Fee shown in the Key Commercial Terms is due before campaign build begins and is non-refundable once Agency has commenced work, as it compensates account configuration, research, and build labor actually performed.</p>'
   +'<p>3.2 <strong>Management Fee.</strong> The Monthly Management Fee is billed monthly in advance by automatic charge (credit card or ACH bank debit) through Agency&rsquo;s payment processor (Stripe). Client authorizes recurring charges for the duration of this Agreement, including any holdover period. All amounts are in U.S. dollars; Client is responsible for any currency-conversion, bank, or international transaction fees charged by Client&rsquo;s own institutions.</p>'
   +'<p>3.3 <strong>Taxes.</strong> Fees are exclusive of all taxes. Client is responsible for any sales, use, VAT, GST, withholding, or similar taxes arising from the Services in Client&rsquo;s jurisdiction, excluding taxes on Agency&rsquo;s income. International payments must be made without deduction; if withholding is legally required, Client will gross up so Agency receives the full invoiced amount.</p>'
   +'<p>3.4 <strong>Late and Failed Payments.</strong> If a scheduled charge fails and is not cured within ten (10) days of notice, Agency may suspend the Services (including pausing campaigns) until payment is made; suspension does not extend the term or reduce fees owed. Amounts more than ten (10) days past due accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law, plus reasonable collection costs. Client agrees to raise any billing dispute directly with Agency before initiating a card chargeback; a chargeback of amounts properly owed is a material breach. Client agrees that late-payment interest and any early-termination amounts owed under this Agreement may be added to Client&rsquo;s next scheduled invoice and collected by the authorized automatic payment method.</p>'
   +'<p>3.5 <strong>No refunds for partial months.</strong> Except as expressly stated in this Agreement, fees for a billing period that has begun are earned when billed and are non-refundable.</p>'
   +perLeadSection
   +bonusSection

   +'<h2>'+nAd+'. Advertising Spend and Account Ownership</h2>'
   +'<p>(a) <strong>Client pays ad spend directly.</strong> Advertising budget is separate from all Agency fees and is paid by Client directly to the advertising platforms (Google, Meta, or others) using Client&rsquo;s own payment method on Client&rsquo;s own ad accounts. <span class="caps">AGENCY NEVER HOLDS, ADVANCES, OR GUARANTEES CLIENT AD SPEND, IS NOT A PARTY TO CLIENT&rsquo;S AGREEMENTS WITH ANY ADVERTISING PLATFORM, AND HAS NO LIABILITY FOR AMOUNTS CLIENT OWES ANY PLATFORM.</span></p>'
   +'<p>(b) <strong>Client owns the accounts.</strong> All ad accounts remain registered to and owned by Client at all times; Agency holds manager-level access only. Client agrees not to remove Agency&rsquo;s access during the term, and Agency will relinquish access on termination.</p>'
   +'<p>(c) Client authorizes Agency to manage campaigns within the budget ranges approved by Client. Agency will not knowingly exceed an approved budget; Client acknowledges platforms may modestly overdeliver against daily budgets under their own published rules, and such platform-side variance is not an Agency breach.</p>'

   +'<h2>'+nResp+'. Client Responsibilities</h2>'
   +'<p>Client will: (a) provide timely, accurate, and complete business information, brand assets, offers, and approvals (within five (5) business days of request); (b) maintain any website, phone line, inbox, and staffing needed to receive and respond to leads; (c) ensure that all information, claims, pricing, offers, licenses, and qualifications supplied to Agency and presented in advertising are true, lawful, and substantiated; and (d) comply with all laws applicable to Client&rsquo;s own products, services, industry, and location, including advertising, consumer-protection, licensing, and health-claim rules. Delays or failures caused by Client (including withheld approvals or platform access) do not suspend fees. Client, not Agency, is solely responsible for its dealings with its own customers, including fulfillment, quality, refunds, and complaints.</p>'

   +'<h2>'+nNoG+'. No Guarantee of Results; Platform Dependencies</h2>'
   +'<div class="callout"><span class="caps">NO PERFORMANCE GUARANTEE.</span> Advertising outcomes depend on factors outside any agency&rsquo;s control, including market conditions, competition, seasonality, Client&rsquo;s offer and pricing, Client&rsquo;s speed and quality of lead follow-up, and the advertising platforms themselves. <span class="caps">AGENCY DOES NOT GUARANTEE ANY PARTICULAR NUMBER OF LEADS, CLICKS, SALES, RANKINGS, RETURN ON AD SPEND, OR OTHER RESULT.</span> Any projections, estimates, benchmarks, or past results shared by Agency are illustrations only and are not promises. Agency&rsquo;s obligations are to perform the Services described in Section 1 with professional skill and care.</div>'
   +'<p>Client further acknowledges that advertising platforms may at any time change their policies, algorithms, pricing, or features; disapprove ads; restrict, suspend, or terminate accounts; or misreport data. Such platform actions are outside Agency&rsquo;s control and are not a breach by Agency, provided Agency uses commercially reasonable efforts to remediate. Fees remain payable during reasonable remediation periods; if a platform suspension attributable to neither party continues for more than thirty (30) consecutive days, either party may terminate under the section below without an early-termination fee.</p>'

   +'<h2>'+nTerm+'. Termination</h2>'
   +'<p>(a) <strong>By either party at term end.</strong> Either party may elect not to renew by written notice at least thirty (30) days before the End Date.</p>'
   +'<p>(b) <strong>By Client, early.</strong> Client may terminate before the End Date on thirty (30) days&rsquo; written notice, provided Client pays, as liquidated damages and not as a penalty: (i) all fees accrued through the effective termination date, plus (ii) an early-termination fee equal to <strong>one (1) month&rsquo;s Monthly Management Fee</strong>, plus (iii) if Client received a discounted rate in exchange for the Committed Term, the difference between the Standard Rate ('+money(stdMonthly)+'/mo) and the discounted rate actually paid for each month already billed in the current term. The parties agree these amounts are a reasonable estimate of Agency&rsquo;s losses from early termination, which are difficult to calculate precisely.</p>'
   +'<p>(c) <strong>By Agency, early.</strong> Agency may terminate before the End Date on thirty (30) days&rsquo; written notice. In that case Agency will refund any prepaid fees covering periods after the effective termination date and, if Agency terminates before the Campaigns launch, the unearned portion of any Setup Fee; no early-termination fee applies to Client.</p>'
   +'<p>(d) <strong>For cause.</strong> Either party may terminate immediately by written notice if the other party materially breaches this Agreement and fails to cure within fifteen (15) days of written notice describing the breach (no cure period applies to Client&rsquo;s non-payment beyond the periods in Section 3.4, or to a breach of confidentiality). Termination for Client&rsquo;s uncured breach does not relieve Client of subsection (b) amounts.</p>'
   +'<p>(e) <strong>Effect.</strong> On termination: all unpaid amounts become immediately due; Agency will stop campaigns as directed, relinquish account access, and deliver any Client-owned materials in its possession; and each party will return or delete the other&rsquo;s Confidential Information on request. Sections addressing fees owed, ownership, confidentiality, data, liability, indemnification, and disputes survive termination.</p>'

   +'<h2>'+nIP+'. Intellectual Property</h2>'
   +'<p>(a) Upon payment in full of all amounts owed, Client owns the ad accounts, campaigns, landing pages, leads, creative assets, and data produced specifically for Client under this Agreement (the &ldquo;Deliverables&rdquo;).</p>'
   +'<p>(b) Agency retains all rights in its pre-existing and independently developed materials, including its methods, processes, software, prompts, templates, automation systems, and know-how (&ldquo;Agency Tools&rdquo;). To the extent any Agency Tools are embedded in a Deliverable, Agency grants Client a perpetual, non-exclusive license to use them as part of that Deliverable. Nothing in this Agreement transfers Agency Tools themselves.</p>'
   +'<p>(c) <strong>Portfolio rights.</strong> Client grants Agency the right to identify Client as a client and to display non-confidential work samples and aggregate, anonymized performance results in Agency&rsquo;s portfolio and marketing. Client may revoke this by written notice at any time, prospectively.</p>'

   +'<h2>'+nConf+'. Confidentiality</h2>'
   +'<p>Each party will use the other&rsquo;s non-public business information (&ldquo;Confidential Information&rdquo;) only to perform this Agreement and will protect it with at least reasonable care, during the term and for two (2) years after. Confidential Information excludes information that is public through no fault of the recipient, already known, independently developed, or lawfully received from a third party; disclosure required by law is permitted with prompt notice where lawful. The pricing in this Agreement is Confidential Information of both parties.</p>'

   +'<h2>'+nData+'. Data Protection and Communications Compliance</h2>'
   +'<p>(a) As between the parties, Client owns and is the controller of lead and customer data generated by the Campaigns. Agency processes that data only to perform the Services and will not sell it.</p>'
   +'<p>(b) Client is responsible for its own privacy and communications-law compliance in every jurisdiction where it operates or advertises, including privacy notices on its website and lawful basis for contacting leads. Where the Services include automated follow-up (for example, text or email sequences sent to leads on Client&rsquo;s behalf), such messages are sent as Client&rsquo;s agent, at Client&rsquo;s direction, and Client is responsible for ensuring that contacting its leads in that manner is lawful in the relevant jurisdiction (including consent, disclosure, and opt-out requirements). Agency will honor opt-outs in the systems it operates.</p>'

   +'<h2>'+nLiab+'. Limitation of Liability</h2>'
   +'<p><span class="caps">EXCEPT FOR A PARTY&rsquo;S INDEMNIFICATION OBLIGATIONS, BREACH OF CONFIDENTIALITY, OR WILLFUL MISCONDUCT: (A) NEITHER PARTY IS LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST REVENUE, OR LOST DATA, EVEN IF ADVISED OF THE POSSIBILITY; AND (B) EACH PARTY&rsquo;S TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT IS CAPPED AT THE FEES ACTUALLY PAID BY CLIENT TO AGENCY IN THE THREE (3) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM.</span> For clarity, amounts Client owes advertising platforms are Client&rsquo;s own obligation and are never Agency damages or Agency liability. Any claim must be brought within twelve (12) months of the event giving rise to it. Nothing in this section limits liability that cannot be limited by applicable law.</p>'

   +'<h2>'+nInd+'. Indemnification</h2>'
   +'<p>(a) Client will defend and indemnify Agency against third-party claims arising from: Client&rsquo;s products or services; materials, claims, or instructions supplied by Client; Client&rsquo;s violation of law (including advertising, licensing, privacy, or communications law); or Client&rsquo;s dealings with its own customers.</p>'
   +'<p>(b) Agency will defend and indemnify Client against third-party claims that Deliverables created solely by Agency (excluding Client-supplied materials and platform components) infringe a third party&rsquo;s copyright or trademark, or arising from Agency&rsquo;s gross negligence or willful misconduct.</p>'
   +'<p>(c) The indemnified party must give prompt notice, reasonable cooperation, and sole-control of the defense to the indemnifying party (no settlement admitting the indemnified party&rsquo;s fault without its consent).</p>'

   +'<h2>'+nRel+'. Relationship; Non-Solicitation; Force Majeure</h2>'
   +'<p>(a) The parties are independent contractors. Nothing here creates a partnership, joint venture, employment, or fiduciary relationship, and neither party may bind the other.</p>'
   +'<p>(b) During the term and for twelve (12) months after, neither party will solicit for employment or engagement any employee or contractor of the other who was involved in the Services, except through general public postings not targeted at such persons.</p>'
   +'<p>(c) Neither party is liable for delay or failure caused by events beyond its reasonable control (including natural disasters, war, government action, internet or utility failures, or platform-wide outages), provided it resumes performance promptly. Payment obligations for Services already performed are not excused.</p>'

   +'<h2>'+nLaw+'. Governing Law and Dispute Resolution</h2>'
   +'<p>(a) This Agreement is governed by the laws of the State of Arizona, USA, without regard to conflict-of-laws rules. The United Nations Convention on Contracts for the International Sale of Goods does not apply.</p>'
   +'<p>(b) The parties will first attempt in good faith to resolve any dispute by direct negotiation for thirty (30) days after written notice. Any dispute not so resolved will be finally settled by <strong>binding arbitration</strong> administered by the American Arbitration Association under its Commercial Arbitration Rules, by one arbitrator, seated in Arizona, conducted in English (with the option of remote/video proceedings for the convenience of out-of-state or international parties). Judgment on the award may be entered in any court of competent jurisdiction. Either party may instead bring an individual claim in small-claims court, and either party may seek temporary injunctive relief in court for breach of confidentiality or intellectual-property rights. <span class="caps">EACH PARTY WAIVES ANY RIGHT TO A JURY TRIAL AND TO PARTICIPATE IN A CLASS ACTION, TO THE EXTENT PERMITTED BY LAW.</span> The prevailing party in any proceeding is entitled to its reasonable attorneys&rsquo; fees and costs.</p>'
   +'<p>(c) <strong>International clients.</strong> This Agreement is drafted, negotiated, and performed in English, and the English text controls over any translation. All payments are in U.S. dollars. Client represents that it has authority to enter this Agreement under the laws of its own jurisdiction, and that neither Client nor its owners are subject to sanctions administered by the U.S. Office of Foreign Assets Control or located in an embargoed jurisdiction.</p>'

   +'<h2>'+nGen+'. General</h2>'
   +'<p>This Agreement (including the Key Commercial Terms above) is the entire agreement between the parties about its subject and supersedes all prior discussions and proposals. Amendments must be in a writing signed (including electronically) by both parties, except that package upgrades and renewal terms may be confirmed by exchange of email or through Agency&rsquo;s client systems. If any provision is held unenforceable, it will be modified to the minimum extent necessary and the rest remains in effect. A waiver must be written and applies only to the instance given. Client may not assign this Agreement without Agency&rsquo;s consent; Agency may assign to a successor of its business. Notices may be given by email to the addresses on page one and are effective on the business day received. <strong>The parties agree this Agreement may be executed electronically, and electronic signatures (including via DocuSign) are valid and binding under the U.S. E-SIGN Act, the Arizona Electronic Transactions Act, and equivalent laws.</strong> This Agreement may be signed in counterparts. There are no third-party beneficiaries to this Agreement. Headings are for convenience only and do not affect interpretation.</p>'

   +'<h2>Signatures</h2>'
   +'<p style="font-size:11px">By signing below, each party confirms it has read, understands, and agrees to this Agreement, and that the person signing is authorized to bind that party.</p>'
   +'<div class="sigs">'
   +'<div class="sig-box"><div class="pl">Agency — BoldLine Media LLC</div><div class="sig-line"></div><div style="font-size:11px">Bryson Weiser, Owner</div><div style="font-size:11px;color:#666;margin-top:3px">Date: _______________</div></div>'
   +'<div class="sig-box"><div class="pl">Client — '+clientName+'</div><div class="sig-line"><span style="color:#fff;font-size:9px">/BL_SIGN_HERE/</span></div><div style="font-size:11px">'+signerName+'</div><div style="font-size:11px;color:#666;margin-top:3px">Date: _______________</div></div>'
   +'</div>'
   +'<div class="ft">BoldLine Media LLC · Arizona, USA · Agreement No. BLM-'+agreementNo+' · '+(pkg&&pkg.name?esc(pkg.name)+' — '+esc(pkg.platform):'')+'</div>'
   +'</body></html>';
};



module.exports = { makeContractHTML };
