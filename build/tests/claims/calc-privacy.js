/**
 * "Nothing uploaded" / "Runs in your browser", the pill on every calculator
 * page, held to what it means: the figures someone types stay on the page.
 * And "Works offline once opened", where a page says it. Each calculator is
 * opened in headless Chrome with its Example's figures (the "Try these
 * numbers" fragment) and the results on screen, twice:
 *
 *   consent refused  not one request leaves the local server;
 *   consent granted  the only requests outside are the two analytics
 *                    scripts (refused here, so no test reaches Google or
 *                    Clarity), and none of them carries a typed figure;
 *                    everything queued for GA4 (window.dataLayer) is free
 *                    of the figures and its page_location has no fragment
 *                    or query; and every input and every result on the
 *                    page is masked from Clarity's session replay
 *                    (data-clarity-mask on it or an ancestor).
 */
'use strict';
const path = require('path');
const fs = require('fs');

module.exports = function ({ claim, manual, kit: K }) {
  const B = 'browser';
  const file = path.join(K.ROOT, 'assets', 'examples.js');
  if (!fs.existsSync(file)) return;
  const w = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(w);
  const all = w.TOOL_EXAMPLES || {};
  const ANALYTICS = /^https:\/\/(www\.googletagmanager\.com|www\.clarity\.ms)\//;
  /* the pill each page shows: the privacy checks hang on whichever it has */
  const PILLS = ['Nothing uploaded', 'Runs in your browser'];
  const OFFLINE = 'Works offline once opened';

  for (const [url, ex] of Object.entries(all)) {
    if (ex.kind !== 'calc') continue;
    const f = path.join(K.ROOT, url.replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, 'utf8');
    /* a page with neither pill still says so in its footer */
    const QUOTE = PILLS.find((q) => html.indexOf(q) >= 0) || 'almost all of them running entirely in your browser';
    const wait = /MVRTool\.mountCurrency\(/.test(html) ? '.control' : '.tool-form .control';
    const hash = ex.try || '';
    /* the typed figures worth looking for: three characters or more with a
       digit in them, so a "1", a "no" or a choice such as "margin" (which is
       also in the page's own address) cannot match by accident */
    const typed = [...new URLSearchParams(hash.replace(/^#/, '')).values()].filter((v) => String(v).length >= 3 && /\d/.test(v));

    const settle = async (p) => {
      await p.waitForFunction(() => [...document.querySelectorAll('.result-value, .result-primary')].some((e) => e.textContent.trim()), { timeout: 20000 }).catch(() => {});
      await K.sleep(300);
    };

    claim(url, 'ui', QUOTE, 'consent refused: no request leaves the site', B, async () => {
      const p = await K.open(url + hash, { wait });
      try {
        await settle(p);
        const away = p.__requests.filter((r) => !r.url.startsWith(K.BASE)).map((r) => r.url);
        const shown = await p.$$eval('.result-value, .result-primary', (els) => els.length);
        return [away.length === 0 && shown > 0, away.length ? away.join(' | ') : shown + ' results on screen, every request to ' + K.BASE];
      } finally { await p.close(); }
    });

    claim(url, 'ui', QUOTE, 'consent granted: analytics gets no figure, replay masks them', B, async () => {
      const p = await K.open(url + hash, { consent: 'granted', wait });
      try {
        await settle(p);
        const bad = [];
        const away = p.__requests.filter((r) => !r.url.startsWith(K.BASE));
        for (const r of away) {
          if (!ANALYTICS.test(r.url)) bad.push('request to ' + r.url);
          for (const v of typed) if (r.url.indexOf(encodeURIComponent(v)) >= 0 || r.url.indexOf(v) >= 0) bad.push(r.url + ' carries ' + v);
        }
        const seen = await p.evaluate(() => {
          /* gtag('js', new Date()) is GA4's own clock, not a figure anyone typed */
          const dl = JSON.stringify((window.dataLayer || []).filter((a) => a[0] !== 'js').map((a) => Array.prototype.slice.call(a)));
          const loc = (window.dataLayer || []).map((a) => a[2] && a[2].page_location || a[1] && a[1].page_location).filter(Boolean);
          const unmasked = [...document.querySelectorAll('.tool input, .tool select, .tool textarea, .result-value, .tool-table td')]
            .filter((e) => !e.closest('[data-clarity-mask="true"]'))
            .map((e) => e.className || e.id || e.tagName);
          return { dl, loc, unmasked, results: document.querySelectorAll('.result-value, .result-primary').length };
        });
        for (const v of typed) if (seen.dl.indexOf(v) >= 0) bad.push('dataLayer carries ' + v);
        for (const l of seen.loc) if (/[#?]/.test(l)) bad.push('page_location ' + l);
        if (!seen.loc.length) bad.push('no page_location set (analytics did not start)');
        if (seen.unmasked.length) bad.push(seen.unmasked.length + ' not masked from replay: ' + seen.unmasked.slice(0, 5).join(', '));
        if (!seen.results) bad.push('no results on screen');
        return [bad.length === 0, bad.length ? bad.join(' | ') : away.length + ' analytics script requests (refused), ' + seen.results + ' results masked, no figure in ' + seen.loc.length + ' page_location / dataLayer'];
      } finally { await p.close(); }
    });

    /* "Works offline once opened": once the service worker has the page, a
       reload with the network cut still gives a working calculator */
    if (html.indexOf(OFFLINE) >= 0) {
      claim(url, 'ui', OFFLINE, 'reload offline: the calculator still works', B, async () => {
        const p = await K.open(url + hash, { wait });
        try {
          await settle(p);
          const ready = await p.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.ready.then(() => true) : false);
          if (!ready) return [false, 'no service worker'];
          /* the first visit's worker takes control on the next load */
          if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) { await p.reload({ waitUntil: 'load' }); await settle(p); }
          await K.sleep(500);
          await p.setOfflineMode(true);
          await p.reload({ waitUntil: 'load' });
          await p.waitForSelector(wait, { timeout: 15000 });
          await settle(p);
          const r = await p.evaluate(() => [...document.querySelectorAll('.result-value, .result-primary')].map((e) => e.textContent.trim()).filter(Boolean));
          return [r.length > 0, r.length ? 'offline: ' + r.slice(0, 3).join(' · ') : 'no results offline'];
        } catch (e) {
          return [false, 'offline reload failed: ' + (e && e.message || e)];
        } finally { try { await p.setOfflineMode(false); } catch (e) { /* */ } await p.close(); }
      });
    }
  }
};
