/**
 * Claims on the developer tools' pages (/developer/), checked on each
 * tool's own engine: in Node through a vm with a stub window, and in Chrome
 * on the real page where the claim depends on the browser's built-ins (the
 * JSON parser's messages) or on the page's UI (the favicon generator).
 */
'use strict';
const fs = require('fs');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const T = (file, id) => K.tool(file, id);
  const out = (r) => (r && (r.output || r.error)) || '';
  /** run a spec's transform/generate inside the tool's own page, with the page's defaults */
  const inPage = async (url, id, input, opts) => {
    const p = await K.open(url);
    try {
      return await p.evaluate((id, input, opts) => {
        const s = (window.DEV_TOOLS || window.TEXT_TOOLS)[id];
        const d = {}; (s.options || s.fields || []).forEach((x) => { d[x.key] = x.default; }); Object.assign(d, opts || {});
        return s.transform ? s.transform(String(input), d) : s.generate(d);
      }, id, input, opts || {});
    } finally { await p.close(); }
  };

  /* ================================================================ */
  const B64 = '/developer/base64/';
  const b64 = () => T('dev-base64.js', 'base64');
  claim(B64, 'point', 'URL-safe output swaps + for - and / for _, then drops the = signs.', '">>>?" → Pj4+Pw== and Pj4-Pw', N, async () => {
    const a = out(K.tx(b64(), '>>>?')), u = out(K.tx(b64(), '>>>?', { safe: 'url' }));
    return [a === 'Pj4+Pw==' && u === 'Pj4-Pw', a + ' / ' + u];
  });
  claim(B64, 'point', 'Decoding accepts either alphabet, restores missing padding and ignores spaces and line breaks. Any other stray character is an error.',
    'Pj4-Pw and "Pj4+\\nPw==" decode; "Pj4*Pw==" is refused', N, async () => {
      const d = (s) => K.tx(b64(), s, { dir: 'dec' });
      const a = d('Pj4-Pw'), b = d('Pj4+\nPw=='), s = d('Pj4+ Pw=='), c = d('Pj4*Pw==');
      return [a.output === '>>>?' && b.output === '>>>?' && s.output === '>>>?' && !!c.error, ['Pj4-Pw → ' + out(a), 'with a line break → ' + out(b), 'with a space → ' + out(s), 'with * → ' + out(c)].join(' | ')];
    });
  claim(B64, 'dfaq', 'This decoder ignores whitespace, so wrapped input decodes as one block.',
    'every payload of 1–300 UTF-8 bytes, wrapped at 76 (MIME) and 64 (PEM) with LF and CRLF, standard and base64url, decodes to the exact bytes', N, async () => {
      const spec = b64(); let tried = 0; const bad = [];
      for (let n = 1; n <= 300; n++) {
        let text = ''; const parts = ['é', '₹', '😀', 'a', '>', '?', '~'];
        for (let i = 0; Buffer.byteLength(text) < n; i++) { const p = parts[(i * 5 + n) % parts.length]; text += Buffer.byteLength(text + p) <= n ? p : 'x'; }
        const std = Buffer.from(text).toString('base64'), url = std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        for (const w of [76, 64]) for (const eol of ['\n', '\r\n']) for (const b of [std, url]) {
          tried++;
          const r = K.tx(spec, b.replace(new RegExp('.{' + w + '}', 'g'), '$&' + eol), { dir: 'dec' });
          if (!(r.output !== undefined && Buffer.from(r.output, 'utf8').equals(Buffer.from(text, 'utf8')))) bad.push(n + ' B at ' + w + (eol === '\n' ? ' LF' : ' CRLF') + (b === url ? ' url' : '') + ': ' + (r.error || 'wrong bytes'));
        }
      }
      return [bad.length === 0, bad.length ? bad.length + ' of ' + tried + ' failed, e.g. ' + bad.slice(0, 3).join('; ') : tried + ' wrapped inputs decoded to the exact bytes'];
    });
  claim(B64, 'point', 'Input, Output and Growth count UTF-8 bytes: Café Zoë — ₹1,499 paid ✓ is 32 B in, 44 B out, +38%.', 'the example string', N, async () => {
    const r = K.tx(b64(), 'Café Zoë — ₹1,499 paid ✓');
    return [K.stat(r, 'Input') === '32 B' && K.stat(r, 'Output') === '44 B' && K.stat(r, 'Growth') === '+38%', K.j(r.stats)];
  });
  claim(B64, 'faq', 'This one converts to UTF-8 first, so accents, CJK characters and emoji round-trip correctly.', 'é, 日本 and 😀 round-trip', N, async () => {
    const s = 'é 日本 😀'; const e = out(K.tx(b64(), s)); const d = out(K.tx(b64(), e, { dir: 'dec' }));
    return [d === s && e === Buffer.from(s, 'utf8').toString('base64'), e + ' → ' + d];
  });
  claim(B64, 'works', 'the browser\'s btoa() is not used.', 'encoding works with btoa and atob removed', N, async () => {
    const s = K.tool('dev-base64.js', 'base64', { btoa: () => { throw new Error('btoa called'); }, atob: () => { throw new Error('atob called'); } });
    const r = K.tx(s, 'é😀'); const d = K.tx(s, r.output || '', { dir: 'dec' });
    return [r.output === Buffer.from('é😀').toString('base64') && d.output === 'é😀', out(r) + ' / ' + out(d)];
  });
  claim(B64, 'dfaq', 'One leftover byte at the end produces two characters plus ==; two leftover bytes produce three characters plus =.', '"a" → YQ==, "ab" → YWI=', N, async () => {
    const a = out(K.tx(b64(), 'a')), b = out(K.tx(b64(), 'ab')); return [a === 'YQ==' && b === 'YWI=', a + ' ' + b];
  });
  claim(B64, 'point', 'Open or drop any file to encode its bytes. Decode shows text as text; anything else gets a hex view, a Download of the exact bytes and, for images, a preview.',
    'a PNG opened: Base64 equals Buffer\'s and downloads as .base64.txt; decoded again: hex view, preview, and Download returns the same bytes', B, async () => {
      const p = await K.open(B64);
      try {
        await p.evaluate(() => { Object.keys(localStorage).filter((k) => /base64/.test(k)).forEach((k) => localStorage.removeItem(k)); });
        const png = await K.img.makePng(p, 120, 80, "x.fillStyle='#c33';x.fillRect(0,0,w,h);x.fillStyle='#39c';x.fillRect(30,20,60,40);");
        const f = K.write('b64-src.png', png);
        const input = await p.$('.tool-io input[type=file]'); await input.uploadFile(f);
        await p.waitForFunction(() => /File/.test(document.querySelector('.stat-grid').textContent) && document.querySelector('.b64-image img'), { timeout: 30000 });
        const enc = await p.evaluate(() => document.querySelector('.code-out').textContent);
        await K.clearDownloads(p);
        await K.clickText(p, '.tool-io button', /^Download$/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [d1] = await K.downloads(p);
        const encOk = enc === Buffer.from(png).toString('base64') && d1.name === 'b64-src.base64.txt' && d1.bytes.toString('utf8') === enc;
        await p.select('#f-dir', 'dec');
        await p.evaluate((t) => { const a = document.querySelector('textarea.code-area'); a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); }, 'data:image/png;base64,' + enc);
        await p.waitForFunction(() => /^00000000/.test(document.querySelector('.code-out').textContent), { timeout: 30000 });
        await K.sleep(300);
        const view = await p.evaluate(() => ({ hex: document.querySelector('.code-out').textContent.slice(0, 40), img: (document.querySelector('.b64-image img') || {}).naturalWidth, note: document.querySelector('.io-msg').textContent }));
        await K.clearDownloads(p);
        await K.clickText(p, '.tool-io button', /^Download$/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [d2] = await K.downloads(p);
        const back = d2.name === 'decoded.png' && Buffer.compare(d2.bytes, Buffer.from(png)) === 0;
        return [encOk && back && view.img === 120 && /^00000000  89 50 4e 47/.test(view.hex), 'encoded equals Buffer: ' + encOk + ' (' + d1.name + '); decoded: ' + view.hex.slice(0, 24) + ', preview ' + view.img + ' px wide, saved ' + d2.name + ' identical: ' + back];
      } finally { await p.close(); }
    });
  claim(B64, 'mistake', 'Copying a Base64 string with its quotation marks or a trailing comma from JSON or code. They are not Base64 characters, and the error names the line and column.',
    '"QUJD", → line 1 column 1; QUJD, → line 1 column 5', N, async () => {
      const a = K.tx(b64(), '"QUJD",', { dir: 'dec' }), b = K.tx(b64(), 'QUJD,', { dir: 'dec' });
      return [/line 1, column 1\)/.test(a.error || '') && /line 1, column 5\)/.test(b.error || ''), (a.error || '').slice(-40) + ' | ' + (b.error || '').slice(-40)];
    });

  /* ================================================================ */
  const CC = '/developer/case-converter/';
  const cc = () => T('dev-case-converter.js', 'case-converter');
  claim(CC, 'tip', 'Acronyms are split sensibly: HTTPResponse becomes http_response in snake_case and HttpResponse in PascalCase, not h_t_t_p_response.', 'HTTPResponse in snake and Pascal; XMLHttpRequest and getHTTPSUrl2 too', N, async () => {
    const s = out(K.tx(cc(), 'HTTPResponse', { target: 'snake' })), p = out(K.tx(cc(), 'HTTPResponse', { target: 'pascal' }));
    const more = out(K.tx(cc(), 'XMLHttpRequest\ngetHTTPSUrl2', { target: 'snake' }));
    return [s === 'http_response' && p === 'HttpResponse' && more === 'xml_http_request\nget_https_url2', s + ', ' + p + ', ' + K.j(more)];
  });
  claim(CC, 'point', 'A lower-case letter or digit followed by a capital starts a new word: userId becomes user and Id.', 'userId → user_id', N, async () => {
    const r = out(K.tx(cc(), 'userId', { target: 'snake' })); return [r === 'user_id', r];
  });
  claim(CC, 'point', 'In a run of capitals, the last one before a lower-case letter starts the next word, so XMLHttp splits into XML and Http.', 'XMLHttp → xml_http', N, async () => {
    const r = out(K.tx(cc(), 'XMLHttp', { target: 'snake' })); return [r === 'xml_http', r];
  });
  claim(CC, 'point', 'Underscores, hyphens, dots and slashes become spaces; other punctuation stays attached to its word.', 'a.b-c_d/e\\f → aBCDEF; "Hello, world!" → "Hello, World!"', N, async () => {
    const a = out(K.tx(cc(), 'a.b-c_d/e\\f', { target: 'camel' })), b = out(K.tx(cc(), 'Hello, world!', { target: 'title' }));
    return [a === 'aBCDEF' && b === 'Hello, World!', a + ' / ' + b];
  });
  claim(CC, 'point', 'The words are re-cased and joined, by dots for dot.case and slashes for path/case.', 'three identifiers in both', N, async () => {
    const d = out(K.tx(cc(), 'userProfileImage\nHTTP_STATUS\nsrc/components/NavBar', { target: 'dot' })), q = out(K.tx(cc(), 'userProfileImage\nHTTP_STATUS\nsrc/components/NavBar', { target: 'path' }));
    return [d === 'user.profile.image\nhttp.status\nsrc.components.nav.bar' && q === 'user/profile/image\nhttp/status\nsrc/components/nav/bar', K.j(d) + ' / ' + K.j(q)];
  });
  claim(CC, 'point', 'Alternating case counts letters only, so a space or digit does not break the lower, upper rhythm; Every case at once prints all twelve forms under each line.', 'letter by letter against a reference; twelve rows a line', N, async () => {
    const t = 'hello world 2 you';
    let k = 0; const ref = [...t].map((c) => /[a-z]/i.test(c) ? (k++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c).join('');
    const a = out(K.tx(cc(), t, { target: 'alternating' }));
    const all = out(K.tx(cc(), 'max retry\norder total', { target: 'all' })).split('\n\n').map((b) => b.split('\n'));
    const ok = all.length === 2 && all.every((b) => b.length === 12) && all[0][0] === 'camelCase     maxRetry' && all[1][11] === 'UPPERCASE     ORDER TOTAL';
    return [a === ref && a === 'hElLo WoRlD 2 yOu' && ok, a + ' | ' + K.j(all.map((b) => b.length))];
  });
  claim(CC, 'tip', 'Every case at once lists all twelve forms of each line', 'the option list has twelve single forms', N, async () => {
    const o = cc().options[0].options.map((x) => x.value).filter((v) => v !== 'all'); return [o.length === 12, o.join(', ')];
  });
  claim(CC, 'point', 'Title Case keeps 14 short words such as of, and and vs lower-case unless they come first.', '"of mice and men vs the rest" → "Of Mice and Men vs the Rest"', N, async () => {
    const r = out(K.tx(cc(), 'of mice and men vs the rest', { target: 'title' })); return [r === 'Of Mice and Men vs the Rest', r];
  });
  claim(CC, 'mistake', 'Short words after the first are always lowered, so a band called The The comes out as The the.', '"the the"', N, async () => {
    const r = out(K.tx(cc(), 'The The', { target: 'title' })); return [r === 'The the', r];
  });
  claim(CC, 'faq', 'Turning "user_ID" into camelCase gives "userId"', 'user_ID → userId', N, async () => {
    const r = out(K.tx(cc(), 'user_ID', { target: 'camel' })); return [r === 'userId', r];
  });
  claim(CC, 'works', 'Each line is split into words on its own, then rejoined in the style you pick.', 'two lines stay two lines', N, async () => {
    const r = out(K.tx(cc(), 'first name\nlast name', { target: 'kebab' })); return [r === 'first-name\nlast-name', K.j(r)];
  });

  /* ================================================================ */
  const CO = '/developer/color-converter/';
  const col = (c, bg) => K.gen(T('dev-color-converter.js', 'color-converter'), { colour: c, bg: bg || '#ffffff' });
  claim(CO, 'dfaq', '#1D3557 is 1D = 29, 35 = 53 and 57 = 87, so rgb(29, 53, 87).', 'RGB line', N, async () => {
    const r = col('#1D3557'); return [/rgb\(29, 53, 87\)/.test(r.output), (r.output.match(/rgb\([^)]*\)/) || [''])[0]];
  });
  claim(CO, 'dfaq', 'Pure red is hsl(0, 100%, 50%) but hsb(0, 100%, 100%).', '#ff0000', N, async () => {
    const r = col('#ff0000'); return [/hsl\(0, 100%, 50%\)/.test(r.output) && /hsb\(0, 100%, 100%\)/.test(r.output), r.output.split('\n').slice(3, 5).join(' | ')];
  });
  claim(CO, 'dfaq', '#767676 measures 0.1812.', 'relative luminance of #767676', N, async () => {
    const v = K.stat(col('#767676'), 'Relative luminance'); return [v === '0.1812', v];
  });
  claim(CO, 'mistake', 'Pure yellow and pure blue both come out at 50% lightness, yet on white yellow scores 1.07:1 and blue 8.59:1.', 'yellow and blue on white', N, async () => {
    const y = col('#ffff00'), b = col('#0000ff');
    return [/hsl\(60, 100%, 50%\)/.test(y.output) && /hsl\(240, 100%, 50%\)/.test(b.output) && K.stat(y, 'Contrast ratio') === '1.07:1' && K.stat(b, 'Contrast ratio') === '8.59:1', K.stat(y, 'Contrast ratio') + ' / ' + K.stat(b, 'Contrast ratio')];
  });
  claim(CO, 'point', 'The ratio is shown to two decimals but graded unrounded: 4.5 and 7 for body text, 3 and 4.5 for large text, 3 for interface parts.',
    'a grey at 4.497:1 shows 4.50:1 and is not AA', N, async () => {
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      let found = null;
      for (let r = 0; r < 256 && !found; r++) for (let g = 100; g < 140 && !found; g++) {
        const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(g);
        const ratio = 1.05 / (L + 0.05);
        if (ratio >= 4.495 && ratio < 4.5) found = '#' + [r, g, g].map((v) => v.toString(16).padStart(2, '0')).join('');
      }
      if (!found) return [false, 'no colour found near 4.5'];
      const res = col(found);
      return [K.stat(res, 'Contrast ratio') === '4.50:1' && !/^AA/.test(K.stat(res, 'Body text (AA needs 4.5)') || ''), found + ': ' + K.stat(res, 'Contrast ratio') + ', body ' + K.stat(res, 'Body text (AA needs 4.5)')];
    });

  claim(CO, 'works', 'Either colour can be written in any CSS syntax, or as a name.', 'Chrome reads the same strings the same way: 148 names, and 10 syntaxes for 80 colours, within one step per channel', B, async () => {
    const spec = T('dev-color-converter.js', 'color-converter');
    const rgbOf = (c) => { const r = K.gen(spec, { colour: c, bg: '#ffffff' }); const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(r.output || ''); return m ? [+m[1], +m[2], +m[3]] : null; };
    const names = Object.keys(JSON.parse(JSON.stringify((() => { const s = K.read('engine/dev-color-converter.js').toString(); const m = /const CC_NAMES = (\{[^}]*\});/.exec(s); return eval('(' + m[1] + ')'); })())));
    let seed = 12; const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
    const strings = names.slice();
    const lineOf = (r, tag) => { const l = (r.output || '').split('\n').find((x) => x.indexOf(tag) === 0); return l ? l.slice(6).trim() : ''; };
    for (let i = 0; i < 80; i++) {
      const hex = '#' + [rnd(256), rnd(256), rnd(256)].map((v) => v.toString(16).padStart(2, '0')).join('');
      const r = K.gen(spec, { colour: hex, bg: '#ffffff' });
      ['HEX', 'RGB', 'HSL', 'HWB', 'LAB', 'LCH', 'OKLAB', 'OKLCH'].forEach((t) => strings.push(lineOf(r, t)));
      strings.push('color(srgb ' + [0, 1, 2].map((k) => (parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255).toFixed(4)).join(' ') + ')');
      strings.push('rgb(' + [0, 1, 2].map((k) => (parseInt(hex.slice(1 + 2 * k, 3 + 2 * k), 16) / 255 * 100).toFixed(2) + '%').join(' ') + ')');
    }
    const p = await K.open(CO);
    try {
      const chrome = await p.evaluate((list) => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d', { willReadFrequently: true }); return list.map((s) => { x.clearRect(0, 0, 1, 1); x.fillStyle = '#010203'; x.fillStyle = s; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3]]; }); }, strings);
      const bad = [];
      strings.forEach((s, i) => {
        const mine = rgbOf(s), ch = chrome[i];
        if (!mine) { bad.push('unread ' + s); return; }
        if (ch[0] === 1 && ch[1] === 2 && ch[2] === 3 && ch[3] === 255) { bad.push('Chrome refused ' + s); return; }
        if (mine.some((v, k) => Math.abs(v - ch[k]) > 1)) bad.push(s + ' → ' + mine + ' vs Chrome ' + ch.slice(0, 3));
      });
      const refused = K.gen(spec, { colour: 'bluish', bg: '#ffffff' });
      return [bad.length === 0 && !!refused.error && /tomato/.test(refused.error), strings.length + ' strings; ' + (bad.slice(0, 3).join(' | ') || 'all agree') + '; "bluish": ' + (refused.error || '').slice(0, 50)];
    } finally { await p.close(); }
  });
  claim(CO, 'point', 'Lab and LCH use CSS’s D50 white point. Fix contrast keeps the hue and changes only lightness, to the nearest colour that passes.',
    'the CSS Color 4 values for red, lime and blue; and 150 failing pairs get a passing colour of the same OKLCH hue, one small step from failing', N, async () => {
      const spec = T('dev-color-converter.js', 'color-converter');
      const line = (c, tag) => (K.gen(spec, { colour: c, bg: '#ffffff' }).output.split('\n').find((x) => x.indexOf(tag) === 0) || '').slice(6).trim();
      const want = [['#ff0000', 'LAB', 'lab(54.3% 80.8 69.9)'], ['#00ff00', 'LAB', 'lab(87.8% -79.3 81)'], ['#0000ff', 'LAB', 'lab(29.6% 68.3 -112)'], ['#ff0000', 'OKLCH', 'oklch(62.8% 0.2577 29.23)'], ['#00ff00', 'OKLCH', 'oklch(86.64% 0.2948 142.5)'], ['#0000ff', 'OKLCH', 'oklch(45.2% 0.3132 264.05)']];
      const wrong = want.filter((w) => line(w[0], w[1]) !== w[2]).map((w) => w[0] + ' ' + line(w[0], w[1]));
      /* the contrast ratio, written again here from the WCAG definition */
      const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const lum = (v) => 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
      const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const hx = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
      const oklch = (v) => { const l = [lin(v[0]), lin(v[1]), lin(v[2])]; const L = Math.cbrt(0.4122214708 * l[0] + 0.5363325363 * l[1] + 0.0514459929 * l[2]), M = Math.cbrt(0.2119034982 * l[0] + 0.6806995451 * l[1] + 0.1073969566 * l[2]), S = Math.cbrt(0.0883024619 * l[0] + 0.2817188376 * l[1] + 0.6299787005 * l[2]); const a = 1.9779984951 * L - 2.4285922050 * M + 0.4505937099 * S, b = 0.0259040371 * L + 0.7827717662 * M - 0.8086757660 * S; return [0.2104542553 * L + 0.7936177850 * M - 0.0040720468 * S, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360]; };
      let seed = 3; const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
      const badFix = []; let tested = 0;
      while (tested < 150) {
        const fg = '#' + [0, 0, 0].map(() => rnd(256).toString(16).padStart(2, '0')).join(''), bg = '#' + [0, 0, 0].map(() => rnd(256).toString(16).padStart(2, '0')).join('');
        if (ratio(hx(fg), hx(bg)) >= 4.5 || oklch(hx(fg))[1] < 0.04) continue;
        tested++;
        const out = K.gen(spec, { colour: fg, bg: bg }).output;
        const m = /To pass AA, body text \(4\.5:1\): (#[0-9a-f]{6}) \(([\d.]+):1\)/.exec(out);
        if (!m) { badFix.push(fg + ' on ' + bg + ': ' + (out.split('\n').find((x) => /AA, body/.test(x)) || 'no line')); continue; }
        const got = hx(m[1]);
        const o0 = oklch(hx(fg)), o1 = oklch(got);
        const dh = Math.min(Math.abs(o0[2] - o1[2]), 360 - Math.abs(o0[2] - o1[2]));
        if (ratio(got, hx(bg)) < 4.5 || (o1[1] > 0.06 && dh > 6)) badFix.push(fg + ' on ' + bg + ' → ' + m[1] + ' ratio ' + ratio(got, hx(bg)).toFixed(3) + ' hue off ' + dh.toFixed(1));
      }
      return [!wrong.length && !badFix.length, (wrong.join('; ') || 'six CSS Color 4 values match') + '; ' + (badFix.slice(0, 2).join(' | ') || tested + ' fixes pass, same hue')];
    });
  claim(CO, 'point', 'Tints and shades mix with white or black, harmonies turn the hue, and colour-blind views apply the Machado 2009 matrices.',
    'hand-worked: 20% tint of #ff0000, 40% shade of #808080, complement of #f7c948, protanopia of red from the matrix, achromatopsia from luminance', N, async () => {
      const spec = T('dev-color-converter.js', 'color-converter');
      const r = K.gen(spec, { colour: '#ff0000', bg: '#ffffff' }), g = K.gen(spec, { colour: '#808080', bg: '#ffffff' }), c = K.gen(spec, { colour: '#f7c948', bg: '#ffffff', harmony: 'complementary' });
      const hex = (v) => '#' + v.map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
      const tint = r.sets.tints.find((t) => t.label === '20% white').hex, shade = g.sets.shades.find((t) => t.label === '40% black').hex;
      /* complement by hand: hue 44 + 180 = 224, the same saturation and lightness */
      const hsl = (h, s, l) => { const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return [0, 8, 4].map((n) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); };
      const comp = hex(hsl(224, 0.92, 0.63));
      /* protanopia of pure red: the published matrix in linear light, then back to sRGB */
      const lin = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4), gam = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
      const pr = [0.152286, 0.114503, -0.003882].map((v) => Math.max(0, Math.min(1, v))).map(gam);
      const ach = g.sets.sim[3].hex;
      return [tint === '#ff3333' && shade === '#4d4d4d' && c.sets.harmony[1] === comp && r.sets.sim[0].hex === hex(pr) && ach === '#808080', [tint, shade, c.sets.harmony[1] + ' vs ' + comp, r.sets.sim[0].hex + ' vs ' + hex(pr), ach].join(' | ')];
    });
  claim(CO, 'tip', 'Type any CSS colour: #f7c948, #f7c94880, rgb(247 201 72 / 50%), hsl(45 92% 63%), hwb(), lab(), lch(), oklab(), oklch(), cmyk(), color(srgb …) or a name. A see-through colour is blended onto the background before its contrast is measured.',
    'a 50% white on black is judged as mid-grey (#808080 on black, 5.32:1), not as white (21:1)', N, async () => {
      const spec = T('dev-color-converter.js', 'color-converter');
      const half = K.gen(spec, { colour: 'rgb(255 255 255 / 50%)', bg: '#000000' }), solid = K.gen(spec, { colour: '#808080', bg: '#000000' }), full = K.gen(spec, { colour: '#ffffff', bg: '#000000' });
      return [K.stat(half, 'Contrast ratio') === K.stat(solid, 'Contrast ratio') && K.stat(full, 'Contrast ratio') === '21.00:1' && /HEXA  #FFFFFF80/.test(half.output) && /rgba\(255, 255, 255, 0\.5\)/.test(half.output) && /50%/.test(K.stat(half, 'Opacity') || ''), K.stat(half, 'Contrast ratio') + ' vs ' + K.stat(solid, 'Contrast ratio') + ' vs ' + K.stat(full, 'Contrast ratio')];
    });
  claim(CO, 'tip', 'Colour-blind views are an approximation of how the colour reads with one kind of cone missing; test anything important with real users.', 'the page lists four views and a click copies a swatch (Chrome)', B, async () => {
    const p = await K.open(CO);
    try {
      await p.evaluate(() => { Object.keys(localStorage).filter((k) => /color/.test(k)).forEach((k) => localStorage.removeItem(k)); });
      await p.reload({ waitUntil: 'load' });
      await K.sleep(500);
      const r = await p.evaluate(() => ({ groups: [...document.querySelectorAll('.cc-group .io-label')].map((x) => x.textContent), cells: document.querySelectorAll('.cc-group:last-child .cc-sw').length, caps: [...document.querySelectorAll('.cc-group:last-child .cc-cap')].map((x) => x.textContent) }));
      return [r.cells === 5 && /Protanopia/.test(r.caps.join()) && /Achromatopsia/.test(r.caps.join()) && r.groups.some((g) => /Tints/.test(g)) && r.groups.some((g) => /Harmony/.test(g)), JSON.stringify(r)];
    } finally { await p.close(); }
  });
  claim(CO, 'tip', 'Where your browser has an eyedropper (Chrome and Edge), Pick from the screen reads a colour anywhere on your screen.', 'with a stand-in EyeDropper that answers #336699: the field takes it (the real screen picker needs a person)', B, async () => {
    const p = await K.open(CO);
    try {
      await p.evaluateOnNewDocument(() => { window.EyeDropper = class { open() { return Promise.resolve({ sRGBHex: '#336699' }); } }; });
      await p.reload({ waitUntil: 'load' });
      await K.sleep(500);
      await K.clickText(p, '.tool-io button', /Pick from the screen/);
      await K.sleep(600);
      const v = await p.evaluate(() => ({ field: document.getElementById('f-colour').value, hex: document.querySelector('.code-out').textContent.split('\n')[0] }));
      return [v.field === '#336699' && /#336699/i.test(v.hex), JSON.stringify(v)];
    } finally { await p.close(); }
  });
  manual(CO, 'tip', 'Where your browser has an eyedropper (Chrome and Edge), Pick from the screen reads a colour anywhere on your screen.', 'The real EyeDropper needs a person at a screen; the page was tested with a stand-in that returns #336699. The Machado matrix values are the published ones, copied by hand; the claim above checks how they are applied.');

  /* ================================================================ */
  const CR = '/developer/cron-parser/';
  const cron = (s) => out(K.tx(T('dev2-cron-parser.js', 'cron-parser'), s, { count: '10' }));
  claim(CR, 'tip', 'When both day-of-month and day-of-week are restricted, cron runs on either — not both.', '"0 0 1 * 1" lists Mondays and the 1st', N, async () => {
    const o = cron('0 0 1 * 1'); const runs = o.split('\n').filter((l) => /^\s+\w{3}, \d\d/.test(l)).map((l) => l.trim());
    const mon = runs.filter((r) => /^Mon/.test(r)).length, first = runs.filter((r) => /, 01 /.test(r)).length;
    return [mon > 0 && first > 0, runs.join('; ')];
  });
  claim(CR, 'tip', 'Day of week accepts 0 or 7 for Sunday, and three-letter names such as mon and fri.', '7 = 0; mon and fri read', N, async () => {
    const a = cron('0 9 * * 7').split('\n')[1], b = cron('0 9 * * 0').split('\n')[1], c = cron('0 9 * * mon,fri').split('\n')[1];
    return [a === b && /Monday/.test(c) && /Friday/.test(c), [a, c].join(' | ')];
  });
  claim(CR, 'tip', 'Shortcuts @daily, @hourly, @weekly, @monthly and @yearly are supported', 'each shortcut parses', N, async () => {
    const bad = ['@daily', '@hourly', '@weekly', '@monthly', '@yearly'].filter((s) => /✗/.test(cron(s)));
    return [!bad.length, bad.join(',') || 'all parse'];
  });
  claim(CR, 'point', '*/20 in the minute field is 0, 20 and 40.', 'description of */20', N, async () => {
    const d = cron('*/20 * * * *').split('\n')[1]; return [/minute 0, (minute )?20(,)? and (minute )?40\b/.test(d), d];
  });
  claim(CR, 'point', '@reboot is refused.', '@reboot gives an error', N, async () => { const o = cron('@reboot'); return [/✗/.test(o), o.split('\n')[1]]; });
  claim(CR, 'mistake', 'Steps restart each hour, so the parser says "At minute 0 and minute 45 of every hour".', '*/45', N, async () => {
    const d = cron('*/45 * * * *').split('\n')[1]; return [/At minute 0 and minute 45 of every hour/.test(d), d];
  });
  claim(CR, 'mistake', 'The line * 9 * * * reads "Every minute during 09:00"', '* 9 * * *', N, async () => {
    const d = cron('* 9 * * *').split('\n')[1]; return [/Every minute during 09:00/.test(d), d];
  });
  claim(CR, 'dfaq', 'Midnight every Sunday, read here as "At 00:00, on Sunday." It is the same schedule as @weekly.', '0 0 * * 0 and @weekly', N, async () => {
    const a = cron('0 0 * * 0').split('\n').slice(1).join('\n'), b = cron('@weekly').split('\n').slice(1).join('\n');
    return [/At 00:00, on Sunday\./.test(a) && a === b, a.split('\n')[0]];
  });
  claim(CR, 'faq', '*/5 in hours means 0, 5, 10, 15 and 20', 'next runs of 0 */5 * * *', N, async () => {
    const hrs = cron('0 */5 * * *').split('\n').filter((l) => /\d\d:\d\d$/.test(l)).map((l) => l.trim().slice(-5, -3));
    return [hrs.every((h) => ['00', '05', '10', '15', '20'].indexOf(h) >= 0) && hrs.length >= 5, hrs.join(',')];
  });
  claim(CR, 'point', 'Weekday 7 is Sunday, like 0: 1-7 reads every day, 5-7 on Friday, Saturday and Sunday.', '1-7 and 5-7', N, async () => {
    const a = cron('0 9 * * 1-7').split('\n')[1], b = cron('0 9 * * 5-7').split('\n')[1];
    return [/every day/i.test(a) && /Friday/.test(b) && /Saturday/.test(b) && /Sunday/.test(b), a + ' | ' + b];
  });
  claim(CR, 'dfaq', 'Use */5 * * * *. It fires on the clock at minute 0, 5, 10 and so on through minute 55.', 'the minutes listed are multiples of 5', N, async () => {
    const m = cron('*/5 * * * *').split('\n').filter((l) => /\d\d:\d\d$/.test(l)).map((l) => Number(l.trim().slice(-2)));
    return [m.length >= 5 && m.every((x) => x % 5 === 0), m.join(',')];
  });

  claim(CR, 'point', 'Six fields put seconds first; seven (Quartz) add a year. Quartz needs a ? in one day field and reads L, W and #.',
    '6 fields read seconds first, 7 add a year; Quartz refuses both day fields set and reads L, 15W and 6#1', N, async () => {
      const spec = T('dev2-cron-parser.js', 'cron-parser');
      const run = (s, o) => K.tx(spec, s, Object.assign({ count: '3' }, o || {}));
      const six = out(run('30 15 9 * * *')), seven = out(run('0 0 9 ? * 2 2030'));
      const both = out(run('0 0 9 1 * 2', { format: 'quartz' })), lw = out(run('0 0 12 L * ?\n0 0 12 15W * ?\n0 0 9 ? * 6#1'));
      return [/At 09:15:30/.test(six) && /9:15:30$|:30$/.test(six.split('\n')[2]) && /in the year 2030/.test(seven) && /30 Dec 2030|Mon, 07 Jan 2030|2030/.test(seven.split('\n')[2]) && /cannot restrict both/.test(both) && (lw.match(/✗/g) || []).length === 0, six.split('\n')[1] + ' | ' + seven.split('\n')[1] + ' | ' + both.split('\n')[1]];
    });
  claim(CR, 'point', 'Next runs come from the calendar in the chosen time zone, through Intl. Both day fields restricted means either may match.',
    '09:00 in Asia/Kolkata is 03:30 UTC; New York and London differ by the clock changes; 0 0 1 * 1 lists Mondays and the 1st', N, async () => {
      const spec = T('dev2-cron-parser.js', 'cron-parser');
      const first = (tz) => out(K.tx(spec, '0 9 * * *', { count: '3', tz: tz, offset: 'show' })).split('\n')[2].trim();
      const k = first('Asia/Kolkata'), u = first('UTC'), n = first('America/New_York');
      const kUtc = /09:00 UTC\+05:30$/.test(k), uUtc = /09:00 UTC\+00:00$/.test(u), nOff = /09:00 UTC−0[45]:00$/.test(n);
      const both = out(K.tx(spec, '0 0 1 * 1', { count: '10', tz: 'UTC' })).split('\n').filter((l) => /^ {5}\w{3}, /.test(l));
      return [kUtc && uUtc && nOff && both.some((l) => /^ {5}Mon/.test(l)) && both.some((l) => /, 01 /.test(l)), [k, u, n].join(' | ')];
    });
  claim(CR, 'point', 'A time the clocks skip is not shown; one they repeat is shown once.', 'London, 25 and 29 October/March: 01:30 daily skips the missing night and lists the doubled night once', N, async () => {
    const fixed = (ms) => { class D extends Date { static now() { return ms; } } return K.tool('dev2-cron-parser.js', 'cron-parser', { Date: D }); };
    const runs = (ms, tz) => out(K.tx(fixed(ms), '30 1 * * *', { count: '3', tz: tz })).split('\n').filter((l) => /^ {5}\w{3}, /.test(l)).map((l) => l.trim());
    const skip = runs(Date.UTC(2026, 2, 28, 12), 'Europe/London'), twice = runs(Date.UTC(2026, 9, 24, 12), 'Europe/London');
    return [skip.length === 3 && !skip.some((l) => /29 Mar/.test(l)) && twice.filter((l) => /25 Oct/.test(l)).length === 1, skip.join(' | ') + ' || ' + twice.join(' | ')];
  });
  claim(CR, 'tip', 'Click into a field and the line below the box explains that field and what it allows.', 'Chrome: the caret in the 2nd field highlights it and says "9, 17"; a preset fills the box; the builder edits the line', B, async () => {
    const p = await K.open(CR);
    try {
      await p.evaluate(() => { Object.keys(localStorage).filter((k) => /cron/.test(k)).forEach((k) => localStorage.removeItem(k)); });
      await p.reload({ waitUntil: 'load' });
      await p.evaluate(() => { const a = document.querySelector('textarea.code-area'); a.value = '*/15 9,17 * * 1-5'; a.dispatchEvent(new Event('input', { bubbles: true })); a.focus(); a.setSelectionRange(8, 8); a.dispatchEvent(new Event('click', { bubbles: true })); });
      await K.sleep(700);
      const on = await p.evaluate(() => { const b = document.querySelector('.cron-hf.is-on'); return b ? { name: b.querySelector('.cron-hf-name').textContent, tok: b.querySelector('.cron-hf-tok').textContent, mean: b.querySelector('.cron-hf-mean').textContent } : null; });
      await p.evaluate(() => { const s = document.getElementById('cron-preset'); s.value = String([...s.options].findIndex((o) => /Weekdays at 9:00/.test(o.textContent)) - 1); s.dispatchEvent(new Event('change', { bubbles: true })); });
      await K.sleep(500);
      const preset = await p.evaluate(() => document.querySelector('textarea.code-area').value);
      await p.evaluate(() => { const i = document.getElementById('cron-f-min'); i.value = '30'; i.dispatchEvent(new Event('input', { bubbles: true })); });
      await K.sleep(500);
      const built = await p.evaluate(() => ({ text: document.querySelector('textarea.code-area').value, out: document.querySelector('.code-out').textContent.split('\n')[1] }));
      return [on && on.name === 'hour' && on.tok === '9,17' && /^9 and 17$/.test(on.mean) && preset === '0 9 * * 1-5' && built.text === '30 9 * * 1-5' && /At 09:30/.test(built.out), K.j(on) + ' | ' + preset + ' | ' + built.text + ' → ' + built.out];
    } finally { await p.close(); }
  });
  /* ================================================================ */
  const GR = '/developer/css-gradient/';
  const grad = (f) => K.gen(T('dev-css-gradient.js', 'css-gradient'), f);
  /* Chrome's own rendering of a CSS background, as RGBA bytes: a fixed box screenshotted, decoded on a canvas in the page */
  const chromePixels = async (p, css, w, h) => {
    await p.evaluate((css, w, h) => {
      let b = document.getElementById('__cgref');
      if (!b) { b = document.createElement('div'); b.id = '__cgref'; document.body.appendChild(b); }
      b.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;width:' + w + 'px;height:' + h + 'px;background:' + css;
    }, css, w, h);
    const shot = await p.screenshot({ clip: { x: 0, y: 0, width: w, height: h }, encoding: 'base64' });
    return p.evaluate(async (b64, w, h) => {
      document.getElementById('__cgref').remove();
      const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      return Array.from(g.getImageData(0, 0, w, h).data);
    }, shot, w, h);
  };
  const pngPixels = (p, bytes) => p.evaluate(async (arr) => {
    const img = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, px: Array.from(g.getImageData(0, 0, img.width, img.height).data) };
  }, Array.from(bytes));
  const diff = (a, b) => { let sum = 0, max = 0, n = 0; for (let i = 0; i < a.length; i++) { if (i % 4 === 3) continue; const d = Math.abs(a[i] - b[i]); sum += d; n++; if (d > max) max = d; } return { mean: sum / n, max }; };
  /* set the form and run, as a visitor would */
  const setForm = (p, vals) => p.evaluate((vals) => {
    Object.keys(vals).forEach((k) => { const i = document.getElementById('f-' + k); if (i.type === 'checkbox') i.checked = vals[k] === 'yes'; else i.value = vals[k]; });
    document.getElementById('f-stops').dispatchEvent(new Event('input', { bubbles: true }));
  }, vals);
  const out1 = (p) => p.$eval('.code-out', (o) => o.textContent);
  /* the shell remembers settings in this browser; every check starts from the defaults */
  const openGR = async () => { const p = await K.open(GR); await p.evaluate(() => localStorage.removeItem('1234tools-dev:css-gradient')); await p.reload({ waitUntil: 'load' }); await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); }); await p.waitForSelector('.cg-handle'); return p; };

  claim(GR, 'point', 'A missing position is filled in as CSS does: the first is 0%, the last 100%, gaps are shared evenly, and a position below an earlier one is raised to it.',
    'five stops, two placed, one placed too low', N, async () => {
      const a = grad({ stops: '#111111, #222222, #333333 80%, #444444, #555555 40%' }).preview;
      /* by hand: 0 first; 40 halfway between 0 and 80; the 40 after 80 is raised to 80; the one between them is 80 */
      return [a === 'linear-gradient(120deg, #111111 0%, #222222 40%, #333333 80%, #444444 80%, #555555 80%)', a];
    });
  claim(GR, 'point', 'Linear uses the angle as its direction, linear-gradient(120deg, …); conic uses it as the start of the sweep.', 'linear and conic at 120', N, async () => {
    const a = grad({ type: 'linear', angle: 120 }).preview, b = grad({ type: 'conic', angle: 120 }).preview;
    return [/^linear-gradient\(120deg, /.test(a) && /^conic-gradient\(from 120deg at 50% 50%, /.test(b), a + ' | ' + b];
  });
  claim(GR, 'point', 'Radial and conic take a centre, dragged on the preview or typed as two percentages: radial-gradient(ellipse at 30% 40%, …).',
    'typed: ellipse at 30% 40%; dragged: the handle to a quarter across and three quarters down', B, async () => {
      const typed = grad({ type: 'radial', shape: 'ellipse', cx: '30', cy: '40' }).preview;
      const p = await openGR();
      try {
        await p.select('#f-type', 'radial');
        await p.$eval('#f-type', (s) => s.dispatchEvent(new Event('change', { bubbles: true })));
        await p.waitForSelector('.cg-centre:not([hidden])');
        await p.$eval('.gradient-preview', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const h = await (await p.$('.cg-centre')).boundingBox(), r = await (await p.$('.gradient-preview')).boundingBox();
        await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
        await p.mouse.down();
        await p.mouse.move(r.x + r.width * 0.25, r.y + r.height * 0.75, { steps: 6 });
        await p.mouse.up();
        await K.sleep(200);
        const o = await out1(p);
        return [/^radial-gradient\(ellipse at 30% 40%, /.test(typed) && /radial-gradient\(circle at 25% 75%, /.test(o), typed.slice(0, 40) + ' | dragged: ' + (o.match(/radial-gradient\([^,]*/) || [''])[0]];
      } finally { await p.close(); }
    });
  claim(GR, 'point', 'OKLab or OKLCH blending adds in oklab or in oklch to the value, and the solid fallback line, the colour halfway along, comes first for browsers that cannot read it.',
    'blue to yellow: the fallback hex is the middle pixel Chrome paints, in sRGB, OKLab and OKLCH', B, async () => {
      const p = await openGR();
      const got = [];
      let ok = true;
      try {
        for (const space of ['srgb', 'oklab', 'oklch']) {
          const r = grad({ type: 'linear', angle: '90', stops: '#0000ff, #ffff00', space });
          const lines = r.output.split('\n');
          const fb = (/^background: (#[0-9a-f]{6});$/.exec(lines[0]) || [])[1];
          const value = lines[1].replace(/^background: /, '').replace(/;$/, '');
          const px = await chromePixels(p, value, 201, 4);
          const mid = px.slice(100 * 4, 100 * 4 + 3);
          const fbRgb = fb ? [1, 3, 5].map((i) => parseInt(fb.slice(i, i + 2), 16)) : [NaN, NaN, NaN];
          const close = fbRgb.every((v, i) => Math.abs(v - mid[i]) <= 3);
          const inText = space === 'srgb' ? !/ in o/.test(value) : value.indexOf('90deg in ' + space + ',') > 0;
          if (!close || !inText || lines.length !== 2) ok = false;
          got.push(space + ': fallback ' + fb + ', Chrome middle rgb(' + mid.join(',') + ')');
        }
        return [ok, got.join(' | ')];
      } finally { await p.close(); }
    });
  claim(GR, 'point', 'The PNG is painted pixel by pixel with the same geometry and blend, a slice of rows at a time.',
    'linear 120deg, radial ellipse off centre, conic in OKLCH: the saved 1200 × 630 PNG against Chrome painting the same CSS', B, async () => {
      const p = await openGR();
      const got = [];
      let ok = true;
      try {
        await p.select('#cg-png-size', '0');
        for (const vals of [
          { type: 'linear', angle: '120', stops: '#ffe29a 0%, #f7c948 50%, #ff9d2e 100%', space: 'srgb' },
          { type: 'radial', shape: 'ellipse', cx: '30', cy: '40', stops: '#1d3557, #e63946 60%, #f1faee', space: 'oklab' },
          { type: 'conic', angle: '45', cx: '60', cy: '50', stops: '#0000ff, #ffff00, #0000ff', space: 'oklch' }
        ]) {
          await setForm(p, vals);
          await K.sleep(100);
          await K.clearDownloads(p);
          await K.clickText(p, '.cg-png-btn', /Download PNG/);
          await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
          const [dl] = await K.downloads(p);
          const css = (await out1(p)).split('\n').pop().replace(/^background: /, '').replace(/;$/, '');
          const mine = await pngPixels(p, dl.bytes), ref = await chromePixels(p, css, 1200, 630);
          const d = diff(mine.px, ref);
          if (dl.name !== 'gradient-1200x630.png' || dl.type !== 'image/png' || mine.w !== 1200 || mine.h !== 630 || d.mean > 1.5) ok = false;
          got.push(vals.type + ' ' + dl.name + ' mean ' + d.mean.toFixed(2) + ' max ' + d.max);
        }
        return [ok, got.join(' | ')];
      } finally { await p.close(); }
    });
  claim(GR, 'dfaq', 'To within a couple of levels per colour channel, because it uses the same angle, centre, stops and blend.',
    'the 64 × 64 swatch: mean difference from Chrome under 2 levels', B, async () => {
      const p = await openGR();
      try {
        await p.select('#cg-png-size', '4');
        await setForm(p, { type: 'linear', angle: '200', stops: '#8e2de2, #ff4e8a', space: 'oklab' });
        await K.sleep(100);
        await K.clearDownloads(p);
        await K.clickText(p, '.cg-png-btn', /Download PNG/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [dl] = await K.downloads(p);
        const css = (await out1(p)).split('\n').pop().replace(/^background: /, '').replace(/;$/, '');
        const mine = await pngPixels(p, dl.bytes), ref = await chromePixels(p, css, 64, 64);
        const d = diff(mine.px, ref);
        return [mine.w === 64 && d.mean < 2, dl.name + ': mean ' + d.mean.toFixed(2) + ', max ' + d.max];
      } finally { await p.close(); }
    });
  claim(GR, 'tip', 'Drag a stop along the bar, or focus it and use the arrow keys (Shift for steps of 10%); click the bar to add a stop there, and Delete removes the focused one.',
    'drag stop 2 to 70%; Shift+Right on it; click the bar at 25%; Delete', B, async () => {
      const p = await openGR();
      const stopsNow = () => p.$eval('#f-stops', (i) => i.value);
      try {
        const bar = await (await p.$('.cg-bar')).boundingBox();
        const h2 = await (await p.$$('.cg-handle'))[1].boundingBox();
        await p.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
        await p.mouse.down();
        await p.mouse.move(bar.x + bar.width * 0.7, h2.y + h2.height / 2, { steps: 8 });
        await p.mouse.up();
        const a = await stopsNow();
        await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
        const b = await stopsNow();
        await p.mouse.click(bar.x + bar.width * 0.25, bar.y + bar.height / 2);
        const c = await stopsNow();
        await p.keyboard.press('Delete');
        const d = await stopsNow();
        const ok = a === '#ffe29a 0%, #f7c948 70%, #ff9d2e 100%' && b === '#ffe29a 0%, #f7c948 80%, #ff9d2e 100%'
          && c.split(', ').length === 4 && / 25%/.test(c) && d === b;
        return [ok, [a, b, c, d].join(' → ')];
      } finally { await p.close(); }
    });
  claim(GR, 'tip', 'Two stops at the same position make a hard edge, as in #e63946 25%, #e9ecef 25%; the Pie 25% preset draws a quarter segment that way.',
    'the stats count the hard edge; the preset puts red on 0–25% only', B, async () => {
      const r = grad({ type: 'conic', stops: '#e63946 25%, #e9ecef 25%' });
      const p = await openGR();
      try {
        await K.clickText(p, '.cg-preset', /Pie 25%/);
        await K.sleep(150);
        const o = await out1(p);
        const css = o.split('\n').pop().replace(/^background: /, '').replace(/;$/, '');
        const px = await chromePixels(p, css, 100, 100);
        const at = (x, y) => px.slice((y * 100 + x) * 4, (y * 100 + x) * 4 + 3);
        /* conic from 0deg: up-right quarter is the first 25% (red), the rest grey */
        const q1 = at(75, 25), q2 = at(75, 75), q4 = at(25, 25);
        const red = (c) => c[0] > 200 && c[1] < 90, grey = (c) => c[0] > 220 && c[1] > 220;
        return [K.stat(r, 'Hard edges') === '1' && /#e63946 25%, #e9ecef 25%/.test(o) && red(q1) && grey(q2) && grey(q4),
          'hard edges ' + K.stat(r, 'Hard edges') + '; preset ' + css.slice(0, 80) + '; quarters ' + [q1, q2, q4].map((c) => c.join(',')).join(' / ')];
      } finally { await p.close(); }
    });
  claim(GR, 'tip', 'Between complementary colours the classic sRGB blend dips through grey. Switch Blend colours in to OKLab and the middle stays clean.',
    'blue to yellow: HSL saturation of the halfway colour, sRGB vs OKLab', N, async () => {
      const sat = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); };
      const a = grad({ stops: '#0000ff, #ffff00' }).fallback, b = grad({ stops: '#0000ff, #ffff00', space: 'oklab' }).fallback;
      return [a === '#808080' && sat(a) === 0 && sat(b) > 0.4, a + ' saturation ' + sat(a).toFixed(2) + ' | ' + b + ' saturation ' + sat(b).toFixed(2)];
    });
  claim(GR, 'tip', 'The fallback line paints a solid colour, the gradient\'s midpoint, in any browser that cannot read the gradient after it.',
    'two declarations: the solid colour, then the gradient; the solid one is the colour at 50%', N, async () => {
      const r = grad({ stops: '#000000, #ffffff 50%, #ff0000' });
      const lines = r.output.split('\n');
      return [lines.length === 2 && lines[0] === 'background: #ffffff;' && /^background: linear-gradient\(/.test(lines[1]), lines.join(' / ')];
    });
  claim(GR, 'faq', 'Copy for Tailwind gives two arbitrary-value classes, such as bg-[#f7c948] bg-[linear-gradient(120deg,#ffe29a_0%,#f7c948_50%,#ff9d2e_100%)].',
    'the default Tailwind classes; underscores back to spaces give the CSS value; the button copies them', B, async () => {
      const r = grad({});
      const back = r.tailwind.split(' ')[1].slice(4, -1).replace(/_/g, ' ').replace(/,/g, ', ');
      const p = await openGR();
      try {
        await p.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
        await K.clickText(p, '.cg-tw-btn', /Tailwind/);
        await K.sleep(100);
        const copied = await p.evaluate(() => window.__copied);
        return [r.tailwind === 'bg-[#f7c948] bg-[linear-gradient(120deg,#ffe29a_0%,#f7c948_50%,#ff9d2e_100%)]' && back === r.preview && copied === r.tailwind, copied + ' | back: ' + back];
      } finally { await p.close(); }
    });
  claim(GR, 'dfaq', 'type it into the stop list, or drag one marker onto the other.', 'Ocean preset: stop 3 dragged onto stop 2 makes a hard edge', B, async () => {
    const p = await openGR();
    try {
      const bar = await (await p.$('.cg-bar')).boundingBox();
      await setForm(p, { stops: '#ff6b6b 0%, #4ecdc4 50%, #1d3557 100%' });
      await K.sleep(150);
      const h3 = await (await p.$$('.cg-handle'))[2].boundingBox();
      await p.mouse.move(h3.x + h3.width / 2, h3.y + h3.height / 2);
      await p.mouse.down();
      await p.mouse.move(bar.x + bar.width * 0.5, h3.y + h3.height / 2, { steps: 8 });
      await p.mouse.up();
      await K.sleep(150);
      const st = await p.$$eval('.stat-row', (rows) => rows.map((r) => r.textContent));
      const hard = st.find((s) => /Hard edges/.test(s)) || '';
      return [/Hard edges\s*1/.test(hard), (await p.$eval('#f-stops', (i) => i.value)) + ' | ' + hard];
    } finally { await p.close(); }
  });

  /* ================================================================ */
  const CJ = '/developer/csv-to-json/';
  const csv = () => T('dev-csv-to-json.js', 'csv-to-json');
  claim(CJ, 'tip', 'Fields containing the delimiter, a quote or a line break are wrapped in double quotes, and inner quotes are doubled', 'JSON → CSV quoting', N, async () => {
    const r = out(K.tx(csv(), JSON.stringify([{ a: 'x,y', b: 'say "hi"', c: 'l1\nl2', d: 'plain' }]), { dir: 'j2c' }));
    return [r === 'a,b,c,d\n"x,y","say ""hi""","l1\nl2",plain', K.j(r)];
  });
  claim(CJ, 'tip', 'Going JSON → CSV, the column set is the union of every object\'s keys, so rows with missing fields still line up.', 'union of keys', N, async () => {
    const r = out(K.tx(csv(), JSON.stringify([{ a: 1 }, { b: 2 }]), { dir: 'j2c' })); return [r === 'a,b\n1,\n,2', K.j(r)];
  });
  claim(CJ, 'faq', 'Only with Infer types on. CSV has no types, so by default every value stays a string.', '1 and true stay strings by default', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'n,b\n1,true'))); return [j[0].n === '1' && j[0].b === 'true', K.j(j)];
  });
  claim(CJ, 'faq', 'Infer types turns numbers written as JSON writes them into numbers, true and false into booleans and null into null; 007, 1,000, +5 and whole numbers past 9007199254740991 stay text, so no digit is lost. Empty cells stay empty strings.',
    'each case, written out by hand', N, async () => {
      const cells = ['12', '-3.5', '1e3', 'TRUE', 'false', 'null', '007', '"1,000"', '+5', '9007199254740993', '9007199254740991'];
      const j = JSON.parse(out(K.tx(csv(), 'v\n' + cells.join('\n') + '\n', { types: 'on' })));
      const got = j.map((o) => o.v);
      // a blank line is skipped as a row, so the empty cell is checked beside a filled one
      const e = JSON.parse(out(K.tx(csv(), 'a,b\n1,', { types: 'on' })))[0].b;
      const want = [12, -3.5, 1000, true, false, null, '007', '1,000', '+5', '9007199254740993', 9007199254740991];
      return [JSON.stringify(got) === JSON.stringify(want) && e === '', K.j(got) + ' empty=' + K.j(e)];
    });
  claim(CJ, 'point', 'Quotes are tracked, so a quoted comma or line break stays in its field and "" becomes one quote.', 'quoted comma, newline and ""', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'a,b\n"x,y","l1\nl2 ""q"""'))); return [j[0].a === 'x,y' && j[0].b === 'l1\nl2 "q"', K.j(j)];
  });
  claim(CJ, 'point', 'The first row is the header unless set otherwise; values stay strings unless Infer types is on, and short rows are padded with empty strings.', 'short row padded; header No', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'a,b,c\n1'))); const h = JSON.parse(out(K.tx(csv(), 'a,b\n1,2', { header: 'no' })));
    return [j[0].b === '' && j[0].c === '' && K.j(h) === '[{"column1":"a","column2":"b"},{"column1":"1","column2":"2"}]', K.j(j) + ' | ' + K.j(h)];
  });
  claim(CJ, 'point', 'JSON to CSV uses the union of every object\'s keys as columns, nested objects as dotted names', 'a.b.c', N, async () => {
    const r = out(K.tx(csv(), JSON.stringify([{ a: { b: { c: 1 } }, d: 2 }]), { dir: 'j2c' })); return [r === 'a.b.c,d\n1,2', K.j(r)];
  });
  claim(CJ, 'tip', 'Detect, the default, counts commas, semicolons, tabs and pipes outside quotes in the first 20 lines and names its choice in the Delimiter row', 'four files, one per delimiter, each with a quoted comma', N, async () => {
    const files = { Comma: 'a,b\n"x,y",2', Semicolon: 'a;b\n"x,y";2', Tab: 'a\tb\n"x,y"\t2', Pipe: 'a|b\n"x,y"|2' };
    const seen = Object.keys(files).map((k) => { const r = K.tx(csv(), files[k]); const j = JSON.parse(r.output); return k + ':' + (K.stat(r, 'Delimiter') === k + ' (detected)' && j[0].a === 'x,y' && j[0].b === '2'); });
    return [seen.every((x) => /true$/.test(x)), seen.join(' ')];
  });
  claim(CJ, 'tip', 'Nested objects become dotted columns such as addr.city, and arrays are written as JSON text.', 'nested object and array', N, async () => {
    const r = out(K.tx(csv(), JSON.stringify([{ addr: { city: 'York' }, tags: ['a', 'b'] }]), { dir: 'j2c' })); return [r === 'addr.city,tags\nYork,"[""a"",""b""]"', K.j(r)];
  });
  claim(CJ, 'tip', 'Nest a.b into objects turns dotted columns back into nested objects, and a cell holding JSON such as ["a","b"] back into an array.', 'the CSV above, back', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'addr.city,tags\nYork,"[""a"",""b""]"', { nest: 'nest' }))); return [K.j(j) === '[{"addr":{"city":"York"},"tags":["a","b"]}]', K.j(j)];
  });
  claim(CJ, 'dfaq', 'The extra fields are dropped, because only header columns become keys, and a warning counts those rows.', 'a long row loses its extras', N, async () => {
    const r = K.tx(csv(), 'a\n1,2,3'); const j = JSON.parse(out(r)); return [K.j(j) === '[{"a":"1"}]' && /1 row has more fields than the 1 column/.test(r.warn || ''), K.j(j) + ' ' + (r.warn || '')];
  });
  claim(CJ, 'point', 'JSON Lines writes one compact object a line. JSON to CSV can quote every field or only text, end lines with CRLF and add a byte order mark.',
    'JSON Lines, Every field, CRLF and the BOM, on the page: the downloaded file is exactly those bytes', B, async () => {
      const p = await K.open(CJ);
      try {
        await p.evaluate(() => { Object.keys(localStorage).filter((k) => /csv/.test(k)).forEach((k) => localStorage.removeItem(k)); });
        const setAndType = async (opts, text) => {
          await p.evaluate((o, t) => { for (const k of Object.keys(o)) { const s = document.getElementById('f-' + k); s.value = o[k]; s.dispatchEvent(new Event('change', { bubbles: true })); } const a = document.querySelector('textarea.code-area'); a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); }, opts, text);
          await K.sleep(700);
        };
        await setAndType({ fmt: 'lines' }, 'id,name\n1,Ann\n2,"Bo, Jr."');
        await K.clearDownloads(p); await K.clickText(p, '.tool-io button', /^Download$/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [d1] = await K.downloads(p);
        const jl = d1.bytes.toString('utf8') === '{"id":"1","name":"Ann"}\n{"id":"2","name":"Bo, Jr."}' && /\.jsonl$/.test(d1.name);
        await setAndType({ dir: 'j2c', quote: 'all', eol: 'crlf', bom: 'yes' }, '[{"a":"é","b":2},{"a":"x","b":3}]');
        await K.clearDownloads(p); await K.clickText(p, '.tool-io button', /^Download$/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [d2] = await K.downloads(p);
        const csv = d2.bytes.equals(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('"a","b"\r\n"é","2"\r\n"x","3"', 'utf8')])) && /\.csv$/.test(d2.name);
        return [jl && csv, d1.name + ' ' + K.j(d1.bytes.toString('utf8').slice(0, 30)) + ' | ' + d2.name + ' ' + d2.bytes.length + ' bytes, BOM + quoted + CRLF: ' + csv];
      } finally { await p.close(); }
    });
  claim(CJ, 'mistake', 'Double-clicking a UTF-8 CSV in Excel, which can garble accents. Add the byte order mark instead.', 'the page adds EF BB BF only when asked', N, async () => {
    const a = K.tx(csv(), '[{"a":"é"}]', { dir: 'j2c' }), b = K.tx(csv(), '[{"a":"é"}]', { dir: 'j2c', bom: 'yes' });
    return [!a.bytes && b.bytes && b.bytes[0] === 0xef && b.bytes[1] === 0xbb && b.bytes[2] === 0xbf, 'default: no bytes override; with BOM: ' + (b.bytes ? Array.from(b.bytes.slice(0, 3)).map((x) => x.toString(16)).join(' ') : 'none')];
  });
  claim(CJ, 'tip', 'A table below the output previews the first 100 rows.', 'a 150-row CSV shows 100 table rows and says so', B, async () => {
    const p = await K.open(CJ);
    try {
      await p.evaluate(() => { Object.keys(localStorage).filter((k) => /csv/.test(k)).forEach((k) => localStorage.removeItem(k)); }); await p.reload({ waitUntil: 'load' });
      const csv = 'n,sq\n' + Array.from({ length: 150 }, (x, i) => (i + 1) + ',' + (i + 1) * (i + 1)).join('\n');
      await p.evaluate((t) => { const a = document.querySelector('textarea.code-area'); a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); }, csv);
      await K.sleep(900);
      const r = await p.evaluate(() => ({ rows: document.querySelectorAll('.csv-grid tr').length - 1, count: document.querySelector('.csv-count').textContent, last: [...document.querySelectorAll('.csv-grid tr:last-child td')].map((x) => x.textContent).join(',') }));
      return [r.rows === 100 && /First 100 of 150 rows/.test(r.count) && r.last === '100,100,10000', K.j(r)];
    } finally { await p.close(); }
  });
  claim(CJ, 'point', 'The array is written with JSON.stringify at a 2-space indent; Output measures it without.', 'Output counts the unindented bytes', N, async () => {
    const r = K.tx(csv(), 'a,b\n1,2'); const flat = JSON.stringify(JSON.parse(r.output));
    return [/^\[\n  \{\n    "a"/.test(r.output) && K.stat(r, 'Output') === Buffer.byteLength(flat) + ' B', K.stat(r, 'Output') + ' vs ' + Buffer.byteLength(flat) + ' B unindented, ' + Buffer.byteLength(r.output) + ' B as shown'];
  });
  claim(CJ, 'mistake', 'An addr object becomes an addr.city column and returns flat, "addr.city": "York", unless Dotted headers is set to Nest.', 'there and back, flat and nested', N, async () => {
    const c = out(K.tx(csv(), JSON.stringify([{ addr: { city: 'York' } }]), { dir: 'j2c' }));
    const flat = JSON.parse(out(K.tx(csv(), c))), nest = JSON.parse(out(K.tx(csv(), c, { nest: 'nest' })));
    return [c === 'addr.city\nYork' && K.j(flat) === '[{"addr.city":"York"}]' && K.j(nest) === '[{"addr":{"city":"York"}}]', K.j([c, flat, nest])];
  });
  claim(CJ, 'dfaq', 'they become JSON keys exactly as written, such as "Unit price"', 'a header with a space', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'Unit price\n5'))); return [j[0]['Unit price'] === '5', K.j(j)];
  });
  claim(CJ, 'dfaq', 'Pick Tab in the delimiter list to read or write TSV.', 'tab-delimited input', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'a\tb\n1\t2', { delim: '\t' }))); return [j[0].b === '2', K.j(j)];
  });

  /* ================================================================ */
  const HG = '/developer/hash-generator/';
  const hash = (s, o) => K.tx(T('dev2-hash-generator.js', 'hash-generator'), s, o);
  const nodeHash = (alg, data, key) => (key !== undefined ? require('crypto').createHmac(alg, key) : require('crypto').createHash(alg)).update(data).digest('hex');
  const line = (r, name) => { const m = new RegExp('^' + name.replace(/[-/]/g, '\\$&') + '\\s+(\\S+)$', 'm').exec((r && r.output) || ''); return m ? m[1] : null; };
  /* the engine's 13 against Node's crypto (OpenSSL) and the Keccak-256 vector for abc */
  const HG_ALGS = [['SHA-256', 'sha256'], ['SHA-1', 'sha1'], ['MD5', 'md5'], ['SHA-224', 'sha224'], ['SHA-384', 'sha384'], ['SHA-512', 'sha512'], ['SHA-512/256', 'sha512-256'],
    ['SHA3-224', 'sha3-224'], ['SHA3-256', 'sha3-256'], ['SHA3-384', 'sha3-384'], ['SHA3-512', 'sha3-512']];
  claim(HG, 'works', 'All 13 algorithms are written out in the engine file itself as streaming hashes, so a file never has to fit in memory.', 'with no crypto object at all: 11 match OpenSSL, Keccak-256 and CRC32 match published vectors', N, async () => {
    const s = K.tool('dev2-hash-generator.js', 'hash-generator', { crypto: undefined });
    const msg = 'The quick brown fox jumps over the lazy dog';
    const r = s.transform(msg, { algo: 'every', input: 'text', case: 'lower', key: '', keyenc: 'text', expect: '' });
    const e = s.transform('abc', { algo: 'every', input: 'text', case: 'lower', key: '', keyenc: 'text', expect: '' });
    const bad = HG_ALGS.filter(([n, a]) => line(r, n) !== nodeHash(a, msg)).map((x) => x[0]);
    const kec = line(e, 'Keccak-256') === '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45';
    const crc = line(r, 'CRC32') === '414fa339';
    return [bad.length === 0 && kec && crc && !(r && typeof r.then === 'function'), bad.join(',') + ' keccak ' + kec + ' crc ' + crc];
  });
  claim(HG, 'point', 'Your text is first encoded as UTF-8, which is why Input length shows characters and bytes separately', '"é😀": 2 characters (code points), 6 bytes', N, async () => {
    const v = K.stat(hash('é😀'), 'Input length'); return [/^2 characters, 6 bytes$/.test(v || ''), v];
  });
  claim(HG, 'point', 'Hex and Base64 input are decoded to the bytes they spell.', 'the bytes 00 ff 10 as hex and as Base64 hash as those bytes', N, async () => {
    const want = nodeHash('sha256', Buffer.from([0, 255, 16]));
    const a = hash('00 FF 10', { algo: 'sha256', input: 'hex' }), b = hash('AP8Q', { algo: 'sha256', input: 'base64' });
    return [line(a, 'SHA-256') === want && line(b, 'SHA-256') === want, line(a, 'SHA-256') + ' ' + line(b, 'SHA-256')];
  });
  claim(HG, 'dfaq', '64 hexadecimal characters, or 256 bits, whatever the input length. SHA-1 gives 40 characters, MD5 32 and CRC32 8.', 'lengths', N, async () => {
    const r = hash('x'.repeat(1000)); const l = ['SHA-256', 'SHA-1', 'MD5', 'CRC32'].map((k) => (line(r, k) || '').length);
    return [l.join() === '64,40,32,8', l.join()];
  });
  claim(HG, 'point', 'With an HMAC key, each digest becomes an HMAC as RFC 2104 defines it.', 'keys shorter and longer than the block, 9 algorithms, against OpenSSL', N, async () => {
    const bad = [];
    for (const key of ['k', 'secret', 'x'.repeat(200)]) {
      const r = hash('message', { algo: 'every', key });
      HG_ALGS.filter((a) => a[1] !== 'sha512-256' && a[1] !== 'sha224').forEach(([n, a]) => { if (line(r, 'HMAC-' + n) !== nodeHash(a, 'message', key)) bad.push(n + '/' + key.length); });
    }
    return [bad.length === 0, bad.join(',') || 'all match'];
  });
  claim(HG, 'dfaq', 'for the message hello and the key secret, HMAC-SHA-256 begins 88aab3ed.', 'against OpenSSL', N, async () => {
    const r = hash('hello', { algo: 'sha256', key: 'secret' }); const want = nodeHash('sha256', 'hello', 'secret');
    return [line(r, 'HMAC-SHA-256') === want && want.indexOf('88aab3ed') === 0, line(r, 'HMAC-SHA-256')];
  });
  claim(HG, 'tip', 'Expected hash accepts hex in either case, Base64, a sha256sum line or a BSD-style SHA256 (file) = … line, and names the algorithm that matches.', 'five forms of the SHA-256 of abc match; a wrong one does not', N, async () => {
    const h = nodeHash('sha256', 'abc'), b64 = Buffer.from(h, 'hex').toString('base64');
    const forms = [h, h.toUpperCase(), b64, h + '  abc.txt', 'SHA256 (abc.txt) = ' + h];
    const got = forms.map((x) => K.stat(hash('abc', { expect: x }), 'Compare'));
    const no = K.stat(hash('abc', { expect: h.replace(/^b/, 'c') }), 'Compare');
    return [got.every((g) => g === 'Match: SHA-256') && no === 'No match', K.j(got) + ' / ' + no];
  });
  claim(HG, 'faq', 'They use the same permutation but pad the last block differently, so their digests differ.', 'abc: SHA3-256 (OpenSSL) and Keccak-256 (published vector) differ', N, async () => {
    const r = hash('abc', { algo: 'sha3' });
    return [line(r, 'SHA3-256') === nodeHash('sha3-256', 'abc') && line(r, 'Keccak-256') === '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45', line(r, 'SHA3-256') + ' ' + line(r, 'Keccak-256')];
  });
  claim(HG, 'tip', 'Hash a file of any size: it is read 4 MB at a time and never uploaded, with progress and a Cancel button. Paste the published checksum into Expected hash to check a download.',
    'in Chrome: a 9 MB file through Hash a file matches OpenSSL, the checksum matches, and nothing is sent', B, async () => {
      const bytes = require('crypto').randomBytes(9 * 1024 * 1024 + 5);
      const f = K.write('hg-9mb.bin', bytes);
      const want = nodeHash('sha256', bytes);
      const p = await K.open(HG);
      try {
        await p.evaluate((w) => { const e = document.getElementById('f-expect'); e.value = w; e.dispatchEvent(new Event('input', { bubbles: true })); }, 'SHA256 (hg-9mb.bin) = ' + want);
        const input = await p.$('.tool-io input[type=file]'); await input.uploadFile(f);
        await p.waitForFunction(() => /hg-9mb\.bin/.test(document.querySelector('.tool-io').textContent) && /SHA-256\s+[0-9a-f]{64}/.test(document.querySelector('.code-out').textContent), { timeout: 60000 });
        const r = await p.evaluate(() => ({ out: document.querySelector('.code-out').textContent, stats: document.querySelector('.tool-io .stat-grid').textContent }));
        const got = (/SHA-256\s+([0-9a-f]{64})/.exec(r.out) || [])[1];
        return [got === want && /Match: SHA-256/.test(r.stats) && K.outsideRequests().length === 0, got + ' | ' + r.stats.replace(/\s+/g, ' ').slice(0, 120)];
      } finally { await p.close(); }
    });
  claim(HG, 'tip', 'The key never goes into a share link and is not kept on this device.', 'in Chrome: after typing a key, localStorage and the share state hold no trace of it', B, async () => {
    const p = await K.open(HG);
    try {
      return await p.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const ta = document.querySelector('.code-area'); ta.value = 'hello'; ta.dispatchEvent(new Event('input', { bubbles: true }));
        const k = document.getElementById('f-key'); k.value = 'TOPSECRET-42'; k.dispatchEvent(new Event('input', { bubbles: true })); k.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(1200);
        const store = JSON.stringify(Object.assign({}, localStorage));
        const share = JSON.stringify(window.MVRTool.shareState ? window.MVRTool.shareState() : null) + location.href;
        const out = document.querySelector('.code-out').textContent;
        return [/HMAC-SHA-256/.test(out) && store.indexOf('TOPSECRET') < 0 && share.indexOf('TOPSECRET') < 0, 'store has key: ' + (store.indexOf('TOPSECRET') >= 0) + ', share/url has key: ' + (share.indexOf('TOPSECRET') >= 0)];
      });
    } finally { await p.close(); }
  });

  /* ================================================================ */
  const HT = '/developer/htaccess-generator/';
  const ht = (f) => out(K.gen(T('dev-htaccess-generator.js', 'htaccess-generator'), f));
  claim(HT, 'point', 'Force www redirects to www. plus your domain, cleaned of any http:// or www.', 'domain "https://www.example.com/"', N, async () => {
    const o = ht({ domain: 'https://www.example.com/', www: 'www' });
    return [/RewriteRule \^\(\.\*\)\$ https:\/\/www\.example\.com\/\$1 \[R=301,L\]/.test(o), (o.match(/RewriteRule[^\n]*/) || [''])[0]];
  });
  claim(HT, 'point', 'Force HTTPS then adds RewriteCond %{HTTPS} off and a 301 to the same host and path over https.', 'the https block', N, async () => {
    const o = ht({ https: 'yes', www: 'none' });
    return [/RewriteCond %\{HTTPS\} off\nRewriteRule \^\(\.\*\)\$ https:\/\/%\{HTTP_HOST\}\/\$1 \[R=301,L\]/.test(o), (o.match(/RewriteCond %\{HTTPS[^\n]*\n[^\n]*/) || ['absent'])[0]];
  });
  claim(HT, 'point', 'otherwise keeping the visitor\'s scheme through %{REQUEST_SCHEME} (Apache 2.4 on).', 'www without https', N, async () => {
    const o = ht({ https: 'no', www: 'www' }); return [/%\{REQUEST_SCHEME\}:\/\/www\./.test(o) && !/HTTPS\} off/.test(o), (o.match(/RewriteRule[^\n]*/) || [''])[0]];
  });
  claim(HT, 'point', 'Caching gives CSS, JavaScript, SVG, WebP and WOFF2 a year and HTML zero seconds; security adds four headers, and HSTS as a fifth only when HTTPS is forced.', 'cache lines and header count', N, async () => {
    const on = ht({ https: 'yes' }), off = ht({ https: 'no' });
    const year = ['text/css', 'application/javascript', 'image/svg+xml', 'image/webp', 'font/woff2'].every((t) => new RegExp('ExpiresByType ' + t.replace(/[/+]/g, '\\$&') + ' "access plus 1 year"').test(on));
    const hdr = (s) => (s.match(/^\s*Header (always )?set /gm) || []).length;
    return [year && /text\/html "access plus 0 seconds"/.test(on) && hdr(on) === 5 && hdr(off) === 4 && /Strict-Transport-Security/.test(on) && !/Strict-Transport-Security/.test(off), 'year ' + year + ', headers ' + hdr(on) + ' with https, ' + hdr(off) + ' without'];
  });
  claim(HT, 'dfaq', 'Every redirect written here uses R=301.', 'every RewriteRule is R=301', N, async () => {
    const all = [ht({ https: 'yes', www: 'www' }), ht({ https: 'yes', www: 'root' }), ht({ https: 'no', www: 'root' })].join('\n');
    const rules = all.match(/RewriteRule[^\n]*/g) || [];
    return [rules.length > 0 && rules.every((r) => /R=301/.test(r)), rules.length + ' rules'];
  });
  claim(HT, 'what', 'A block wrapped in IfModule is skipped quietly when its module is missing; the rewrite rules here are not wrapped.', 'RewriteEngine is outside IfModule', N, async () => {
    const o = ht({}); const i = o.indexOf('RewriteEngine'); const before = o.slice(0, i);
    return [i >= 0 && (before.match(/<IfModule/g) || []).length === (before.match(/<\/IfModule>/g) || []).length, i >= 0 ? 'not wrapped' : 'no rewrite'];
  });

  /* ================================================================ */
  const HE = '/developer/html-entities/';
  const hs = () => T('dev-html-entities.js', 'html-entities');
  const ent = (s, d, o) => out(K.tx(hs(), s, Object.assign({ dir: d || 'enc' }, o || {})));
  claim(HE, 'point', 'Escaping replaces exactly five characters by default: & < > " and \', the last as &#39; or, if you choose, &apos;.', 'exactly those five; é and € untouched; &apos; on request', N, async () => {
    const e = ent('&<>"\'é€'), a = ent('\'', 'enc', { apos: 'named' });
    return [e === '&amp;&lt;&gt;&quot;&#39;é€' && a === '&apos;', e + ' ' + a];
  });
  claim(HE, 'point', 'Escaping does not look for existing entities, so escaped text is escaped again.', '&amp; → &amp;amp;', N, async () => {
    const e = ent('Tom &amp; Jerry'); return [e === 'Tom &amp;amp; Jerry', e];
  });
  claim(HE, 'point', 'The other Escape modes also write non-ASCII characters as their shortest name, or as decimal or hex references.', 'é € → in all three modes', N, async () => {
    const n = ent('é€→', 'enc', { mode: 'named' }), d = ent('é€→', 'enc', { mode: 'dec' }), h = ent('é€→', 'enc', { mode: 'hex' });
    return [n === '&eacute;&euro;&rarr;' && d === '&#233;&#8364;&#8594;' && h === '&#xE9;&#x20AC;&#x2192;', [n, d, h].join(' | ')];
  });
  claim(HE, 'point', 'Unescaping reads all 2,125 names, the 106 older ones even without their closing ;, and every numeric reference; an unknown name is left as written and counted.',
    'a name from each end of the list, a legacy name without ;, numeric forms, an unknown name counted', N, async () => {
      const r = K.tx(hs(), '&AElig; &zwnj; &NotEqualTilde; &copy &#128512; &#x1F600; &#128; &bogus;', { dir: 'dec' });
      return [r.output === 'Æ ‌ ≂̸ © 😀 😀 € &bogus;' && K.stat(r, 'Unknown names left') === '1' && K.stat(r, 'Entities decoded') === '7', K.j(r.output) + ' ' + K.j(r.stats)];
    });
  claim(HE, 'point', 'Find an entity searches by name, character or code point.', 'copy, ©, U+00A9 and 169 all find &copy;; a click copies it', B, async () => {
    const p = await K.open(HE);
    try {
      const find = async (v) => {
        await p.evaluate((v) => { const q = document.querySelector('.he-finder input'); q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); }, v);
        await K.sleep(150);
        return p.evaluate(() => [...document.querySelectorAll('.he-item .he-name')].map((x) => x.textContent));
      };
      const a = await find('copy'), b = await find('©'), c = await find('U+00A9'), d = await find('169'), e = await find('zzzzzz');
      const none = await p.evaluate(() => document.querySelector('.he-results').textContent);
      return [a[0] === '&copy;' && b.indexOf('&copy;') === 0 && c.indexOf('&copy;') === 0 && d.indexOf('&copy;') === 0 && e.length === 0 && /No entity matches/.test(none), [a[0], b[0], c[0], d[0], e.length].join(' ')];
    } finally { await p.close(); }
  });
  claim(HE, 'dfaq', 'Unescaping turns &nbsp; into that character, not an ordinary space.', 'U+00A0', N, async () => { const d = ent('a&nbsp;b', 'dec'); return [d === 'a b', K.j(d)]; });
  claim(HE, 'dfaq', 'The default mode leaves them alone for that reason.', 'é and € untouched', N, async () => { const e = ent('café €5'); return [e === 'café €5', e]; });
  claim(HE, 'dfaq', 'this tool writes &#39; unless you ask for &apos;, and reads both.', 'writes &#39;, reads &apos; and &#39;', N, async () => {
    const e = ent('\''), d1 = ent('&apos;', 'dec'), d2 = ent('&#39;', 'dec');
    return [e === '&#39;' && d1 === '\'' && d2 === '\'', 'writes ' + e + ', reads ' + d1 + ' and ' + d2];
  });

  /* ================================================================ */
  const JF = '/developer/json-formatter/';
  const jf = () => T('dev-json-formatter.js', 'json-formatter');
  /* [input, line, column]: the first character the grammar cannot accept,
     except a trailing comma, which is placed on the comma itself rather than
     on the } or ] after it. Chrome's own messages give no position for
     several of these (trailing comma in an array, single quotes, BOM,
     truncated input). */
  const JF_ERRS = [
    ['{"a": 1,\n "b": [1,2,],\n}', 2, 11], ['[1, 2,\n]', 1, 6], ['{"a": 1,\n "b": 2,\n}', 2, 8],
    ['{"a": 1,\n  b: 2}', 2, 3], ["{'a': 1}", 1, 2], ["{\"a\": 'x'}", 1, 7], ['{"a": 1\n "b": 2}', 2, 2], ['[1 2]', 1, 4],
    ['{"a": "abc', 1, 11], ['{"a": "abc\n, "b": 1}', 1, 11], ['{"a": "c:\\path"}', 1, 10], ['{"a": "\\u12G4"}', 1, 8],
    ['{"a":', 1, 6], ['[tru', 1, 5], ['[1, [2, 3', 1, 10], ['\uFEFF{"a": 1}', 1, 1], ['{"a": 1 // note\n}', 1, 9],
    ['{"a": 1}\nxyz', 2, 1], ['{"a": NaN}', 1, 7], ['{\r\n  "a": 1,\r\n  "b": 2,\r\n}', 3, 9],
    ['['.repeat(5000) + '1,' + ']'.repeat(5000), 1, 5002]
  ];
  /* trailing commas: [input, line, column of the comma, closing bracket].
     Same line and a line or more above, LF and CRLF, objects and arrays,
     nested, with whitespace or a comment between comma and bracket. */
  const JF_TRAIL = [
    ['{"a":1,}', 1, 7, '}'], ['[1,2,]', 1, 5, ']'], ['{"a": 1, }', 1, 8, '}'], ['[1, 2,  ]', 1, 6, ']'],
    ['{\n  "a": 1,\n}', 2, 9, '}'], ['[\n  1,\n  2,\n]', 3, 4, ']'], ['[1, 2,\n\n\n]', 1, 6, ']'],
    ['{\r\n  "a": 1,\r\n}', 2, 9, '}'], ['[\r\n  1,\r\n  2,\r\n]', 3, 4, ']'], ['{"a": [1,\r\n\t]}', 1, 9, ']'],
    ['{"a": {"b": 1,\n  },\n "c": 2}', 1, 14, '}'], ['[1, // last\n]', 1, 3, ']'], ['{"a": 1, /* x */\r\n}', 1, 8, '}']
  ];
  const trailBad = (res) => res.map((r, i) => {
    const [t, l, c, br] = JF_TRAIL[i];
    const lines = String(r).split('\n');
    const commaLine = t.split('\n')[l - 1].replace(/\r$/, '');
    const ok = lines[0] === 'Invalid JSON at line ' + l + ', column ' + c + '.' && commaLine[c - 1] === ',' &&
      lines[1] && lines[1].trim() === commaLine.trim() && lines[lines.length - 1].indexOf('Trailing comma: remove this comma (before the ' + br + ').') === 0;
    return ok ? '' : JSON.stringify(t) + ' → ' + JSON.stringify(r);
  }).filter(Boolean);
  claim(JF, 'card', 'Format, validate and minify JSON. Pinpoints the exact line and column of any syntax error.',
    'in Chrome: ' + JF_ERRS.length + ' faults (trailing commas, single quotes, bare keys, missing commas, unterminated strings, bad escapes, truncation, a BOM, comments, deep nesting) each land on the right line and column', B, async () => {
      const p = await K.open(JF);
      try {
        const res = await p.evaluate((cases) => {
          const s = window.DEV_TOOLS['json-formatter'];
          return cases.map(([t]) => (s.transform(t, { mode: 'pretty', indent: '2' }).error || 'accepted').split('\n')[0]);
        }, JF_ERRS);
        const bad = res.map((r, i) => (r === 'Invalid JSON at line ' + JF_ERRS[i][1] + ', column ' + JF_ERRS[i][2] + '.' ? '' : JSON.stringify(JF_ERRS[i][0].slice(0, 30)) + ' → ' + r)).filter(Boolean);
        return [bad.length === 0, bad.length ? bad.join(' | ') : 'all ' + res.length + ' placed, e.g. ' + res.slice(0, 3).join(' | ')];
      } finally { await p.close(); }
    });
  claim(JF, 'point', 'When parsing fails, the tool’s own checker finds the first fault and prints its line, column and the reason','in Chrome: missing quote on line 2, with the line and the reason', B, async () => {
    const r = out(await inPage(JF, 'json-formatter', '{"a": 1,\n  b: 2}'));
    return [/^Invalid JSON at line 2, column 3\.\n\s+b: 2\}\n.*double quotes/.test(r), K.j(r)];
  });
  claim(JF, 'point', 'prints its line, column and the reason, whatever the browser’s message says.', 'with JSON.parse throwing a bare "SyntaxError" (no position), every fault still gets the same line and column', N, async () => {
    const parse = JSON.parse;
    const spec = K.tool('dev-json-formatter.js', 'json-formatter', { JSON: { parse: (t) => { try { return parse(t); } catch (e) { throw new SyntaxError('SyntaxError'); } }, stringify: JSON.stringify } });
    const bad = JF_ERRS.map(([t, l, c]) => { const r = (K.tx(spec, t).error || 'accepted').split('\n')[0]; return r === 'Invalid JSON at line ' + l + ', column ' + c + '.' ? '' : JSON.stringify(t.slice(0, 30)) + ' → ' + r; }).filter(Boolean);
    return [bad.length === 0, bad.length ? bad.join(' | ') : JF_ERRS.length + ' faults placed without a position from the parser'];
  });
  claim(JF, 'point', 'A trailing comma is marked at the comma itself.',
    'in Chrome: ' + JF_TRAIL.length + ' trailing commas (objects and arrays, same line and lines above, LF and CRLF, nested, a comment between) each give the comma\'s line and column, show its line and say "Trailing comma: remove this comma"', B, async () => {
      const p = await K.open(JF);
      try {
        const res = await p.evaluate((cases) => {
          const s = window.DEV_TOOLS['json-formatter'];
          return cases.map(([t]) => s.transform(t, { mode: 'pretty', indent: '2' }).error || 'accepted');
        }, JF_TRAIL);
        const bad = trailBad(res);
        return [bad.length === 0, bad.length ? bad.join(' | ') : 'all ' + res.length + ' on the comma, e.g. ' + JSON.stringify(res[4])];
      } finally { await p.close(); }
    });
  claim(JF, 'point', 'A trailing comma is marked at the comma itself.', 'the same ' + JF_TRAIL.length + ' cases in Node, with JSON.parse throwing a bare "SyntaxError"', N, async () => {
    const parse = JSON.parse;
    const spec = K.tool('dev-json-formatter.js', 'json-formatter', { JSON: { parse: (t) => { try { return parse(t); } catch (e) { throw new SyntaxError('SyntaxError'); } }, stringify: JSON.stringify } });
    const bad = trailBad(JF_TRAIL.map(([t]) => K.tx(spec, t).error || 'accepted'));
    return [bad.length === 0, bad.length ? bad.join(' | ') : JF_TRAIL.length + ' trailing commas placed on the comma'];
  });
  claim(JF, 'what', 'The tool points at line 4, column 15: the stray comma after 3.', 'in Chrome: the worked five-line config', B, async () => {
    const r = out(await inPage(JF, 'json-formatter', '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3,\n}'));
    return [/^Invalid JSON at line 4, column 15\.\n\s+"retries": 3,\nTrailing comma: remove this comma \(before the \}\)\.$/.test(r), K.j(r)];
  });
  claim(JF, 'mistake', 'Other than a trailing comma, the position is where the parser gave up, often a line after the real fault, such as a missing comma.',
    'in Chrome: a missing comma at the end of line 1 is reported at line 2, column 2, where JSON.parse stops; a trailing comma on line 1 is reported on line 1', B, async () => {
      const miss = '{"a": 1\n "b": 2}', trail = '{"a": 1,\n}';
      const p = await K.open(JF);
      try {
        const r = await p.evaluate((miss, trail) => {
          const s = window.DEV_TOOLS['json-formatter'];
          let at = -1; try { JSON.parse(miss); } catch (e) { const m = /position (\d+)/.exec(e.message); at = m ? Number(m[1]) : -2; }
          return { miss: s.transform(miss, { mode: 'pretty', indent: '2' }).error.split('\n')[0], trail: s.transform(trail, { mode: 'pretty', indent: '2' }).error.split('\n')[0], at };
        }, miss, trail);
        /* position 9 is the " of "b" on line 2, column 2: where the parser itself stopped */
        return [r.miss === 'Invalid JSON at line 2, column 2.' && r.at === 9 && r.trail === 'Invalid JSON at line 1, column 8.', K.j(r)];
      } finally { await p.close(); }
    });
  claim(JF, 'faq', 'Remove it, or tick Repair and the tool removes it for you and shows the line it changed.', 'refused as it is; with Repair, the comma on line 4, column 15 is listed and the rest is unchanged', N, async () => {
    const t = '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3,\n}';
    const a = K.tx(jf(), t), b = K.tx(jf(), t, { repair: 'yes' });
    const ok = !!a.error && !b.error && b.repairs.length === 1 && b.repairs[0].line === 4 && b.repairs[0].col === 15 && /trailing comma/.test(b.repairs[0].why) &&
      JSON.stringify(JSON.parse(out(b))) === JSON.stringify({ port: 8080, hosts: ['api.internal', 'cache.internal'], retries: 3 });
    return [ok, K.j(b.repairs)];
  });
  claim(JF, 'point', 'A valid document is written back with JSON.stringify: indented by 2 or 4 spaces or a tab, or on one line when minified.', 'indents and minify', N, async () => {
    const s = '{"a":[1,{"b":2}]}';
    const two = out(K.tx(jf(), s)), four = out(K.tx(jf(), s, { indent: '4' })), tab = out(K.tx(jf(), s, { indent: 'tab' })), min = out(K.tx(jf(), s, { mode: 'minify' }));
    return [two === JSON.stringify(JSON.parse(s), null, 2) && four === JSON.stringify(JSON.parse(s), null, 4) && tab === JSON.stringify(JSON.parse(s), null, '\t') && min === s, 'all four match JSON.stringify'];
  });
  claim(JF, 'point', 'With keys sorted, every object at every depth is rebuilt in alphabetical key order; arrays keep their own order.', 'nested sort', N, async () => {
    const o = out(K.tx(jf(), '{"b":{"z":1,"a":[3,1]},"a":"x y"}', { mode: 'sorted', indent: '2' }));
    return [JSON.stringify(JSON.parse(o)) === '{"a":"x y","b":{"a":[3,1],"z":1}}', o.replace(/\s+/g, '')];
  });
  claim(JF, 'point', 'The figures count every key and array item at all levels, the deepest nesting, and both sizes in UTF-8 bytes.', 'keys/items 6, depth, UTF-8 sizes', N, async () => {
    const s = '{"b":{"z":1,"a":[3,1]},"é":"x"}'; const r = K.tx(jf(), s);
    return [K.stat(r, 'Keys / items') === '6' && K.stat(r, 'Input') === Buffer.byteLength(s) + ' B', K.j(r.stats)];
  });
  claim(JF, 'dfaq', 'This parser rejects them unless Repair is ticked: then each comment is removed and listed.', 'a // and a /* */ comment: refused, then two removals listed', N, async () => {
    const t = '{"a":1, // c\n "b": /* x */ 2}';
    const a = K.tx(jf(), t), b = K.tx(jf(), t, { repair: 'yes', mode: 'minify' });
    return [!!a.error && out(b) === '{"a":1,"b":2}' && b.repairs.filter((x) => /comment/.test(x.why)).length === 2, K.j(b.repairs)];
  });
  /* RFC 9535's own example document and queries (section 1.5, table 2); results compared as sets where member order is free */
  const RFC_STORE = { store: { book: [
    { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
    { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
    { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
    { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 }
  ], bicycle: { color: 'red', price: 399 } } };
  const jq = (query) => { const r = K.tx(jf(), JSON.stringify(RFC_STORE), { mode: 'minify', query }); return r.error ? r.error : JSON.parse(out(r)); };
  claim(JF, 'point', 'JSONPath queries (RFC 9535) run in the tool’s own code', 'RFC 9535 table 2: nine of its queries give the RFC’s results', N, async () => {
    const titles = (a) => (Array.isArray(a) ? a.map((b) => b.title).join('|') : String(a));
    const set = (a) => (Array.isArray(a) ? a.map(String).sort().join('|') : String(a));
    const got = {
      authors: jq('$.store.book[*].author'), all: jq('$..author'), prices: jq('$.store..price'), third: jq('$..book[2]'), last: jq('$..book[-1]'),
      first2: jq('$..book[:2]'), first2b: jq('$..book[0,1]'), isbn: jq('$..book[?@.isbn]'), cheap: jq('$..book[?@.price<10]')
    };
    const ok = set(got.authors) === set(['Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien']) && set(got.all) === set(got.authors) &&
      set(got.prices) === set([8.95, 12.99, 8.99, 22.99, 399]) && titles(got.third) === 'Moby Dick' && titles(got.last) === 'The Lord of the Rings' &&
      titles(got.first2) === 'Sayings of the Century|Sword of Honour' && titles(got.first2b) === titles(got.first2) &&
      titles(got.isbn) === 'Moby Dick|The Lord of the Rings' && titles(got.cheap) === 'Sayings of the Century|Moby Dick';
    return [ok, K.j(got).slice(0, 300)];
  });
  claim(JF, 'dfaq', 'RFC 9535: a filter is written ?@.price < 10, and the older ?(@.price < 10) works too.', 'both spellings pick the two books under 10', N, async () => {
    const a = jq('$..book[?@.price < 10].title'), b = jq('$..book[?(@.price < 10)].title');
    return [K.j(a) === '["Sayings of the Century","Moby Dick"]' && K.j(b) === K.j(a), K.j(a) + ' | ' + K.j(b)];
  });
  claim(JF, 'tip', 'A JSONPath query such as $.items[?@.price > 10].sku keeps only what it matches, as an array, in every output; the matched paths are listed under the output.', 'two of three items; their paths; the same in YAML', N, async () => {
    const t = '{"items":[{"sku":"A","price":5},{"sku":"B","price":12},{"sku":"C","price":30}]}';
    const a = K.tx(jf(), t, { mode: 'minify', query: '$.items[?@.price > 10].sku' }), y = K.tx(jf(), t, { mode: 'yaml', query: '$.items[?@.price > 10].sku' });
    return [out(a) === '["B","C"]' && K.j(a.paths) === K.j(["$['items'][1]['sku']", "$['items'][2]['sku']"]) && out(y).trim() === '- B\n- C', out(a) + ' ' + K.j(a.paths) + ' ' + K.j(out(y))];
  });
  claim(JF, 'tip', 'Repair fixes what JSON5, JSONC and hand-edited files allow and JSON does not: comments, trailing commas, single quotes, bare names, +5, .5, 0x1F, NaN and Python’s True, False and None.', 'each one in one object; the result is what JSON.parse makes of the text repaired by hand', N, async () => {
    const r = K.tx(jf(), "{a: +5, b: .5, c: 0x1F, d: NaN, e: True, f: False, g: None, 'h': 'x', /* c */ i: [1,2,],}", { repair: 'yes', mode: 'minify' });
    const want = JSON.stringify(JSON.parse('{"a": 5, "b": 0.5, "c": 31, "d": null, "e": true, "f": false, "g": null, "h": "x", "i": [1,2]}'));
    return [!r.error && out(r) === want, out(r) || r.error];
  });
  claim(JF, 'tip', 'It edits your own text, lists every change, and never runs unless you tick it.', 'unticked: an error and no repair; ticked: one entry per change', N, async () => {
    const a = K.tx(jf(), "{'a': 1,}"), b = K.tx(jf(), "{'a': 1,}", { repair: 'yes' });
    return [!!a.error && !a.repairs && b.repairs.length === 2 && b.fixed === '{"a": 1}', K.j({ a: !!a.error, n: b.repairs && b.repairs.length, fixed: b.fixed })];
  });
  claim(JF, 'what', 'As YAML it is 64 B, and $.hosts[-1] picks "cache.internal".', 'the worked config', N, async () => {
    const t = '{\n  "port": 8080,\n  "hosts": ["api.internal", "cache.internal"],\n  "retries": 3\n}';
    const y = K.tx(jf(), t, { mode: 'yaml' }), m = K.tx(jf(), t, { mode: 'minify', query: '$.hosts[-1]' });
    return [K.stat(y, 'Output') === Buffer.byteLength(out(y)) + ' B' && Buffer.byteLength(out(y)) === 64 && out(m) === '["cache.internal"]', K.stat(y, 'Output') + ' ' + out(m)];
  });
  claim(JF, 'tip', 'YAML, CSV and XML are written from the same parsed value, and Download saves them as .yaml, .csv and .xml.', 'download types per mode', N, async () => {
    const t = '[{"id":1,"a":{"b":"x"}},{"id":2,"a":{"b":"y,z"}}]';
    const c = K.tx(jf(), t, { mode: 'csv' }), y = K.tx(jf(), t, { mode: 'yaml' }), x = K.tx(jf(), t, { mode: 'xml' });
    return [c.download.ext === 'csv' && y.download.ext === 'yaml' && x.download.ext === 'xml' && out(c).split(/\r?\n/)[0] === 'id,a.b' && /"y,z"/.test(out(c)), K.j([c.download, y.download, x.download]) + ' ' + K.j(out(c))];
  });
  claim(JF, 'tip', 'CSV has one row per array item, with nested keys as dotted columns.', 'two items, a.b column', N, async () => {
    const c = K.tx(jf(), '[{"id":1,"a":{"b":"x"}},{"id":2,"a":{"b":"y"}}]', { mode: 'csv' });
    return [out(c).trim().split(/\r?\n/).join('|') === 'id,a.b|1,x|2,y', K.j(out(c))];
  });
  claim(JF, 'faq', 'Files over 50 KB are formatted, converted and queried in a background worker, so the page stays responsive and a Cancel button appears if it takes a while; files over 2 MB stay out of the text box.',
    'in Chrome: a 60 KB paste runs in the Worker; a 3 MB file stays out of the box and its minified output equals JSON.stringify', B, async () => {
      const rows = []; for (let i = 0; i < 30000; i++) rows.push({ id: i, name: 'item ' + i, tags: ['a', 'b'], price: i / 10 });
      const big = JSON.stringify(rows, null, 1);
      const f = K.write('jf-big.json', big);
      const p = await K.open(JF);
      try {
        /* the shell creates its Worker only for a run that needs one: count them */
        await p.evaluate(() => { window.__workers = 0; const W = window.Worker; window.Worker = function (u, o) { window.__workers++; return new W(u, o); }; });
        const small = JSON.stringify(rows.slice(0, 900));
        await p.evaluate((t) => { const ta = document.querySelector('.code-area'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); }, small);
        await p.waitForFunction(() => /Valid/.test(document.querySelector('.tool-io .stat-grid').textContent), { timeout: 20000 });
        const workers = await p.evaluate(() => window.__workers);
        await p.select('#f-mode', 'minify');
        const input = await p.$('.tool-io input[type=file]'); await input.uploadFile(f);
        await p.waitForFunction(() => { const b = document.querySelector('.dev-file'); return b && !b.hidden; }, { timeout: 20000 });
        await p.waitForFunction((n) => document.querySelector('.code-out').textContent.length >= n, { timeout: 30000 }, 1024 * 1024);
        const r = await p.evaluate(() => ({ box: document.querySelector('.code-area').value.length, bar: document.querySelector('.dev-file').textContent.slice(0, 60), outLen: document.querySelector('.code-out').textContent.length }));
        const want = JSON.stringify(rows);
        return [small.length > 50 * 1024 && workers >= 1 && r.box === 0 && /jf-big\.json/.test(r.bar) && r.outLen === Math.min(want.length, 1024 * 1024),
          K.j({ smallKB: Math.round(small.length / 1024), workers, box: r.box, bar: r.bar, outLen: r.outLen, want: want.length })];
      } finally { await p.close(); }
    });
  claim(JF, 'tip', 'Tree shows the output as a collapsible tree: arrow keys move and open nodes, and Query this path puts the selected node’s path in the JSONPath box.', 'in Chrome: Tree view, ArrowDown, ArrowRight, Query this path', B, async () => {
    const p = await K.open(JF);
    try {
      return await p.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const ta = document.querySelector('.code-area');
        ta.value = '{"a":{"b":[1,2]},"c":3}'; ta.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(400);
        const tb = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tree');
        if (!tb) return [false, 'no Tree button'];
        tb.click(); await sleep(200);
        const root = document.querySelector('[role="tree"] [role="treeitem"]');
        if (!root) return [false, 'no tree items'];
        root.focus();
        const key = (k) => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        key('ArrowDown'); await sleep(50);
        const first = document.activeElement.textContent;
        key('ArrowLeft'); await sleep(50);
        const closed = document.activeElement.getAttribute('aria-expanded');
        key('ArrowRight'); await sleep(50);
        const expanded = closed === 'false' ? document.activeElement.getAttribute('aria-expanded') : 'not closed: ' + closed;
        const qb = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Query this path');
        if (!qb) return [false, 'no Query this path button'];
        qb.click(); await sleep(300);
        const box = [...document.querySelectorAll('.opt-bar input')].find((i) => /^\$/.test(i.value));
        return [/"a"/.test(first) && expanded === 'true' && !!box && (box.value === '$.a' || box.value === "$['a']"), JSON.stringify({ first: first.slice(0, 30), expanded, box: box && box.value })];
      });
    } finally { await p.close(); }
  });
  claim(JF, 'dfaq', 'an ID of 12345678901234567890 comes back as 12345678901234567000.', 'the long number', N, async () => {
    const o = out(K.tx(jf(), '{"id":12345678901234567890}', { mode: 'minify' })); return [o === '{"id":12345678901234567000}', o];
  });

  /* ================================================================ */
  const JW = '/developer/jwt-decoder/';
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = (s) => K.tx(T('dev-jwt-decoder.js', 'jwt-decoder'), s);
  const tok = (p, h) => b64u(h || { alg: 'HS256', typ: 'JWT' }) + '.' + b64u(p) + '.';
  const jws = () => K.tool('dev-jwt-decoder.js', 'jwt-decoder', { crypto: require('crypto').webcrypto });
  const cr = require('crypto');
  /* a token signed by Node's crypto: the independent reference */
  const nodeSign = (alg, payload, key, header) => {
    const h = Object.assign({ alg, typ: 'JWT' }, header || {});
    const input = b64u(h) + '.' + b64u(payload);
    const bits = alg.slice(2);
    let sig;
    if (/^HS/.test(alg)) sig = cr.createHmac('sha' + bits, key).update(input).digest();
    else if (/^RS/.test(alg)) sig = cr.sign('sha' + bits, Buffer.from(input), key);
    else if (/^ES/.test(alg)) sig = cr.sign('sha' + bits, Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
    return input + '.' + sig.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const RSA = K.once('jw-rsa', () => cr.generateKeyPairSync('rsa', { modulusLength: 2048 }));
  const RSA2 = K.once('jw-rsa2', () => cr.generateKeyPairSync('rsa', { modulusLength: 2048 }));
  claim(JW, 'point', 'Anything other than three parts is refused, which also rules out the five-part encrypted form.', 'two and five parts refused', N, async () => {
    const a = jwt('aaa.bbb'), b = jwt('a.b.c.d.e'); return [!!a.error && !!b.error, (a.error || 'ok') + ' | ' + (b.error || 'ok')];
  });
  claim(JW, 'works', 'the signature is checked only when you give a secret or a key.', 'a garbage signature still decodes; with a secret it is refused', N, async () => {
    const t = tok({ sub: 'x' }) + 'bm90LWEtc2lnbmF0dXJl';
    const r = jwt(t), v = await jws().verify(t, 'secret');
    return [!r.error && /"sub": "x"/.test(r.output) && v.ok === false, (r.error || 'decoded') + ' | ' + v.text];
  });
  claim(JW, 'point', 'Header and payload are decoded from base64url as UTF-8 and parsed with JSON.parse; each claim gets a line saying what it means.', 'é and ~ survive; sub, aud and exp are explained', N, async () => {
    const r = jwt(tok({ name: 'Zoë', q: '???>>>', sub: 'u1', aud: 'api', exp: 1767229200 }));
    const m = (k) => ((r.claims || []).find((c) => c.key === k) || {}).meaning || '';
    return [/"name": "Zoë"/.test(r.output || '') && /"q": "\?\?\?>>>"/.test(r.output || '') && /Subject/.test(m('sub')) && /Audience/.test(m('aud')) && /2026-01-01 01:00:00 UTC/.test(m('exp')), r.error || K.j([m('sub'), m('aud'), m('exp')])];
  });
  claim(JW, 'point', 'iat, nbf and exp are read as seconds and shown as UTC, and Status counts down to the expiry on your device clock.', 'iat 1516239022 in UTC; a future nbf is not yet valid; in Chrome the countdown moves', B, async () => {
    const now = Math.floor(Date.now() / 1000);
    const a = jwt(tok({ iat: 1516239022, exp: 1516239022 })), b = jwt(tok({ exp: now + 7200, nbf: now + 1800 }));
    const p = await K.open(JW);
    try {
      const t = tok({ sub: 'x', exp: now + 3600 }) + 'c2ln';
      const ticks = await p.evaluate(async (t) => {
        const ta = document.querySelector('.code-area'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 500));
        const c = document.querySelector('.jw-clock'); const one = c.textContent;
        await new Promise((r) => setTimeout(r, 2100));
        return [one, c.textContent, c.hidden];
      }, t);
      return [K.stat(a, 'Issued') === '2018-01-18 01:30:22 UTC' && /^NOT YET VALID/.test(K.stat(b, 'Status') || '') && !ticks[2] && ticks[0] !== ticks[1], K.j([K.stat(b, 'Status'), ticks])];
    } finally { await p.close(); }
  });
  claim(JW, 'point', 'Verifying uses the browser’s WebCrypto, with the key taken from a PEM, a certificate, a JWK or a JWKS entry picked by kid.', 'RS256 and ES256 tokens signed by Node verify with PEM, JWK and a JWKS of three keys (the certificate case is in build/tests/w3-d.js)', N, async () => {
    const { publicKey, privateKey } = await RSA, other = await RSA2;
    const ec = cr.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const t = nodeSign('RS256', { sub: 'a' }, privateKey, { kid: 'k2' }), e = nodeSign('ES256', { sub: 'b' }, ec.privateKey);
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const jwk = Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k2' });
    const jwks = JSON.stringify({ keys: [Object.assign(other.publicKey.export({ format: 'jwk' }), { kid: 'k1' }), jwk, Object.assign(ec.publicKey.export({ format: 'jwk' }), { kid: 'k3' })] });
    const s = jws();
    const r = [await s.verify(t, pem), await s.verify(t, JSON.stringify(jwk)), await s.verify(t, jwks), await s.verify(e, ec.publicKey.export({ type: 'spki', format: 'pem' })), await s.verify(t, other.publicKey.export({ type: 'spki', format: 'pem' }))];
    return [r[0].ok && r[1].ok && r[2].ok && r[3].ok && !r[4].ok, r.map((x) => x.ok).join(',') + ' | ' + r[4].text];
  });
  claim(JW, 'point', 'alg none is never verified, and an HS token with a public key given as its secret is refused.', 'alg none; HS256 HMAC-signed with the public key PEM as its secret', N, async () => {
    const { publicKey } = await RSA;
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const none = await jws().verify(tok({ sub: 'admin' }, { alg: 'none', typ: 'JWT' }), 'anything');
    const conf = await jws().verify(nodeSign('HS256', { sub: 'admin' }, pem), pem);
    return [!none.ok && !conf.ok && /confusion/.test(conf.text), none.text + ' | ' + conf.text];
  });
  claim(JW, 'tip', 'Verify with the secret (HS256, HS384, HS512) or with a public key', 'HS256/384/512 signed by Node verify; a wrong secret does not', N, async () => {
    const s = jws(); const out = [];
    for (const a of ['HS256', 'HS384', 'HS512']) { const t = nodeSign(a, { sub: 'x' }, 'my-secret-key-of-32-bytes-length!!'); out.push((await s.verify(t, 'my-secret-key-of-32-bytes-length!!')).ok, !(await s.verify(t, 'wrong')).ok); }
    return [out.every(Boolean), out.join(',')];
  });
  claim(JW, 'faq', 'The key whose kid matches the token\'s header is used.', 'covered with the JWKS check above: kid k2 of three keys', N, async () => {
    const { publicKey, privateKey } = await RSA, other = await RSA2;
    const t = nodeSign('RS256', { sub: 'a' }, privateKey, { kid: 'k2' });
    const jwks = JSON.stringify({ keys: [Object.assign(other.publicKey.export({ format: 'jwk' }), { kid: 'k1' }), Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'k2' })] });
    const r = await jws().verify(t, jwks), miss = await jws().verify(nodeSign('RS256', { sub: 'a' }, privateKey, { kid: 'k9' }), jwks);
    return [r.ok && !miss.ok && /k9/.test(miss.text), r.text + ' | ' + miss.text];
  });
  claim(JW, 'what', 'so with the issuer’s public key pasted under Verify the result is Invalid signature.', 'the worked token against a real RSA public key', N, async () => {
    const { publicKey } = await RSA;
    const t = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImstMjAyNi0wMSJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZSIsInN1YiI6InN2Yy1yZXBvcnRzIiwiYXVkIjoiYXBpLmV4YW1wbGUiLCJpYXQiOjE3NjcyMjU2MDAsImV4cCI6MTc2NzIyOTIwMH0.c2lnbmF0dXJlLW5vdC1jaGVja2Vk';
    const r = await jws().verify(t, publicKey.export({ type: 'spki', format: 'pem' }));
    return [!r.ok && /^Invalid signature/.test(r.text), r.text];
  });
  claim(JW, 'mistake', 'Anyone can write a payload; only a valid signature from a key you trust means the issuer wrote it.', 'a payload changed after signing decodes, and fails verification', N, async () => {
    const t = nodeSign('HS256', { sub: 'user', role: 'reader' }, 'k3y-k3y-k3y-k3y-k3y-k3y-k3y-k3y!');
    const parts = t.split('.'); parts[1] = b64u({ sub: 'user', role: 'admin' });
    const forged = parts.join('.');
    const d = jwt(forged), v = await jws().verify(forged, 'k3y-k3y-k3y-k3y-k3y-k3y-k3y-k3y!');
    return [/"role": "admin"/.test(d.output || '') && !v.ok, v.text];
  });
  claim(JW, 'mistake', 'An exp of 1767229200000 decodes to +057971-04-07', 'exp in milliseconds', N, async () => {
    const v = K.stat(jwt(tok({ exp: 1767229200000 })), 'Expires'); return [/^\+057971-04-07/.test(v || ''), v];
  });
  claim(JW, 'tip', 'The claims table flags a time that looks like milliseconds.', 'exp 1767229200000', N, async () => {
    const r = jwt(tok({ exp: 1767229200000 })); const m = ((r.claims || []).find((c) => c.key === 'exp') || {}).meaning || '';
    return [/milliseconds/.test(m), m];
  });
  claim(JW, 'tip', 'Secrets, keys and the token are never saved on this device and never put in a share link.', 'in Chrome: a token and a secret typed, verified and signed: nothing in localStorage, nothing in the share state', B, async () => {
    const t = nodeSign('HS256', { sub: 'SUBJECT-XYZ' }, 'SECRET-ABC-123-SECRET-ABC-123-XY');
    const p = await K.open(JW);
    try {
      return await p.evaluate(async (t) => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const ta = document.querySelector('.code-area'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
        const k = document.getElementById('jw-key'); k.value = 'SECRET-ABC-123-SECRET-ABC-123-XY'; k.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(1200);
        const verdict = document.querySelector('.jw-verdict').textContent;
        const store = JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage));
        const share = JSON.stringify(window.MVRTool.shareState ? window.MVRTool.shareState() : null) + location.href;
        const leak = ['SECRET-ABC', 'eyJ', 'SUBJECT-XYZ'].filter((x) => store.indexOf(x) >= 0 || share.indexOf(x) >= 0);
        return [/Signature verified/.test(verdict) && leak.length === 0, verdict.slice(0, 60) + ' | leaks: ' + leak.join(',')];
      }, t);
    } finally { await p.close(); }
  });
  claim(JW, 'lede', 'and sign a test token', 'the encoder\'s HS256/384/512 tokens carry the HMAC Node computes', N, async () => {
    const s = jws(); const bad = [];
    for (const a of ['HS256', 'HS384', 'HS512']) {
      const t = await s.sign(a, { sub: 'x', iat: 1 }, 'enc-secret');
      const [h, pl, sig] = t.split('.');
      const want = cr.createHmac('sha' + a.slice(2), 'enc-secret').update(h + '.' + pl).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (sig !== want || JSON.parse(Buffer.from(h, 'base64').toString()).alg !== a) bad.push(a);
    }
    return [bad.length === 0, bad.join(',') || 'all three match'];
  });

  /* ================================================================ */
  const LI = '/developer/lorem-ipsum/';
  const lorem = (f) => K.gen(T('dev-lorem-ipsum.js', 'lorem-ipsum'), f);
  const OPENING = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  claim(LI, 'point', 'The Latin list holds 63 distinct words from the classic passage and the English list 54', 'distinct words over many runs; each list is that long', N, async () => {
    const seen = { latin: new Set(), english: new Set() };
    for (const fl of ['latin', 'english']) for (let i = 0; i < 60; i++) out(lorem({ unit: 'words', count: 100, flavour: fl })).toLowerCase().split(/\s+/).forEach((w) => seen[fl].add(w.replace(/[^a-z]/g, '')));
    /* and the lists in the engine source: no word twice, so no word is likelier than another */
    const src = require('fs').readFileSync(require('path').join(K.ROOT, 'engine/dev-lorem-ipsum.js'), 'utf8');
    const list = (name) => { const m = new RegExp('const ' + name + " = (\\[\\.\\.\\.new Set\\()?'([a-z ]+)'").exec(src); if (!m) return null; const w = m[2].split(' '); return m[1] ? [...new Set(w)] : w; };
    const lat = list('LAT'), eng = list('ENG');
    return [seen.latin.size === 63 && seen.english.size === 54 && lat && lat.length === 63 && eng && eng.length === 54,
      seen.latin.size + ' Latin, ' + seen.english.size + ' English seen; lists of ' + (lat && lat.length) + ' and ' + (eng && eng.length)];
  });
  claim(LI, 'point', 'With the box ticked, Latin output opens with the classic 19-word sentence.', 'every unit with the box ticked and unticked; English never', N, async () => {
    const bad = [];
    if (OPENING.split(' ').length !== 19) bad.push('the reference sentence is not 19 words');
    for (const unit of ['paragraphs', 'sentences', 'items']) {
      if (out(lorem({ unit, count: 3 })).replace(/^- /, '').indexOf(OPENING) !== 0) bad.push(unit + ' does not open with it');
      if (out(lorem({ unit, count: 3, classic: 'no' })).replace(/^- /, '').indexOf('Lorem ipsum dolor sit amet,') === 0) bad.push(unit + ' opens with it when unticked');
      if (/consectetur adipiscing elit,/.test(out(lorem({ unit, count: 3, flavour: 'english' })))) bad.push(unit + ': English has it');
    }
    if (out(lorem({ unit: 'words', count: 7 })).indexOf('lorem ipsum dolor sit amet ') !== 0) bad.push('words do not start lorem ipsum dolor sit amet');
    if (out(lorem({ unit: 'bytes', count: 30 })) !== OPENING.slice(0, 30)) bad.push('30 bytes are not the first 30 characters of it');
    return [!bad.length, bad.join('; ') || 'paragraphs, sentences, list items, words and bytes open with it'];
  });
  claim(LI, 'point', 'A drawn sentence is 8 to 19 words, capitalised and closed with a full stop, with no commas; a paragraph is 3 to 5 sentences, and a heading 2 to 5 words.', 'shape of 100 paragraphs and 100 headings, box unticked', N, async () => {
    const paras = out(lorem({ unit: 'paragraphs', count: 100, classic: 'no' })).split(/\n\n/);
    const bad = [];
    for (const p of paras) {
      const ss = p.match(/[^.]+\./g) || [];
      if (ss.length < 3 || ss.length > 5) bad.push('para of ' + ss.length);
      for (const s of ss) { const w = s.trim().split(/\s+/); if (w.length < 8 || w.length > 19 || !/^[A-Z]/.test(w[0]) || /,/.test(s)) bad.push(w.length + ' words'); }
    }
    const heads = (out(lorem({ unit: 'paragraphs', count: 100, wrap: 'h2' })).match(/<h2>([^<]*)<\/h2>/g) || []).map((h) => h.replace(/<\/?h2>/g, '').split(' ').length);
    if (heads.length !== 100 || heads.some((n) => n < 2 || n > 5)) bad.push('headings: ' + heads.length + ', lengths ' + Math.min(...heads) + '–' + Math.max(...heads));
    return [paras.length === 100 && !bad.length, paras.length + ' paragraphs; ' + (bad.slice(0, 5).join(', ') || 'all in range')];
  });
  claim(LI, 'point', 'Words returns that many bare words, with no capitals or full stops; List items makes one sentence per item.', '25 words; 7 list items', N, async () => {
    const o = out(lorem({ unit: 'words', count: 25 })); const w = o.trim().split(/\s+/);
    const items = out(lorem({ unit: 'items', count: 7, classic: 'no' })).split('\n');
    const okItems = items.length === 7 && items.every((l) => /^- [A-Z][a-z ]+\.$/.test(l));
    return [w.length === 25 && !/[A-Z.]/.test(o) && okItems, w.length + ' words: ' + o.slice(0, 40) + ' | ' + items.length + ' items: ' + items[0]];
  });
  claim(LI, 'point', 'Bytes cuts plain text to exactly the number asked for, up to 100,000. Every other unit stops at 100, and the format wraps the result in <p>, headings, a <ul> or <ol> list, or Markdown.',
    'Buffer.byteLength of 1–600 and 100,000 bytes; 500 paragraphs give 100; each format', N, async () => {
      const bad = [];
      for (const n of [1, 2, 7, 19, 64, 255, 256, 600, 4096, 100000]) {
        const o = out(lorem({ unit: 'bytes', count: n }));
        if (Buffer.byteLength(o, 'utf8') !== n || /\s$/.test(o)) bad.push(n + ' → ' + Buffer.byteLength(o, 'utf8'));
      }
      if (Buffer.byteLength(out(lorem({ unit: 'bytes', count: 250000 })), 'utf8') !== 100000) bad.push('250,000 is not capped at 100,000');
      const n = out(lorem({ unit: 'paragraphs', count: 500 })).split(/\n\n/).length;
      if (n !== 100) bad.push('500 paragraphs gave ' + n);
      const f = (wrap) => out(lorem({ unit: 'paragraphs', count: 2, wrap }));
      if ((f('p').match(/<p>/g) || []).length !== 2) bad.push('<p>');
      if ((f('h2').match(/<h2>/g) || []).length !== 2) bad.push('headings');
      if (!/^<ul>\n  <li>/.test(f('li')) || !/^<ol>\n  <li>/.test(f('ol'))) bad.push('lists');
      if ((f('md').match(/^## /gm) || []).length !== 2 || !/^- /m.test(f('md'))) bad.push('Markdown');
      return [!bad.length, bad.join('; ') || 'exact byte counts; capped; every format'];
    });
  claim(LI, 'tip', 'Bytes gives plain text of exactly that many bytes, for testing a field or column limit: 255 bytes fills a VARCHAR(255) exactly.', '255 bytes, 200 runs', N, async () => {
    let bad = 0; for (let i = 0; i < 200; i++) { const o = out(lorem({ unit: 'bytes', count: 255, flavour: i % 2 ? 'english' : 'latin' })); if (Buffer.byteLength(o) !== 255 || o.length !== 255 || /[<>\n]/.test(o)) bad++; }
    return [bad === 0, bad + ' of 200 runs were not 255 bytes of plain text'];
  });
  claim(LI, 'works', 'Every run draws fresh words from a fixed list using Math.random, so no two results are the same.', 'two runs differ', N, async () => {
    const a = out(lorem({})), b = out(lorem({})); return [a !== b, a === b ? 'identical' : 'different'];
  });

  /* ================================================================ */
  const MD = '/developer/markdown-preview/';
  const md = (s, o) => K.tx(T('dev2-markdown-preview.js', 'markdown-preview'), s, o);
  claim(MD, 'lede', 'Convert Markdown to clean HTML with a live preview beside it: tables, task lists, footnotes, reference links, coloured code and maths', 'a pipe table becomes <table> with a header row and a body row', N, async () => {
    const o = out(md('| a | b |\n|---|---|\n| 1 | 2 |'));
    return [o === '<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>', o];
  });
  claim(MD, 'tip', 'Write - [ ] for an open task and - [x] for a done one; [^1] in the text with a line [^1]: … anywhere below makes a numbered footnote; [text][ref] with a line [ref]: https://… is a reference link.', 'a task list, a footnote defined below, a reference link defined below', N, async () => {
    const r = md('- [x] done\n- [ ] open\n\nNote[^1] and [the guide][g].\n\n[g]: https://example.com/guide\n[^1]: Signed off.');
    const o = out(r);
    const ok = /<li class="task-list-item"><input type="checkbox" checked disabled> done<\/li>/.test(o) && /<li class="task-list-item"><input type="checkbox" disabled> open<\/li>/.test(o) &&
      /<sup class="footnote-ref"><a href="#fn-1" id="fnref-1">1<\/a><\/sup>/.test(o) && /<li id="fn-1">Signed off\./.test(o) && /<a href="https:\/\/example\.com\/guide"[^>]*>the guide<\/a>/.test(o) &&
      !/\[g\]:|\[\^1\]:/.test(o) && K.stat(r, 'Task items') === '1 of 2 done' && K.stat(r, 'Footnotes') === '1';
    return [ok, o.replace(/\n/g, ' ').slice(0, 300)];
  });
  claim(MD, 'tip', 'The opening $ must touch the formula, so prices such as $5 and $10 stay as text. Switch it off under Maths between $ signs.', 'prices stay; $E = mc^2$ is marked; unticked, nothing is', N, async () => {
    const t = 'Cost $5 and $10. $E = mc^2$ and\n\n$$\n\\sum_{k=1}^n k\n$$';
    const a = out(md(t)), b = out(md(t, { math: 'no' }));
    return [/Cost \$5 and \$10\./.test(a) && /<span class="math inline">\\\(E = mc\^2\\\)<\/span>/.test(a) && /<div class="math display">\\\[\\sum_\{k=1\}\^n k\\\]<\/div>/.test(a) && !/class="math/.test(b), a.replace(/\n/g, ' ') + ' || ' + b.slice(0, 60)];
  });
  claim(MD, 'faq', 'The HTML marks each formula the way Pandoc does, as \\(…\\) inside a span with the class math, which MathJax and KaTeX pick up.', 'inline \\(…\\), display \\[…\\]', N, async () => {
    const o = out(md('$a+b$'));
    return [o === '<p><span class="math inline">\\(a+b\\)</span></p>', o];
  });
  claim(MD, 'tip', 'Supported: headings, bold, italic, strikethrough, inline code, fenced code blocks, links, images, blockquotes, ordered and unordered lists, horizontal rules, GitHub-style pipe tables, task lists, footnotes, reference links and maths.', 'one of each', N, async () => {
    const o = out(md('# H\n\n**b** *i* ~~s~~ `c` [l](https://x.y) ![im](https://x.y/a.png) $x^2$ [r][r]\n\n> q\n\n1. one\n\n- u\n- [ ] t\n\n---\n\n```\ncode\n```\n\n| t | u |\n|---|---|\n| 1 | 2 |\n\nF[^n]\n\n[r]: https://r.example\n[^n]: note'));
    const need = ['<h1', '<strong>', '<em>', '<del>|<s>', '<code>c</code>', '<pre', '<a href', '<img', '<blockquote', '<ol', '<ul', '<hr', '<table>', '<th>t</th>', '<td>2</td>', 'task-list-item', 'footnote-ref', 'href="https://r.example"', 'class="math inline"'];
    const miss = need.filter((n) => !new RegExp(n).test(o));
    return [!miss.length, miss.length ? 'missing ' + miss.join(', ') : 'all present'];
  });
  claim(MD, 'tip', 'A table is a header row of cells between pipes, then a row of --- under it. Write :---, :---: or ---: to align a column left, centre or right, and \\| for a pipe inside a cell.', 'alignment, outer pipes optional, \\| inside a cell', N, async () => {
    const a = out(md('| L | C | R | N |\n|:---|:---:|---:|---|\n| 1 | 2 | 3 | 4 |'));
    const b = out(md('a | b\n--- | ---\n1 | 2'));
    const c = out(md('| x \\| y | z |\n|---|---|\n| `p \\| q` | **r** |'));
    const ok = /<th style="text-align:left">L<\/th><th style="text-align:center">C<\/th><th style="text-align:right">R<\/th><th>N<\/th>/.test(a) &&
      /<td style="text-align:left">1<\/td><td style="text-align:center">2<\/td><td style="text-align:right">3<\/td><td>4<\/td>/.test(a) &&
      /<th>a<\/th><th>b<\/th>/.test(b) && /<td>1<\/td><td>2<\/td>/.test(b) &&
      /<th>x \| y<\/th><th>z<\/th>/.test(c) && /<td><code>p \| q<\/code><\/td><td><strong>r<\/strong><\/td>/.test(c);
    return [ok, [a, b, c].join(' | ')];
  });
  claim(MD, 'point', 'Each other line is classified by how it starts: #, >, a bullet, a task box, a number, a rule or a table; others join the paragraph above until a blank line.', 'short and long rows, the end of a table, a mismatched divider', N, async () => {
    const pad = out(md('| a | b |\n|---|---|\n| only |\n| 1 | 2 | 3 |'));
    const end = out(md('before\n| a | b |\n|---|---|\n| 1 | 2 |\nmore\n\nafter\n| c |\n|---|\n| 3 |\n# next'));
    const bad = out(md('| a | b |\n|---|\n| 1 | 2 |'));
    const ok = /<tr><td>only<\/td><td><\/td><\/tr>\n<tr><td>1<\/td><td>2<\/td><\/tr>/.test(pad) &&
      /^<p>before<\/p>\n<table>[\s\S]*<tr><td>more<\/td><td><\/td><\/tr>\n<\/tbody>\n<\/table>\n<p>after<\/p>\n<table>[\s\S]*<td>3<\/td>[\s\S]*<\/table>\n<h1>next<\/h1>$/.test(end) &&
      bad === '<p>| a | b | |---| | 1 | 2 |</p>';
    return [ok, [pad, end, bad].join(' || ')];
  });
  claim(MD, 'tip', 'HTML characters in your Markdown are escaped rather than passed through. That is deliberate — it means pasting untrusted Markdown cannot inject markup.', 'hostile table cells', N, async () => {
    const o = out(md('| <script>alert(1)</script> | <img src=x onerror=alert(1)> |\n|---|---|\n| [x](javascript:alert(1)) | [y](x"onmouseover="alert(1)) |\n| ![i" onerror="alert(1)](https://e.com/a.png) | :---: |'));
    const tags = (o.match(/<[a-z][^>]*>/g) || []).filter((t) => !/^<(table|thead|tbody|tr|th|td)>$/.test(t));
    const ok = /<th>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/th><th>&lt;img src=x onerror=alert\(1\)&gt;<\/th>/.test(o) &&
      /<td>x<\/td>/.test(o) && !/javascript:/i.test(o.replace(/<td>[^<]*<\/td>/g, '')) &&
      tags.every((t) => /^<a href="x&quot;onmouseover=&quot;alert\(1\)" rel="noopener noreferrer">$|^<img src="https:\/\/e\.com\/a\.png" alt="i&quot; onerror=&quot;alert\(1\)">$/.test(t));
    return [ok, o];
  });
  claim(MD, 'tip', 'Fenced code blocks are extracted before anything else runs, so asterisks and underscores inside them stay literal.', '*x* and __y__ inside a fence', N, async () => {
    const o = out(md('```\n*x* __y__\n```')); return [/\*x\* __y__/.test(o) && !/<em>|<strong>/.test(o), o];
  });
  claim(MD, 'mistake', 'Lines are joined into one paragraph, and two trailing spaces do not force a <br> here', 'two trailing spaces', N, async () => {
    const o = out(md('one  \ntwo')); return [!/<br/.test(o) && /<p>one\s+two<\/p>/.test(o), o];
  });
  claim(MD, 'mistake', 'Only fenced blocks become code; indented lines are treated as paragraph text.', 'four-space indent', N, async () => {
    const o = out(md('para\n\n    code here')); return [!/<pre|<code/.test(o), o];
  });
  claim(MD, 'dfaq', 'Not here: _a_ stays as typed. Single asterisks make italics, and __double underscores__ make bold after a space or at the start of a line.', '_a_, *a*, __b__', N, async () => {
    const a = out(md('x _a_ y')), b = out(md('x *a* y')), c = out(md('__b__ x'));
    return [/_a_/.test(a) && /<em>a<\/em>/.test(b) && /<strong>b<\/strong>/.test(c), [a, b, c].join(' | ')];
  });
  claim(MD, 'dfaq', 'the links written here already carry rel="noopener noreferrer".', 'a link', N, async () => {
    const o = out(md('[a](https://example.com)')); return [/rel="noopener noreferrer"/.test(o), o];
  });
  claim(MD, 'point', 'Full HTML document adds a doctype, head and body.', 'document wrap', N, async () => {
    const o = out(md('# x', { wrap: 'document' })); return [/^<!DOCTYPE html>/i.test(o) && /<head>/.test(o) && /<body>/.test(o), o.slice(0, 60)];
  });
  claim(MD, 'mistake', 'A <br> or <div> is escaped and shows as text', 'raw tags escaped', N, async () => {
    const o = out(md('a <br> b <div>')); return [/&lt;br&gt;/.test(o) && /&lt;div&gt;/.test(o), o];
  });

  /* in the page: the preview's own behaviour */
  const mdPage = async (text, fn, arg) => {
    const p = await K.open(MD);
    const reqs = [];
    p.on('request', (r) => reqs.push(r.url()));
    try {
      await p.evaluate((t) => { const ta = document.querySelector('.code-area'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true })); }, text);
      await K.sleep(600);
      return await fn(p, reqs, arg);
    } finally { await p.close(); }
  };
  claim(MD, 'faq', 'The preview, the styled export and the printout draw them as MathML with Temml, an MIT-licensed library kept on this site and loaded only when a formula appears.', 'in Chrome: no Temml request for plain text; one, from this site, once a formula is typed; the preview holds <math>', B, async () => mdPage('# Plain\n\nNo formulas here.', async (p, reqs) => {
    const res = () => p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /temml/i.test(n)));
    const before = (await res()).length;
    await p.evaluate(() => { const ta = document.querySelector('.code-area'); ta.value += '\n\n$E = mc^2$'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForFunction(() => !!document.querySelector('.mdp-view math'), { timeout: 15000 }).catch(() => {});
    const after = await res();
    const math = await p.evaluate(() => { const m = document.querySelector('.mdp-view math'); return m ? m.textContent : null; });
    const lic = K.read('engine/vendor/temml/LICENSE').toString();
    return [before === 0 && after.length >= 1 && after.every((u) => /^http:\/\/127\.0\.0\.1:\d+\/engine\/vendor\/temml\//.test(u)) && !!math && /MIT/.test(lic), K.j({ before, after: after.map((u) => u.replace(/^.*\/engine/, '/engine')), math })];
  }));
  claim(MD, 'tip', 'code in a fence that names its language, such as ```js or ```python, is coloured. Images are shown as a labelled box rather than fetched, so nothing leaves your device.', 'in Chrome: js and python fences get coloured spans; an image address is never requested', B, async () => mdPage('```js\nconst a = 1; // note\n```\n\n```python\ndef f():\n    return "x"\n```\n\n![A cat](http://127.0.0.1:9/cat.png) ![B](https://example.com/b.png)', async (p, reqs) => {
    const r = await p.evaluate(() => ({ js: document.querySelectorAll('.mdp-view pre code.language-js span').length, py: document.querySelectorAll('.mdp-view pre code.language-python span').length, imgs: document.querySelectorAll('.mdp-view img').length, box: (document.querySelector('.mdp-view [class*="img"]') || {}).textContent || '' }));
    const fetched = reqs.filter((u) => /cat\.png|b\.png/.test(u));
    return [r.js > 0 && r.py > 0 && r.imgs === 0 && /A cat/.test(r.box) && fetched.length === 0, K.j(r) + ' fetched ' + fetched.length];
  }));
  claim(MD, 'tip', 'Export styled .html saves one file with its styles inside it; Print or save as PDF prints the rendered document alone, without the page around it.', 'in Chrome: the export is one text/html file with a <style>, the title from the first heading and the converted body; print shows only the printout', B, async () => mdPage('# Release plan\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done', async (p) => {
    const r = await p.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      let blob = null, name = '';
      const cu = URL.createObjectURL; URL.createObjectURL = function (b) { blob = b; return cu.call(URL, b); };
      const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { name = this.download; };
      const btn = (t) => [...document.querySelectorAll('.mdp-bar button')].find((b) => b.textContent === t);
      btn('Export styled .html').click(); await sleep(500);
      HTMLAnchorElement.prototype.click = ck; URL.createObjectURL = cu;
      const html = blob ? await blob.text() : '';
      window.print = function () { window.__printed = { on: document.documentElement.classList.contains('mdp-print'), table: !!document.querySelector('.mdp-printout table') }; };
      btn('Print or save as PDF').click(); await sleep(150);
      return { type: blob && blob.type, name, style: /<style>[\s\S]+<\/style>/.test(html), title: (/<title>([^<]*)<\/title>/.exec(html) || [])[1], body: /<table>/.test(html) && /checkbox/.test(html), ext: /https?:\/\//.test(html.replace(/https:\/\/[^"']*example[^"']*/g, '')) };
    });
    await p.emulateMediaType('print');
    r.printed = await p.evaluate(() => Object.assign({}, window.__printed, { shown: [...document.body.children].filter((e) => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0).map((e) => e.className || e.tagName) }));
    await p.emulateMediaType('screen');
    await K.sleep(1200);
    r.after = await p.evaluate(() => document.documentElement.classList.contains('mdp-print') || !!document.querySelector('.mdp-printout'));
    return [r.type === 'text/html' && r.name === 'release-plan.html' && r.style && r.title === 'Release plan' && r.body && !r.ext && r.printed.on && r.printed.table && r.printed.shown.join() === 'mdp-printout' && !r.after, K.j(r)];
  }));

  claim(MD, 'tip', 'The Preview shows the result beside your Markdown and scrolls with it', 'in Chrome: scrolling the text to a heading far down scrolls the preview to it', B, async () => mdPage(Array.from({ length: 40 }, (_, i) => '## Part ' + (i + 1) + '\n\nText of part ' + (i + 1) + '.\n').join('\n'), async (p) => {
    const r = await p.evaluate(async () => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
      const ta = document.querySelector('.code-area'), view = document.querySelector('.mdp-view');
      const lh = parseFloat(getComputedStyle(ta).lineHeight);
      const line = ta.value.split('\n').indexOf('## Part 30');
      ta.scrollTop = line * lh; ta.dispatchEvent(new Event('scroll'));
      await sleep(300);
      const h = [...view.querySelectorAll('h2')].find((x) => x.textContent === 'Part 30');
      const off = h.getBoundingClientRect().top - view.getBoundingClientRect().top;
      return { scroll: view.scrollTop, off: Math.round(off), height: view.clientHeight };
    });
    return [r.scroll > 0 && Math.abs(r.off) < 60, K.j(r)];
  }));

  /* ================================================================ */
  const MT = '/developer/meta-tag-generator/';
  const meta = (f) => K.gen(T('dev-meta-tag-generator.js', 'meta-tag-generator'), f);
  claim(MT, 'point', 'You get the title, description and canonical link, seven og: properties with og:type fixed at website, and four twitter: tags using the summary_large_image card: Tags generated reads 14.',
    'tag census of the default output', N, async () => {
      const r = meta({}); const o = r.output;
      const og = (o.match(/property="og:/g) || []).length, tw = (o.match(/name="twitter:/g) || []).length;
      return [og === 7 && tw === 4 && /og:type" content="website"/.test(o) && /twitter:card" content="summary_large_image"/.test(o) && K.stat(r, 'Tags generated') === '14', 'og ' + og + ', twitter ' + tw + ', stat ' + K.stat(r, 'Tags generated')];
    });
  claim(MT, 'point', 'Blank fields write no tags: with no share image, Tags generated reads 12.', 'no image: 12 tags, card summary; every field blank: no empty content=""', N, async () => {
    const a = meta({ image: '' }), b = meta({ title: '', desc: '  ', url: '', image: '', site: '' });
    const tags = (o) => (o.match(/<(title|meta|link)\b/g) || []).length;
    const ok = K.stat(a, 'Tags generated') === '12' && tags(a.output) === 12 && !/og:image|twitter:image/.test(a.output) && /twitter:card" content="summary"/.test(a.output)
      && !/content=""|href=""|<title><\/title>/.test(b.output) && K.stat(b, 'Tags generated') === String(tags(b.output));
    return [ok, 'no image: ' + K.stat(a, 'Tags generated') + ' tags; all blank: ' + K.stat(b, 'Tags generated') + ' tags, ' + (/content=""|href=""/.test(b.output) ? 'empty tags written' : 'no empty tags')];
  });
  claim(MT, 'point', 'Each value has &, <, > and " replaced by entities before it goes into a tag, so a quote in a title cannot end the attribute.', 'a title with & < > "', N, async () => {
    const o = meta({ title: 'A & B <x> "q"' }).output;
    return [/content="A &amp; B &lt;x&gt; &quot;q&quot;"/.test(o), (o.match(/og:title" content="[^\n]*/) || [''])[0]];
  });
  claim(MT, 'point', 'Lengths count the characters you typed, before escaping: over 60 or 160 may be truncated, under 30 or 70 is quite short.', 'warnings at 61 and 29 characters', N, async () => {
    const long = meta({ title: 'x'.repeat(61) }), short = meta({ title: 'x'.repeat(29) }), ok = meta({ title: 'x'.repeat(45) });
    const all = (r) => K.j(r.stats) + ' ' + (r.warn || '');
    return [/trunc/i.test(all(long)) && /short/i.test(all(short)) && !/trunc|short/i.test(K.j((ok.stats || []).filter((s) => /Title/i.test(s[0])))), all(long).slice(0, 200)];
  });
  claim(MT, 'faq', 'Google publicly stopped using the keywords meta tag for ranking in 2009. It is omitted here deliberately.', 'no keywords tag', N, async () => {
    const o = meta({}).output; return [!/name="keywords"/.test(o), /keywords/.test(o) ? 'keywords present' : 'none'];
  });
  claim(MT, 'point', 'URLs are copied exactly; nothing checks that they are absolute or that the image exists.', 'a relative image URL goes in unchanged', N, async () => {
    const o = meta({ image: 'img/card.png' }).output; return [/og:image" content="img\/card\.png"/.test(o), (o.match(/og:image" content="[^"]*"/) || [''])[0]];
  });
  claim(MT, 'dfaq', 'This tool fills both from one field', 'title and og:title share the title field', N, async () => {
    const o = meta({ title: 'One Title' }).output; return [/<title>One Title<\/title>/.test(o) && /og:title" content="One Title"/.test(o), 'both from one field'];
  });
  claim(MT, 'point', 'Robots, X account, image description and image size add tags only when you set them. Previews of Google, Facebook and X are drawn from the same values, and the image is fetched only if you press the button.',
    'defaults still 14 tags; each field adds its tags; a bad handle is refused; Chrome: three previews, and the image address is requested only after the button', B, async () => {
      const d = meta({}), rb = meta({ robots: 'noindex, nofollow' }), tw = meta({ twitter: '1234tools' }), tw2 = meta({ twitter: '@1234tools' }), bad = meta({ twitter: 'not a handle!' });
      const alt = meta({ imgalt: 'A grid of tool icons' }), dim = meta({ imgw: 1200, imgh: 630 }), noimg = meta({ image: '', imgalt: 'x', imgw: 1200, imgh: 630 });
      const n = (r) => K.stat(r, 'Tags generated');
      const nodeOk = n(d) === '14' && n(rb) === '15' && /<meta name="robots" content="noindex, nofollow">/.test(rb.output) && n(tw) === '15' && /twitter:site" content="@1234tools"/.test(tw.output) && tw.output === tw2.output && n(bad) === '14' && /1 to 15 letters/.test(bad.warn || '') && n(alt) === '16' && /og:image:alt" content="A grid of tool icons"/.test(alt.output) && /twitter:image:alt/.test(alt.output) && n(dim) === '16' && /og:image:width" content="1200"/.test(dim.output) && /og:image:height" content="630"/.test(dim.output) && n(noimg) === '12';
      const p = await K.open(MT);
      try {
        await p.setBypassServiceWorker(true);   // requests the worker answers are not reported, which would hide them
        await p.evaluate(() => { Object.keys(localStorage).filter((k) => /meta/.test(k)).forEach((k) => localStorage.removeItem(k)); });
        await p.reload({ waitUntil: 'load' });
        const origin = new URL(p.url()).origin, img = origin + '/assets/img/og-image.png?mt=' + Date.now();
        const reqs = []; p.on('request', (r) => reqs.push(r.url()));
        await p.evaluate((u) => { const i = document.getElementById('f-image'); i.value = u; i.dispatchEvent(new Event('input', { bubbles: true })); }, img);
        await K.sleep(700);
        const before = { cards: await p.evaluate(() => document.querySelectorAll('.mt-card').length), reqs: reqs.filter((u) => u === img).length, imgs: await p.evaluate(() => document.querySelectorAll('.mt-img img').length) };
        await K.clickText(p, '.tool-io button', /Show the image from that address/);
        for (let t = 0; t < 40 && !reqs.some((u) => u === img); t++) await K.sleep(150);   // a loaded machine can be slow to start the request
        await K.sleep(300);
        const after = { reqs: reqs.filter((u) => u === img).length, imgs: await p.evaluate(() => document.querySelectorAll('.mt-img img').length) };
        return [nodeOk && before.cards === 3 && before.reqs === 0 && before.imgs === 0 && after.reqs >= 1, 'node ' + nodeOk + '; before the button: ' + before.cards + ' cards, ' + before.reqs + ' requests for the image; after: ' + after.reqs + ' request(s), ' + after.imgs + ' pictures'];
      } finally { await p.close(); }
    });
  claim(MT, 'tip', 'Share images want 1200×630 pixels. Anything much smaller renders as a small square thumbnail instead of a banner. Drop the image file under the previews to check its size; it is read in your browser and not uploaded.',
    'Chrome: a 1200×630 file reads "right for a large card" and adds width and height tags; a 400×400 one reads too small; nothing is sent', B, async () => {
      const p = await K.open(MT);
      try {
        await p.setBypassServiceWorker(true);   // requests the worker answers are not reported, which would hide them
        const reqs = []; p.on('request', (r) => { if (r.method() !== 'GET') reqs.push(r.method() + ' ' + r.url()); });
        const run = async (w, h, name) => {
          await p.evaluate(() => { Object.keys(localStorage).filter((k) => /meta/.test(k)).forEach((k) => localStorage.removeItem(k)); });
          await p.reload({ waitUntil: 'load' });
          const f = K.write(name, await K.img.makePng(p, w, h, "x.fillStyle='#e8590c';x.fillRect(0,0,w,h);"));
          const input = await p.$('#mt-file'); await input.uploadFile(f);
          await p.waitForFunction(() => /Share image/.test(document.querySelector('.stat-grid').textContent), { timeout: 15000 });
          return p.evaluate(() => ({ row: [...document.querySelectorAll('.stat-grid > *')].map((x) => x.textContent).find((t) => /^Share image/.test(t)) || '', out: document.querySelector('.code-out').textContent, imgs: document.querySelectorAll('.mt-img img').length }));
        };
        const big = await run(1200, 630, 'mt-big.png'), small = await run(400, 400, 'mt-small.png');
        return [/1200 × 630 \(1\.90:1\) — right for a large card/.test(big.row) && /og:image:width" content="1200"/.test(big.out) && /og:image:height" content="630"/.test(big.out) && big.imgs >= 2 && /400 × 400 \(1\.00:1\) — too small/.test(small.row) && reqs.length === 0, big.row + ' | ' + small.row + ' | non-GET requests: ' + reqs.length];
      } finally { await p.close(); }
    });
  claim(MT, 'faq', 'Showing it would mean loading the address you typed, which would contact that site while you edit. Press Show the image to fetch it, or drop the file itself to preview it from your device.',
    'with the default form the page makes no request for the share image; the placeholder names the address', B, async () => {
      const p = await K.open(MT);
      try {
        await p.setBypassServiceWorker(true);   // requests the worker answers are not reported, which would hide them
        await p.evaluate(() => { Object.keys(localStorage).filter((k) => /meta/.test(k)).forEach((k) => localStorage.removeItem(k)); });
        const reqs = []; p.on('request', (r) => reqs.push(r.url()));
        await p.reload({ waitUntil: 'load' });
        await K.sleep(600);
        const ph = await p.evaluate(() => [...document.querySelectorAll('.mt-ph')].map((x) => x.textContent));
        return [!reqs.some((u) => /og-image/.test(u)) && ph.some((t) => /og-image\.png/.test(t)), reqs.filter((u) => /og-image/.test(u)).length + ' requests for the image; ' + ph[0]];
      } finally { await p.close(); }
    });

  /* ================================================================ */
  const RX = '/developer/regex-tester/';
  const rx = (text, o) => K.tx(T('dev2-regex-tester.js', 'regex-tester'), text, o);
  claim(RX, 'tip', 'Without the g flag only the first match is returned.', 'flags "" gives one match', N, async () => {
    const r = rx('a1 b2 c3', { pattern: '\\w\\d', flags: '' }); return [K.stat(r, 'Matches') === '1', K.stat(r, 'Matches')];
  });
  claim(RX, 'mistake', '\\d* matches an empty string at every position: on a1b22c333 it reports 7 matches, 4 of them empty.', 'the example', N, async () => {
    const r = rx('a1b22c333', { pattern: '\\d*', flags: 'g' });
    const empty = (r.output.match(/""/g) || []).length;
    return [K.stat(r, 'Matches') === '7' && empty === 4, K.stat(r, 'Matches') + ' matches, ' + empty + ' empty'];
  });
  claim(RX, 'point', 'An empty match moves the search on one character, and the loop stops at 10,000 matches so it cannot freeze the page.', '20,000 characters with "." stop at 10,000', N, async () => {
    const r = rx('x'.repeat(20000), { pattern: '.', flags: 'g' }); return [/^10,?000$/.test(K.stat(r, 'Matches') || ''), K.stat(r, 'Matches')];
  });
  claim(RX, 'point', 'Replace and Split call String.replace and String.split; the eight flags combine as the browser allows.', 'all 256 sets of dgimsuvy: accepted exactly when new RegExp accepts them, written in the order RegExp writes them', N, async () => {
    const bad = [];
    for (let m = 0; m < 256; m++) {
      const f = 'dgimsuvy'.split('').filter((c, i) => m & (1 << i)).join('');
      let ok = true, canon = ''; try { canon = new RegExp('a', f).flags; } catch (e) { ok = false; }
      const r = rx('a', { pattern: 'a', flags: f.split('').reverse().join('') });
      const took = !r.error && K.stat(r, 'Flags') === (canon || '(none)');
      if (took !== ok) bad.push(f + ':' + (r.error || K.stat(r, 'Flags')));
    }
    return [bad.length === 0, bad.length ? bad.slice(0, 6).join(' ') : '256 of 256 agree with RegExp'];
  });
  claim(RX, 'point', 'The explanation is the tool’s own reading of the pattern; RegExp still decides what is valid.', 'named group, quantifier, class and a pattern RegExp refuses', N, async () => {
    const r = rx('2026-10', { pattern: '(?<y>\\d{4})-[^a-z]+?', flags: 'g' });
    const t = (r.explain || []).map((x) => x.txt).join(' | ');
    const e = rx('x', { pattern: 'a{2,1}' });
    let v8 = ''; try { new RegExp('a{2,1}', 'g'); } catch (x) { v8 = x.message; }
    return [/named “y”/.test(t) && /exactly 4 times/.test(t) && /as few times as possible|lazy/i.test(t) && !!v8 && String(e.error || '').indexOf(v8) >= 0, t.slice(0, 200) + ' || ' + e.error];
  });
  /* in the page: the flag buttons, the colours in the box, the cheat sheet, saved tests, the 2 s stop */
  const rxPage = async (fn) => {
    const p = await K.open(RX);
    try { return await p.evaluate(fn); } finally { await p.close(); }
  };
  claim(RX, 'tip', 'Press a flag button, or type the letters in the Flags box: g, i, m, s, u, v, y and d combine freely, and the browser decides which mixes are valid.', 'in Chrome: i then m then u then v; v replaces u', B, async () => rxPage(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const f = document.getElementById('f-flags');
    const btn = (c) => [...document.querySelectorAll('.rx-flag')].find((b) => b.textContent === c);
    const seen = [];
    for (const c of ['i', 'm', 'u', 'v']) { btn(c).click(); await sleep(150); seen.push(f.value + (btn(c).getAttribute('aria-pressed') === 'true' ? '+' : '-')); }
    const flags = [...document.querySelectorAll('.rx-flag')].map((b) => b.textContent).join('');
    return [seen.join(' ') === 'gi+ gim+ gimu+ gimv+' && flags === 'gimsuvyd', seen.join(' ') + ' buttons ' + flags];
  }));
  claim(RX, 'tip', 'Matches are coloured in the text box itself, and each capture group in a colour of its own. Press a match’s number in the table to select it in the text.', 'in Chrome: marks behind the box match the matches; groups differ in colour; number 2 selects match 2', B, async () => rxPage(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const set = (id, v) => { const x = document.getElementById(id); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); };
    set('f-pattern', '(\\d{2})/(\\d{2})');
    const ta = document.querySelector('.code-area'); ta.value = 'due 03/11 and 17/12'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(900);
    const marks = [...document.querySelectorAll('.rx-back-in mark')];
    const whole = marks.filter((m) => !m.parentElement.closest('mark'));
    const look = (x) => { const c = getComputedStyle(x); return [c.backgroundColor, c.borderBottomColor, c.boxShadow, c.textDecorationColor].join(' '); };
    const groupCols = [...document.querySelectorAll('.rx-back-in mark .rx-g')].map(look);
    const b2 = [...document.querySelectorAll('.rx-panel button')].find((b) => b.textContent.trim() === '2');
    if (b2) b2.click();
    await sleep(100);
    const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
    return [whole.length === 2 && new Set(groupCols).size >= 2 && sel === '17/12', JSON.stringify({ whole: whole.length, groupCols: [...new Set(groupCols)], sel })];
  }));
  claim(RX, 'tip', 'The Explanation tab reads the pattern back part by part, in plain English, and the Cheat sheet tab puts a token into the pattern at the cursor.', 'in Chrome: \\d inserted at the cursor; the explanation follows', B, async () => rxPage(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pIn = document.getElementById('f-pattern');
    pIn.value = 'ab'; pIn.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('rx-tab-cheat').click();
    pIn.focus(); pIn.setSelectionRange(1, 1);
    const tok = [...document.querySelectorAll('.rx-token')].find((b) => b.textContent === '\\d');
    tok.click(); await sleep(600);
    document.getElementById('rx-tab-explain').click(); await sleep(100);
    const ex = document.getElementById('rx-panel-explain').textContent;
    return [pIn.value === 'a\\db' && /digit/i.test(ex), pIn.value + ' | ' + ex.slice(0, 120)];
  }));
  claim(RX, 'tip', 'Saved tests keep the pattern, flags, replacement and text in this browser only, up to 30 of them.', 'in Chrome: save, reload, load back; the 31st is refused', B, async () => {
    const p = await K.open(RX);
    try {
      const r1 = await p.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const set = (id, v) => { const x = document.getElementById(id); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); };
        set('f-pattern', 'x(\\d)'); set('f-replacement', '[$1]');
        const f = document.getElementById('f-flags'); f.value = 'gi'; f.dispatchEvent(new Event('change', { bubbles: true }));
        const ta = document.querySelector('.code-area'); ta.value = 'x1 X2'; ta.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(400);
        document.getElementById('rx-tab-saved').click();
        document.getElementById('rx-save-name').value = 'mine';
        const save = [...document.querySelectorAll('#rx-panel-saved button')].find((b) => b.textContent === 'Save this test');
        save.click();
        for (let i = 2; i <= 30; i++) { document.getElementById('rx-save-name').value = 't' + i; save.click(); }
        document.getElementById('rx-save-name').value = 't31'; save.click();
        const msg = document.querySelector('#rx-panel-saved [role=status]').textContent;
        const keys = Object.keys(localStorage).filter((k) => /regex/.test(k));
        return { msg, keys, n: JSON.parse(localStorage.getItem('1234tools-dev:regex-tester')).tests.length };
      });
      await p.reload({ waitUntil: 'load' });
      await K.sleep(500);
      const r2 = await p.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        document.getElementById('rx-tab-saved').click();
        const ta = document.querySelector('.code-area'); ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true }));
        const load = [...document.querySelectorAll('#rx-panel-saved button')].find((b) => b.getAttribute('aria-label') === 'Load mine');
        load.click(); await sleep(600);
        return { pattern: document.getElementById('f-pattern').value, flags: document.getElementById('f-flags').value, rep: document.getElementById('f-replacement').value, text: ta.value };
      });
      const ok = /30 saved tests/.test(r1.msg) && r1.n === 30 && r1.keys.join() === '1234tools-dev:regex-tester' &&
        r2.pattern === 'x(\\d)' && r2.flags === 'gi' && r2.rep === '[$1]' && r2.text === 'x1 X2';
      return [ok, K.j({ r1, r2 })];
    } finally { await p.close(); }
  });
  claim(RX, 'faq', 'In this browser\'s own storage on this device, under the tool\'s one settings entry.', 'covered with the saved-tests check: one key, 1234tools-dev:regex-tester', N, async () => {
    const src = K.read('engine/dev2-regex-tester.js').toString();
    return [!/localStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/.test(src) && /ctx\.store\.set\('tests'/.test(src), 'the engine stores only through ctx.store and has no network call'];
  });
  claim(RX, 'tip', 'Nested quantifiers such as (a+)+ can trigger catastrophic backtracking on non-matching input. Here the pattern runs in a background worker and is stopped after 2 seconds.', 'in Chrome: (a+)+$ on 40 a’s and a ! is stopped at about 2 s and the page answers meanwhile', B, async () => rxPage(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const set = (id, v) => { const x = document.getElementById(id); x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); };
    const t0 = performance.now();
    set('f-pattern', '(a+)+$');
    const ta = document.querySelector('.code-area'); ta.value = 'a'.repeat(40) + '!'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    let ticks = 0; const iv = setInterval(() => ticks++, 100);
    while (performance.now() - t0 < 6000 && !/Stopped after 2 seconds/.test(document.querySelector('.io-msg').textContent)) await sleep(50);
    clearInterval(iv);
    const ms = Math.round(performance.now() - t0);
    return [/Stopped after 2 seconds/.test(document.querySelector('.io-msg').textContent) && ms >= 1900 && ms < 4000 && ticks >= 15, JSON.stringify({ ms, ticks, msg: document.querySelector('.io-msg').textContent.slice(0, 60) })];
  }));
  claim(RX, 'dfaq', 'On <b>a</b><b>c</b>, <b>.*</b> gives 1 match covering both, <b>.*?</b> gives 2.', 'greedy and lazy', N, async () => {
    const a = rx('<b>a</b><b>c</b>', { pattern: '<b>.*</b>', flags: 'g' }), b = rx('<b>a</b><b>c</b>', { pattern: '<b>.*?</b>', flags: 'g' });
    return [K.stat(a, 'Matches') === '1' && K.stat(b, 'Matches') === '2', K.stat(a, 'Matches') + ' / ' + K.stat(b, 'Matches')];
  });
  claim(RX, 'tip', 'In replace mode, $& is the whole match, $1 is the first group, and $<name> is a named group.', 'replacement tokens', N, async () => {
    const r = rx('ab12', { pattern: '(?<l>[a-z]+)(\\d+)', flags: 'g', view: 'replace', replacement: '[$&|$2|$<l>]' });
    return [r.output === '[ab12|12|ab]', r.output];
  });
  claim(RX, 'point', 'Each match is listed with its index, counted from 0 in UTF-16 code units', 'after an emoji the index is 2', N, async () => {
    const r = rx('😀a', { pattern: 'a', flags: 'g' }); return [/at index 2/.test(r.output), r.output];
  });
  claim(RX, 'works', 'Your pattern and flags go straight to the browser\'s RegExp constructor, and a syntax error is shown in the engine\'s own words.', 'pattern "(" gives V8\'s message', N, async () => {
    const r = rx('x', { pattern: '(' }); return [/Invalid regular expression|Unterminated group/.test(out(r) + (r.warn || '')), out(r) || r.warn];
  });

  /* ================================================================ */
  const RB = '/developer/robots-txt-generator/';
  const robots = (f) => K.gen(T('dev-robots-txt-generator.js', 'robots-txt-generator'), f);
  claim(RB, 'point', 'Block all crawlers writes User-agent: * and Disallow: / and nothing more.', 'block, with a sitemap set and AI bots allowed or blocked', N, async () => {
    const a = robots({ policy: 'block', aibots: 'allow', sitemap: 'https://shop.example/sitemap.xml' }).output, b = robots({ policy: 'block', aibots: 'block', disallow: '/admin/' }).output;
    return [a === 'User-agent: *\nDisallow: /\n' && b === a, K.j(a) + ' | ' + K.j(b)];
  });
  claim(RB, 'point', 'Allow all, except the paths below writes User-agent: *, a Disallow line for each excluded path, adding a leading / where one is missing, then Allow: /.',
    'the exact group, and an old policy=custom link', N, async () => {
      const a = robots({ policy: 'allow', disallow: 'admin/\n /cart/ \n\n', aibots: 'allow', sitemap: '' }).output, c = robots({ policy: 'custom', disallow: 'admin/\n/cart/', aibots: 'allow', sitemap: '' }).output;
      const want = 'User-agent: *\nDisallow: /admin/\nDisallow: /cart/\nAllow: /\n';
      return [a === want && c === want, K.j(a) + ' | ' + K.j(c)];
    });
  claim(RB, 'point', 'Blocking AI crawlers adds a group with Disallow: / for each of seven agents: GPTBot, CCBot, Google-Extended, anthropic-ai, ClaudeBot, PerplexityBot and Bytespider.', 'the AI agent list', N, async () => {
    const o = robots({ aibots: 'block' }).output;
    const agents = (o.match(/User-agent: ([^\n]+)/g) || []).map((x) => x.slice(12)).filter((x) => x !== '*');
    return [agents.sort().join() === ['GPTBot', 'CCBot', 'Google-Extended', 'anthropic-ai', 'ClaudeBot', 'PerplexityBot', 'Bytespider'].sort().join(), agents.join(', ')];
  });

  /* ================================================================ */
  const SL = '/developer/slug-generator/';
  const slug = (s, o) => out(K.tx(T('dev-slug-generator.js', 'slug-generator'), s, o));
  /* Hindi words and the plain-Latin spellings Indian sites use for them, written out by hand */
  const HINDI = [['नमस्ते', 'namaste'], ['भारत', 'bharat'], ['हिंदी', 'hindi'], ['हिन्दी', 'hindi'], ['दिल्ली', 'dilli'], ['कमल', 'kamal'],
    ['मुंबई', 'mumbai'], ['शिक्षा', 'shiksha'], ['ज्ञान', 'gyan'], ['प्रदेश', 'pradesh'], ['उत्तर', 'uttar'], ['मित्र', 'mitra'],
    ['धर्म', 'dharm'], ['समाचार', 'samachar'], ['गंगा', 'ganga'], ['ज़िंदगी', 'zindagi'], ['क़िला', 'qila'], ['संपर्क', 'sampark'],
    ['राष्ट्रीय', 'rashtriya'], ['ऋषि', 'rishi'], ['पुणे', 'pune'], ['चेन्नई', 'chennai'], ['कोलकाता', 'kolkata'], ['बेंगलुरु', 'bengaluru'],
    ['पटना', 'patna'], ['नागपुर', 'nagpur'], ['कानपुर', 'kanpur'], ['समझना', 'samajhna'], ['भारतीय', 'bhartiya'], ['पढ़ना', 'padhna'],
    ['कमला', 'kamla'], ['सरकार', 'sarkar'], ['अदालत', 'adalat'], ['हिंदुस्तान', 'hindustan'], ['लखनऊ', 'lakhnau'], ['बिहार', 'bihar'], ['किताब', 'kitab']];
  claim(SL, 'point', 'Devanagari is written in plain Latin first: a consonant carries a short a unless a vowel sign or the halant follows, and the a is dropped at a word’s end and between sounded syllables, so भारत becomes bharat.',
    HINDI.length + ' Hindi words against spellings written by hand', N, async () => {
      const bad = HINDI.filter(([h, l]) => slug(h) !== l).map(([h, l]) => h + ' → ' + slug(h) + ' (want ' + l + ')');
      return [!bad.length, bad.join(', ') || HINDI.length + ' words as expected'];
    });
  claim(SL, 'tip', 'नमस्ते भारत becomes namaste-bharat.', 'the tip\'s example', N, async () => { const r = slug('नमस्ते भारत'); return [r === 'namaste-bharat', r]; });
  claim(SL, 'faq', 'So भारत becomes bharat and हिंदी समाचार becomes hindi-samachar.', 'the FAQ\'s examples', N, async () => { const a = slug('भारत'), b = slug('हिंदी समाचार'); return [a === 'bharat' && b === 'hindi-samachar', a + ' | ' + b]; });
  claim(SL, 'faq', 'so समझना becomes samajhna and कोलकाता kolkata. Names with a settled English spelling can still differ: हैदराबाद becomes haidrabad, not Hyderabad', 'the FAQ examples and its stated limit', N, async () => { const r = [slug('समझना'), slug('कोलकाता'), slug('हैदराबाद')]; return [r.join() === 'samajhna,kolkata,haidrabad', r.join(', ')]; });
  claim(SL, 'point', 'Letters that are not accented ones are spelt out, ß as ss, Æ as ae and Ł as l', 'ß Æ Ł and the rest of the table', N, async () => {
    const r = slug('Straße Æsir Łódź Øresund Œuvre Þór þing Ðái Đà ı'), want = 'strasse-aesir-lodz-oresund-oeuvre-thor-thing-dai-da-i';
    return [r === want, r];
  });
  claim(SL, 'point', 'splits é into e plus an accent mark, and the marks are deleted.', 'Crème brûlée', N, async () => { const r = slug('Crème brûlée'); return [r === 'creme-brulee', r]; });
  claim(SL, 'point', 'Apostrophes, straight or curly, and backticks are removed, so don’t becomes dont, and & becomes the word and.', "don't, don’t, & and `x`", N, async () => {
    const r = slug("Don't & `x`"), c = slug('Don’t ‘quote’'); return [r === 'dont-and-x' && c === 'dont-quote', r + ' | ' + c];
  });
  claim(SL, 'tip', 'Tick German style if ä, ö and ü should become ae, oe and ue.', 'Grüße aus Köln, ticked and not', N, async () => {
    const a = slug('Grüße aus Köln, Bär', { german: 'yes' }), b = slug('Grüße aus Köln, Bär');
    return [a === 'gruesse-aus-koeln-baer' && b === 'grusse-aus-koln-bar', a + ' | ' + b];
  });
  claim(SL, 'point', 'a maximum length cuts at the last whole word that fits.', '300 titles × 5 limits against a word-by-word reference', N, async () => {
    const words = 'the quick brown fox jumps over a lazy dog in wintry weather extraordinarily'.split(' ');
    const bad = []; let tried = 0;
    for (let i = 0; i < 300; i++) {
      const t = Array.from({ length: 3 + (i % 9) }, (_, k) => words[(i * 7 + k * 3) % words.length]).join(' ');
      const full = slug(t);
      for (const max of [5, 12, 20, 33, 60]) {
        tried++;
        // reference: add whole words while they fit; a first word longer than the limit is cut inside it
        let ref = '';
        for (const w of full.split('-')) { const next = ref ? ref + '-' + w : w; if (next.length <= max) ref = next; else break; }
        if (!ref) ref = full.slice(0, max);
        const got = slug(t, { max: String(max) });
        if (got !== ref) bad.push(max + ': ' + got + ' (want ' + ref + ')');
      }
    }
    return [!bad.length, bad.slice(0, 3).join(' | ') || tried + ' cuts as the reference'];
  });
  claim(SL, 'point', 'Remove stop words drops 16 short words such as the, of and is, but only from titles longer than two words.', 'stop words', N, async () => {
    const a = slug('The history of the world is long', { stop: 'strip' }), b = slug('The End', { stop: 'strip' });
    return [a === 'history-world-long' && b === 'the-end', a + ' | ' + b];
  });
  claim(SL, 'mistake', '50% Off £20 Deals ends in 50-off-20-deals', 'the example', N, async () => { const r = slug('50% Off £20 Deals'); return [r === '50-off-20-deals', r]; });
  claim(SL, 'mistake', 'Only Latin and Devanagari are transliterated; other scripts are left out, with a warning.', 'Greek, Cyrillic, Arabic and Chinese', N, async () => {
    const r = K.tx(T('dev-slug-generator.js', 'slug-generator'), 'Ελλάδα Москва test\nمرحبا\n你好');
    return [r.output === 'test\n\n' && /Lines 2, 3 have no letters or digits/.test(r.warn || ''), K.j(r.output) + ' | ' + r.warn];
  });
  claim(SL, 'lede', 'Transliterates accented Latin letters and Hindi (Devanagari), trims to a length you set, and does many lines at once.', 'three lines in, three slugs out', N, async () => {
    const r = slug('Café One\nभारत\nA B C D E F', { max: '5' }); return [r === 'cafe\nbhara\na-b-c', K.j(r)];
  });

  /* ================================================================ */
  const UE = '/developer/url-encoder/';
  const ue = (s, o) => K.tx(T('dev-url-encoder.js', 'url-encoder'), s, o);
  claim(UE, 'point', 'Component scope uses encodeURIComponent, which escapes everything except letters, digits and - _ . ! ~ * \' ( ).', 'component of a mixed string', N, async () => {
    const s = 'a b&c=d/e?f#g;h,i:j@k+l$m-n_o.p!q~r*s\'t(u)'; const r = out(ue(s)); return [r === encodeURIComponent(s), r];
  });
  claim(UE, 'point', 'Full URL scope uses encodeURI, which also leaves ; , / ? : @ & = + $ # alone.', 'full scope', N, async () => {
    const s = 'https://x.y/a b?q=1&r=é#h'; const r = out(ue(s, { scope: 'full' })); return [r === encodeURI(s), r];
  });
  claim(UE, 'mistake', 'Full URL scope, which keeps +: q=fish+chips%20to%20go comes back as q=fish+chips to go.', 'the example, Full URL scope', N, async () => {
    const r = out(ue('q=fish+chips%20to%20go', { dir: 'dec', scope: 'full' })); return [r === 'q=fish+chips to go', r];
  });
  claim(UE, 'mistake', 'Set Treat + as space to Yes for q=fish chips to go.', 'Full URL scope, Yes', N, async () => {
    const r = out(ue('q=fish+chips%20to%20go', { dir: 'dec', scope: 'full', plus: 'yes' })); return [r === 'q=fish chips to go', r];
  });
  claim(UE, 'tip', 'decoding, Treat + as space reads each + as a space (Auto: yes in Component and Form scope, no in Full URL scope). An encoded plus, %2B, never becomes a space.', 'Auto in both scopes, %2B', N, async () => {
    // a form-encoded value, decoded by hand: + is a space, %2B a plus, %3D an equals sign
    const comp = out(ue('2+%2B+2%3D4', { dir: 'dec' }));
    const full = out(ue('https://x.example/?q=2+%2B+2', { dir: 'dec', scope: 'full' }));
    return [comp === '2 + 2=4' && full === 'https://x.example/?q=2+%2B+2', comp + ' | ' + full];
  });
  claim(UE, 'point', 'Treat + as space first turns + into spaces, by default in Component scope only.', 'the default is Auto and No keeps +', N, async () => {
    const auto = out(ue('a+b', { dir: 'dec' })), no = out(ue('a+b', { dir: 'dec', plus: 'no' })), enc = out(ue('a b'));
    return [auto === 'a b' && no === 'a+b' && enc === 'a%20b', auto + ' | ' + no + ' | ' + enc];
  });
  claim(UE, 'mistake', '100% sure is not valid encoding, and the tool stops with "Malformed percent-encoding"', 'the example', N, async () => {
    const r = ue('100% sure', { dir: 'dec' }); return [/Malformed percent-encoding/.test(r.error || ''), r.error || r.output];
  });
  claim(UE, 'dfaq', 'café ☕ becomes caf%C3%A9%20%E2%98%95: two escapes for é, three for the cup, 21 B from 9 B of input.', 'the example', N, async () => {
    const r = ue('café ☕'); return [r.output === 'caf%C3%A9%20%E2%98%95' && K.stat(r, 'Input') === '9 B' && K.stat(r, 'Output') === '21 B', r.output + ' ' + K.j(r.stats)];
  });
  claim(UE, 'dfaq', '(really) comes out as %20(really)%20', 'brackets', N, async () => { const r = out(ue(' (really) ')); return [r === '%20(really)%20', r]; });
  claim(UE, 'point', 'Form scope writes a space as + and escapes ! \' ( ) ~, as an HTML form does. Query string → table splits at & and the first =.',
    'Form scope equals URLSearchParams on 300 random strings; the table equals URLSearchParams on random query strings', N, async () => {
      let seed = 5; const rnd = ((a) => (n) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return Math.floor(((t ^ (t >>> 14)) >>> 0) / 4294967296 * n); })(seed);
      const alpha = ['a', 'Z', '9', ' ', '!', "'", '(', ')', '~', '*', '-', '_', '.', '&', '=', '+', '%', 'é', '€', '😀', '/', '?', '#', ';', ','];
      const rs = () => { let t = ''; for (let i = rnd(12); i >= 0; i--) t += alpha[rnd(alpha.length)]; return t; };
      const bad = []; let q = 0;
      for (let i = 0; i < 300; i++) {
        const s = rs();
        const got = ue(s, { scope: 'form' }).output, want = new URLSearchParams({ v: s }).toString().slice(2);
        if (s.trim() && got !== want) bad.push('form ' + K.j(s) + ' ' + got + ' vs ' + want);
        const sp = new URLSearchParams(); for (let k = rnd(5) + 1; k > 0; k--) sp.append(rs() || 'k', rs());
        const qs = '?' + sp.toString(); const r = ue(qs, { dir: 'table' });
        const rows = (r.output || '').split('\n').map((l) => l.split('\t')); const ref = [...new URLSearchParams(qs)];
        const same = rows.length === ref.length && ref.every((p, j) => rows[j] && rows[j][0] === p[0] && rows[j][1] === p[1] || /[\n\t\r]/.test(p[0] + p[1]));
        q++;
        if (!same) bad.push('table ' + qs + ' → ' + K.j(r.output));
      }
      return [bad.length === 0, bad.length ? bad.slice(0, 2).join(' | ') : '300 form strings and ' + q + ' query strings agree with URLSearchParams'];
    });
  claim(UE, 'tip', 'Each line separately encodes or decodes a list, one result per line; a line that cannot be decoded is left as typed and named.', 'three lines, the middle one malformed', N, async () => {
    const r = ue('a%20b\n100% sure\nc%2Bd', { dir: 'dec', lines: 'each' });
    const e = ue('a b\n\nc+d', { lines: 'each' });
    return [r.output === 'a b\n100% sure\nc+d' && /^Line 2 is not valid percent-encoding and was left as typed\.$/.test(r.warn || '') && e.output === 'a%20b\n\nc%2Bd', K.j(r.output) + ' | ' + (r.warn || '')];
  });
  claim(UE, 'tip', 'Query string → table splits a pasted address into names and values, marks repeated names, and Table → query string builds one back from lines of name, a tab or =, and value.', 'the table of a real address, repeated names, and the round trip', N, async () => {
    const a = ue('https://shop.example/s?q=fish+%26+chips&tag=a&tag=b&empty=&flag#top', { dir: 'table' });
    const rows = a.output.split('\n'); const dup = a.table.rows.filter((x) => x.dup).map((x) => x.value).join();
    const b = ue('https://shop.example/s\nq\tfish & chips\ntag=a\ntag=b', { dir: 'build' });
    const c = ue('q\tfish & chips\nx=1+1', { dir: 'build', scope: 'form' });
    return [rows.join('|') === 'q\tfish & chips|tag\ta|tag\tb|empty\t|flag\t' && dup === 'a,b' && a.table.hash === 'top' && a.table.base === 'https://shop.example/s'
      && b.output === 'https://shop.example/s?q=fish%20%26%20chips&tag=a&tag=b' && c.output === 'q=fish+%26+chips&x=1%2B1', K.j(rows) + ' / ' + b.output + ' / ' + c.output];
  });
  claim(UE, 'faq', 'Component is encodeURIComponent: a space becomes %20. Form is what an HTML form sends, application/x-www-form-urlencoded: a space becomes + and ! \' ( ) ~ are escaped too.', 'one string in both', N, async () => {
    const s = "a b!'()~*"; const c = out(ue(s)), f = out(ue(s, { scope: 'form' }));
    return [c === "a%20b!'()~*" && f === 'a+b%21%27%28%29%7E*', c + ' | ' + f];
  });

  /* ================================================================ */
  const UU = '/developer/uuid-generator/';
  const uuid = (f, extra) => K.gen(extra ? K.tool('dev-uuid-generator.js', 'uuid-generator', extra) : T('dev-uuid-generator.js', 'uuid-generator'), f);
  claim(UU, 'tip', 'The version 4 marker is fixed: the 13th hex digit is always 4, and the 17th is 8, 9, a or b.', '500 IDs', N, async () => {
    const ids = out(uuid({ count: 500 })).split('\n'); const bad = ids.filter((u) => { const h = u.replace(/-/g, ''); return h[12] !== '4' || '89ab'.indexOf(h[16]) < 0; });
    return [ids.length === 500 && !bad.length, bad.slice(0, 3).join(', ') || 'all v4'];
  });
  claim(UU, 'point', 'No hyphens strips the hyphens, Uppercase raises a–f, and Braces wraps each ID in { } last.', 'formats', N, async () => {
    const a = out(uuid({ count: 1, braces: 'nodash' })), b = out(uuid({ count: 1, case: 'upper', braces: 'braces' }));
    return [/^[0-9a-f]{32}$/.test(a) && /^\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\}$/.test(b), a + ' | ' + b];
  });
  claim(UU, 'point', 'The count is held between 1 and 500 per click, one ID per line.', 'count 0 and 1000', N, async () => {
    const lo = out(uuid({ count: 0 })).split('\n').length, hi = out(uuid({ count: 1000 })).split('\n').length; return [lo === 1 && hi === 500, lo + ' / ' + hi];
  });
  claim(UU, 'works', 'A version 4 ID comes from the browser\'s crypto.randomUUID(), which draws on the operating system\'s secure random source.', 'randomUUID is called', N, async () => {
    let n = 0; const wc = require('crypto').webcrypto;
    const r = uuid({ count: 3 }, { crypto: { randomUUID: () => { n++; return wc.randomUUID(); }, getRandomValues: (a) => wc.getRandomValues(a) } });
    return [n === 3, 'randomUUID called ' + n + ' times; Source row: ' + K.stat(r, 'Source')];
  });
  claim(UU, 'point', 'Where that is missing, 16 bytes from crypto.getRandomValues are used with the version and variant bits set by hand; the Source row names getRandomValues either way.',
    'without randomUUID: getRandomValues, valid v4; Source row', N, async () => {
      let n = 0; const wc = require('crypto').webcrypto;
      const r = uuid({ count: 5 }, { crypto: { getRandomValues: (a) => { n++; return wc.getRandomValues(a); } } });
      const ok = out(r).split('\n').every((u) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(u));
      return [n >= 5 && ok && /getRandomValues/.test(K.stat(r, 'Source') || ''), n + ' calls, valid ' + ok + ', Source ' + K.stat(r, 'Source')];
    });
  claim(UU, 'point', 'Only if neither exists does it fall back to Math.random, which is not cryptographically secure', 'with no crypto at all, Math.random', N, async () => {
    const r = uuid({ count: 2 }, { crypto: undefined }); return [/Math\.random/.test(K.stat(r, 'Source') || '') && out(r).split('\n').length === 2, K.stat(r, 'Source')];
  });
  const uuFixed = Date.UTC(2024, 4, 17, 12, 30, 45, 123);
  class UuDate extends Date { static now() { return uuFixed; } }
  const uuf = (f) => K.gen(K.tool('dev-uuid-generator.js', 'uuid-generator', { Date: UuDate }), f);
  claim(UU, 'tip', 'Random IDs make poor primary keys in large tables because the index fragments. UUID v7 and ULID start with the time, so new rows land together and a batch sorts in the order it was made.',
    'a batch of 500 v7 IDs and 500 ULIDs made in one millisecond is already in sorted order, and starts with the clock', N, async () => {
      const v7 = out(uuf({ kind: 'v7', count: 500 })).split('\n'), ul = out(uuf({ kind: 'ulid', count: 500 })).split('\n');
      const sorted = (a) => a.every((x, i) => i === 0 || x > a[i - 1]);
      return [sorted(v7) && sorted(ul) && parseInt(v7[0].replace(/-/g, '').slice(0, 12), 16) === uuFixed, v7[0] + ' … ' + v7[499] + ' | ' + ul[0] + ' … ' + ul[499]];
    });
  claim(UU, 'point', 'Version 7 and ULID put the clock first and count up within a millisecond, so a batch sorts in the order it was made. Version 1 uses a random node, never your network address.',
    'v7 layout and counter; v1: one random node per batch with the multicast bit set', N, async () => {
      const v7 = out(uuf({ kind: 'v7', count: 3 })).split('\n'), v1 = out(uuf({ kind: 'v1', count: 40 })).split('\n');
      const nodes = v1.map((u) => u.replace(/-/g, '').slice(20));
      const mc = v1.every((u) => (parseInt(u.replace(/-/g, '').slice(20, 22), 16) & 1) === 1);
      const sameNode = new Set(nodes).size === 1;
      return [/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab]/.test(v7[0]) && v7[1] > v7[0] && mc && sameNode, v7[0] + ' | node ' + nodes[0] + ' multicast bit set ' + mc];
    });
  claim(UU, 'point', 'Check IDs reads each line as a UUID of any version or a ULID and gives the version, variant and any time.',
    'RFC 9562 appendix vectors read as their versions and times; a bad variant, a version 9 and wrong lengths are named', N, async () => {
      const r = out(uuf({ mode: 'check', ids: 'C232AB00-9414-11EC-B3C8-9F6BDECED846\n017F22E2-79B0-7CC3-98C4-DC0C0C07398F\n919108f7-52d1-4320-9bac-f847db4148a8\n12345678-1234-9234-8234-123456789012\n12345678-1234-1234-c234-123456789012\n12345' }));
      return [/version 1, RFC 9562 variant \(time-based\), made 2022-02-22T19:22:22\.000Z/.test(r) && /version 7, RFC 9562 variant \(Unix-time ordered\), made 2022-02-22T19:22:22\.000Z/.test(r) && /version 4, RFC 9562 variant \(random\)/.test(r) && /version digit is 9/.test(r) && /variant digit c/.test(r) && /has 5 hex digits/.test(r), r.split('\n').filter((l) => /[✓✗]/.test(l)).join(' | ')];
    });
  claim(UU, 'tip', 'Check IDs reads any UUID version, with or without hyphens or braces, and a ULID, and for v1, v6, v7 and ULID says when it was made.', 'hyphens, none, braces and urn: all read; the ULID time; v6', N, async () => {
    const r = out(uuf({ mode: 'check', ids: '017f22e279b07cc398c4dc0c0c07398f\n{017F22E2-79B0-7CC3-98C4-DC0C0C07398F}\nurn:uuid:017F22E2-79B0-7CC3-98C4-DC0C0C07398F\n01ARZ3NDEKTSV4RRFFQ69G5FAV\n1EC9414C-232A-6B00-B3C8-9F6BDECED846' }));
    return [(r.match(/made 2022-02-22T19:22:22\.000Z/g) || []).length === 4 && /ULID, made 2016-07-30T23:54:10\.259Z/.test(r), r.split('\n').filter((l) => /[✓✗]/.test(l)).join(' | ')];
  });
  claim(UU, 'tip', 'A nanoid is shorter (21 characters by default) and URL-safe; a custom alphabet is allowed, with ranges such as a-z0-9.', '21 URL-safe characters; a-z0-9 and length 8', N, async () => {
    const a = out(uuf({ kind: 'nano', count: 20 })).split('\n'), b = out(uuf({ kind: 'nano', count: 20, size: 8, alphabet: 'a-z0-9' })).split('\n');
    return [a.every((x) => /^[A-Za-z0-9_-]{21}$/.test(x)) && b.every((x) => /^[a-z0-9]{8}$/.test(x)), a[0] + ' | ' + b[0]];
  });
  claim(UU, 'faq', 'Not here. The node part is random with the multicast bit set, as RFC 9562 allows, so no network address is read. The time in it is the time you generated it.', 'node bytes differ between batches and always carry the multicast bit; the time is the clock', N, async () => {
    const a = out(uuf({ kind: 'v1', count: 2 })).split('\n'), b = out(uuf({ kind: 'v1', count: 2 })).split('\n');
    const node = (u) => u.replace(/-/g, '').slice(20);
    return [node(a[0]) !== node(b[0]) && (parseInt(node(a[0]).slice(0, 2), 16) & 1) === 1 && (parseInt(node(b[0]).slice(0, 2), 16) & 1) === 1, node(a[0]) + ' vs ' + node(b[0])];
  });
  claim(UU, 'tip', 'Version 4 UUIDs carry 122 random bits.', 'the Random bits row says 122', N, async () => { const r = uuid({ count: 1 }); return [K.stat(r, 'Random bits') === '122', K.stat(r, 'Random bits')]; });

  /* ================================================================ */
  const XF = '/developer/xml-formatter/';
  const xml = (s, o) => K.tx(T('dev-xml-formatter.js', 'xml-formatter'), s, o);
  claim(XF, 'point', 'It checks names, quoted attributes, comments, CDATA, the declaration, entities, character references, namespace prefixes and the single root. It does not check a DTD or XSD.',
    'each rule refuses its own fault, with its place; a valid document using all of them passes', N, async () => {
      const bad = {
        'name': ['<1a/>', /cannot start a tag name/], 'quotes': ['<a x=1/>', /must be in quotes/], 'duplicate': ['<a x="1" x="2"/>', /appears twice/],
        'comment': ['<a><!-- a -- b --></a>', /cannot contain --/], 'cdata': ['<a><![CDATA[x</a>', /never closed/], 'declaration': ['<?xml version="1.0" encoding="UTF-8" standalone="maybe"?><a/>', /declaration is malformed/],
        'entity': ['<a>&nbsp;</a>', /&nbsp; is not defined/], 'charref': ['<a>&#0;</a>', /not a character XML allows/], 'prefix': ['<p:a/>', /prefix "p" is not declared/], 'root': ['<a/><b/>', /only one root element/], 'late text': ['<a/>x', /Text after the root/]
      };
      const miss = Object.keys(bad).filter((k) => { const r = xml(bad[k][0]); return !(bad[k][1].test(r.error || '') && /\(line 1, column \d+\)$/.test(r.error || '')); });
      const ok = xml('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><!DOCTYPE a [<!ENTITY co "x">]><!-- c --><a xmlns:p="urn:p" p:k="1"><p:b>&co;&#233;&#x20AC;&amp;</p:b><![CDATA[<raw>]]><?pi go?></a>');
      return [!miss.length && !ok.error, miss.length ? 'not refused: ' + miss.join(', ') : 'all eleven refused with a line and column; the full document passes' + (ok.error ? ' BUT ' + ok.error : '')];
    });
  claim(XF, 'point', 'An end tag must match the open tag exactly, case included, or the pair is named.', '<b></B>', N, async () => {
    const r = xml('<a><b></B></a>'); return [/<b>/.test(r.error || '') && /<\/B>/.test(r.error || '') && /line 1, column 7/.test(r.error || ''), r.error || 'accepted'];
  });
  claim(XF, 'point', 'Formatting puts each node on its own line, indented by depth. An element that mixes text and tags, or has xml:space="preserve", is printed exactly as written.',
    'the Teapot example keeps its line; an xml:space element is untouched; deep nodes indent by depth', N, async () => {
      const a = out(xml('<r><title>Teapot <b>new</b></title><x/></r>'));
      const b = out(xml('<r><pre xml:space="preserve">  a\n   <i>b</i> </pre><y/></r>'));
      const c = out(xml('<a><b><c>1</c><!-- n --><d/></b></a>', { indent: '4' }));
      return [a === '<r>\n  <title>Teapot <b>new</b></title>\n  <x/>\n</r>' && b === '<r>\n  <pre xml:space="preserve">  a\n   <i>b</i> </pre>\n  <y/>\n</r>' && c === '<a>\n    <b>\n        <c>1</c>\n        <!-- n -->\n        <d/>\n    </b>\n</a>', K.j([a, b, c])];
    });
  claim(XF, 'point', 'Minifying drops whitespace between tags and, if you choose, comments. XPath 1.0 queries run in your browser’s own engine.',
    'Minified with Comments removed; the XPath result in Chrome equals the browser\'s own evaluate()', B, async () => {
      const m = out(xml('<a>\n  <!-- c -->\n  <b x = "1"> t </b>\n</a>', { mode: 'minify', comments: 'strip' }));
      const p = await K.open(XF);
      try {
        await p.evaluate(() => { Object.keys(localStorage).filter((k) => /xml/.test(k)).forEach((k) => localStorage.removeItem(k)); });
        await p.reload({ waitUntil: 'load' });
        const doc = '<shop xmlns:t="urn:t"><item id="1" t:x="a"><name>Tea</name></item><item id="2"><name>Cake &amp; tea</name></item></shop>';
        await p.evaluate((t) => { const a = document.querySelector('textarea.code-area'); a.value = t; a.dispatchEvent(new Event('input', { bubbles: true })); const x = document.getElementById('f-xpath'); x.value = "//item[@id='2']/name"; x.dispatchEvent(new Event('input', { bubbles: true })); }, doc);
        await p.waitForFunction(() => document.querySelector('.xp-sum'), { timeout: 10000 });
        const r = await p.evaluate(() => ({ sum: document.querySelector('.xp-sum').textContent, path: (document.querySelector('.xp-path') || {}).textContent, val: (document.querySelector('.xp-val') || {}).textContent }));
        await p.evaluate(() => { const x = document.getElementById('f-xpath'); x.value = 'count(//item)'; x.dispatchEvent(new Event('input', { bubbles: true })); });
        await K.sleep(500);
        const n = await p.evaluate(() => document.querySelector('.xp-sum').textContent);
        await p.evaluate(() => { const x = document.getElementById('f-xpath'); x.value = '//item['; x.dispatchEvent(new Event('input', { bubbles: true })); });
        await K.sleep(500);
        const bad = await p.evaluate(() => document.querySelector('.xp-body').textContent);
        const okVal = /Cake &amp; tea/.test(r.val);
        return [m === '<a><b x="1"> t </b></a>' && r.sum === '1 match' && r.path === '/shop/item[2]/name' && okVal && n === 'A number: 2' && /^XPath error/.test(bad), m + ' | ' + K.j(r) + ' | ' + n + ' | ' + bad.slice(0, 40)];
      } finally { await p.close(); }
    });
  claim(XF, 'mistake', 'Using HTML entity names in XML. Only &amp;, &lt;, &gt;, &quot; and &apos; are predefined, so &nbsp; is an error unless a DOCTYPE defines it; write &#160; instead.',
    '&nbsp; is refused; with a DOCTYPE entity it passes; &#160; passes', N, async () => {
      const a = xml('<p>a&nbsp;b</p>'), b = xml('<!DOCTYPE p [<!ENTITY nbsp "&#160;">]><p>a&nbsp;b</p>'), c = xml('<p>a&#160;b</p>');
      return [/&nbsp; is not defined/.test(a.error || '') && !b.error && !c.error, (a.error || 'ok').slice(0, 40) + ' | ' + (b.error || 'ok') + ' | ' + (c.error || 'ok')];
    });
  claim(XF, 'mistake', 'Minifying mixed content. Whitespace between tags is removed, so <b>fish</b> <i>chips</i> becomes <b>fish</b><i>chips</i>.', 'minify mixed content', N, async () => {
    const r = out(xml('<p><b>fish</b> <i>chips</i></p>', { mode: 'minify' })); return [r === '<p><b>fish</b><i>chips</i></p>', r];
  });
  claim(XF, 'dfaq', 'It is optional for UTF-8, must come first if present, and is kept in place here.', 'declaration kept first; one that is not first is refused', N, async () => {
    const r = out(xml('<?xml version="1.0"?><a><b>1</b></a>')); const late = xml(' <?xml version="1.0"?><a/>');
    return [/^<\?xml version="1\.0"\?>/.test(r) && !!late.error, r.split('\n')[0] + ' | ' + (late.error || 'accepted')];
  });
  claim(XF, 'dfaq', 'Only the whitespace between tags is replaced by line breaks and indentation. Text inside elements and attribute values are left alone.', 'text and attributes unchanged', N, async () => {
    const r = out(xml('<a x="1  2"><b>  keep  me  </b></a>')); return [/x="1  2"/.test(r) && />  keep  me  </.test(r), K.j(r)];
  });

  /* ================================================================ */
  const FG = '/developer/favicon-generator/';
  const favicons = async (draw, w, h, bg, name) => {
    const p = await K.open(FG);
    try {
      await favFresh(p);
      const f = K.write('fav-src.png', await K.img.makePng(p, w, h, draw));
      if (bg) await p.evaluate((v) => { const i = [...document.querySelectorAll('.tool-io input[type=color], .tool-io input')].find((x) => /colou?r|background/i.test((x.id || '') + (x.getAttribute('aria-label') || '') + (x.name || ''))); if (i) { i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); } }, bg);
      if (name) await p.evaluate((v) => { const i = document.getElementById('f-appname'); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, name);
      const input = await p.$('.tool-io input[type=file]'); await input.uploadFile(f);
      /* the icons are shown as the canvases they were drawn on, one card each */
      await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8, { timeout: 30000 });
      await K.sleep(300);
      const icons = await p.$$eval('.tool-io .file-results canvas', (l) => l.map((c) => {
        const x = c.getContext('2d'); const px = (a, b2) => Array.from(x.getImageData(a, b2, 1, 1).data);
        const card = c.closest('.file-card');
        return { w: c.width, h: c.height, corner: px(0, 0), mid: px(Math.floor(c.width / 2), Math.floor(c.height / 2)), top: px(Math.floor(c.width / 2), 1), cap: card ? card.textContent : '' };
      }));
      const text = await p.evaluate(() => document.querySelector('.tool-io').innerText);
      return { p, icons, text };
    } catch (e) { await p.close(); throw e; }
  };
  claim(FG, 'point', 'Eight PNGs are made: 16, 32, 48 and 96 pixel favicons, a 180 pixel apple-touch-icon, 192 and 512 pixel app icons and a 512 pixel maskable icon with a 10% margin.',
    'eight PNG sizes; the maskable one has a 10% margin', B, async () => {
      const r = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 600);
      try {
        await K.clearDownloads(r.p);
        await K.clickText(r.p, '.tool-io button', /as ZIP/);
        await r.p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
        const [zip] = await K.downloads(r.p);
        const entries = K.zipNames(zip.bytes).filter((e) => /\.png$/.test(e.name)).map((e) => ({ name: e.name, png: K.isPng(e.data), w: K.isPng(e.data) ? e.data.readUInt32BE(16) : 0 }));
        const sizes = entries.map((e) => e.w).sort((a, b) => a - b).join(',');
        const mask = r.icons.find((i) => /maskable/i.test(i.cap));
        /* 10% margin: on a 512 icon the red starts about 51 px in */
        const margin = mask ? await r.p.evaluate(() => { const c = [...document.querySelectorAll('.tool-io .file-results canvas')].find((x) => /maskable/i.test(x.closest('.file-card').textContent)); const d = c.getContext('2d').getImageData(0, 256, 256, 1).data; for (let i = 0; i < 256; i++) if (d[i * 4] > 150 && d[i * 4 + 1] < 80) return i; return -1; }) : -1;
        return [zip.name === 'favicons.zip' && entries.length === 8 && entries.every((e) => e.png) && sizes === '16,32,48,96,180,192,512,512' && margin >= 49 && margin <= 53,
          zip.name + ': ' + entries.map((e) => e.name + ' ' + e.w).join(', ') + '; maskable logo starts ' + margin + ' px in'];
      } finally { await r.p.close(); }
    });
  claim(FG, 'point', 'The source is scaled to fit the square and centred, never cropped, so a wide logo gets bars above and below.', 'a 600×200 red logo: white bars top and bottom', B, async () => {
    const r = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 200);
    try {
      const i = r.icons.find((x) => x.w === 192);
      return [i && i.top[0] > 240 && i.top[1] > 240 && i.mid[0] > 150 && i.mid[1] < 60, i ? 'top ' + K.j(i.top) + ' middle ' + K.j(i.mid) : 'no 192 icon'];
    } finally { await r.p.close(); }
  });
  claim(FG, 'point', 'Every canvas is filled with the background colour first, white by default, so transparent areas come out solid.', 'a transparent logo gives opaque white corners', B, async () => {
    const r = await favicons("x.clearRect(0,0,w,h);x.fillStyle='#00c';x.fillRect(200,200,200,200);", 600, 600);
    try { const i = r.icons.find((x) => x.w === 192); return [i.corner[3] === 255 && i.corner[0] > 245, K.j(i.corner)]; } finally { await r.p.close(); }
  });
  /* the ZIP, opened: PNG sizes, the icons inside favicon.ico, the manifest, and every href in the snippet */
  const favZip = async (r) => {
    await K.clearDownloads(r.p);
    await K.clickText(r.p, '.tool-io button', /as ZIP/);
    await r.p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
    const [zip] = await K.downloads(r.p);
    const entries = K.zipNames(zip.bytes);
    const get = (n) => (entries.find((e) => e.name === n) || {}).data;
    const ico = get('favicon.ico');
    let icoSizes = 'none';
    if (ico && ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1) {
      const n = ico.readUInt16LE(4), s = [];
      for (let i = 0; i < n; i++) {
        const at = 6 + 16 * i, len = ico.readUInt32LE(at + 8), off = ico.readUInt32LE(at + 12), png = ico.slice(off, off + len);
        s.push(ico[at] + (K.isPng(png) && png.readUInt32BE(16) === ico[at] ? '' : '(bad)'));
      }
      icoSizes = s.join(',');
    }
    let manifest = null;
    try { manifest = JSON.parse(get('site.webmanifest').toString('utf8')); } catch (e) { /* stays null */ }
    const snippet = await r.p.evaluate(() => (document.querySelector('.tool-io pre.code-out') || {}).textContent || '');
    const hrefs = (snippet.match(/href="\/([^"]+)"/g) || []).map((h) => h.slice(7, -1));
    const srcs = manifest ? manifest.icons.map((i) => i.src.replace(/^\//, '')) : [];
    return { names: entries.map((e) => e.name).sort(), icoSizes, manifest, hrefs, srcs };
  };
  claim(FG, 'point', 'favicon.ico, holding the 16, 32 and 48 pixel PNGs, and site.webmanifest make ten files in favicons.zip, and the snippet links only those.',
    'ten files; the ICO holds 16/32/48 PNGs; snippet and manifest name exactly the ZIP', B, async () => {
      const r = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 600);
      try {
        const z = await favZip(r);
        const named = [...new Set(z.hrefs.concat(z.srcs))].sort();
        const ok = z.names.length === 10 && z.icoSizes === '16,32,48' && z.hrefs.every((h) => z.names.indexOf(h) >= 0) && JSON.stringify(named) === JSON.stringify(z.names)
          && z.srcs.join() === 'icon-192.png,icon-512.png,icon-maskable-512.png' && z.manifest.icons[2].purpose === 'maskable';
        return [ok, z.names.length + ' files; ico ' + z.icoSizes + '; snippet ' + z.hrefs.join(' ') + '; manifest ' + z.srcs.join(' ')];
      } finally { await r.p.close(); }
    });
  claim(FG, 'tip', 'A smaller image is scaled up to fill the larger icons, and those will look soft; the tool names every size it had to enlarge.', 'a 64 px source fills the 512 icon, and the warning lists 96 to 512', B, async () => {
    const r = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 64, 64);
    try {
      const i = r.icons.find((x) => x.w === 512 && !/maskable/i.test(x.cap));
      const up = i && i.corner[0] > 150 && i.corner[1] < 60;
      const warning = (r.text.match(/Your source[^\n]*/) || [''])[0];
      const named = /scaled up to make the 96 px, 180 px, 192 px, 512 px and maskable 512 px icons/.test(warning) && !/ 48 px/.test(warning);
      return [up && named, (up ? 'the 64 px picture fills the 512 px icon' : 'not scaled up') + '; ' + ((r.text.match(/Your source[^\n]*/) || ['no warning'])[0]).slice(0, 160)];
    } finally { await r.p.close(); }
  });
  claim(FG, 'point', 'Icons bigger than your image are scaled up from it, and the tool names each one.', '300×200 names only the two 512s; 600×200 names none', B, async () => {
    const a = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 300, 200);
    let ta; try { ta = a.text; } finally { await a.p.close(); }
    const b = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 200);
    let tb; try { tb = b.text; } finally { await b.p.close(); }
    const ok = /scaled up to make the 512 px and maskable 512 px icons/.test(ta) && !/scaled up/.test(tb);
    return [ok, ((ta.match(/Your source[^\n]*/) || ['300×200: no warning'])[0]).slice(0, 120) + ' | 600×200: ' + (/scaled up/.test(tb) ? 'warned' : 'no warning')];
  });
  claim(FG, 'mistake', 'Leaving the site name blank: site.webmanifest then has no name', 'blank: no name; typed: name and short_name', B, async () => {
    const a = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 600);
    let za; try { za = await favZip(a); } finally { await a.p.close(); }
    const b = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 600, null, 'Ashworth Joinery');
    let zb; try { zb = await favZip(b); } finally { await b.p.close(); }
    const ok = za.manifest && !('name' in za.manifest) && zb.manifest && zb.manifest.name === 'Ashworth Joinery' && zb.manifest.short_name === 'Ashworth Joinery';
    return [ok, 'blank: ' + K.j(za.manifest && za.manifest.name) + ', typed: ' + K.j(zb.manifest && zb.manifest.name)];
  });

  /* ---- Text, Emoji, SVG, dark mode, prefix, tab preview ---- */
  /* settings are remembered on the device, so every claim starts from empty storage */
  const favFresh = async (p) => { await p.evaluate(() => { localStorage.removeItem('1234tools-dev:favicon-generator'); Object.keys(localStorage).filter((k) => /favicon/.test(k)).forEach((k) => localStorage.removeItem(k)); }); await p.reload({ waitUntil: 'load' }); await K.sleep(400); };
  const favText = async (setup) => {
    const p = await K.open(FG);
    try {
      await favFresh(p);
      await K.clickText(p, '.fav-modes button', /^Text$/);
      await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8 && document.querySelector('.file-results').textContent.indexOf('favicon.svg') > -1, { timeout: 30000 });
      if (setup) { await setup(p); await K.sleep(900); await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8, { timeout: 30000 }); }
      return p;
    } catch (e) { await p.close(); throw e; }
  };
  const favZip2 = async (p) => {
    await K.clearDownloads(p);
    await K.clickText(p, '.tool-io button', /as ZIP/);
    await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
    const [zip] = await K.downloads(p);
    const entries = K.zipNames(zip.bytes);
    const get = (n) => (entries.find((e) => e.name === n) || {}).data;
    return { names: entries.map((e) => e.name).sort(), get };
  };
  const typeInto = (p, sel, v) => p.evaluate((sel, v) => { const i = document.querySelector(sel); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
  /* the SVG, drawn by Chrome's SVG renderer, against the canvas icon drawn by the page's own code */
  const svgVsCanvas = (p, svgText, size) => p.evaluate(async (svgText, size) => {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); });
    const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, 0, 0, size, size);
    const a = c.getContext('2d').getImageData(0, 0, size, size).data;
    const card = [...document.querySelectorAll('.tool-io .file-results canvas')].find((x) => x.width === size && !/maskable/i.test(x.closest('.file-card').textContent) && !/apple/i.test(x.closest('.file-card').textContent));
    const b = card.getContext('2d').getImageData(0, 0, size, size).data;
    let d = 0; for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return d / (a.length / 4) / 3;
  }, svgText, size);
  claim(FG, 'point', 'Text and Emoji are drawn afresh at every size, and add favicon.svg, which can switch to dark-mode colours.',
    'Text: ten PNG/ICO/manifest files plus favicon.svg; the SVG equals the 96 px icon; dark colours only when ticked', B, async () => {
      const p = await favText();
      try {
        const z = await favZip2(p);
        const svg = z.get('favicon.svg').toString('utf8');
        const plainOk = z.names.length === 11 && /<svg /.test(svg) && svg.indexOf('prefers-color-scheme') < 0 && /@font-face/.test(svg);
        const diff = await svgVsCanvas(p, svg, 96);
        await p.click('.fav-src input[type=checkbox]');
        await K.sleep(900);
        await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8, { timeout: 30000 });
        const z2 = await favZip2(p);
        const svg2 = z2.get('favicon.svg').toString('utf8');
        const darkOk = /@media \(prefers-color-scheme:dark\)\{\.t\{fill:#ffffff\}\.b\{fill:#0f172a\}\}/.test(svg2);
        const sameIcon = z.get('favicon-32x32.png').equals(z2.get('favicon-32x32.png'));
        return [plainOk && diff < 12 && darkOk && sameIcon, z.names.length + ' files; SVG vs 96 px canvas mean difference ' + diff.toFixed(2) + '/255; dark block ' + darkOk + '; PNG unchanged by dark colours ' + sameIcon];
      } finally { await p.close(); }
    });
  claim(FG, 'tip', 'Dark-mode colours go into the SVG favicon only.', 'ticking dark mode changes favicon.svg, not the PNGs, ICO or manifest', B, async () => {
    const p = await favText();
    try {
      const a = await favZip2(p);
      await p.click('.fav-src input[type=checkbox]');
      await K.sleep(900);
      await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8, { timeout: 30000 });
      const b = await favZip2(p);
      const same = ['favicon-16x16.png', 'favicon-512x512.png'.replace('favicon-512x512', 'icon-512'), 'apple-touch-icon.png', 'favicon.ico', 'site.webmanifest'].every((n) => a.get(n).equals(b.get(n)));
      const svgA = a.get('favicon.svg').toString('utf8'), svgB = b.get('favicon.svg').toString('utf8');
      return [same && svgA !== svgB && svgA.indexOf('prefers-color-scheme') < 0 && svgB.indexOf('prefers-color-scheme') > 0, 'raster files identical: ' + same + '; svg changed: ' + (svgA !== svgB)];
    } finally { await p.close(); }
  });
  claim(FG, 'tip', 'Text and Emoji are drawn afresh at every size, so even the 16×16 icon is crisp.', 'a 16 px text icon holds the letter: the white letter covers a similar share of the tile at 16 and 512', B, async () => {
    const p = await favText((q) => typeInto(q, '.fav-src input[type=text]', 'M'));
    try {
      const share = await p.evaluate(() => [16, 512].map((n) => {
        const c = [...document.querySelectorAll('.tool-io .file-results canvas')].find((x) => x.width === n && !/maskable/i.test(x.closest('.file-card').textContent));
        const d = c.getContext('2d').getImageData(0, 0, n, n).data; let w = 0, t = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { t++; if (d[i] > 160 && d[i + 1] > 160) w++; }
        return w / t;
      }));
      return [Math.abs(share[0] - share[1]) < 0.08 && share[0] > 0.15, 'letter share of the tile at 16 px ' + share[0].toFixed(2) + ', at 512 px ' + share[1].toFixed(2)];
    } finally { await p.close(); }
  });
  claim(FG, 'tip', 'The maskable icon keeps your text or image inside the middle 80%.', 'the maskable text icon: no letter pixel outside the middle 80%', B, async () => {
    const p = await favText((q) => typeInto(q, '.fav-src input[type=text]', 'WWW'));
    try {
      const box = await p.evaluate(() => {
        const c = [...document.querySelectorAll('.tool-io .file-results canvas')].find((x) => /maskable/i.test(x.closest('.file-card').textContent));
        const n = c.width, d = c.getContext('2d').getImageData(0, 0, n, n).data; let x0 = n, x1 = 0, y0 = n, y1 = 0;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = (y * n + x) * 4; if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        return [x0 / n, x1 / n, y0 / n, y1 / n];
      });
      return [box[0] >= 0.1 && box[1] <= 0.9 && box[2] >= 0.1 && box[3] <= 0.9, 'letters span ' + box.map((v) => v.toFixed(2)).join(' ')];
    } finally { await p.close(); }
  });
  claim(FG, 'faq', 'It sets where the files will live on your site.', 'prefix /assets/icons/ appears in every snippet link and every manifest icon', B, async () => {
    const p = await favText((q) => typeInto(q, '#fav-prefix', '/assets/icons'));
    try {
      const snippet = await p.evaluate(() => document.querySelector('.tool-io pre.code-out').textContent);
      const z = await favZip2(p);
      const m = JSON.parse(z.get('site.webmanifest').toString('utf8'));
      const hrefs = snippet.match(/href="[^"]+"/g);
      const ok = hrefs.every((h) => h.indexOf('href="/assets/icons/') === 0) && m.icons.every((i) => i.src.indexOf('/assets/icons/') === 0) && /favicon\.svg/.test(snippet);
      return [ok, hrefs.join(' ') + ' | ' + m.icons.map((i) => i.src).join(' ')];
    } finally { await p.close(); }
  });
  claim(FG, 'faq', 'Those can be written as vector shapes.', 'a PNG upload gives no favicon.svg; an SVG upload comes back unchanged', B, async () => {
    const a = await favicons("x.fillStyle='#c00';x.fillRect(0,0,w,h);", 600, 600);
    let za; try { za = await favZip(a); } finally { await a.p.close(); }
    const p = await K.open(FG);
    try {
      await favFresh(p);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#0a0"/></svg>';
      const f = K.write('fav-src.svg', Buffer.from(svg));
      const input = await p.$('.tool-io input[type=file]'); await input.uploadFile(f);
      await p.waitForFunction(() => document.querySelector('.file-results').textContent.indexOf('favicon.svg') > -1, { timeout: 30000 });
      const z = await favZip2(p);
      const out = z.get('favicon.svg').toString('utf8');
      const snippet = await p.evaluate(() => document.querySelector('.tool-io pre.code-out').textContent);
      return [za.names.indexOf('favicon.svg') < 0 && out === svg && /type="image\/svg\+xml"/.test(snippet), 'PNG upload: ' + za.names.length + ' files, none an SVG; SVG upload returned unchanged: ' + (out === svg)];
    } finally { await p.close(); }
  });
  claim(FG, 'faq', 'the five fonts for the Text source are served from this site, only once you choose Text.', 'no font is requested until Text is chosen; then one font from this origin', B, async () => {
    const p = await K.open(FG);
    try {
      await favFresh(p);
      const font = () => p.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /favicon-fonts/.test(n)));
      const before = await font();
      await K.clickText(p, '.fav-modes button', /^Text$/);
      await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8, { timeout: 30000 });
      const after = await font();
      const off = await p.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.indexOf(location.origin) !== 0 && !/^data:|^blob:/.test(n)));
      return [before.length === 0 && after.length === 1 && off.length === 0, 'before: ' + before.length + ', after: ' + after.join(' ') + '; off-site: ' + off.length];
    } finally { await p.close(); }
  });
  claim(FG, 'tip', 'Text and Emoji are drawn afresh at every size, so even the 16×16 icon is crisp.', 'the Emoji source makes the same set with an emoji and its SVG carries the emoji as text', B, async () => {
    const p = await K.open(FG);
    try {
      await favFresh(p);
      await K.clickText(p, '.fav-modes button', /^Emoji$/);
      await p.waitForFunction(() => document.querySelectorAll('.tool-io .file-results canvas').length >= 8 && document.querySelector('.file-results').textContent.indexOf('favicon.svg') > -1, { timeout: 30000 });
      const z = await favZip2(p);
      const svg = z.get('favicon.svg').toString('utf8');
      const filled = await p.evaluate(() => { const c = [...document.querySelectorAll('.tool-io .file-results canvas')].find((x) => x.width === 192); const d = c.getContext('2d').getImageData(0, 0, 192, 192).data; let colour = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && !(Math.abs(d[i] - 29) < 8 && Math.abs(d[i + 1] - 78) < 8 && Math.abs(d[i + 2] - 216) < 8)) colour++; return colour; });
      return [z.names.length === 11 && svg.indexOf('🚀') > -1 && filled > 500, z.names.length + ' files; svg holds the emoji: ' + (svg.indexOf('🚀') > -1) + '; ' + filled + ' non-tile pixels in the 192 icon'];
    } finally { await p.close(); }
  });
  claim(FG, 'tip', 'Dark-mode colours go into the SVG favicon only.', 'the page previews the icon in a light and a dark mock tab, with the site name', B, async () => {
    const p = await favText();
    try {
      await typeInto(p, '#f-appname', 'Ashworth Joinery'); await K.sleep(900);
      const r = await p.evaluate(() => ({ tabs: document.querySelectorAll('.fav-tab').length, imgs: [...document.querySelectorAll('.fav-ico')].filter((i) => i.complete && i.naturalWidth > 0).length, titles: [...document.querySelectorAll('.fav-tab-title')].map((t) => t.textContent) }));
      return [r.tabs === 2 && r.imgs === 2 && r.titles.every((t) => t === 'Ashworth Joinery'), K.j(r)];
    } finally { await p.close(); }
  });

  /* ---------- manual ---------- */
  manual(CO, 'tip', 'WCAG AA needs 4.5:1 for body text and 3:1 for large text (18pt, or 14pt bold). AAA raises these to 7:1 and 4.5:1.', 'WCAG 2 thresholds; check against the W3C text (the grading itself is checked above).');
  manual(HG, 'tip', 'MD5 has been collision-broken since 2004 and SHA-1 since 2017.', 'Cryptography history; needs sources.');
  manual('/developer/htaccess-generator/', 'tip', 'most browsers will not save a file whose name starts with a dot: Chrome and Edge save htaccess.txt',
    'browser download naming; build/tests/dev-fixes.js (14, 15) runs it in Chrome: the page asks for .htaccess and Chrome saves htaccess.txt. Edge is the same Chromium code; not run here.');
  manual(RB, 'faq', 'Blocking Google-Extended opts you out of Gemini training without affecting Google Search crawling or ranking', 'Google policy; needs Google\'s documentation with a date.');
  manual(RB, 'dfaq', 'Crawlers must read at least the first 500 kibibytes under RFC 9309, and Google ignores anything beyond that.', 'RFC 9309 and Google documentation.');
  manual(GR, 'dfaq', 'Chrome and Edge 111, Safari 16.2 and Firefox 127 onwards.', 'Browser support for colour-interpolation in gradients; needs MDN / caniuse with a date. That an unreadable declaration falls back to the line above is CSS error handling, checked by the fallback claims above.');
  manual(UU, 'tip', 'You would need to generate about 2.7 × 10¹⁸ of them before a collision became likely.', 'Birthday-bound arithmetic (sqrt(2^122 · ln 2) ≈ 2.7e18 for 50%); a maths check, not a tool run.');
  manual(MT, 'tip', 'Google typically shows around 60 characters of a title and 155–160 of a description.', 'Search-engine display behaviour; needs a dated source.');
  manual(CR, 'tip', 'Next-run times are calculated in your browser\'s time zone.', 'Needs runs under several time zones (build/tests/engines.js does this for calculators; not repeated here).');
  manual(FG, 'mistake', 'which browsers need before offering to install.', 'Browser install criteria (a manifest name or short_name); needs the browsers\' documentation with a date. The missing name itself is checked above.');
  manual(FG, 'faq', 'Do I still need favicon.ico? => Only for Internet Explorer and some feed readers.'.replace(/ =>.*/, ''), 'Browser support claim; needs a source.');
};
