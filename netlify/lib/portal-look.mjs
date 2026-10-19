// The client portal's look, v4: the OS's style, brought to the client (KB `portal-os-look`).
//
// Bryson, 2026-10-19: "didnt we update the client portals to be a bit more modern and more like the os with the
// 3d models?" then "yes can you do that". The OS had the dark-and-gold HUD look and 3D; the portal only had the
// 7 Oct results refresh. This is a LAYER on top of the existing page: same markup, same classes, so every test
// that pins the portal's structure still holds, and removing the import puts the old look straight back.
//
// 🔴 COOL BUT CLEAR (KB `cool-but-clear`), because a client must never wonder what to tap:
//  - the 3D core says something true: it fills with gold as their campaign moves through its stages (full gold
//    once live), and the fill rises to where they are when the page opens;
//  - the result numbers count up because they just arrived, once, then sit still;
//  - nothing pulses for decoration.
// 🔴 FAST ON A PHONE (KB `website-design-bar`): no library, a few hundred lines of plain WebGL, started only after
// the page is usable, skipped for "reduce motion" (one still frame instead), Data Saver, 2G and phones short on
// memory. If WebGL is missing the existing gold ring simply stays as it was.
// Client-facing: no emojis, no dashes in copy. The page script has no `//` comments for the same reason as the
// landing pages: it is delivered verbatim.

export const PORTAL_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";

const D = "'Chakra Petch',Inter,-apple-system,sans-serif";
const M = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace";

export const PORTAL_LOOK_CSS = [
  "/* v4 2026-10-19: the OS look */",
  "body{background:#06070A}",
  // The OS's blueprint grid, fading out down the page so text never sits on lines.
  "body::before{content:\"\";position:fixed;inset:0;z-index:0;pointer-events:none;background-image:linear-gradient(rgba(212,176,90,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(212,176,90,.055) 1px,transparent 1px);background-size:56px 56px;-webkit-mask-image:radial-gradient(ellipse 85% 55% at 50% 0%,#000 25%,transparent 78%);mask-image:radial-gradient(ellipse 85% 55% at 50% 0%,#000 25%,transparent 78%)}",
  ".ambient .o2,.ambient .o3{display:none}.ambient .o1{opacity:.7}",
  // Header: brand in the OS's display face, a mono label, the client's name as a quiet chip.
  `.hdr{border-bottom:1px solid rgba(212,176,90,.14)}.hb-name{font-family:${D};font-size:16px;font-weight:700;letter-spacing:.01em;color:#F2EEDF;line-height:1.1}.hb-sub{font-family:${M};font-size:10px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#9C8A5A;margin-top:3px}`,
  `.hb-client{margin-left:auto;font-size:12.5px;font-weight:600;color:#C9CCD6;padding:6px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
  // Tabs: display face, gold with a soft glow under the one you are on.
  `.nav{border-bottom:1px solid rgba(212,176,90,.12)}.nb{font-family:${D};font-weight:600;letter-spacing:.12em;color:#7D8293;transition:color .2s}.nb:hover{color:#D7DAE3}.nb.on{color:#E8C96A;border-bottom-color:#D4B05A;text-shadow:0 0 14px rgba(212,176,90,.45)}`,
  `@media(max-width:460px){.nb{letter-spacing:.04em}}`,
  // Headings and numbers in the display face; labels as mono HUD captions.
  `.welcome b{font-family:${D};font-weight:700;letter-spacing:-.01em}.welcome[data-k]::before{content:attr(data-k);display:block;font-family:${M};font-size:11px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#9C8A5A;margin-bottom:10px}`,
  `.lbl,.kpi-l{font-family:${M};font-weight:600;letter-spacing:.14em;color:#8C91A1}.kpi-v,.ring-n,.prog-stage,.acc .at,.uopt-fee{font-family:${D}}.kpi-v{letter-spacing:-.01em;font-weight:700}`,
  // Panels: glass with a gold hairline (kept) and HUD corner ticks.
  ".card,.kpi{background:linear-gradient(180deg,rgba(18,20,28,.72),rgba(10,11,16,.62));border-color:rgba(255,255,255,.075)}",
  ".card::after,.kpi::after{content:\"\";position:absolute;inset:8px;pointer-events:none;background:linear-gradient(#D4B05A,#D4B05A) left top/10px 1px no-repeat,linear-gradient(#D4B05A,#D4B05A) left top/1px 10px no-repeat,linear-gradient(#D4B05A,#D4B05A) right bottom/10px 1px no-repeat,linear-gradient(#D4B05A,#D4B05A) right bottom/1px 10px no-repeat;opacity:.38}",
  ".acc{background:linear-gradient(180deg,rgba(18,20,28,.6),rgba(10,11,16,.5))}.acc[open]{border-color:rgba(212,176,90,.22)}",
  // The progress core: a bigger ring, with the 3D sphere sitting inside it behind the number.
  ".prog-hero{gap:26px}.ring{width:176px;height:176px}.ring-in{inset:8px;background:radial-gradient(circle at 50% 40%,#11131B,#07080C 70%);overflow:hidden}",
  ".ring-in .core{position:absolute;inset:0;width:100%;height:100%;display:block}.ring-n,.ring-l{position:relative;z-index:1;text-shadow:0 1px 10px rgba(0,0,0,.9),0 0 2px rgba(0,0,0,.9)}.ring.has-core .ring-n{font-size:38px}",
  ".prog-small .ring{width:96px;height:96px}.prog-small .ring-in{inset:6px}.prog-small .ring.has-core .ring-n{font-size:22px}",
  "@media(max-width:760px){.ring{width:132px;height:132px}.ring.has-core .ring-n{font-size:30px}}@media(max-width:460px){.ring{width:118px;height:118px}.prog-hero{gap:16px}.prog-small .ring{width:84px;height:84px}}",
  // Chart bars rise once, because the data just arrived.
  "@keyframes barUp{from{transform:scaleY(0)}to{transform:none}}.bar::before{transform-origin:bottom;animation:barUp .7s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i,0) * 14ms)}",
  "@media (prefers-reduced-motion:reduce){.bar::before{animation:none}.nb{transition:none}}",
].join("");

// The page script. Kept free of comments because it ships verbatim; the reasoning lives above.
export const PORTAL_LOOK_JS = `(function(){
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var cn=navigator.connection||{};
var lite=!!(cn.saveData||/(^|-)2g$/.test(cn.effectiveType||'')||(navigator.deviceMemory&&navigator.deviceMemory<2));
document.querySelectorAll('.bar').forEach(function(b,i){b.style.setProperty('--i',i);});
function countUp(){if(rm)return;document.querySelectorAll('.kpi-v').forEach(function(el){var t=el.textContent.trim();var m=t.match(/^(\\$?)([0-9][0-9,]*)(\\.[0-9]+)?$/);if(!m)return;var end=parseFloat((m[2]+(m[3]||'')).replace(/,/g,''));if(!(end>0))return;var dec=m[3]?m[3].length-1:0;var t0=performance.now(),dur=950;el.setAttribute('aria-label',t);function step(n){var p=Math.min(1,(n-t0)/dur);p=1-Math.pow(1-p,3);var v=end*p;el.textContent=m[1]+(dec?v.toFixed(dec):Math.round(v).toLocaleString('en-US'));if(p<1)requestAnimationFrame(step);else{el.textContent=t;el.removeAttribute('aria-label');}}requestAnimationFrame(step);});}
function core(ring){
var inner=ring.querySelector('.ring-in');if(!inner||ring.querySelector('canvas'))return;
var target=Math.max(0,Math.min(1,(parseFloat(getComputedStyle(ring).getPropertyValue('--p'))||0)/100));
var cv=document.createElement('canvas');cv.className='core';cv.setAttribute('aria-hidden','true');
var gl=cv.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)return;
function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null;}
var vs=sh(gl.VERTEX_SHADER,'attribute vec3 a;uniform float t;uniform float f;uniform float d;uniform float u;varying float L;varying float Z;void main(){float c=cos(t),s=sin(t);vec3 p=vec3(a.x*c+a.z*s,a.y,-a.x*s+a.z*c);float ct=cos(.38),st=sin(.38);p=vec3(p.x,p.y*ct-p.z*st,p.y*st+p.z*ct);Z=p.z;L=smoothstep(f+.04,f-.04,a.y*.5+.5);gl_Position=vec4(p.xy*.78,0.,1.);gl_PointSize=(1.5+(p.z+1.)*1.4+L*.8)*d*u;}');
var fs=sh(gl.FRAGMENT_SHADER,'precision mediump float;varying float L;varying float Z;void main(){vec2 q=gl_PointCoord-.5;float r=dot(q,q);if(r>.25)discard;vec3 g=vec3(.93,.80,.44);vec3 k=vec3(.50,.53,.62);float a=(.3+.7*(Z*.5+.5))*(1.-r*3.);gl_FragColor=vec4(mix(k,g,L),a*mix(.62,1.,L));}');
if(!vs||!fs)return;var pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
var N=ring.closest('.prog-small')?600:1100,pts=new Float32Array(N*3);for(var i=0;i<N;i++){var y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y),th=i*2.399963;pts[i*3]=Math.cos(th)*r;pts[i*3+1]=y;pts[i*3+2]=Math.sin(th)*r;}
var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,pts,gl.STATIC_DRAW);var la=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(la);gl.vertexAttribPointer(la,3,gl.FLOAT,false,0,0);
var ut=gl.getUniformLocation(pr,'t'),uf=gl.getUniformLocation(pr,'f'),ud=gl.getUniformLocation(pr,'d'),uu=gl.getUniformLocation(pr,'u');
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
inner.insertBefore(cv,inner.firstChild);ring.classList.add('has-core');
var dpr=Math.min(2,window.devicePixelRatio||1);function size(){var w=inner.clientWidth,h=inner.clientHeight;cv.width=Math.max(1,Math.round(w*dpr));cv.height=Math.max(1,Math.round(h*dpr));gl.viewport(0,0,cv.width,cv.height);}size();
var t0=performance.now(),seen=true,raf=0;
function draw(n){if(cv.width<2)size();var e=(n-t0)/1000;var f=rm?target:target*(1-Math.pow(1-Math.min(1,e/1.8),3));gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(ut,rm?.6:.6+e*.22);gl.uniform1f(uf,f<=0?-.1:f>=1?1.1:f);gl.uniform1f(ud,dpr);gl.uniform1f(uu,Math.max(.8,Math.min(1.5,inner.clientWidth/120)));gl.drawArrays(gl.POINTS,0,N);}
function loop(n){raf=0;if(!seen||document.hidden)return;draw(n);raf=requestAnimationFrame(loop);}
if(rm){draw(performance.now());return;}
if('IntersectionObserver' in window){new IntersectionObserver(function(es){seen=es[0].isIntersecting;if(seen&&!raf)raf=requestAnimationFrame(loop);}).observe(cv);}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&seen&&!raf)raf=requestAnimationFrame(loop);});
window.addEventListener('resize',size);
raf=requestAnimationFrame(loop);}
function start(){countUp();if(lite)return;document.querySelectorAll('.ring').forEach(function(r){try{core(r);}catch(e){}});}
if(document.readyState==='complete')setTimeout(start,60);else window.addEventListener('load',function(){setTimeout(start,60);});
})();`;
