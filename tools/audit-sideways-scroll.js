/*
 * Does anything scroll SIDEWAYS? — a headless audit of real OS screens at the four
 * standing breakpoints (390 / 768 / 1280 / 1600), per the responsive rule in CLAUDE.md.
 *
 * WHY THIS EXISTS AND WHY THE EXISTING AUDIT DID NOT CATCH IT (2026-08-30):
 * Bryson found the Lead Scout call list scrolling sideways on his phone. The audit recipe
 * in KB `responsive-standards` asserts `documentElement.scrollWidth <= clientWidth`, and
 * that assertion read ZERO the entire time the bug was live — because the overflow was
 * inside a CONTAINER, not on the page. The page never scrolled. A div inside it did.
 *
 * So this checks the thing he actually did: it looks for any element the USER CAN SCROLL
 * horizontally (overflow-x auto/scroll AND real overflow inside it). That deliberately
 * ignores the ambient background orbs, which are wider than the screen at every width by
 * design and are clipped by an overflow:hidden parent, so they can never be swiped.
 *
 * RUN (deps are ephemeral — install into a temp dir each time):
 *   D=$(mktemp -d)
 *   npm install --prefix "$D" playwright react@18 react-dom@18 @babel/standalone@7.23.5
 *   NODE_PATH="$D/node_modules" PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     node tools/audit-sideways-scroll.js
 *
 * Exits non-zero if anything is scrollable, so it can gate a merge.
 *
 * 🔴 THREE HARNESS TRAPS HIT WHILE WRITING THIS, all of which looked like app bugs:
 *  1. The supabase stub lacked `.insert`, so the app died before mounting. A stub NARROWER
 *     than production fails exactly as badly as one that is wider.
 *  2. Playwright matches the MOST RECENTLY ADDED route first, so a broad catch-all
 *     registered last shadowed the specific one. Every scout call returned {"ok":true},
 *     `facets` came back truthy with no `niches`, and the screen crashed. Register the
 *     catch-all FIRST.
 *  3. The prospect fixture omitted `kind` on a phone. The server normalises that field to
 *     "unknown" and never stores it missing, so the crash was invented by the fixture.
 *     Fixtures are copied from what the SERVER WRITES, not from what the card reads.
 */
const fs=require("fs"),path=require("path"),http=require("http"),os=require("os");
const {chromium}=require("playwright");
const REPO="/home/user/boldline-os";
const RENDER=fs.mkdtempSync(path.join(os.tmpdir(),"scout-"));
const findChrome=()=>{const r="/opt/pw-browsers";const d=fs.readdirSync(r).find(x=>/^chromium-\d+$/.test(x));return path.join(r,d,"chrome-linux/chrome");};
// Resolve by PATH, not require.resolve: React 18's package "exports" map hides the umd
// build, so require.resolve throws ERR_PACKAGE_PATH_NOT_EXPORTED on a subpath that exists
// on disk. The file is what the browser loads, so take it straight off disk.
const NMROOT=(process.env.NODE_PATH||"").split(":").filter(Boolean)[0];
const nm=(m)=>{const p=path.join(NMROOT,m); if(!fs.existsSync(p)) throw new Error("missing "+p); return p;};
for(const [f,m] of [["react.js","react/umd/react.development.js"],["react-dom.js","react-dom/umd/react-dom.development.js"],["babel.js","@babel/standalone/babel.min.js"]])
  fs.copyFileSync(nm(m),path.join(RENDER,f));

const STUB=`<script>(function(){
  // Every method the app actually calls. The first draft had only select/eq/order/limit,
  // and the app died on supabaseClient.from(...).insert before React ever mounted — a stub
  // that is NARROWER than production fails just as badly as one that is wider.
  var mk=function(){
    var o={};
    ["select","eq","neq","gt","gte","lt","lte","in","is","like","ilike","order","limit","range","match","filter","or","not"]
      .forEach(function(m){o[m]=function(){return o;};});
    ["insert","update","upsert","delete"].forEach(function(m){o[m]=function(){return o;};});
    o.single=function(){return Promise.resolve({data:null,error:null});};
    o.maybeSingle=function(){return Promise.resolve({data:null,error:null});};
    o.then=function(r,j){return Promise.resolve({data:[],error:null}).then(r,j);};
    return o;
  };
  var ch={on:function(){return ch;},subscribe:function(){return ch;},unsubscribe:function(){}};
  window.supabase={createClient:function(){return{
    auth:{getSession:function(){return Promise.resolve({data:{session:{user:{id:"demo",email:"b@x.com"},access_token:"t"}}});},
      getUser:function(){return Promise.resolve({data:{user:{id:"demo"}}});},
      onAuthStateChange:function(){return{data:{subscription:{unsubscribe:function(){}}}};},
      signInWithPassword:function(){return Promise.resolve({error:null});},
      signOut:function(){return Promise.resolve({error:null});}},
    from:mk,channel:function(){return ch;},removeChannel:function(){},
    storage:{from:function(){return{upload:function(){return Promise.resolve({data:null,error:null});},
      getPublicUrl:function(){return{data:{publicUrl:""}};}};}}
  };}};
})();</script>`;
let html=fs.readFileSync(path.join(REPO,"index.html"),"utf8")
 .replace('<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>','<script src="react.js"></script>')
 .replace('<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>','<script src="react-dom.js"></script>')
 .replace('<script src="https://unpkg.com/@babel/standalone@7.23.5/babel.min.js"></script>','<script src="babel.js"></script>')
 .replace('<script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"></script>',STUB);
fs.writeFileSync(path.join(RENDER,"os.html"),html);

// Modelled on Bryson's real screenshot: long business name, long source notes, a verdict.
const P={id:"p1",name:"Summit Peak Roofing & Exteriors, LLC",niche:"Roofing",score:71,status:"new",data:{
  name:"Summit Peak Roofing & Exteriors, LLC",city:"Mesa",state:"AZ",rating:5,reviewCount:49,
  googleAds:"found",metaAds:"unconfirmed",websiteQuality:"decent",completeness:74,
  verdict:"Well reviewed roofing company with 49 reviews. Google tag already installed but no active campaigns, which makes them an ideal Launch-tier client.",
  verifiedBy:["Google Places","site tags"],
  // 🔴 THE SHAPE THE SERVER ACTUALLY STORES, not a guess at what the card reads.
  // lead-scout-background normalises every phone to {number,kind,whose,label,source,
  // confidence} and defaults kind/whose to "unknown". The first fixture omitted kind and
  // the card threw on ph.kind.replace — a harness NARROWER than production, reported as
  // an app crash.
  phones:[{number:"(480) 555-0204",kind:"main",whose:"business",label:"main office",source:"Google Places",confidence:"high"},
          {number:"(480) 555-0184",kind:"mobile",whose:"owner",label:"secondary",source:"number listed on Mesa Chamber directory (likely the owner's mobile)",confidence:"medium"}],
  emails:[{address:"office@summitpeakroofingandexteriors.com",whose:"business",label:"general enquiries",source:"website footer",confidence:"high"}],
  employees:"2-6 (estimate)",yearsInBusiness:"AZ LLC formed 21 Oct 2025 — under a year as a registered entity",
  budgetCapacity:"~$3,500/mo",bestPackage:"Launch System · from $400/mo"}};

const server=http.createServer((req,res)=>{fs.readFile(path.join(RENDER,decodeURIComponent(req.url.split("?")[0])),(e,b)=>{
  if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{"content-type":req.url.endsWith(".html")?"text/html":"text/javascript"});res.end(b);});});

let failed=false;
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const url=`http://127.0.0.1:${server.address().port}/os.html`;
  const b=await chromium.launch({executablePath:findChrome(),headless:true,args:["--no-sandbox"]});
  const errs=[];
  for(const w of [390,768,1280,1600]){
    const ctx=await b.newContext({viewport:{width:w,height:900},isMobile:w<700,hasTouch:w<700});
    const pg=await ctx.newPage(); pg.on("pageerror",e=>errs.push(`${w}: PAGEERROR ${e.message}`));
    pg.on("console",m=>{if(m.type()==="error")errs.push(`${w}: CONSOLE ${m.text().slice(0,200)}`);});
    // Grab the compiled source around the throw site so the offset in the stack can be
    // read back as actual code.
    await pg.addInitScript(()=>{window.__err=null;window.addEventListener("error",e=>{
      if(!window.__err) window.__err={msg:e.message,stack:(e.error&&e.error.stack)||""};});});
    // 🔴 CATCH-ALL FIRST. Playwright matches the MOST RECENTLY ADDED route first, so
    // registering the broad one last shadowed the specific one: every scout call got
    // {"ok":true}, `facets` came back truthy with no `niches`, and the screen crashed.
    // That looked exactly like an app bug for three runs.
    await pg.route("**/.netlify/functions/**",r=>r.fulfill({status:200,contentType:"application/json",body:'{"ok":true}'}));
    await pg.route("**/.netlify/functions/lead-scout?**",(route)=>{
      const u=route.request().url();
      // 🔴 EVERY action the screen calls, answered in ITS OWN shape. The first draft
      // answered `action=providers` with the prospects payload, so `providers` became
      // undefined and the screen crashed on `providers.apollo` before rendering. A route
      // stub that returns a plausible-looking wrong shape is worse than none: it looks
      // like an app bug.
      const body=u.includes("action=facets")
        ? {ok:true,total:1,niches:[{value:"Roofing",count:1}],areas:[{value:"Mesa, AZ",count:1}]}
        : u.includes("action=providers")
        ? {ok:true,providers:{places:true,apollo:false}}
        : u.includes("action=prospects")
        ? {ok:true,prospects:[P]}
        : {ok:true};
      route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(body)});
    });
    await pg.goto(url,{waitUntil:"domcontentloaded"});
    try{ await pg.waitForFunction(()=>{const r=document.getElementById("root");return r&&r.textContent&&r.textContent.length>200;},{timeout:20000}); }
    catch(e){ const t=await pg.evaluate(()=>{const r=document.getElementById("root");return {len:r?r.textContent.length:-1,txt:r?r.textContent.slice(0,300):"NO ROOT"};});
      console.log(`${w}: did not boot — root len ${t.len}: ${t.txt}`); await pg.screenshot({path:`/tmp/boot-${w}.png`}); await ctx.close(); continue; }
    await pg.waitForTimeout(800);
    // Navigate: Lead Scout, then the call list tab.
    try{
      await pg.getByText("Lead Scout",{exact:false}).first().click({timeout:6000});
      await pg.waitForTimeout(600);
      await pg.getByText(/call list/i).first().click({timeout:6000});
      await pg.waitForTimeout(1200);
    }catch(e){ errs.push(`${w}: nav — ${e.message}`); }
    const crash=await pg.evaluate(()=>{
      if(!window.__err) return null;
      const m=/<anonymous>:(\d+):(\d+)/.exec(window.__err.stack||"");
      let snippet="";
      if(m){
        // The BABEL-COMPILED inline script, identified by content rather than by being
        // longest — the page also carries a huge base64 image blob, which the first
        // version picked instead and printed as gibberish.
        const sc=[...document.querySelectorAll("script")].map(s=>s.textContent)
          .find(t=>t&&t.includes("LeadScoutScreen")&&t.length>100000);
        if(sc){ const lines=sc.split("\n"); const ln=Number(m[1]); const col=Number(m[2]);
          const line=lines[ln-1]||sc; snippet=line.slice(Math.max(0,col-300),col+80); }
      }
      return {msg:window.__err.msg,snippet,stack:(window.__err.stack||"").split("\n").slice(0,3).join(" | ")};
    });
    if(crash){ console.log(`\n### ${w}px CRASH: ${crash.msg}`); console.log("   CODE: ..."+crash.snippet); }
    const r=await pg.evaluate(()=>{
      const de=document.documentElement;
      const vw=de.clientWidth;
      // 🔴 THE CHECK THAT MATCHES WHAT HE ACTUALLY DID: he swiped and the content moved.
      // That needs an element the USER CAN SCROLL, which means overflow-x auto/scroll/visible
      // AND real overflow inside it. Counting "elements wider than the viewport" alone is
      // noisy: the ambient background orbs are wider than the screen at every width by
      // design and are clipped by an overflow:hidden parent, so they can never be scrolled.
      const scrollers=[...document.querySelectorAll("*")].filter(el=>{
        if(el.scrollWidth<=el.clientWidth+1) return false;
        const ov=getComputedStyle(el).overflowX;
        return ov==="auto"||ov==="scroll";
      }).map(el=>({tag:el.tagName,sw:el.scrollWidth,cw:el.clientWidth,
        txt:(el.textContent||"").trim().slice(0,50)}));
      const bad=[...document.querySelectorAll("*")].filter(el=>{
        const b=el.getBoundingClientRect(); return b.width>0&&(b.right>vw+1||b.left<-1);
      }).map(el=>{const b=el.getBoundingClientRect();
        return {tag:el.tagName,right:Math.round(b.right),w:Math.round(b.width),
          txt:(el.textContent||"").trim().slice(0,45)};});
      return {over:de.scrollWidth-de.clientWidth,vw,count:bad.length,worst:bad.slice(-4),
        scrollers,sawList:/Summit Peak/.test(document.body.textContent)};
    });
    if(r.scrollers.length) failed=true;
    if(r.scrollers.length) r.scrollers.forEach(x=>console.log(`   SCROLLABLE <${x.tag}> ${x.sw}px inside ${x.cw}px — "${x.txt}"`));
    console.log(`\n=== ${w}px === overflow=${r.over}px  offenders=${r.count}  listRendered=${r.sawList}`);
    r.worst.forEach(x=>console.log(`   <${x.tag}> right=${x.right} (vw ${r.vw}) w=${x.w}  "${x.txt}"`));
    if(w===390) await pg.screenshot({path:"/tmp/scout-390.png",fullPage:false});
    await ctx.close();
  }
  await b.close(); server.close();
  const real=errs.filter(e=>!/deoptimised|404|Failed to load resource/.test(e));
  if(real.length){console.log("\n--- app errors ---");real.forEach(e=>console.log(e));}
  if(failed||real.length){ console.log("\nFAIL"); process.exit(1); }
  console.log("\nOK — nothing scrolls sideways at 390/768/1280/1600.");
})();
