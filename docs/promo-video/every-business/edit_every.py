# "Every business, not three niches" (Bryson, 2026-10-21: "make sure it doesnt isolate niches but it shows that we work
# with every business"): a wall of business types after the hook, other searches floating in around the hook's search,
# and an end-card line that says "for any business".
D = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/videog"
CSS = """.wc{position:relative;display:inline-flex;align-items:center;gap:14px;padding:20px 32px;border-radius:50px;background:#121520;border:2px solid var(--line);font-size:38px;font-weight:700;box-shadow:0 20px 60px -24px #000}
.wc .dot{width:14px;height:14px;border-radius:50%;background:var(--gold2);box-shadow:0 0 16px var(--gold2)}.wc.g{border-color:var(--gold2);color:var(--gold2)}
.qp{position:absolute;display:inline-flex;align-items:center;gap:16px;height:78px;padding:0 30px;border-radius:40px;background:#161922;border:1.5px solid rgba(255,255,255,.08);font-size:31px;color:#C9CCD6;white-space:nowrap}
.qp i{width:26px;height:26px;border-radius:50%;border:4px solid var(--mute);position:relative;flex:none}.qp i::after{content:"";position:absolute;width:11px;height:4px;background:var(--mute);right:-9px;bottom:-4px;transform:rotate(45deg);border-radius:2px}
"""
S12 = """
<!-- S12 every kind of business -->
<section class="scene" id="s12">
  <div class="head" id="s12h" style="font-size:84px"></div>
  <div id="s12w" style="position:absolute;left:40px;right:40px;top:640px;display:flex;flex-wrap:wrap;justify-content:center;gap:26px 22px"></div>
</section>
"""
JS_LOAD = """const WALL=["Detailers","Dentists","Roofers","Online stores","Law firms","Gyms","Salons","Contractors","Restaurants","Clinics","Landscapers","Boutiques","Plumbers","Real estate","Coaches","Auto shops","Med spas","Pet groomers"];
$("s12w").innerHTML=WALL.map((w,i)=>`<span class="wc${w==="Online stores"?" g":""}" id="wc${i}"><span class="dot"></span>${w}</span>`).join("");
const QP=[["plumber near me",70,1345],["custom t-shirts",590,1405],["dentist near me",110,1495],["wedding photographer",470,1565],["dog grooming",80,1655],["roof repair near me",540,1725]];
$("s0pills").innerHTML=QP.map(([q,x,y],i)=>`<div class="qp" id="qp${i}" style="left:${x}px;top:${y}px"><i></i>${q}</div>`).join("");
words($("s12h"),[["Whatever you sell,",0],"\\n",["online or in person.",1]]);
"""
JS_RENDER = """  // S12 every kind of business: the wall pops in one by one and drifts
  if(S[12]) { const s=S[12][0]; wordsIn($("s12h"),t,s-.05); $("s12w").style.transform=`translateY(${-(t-s)*10}px)`;
    WALL.forEach((_,i)=>{const q=pr(t,s+.12+i*.06,.45); const el=$("wc"+i); el.style.opacity=q; el.style.transform=`translateY(${(1-q)*30}px) scale(${.85+.15*q})`;}); }
  // other searches drift in around the hook's search box
  QP.forEach((_,i)=>{const q=pr(t,.9+i*.28,.5); const el=$("qp"+i); el.style.opacity=q*.8; el.style.transform=`translateY(${(1-q)*24+Math.sin(t*1.3+i)*5}px)`;});
"""
for name in ["promo.html", "promo-built.html"]:
    p = f"{D}/{name}"; s = open(p).read()
    if 'id="s12"' in s: print(name, "already"); continue
    def r(a, b):
        global s
        assert a in s, (name, a[:50]); s = s.replace(a, b, 1)
    r("</style></head>", CSS + "</style></head>")
    r("\n<!-- S1 google -->", S12 + "\n<!-- S1 google -->")
    r('<div class="head" id="s0h" style="top:930px;font-size:96px"></div>', '<div class="head" id="s0h" style="top:930px;font-size:96px"></div>\n  <div id="s0pills"></div>')
    r("// Headline words: [text, gold]", "// Headline words: [text, gold]\n" + JS_LOAD.replace('words($("s12h")', '/*s12h*/words($("s12h")'))
    r("  // S1\n", JS_RENDER + "  // S1\n")
    r(">Ads, landing pages and websites</div>", " style=\"top:1035px;font-size:38px\">Ads, landing pages and websites for any business</div>".replace(' style="top:1035px;font-size:38px">', '>'))
    open(p, "w").write(s); print(name, "ok")
