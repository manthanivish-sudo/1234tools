/**
 * Check every outbound link in the learning directory still resolves.
 *
 *   node build/check-links.js               check, print a report
 *   node build/check-links.js --json        machine-readable, for CI
 *   node build/check-links.js --no-browser  skip the browser second opinion
 *
 * Exits non-zero when something is genuinely dead, so a scheduled run fails
 * loudly instead of leaving the directory to rot in silence.
 *
 * Three things this had to get right, each learned by getting it wrong:
 *
 * Not HEAD. Plenty of sites answer HEAD with 405 while serving GET perfectly
 * well, so a HEAD-only pass reports failures that are not there.
 *
 * Not Node's HTTP client. Anything behind Cloudflare fingerprints the TLS
 * handshake and HTTP/2 settings, and Node looks nothing like a browser at that
 * layer — LeetCode, Investopedia and CBIC all answered it 403 while answering
 * curl 200 from the same machine, one second apart. curl is used instead
 * because it is ubiquitous, speaks HTTP/2, and is present on every CI runner
 * worth using.
 *
 * A refusal is not an absence. A 403 means the host answered and declined;
 * it says nothing about whether the page exists. Those are reported separately
 * and do not fail the run, because a weekly job that cries wolf is a weekly
 * job that stops being read — which is the exact failure this script exists to
 * prevent. Anything still refusing gets one more try in a real browser, and
 * whatever survives that is listed for a human to glance at.
 */
'use strict';
const { execFile } = require('child_process');
const { URL } = require('url');
const { CATEGORIES } = require('./learn-data.js');

const JSON_OUT = process.argv.includes('--json');
const NO_BROWSER = process.argv.includes('--no-browser');
const CONCURRENCY = 6;          // polite: these are other people's servers
const TIMEOUT_S = 25;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** Ignore the differences every site makes and nobody cares about. */
function sameAddress(a, b) {
  const tidy = (u) => {
    try {
      const x = new URL(u);
      return x.host.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search;
    } catch (e) { return u; }
  };
  return tidy(a) === tidy(b);
}

function fetchStatus(target) {
  return new Promise(function (resolve) {
    const args = [
      '-sS', '-o', '/dev/null', '-L', '--max-redirs', '5',
      '--max-time', String(TIMEOUT_S), '-A', UA,
      /* User agent only. Adding accept and accept-language made this worse,
         not better: a request claiming to be Chrome while carrying a header
         set no Chrome ever sends is a clearer bot signature than one carrying
         none, and LeetCode and Investopedia both went from 200 to 403 the
         moment they were added. */
      '-w', '%{http_code} %{url_effective}',
      target
    ];
    execFile('curl', args, { timeout: (TIMEOUT_S + 10) * 1000 }, function (err, stdout, stderr) {
      if (err && !stdout) {
        resolve({ ok: false, status: 0, note: (String(stderr).trim().split('\n').pop() || err.message).slice(0, 80) });
        return;
      }
      const parts = String(stdout).trim().split(/\s+/);
      const status = Number(parts[0]) || 0;
      const finalUrl = parts[1] || target;
      resolve({
        ok: status >= 200 && status < 400,
        status: status,
        blocked: status === 401 || status === 403 || status === 429,
        movedTo: status >= 200 && status < 300 && !sameAddress(finalUrl, target) ? finalUrl : null
      });
    });
  });
}

/**
 * Ask a real browser. Reserved for links curl was refused, because it costs
 * about a second each and there should only ever be a handful.
 */
async function viaBrowser(links) {
  if (!links.length || NO_BROWSER) return new Map();
  let puppeteer;
  try { puppeteer = require('../node_modules/puppeteer-core'); }
  catch (e) { return new Map(); }

  const CHROME = process.env.CHROME_PATH ||
    'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const out = new Map();
  let browser;
  try { browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' }); }
  catch (e) { return out; }              // no browser here: leave them unverified

  for (const link of links) {
    const page = await browser.newPage();
    try {
      const res = await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_S * 1000 });
      const status = res ? res.status() : 0;
      out.set(link.url, { ok: status >= 200 && status < 400, status: status, via: 'browser' });
    } catch (e) {
      out.set(link.url, { ok: false, status: 0, note: String(e.message).split('\n')[0], via: 'browser' });
    }
    await page.close();
  }
  await browser.close();
  return out;
}

/** Run over a list with a fixed number of workers. */
async function pool(items, size, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async function () {
    while (next < items.length) {
      const i = next++;
      out[i] = await worker(items[i], i);
    }
  }));
  return out;
}

(async function () {
  const all = [];
  for (const cat of CATEGORIES) {
    for (const [title, url, provider, cost] of cat.links) {
      all.push({ category: cat.name, slug: cat.slug, title, url, provider, cost });
    }
  }

  /* A duplicate URL across categories is usually a mistake, and always worth
     knowing about before it is published twice. */
  const seen = new Map();
  const duplicates = [];
  for (const l of all) {
    if (seen.has(l.url)) duplicates.push(l.url + '  (' + seen.get(l.url) + ' and ' + l.category + ')');
    else seen.set(l.url, l.category);
  }

  if (!JSON_OUT) {
    console.log('\ncheck-links.js');
    console.log('  ' + all.length + ' links across ' + CATEGORIES.length + ' categories\n');
  }

  const results = await pool(all, CONCURRENCY, async function (link) {
    const r = await fetchStatus(link.url, 0, null);
    if (!JSON_OUT) {
      const mark = r.ok ? (r.movedTo ? '~' : '.') : 'X';
      process.stdout.write(mark);
    }
    return Object.assign({}, link, r);
  });

  /* Second opinion for everything that refused a script. */
  const refused = results.filter(function (r) { return !r.ok && r.blocked; });
  if (refused.length && !JSON_OUT) {
    console.log('\n  ' + refused.length + ' refused a script; asking a browser…');
  }
  const second = await viaBrowser(refused);
  for (const r of results) {
    const b = second.get(r.url);
    if (!b) continue;
    r.ok = b.ok;
    r.status = b.status || r.status;
    r.via = 'browser';
    if (b.note) r.note = b.note;
  }

  const dead = results.filter(function (r) { return !r.ok && !r.blocked; });
  const unverified = results.filter(function (r) { return !r.ok && r.blocked; });
  const moved = results.filter(function (r) { return r.ok && r.movedTo; });

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: results.length, dead, unverified, moved, duplicates }, null, 2));
  } else {
    console.log('\n');
    if (duplicates.length) {
      console.log('  duplicate URLs (' + duplicates.length + '):');
      duplicates.forEach(function (d) { console.log('    ' + d); });
      console.log('');
    }
    if (moved.length) {
      console.log('  moved permanently (' + moved.length + ') — update the curated URL:');
      moved.forEach(function (m) {
        console.log('    ' + m.title + ' [' + m.slug + ']');
        console.log('        ' + m.url);
        console.log('     -> ' + m.movedTo);
      });
      console.log('');
    }
    if (unverified.length) {
      console.log('  could not verify (' + unverified.length + ') — the host refused both a script');
      console.log('  and a browser, so check these by hand rather than assuming the worst:');
      unverified.forEach(function (u) {
        console.log('    ' + u.title + ' [' + u.slug + ']  ' + (u.status || u.note));
        console.log('        ' + u.url);
      });
      console.log('');
    }
    if (dead.length) {
      console.log('  DEAD (' + dead.length + '):');
      dead.forEach(function (d) {
        console.log('    ' + d.title + ' [' + d.slug + ']  ' + (d.status || d.note) +
          (d.via ? ' (' + d.via + ')' : ''));
        console.log('        ' + d.url);
      });
      console.log('');
    }
    console.log('  ' + (results.length - dead.length - unverified.length) + ' of ' + results.length + ' confirmed' +
      (unverified.length ? ', ' + unverified.length + ' unverifiable' : '') +
      (moved.length ? ', ' + moved.length + ' moved' : '') + '\n');
  }

  process.exit(dead.length ? 1 : 0);
})();
