# Stage 3: put the new timings into the video page (scene lengths + the words tied to her voice).
import json, re, sys
D = "/tmp/claude-0/-home-user-boldline-os/d9722fb2-4d16-5f71-986a-70a555565df3/scratchpad"
f = json.load(open(f"{D}/cbg/flow.json")); seg = f["seg"]; LEAD = 0.2
start = {}; acc = 0.0
for sid, d in f["order"]: start[sid] = acc; acc += d
for name in ["promo.html", "promo-built.html"]:
    p = f"{D}/videog/{name}"; s = open(p).read()
    s, n1 = re.subn(r"const ORDER=\[.*?\];", "const ORDER=" + json.dumps(f["order"]) + ";", s)
    # S0 headline: "No website?" and "They booked someone else." appear as she says each
    s, n2 = re.subn(r"i<3\?[\d.]+\+i\*\.08:[\d.]+\+\(i-3\)\*\.09", f"i<3?{seg['s0.1']+0.05:.2f}+i*.08:{seg['s0.2']+0.05:.2f}+(i-3)*.09", s)
    # S8: "We bring the customers." lands on her words (offset inside the scene)
    s, n3 = re.subn(r'wordsIn\(\$\("s8b"\),t,s\+[\d.]+\)', f'wordsIn($("s8b"),t,s+{seg["s8.1"]-start[8]-0.05:.2f})', s)
    # S9: the web address fades in as she starts saying it
    s, n4 = re.subn(r"const URL9=[\d.]+;", f"const URL9={seg['s9.url']-start[9]:.2f};", s)
    # S13: the owner's reply types on "Every review gets a reply", this week's post rises on "fresh post"
    s, n5 = re.subn(r"const R13=[\d.]+, P13=[\d.]+;", f"const R13={seg['s13.1']-start[13]:.2f}, P13={seg['s13.post']-start[13]:.2f};", s)
    assert (n1, n2, n3, n4, n5) == (1, 1, 1, 1, 1), (name, n1, n2, n3, n4, n5)
    open(p, "w").write(s)
print("ok", f["order"], {k: seg[k] for k in ("s0.1", "s0.2", "s8.1", "s9.url")})
