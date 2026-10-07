/* Test copy guard. On Netlify's test addresses (branch-name--site.netlify.app) this page is a preview: it is
   hidden from search engines, says so on screen, and nothing on it is sent anywhere real. No form posts, no
   lead, no email, no visit count. The live address is never affected. */
(function(){
  var h=location.hostname;
  if(!(/--/.test(h)&&/\.netlify\.app$/.test(h))) return;
  window.__TEST_COPY=true;
  window['ga-disable-G-MG7T0687RT']=true;window['ga-disable-AW-18269689296']=true;
  var m=document.createElement('meta');m.name='robots';m.content='noindex,nofollow';document.head.appendChild(m);
  var real=window.fetch;
  window.fetch=function(u,o){var meth=String((o&&o.method)||'GET').toUpperCase();
    if(meth!=='GET'&&meth!=='HEAD'){return Promise.resolve(new Response('{"ok":true,"testCopy":true}',{status:200,headers:{'content-type':'application/json'}}));}
    return real.apply(this,arguments);};
  if(navigator.sendBeacon){navigator.sendBeacon=function(){return true;};}
  document.addEventListener('submit',function(e){var f=e.target;if(f&&String(f.method||'').toLowerCase()==='post'){e.preventDefault();e.stopImmediatePropagation();alert('Test version: this form does not send.');}},true);
  document.addEventListener('DOMContentLoaded',function(){var b=document.createElement('div');b.setAttribute('role','note');b.textContent='Test version, not your live site. Forms here do not send.';b.style.cssText='position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#C8A84B;color:#15110A;font:600 12px/1.4 -apple-system,Segoe UI,sans-serif;text-align:center;padding:5px 10px';document.body.appendChild(b);});
})();
