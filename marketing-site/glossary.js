/* Glossary term explainers: hover (desktop) / tap (mobile) popovers that define
   marketing jargon in plain English. Shared by the homepage (terms pre-wrapped
   as <span class="term" data-term="…">) and the blog (terms auto-linked into the
   article body at runtime — see autolink() below). One reusable popover node,
   driven by the G dictionary keyed off each .term's data-term. Styles: /glossary.css */
(function(){
  var G = {
    "landing-page":["Landing page","A single web page built for one job: turning an ad click into a call, form, or sale. No menus or distractions, just your offer and one clear next step."],
    "optimization":["Optimization & reporting","We keep tuning your ads, cutting what wastes money and putting more behind what works, then send a plain-English report so you always know what your spend is getting you."],
    "custom-design":["Fully custom design","A landing page designed from scratch around your business and your offer, not a generic template. It looks like you, and it converts better."],
    "call-tracking":["Call tracking","A dedicated phone number that forwards straight to your real line. It lets us see exactly which ads make your phone ring, so you stop paying for the ones that don't."],
    "attribution":["Attribution","Tying each lead or sale back to the exact ad that created it, so decisions are based on what's actually working instead of guesswork."],
    "retargeting":["Retargeting","Showing ads again to people who visited your site but didn't act yet. It's a low-cost nudge that brings warm prospects back to finish."],
    "audience-building":["Audience building","Choosing exactly who sees your ads, by location, interests, and behavior, so your budget reaches likely customers instead of everyone."],
    "crm-integration":["CRM integration","CRM stands for Customer Relationship Management, the software that stores your leads and customers. Connecting your ads to it means every new inquiry lands in one organized place ready for follow-up, so nothing slips through the cracks."],
    "split-testing":["Split testing (A/B testing)","Running two versions of an ad or page against each other, keeping the winner, and repeating. Steady, measured improvement instead of guessing."],
    "multi-campaign":["Multi-campaign structure","Splitting your advertising into several focused campaigns, by service, location, or goal, so each one can be controlled and improved on its own."],
    "roas":["ROAS (return on ad spend)","How many dollars you earn for every dollar spent on ads. A ROAS of 4 means $4 back for every $1 in. It's the simplest gauge of whether ads are paying off."],
    "google-ads":["Google Ads","Ads that show up when someone searches Google for what you offer, putting you in front of people who are looking to buy right now."],
    "meta-ads":["Meta Ads","Ads on Facebook and Instagram that reach the right people by interest, location, and behavior. Great for creating demand, not just capturing it."]
  };

  /* ---- Auto-link known terms inside a blog article body ----
     Wraps only the FIRST occurrence of each term, only in text (never inside
     links, headings, code, or an existing .term), so posts stay readable and
     un-cluttered. No-op on pages without an .article-body (e.g. the homepage,
     where terms are already wrapped in the markup). */
  function autolink(){
    var root = document.querySelector(".article-body");
    if(!root) return;
    var MATCH = [
      [/\blanding pages?\b/i,"landing-page"],
      [/\bretargeting\b/i,"retargeting"],
      [/\bremarketing\b/i,"retargeting"],
      [/\bA\/B testing\b/i,"split-testing"],
      [/\bsplit[- ]testing\b/i,"split-testing"],
      [/\bcall tracking\b/i,"call-tracking"],
      [/\battribution\b/i,"attribution"],
      [/\bROAS\b/,"roas"],
      [/\bCRM\b/,"crm-integration"],
      [/\bGoogle Ads\b/i,"google-ads"],
      [/\bMeta Ads\b/i,"meta-ads"],
      [/\baudience building\b/i,"audience-building"],
      [/\boptimization\b/i,"optimization"]
    ];
    var done = {};
    function skip(node){
      for(var p=node.parentNode; p && p!==root; p=p.parentNode){
        var tag=p.nodeName;
        if(tag==="A"||tag==="CODE"||tag==="PRE"||tag==="BUTTON"||/^H[1-6]$/.test(tag)) return true;
        if(p.classList && p.classList.contains("term")) return true;
      }
      return false;
    }
    MATCH.forEach(function(rule){
      var re=rule[0], key=rule[1];
      if(done[key]) return;
      var walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var node;
      while((node=walker.nextNode())){
        if(skip(node)) continue;
        var m=re.exec(node.nodeValue);
        if(!m) continue;
        var after=node.splitText(m.index);
        after.nodeValue=after.nodeValue.slice(m[0].length);
        var span=document.createElement("span");
        span.className="term"; span.setAttribute("tabindex","0"); span.setAttribute("data-term",key);
        span.textContent=m[0];
        after.parentNode.insertBefore(span, after);
        done[key]=true;
        break;
      }
    });
  }

  /* ---- Popover runtime ---- */
  var mq = window.matchMedia("(max-width:640px)");
  var pop=null, backdrop=null, current=null, hideTimer=null;
  function build(){
    pop=document.createElement("div"); pop.className="glossary-pop"; pop.setAttribute("role","dialog");
    pop.innerHTML='<button class="gp-close" type="button" aria-label="Close">×</button><span class="gp-term"></span><span class="gp-def"></span>';
    document.body.appendChild(pop);
    backdrop=document.createElement("div"); backdrop.className="glossary-backdrop";
    document.body.appendChild(backdrop);
    pop.querySelector(".gp-close").addEventListener("click",hide);
    backdrop.addEventListener("click",hide);
    pop.addEventListener("mouseenter",cancelHide);
    pop.addEventListener("mouseleave",scheduleHide);
  }
  function cancelHide(){ if(hideTimer){ clearTimeout(hideTimer); hideTimer=null; } }
  function scheduleHide(){ cancelHide(); hideTimer=setTimeout(hide,180); }
  function place(el){
    if(mq.matches) return; // mobile: centered via CSS
    var r=el.getBoundingClientRect();
    var top=r.bottom+window.scrollY+8;
    var w=pop.offsetWidth||300;
    var left=r.left+window.scrollX;
    var maxLeft=window.scrollX+document.documentElement.clientWidth-w-12;
    if(left>maxLeft) left=maxLeft;
    if(left<window.scrollX+12) left=window.scrollX+12;
    pop.style.top=top+"px"; pop.style.left=left+"px";
  }
  function show(el){
    var e=G[el.getAttribute("data-term")]; if(!e) return;
    if(!pop) build();
    cancelHide();
    pop.querySelector(".gp-term").textContent=e[0];
    pop.querySelector(".gp-def").textContent=e[1];
    if(mq.matches){ pop.style.top=""; pop.style.left=""; }
    place(el);
    requestAnimationFrame(function(){ pop.classList.add("show"); if(mq.matches&&backdrop) backdrop.classList.add("show"); });
    current=el;
  }
  function hide(){ cancelHide(); if(pop) pop.classList.remove("show"); if(backdrop) backdrop.classList.remove("show"); current=null; }

  document.addEventListener("click",function(ev){
    var t=ev.target.closest&&ev.target.closest(".term");
    if(t){ ev.preventDefault(); (current===t)?hide():show(t); return; }
    if(pop && !(ev.target.closest&&ev.target.closest(".glossary-pop"))) hide();
  });
  document.addEventListener("mouseover",function(ev){
    if(mq.matches) return;
    var t=ev.target.closest&&ev.target.closest(".term");
    if(t) show(t);
  });
  document.addEventListener("mouseout",function(ev){
    if(mq.matches) return;
    var t=ev.target.closest&&ev.target.closest(".term");
    if(t){ var to=ev.relatedTarget; if(!(to&&to.closest&&to.closest(".glossary-pop"))) scheduleHide(); }
  });
  document.addEventListener("keydown",function(ev){
    if(ev.key==="Escape"){ hide(); return; }
    var a=document.activeElement;
    if((ev.key==="Enter"||ev.key===" ")&&a&&a.classList&&a.classList.contains("term")){ ev.preventDefault(); (current===a)?hide():show(a); }
  });
  window.addEventListener("scroll",function(){ if(current&&!mq.matches) hide(); },{passive:true});

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",autolink); else autolink();
})();
