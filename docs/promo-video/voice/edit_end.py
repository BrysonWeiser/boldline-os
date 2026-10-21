# End card v6: one wrapper for a slow drift-in, a shine layer on the address, and gentler entrances tied to her voice.
import re
D = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad/video"
NEW9 = '''  // S9: logo, name and line come up one after another on gentle in-and-out curves (no letter-spacing reflow, which
  // jitters); the address rises as she says it, then one slow shine; the whole card drifts in a touch so the hold
  // never looks frozen.
  { const s=S[9][0], q=(a,d)=>easeIO((t-(s+a))/d);
    $("s9in").style.transform=`scale(${1+.03*easeIO((t-s)/(DUR-s))})`;
    const l=q(0,.9); $("s9logo").style.opacity=l; $("s9logo").style.transform=`translateY(${(1-l)*24}px) scale(${.88+.12*l})`; $("s9logo").style.filter=`blur(${(1-l)*10}px) drop-shadow(0 0 ${40*l}px rgba(212,176,90,.5))`;
    const n=q(.25,.8); $("s9n").style.opacity=n; $("s9n").style.transform=`translateY(${(1-n)*34}px)`; $("s9n").style.filter=`blur(${(1-n)*8}px)`;
    const g=q(.5,.7); $("s9t").style.opacity=g; $("s9t").style.transform=`translateY(${(1-g)*24}px)`;
    const b=q(URL9-.45,.7); $("s9b").style.opacity=b; $("s9b").style.transform=`translateY(${(1-b)*30}px)`; $("s9b").style.filter=`blur(${(1-b)*6}px)`;
    const u=q(URL9-.1,.75); $("s9u").style.opacity=u; $("s9u").style.transform=`translateY(${(1-u)*40}px) scale(${.96+.04*u})`; $("s9u").style.filter=`blur(${(1-u)*10}px)`;
    const sh=clamp((t-(s+URL9+.9))/1.3); $("s9sh").style.backgroundPosition=`${120-140*easeIO(sh)}% 0`; $("s9sh").style.opacity=sh>0&&sh<1?1:0; }
'''
for name in ["promo.html", "promo-built.html"]:
    p = f"{D}/{name}"; s = open(p).read()
    if 'id="s9in"' not in s:
        a = s.index('<section class="scene" id="s9">') + len('<section class="scene" id="s9">')
        b = s.index("</section>", a)
        s = s[:a] + '\n<div id="s9in" style="position:absolute;inset:0;transform-origin:50% 50%">' + s[a:b] + "</div>\n" + s[b:]
        s = s.replace('text-shadow:0 0 50px rgba(212,176,90,.35)">boldlinemedia.com</div>',
            'text-shadow:0 0 50px rgba(212,176,90,.35)">boldlinemedia.com<span id="s9sh" aria-hidden="true" style="position:absolute;left:0;right:0;top:0;color:transparent;text-shadow:none;background:linear-gradient(100deg,transparent 38%,rgba(255,248,222,.9) 50%,transparent 62%);background-size:260% 100%;-webkit-background-clip:text;background-clip:text;opacity:0">boldlinemedia.com</span></div>', 1)
        assert 'id="s9sh"' in s, name
    s, n1 = re.subn(r"  \{ const s=S\[9\]\[0\]; const l=pr\(t,s,\.8\);.*?\n.*?\n.*?\n.*?\$\(\"s9u\"\)\.style\.opacity=pr\(t,s\+[\d.]+,\.5\); \}\n", NEW9, s, flags=re.S)
    if "const URL9=" not in s: s = s.replace("const DUR=ACC;", "const DUR=ACC;\nconst URL9=1.68;   // seconds into the end card when she starts saying the address (apply_flow.py)", 1)
    assert n1 == 1 or "S9: logo, name and line" in s, (name, n1)
    open(p, "w").write(s)
    print(name, "ok", n1)
