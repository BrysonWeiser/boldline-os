/* Remember where a visitor came from, and send it with whatever form they fill in.
 *
 * Bryson, 2026-09-04, on BoldLine's first lead: "I'm not sure where from yet". Nothing on
 * this site had ever recorded it, so the answer did not exist anywhere to be looked up. The
 * ad dashboards cannot answer it either: they hold totals, not which click became a person.
 *
 * 🔴 NETLIFY FORMS ONLY RECORDS FIELDS THAT ARE DECLARED IN THE FORM'S HTML. A hidden input
 * created by script at submit time is posted and then silently dropped, which looks exactly
 * like working code. So every form carries ONE declared field named `attribution` and this
 * fills it with JSON. One field is also far harder to forget on a new form than eleven.
 *
 * 🔴 FIRST TOUCH WINS, UNLESS THIS VISIT CARRIES AD PARAMETERS. Someone clicks the ad, reads
 * for a while, comes back the next day and fills the form: that lead belongs to the ad. But
 * someone who clicks a NEW ad belongs to the new one, so live parameters always overwrite.
 *
 * Nothing here can break a form. Every read and write is wrapped, and a failure leaves the
 * field empty rather than blocking a submission. A lost attribution is a shame; a lost lead
 * is the business.
 */
(function () {
  var KEY = "bl_origin";
  var CLICK = ["gclid", "wbraid", "gbraid", "fbclid", "msclkid", "ttclid"];
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var PARAMS = CLICK.concat(UTM);

  function read() {
    try { return JSON.parse(window.sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function write(v) {
    try { window.sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }

  function capture() {
    var stored = read();
    var found = {};
    var hits = 0;
    try {
      var q = new URLSearchParams(window.location.search);
      for (var i = 0; i < PARAMS.length; i++) {
        var v = (q.get(PARAMS[i]) || "").trim();
        if (v) { found[PARAMS[i]] = v.slice(0, 300); hits++; }
      }
    } catch (e) { /* no URLSearchParams, fall through to the stored value */ }

    // A visit with no ad parameters never overwrites what we already know.
    if (stored && !hits) return stored;

    try {
      found.landing_page = (window.location.pathname || "/").slice(0, 300);
      var ref = document.referrer || "";
      // A link from one page of this site to another is not where they came from.
      if (ref && ref.indexOf(window.location.origin) !== 0) found.referrer = ref.slice(0, 300);
    } catch (e) { /* leave them out */ }

    write(found);
    return found;
  }

  function fill(form) {
    if (!form || !form.querySelector) return;
    var field = form.querySelector('input[name="attribution"]');
    if (!field) return;                       // this form does not collect it
    try { field.value = JSON.stringify(capture()); } catch (e) { /* leave it empty */ }
  }

  function fillAll() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) fill(forms[i]);
  }

  // Filled on load AND again on submit: on load so a plain HTML post carries it, and on
  // submit so a form built or shown later still does.
  function start() {
    capture();
    fillAll();
    document.addEventListener("submit", function (e) {
      if (e && e.target) fill(e.target);
    }, true);
  }

  // Anything posting JSON of its own (the free audit, the newsletter) asks for it directly.
  window.blOrigin = capture;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
