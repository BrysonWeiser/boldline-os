(function(){
  var tabs = document.querySelectorAll('.tab');
  var panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(function(tab){
    tab.addEventListener('click', function(){
      var target = tab.getAttribute('data-tab');
      tabs.forEach(function(t){ t.classList.toggle('active', t===tab); t.setAttribute('aria-selected', t===tab ? 'true' : 'false'); });
      panels.forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-panel')===target); });
    });
  });
})();

(function(){
  var modal = document.getElementById('recModal');
  if(!modal) return;
  var trigger = document.getElementById('openRecommender');
  var closeBtn = document.getElementById('recClose');
  var form = document.getElementById('recForm');
  var result = document.getElementById('recResult');
  var submit = document.getElementById('recSubmit');
  var answers = {};

  function openModal(){ modal.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(){ modal.hidden = true; document.body.style.overflow = ''; }
  function reset(){
    answers = {};
    result.hidden = true; form.hidden = false; submit.disabled = true;
    modal.querySelectorAll('.opts button').forEach(function(b){ b.classList.remove('sel'); });
  }

  // Trigger degrades to a real Calendly link with JS off; here we upgrade it.
  if(trigger){ trigger.addEventListener('click', function(e){ e.preventDefault(); reset(); openModal(); }); }
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !modal.hidden) closeModal(); });

  modal.querySelectorAll('.q').forEach(function(q){
    var key = q.getAttribute('data-q');
    q.querySelectorAll('.opts button').forEach(function(b){
      b.addEventListener('click', function(){
        answers[key] = b.getAttribute('data-val');
        q.querySelectorAll('.opts button').forEach(function(x){ x.classList.toggle('sel', x === b); });
        submit.disabled = !(answers.budget && answers.type && answers.channel);
      });
    });
  });

  var FAMILIES = {
    google:   { tab:'google',   label:'Google Ads',       tiers:{ tiny:'Launch System', low:'Launch System', mid:'Growth System', midplus:'Growth System', high:'Acquisition System' } },
    meta:     { tab:'meta',     label:'Meta Ads',         tiers:{ tiny:'Launch System', low:'Launch System', mid:'Growth System', midplus:'Growth System', high:'Acquisition System' } },
    combined: { tab:'combined', label:'Combined Systems', tiers:{ midplus:'Full System: Growth', high:'Full System: Acquisition' } },
    ecom:     { tab:'ecom',     label:'E-Commerce',       tiers:{ tiny:'Store Launch', low:'Store Launch', mid:'Store Growth', midplus:'Store Growth', high:'Store Domination' } }
  };

  // Running both platforms needs $5,000/mo of ad budget, so the recommender must not
  // recommend one below that. Falling back to a single channel here is the same honest
  // advice the pricing page gives: a split small budget means neither side learns.
  var COMBO_MIN_BAND = { midplus:1, high:1 };

  function pickFamily(){
    // Below the managed floor there is no monthly plan to recommend, on any platform,
    // so platform choice is moot here. The sub-floor hand-off lives on the Google
    // panel, so that is the tab this result points at.
    if(answers.budget === 'tiny') return 'google';
    if(answers.type === 'ecom') return 'ecom';
    var wantsBoth = (answers.type === 'both') || (answers.channel === 'ads');
    if(wantsBoth) return COMBO_MIN_BAND[answers.budget] ? 'combined'
      : (answers.channel === 'social' ? 'meta' : 'google');
    // local or unsure -> infer from how they get clients today
    if(answers.channel === 'social') return 'meta';
    // word of mouth, search, or nothing yet -> capture high-intent demand first
    return 'google';
  }

  // Leads with the pain in their CURRENT way of getting clients, then frames the
  // package as the fix. Honest -- no invented stats, just the real gap.
  function recBody(channel, fam, tierName, label){
    var pain = {
      wordofmouth: 'Right now, new business mostly comes down to who happens to refer you. Strong some months, quiet the next, and never something you can count on.',
      search: 'You show up in search some of the time, but the competitors ranking and bidding above you are the ones getting the call first.',
      social: 'A following feels good, but it doesn’t pay the bills until it turns into booked customers, and right now that jump is left to chance.',
      ads: 'You’re already paying for ads, but without tight tracking and steady optimization it’s hard to know what’s actually working and what’s just burning budget.',
      none: 'Right now there’s no real system bringing customers in, so every week, leads you could be winning are quietly going to a competitor who has one.'
    };
    var fix = {
      google: 'puts you in front of people the exact moment they search for what you do, with a landing page built to turn that click into a booked call',
      meta: 'puts scroll-stopping creative in front of the right people and turns that attention into booked customers, steadily instead of by luck',
      combined: 'runs search and social as one system, so the demand you capture and the demand you create both feed the same steady pipeline',
      ecom: 'is built around product-led campaigns and real return on ad spend, so every dollar is tied to actual sales instead of vanity metrics'
    };
    return (pain[channel] || pain.none) + ' The ' + tierName + ' on ' + label + ' ' + fix[fam] + '.';
  }

  submit.addEventListener('click', function(){
    var fam = pickFamily();
    var tierKey = answers.budget;
    var f = FAMILIES[fam];
    var tierName = f.tiers[tierKey];
    document.getElementById('recHeadline').innerHTML =
      'We’d start you with the <strong>' + tierName + '</strong> on <strong>' + f.label + '</strong>.';
    var why = recBody(answers.channel, fam, tierName, f.label);
    // A sub-floor budget gets a different pitch entirely: it is not a smaller plan, it
    // is a different product, and pretending otherwise sets up a failure.
    // A sub-floor budget gets an honest answer and still becomes a lead. What is offered
    // instead is decided on the call, not here. (Reasoning: KB `pricing-model`. This file is
    // served to the public, comments included, so it does not belong on the page.)
    if(answers.budget === 'tiny'){
      why = 'Honestly, at under $500 a month in ad budget a monthly plan is not the right fit. There is not enough data coming through for anyone to optimize meaningfully, so you would be paying a monthly minimum for very little. That does not mean we cannot help. Book a call and we will tell you straight what we would do at your budget, and what it would cost. If the answer is that you should wait, we will say that too.';
    }
    // Someone who asked for both and got one deserves the reason, or it reads as a
    // downsell. It is the opposite: it is the advice that makes their budget work.
    if(fam !== 'combined' && (answers.type === 'both' || answers.channel === 'ads')){
      why += ' Running Google and Meta together starts at $5,000 a month in ad budget. Below that, splitting it means neither side gets enough data to learn, so we put the whole budget behind one channel first and add the second when the numbers earn it.';
    }
    document.getElementById('recWhy').textContent = why;
    var rf = document.getElementById('recEmailForm'), rd = document.getElementById('recEmailDone');
    if(rf){ rf.reset(); rf.hidden = false; var recd = rf.querySelector('#recRecommended'); if(recd) recd.value = tierName + ' on ' + f.label; }
    if(rd) rd.hidden = true;
    var recBook = document.getElementById('recBook');
    if(recBook) recBook.setAttribute('data-pkg', tierName + ' on ' + f.label);  // so Book a Call prefills the recommended package
    document.getElementById('recSee').onclick = function(){
      closeModal();
      var tabBtn = document.querySelector('.tab[data-tab="' + f.tab + '"]');
      if(tabBtn){ tabBtn.click(); }
      var svc = document.getElementById('services');
      if(svc){ if(window.blScrollTo){ window.blScrollTo(svc); } else { svc.scrollIntoView({ behavior:'smooth' }); } }
    };
    form.hidden = true; result.hidden = false;
  });

  document.getElementById('recRestart').addEventListener('click', reset);
})();

(function(){
  var header = document.querySelector('header');
  if(!header) return;
  header.classList.add('nav-in');
  var mcta = document.getElementById('mobileCta');
  var lastY = window.scrollY;
  var runStartY = lastY;  // scroll position where the current up/down run began
  var runDir = 0;         // 1 = running down, -1 = running up, 0 = none yet
  var onScroll = function(){
    var y = window.scrollY;
    header.classList.toggle('scrolled', y > 12);
    if(mcta) mcta.classList.toggle('show', y > 700);

    // Auto-hide on scroll down, reveal on scroll up (keeps the pill nav
    // out of the way of content but always one upward swipe/scroll away).
    // Tracks distance travelled since the last direction change rather than
    // frame-to-frame delta, since trackpad/momentum scrolling fires many
    // events with only a few px each -- a per-event threshold never trips.
    var mobileOpen = header.querySelector('.nav-mobile.open');
    var dir = y > lastY ? 1 : (y < lastY ? -1 : runDir);
    if(dir !== runDir){ runStartY = lastY; runDir = dir; }
    lastY = y;
    var traveled = y - runStartY;
    if(y < 80 || mobileOpen){
      header.classList.remove('nav-hidden');
    } else if(dir === 1 && traveled > 60){
      header.classList.add('nav-hidden');
    } else if(dir === -1 && traveled < -10){
      header.classList.remove('nav-hidden');
    }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive:true });
  var toggle = header.querySelector('.nav-toggle');
  var mobile = header.querySelector('.nav-mobile');
  if(toggle && mobile){
    toggle.addEventListener('click', function(){
      var open = mobile.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mobile.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        mobile.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();

(function(){
  function encode(data){ return Object.keys(data).map(function(k){ return encodeURIComponent(k)+"="+encodeURIComponent(data[k]); }).join("&"); }
  function submitNetlify(form, onOk, onErr){
    var data = {}; new FormData(form).forEach(function(v,k){ data[k]=v; });
    fetch("/", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body: encode(data) })
      .then(function(r){ r.ok ? onOk() : (onErr && onErr()); })
      .catch(function(){ onErr && onErr(); });
  }

  var lead = document.getElementById('leadForm');
  var leadOk = document.getElementById('formSuccess');
  if(lead){
    lead.addEventListener('submit', function(e){
      e.preventDefault();
      if(!lead.checkValidity()){ lead.reportValidity(); return; }
      var btn = lead.querySelector('button[type=submit]');
      if(btn){ btn.disabled = true; btn.textContent = "Sending…"; }
      submitNetlify(lead, function(){
        lead.style.display = "none";
        if(leadOk) leadOk.style.display = "block";
      }, function(){
        if(btn){ btn.disabled = false; btn.textContent = "Send Message"; }
        alert("Something went wrong. Please email theboldlinemedia@gmail.com.");
      });
    });
  }

  // ── Step-by-step contact wizard: submits to the SAME Netlify "contact" form
  // (fields packed into name/business/email/message) so notifications + the
  // OS leads pipeline keep working with zero backend change.
  var wiz = document.getElementById('leadWiz');
  if(wiz){
    var answers = { platform:'', budget:'' };
    var steps = [].slice.call(wiz.querySelectorAll('.wiz-step'));
    var dots  = [].slice.call(wiz.querySelectorAll('.wdot'));
    var wback = document.getElementById('wizBack');
    var cur = 0;
    function wshow(i){
      cur = i;
      steps.forEach(function(st,j){ st.hidden = j!==i; });
      dots.forEach(function(d,j){ d.classList.toggle('on', j<=i); });
      wback.hidden = i===0;
      var inp = steps[i].querySelector('input');
      if(inp) setTimeout(function(){ try{ inp.focus({preventScroll:true}); }catch(e){} }, 60);
    }
    [].slice.call(wiz.querySelectorAll('.opts')).forEach(function(grp){
      var key = grp.getAttribute('data-key');
      [].slice.call(grp.querySelectorAll('button')).forEach(function(b){
        b.addEventListener('click', function(){
          [].slice.call(grp.querySelectorAll('button')).forEach(function(x){ x.classList.remove('sel'); });
          b.classList.add('sel');
          answers[key] = b.getAttribute('data-val');
          setTimeout(function(){ wshow(Math.min(cur+1, steps.length-1)); }, 160);
        });
      });
    });
    wback.addEventListener('click', function(){ if(cur>0) wshow(cur-1); });
    function step2ok(){
      var biz = document.getElementById('wf-business').value.trim();
      var err = document.getElementById('wizErr2');
      if(!biz){ err.style.display='block'; return false; }
      err.style.display='none'; return true;
    }
    document.getElementById('wizNext2').addEventListener('click', function(){ if(step2ok()) wshow(3); });
    function wizSubmit(){
      var nm = document.getElementById('wf-name').value.trim();
      var em = document.getElementById('wf-email').value.trim();
      var err = document.getElementById('wizErr3');
      if(!nm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ err.style.display='block'; return; }
      err.style.display='none';
      var btn = document.getElementById('wizSend');
      btn.disabled = true; btn.textContent = 'Sending\u2026';
      var msgParts = [
        'Platform: ' + (answers.platform || '-'),
        'Ad budget: ' + (answers.budget || '-')
      ];
      var site = document.getElementById('wf-website').value.trim();
      var ph = document.getElementById('wf-phone').value.trim();
      if(site) msgParts.push('Website: ' + site);
      if(ph) msgParts.push('Phone: ' + ph);
      msgParts.push('(via step-by-step contact)');
      var data = {
        'form-name':'contact', 'bot-field':'',
        name: nm, email: em,
        business: document.getElementById('wf-business').value.trim(),
        message: msgParts.join('\n')
      };
      fetch('/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: encode(data) })
        .then(function(r){
          if(!r.ok) throw 0;
          wiz.style.display = 'none';
          var orDiv = document.querySelector('.contact-or');
          if(orDiv) orDiv.style.display = 'none';
          if(leadOk) leadOk.style.display = 'block';
        })
        .catch(function(){
          btn.disabled = false; btn.textContent = 'Send \u2192';
          alert('Something went wrong. Please email theboldlinemedia@gmail.com.');
        });
    }
    document.getElementById('wizSend').addEventListener('click', wizSubmit);
    wiz.addEventListener('keydown', function(e){
      if(e.key !== 'Enter') return;
      e.preventDefault();
      if(cur===2){ if(step2ok()) wshow(3); }
      else if(cur===3){ wizSubmit(); }
    });
  }

  var rform = document.getElementById('recEmailForm');
  var rdone = document.getElementById('recEmailDone');
  if(rform){
    rform.addEventListener('submit', function(e){
      e.preventDefault();
      if(!rform.checkValidity()){ rform.reportValidity(); return; }
      submitNetlify(rform, function(){ rform.hidden = true; if(rdone) rdone.hidden = false; });
    });
  }
})();

/* Draw the process timeline (rail + step nodes) when it scrolls into view. */
(function(){
  var tl = document.querySelector('.timeline');
  if(!tl) return;
  var show = function(){ tl.classList.add('in'); };
  if(!('IntersectionObserver' in window)){ show(); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ show(); io.disconnect(); } });
  // Same hardening as the .sr reveals: the huge TOP rootMargin means anything
  // jumped past still counts as intersecting, so the section can't get stuck
  // hidden (threshold .25 alone left the whole timeline blank after a jump).
  }, { rootMargin: '12000px 0px -7% 0px', threshold: 0.06 });
  io.observe(tl);
})();

/* Nav-link click -> glide + soft fade to the section (Option 3).
   Toggle NAV.fade=false for "Option 1" (glide + settle, no veil). SEO-safe:
   only the transition animates; content is never hidden. Respects reduced-motion. */
(function(){
  var NAV = { glide:true, fade:true, arriveCue:true, duration:820, veilPeak:0.7 };
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var root = document.documentElement;
  root.style.scrollBehavior = 'auto'; // JS owns the scroll now (rAF glide, or an instant jump for reduced-motion); CSS 'smooth' stays as the no-JS fallback

  var veil = null;
  function getVeil(){
    if(!veil){ veil = document.createElement('div'); veil.id = 'navFade'; document.body.appendChild(veil); }
    return veil;
  }
  function headerOffset(){
    var ni = document.querySelector('.nav-inner');
    return (ni ? ni.getBoundingClientRect().height : 52) + 26;
  }
  function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2; }

  var rafId = null;
  function cancelAnim(){ if(rafId){ cancelAnimationFrame(rafId); rafId = null; } }

  function arriveCue(target){
    if(!NAV.arriveCue || reduce) return;
    target.classList.remove('nav-arrive');
    void target.offsetWidth;                 // reflow so the settle can replay
    target.classList.add('nav-arrive');
    setTimeout(function(){ target.classList.remove('nav-arrive'); }, 650);
  }

  function scrollToEl(target){
    if(!target) return;
    var startY = window.pageYOffset || root.scrollTop || 0;
    var maxY = Math.max(0, (document.body.scrollHeight || 0) - window.innerHeight);
    var destY = Math.min(maxY, Math.max(0, target.getBoundingClientRect().top + startY - headerOffset()));
    var dist = destY - startY;

    if(reduce || !NAV.glide || Math.abs(dist) < 4){ window.scrollTo(0, destY); arriveCue(target); return; }

    var dur = Math.min(1200, Math.max(520, NAV.duration * Math.min(1.4, Math.abs(dist)/900)));
    var vEl = NAV.fade ? getVeil() : null;
    var start = null;
    cancelAnim();

    function cleanup(){
      window.removeEventListener('wheel', interrupt);
      window.removeEventListener('touchstart', interrupt);
      window.removeEventListener('keydown', onKey);
    }
    function interrupt(){ cancelAnim(); if(vEl){ vEl.style.opacity = '0'; } cleanup(); }
    function onKey(e){ if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].indexOf(e.key) >= 0){ interrupt(); } }
    window.addEventListener('wheel', interrupt, { passive:true });
    window.addEventListener('touchstart', interrupt, { passive:true });
    window.addEventListener('keydown', onKey);

    function step(ts){
      if(start === null){ start = ts; }
      var p = Math.min(1, (ts - start)/dur);
      window.scrollTo(0, startY + dist * easeInOutCubic(p));
      if(vEl){ vEl.style.opacity = String(NAV.veilPeak * Math.sin(Math.PI * p)); }
      if(p < 1){ rafId = requestAnimationFrame(step); }
      else { rafId = null; if(vEl){ vEl.style.opacity = '0'; } cleanup(); arriveCue(target); }
    }
    rafId = requestAnimationFrame(step);
  }
  window.blScrollTo = scrollToEl;

  document.addEventListener('click', function(e){
    var node = e.target;
    var a = node && node.closest ? node.closest('a[href]') : null;
    if(!a) return;
    var href = a.getAttribute('href') || '';
    if(href.charAt(0) !== '#' || href.length < 2) return;   // only same-page anchors
    var target = document.getElementById(href.slice(1));
    if(!target) return;
    e.preventDefault();
    var mob = document.querySelector('.nav-mobile.open');   // close mobile menu if open
    if(mob){
      mob.classList.remove('open');
      var tg = document.querySelector('.nav-toggle');
      if(tg){ tg.classList.remove('open'); tg.setAttribute('aria-expanded','false'); }
    }
    scrollToEl(target);
    if(history.replaceState){ try{ history.replaceState(null, '', href); }catch(_){} }
  });
})();

/* Ambient background engine + scroll micro-motion.
   Everything here is decorative and additive: with JS off (or reduced-motion on)
   the page is fully rendered and visible without any of it. */
(function(){
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── Constellation canvas: faint drifting points joined by thin gold lines ── */
  var canvas = document.getElementById('bgNet');
  if(canvas && !reduce){
    var ctx = canvas.getContext('2d');
    var pts = [], W = 0, H = 0, dpr = 1, frame = 0, small = false, LINK = 130;
    var mx = -999, my = -999, mAct = 0, IR = 210;  // cursor pos + fading activity + reach
    window.addEventListener('pointermove', function(e){ mx = e.clientX; my = e.clientY; mAct = 1; }, { passive: true });
    window.addEventListener('pointerdown', function(e){ mx = e.clientX; my = e.clientY; mAct = 1.5; }, { passive: true });
    window.addEventListener('blur', function(){ mAct = 0; });

    function size(){
      small = window.innerWidth < 720;             // phones get a lighter, battery-kind field
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5);
      LINK = small ? 120 : 150;
      IR = small ? 150 : 210;
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var want = small ? Math.min(30, Math.max(24, Math.round(W * H / 13000)))
                       : Math.min(100, Math.round(W * H / 20000));
      while(pts.length < want) pts.push(spawn());
      pts.length = want;
    }
    function spawn(){
      return {
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .32, vy: (Math.random() - .5) * .32,
        r: .9 + Math.random() * 1.1
      };
    }
    function tick(){
      requestAnimationFrame(tick);                // rAF self-pauses in hidden tabs
      if(++frame % 2) return;                     // ~30fps is plenty for slow drift
      ctx.clearRect(0, 0, W, H);
      var i, j, p, q, dx, dy, d, f;
      if(mAct > 0){ mAct *= .94; if(mAct < .02) mAct = 0; }   // activity fades once the cursor stops
      for(i = 0; i < pts.length; i++){
        p = pts[i];
        p.x += p.vx; p.y += p.vy;
        // Cursor "wake": points within reach lean toward the pointer while it
        // moves — a positional nudge only (velocity untouched), so the field
        // relaxes back to its calm drift the moment you stop. No clumping.
        if(mAct > .05){
          dx = mx - p.x; dy = my - p.y; d = dx * dx + dy * dy;
          if(d < IR * IR && d > 1){ d = Math.sqrt(d); f = (1 - d / IR) * (small ? .5 : .8) * (mAct > 1 ? 1 : mAct); p.x += dx / d * f; p.y += dy / d * f; }
        }
        if(p.x < -20) p.x = W + 20; else if(p.x > W + 20) p.x = -20;
        if(p.y < -20) p.y = H + 20; else if(p.y > H + 20) p.y = -20;
      }
      ctx.lineWidth = 1;
      for(i = 0; i < pts.length; i++){
        p = pts[i];
        for(j = i + 1; j < pts.length; j++){
          q = pts[j];
          dx = p.x - q.x; dy = p.y - q.y;
          if(dx > LINK || dx < -LINK || dy > LINK || dy < -LINK) continue;
          d = Math.sqrt(dx * dx + dy * dy);
          if(d < LINK){
            ctx.strokeStyle = 'rgba(200,168,75,' + ((1 - d / LINK) * .14).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(222,205,160,.38)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      // Brighter gold links reaching from the cursor to nearby points, plus a
      // faint node at the pointer — the network visibly responds to you.
      if(mAct > .05){
        var m = mAct > 1 ? 1 : mAct;
        for(i = 0; i < pts.length; i++){
          p = pts[i]; dx = p.x - mx; dy = p.y - my;
          if(dx > IR || dx < -IR || dy > IR || dy < -IR) continue;
          d = Math.sqrt(dx * dx + dy * dy);
          if(d < IR){
            ctx.strokeStyle = 'rgba(200,168,75,' + ((1 - d / IR) * .28 * m).toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(p.x, p.y); ctx.stroke();
          }
        }
        ctx.fillStyle = 'rgba(222,205,160,' + (.55 * m).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(mx, my, 1.8, 0, 6.2832); ctx.fill();
      }
    }
    size();
    var rsz; window.addEventListener('resize', function(){ clearTimeout(rsz); rsz = setTimeout(size, 180); });
    requestAnimationFrame(tick);
  }

  /* ── Live lead ticker: recycle the bottom inbox row to the top every few
        seconds while the showcase is on screen, so the lead feed reads as
        live. Reuses the existing rows (times rewritten to a fixed ladder),
        so no-JS/reduced-motion visitors keep the static list unchanged. ── */
  var inbox = document.querySelector('.inbox');
  if(inbox && !reduce && 'IntersectionObserver' in window){
    var inboxHead = inbox.querySelector('.inbox-head');
    var LADDER = ['Just now', '6m ago', '18m ago', '41m ago', '1h ago'];
    var inboxVis = false;
    new IntersectionObserver(function(es){ inboxVis = es[0].isIntersecting; }).observe(inbox);
    setInterval(function(){
      if(!inboxVis || document.hidden) return;
      var rows = inbox.querySelectorAll('.inbox-row');
      if(rows.length < 2) return;
      var last = rows[rows.length - 1];
      last.classList.remove('tick-in');
      inbox.insertBefore(last, inboxHead.nextSibling);
      void last.offsetWidth;                     // restart the slide-in animation
      last.classList.add('tick-in');
      rows = inbox.querySelectorAll('.inbox-row');
      for(var r = 0; r < rows.length; r++){
        var tEl = rows[r].querySelector('.inbox-time');
        if(tEl) tEl.textContent = LADDER[Math.min(r, LADDER.length - 1)];
      }
    }, 4600);
  }

  /* ── One rAF-throttled scroll handler: progress hairline + orb parallax ── */
  var bar = document.getElementById('progress');
  var orbs = document.querySelectorAll('.ambient .ow');
  var parallax = !reduce && window.innerWidth >= 720 && orbs.length;
  var factors = [.085, -.065, .12, .05];         // per-layer px drift per px scrolled (3 orbs + glyphs)
  var stick = document.querySelector('.sticky-cta');
  var contactSec = document.getElementById('contact');
  // The pill must never sit on top of another tappable control. An IO with a
  // negative top rootMargin watches the bottom ~18% of the viewport; while any
  // button/tab/FAQ row is inside that band, the pill yields (slides away).
  var bandSet = new Set();
  if(stick && 'IntersectionObserver' in window){
    var bandIO = new IntersectionObserver(function(es){
      for(var k = 0; k < es.length; k++){
        if(es[k].isIntersecting) bandSet.add(es[k].target); else bandSet.delete(es[k].target);
      }
      if(!queued){ queued = true; requestAnimationFrame(paint); }  // re-evaluate promptly
    }, { rootMargin: '-82% 0px 0px 0px' });
    var yieldTo = document.querySelectorAll('.pkg-cta, .btn, .tab, .faq-item summary');
    for(var b = 0; b < yieldTo.length; b++) bandIO.observe(yieldTo[b]);
  }
  var queued = false;
  function paint(){
    queued = false;
    var y = window.scrollY || 0;
    if(stick){
      // Show once the hero CTA has scrolled away; hide while the contact
      // form is on screen (its own CTA takes over) or while any other
      // tappable control is in the pill's bottom band.
      var on = y > 620 && bandSet.size === 0;
      if(on && contactSec && contactSec.getBoundingClientRect().top < window.innerHeight) on = false;
      stick.classList.toggle('on', on);
    }
    if(bar && !reduce){
      var max = (document.body.scrollHeight || 1) - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
    }
    if(parallax){
      for(var i = 0; i < orbs.length; i++){
        orbs[i].style.transform = 'translate3d(0,' + (-y * factors[i % factors.length]).toFixed(1) + 'px,0)';
      }
    }
  }
  window.addEventListener('scroll', function(){
    if(!queued){ queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  paint();

  /* ── Scroll-settle reveals — REPEATING, both directions: a scroll animation
        every time a section comes back into view, going down AND going up.

        Was one-shot: reveal on first entry, then unobserve, so nothing ever
        replayed. Now every section re-plays its settle each time it comes back
        into view, entering from whichever edge you scrolled from.

        Two observers on purpose. Re-arming (hiding again) must NEVER happen
        while any part of the element is on screen or you get a visible flicker,
        so the "out" observer uses no rootMargin and fires only at ratio 0 —
        fully off screen, where the user cannot see the reset. The "in" observer
        keeps a negative bottom margin so the settle triggers a beat after the
        element clears the fold, which is what makes it read as deliberate.

        The old code's 12000px top rootMargin (an anti-stuck-hidden guard) is
        gone and no longer needed: nothing is unobserved now, so an element that
        gets jumped past is re-evaluated the moment it is on screen again.

        Still safe for SEO / no-JS: .sr is only ever added by JS, and anything
        already visible at load gets .sr and .sr-in in the SAME frame, so
        visible content is never hidden even for a moment. ── */
  if(!reduce && 'IntersectionObserver' in window){
    var groups = ['.section-head', '.boutique-card', '.pkg', '.incl', '.faq-item',
                  '.fit-check', '.fit-budget', '.founder-card', '.contact-box',
                  '.cap-note', '.equal-effort'];

    var ioIn = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting) e.target.classList.add('sr-in');
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    var ioOut = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting) return;                 // still on screen — leave it alone
        var el = e.target;
        // Re-arm from the edge it will come back through: slid down if it left
        // over the top, up if it left below. Scrolling back up therefore settles
        // downward instead of replaying the "from below" entrance backwards.
        el.style.setProperty('--sry', e.boundingClientRect.top < 0 ? '-22px' : '22px');
        el.classList.remove('sr-in');
      });
    }, { threshold: 0 });

    var vh = window.innerHeight;
    document.querySelectorAll(groups.join(',')).forEach(function(el){
      // .reveal's finished fadeUp (fill-mode both) pins opacity:1 forever and
      // would override .sr — the same animation-vs-class trap as the nav bug
      el.classList.remove('reveal');
      // stagger siblings that share a parent grid (packages, cards, faq)
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty('--srd', Math.min(sibs * 70, 420) + 'ms');
      el.classList.add('sr');
      // Anything on screen right now is revealed in the same frame — no flash,
      // no visible content ever hidden. It still re-plays once scrolled away.
      if(el.getBoundingClientRect().top <= vh * 0.92) el.classList.add('sr-in');
      ioIn.observe(el);
      ioOut.observe(el);
    });
  }

  /* ── Package cards: tap/click = single selection (mobile especially — a tap's
        sticky hover next to the featured card's ring read as two selected) ── */
  document.addEventListener('click', function(e){
    var card = e.target.closest ? e.target.closest('.pkg') : null;
    if(!card) return;
    document.querySelectorAll('.pkg.sel').forEach(function(p){ if(p !== card) p.classList.remove('sel'); });
    card.classList.add('sel');
  });

  /* ── Book-a-call: open Calendly in an on-site popup instead of navigating away,
        and tag the booking with which package they were on so it shows up in the
        Calendly event. Falls back to the plain link if the widget didn't load. ── */
  var CAL_BASE = "https://calendly.com/theboldlinemedia/30min";
  // Calendly custom-question key for "Which package are you interested in?".
  // Custom questions are a1, a2, ... in the order they appear on the booking page.
  // The current order is recorded in KB `os-calendar`; if the booking form is reordered,
  // update both. (Kept out of this file: it is served to the public, comments included.)
  var PKG_ANSWER_KEY = "a3";
  document.addEventListener('click', function(e){
    var a = e.target.closest ? e.target.closest('a[href*="calendly.com/theboldlinemedia"]') : null;
    if(!a || a.id === 'openRecommender') return;                // that link opens the recommender modal, not Calendly
    if(!(window.Calendly && Calendly.initPopupWidget)) return;  // widget missing -> normal link
    var opts = { url: a.getAttribute('href') };
    var pkgCard = a.closest('.pkg');
    var name = pkgCard ? (pkgCard.querySelector('h3') ? pkgCard.querySelector('h3').textContent.trim() : '')
                       : (a.getAttribute('data-pkg') || '');
    if(name){
      // Prefill the "which package" answer (visible on the booking) + a utm tag as a backup signal
      var src = pkgCard ? 'package_card' : 'recommender';
      opts.url = CAL_BASE + '?utm_source=website&utm_medium=' + src + '&utm_campaign=book_a_call&utm_content=' + encodeURIComponent(name);
      var ca = {}; ca[PKG_ANSWER_KEY] = name;
      opts.prefill = { customAnswers: ca };
    }
    e.preventDefault();
    Calendly.initPopupWidget(opts);
  });
})();

/* Homepage refresh: as the sample site scrolls into view it straightens and the phone drifts up a
   little faster than the page. One rAF-throttled scroll listener, off for "reduce motion". */
(function(){
  var st=document.querySelector('.hero-stage'); if(!st||!window.requestAnimationFrame) return;
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var b=st.querySelector('.browser'),ph=st.querySelector('.phone'),t=st.querySelector('.float-toast'),q=false;
  function f(){q=false;var r=st.getBoundingClientRect(),vh=window.innerHeight||800;
    var p=Math.max(0,Math.min(1,1-(r.top-vh*.15)/(vh*.85)));
    if(b){b.style.setProperty('--tilt',(10*(1-p)).toFixed(2)+'deg');b.style.setProperty('--sc',(.96+.04*p).toFixed(3));}
    if(ph) ph.style.setProperty('--py',(-40*p).toFixed(1)+'px');
    if(t) t.style.setProperty('--ty',(-24*p).toFixed(1)+'px');}
  addEventListener('scroll',function(){if(!q){q=true;requestAnimationFrame(f);}},{passive:true});
  addEventListener('resize',f);f();
})();

/* Scroll motion (the styles are at the end of new.css). Turned on only when the visitor hasn't asked for
   reduced motion and the device isn't on data saver, a 2G connection or short on memory, so a slow phone
   gets the plain page straight away. One scroll loop, throttled to the screen's frame rate. */
(function(){
  var H=document.documentElement, mm=function(q){return !!(window.matchMedia&&matchMedia(q).matches);};
  var c=navigator.connection||{};
  if(mm('(prefers-reduced-motion: reduce)')||c.saveData||/(^|-)2g$/.test(c.effectiveType||'')||(navigator.deviceMemory&&navigator.deviceMemory<4)||!window.requestAnimationFrame) return;
  H.classList.add('mo');
  var fine=mm('(hover: hover) and (pointer: fine)'); if(fine) H.classList.add('mo-fine');
  var clamp=function(v){return v<0?0:v>1?1:v;}, ease=function(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};

  /* Word by word: wrap each word of the chosen headings in a span, keeping any markup inside them. */
  var wf=[].slice.call(document.querySelectorAll('.x-head h2,.section-head h2,.f-strip blockquote'));
  wf.forEach(function(el){
    (function walk(n){[].slice.call(n.childNodes).forEach(function(k){
      if(k.nodeType===3){ if(!/\S/.test(k.nodeValue)) return; var f=document.createDocumentFragment();
        k.nodeValue.split(/(\s+)/).forEach(function(t){ if(!t) return; if(/^\s+$/.test(t)){f.appendChild(document.createTextNode(t));return;}
          var s=document.createElement('span'); s.className='w'; s.textContent=t; f.appendChild(s); });
        n.replaceChild(f,k);
      } else if(k.nodeType===1) walk(k);
    });})(el);
    el.classList.add('wf'); el._w=el.querySelectorAll('.w');
  });

  var hero=document.querySelector('.h-hero'), pin=hero&&hero.querySelector('.h-pin'), vis=hero&&hero.querySelector('.h-visual');
  var ph=document.querySelector('.page-hero');
  var steps=document.querySelector('.steps3'), stl=steps&&steps.querySelector('.st-line'), sts=steps?steps.querySelectorAll('.st'):[];
  var pinned=false, vw=0, vh=0;

  /* Where the sample site has to travel to end up centred and filling most of the screen. */
  function measure(){
    vw=window.innerWidth; vh=window.innerHeight;
    pinned=!!(pin&&vis&&vw>=1060&&vh>=640);
    H.classList.toggle('mo-pin',pinned);
    if(!pinned) return;
    var b=vis.querySelector('.browser'); hero.style.setProperty('--e','0');
    var wrap=pin.firstElementChild.getBoundingClientRect(), v=vis.getBoundingClientRect(), br=b.getBoundingClientRect();
    var relY=br.top-wrap.top, s=Math.min(vw*.74/br.width,(vh-150)*.8/br.height);
    hero.style.setProperty('--s',s.toFixed(3));
    hero.style.setProperty('--oy',(br.height/2)+'px');
    hero.style.setProperty('--dx',(vw/2-(v.left+br.width/2)).toFixed(1)+'px');
    hero.style.setProperty('--dy',(vh/2+12-(relY+br.height/2)).toFixed(1)+'px');
  }

  var q=false;
  function frame(){
    q=false; var y=window.scrollY||0;
    if(hero){
      var e;
      if(pinned){ var run=pin.offsetHeight-vh; e=ease(clamp(y/(run*.82))); }
      else e=clamp(y/(vh*.9));
      hero.style.setProperty('--e',e.toFixed(4));
      hero.classList.toggle('past',e>.45);
    }
    if(ph) ph.style.setProperty('--ph',clamp(y/(ph.offsetHeight||1)).toFixed(4));
    for(var i=0;i<wf.length;i++){
      var r=wf[i].getBoundingClientRect(); if(r.bottom<-50||r.top>vh+50) continue;
      var p=clamp((vh*.92-r.top)/(vh*.5)), n=wf[i]._w, lit=Math.round(p*n.length);
      for(var j=0;j<n.length;j++) n[j].classList.toggle('on',j<lit);
    }
    if(steps){
      var sr=steps.getBoundingClientRect(), sp=clamp((vh*.85-sr.top)/(sr.height+vh*.25));
      steps.style.setProperty('--sp',sp.toFixed(4));
      for(var k=0;k<sts.length;k++) sts[k].classList.toggle('lit',sp>=(k+.5)/sts.length-.12);
    }
  }
  function kick(){ if(!q){ q=true; requestAnimationFrame(frame); } }
  measure(); frame();
  addEventListener('scroll',kick,{passive:true});
  var rt; addEventListener('resize',function(){ clearTimeout(rt); rt=setTimeout(function(){ measure(); frame(); },120); });
  addEventListener('load',function(){ measure(); frame(); });

  /* With a mouse, tiles lean toward the pointer and carry a soft light under it. */
  if(fine) [].forEach.call(document.querySelectorAll('.b-card'),function(cd){
    cd.addEventListener('pointermove',function(ev){ var r=cd.getBoundingClientRect(), x=(ev.clientX-r.left)/r.width, y=(ev.clientY-r.top)/r.height;
      cd.style.setProperty('--mx',(x*100).toFixed(1)+'%'); cd.style.setProperty('--my',(y*100).toFixed(1)+'%');
      cd.style.setProperty('--ry',((x-.5)*5).toFixed(2)+'deg'); cd.style.setProperty('--rx',((.5-y)*5).toFixed(2)+'deg'); });
    cd.addEventListener('pointerleave',function(){ cd.style.setProperty('--rx','0deg'); cd.style.setProperty('--ry','0deg'); });
  });

  /* Smooth, weighted scrolling with a mouse or trackpad only (phones keep their own native scroll). Loaded
     once the page is idle, so it never slows the first view. Scrollable popups and the menu opt out. */
  if(fine) addEventListener('load',function(){ (window.requestIdleCallback||function(f){setTimeout(f,1200);})(function(){
    var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js';
    s.integrity='sha384-jqpi9VmOdhyLoLURgjCn7EpnG9BbnHW57ibIZoeaIU+erWDH3k8fQQg0xH2ySjnw'; s.crossOrigin='anonymous';
    s.onload=function(){ if(!window.Lenis) return;
      [].forEach.call(document.querySelectorAll('.modal-overlay,.nav-mobile,[role=dialog],textarea'),function(el){ el.setAttribute('data-lenis-prevent',''); });
      var l=new Lenis({lerp:.1,smoothWheel:true,anchors:true}); window.__lenis=l;
      l.on('scroll',kick);
      (function raf(t){ l.raf(t); requestAnimationFrame(raf); })(performance.now());
    };
    document.head.appendChild(s);
  },{timeout:3000}); });
})();
