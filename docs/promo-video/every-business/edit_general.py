# General version (Bryson, 2026-10-21: "make it so it works with all businesses that I can work with including ecom").
# Three sample businesses so anyone sees themselves: a detailer (website), a handyman (Google ad, quote page, leads)
# and an online candle shop (Facebook/Instagram ad, product page). The candle is drawn here, no stock photo needed.
import re, base64
D = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/videog"
HANDY = "data:image/jpeg;base64," + base64.b64encode(open(f"{D}/handy.jpg", "rb").read()).decode()
CSS = """.pimg,.lp .hero{overflow:hidden}.pimg svg,.lp .hero svg{position:absolute;inset:0;width:100%;height:100%}
.flame{transform-box:fill-box;transform-origin:50% 100%}
.pw{position:absolute;top:500px;width:560px;height:1120px;transform-origin:0 0}
.lab{position:absolute;width:280px;justify-content:center}
.lf .feat{color:#C9CCD6}
"""
CANDLE = r"""function candle(){return `<svg viewBox="0 0 532 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="cbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1b12"/><stop offset="1" stop-color="#5a3a22"/></linearGradient>
<radialGradient id="cgl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(255,196,110,.55)"/><stop offset="1" stop-color="rgba(255,196,110,0)"/></radialGradient>
<linearGradient id="cgs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,.22)"/><stop offset=".5" stop-color="rgba(255,255,255,.05)"/><stop offset="1" stop-color="rgba(255,255,255,.16)"/></linearGradient>
<linearGradient id="cwx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6ecdc"/><stop offset="1" stop-color="#dcc7a6"/></linearGradient>
<linearGradient id="cfl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff7a1a"/><stop offset=".55" stop-color="#ffbf4a"/><stop offset="1" stop-color="#fff4c8"/></linearGradient></defs>
<rect width="532" height="600" fill="url(#cbg)"/><circle class="cglow" cx="266" cy="250" r="230" fill="url(#cgl)"/>
<rect y="470" width="532" height="130" fill="#20140c"/><rect y="470" width="532" height="2" fill="rgba(255,210,150,.18)"/>
<ellipse cx="266" cy="478" rx="122" ry="15" fill="rgba(0,0,0,.45)"/>
<g opacity=".95"><path d="M398 470c4-40 14-78 34-110" stroke="#6f8a68" stroke-width="5" fill="none"/>
<ellipse cx="410" cy="430" rx="11" ry="26" fill="#8fae86" transform="rotate(-35 410 430)"/><ellipse cx="428" cy="398" rx="10" ry="24" fill="#9bb892" transform="rotate(30 428 398)"/>
<ellipse cx="414" cy="372" rx="9" ry="21" fill="#86a57e" transform="rotate(-40 414 372)"/><ellipse cx="436" cy="352" rx="8" ry="19" fill="#a3bf99" transform="rotate(25 436 352)"/></g>
<rect x="166" y="250" width="200" height="226" rx="26" fill="url(#cgs)" stroke="rgba(255,255,255,.28)" stroke-width="3"/>
<rect x="177" y="300" width="178" height="168" rx="18" fill="url(#cwx)"/><ellipse cx="266" cy="300" rx="89" ry="13" fill="#fbf4e8"/>
<rect x="186" y="352" width="160" height="84" rx="8" fill="#c9a46e"/>
<text x="266" y="381" text-anchor="middle" font-family="Inter,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="#3a2618">EMBER &amp; OAK</text>
<text x="266" y="414" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="24" fill="#2e1d12">Desert Sage</text>
<line x1="266" y1="300" x2="266" y2="283" stroke="#2b1d14" stroke-width="3"/>
<g class="flame"><path d="M266 222c-14 24-12 48 0 60c12-12 14-36 0-60z" fill="url(#cfl)"/><ellipse cx="266" cy="270" rx="5" ry="10" fill="#fffbe8" opacity=".9"/></g>
</svg>`;}
"""
S10_POST_RE = r'<div class="ph"><div class="av">.*?</div><div><b>Northline Auto Detailing</b><span>Sponsored</span></div></div>\s*<div class="pimg" style="background-image:url\([^)]*\)"><div class="heart" id="s10heart">&#9829;</div></div>\s*<div class="cta"><span>Saturday spots open</span><span class="bn" id="s10bn">Book now</span></div>\s*<div class="cap"><b>Northline Auto Detailing</b> Ceramic coating, done in your driveway.</div>'
S10_POST = '''<div class="ph"><div class="av" style="background:#3a2618;color:#F0D27A;font-family:Georgia,serif;font-size:32px;font-style:italic">E</div><div><b>Ember &amp; Oak Candle Co.</b><span>Sponsored</span></div></div>
      <div class="pimg" id="s10img"><div class="heart" id="s10heart">&#9829;</div></div>
      <div class="cta"><span>Free shipping over $40</span><span class="bn" id="s10bn">Shop now</span></div>
      <div class="cap"><b>Ember &amp; Oak Candle Co.</b> Hand-poured soy candles, made in small batches.</div>'''
def s11(LOGO):
    return f'''<section class="scene" id="s11">
  <div class="head" id="s11h"></div>
  <div class="pw" id="s11a" style="left:84px"><div class="phone" style="left:0;top:0"><div class="notch"></div><div class="scr">
    <div class="lp">
      <div class="url">summithandyman.com/quote</div>
      <div class="hero" style="background-image:url({HANDY})"><div class="hc"><div class="eb">Handyman &middot; Mesa, AZ</div><h3>Fixed right, the first time.</h3><div class="rt"><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 4.9 from 130 Google reviews</div></div></div>
      <div class="lf"><div id="s11form"><div class="tl">Get a free quote</div>
        <div class="in" id="s11f1" data-ph="&lt;em&gt;Your name&lt;/em&gt;"><em>Your name</em></div>
        <div class="in" id="s11f2" data-ph="&lt;em&gt;Phone number&lt;/em&gt;"><em>Phone number</em></div>
        <div class="in" id="s11f3" data-ph="&lt;em&gt;What needs fixing?&lt;/em&gt;"><em>What needs fixing?</em></div>
        <div class="go">Get my quote</div></div>
        <div class="done" id="s11done"><div><div class="c">&#10003;</div><b>Got it, Jordan.</b><span>We'll be in touch shortly.</span></div></div></div>
    </div>
    <div class="tap" id="s11tap" style="left:221px;top:914px"></div>
  </div></div></div>
  <div class="pw" id="s11b" style="left:593px"><div class="phone" style="left:0;top:0"><div class="notch"></div><div class="scr">
    <div class="lp">
      <div class="url">emberandoak.com/desert-sage</div>
      <div class="hero" id="s11img"><div class="hc"><div class="eb">Ember &amp; Oak Candle Co.</div><h3>Desert Sage Candle</h3><div class="rt"><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 4.9 from 212 reviews</div></div></div>
      <div class="lf"><div id="s11sform"><div class="tl" style="display:flex;justify-content:space-between"><span>Desert Sage, 9 oz</span><span style="color:var(--gold2)">$28</span></div>
        <div class="in feat">Hand-poured soy wax</div>
        <div class="in feat">About 60 hours of burn time</div>
        <div class="in feat">Free shipping over $40</div>
        <div class="go">Buy now</div></div>
        <div class="done" id="s11sdone"><div><div class="c">&#10003;</div><b>Order placed.</b><span>Thanks, Alex. It ships today.</span></div></div></div>
    </div>
    <div class="tap" id="s11stap" style="left:221px;top:914px"></div>
  </div></div></div>
  <div class="chip lab" id="s11c1" style="left:146px;top:1334px"><span class="dot"></span>Service business</div>
  <div class="chip lab" id="s11c2" style="left:655px;top:1334px"><span class="dot"></span>Online store</div>
  <div class="notif" id="s11no" style="top:1450px"><div class="ico"><img src="{LOGO}" style="width:46px"></div><div><b>New lead: Jordan R.</b><span>Drywall patch, from your Google ad</span></div></div>
</section>'''
S11_JS = """  // S11 two landing pages side by side: a handyman's quote page (a lead) and a candle shop's product page (a sale)
  { const s=S[11][0]; const t=s+(t0-s)*4.6/(S[11][1]-S[11][0]); wordsIn($("s11h"),t,s-.05);
    [["s11a",0,-1],["s11b",.15,1]].forEach(([id,dl,dir])=>{const q=pr(t,s+.05+dl,.6); $(id).style.opacity=q; $(id).style.transform=`translate(${(1-q)*dir*60}px,${(1-q)*80}px) scale(.72)`;});
    ["s11c1","s11c2"].forEach((id,i)=>{const q=pr(t,s+.6+i*.15,.5); $(id).style.opacity=q; $(id).style.transform=`translateY(${(1-q)*20}px)`;});
    const type=(id,txt,a,d)=>{const n=Math.floor(clamp((t-(s+a))/d)*txt.length); $(id).innerHTML=n?txt.slice(0,n):$(id).dataset.ph;};
    type("s11f1","Jordan R.",.8,.45); type("s11f2","(480) 555-0199",1.3,.7); type("s11f3","Drywall patch, TV mount",2.05,.6);
    const tp=clamp((t-(s+2.75))/.6); $("s11tap").style.opacity=tp>0&&tp<1?(1-tp):0; $("s11tap").style.transform=`scale(${.4+tp*1.3})`;
    const dn=pr(t,s+2.95,.4); $("s11form").style.opacity=1-dn; $("s11done").style.opacity=dn;
    const tp2=clamp((t-(s+3.3))/.6); $("s11stap").style.opacity=tp2>0&&tp2<1?(1-tp2):0; $("s11stap").style.transform=`scale(${.4+tp2*1.3})`;
    const dn2=pr(t,s+3.5,.4); $("s11sform").style.opacity=1-dn2; $("s11sdone").style.opacity=dn2;
    const nq=pr(t,s+3.15,.45); $("s11no").style.opacity=nq; $("s11no").style.transform=`translateY(${(1-nq)*120}px)`; }
"""
def sub1(s, old, new, name):
    assert s.count(old) >= 1, (name, old[:60]); return s.replace(old, new, 1)
for name in ["promo.html", "promo-built.html"]:
    p = f"{D}/{name}"; s = open(p).read()
    if "Ember &amp; Oak" in s: print(name, "already"); continue
    logo = re.search(r'<div class="ico"><img src="([^"]*)"', s).group(1)
    s = sub1(s, "</style></head>", CSS + "</style></head>", name)
    # hook: the search cycles through three kinds of business
    s = sub1(s, ">Someone near you just searched</div>", ">Right now, someone is searching for</div>", name)
    s = sub1(s, 'const q="mobile detailer near me", n=Math.floor(clamp((t-.55)/1.25)*q.length);',
        'const QS=[["mobile detailer near me",.45,.7],["handyman near me",1.5,.55],["soy candles",2.4,.45]]; let qq=""; QS.forEach(([q,a,d],k)=>{ if(t<a) return; const nx=k<QS.length-1?QS[k+1][1]:1e9; qq=t>nx-.3?q.slice(0,Math.round(q.length*(1-clamp((t-(nx-.3))/.2)))):q.slice(0,Math.floor(clamp((t-a)/d)*q.length)); });', name)
    s = sub1(s, '$("s0q").textContent=q.slice(0,n);', '$("s0q").textContent=qq;', name)
    s = re.sub(r"const st=i<2\?([\d.]+)\+i\*\.08:([\d.]+)\+\(i-2\)\*\.09", r"const st=i<3?\1+i*.08:\2+(i-3)*.09", s, count=1)
    s = sub1(s, 'words($("s0h"),[["No website?",0],"\\n",["They booked",0],"\\n",["someone else.",1]]);', 'words($("s0h"),[["Can\'t find you?",0],"\\n",["They buy from",0],"\\n",["someone else.",1]]);', name)
    # Google: a handyman
    for a, b in [("ceramic coating near me", "handyman near me"), ("northlinedetailing.com</div><div class=\"t\">Northline Auto Detailing</div><div class=\"d\">Ceramic coating at your home.", "summithandyman.com</div><div class=\"t\">Summit Handyman Co.</div><div class=\"d\">Repairs, installs and odd jobs."),
                 ("Top 10 Detailers Near You", "Top 10 Handymen Near You"), ("Shine Mobile Wash</div><div class=\"d\">Message us for prices", "Fix-It Pros</div><div class=\"d\">Message us for a quote"), ("Auto Detailing in Mesa, AZ", "Handyman Services in Mesa, AZ")]:
        s = sub1(s, a, b, name)
    s = sub1(s, 'words($("s1h"),[["Ready for more?",0],["Top of Google.",1]]);', 'words($("s1h"),[["Top of",0],["Google.",1]]);', name)
    # Facebook / Instagram: the candle shop
    s, n = re.subn(S10_POST_RE, S10_POST, s, count=1, flags=re.S); assert n == 1, (name, "s10")
    # two landing pages
    a = s.index('<section class="scene" id="s11">'); b = s.index("</section>", a) + len("</section>")
    s = s[:a] + s11(logo) + s[b:]
    a = s.index("  // S11 the landing page that ad opens"); b = s.index("  // S7\n", a)
    s = s[:a] + S11_JS + s[b:]
    s = sub1(s, 'words($("s11h"),[["A landing page",0],"\\n",["built to book.",1]]);', 'words($("s11h"),[["Built to turn clicks",0],"\\n",["into customers.",1]]);', name)
    # leads: the handyman's
    for a, b in [("Phone call, 2 min</div><div class=\"wh\">(480) 555-0141 &middot; from your ad", "Phone call, 3 min</div><div class=\"wh\">(480) 555-0178 &middot; Google ad"),
                 ("Full detail quote &middot; website", "TV mounting &middot; website"), ("Ceramic coating &middot; website", "Deck repair &middot; Instagram ad"),
                 ("Interior clean &middot; Google ad", "Drywall patch &middot; Google ad"), ("Ceramic coating, wants Saturday", "Deck repair, wants Saturday")]:
        s = sub1(s, a, b, name)
    s = sub1(s, 'words($("s8a"),[["You do the detailing.",0]]);', 'words($("s8a"),[["You run the business.",0]]);', name)
    s = sub1(s, ">Websites and ads for detailers</div>", ">Ads, landing pages and websites</div>", name)
    # only the scenes in ORDER exist now (booking and reviews are left out of this version)
    s = sub1(s, "[0,1,2,3,4,5,6,7,8,9,10,11].forEach((i)=>", "ORDER.map(o=>o[0]).forEach((i)=>", name)
    s = sub1(s, "  // S4\n  { const s=S[4][0];", "  // S4\n  if(S[4]) { const s=S[4][0];", name)
    s = sub1(s, "  // S5\n  { const s=S[5][0];", "  // S5\n  if(S[5]) { const s=S[5][0];", name)
    # the candle, drawn once and placed twice; its flame flickers
    s = sub1(s, "// Headline words: [text, gold]", CANDLE + '$("s10img").insertAdjacentHTML("afterbegin",candle()); $("s11img").insertAdjacentHTML("afterbegin",candle());\n// Headline words: [text, gold]', name)
    s = sub1(s, "  const t=t0; drawBg(t);", '  const t=t0; drawBg(t);\n  document.querySelectorAll(".flame").forEach((g,i)=>{const k=1+.06*Math.sin(t0*11+i)+.03*Math.sin(t0*17.3+i*2); g.style.transform=`scale(${2-k},${k})`;}); document.querySelectorAll(".cglow").forEach((g)=>{g.style.opacity=.85+.15*Math.sin(t0*9);});', name)
    s = re.sub(r"const ORDER=\[.*?\];", "const ORDER=[[0, 5.4], [1, 2.6], [10, 3.4], [11, 5.6], [3, 5.97], [2, 4.2], [6, 4.4], [7, 5.4], [8, 3.0], [9, 5.9]];", s, count=1)
    open(p, "w").write(s); print(name, "ok")
