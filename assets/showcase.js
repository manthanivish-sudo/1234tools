/**
 * The showcase: the rules a submission has to meet, and the form on
 * /showcase/ that sends one.
 *
 * One file for both halves on purpose. The browser loads it to check the
 * form before anything is sent; build/showcase.js (the owner's command line)
 * and build-showcase.js require it in Node to check every approved entry
 * again before it is written into a page. The Cloud Function that receives
 * the form (submitShowcase, in the private backend) carries the same rules
 * and the same words, so a refusal reads the same wherever it comes from.
 * Change one, change the other.
 *
 * Nothing here runs on load beyond wiring the form. The only request it ever
 * makes is the POST when somebody presses Send, to the address written into
 * the form's data-endpoint by build-showcase.js.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.Showcase = api;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { api.mount(root.document); });
    else api.mount(root.document);
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Where each platform's posts live. A link is accepted only for the
     platform it claims: "See it on Instagram" that opens somewhere else is
     the one thing a hand-approved list must never print. */
  var PLATFORMS = {
    instagram: { label: 'Instagram', hosts: ['instagram.com'] },
    youtube: { label: 'YouTube', hosts: ['youtube.com', 'youtu.be'] },
    tiktok: { label: 'TikTok', hosts: ['tiktok.com'] },
    x: { label: 'X', hosts: ['x.com', 'twitter.com'] },
    linkedin: { label: 'LinkedIn', hosts: ['linkedin.com'] },
    facebook: { label: 'Facebook', hosts: ['facebook.com', 'fb.watch', 'fb.com'] },
    threads: { label: 'Threads', hosts: ['threads.net', 'threads.com'] },
    pinterest: { label: 'Pinterest', hosts: ['pin.it'] },
    behance: { label: 'Behance', hosts: ['behance.net'] },
    dribbble: { label: 'Dribbble', hosts: ['dribbble.com'] },
    github: { label: 'GitHub', hosts: ['github.com'] },
    medium: { label: 'Medium', hosts: ['medium.com'] },
    substack: { label: 'Substack', hosts: ['substack.com'] },
    website: { label: 'A website', hosts: [] }
  };
  var TOOL_PATH = /^\/[a-z0-9-]+\/(?:[a-z0-9-]+\/){0,2}$/;
  var EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/;
  var FLOOR = 2500;   /* ms: nobody reads the form and fills it in faster */
  var CONSENT = 'I agree that 1234Tools may show my name, handle and link on its site';

  var MSG = {
    name: 'Your name, as you would like it shown — at least two characters.',
    handle: 'A handle is letters, numbers, dots, dashes and underscores — the part after the @.',
    platform: 'Pick where the thing you made is posted.',
    urlMissing: 'Paste the link to what you made.',
    urlLong: 'That link is over 300 characters. Use the share link the app gives you, which is shorter.',
    urlHttps: 'The link has to start with https:// — copy it from the share button.',
    urlShape: 'That link does not look like a share link. Copy it from the share button.',
    urlWebsite: 'That address cannot be listed. Use your own site’s public https address.',
    urlHost: function (label) { return 'That link is not on ' + label + ' — check the link, or pick the right platform.'; },
    tool: 'Pick the tool you used.',
    audience: 'Pick what you do from the list, or leave it blank.',
    email: 'That email address does not look right. Leave it blank if you would rather not hear back.',
    consent: 'Tick the box to agree to your name, handle and link being shown. Without it we cannot list anything.'
  };

  function hostOk(platform, host) {
    host = String(host || '').toLowerCase();
    var under = function (h) { return host === h || host.slice(-(h.length + 1)) === '.' + h; };
    if (platform === 'website') {
      if (!host || host.indexOf('.') < 0) return false;
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(':') >= 0 || host.charAt(0) === '[') return false;
      if (/(^|\.)(localhost|local|internal|test|example|invalid)$/.test(host)) return false;
      return !under('1234tools.com');
    }
    if (platform === 'pinterest' && /(^|\.)pinterest\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/.test(host)) return true;
    var p = PLATFORMS[platform];
    return !!p && p.hosts.some(under);
  }

  /** Which platform a link is on, or '' if it is none of the named ones. */
  function detect(url) {
    var host;
    try { host = new URL(String(url).trim()).hostname.toLowerCase(); } catch (e) { return ''; }
    for (var k in PLATFORMS) if (k !== 'website' && hostOk(k, host)) return k;
    return '';
  }

  /**
   * Check and clean one submission. Returns { value, errors } where errors
   * maps a field name to the sentence to show beside it. The same rules as
   * the function; the browser runs them so a mistake is caught before the
   * network, and the build runs them so nothing unfit reaches a page.
   */
  function check(d) {
    d = d || {};
    var errors = {};
    var str = function (v, max) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''; };
    var name = str(d.name, 80);
    if (name.length < 2) errors.name = MSG.name;
    var handle = str(d.handle, 61).replace(/^@+/, '').slice(0, 60);
    if (handle && !/^[A-Za-z0-9._-]+$/.test(handle)) errors.handle = MSG.handle;
    var platform = str(d.platform, 20);
    if (!Object.prototype.hasOwnProperty.call(PLATFORMS, platform)) errors.platform = MSG.platform;
    var raw = typeof d.url === 'string' ? d.url.trim() : '';
    var href = '';
    if (!raw) errors.url = MSG.urlMissing;
    else if (raw.length > 300) errors.url = MSG.urlLong;
    else {
      var u = null;
      try { u = new URL(raw); } catch (e) { /* below */ }
      if (!u || u.protocol !== 'https:') errors.url = MSG.urlHttps;
      else if (u.username || u.password || u.port) errors.url = MSG.urlShape;
      else if (!errors.platform && !hostOk(platform, u.hostname)) errors.url = platform === 'website' ? MSG.urlWebsite : MSG.urlHost(PLATFORMS[platform].label);
      else href = u.href;
    }
    var tool = str(d.tool, 120);
    if (!TOOL_PATH.test(tool)) errors.tool = MSG.tool;
    var audience = str(d.audience, 40);
    if (audience && !/^[a-z0-9-]{1,40}$/.test(audience)) errors.audience = MSG.audience;
    var note = str(d.note, 280);
    var email = str(d.email, 200);
    if (email && !EMAIL.test(email)) errors.email = MSG.email;
    if (d.consent !== true) errors.consent = MSG.consent;
    return {
      value: { name: name, handle: handle || null, platform: platform, url: href, tool: tool, audience: audience || null, note: note, email: email || null },
      errors: errors
    };
  }

  /* ---------------------------------------------------------------- */
  /* the form                                                          */
  /* ---------------------------------------------------------------- */

  function mount(doc) {
    var f = doc.getElementById('sc-form');
    if (!f || f.getAttribute('data-ready')) return;
    f.setAttribute('data-ready', '1');
    var endpoint = f.getAttribute('data-endpoint') || '';
    var opened = Date.now();
    var $ = function (id) { return doc.getElementById(id); };
    var msg = $('sc-msg'), btn = $('sc-send');
    var FIELDS = ['name', 'handle', 'platform', 'url', 'tool', 'audience', 'note', 'email', 'consent'];

    function say(t, kind) { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }
    function mark(field, text) {
      var c = $('sc-' + field), e = $('sc-' + field + '-err');
      if (e) { e.textContent = text || ''; e.hidden = !text; }
      if (c) { if (text) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid'); }
    }

    /* ?tool=/pdf/merge-pdf/ — the "send yours" link on a tool page */
    var want = '';
    try { want = new URLSearchParams(doc.location.search).get('tool') || ''; } catch (e) { /* old browser */ }
    var sel = $('sc-tool');
    if (want && TOOL_PATH.test(want) && sel) {
      var found = false;
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === want) { found = true; break; }
      if (!found) { var o = doc.createElement('option'); o.value = want; o.textContent = want; sel.appendChild(o); }
      sel.value = want;
    }

    /* a pasted Instagram link picks Instagram, if nothing is picked yet */
    var url = $('sc-url'), plat = $('sc-platform');
    if (url && plat) url.addEventListener('change', function () { if (!plat.value) { var p = detect(url.value); if (p) plat.value = p; } });

    FIELDS.forEach(function (k) {
      var c = $('sc-' + k);
      if (c) c.addEventListener(k === 'consent' || c.tagName === 'SELECT' ? 'change' : 'input', function () { mark(k, ''); });
    });

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var read = function (k) { var c = $('sc-' + k); return c ? c.value : ''; };
      var data = {
        name: read('name'), handle: read('handle'), platform: read('platform'), url: read('url'), tool: read('tool'),
        audience: read('audience'), note: read('note'), email: read('email'), consent: !!($('sc-consent') && $('sc-consent').checked)
      };
      var r = check(data);
      FIELDS.forEach(function (k) { mark(k, r.errors[k]); });
      var first = FIELDS.filter(function (k) { return r.errors[k]; })[0];
      if (first) {
        say(first === 'consent' && Object.keys(r.errors).length === 1 ? r.errors.consent : 'Nothing was sent. Put right what is marked and try again.', 'error');
        var c = $('sc-' + first); if (c && c.focus) c.focus();
        return;
      }
      if (!endpoint) { say('Sending is switched off on this copy of the site. Use the contact page instead.', 'error'); return; }
      btn.disabled = true;
      say('Sending…', 'note');
      var body = Object.assign({}, r.value, { consent: true, trap: ($('sc-trap') || {}).value || '', tookMs: Date.now() - opened });
      fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: body }) })
        .then(function (res) { return res.json().then(function (b) { return { ok: res.ok, b: b }; }, function () { return { ok: false, b: null }; }); })
        .then(function (x) {
          if (x.ok && x.b && x.b.result && x.b.result.ok) {
            f.reset();
            if (want && sel) sel.value = want;
            say('Thank you — it is with us. Nothing goes up until we have looked at it, usually within a week. If you left an email, you will hear when it does.', 'note');
            return;
          }
          say((x.b && x.b.error && x.b.error.message) || 'That did not send. Try again in a moment, or use the contact page.', 'error');
        })
        .catch(function () { say('That did not send — the connection dropped. Try again in a moment, or use the contact page.', 'error'); })
        .then(function () { btn.disabled = false; });
    });
  }

  return { PLATFORMS: PLATFORMS, TOOL_PATH: TOOL_PATH, FLOOR: FLOOR, CONSENT: CONSENT, MSG: MSG, hostOk: hostOk, detect: detect, check: check, mount: mount };
}));
