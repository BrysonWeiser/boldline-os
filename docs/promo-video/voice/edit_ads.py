# v7: the ads section. Google (existing) > Facebook and Instagram (new s10) > the landing page the ad opens (new s11),
# and Meta Ads + Landing pages join the hub. Bryson, 2026-10-21: "we should showcase the ads a bit more (meta and
# google) and that they are paired with a landing page".
import re
D = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/video"
CSS = """/* social feed (s10) */
.feed{position:absolute;left:0;right:0;top:0}
.fbar{height:150px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 34px 22px;font-family:var(--D);font-size:42px;font-weight:700}
.fbar i{display:inline-block;width:38px;height:38px;border-radius:11px;border:4px solid #E6E6E6;margin-left:22px}
.stories{display:flex;gap:20px;padding:8px 28px 26px}
.stories span{width:92px;height:92px;border-radius:50%;flex:none;background:#1b1e28;box-shadow:0 0 0 4px #07080B,0 0 0 8px rgba(240,210,122,.65)}
.ph{display:flex;align-items:center;gap:18px;padding:22px 26px;border-top:1.5px solid rgba(255,255,255,.06)}
.ph .av{width:70px;height:70px;border-radius:50%;background:#0b0c10;border:2px solid var(--line);display:grid;place-items:center;flex:none}
.ph b{display:block;font-size:27px}.ph span{font-size:22px;color:var(--mute)}
.pimg{position:relative;height:540px;background-size:cover;background-position:55% 50%}
.heart{position:absolute;left:50%;top:50%;font-size:190px;color:#fff;text-shadow:0 10px 40px rgba(0,0,0,.5);opacity:0}
.cta{display:flex;align-items:center;justify-content:space-between;padding:18px 26px;background:#12141B;font-size:25px;font-weight:700}
.cta .bn{padding:14px 26px;border-radius:14px;background:var(--gold2);color:#15110A;font-size:25px;font-weight:800}
.cap{padding:18px 26px;font-size:23px;color:#C9CCD6;line-height:1.4}
.chip{position:absolute;display:inline-flex;align-items:center;gap:12px;padding:16px 26px;border-radius:40px;background:#121520;border:2px solid var(--line);font-size:30px;font-weight:700;box-shadow:0 20px 60px -20px #000}
.chip .dot{width:14px;height:14px;border-radius:50%;background:var(--gold2);box-shadow:0 0 16px var(--gold2)}
/* landing page (s11) */
.lp{position:absolute;left:0;right:0;top:0}
.lp .url{position:absolute;top:82px;left:44px;right:44px;height:58px;border-radius:30px;background:rgba(20,22,30,.88);display:flex;align-items:center;justify-content:center;font-size:21px;color:#B9BDC8;font-family:var(--M);z-index:3}
.lp .hero{position:relative;height:600px;background-size:cover;background-position:60% 50%}
.lp .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,6,8,.25),rgba(5,6,8,.45) 45%,rgba(5,6,8,.97))}
.lp .hc{position:absolute;left:34px;right:34px;bottom:56px;z-index:2}
.lp .eb{font-size:21px;color:#E9C98A;font-weight:600}
.lp h3{font-family:var(--D);font-size:54px;line-height:1.03;margin:10px 0 12px}
.lp .rt{font-size:23px;color:#E9DFC4}
.lf{position:relative;margin:-36px 24px 0;border-radius:26px;background:#12141B;border:1.5px solid rgba(255,255,255,.09);padding:26px;height:452px}
.lf .tl{font-size:29px;font-weight:800;margin-bottom:16px}
.lf .in{height:74px;border-radius:16px;background:#1A1D27;border:1.5px solid rgba(255,255,255,.08);margin-bottom:13px;display:flex;align-items:center;padding:0 22px;font-size:26px;color:#EDEDED}
.lf .in em{color:#6E7382;font-style:normal}
.lf .go{height:84px;border-radius:18px;background:#E8A060;color:#14100A;font-weight:800;font-size:29px;display:grid;place-items:center}
.lf .done{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px;opacity:0}
.lf .done .c{width:96px;height:96px;margin:0 auto 18px;border-radius:50%;background:var(--green);display:grid;place-items:center;color:#06210f;font-weight:900;font-size:54px}
.lf .done b{display:block;font-size:32px;margin-bottom:8px}.lf .done span{font-size:25px;color:#BFE9CC}
"""
def html(PHOTO, LOGO):
    return f"""
<!-- S10 facebook and instagram -->
<section class="scene" id="s10">
  <div class="head" id="s10h"></div>
  <div class="phone" id="s10ph" style="left:260px;top:560px"><div class="notch"></div><div class="scr">
    <div class="feed" id="s10feed">
      <div class="fbar"><span>Feed</span><span><i></i><i></i></span></div>
      <div class="stories"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="ph"><div class="av"><img src="{LOGO}" style="width:38px"></div><div><b>Northline Auto Detailing</b><span>Sponsored</span></div></div>
      <div class="pimg" style="background-image:url({PHOTO})"><div class="heart" id="s10heart">&#9829;</div></div>
      <div class="cta"><span>Saturday spots open</span><span class="bn" id="s10bn">Book now</span></div>
      <div class="cap"><b>Northline Auto Detailing</b> Ceramic coating, done in your driveway.</div>
    </div>
    <div class="tap" id="s10tap" style="left:374px;top:930px"></div>
  </div></div>
  <div class="chip" id="s10c1" style="left:22px;top:900px"><span class="dot"></span>Facebook</div>
  <div class="chip" id="s10c2" style="left:812px;top:1270px"><span class="dot"></span>Instagram</div>
</section>

<!-- S11 landing page -->
<section class="scene" id="s11">
  <div class="head" id="s11h"></div>
  <div class="phone" id="s11ph" style="left:260px;top:560px"><div class="notch"></div><div class="scr">
    <div class="lp">
      <div class="url">northlinedetailing.com/ceramic</div>
      <div class="hero" style="background-image:url({PHOTO})"><div class="hc"><div class="eb">Ceramic coating &middot; Mesa, AZ</div><h3>Ceramic coating, done in your driveway.</h3><div class="rt"><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 4.9 from 84 Google reviews</div></div></div>
      <div class="lf"><div id="s11form"><div class="tl">Get your price in 60 seconds</div>
        <div class="in" id="s11f1" data-ph="&lt;em&gt;Your name&lt;/em&gt;"><em>Your name</em></div>
        <div class="in" id="s11f2" data-ph="&lt;em&gt;Phone number&lt;/em&gt;"><em>Phone number</em></div>
        <div class="in" id="s11f3" data-ph="&lt;em&gt;Car and service&lt;/em&gt;"><em>Car and service</em></div>
        <div class="go">Get my price</div></div>
        <div class="done" id="s11done"><div><div class="c">&#10003;</div><b>Got it, Jordan.</b><span>We'll be in touch shortly.</span></div></div></div>
    </div>
    <div class="tap" id="s11tap" style="left:221px;top:914px"></div>
  </div></div>
  <div class="notif" id="s11no" style="top:1640px"><div class="ico"><img src="{LOGO}" style="width:46px"></div><div><b>New lead: Jordan R.</b><span>Ceramic coating, from your Instagram ad</span></div></div>
</section>
"""
JS = """  // S10 Facebook and Instagram: the sample detailer's sponsored post scrolls into the feed, gets a like, "Book now" is tapped
  { const s=S[10][0]; const t=s+(t0-s)*4.6/(S[10][1]-S[10][0]); wordsIn($("s10h"),t,s-.05);
    const pp=pr(t,s+.05,.7); $("s10ph").style.opacity=pp; $("s10ph").style.transform=`translateY(${(1-pp)*90}px) rotate(${(1-pp)*3}deg)`;
    $("s10feed").style.transform=`translateY(${(1-easeIO((t-(s+.35))/1.2))*300}px)`;
    ["s10c1","s10c2"].forEach((id,i)=>{const q=pr(t,s+.8+i*.25,.6); $(id).style.opacity=q; $(id).style.transform=`translateY(${(1-q)*30+Math.sin((t-s)*1.6+i*2)*6}px)`;});
    const hq=clamp((t-(s+2.0))/.8); $("s10heart").style.opacity=hq>0&&hq<1?Math.sin(hq*Math.PI):0; $("s10heart").style.transform=`translate(-50%,-50%) scale(${.5+hq*.9})`;
    const tp=clamp((t-(s+3.4))/.6); $("s10tap").style.opacity=tp>0&&tp<1?(1-tp):0; $("s10tap").style.transform=`scale(${.4+tp*1.3})`;
    $("s10bn").style.transform=`scale(${1+.08*Math.sin(clamp((t-(s+3.4))/.4)*Math.PI)})`; }
  // S11 the landing page that ad opens: the form fills, is sent, and the lead lands
  { const s=S[11][0]; const t=s+(t0-s)*4.6/(S[11][1]-S[11][0]); wordsIn($("s11h"),t,s-.05);
    const pp=pr(t,s+.05,.6); $("s11ph").style.opacity=pp; $("s11ph").style.transform=`translateY(${(1-pp)*80}px)`;
    const type=(id,txt,a,d)=>{const n=Math.floor(clamp((t-(s+a))/d)*txt.length); $(id).innerHTML=n?txt.slice(0,n):$(id).dataset.ph;};
    type("s11f1","Jordan R.",1.0,.5); type("s11f2","(480) 555-0199",1.6,.8); type("s11f3","SUV, ceramic coating",2.5,.6);
    const tp=clamp((t-(s+3.25))/.6); $("s11tap").style.opacity=tp>0&&tp<1?(1-tp):0; $("s11tap").style.transform=`scale(${.4+tp*1.3})`;
    const dn=pr(t,s+3.5,.4); $("s11form").style.opacity=1-dn; $("s11done").style.opacity=dn;
    const nq=pr(t,s+3.7,.45); $("s11no").style.opacity=nq; $("s11no").style.transform=`translateY(${(1-nq)*120}px)`; }
"""
NODES = 'const NODES=[["Google Ads",540,620],["Meta Ads",773,772],["Landing pages",870,1140],["Website",773,1508],["Booking",540,1660],["Calls & forms",307,1508],["Reviews",210,1140],["Your portal",307,772]];'
for name in ["promo.html", "promo-built.html"]:
    p = f"{D}/{name}"; s = open(p).read()
    if 'id="s10"' in s: print(name, "already"); continue
    photo = re.search(r'<div class="hero" style="background-image:url\(([^)]*)\)', s).group(1)
    logo = re.search(r'<div class="ico"><img src="([^"]*)"', s).group(1)
    s = s.replace("</style></head>", CSS + "</style></head>", 1)
    s = s.replace("\n<!-- S7 hub -->", html(photo, logo) + "\n<!-- S7 hub -->", 1)
    s = re.sub(r'const NODES=\[.*?\];', NODES, s, count=1)
    s = s.replace('words($("s7h"),', 'words($("s10h"),[["Seen on Facebook",0],"\\n",["and Instagram.",1]]);\nwords($("s11h"),[["A landing page",0],"\\n",["built to book.",1]]);\nwords($("s7h"),', 1)
    s = s.replace("[0,1,2,3,4,5,6,7,8,9].forEach((i)=>", "[0,1,2,3,4,5,6,7,8,9,10,11].forEach((i)=>", 1)
    s = s.replace("  // S7\n", JS + "  // S7\n", 1)
    for k in ['id="s10"', 'id="s11"', '"Meta Ads"', "S[10][0]", "S[11][0]", "8,9,10,11]"]: assert k in s, (name, k)
    open(p, "w").write(s); print(name, "ok")
