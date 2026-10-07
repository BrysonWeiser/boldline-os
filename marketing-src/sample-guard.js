/* Sample site guard. These pages show a made-up business, so nothing on them may reach anything real:
   no form is sent, no enquiry is created, no visit is counted. Runs before anything else on the page. */
(function(){
  window.__SAMPLE_SITE=true;
  var real=window.fetch;
  window.fetch=function(u,o){var m=String((o&&o.method)||'GET').toUpperCase();
    if(m!=='GET'&&m!=='HEAD'){return Promise.resolve(new Response('{"ok":true,"sample":true}',{status:200,headers:{'content-type':'application/json'}}));}
    return real.apply(this,arguments);};
  if(navigator.sendBeacon){navigator.sendBeacon=function(){return true;};}
  document.addEventListener('submit',function(e){
    e.preventDefault();e.stopImmediatePropagation();
    var f=e.target;if(!f||f.querySelector('.bl-note'))return;
    var n=document.createElement('p');n.className='bl-note';n.setAttribute('role','status');
    n.textContent="This is a sample website, so this form doesn't send anything. On your site, every enquiry comes straight to you.";
    f.appendChild(n);
  },true);
})();
