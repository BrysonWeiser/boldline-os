# Google profile care beat (Bryson, 2026-10-27: "update the first video we made and add this service and what it
# does"). A new scene after the website: the sample handyman's Google profile, a new 5-star review lands (the count
# ticks up), the owner's reply types in as she says "every review gets a reply", then this week's post slides up as
# she says "a fresh post". The hub's "Reviews" node becomes "Google profile".
D = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/videog"
CSS = """/* google profile (s13) */
.gpf{position:absolute;left:44px;right:44px;top:44px}
.gpf .nm{font-size:44px;font-weight:800}
.gpf .rt{display:flex;align-items:center;gap:14px;margin-top:10px;font-size:30px;color:#C9CCD6}
.gpf .rt b{font-size:32px;color:var(--ink)}
.gpf .sb{font-size:26px;color:var(--mute);margin-top:6px}
.gpf .act{display:flex;gap:14px;margin-top:24px}
.gpf .act span{padding:12px 26px;border-radius:30px;border:1.5px solid rgba(138,180,248,.4);font-size:24px;font-weight:700;color:#8AB4F8}
.rv{position:absolute;left:44px;right:44px;top:300px;border-radius:26px;background:#141720;border:1.5px solid rgba(255,255,255,.07);padding:28px 30px}
.rv .who{display:flex;align-items:center;gap:18px}
.rv .av{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:28px;background:rgba(138,180,248,.16);color:#8AB4F8;flex:none}
.rv .who b{display:block;font-size:30px}.rv .who span{font-size:24px;color:var(--mute)}
.rv .tx{font-size:29px;color:#D9DBE1;line-height:1.38;margin-top:16px}
.rp{margin-top:22px;border-left:4px solid var(--gold);padding:4px 0 4px 22px}
.rp .k{font-size:22px;font-weight:700;color:var(--gold2);letter-spacing:.04em}
.rp .tx{margin-top:6px;font-size:27px;color:#C9CCD6;min-height:76px}
.done13{position:absolute;right:28px;top:28px;display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border-radius:30px;background:rgba(63,203,106,.12);border:2px solid rgba(63,203,106,.55);font-size:22px;font-weight:800;color:#BFE9CC;opacity:0}
.done13 i{font-style:normal;color:var(--green)}
.pst{position:absolute;left:44px;right:44px;top:745px;border-radius:26px;background:#141720;border:2px solid var(--gold);box-shadow:0 0 60px -14px rgba(212,176,90,.45);padding:28px 30px}
.pst .hd{display:flex;align-items:center;justify-content:space-between}
.pst .tx{font-size:30px;line-height:1.36;margin-top:14px;color:#E6E7EC}
.pst .bk{display:inline-block;margin-top:20px;padding:14px 34px;border-radius:30px;background:var(--gold2);color:#15110A;font-size:26px;font-weight:800}
"""
SEC = """
<!-- S13 Google profile, kept busy -->
<section class="scene" id="s13">
  <div class="head" id="s13h"></div>
  <div class="panel" id="s13p" style="left:70px;right:70px;top:560px;height:1040px">
    <div class="gpf"><div class="nm">Summit Handyman Co.</div>
      <div class="rt"><b>4.9</b><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><span id="s13n">(86)</span></div>
      <div class="sb">Handyman in Mesa, AZ &middot; Open now</div>
      <div class="act"><span>Call</span><span>Directions</span><span>Website</span></div></div>
    <div class="rv" id="s13r"><span class="done13" id="s13d"><i>&#10003;</i>Replied</span>
      <div class="who"><div class="av">S</div><div><b>Sarah K.</b><span><span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span> &middot; just now</span></div></div>
      <div class="tx">Fixed our fence gate the same day. Fair price, and he cleaned up after.</div>
      <div class="rp" id="s13rp"><div class="k">Response from the owner</div><div class="tx" id="s13rt"></div></div></div>
    <div class="pst" id="s13s"><div class="hd"><span class="kick" style="font-size:22px">This week's post</span><span class="pill">NEW</span></div>
      <div class="tx">Fall gutter cleaning is booking now. Grab a spot before the first storm.</div>
      <span class="bk" id="s13b">Book</span>
      <div class="tap" id="s13tap" style="left:52px;top:175px"></div></div>
  </div>
</section>
"""
JS_LOAD = """words($("s13h"),[["Your Google profile,",0],"\\n",["kept busy.",1]]);
const R13=2.3, P13=4.2;   // seconds into the scene when she says "Every review" and "fresh post" (apply_flow.py)
const RP13="Thanks Sarah, glad the gate's working right again. Call us anytime.";
"""
JS_RENDER = """  // S13 Google profile: a new review lands (the count ticks up), the owner's reply types in on "every review gets a
  // reply", this week's post slides up on "a fresh post", and its Book button is tapped
  if(S[13]) { const s=S[13][0]; wordsIn($("s13h"),t,s-.05); const pp=pr(t,s+.05,.6); $("s13p").style.opacity=pp; $("s13p").style.transform=`translateY(${(1-pp)*60}px)`;
    const rv=pr(t,s+.7,.55); $("s13r").style.opacity=rv; $("s13r").style.transform=`translateX(${(1-rv)*120}px)`; $("s13n").textContent=rv>.5?"(87)":"(86)";
    const rk=pr(t,s+R13-.15,.4); $("s13rp").style.opacity=rk;
    const n=Math.floor(clamp((t-(s+R13+.05))/1.25)*RP13.length); $("s13rt").textContent=RP13.slice(0,n);
    const dq=pr(t,s+R13+1.4,.4); $("s13d").style.opacity=dq; $("s13d").style.transform=`scale(${.8+.2*dq})`;
    const ps=pr(t,s+P13-.2,.6); $("s13s").style.opacity=ps; $("s13s").style.transform=`translateY(${(1-ps)*140}px)`;
    const tp=clamp((t-(s+P13+1.0))/.6); $("s13tap").style.opacity=tp>0&&tp<1?(1-tp):0; $("s13tap").style.transform=`scale(${.4+tp*1.3})`;
    $("s13b").style.transform=`scale(${1+.08*Math.sin(clamp((t-(s+P13+1.0))/.4)*Math.PI)})`; }
"""
for name in ["promo.html", "promo-built.html"]:
    p = f"{D}/{name}"; s = open(p).read()
    if 'id="s13"' in s: print(name, "already"); continue
    def r(a, b):
        global s
        assert s.count(a) == 1, (name, a[:50], s.count(a)); s = s.replace(a, b, 1)
    r("</style></head>", CSS + "</style></head>")
    r("\n<!-- S7 hub -->", SEC + "\n<!-- S7 hub -->")
    r('words($("s7h")', JS_LOAD + 'words($("s7h")')
    r("  // S7\n", JS_RENDER + "  // S7\n")
    r('["Reviews",210,1140]', '["Google profile",210,1140]')
    open(p, "w").write(s); print(name, "ok")
