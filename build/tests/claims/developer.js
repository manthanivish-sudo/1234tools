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
  claim(CC, 'point', 'Underscores, hyphens and dots become spaces; other punctuation stays attached to its word.', 'a.b-c_d → aBCD; "Hello, world!" → "Hello, World!"', N, async () => {
    const a = out(K.tx(cc(), 'a.b-c_d', { target: 'camel' })), b = out(K.tx(cc(), 'Hello, world!', { target: 'title' }));
    return [a === 'aBCD' && b === 'Hello, World!', a + ' / ' + b];
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
  claim(CO, 'works', 'Both colours are read as three- or six-digit hex and split into channels; anything else is refused.', '#abc accepted, "red" refused', N, async () => {
    const a = col('#abc'), b = col('red');
    return [/rgb\(170, 187, 204\)/.test(a.output || '') && (!!b.error || !b.output), out(a).split('\n')[1] + ' / ' + (b.error || out(b).split('\n')[0])];
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
  claim(CR, 'mistake', 'Steps restart each hour, so the parser says "At minute 0 and minute 45 of every hour": gaps of 45 minutes, then 15.', '*/45', N, async () => {
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

  /* ================================================================ */
  const GR = '/developer/css-gradient/';
  const grad = (f) => K.gen(T('dev-css-gradient.js', 'css-gradient'), f);
  claim(GR, 'point', 'Empty colour fields are dropped; the rest are spaced evenly, at 0% and 100% or at 0%, 50% and 100%.', 'two and three stops', N, async () => {
    const a = grad({ c3: '' }).preview, b = grad({}).preview;
    return [/#ffe29a 0%, #f7c948 100%\)$/.test(a) && /#ffe29a 0%, #f7c948 50%, #ff9d2e 100%\)$/.test(b), a + ' | ' + b];
  });
  claim(GR, 'point', 'Linear uses the angle as its direction: linear-gradient(120deg, …).', 'linear 120', N, async () => {
    const a = grad({ type: 'linear', angle: 120 }).preview; return [/^linear-gradient\(120deg, /.test(a), a];
  });
  claim(GR, 'point', 'Radial ignores the angle and always writes a circle centred at 50% 50%.', 'radial at two angles', N, async () => {
    const a = grad({ type: 'radial', angle: 10 }).preview, b = grad({ type: 'radial', angle: 300 }).preview;
    return [a === b && /^radial-gradient\(circle at 50% 50%, /.test(a), a];
  });
  claim(GR, 'point', 'Conic uses the angle as the start of the sweep: conic-gradient(from 120deg at 50% 50%, …).', 'conic 120', N, async () => {
    const a = grad({ type: 'conic', angle: 120 }).preview; return [/^conic-gradient\(from 120deg at 50% 50%, /.test(a), a];
  });
  claim(GR, 'works', 'The form becomes one line of CSS, and the same value paints the preview', 'output is one line holding the preview value', N, async () => {
    const r = grad({}); return [r.output.split('\n').length === 1 && r.output.indexOf(r.preview) >= 0, r.output];
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
  claim(CJ, 'dfaq', 'The extra fields are dropped, because only header columns become keys.', 'a long row loses its extras', N, async () => {
    const j = JSON.parse(out(K.tx(csv(), 'a\n1,2,3'))); return [K.j(j) === '[{"a":"1"}]', K.j(j)];
  });
  claim(CJ, 'point', 'The array is written with JSON.stringify at a 2-space indent, though Output measures it without the indent.', 'Output counts the unindented bytes', N, async () => {
    const r = K.tx(csv(), 'a,b\n1,2'); const flat = JSON.stringify(JSON.parse(r.output));
    return [/^\[\n  \{\n    "a"/.test(r.output) && K.stat(r, 'Output') === Buffer.byteLength(flat) + ' B', K.stat(r, 'Output') + ' vs ' + Buffer.byteLength(flat) + ' B unindented, ' + Buffer.byteLength(r.output) + ' B as shown'];
  });
  claim(CJ, 'mistake', 'An addr object becomes an addr.city column and returns flat, "addr.city": "York", unless Dotted headers is Nest a.b into objects.', 'there and back, flat and nested', N, async () => {
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
  claim(HG, 'tip', 'they work on any origin and are verifiable against the published test vectors.', 'FIPS/RFC vectors for "abc" and the fox sentence', N, async () => {
    const a = hash('abc'), f = hash('The quick brown fox jumps over the lazy dog');
    const ok = K.stat(a, 'SHA-256') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' && K.stat(a, 'SHA-1') === 'a9993e364706816aba3e25717850c26c9cd0d89d' &&
      K.stat(a, 'MD5') === '900150983cd24fb0d6963f7d28e17f72' && K.stat(f, 'MD5') === '9e107d9d372bb6826bd81d3542a419d6' && K.stat(f, 'CRC32') === '414fa339' && K.stat(f, 'SHA-1') === '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12';
    return [ok, K.j(f.stats)];
  });
  claim(HG, 'point', 'Your text is first encoded as UTF-8, which is why Input length shows characters and bytes separately.', '"é😀"', N, async () => {
    const v = K.stat(hash('é😀'), 'Input length'); return [/^3 characters, 6 bytes$/.test(v || ''), v];
  });
  claim(HG, 'dfaq', '64 hexadecimal characters, or 256 bits, whatever the input length. SHA-1 gives 40 characters, MD5 32 and CRC32 8.', 'lengths', N, async () => {
    const r = hash('x'.repeat(1000)); const l = ['SHA-256', 'SHA-1', 'MD5', 'CRC32'].map((k) => (K.stat(r, k) || '').length);
    return [l.join() === '64,40,32,8', l.join()];
  });
  claim(HG, 'point', 'All four are always computed; the Show menu only filters the output.', 'Show SHA-256: output one line, all four still computed', N, async () => {
    const r = hash('abc', { algo: 'sha256' });
    return [r.output.split('\n').length === 1 && ['SHA-1', 'MD5', 'CRC32'].every((k) => !!K.stat(r, k)), K.j(r.stats.map((x) => x[0]))];
  });
  claim(HG, 'works', 'All four algorithms are written out in the engine file itself and run synchronously', 'no crypto object needed; no promise returned', N, async () => {
    const s = K.tool('dev2-hash-generator.js', 'hash-generator', { crypto: undefined });
    const r = s.transform('abc', { algo: 'all', case: 'lower' });
    return [!(r && typeof r.then === 'function') && K.stat(r, 'SHA-256') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', typeof (r && r.then)];
  });
  claim(HG, 'faq', 'Not in this tool, which works on text.', 'the page has no file input', B, async () => {
    const p = await K.open(HG); try { const n = await p.$$eval('.tool-io input[type=file]', (l) => l.length); return [n === 0, n + ' file inputs']; } finally { await p.close(); }
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
  const ent = (s, d) => out(K.tx(T('dev-html-entities.js', 'html-entities'), s, { dir: d || 'enc' }));
  claim(HE, 'point', 'Escaping replaces exactly five characters: & < > " and \', the last as &#39;.', 'exactly those five; é and € untouched', N, async () => {
    const e = ent('&<>"\'é€');
    return [e === '&amp;&lt;&gt;&quot;&#39;é€', e];
  });
  claim(HE, 'point', 'Escaping does not look for existing entities, so escaped text is escaped again.', '&amp; → &amp;amp;', N, async () => {
    const e = ent('Tom &amp; Jerry'); return [e === 'Tom &amp;amp; Jerry', e];
  });
  claim(HE, 'point', 'Unescaping knows seven names (amp, lt, gt, quot, apos, nbsp and #39) and converts every decimal or hex reference with String.fromCodePoint.', 'names and numeric references', N, async () => {
    const d = ent('&amp;&lt;&gt;&quot;&apos;&#39;&nbsp;&#128512;&#x1F600;', 'dec');
    return [d === '&<>"\'\'\u00a0😀😀', K.j(d)];
  });
  claim(HE, 'point', 'Any other named reference is left as written, yet Entities decoded counts every entity-shaped token, changed or not.', '&pound; stays; the count includes it', N, async () => {
    const r = K.tx(T('dev-html-entities.js', 'html-entities'), '&pound;&amp;', { dir: 'dec' });
    return [r.output === '&pound;&' && K.stat(r, 'Entities decoded') === '2', r.output + ' / ' + K.stat(r, 'Entities decoded')];
  });
  claim(HE, 'dfaq', 'Unescaping turns &nbsp; into that character, not an ordinary space.', 'U+00A0', N, async () => { const d = ent('a&nbsp;b', 'dec'); return [d === 'a\u00a0b', K.j(d)]; });
  claim(HE, 'dfaq', 'Escaping here leaves them alone for that reason.', 'é and € untouched', N, async () => { const e = ent('café €5'); return [e === 'café €5', e]; });
  claim(HE, 'dfaq', 'this tool writes &#39; and reads both.', 'writes &#39;, reads &apos; and &#39;', N, async () => {
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
  claim(JF, 'faq', 'The JSON specification does not allow a comma after the last element of an object or array, even though JavaScript does. Remove it.', 'a trailing comma is refused', N, async () => {
    const r = K.tx(jf(), '[1,2,]'); return [!!r.error, r.error || 'accepted'];
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
  claim(JF, 'dfaq', 'a standard parser, this one included, rejects them.', 'a // comment is refused', N, async () => { const r = K.tx(jf(), '{"a":1 // c\n}'); return [!!r.error, r.error || 'accepted']; });
  claim(JF, 'dfaq', 'an ID of 12345678901234567890 comes back as 12345678901234567000.', 'the long number', N, async () => {
    const o = out(K.tx(jf(), '{"id":12345678901234567890}', { mode: 'minify' })); return [o === '{"id":12345678901234567000}', o];
  });
  claim(JF, 'dfaq', 'Only whitespace between tokens goes; spaces inside strings stay', 'minify keeps "a b"', N, async () => {
    const o = out(K.tx(jf(), '{ "k" : "a  b" }', { mode: 'minify' })); return [o === '{"k":"a  b"}', o];
  });

  /* ================================================================ */
  const JW = '/developer/jwt-decoder/';
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = (s) => K.tx(T('dev-jwt-decoder.js', 'jwt-decoder'), s);
  const tok = (p, h) => b64u(h || { alg: 'HS256', typ: 'JWT' }) + '.' + b64u(p) + '.';
  claim(JW, 'point', 'Anything other than three parts is refused, which also rules out the five-part encrypted form.', 'two and five parts refused', N, async () => {
    const a = jwt('aaa.bbb'), b = jwt('a.b.c.d.e'); return [!!a.error && !!b.error, (a.error || 'ok') + ' | ' + (b.error || 'ok')];
  });
  claim(JW, 'works', 'The token is split on its dots and the first two parts are decoded in the page. The third part is never read.', 'garbage signature still decodes', N, async () => {
    const r = jwt(tok({ sub: 'x' }) + '!!!not-base64!!!'); return [!r.error && /"sub": "x"/.test(r.output), r.error || 'decoded'];
  });
  claim(JW, 'point', 'Header and payload are mapped from base64url to standard Base64, re-padded, decoded as UTF-8 and parsed with JSON.parse.', 'a payload with é and ~ characters', N, async () => {
    const r = jwt(tok({ name: 'Zoë', q: '???>>>' })); return [/"name": "Zoë"/.test(r.output || '') && /"q": "\?\?\?>>>"/.test(r.output || ''), r.error || r.output];
  });
  claim(JW, 'point', 'alg and typ come from the header; iat and exp are multiplied by 1,000 and shown as UTC.', 'iat 1516239022', N, async () => {
    const r = jwt(tok({ iat: 1516239022, exp: 1516239022 })); return [K.stat(r, 'Issued') === '2018-01-18 01:30:22 UTC' && K.stat(r, 'Algorithm') === 'HS256', K.j(r.stats)];
  });
  claim(JW, 'point', 'Status compares exp with your device clock and nothing else: no signature check, and nbf is ignored.', 'a future exp with a future nbf is still valid', N, async () => {
    const now = Math.floor(Date.now() / 1000);
    const r = jwt(tok({ exp: now + 3600, nbf: now + 1800 }));
    return [!/EXPIRED|not yet/i.test(K.stat(r, 'Status') || '') && !!K.stat(r, 'Status'), K.stat(r, 'Status')];
  });
  claim(JW, 'mistake', 'An exp of 1767229200000 decodes to +057971-04-07', 'exp in milliseconds', N, async () => {
    const v = K.stat(jwt(tok({ exp: 1767229200000 })), 'Expires'); return [/^\+057971-04-07/.test(v || ''), v];
  });
  claim(JW, 'mistake', 'Copy only what follows "Bearer " in the Authorization header, or the header segment will not decode.', 'a Bearer prefix fails', N, async () => {
    const r = jwt('Bearer ' + tok({ sub: 'x' }) + 'sig'); return [!!r.error, r.error || 'decoded anyway'];
  });

  /* ================================================================ */
  const LI = '/developer/lorem-ipsum/';
  const lorem = (f) => K.gen(T('dev-lorem-ipsum.js', 'lorem-ipsum'), f);
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
  claim(LI, 'point', 'A sentence is 8 to 19 words, capitalised and closed with a full stop, with no commas; a paragraph is 3 to 5 sentences.', 'shape of 100 paragraphs', N, async () => {
    const paras = out(lorem({ unit: 'paragraphs', count: 100 })).split(/\n\n/);
    const bad = [];
    for (const p of paras) {
      const ss = p.match(/[^.]+\./g) || [];
      if (ss.length < 3 || ss.length > 5) bad.push('para of ' + ss.length);
      for (const s of ss) { const w = s.trim().split(/\s+/); if (w.length < 8 || w.length > 19 || !/^[A-Z]/.test(w[0]) || /,/.test(s)) bad.push(w.length + ' words'); }
    }
    return [paras.length === 100 && !bad.length, paras.length + ' paragraphs; ' + (bad.slice(0, 5).join(', ') || 'all in range')];
  });
  claim(LI, 'point', 'Choosing Words returns that many bare words, with no capitals or full stops.', '25 words', N, async () => {
    const o = out(lorem({ unit: 'words', count: 25 })); const w = o.trim().split(/\s+/);
    return [w.length === 25 && !/[A-Z.]/.test(o), w.length + ' words: ' + o.slice(0, 60)];
  });
  claim(LI, 'point', 'The count is capped at 100, and <p> or <li> tags wrap each paragraph, or the single block that Words and Sentences produce.', 'count 500 gives 100; tags', N, async () => {
    const n = out(lorem({ unit: 'paragraphs', count: 500 })).split(/\n\n/).length;
    const p = out(lorem({ unit: 'paragraphs', count: 2, wrap: 'p' })), li = out(lorem({ unit: 'words', count: 5, wrap: 'li' }));
    return [n === 100 && (p.match(/<p>/g) || []).length === 2 && (li.match(/<li>/g) || []).length === 1, n + ' paragraphs; ' + p.slice(0, 20) + ' | ' + li];
  });
  claim(LI, 'works', 'Every run draws fresh words from a fixed list using Math.random, so no two results are the same.', 'two runs differ', N, async () => {
    const a = out(lorem({})), b = out(lorem({})); return [a !== b, a === b ? 'identical' : 'different'];
  });

  /* ================================================================ */
  const MD = '/developer/markdown-preview/';
  const md = (s, o) => K.tx(T('dev2-markdown-preview.js', 'markdown-preview'), s, o);
  claim(MD, 'card', 'Convert Markdown to clean HTML, with support for headings, lists, code blocks, links and tables.', 'a pipe table becomes <table> with a header row and a body row', N, async () => {
    const o = out(md('| a | b |\n|---|---|\n| 1 | 2 |'));
    return [o === '<table>\n<thead>\n<tr><th>a</th><th>b</th></tr>\n</thead>\n<tbody>\n<tr><td>1</td><td>2</td></tr>\n</tbody>\n</table>', o];
  });
  claim(MD, 'tip', 'This is CommonMark-ish rather than a full implementation. Footnotes, reference links and task lists are not supported.', 'a footnote, a reference link and a task item stay as typed', N, async () => {
    const o = out(md('Note[^1]\n\n[^1]: the note\n\n[a][ref]\n\n[ref]: https://example.com\n\n- [ ] task'));
    return [/\[\^1\]/.test(o) && /\[a\]\[ref\]/.test(o) && !/<a |<input|<sup/.test(o) && /<li>\[ \] task<\/li>/.test(o), o];
  });
  claim(MD, 'tip', 'Supported: headings, bold, italic, strikethrough, inline code, fenced code blocks, links, images, blockquotes, ordered and unordered lists, horizontal rules and GitHub-style pipe tables.', 'one of each', N, async () => {
    const o = out(md('# H\n\n**b** *i* ~~s~~ `c` [l](https://x.y) ![im](https://x.y/a.png)\n\n> q\n\n1. one\n\n- u\n\n---\n\n```\ncode\n```\n\n| t | u |\n|---|---|\n| 1 | 2 |'));
    const need = ['<h1', '<strong>', '<em>', '<del>|<s>', '<code>c</code>', '<pre', '<a href', '<img', '<blockquote', '<ol', '<ul', '<hr', '<table>', '<th>t</th>', '<td>2</td>'];
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
  claim(MD, 'point', 'Each other line is classified by how it starts: #, >, a bullet, a number, a rule or a table; others join the paragraph above until a blank line.', 'short and long rows, the end of a table, a mismatched divider', N, async () => {
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
  claim(RX, 'point', 'The flags on offer are g, i, m and s, not y or u.', 'flag options', N, async () => {
    const o = T('dev2-regex-tester.js', 'regex-tester').options.find((x) => x.key === 'flags').options.map((x) => x.value);
    return [o.join('').split('').every((c) => 'gims'.indexOf(c) >= 0), o.join(',')];
  });
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
  claim(SL, 'point', 'Unicode normalisation, normalize(\'NFD\'), splits letters such as é into e plus an accent mark, and the marks are deleted.', 'Crème brûlée', N, async () => { const r = slug('Crème brûlée'); return [r === 'creme-brulee', r]; });
  claim(SL, 'point', 'Straight apostrophes and backticks are removed, so don\'t becomes dont, and & becomes the word and.', "don't & `x`", N, async () => { const r = slug("Don't & `x`"); return [r === 'dont-and-x', r]; });
  claim(SL, 'point', 'Remove stop words drops 16 short words such as the, of and is, but only from titles longer than two words.', 'stop words', N, async () => {
    const a = slug('The history of the world is long', { stop: 'strip' }), b = slug('The End', { stop: 'strip' });
    return [a === 'history-world-long' && b === 'the-end', a + ' | ' + b];
  });
  claim(SL, 'mistake', '50% Off £20 Deals ends in 50-off-20-deals', 'the example', N, async () => { const r = slug('50% Off £20 Deals'); return [r === '50-off-20-deals', r]; });
  claim(SL, 'mistake', 'Greek, Cyrillic, Arabic and Devanagari letters are removed, not transliterated', 'non-Latin removed', N, async () => { const r = slug('Ελλάδα Москва test'); return [r === 'test', r]; });
  claim(SL, 'lede', 'Handles accents and multiple lines at once.', 'two lines in, two slugs out', N, async () => { const r = slug('One Two\nThree Four'); return [r === 'one-two\nthree-four', K.j(r)]; });

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
  claim(UE, 'tip', 'Decoding, Treat + as space reads each + as a space (Auto: yes in Component scope, no in Full URL scope). An encoded plus, %2B, never becomes a space.', 'Auto in both scopes, %2B', N, async () => {
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
  claim(UU, 'works', 'Each ID comes from the browser\'s crypto.randomUUID(), which draws on the operating system\'s secure random source.', 'randomUUID is called', N, async () => {
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

  /* ================================================================ */
  const XF = '/developer/xml-formatter/';
  const xml = (s, o) => K.tx(T('dev-xml-formatter.js', 'xml-formatter'), s, o);
  claim(XF, 'point', 'Start tags go on a stack; an end tag must match the top exactly, case included, or the pair is named.', '<b></B>', N, async () => {
    const r = xml('<a><b></B></a>'); return [/<b>/.test(r.error || '') && /<\/B>/.test(r.error || ''), r.error || 'accepted'];
  });
  claim(XF, 'point', 'Attribute quoting, entities and the number of root elements are not checked.', 'x=1 and two roots pass', N, async () => {
    const r = xml('<a x=1>&bogus;</a><b/>'); return [!r.error, r.error || 'accepted'];
  });
  claim(XF, 'point', 'A regular expression finds every start, end and self-closing tag, skipping the declaration, comments, CDATA and DOCTYPE.', 'those are skipped', N, async () => {
    const r = xml('<?xml version="1.0"?><!DOCTYPE a><a><!-- <b> --><![CDATA[<c>]]><d/></a>'); return [!r.error, r.error || 'accepted'];
  });
  claim(XF, 'mistake', 'Whitespace between tags is removed, so <b>fish</b> <i>chips</i> becomes <b>fish</b><i>chips</i>.', 'minify mixed content', N, async () => {
    const r = out(xml('<p><b>fish</b> <i>chips</i></p>', { mode: 'minify' })); return [r === '<p><b>fish</b><i>chips</i></p>', r];
  });
  claim(XF, 'dfaq', 'It is optional for UTF-8, must come first if present, and is kept in place here.', 'declaration kept first', N, async () => {
    const r = out(xml('<?xml version="1.0"?><a><b>1</b></a>')); return [/^<\?xml version="1\.0"\?>/.test(r), r.split('\n')[0]];
  });
  claim(XF, 'dfaq', 'Only the whitespace between tags is replaced by line breaks and indentation. Text inside elements and attribute values are left alone.', 'text and attributes unchanged', N, async () => {
    const r = out(xml('<a x="1  2"><b>  keep  me  </b></a>')); return [/x="1  2"/.test(r) && />  keep  me  </.test(r), K.j(r)];
  });
  claim(XF, 'point', 'text followed by a child tag, as in <title>Teapot <b>new</b></title>, throws the indentation off by a level.', 'the example\'s indentation', N, async () => {
    const r = out(xml('<r><title>Teapot <b>new</b></title><x/></r>'));
    return [!/\n {2}<x\/>/.test(r) && /\n<x\/>|\n {4}<x\/>/.test(r), K.j(r)];
  });

  /* ================================================================ */
  const FG = '/developer/favicon-generator/';
  const favicons = async (draw, w, h, bg, name) => {
    const p = await K.open(FG);
    try {
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

  /* ---------- manual ---------- */
  manual(CO, 'tip', 'WCAG AA needs 4.5:1 for body text and 3:1 for large text (18pt, or 14pt bold). AAA raises these to 7:1 and 4.5:1.', 'WCAG 2 thresholds; check against the W3C text (the grading itself is checked above).');
  manual(HG, 'tip', 'MD5 has been collision-broken since 2004 and SHA-1 since 2017.', 'Cryptography history; needs sources.');
  manual('/developer/htaccess-generator/', 'tip', 'most browsers will not save a file whose name starts with a dot: Chrome and Edge save htaccess.txt',
    'browser download naming; build/tests/dev-fixes.js (14, 15) runs it in Chrome: the page asks for .htaccess and Chrome saves htaccess.txt. Edge is the same Chromium code; not run here.');
  manual(RB, 'faq', 'Blocking Google-Extended opts you out of Gemini training without affecting Google Search crawling or ranking', 'Google policy; needs Google\'s documentation with a date.');
  manual(RB, 'dfaq', 'Crawlers must read at least the first 500 kibibytes under RFC 9309, and Google ignores anything beyond that.', 'RFC 9309 and Google documentation.');
  manual(GR, 'dfaq', 'In every current one. Chrome and Safari added them first and Firefox followed in 2020.', 'Browser support history; needs a source (MDN / caniuse).');
  manual(UU, 'tip', 'You would need to generate about 2.7 × 10¹⁸ of them before a collision became likely.', 'Birthday-bound arithmetic (sqrt(2^122 · ln 2) ≈ 2.7e18 for 50%); a maths check, not a tool run.');
  manual(MT, 'tip', 'Google typically shows around 60 characters of a title and 155–160 of a description.', 'Search-engine display behaviour; needs a dated source.');
  manual(CR, 'tip', 'Next-run times are calculated in your browser\'s time zone.', 'Needs runs under several time zones (build/tests/engines.js does this for calculators; not repeated here).');
  manual(FG, 'mistake', 'which browsers need before offering to install.', 'Browser install criteria (a manifest name or short_name); needs the browsers\' documentation with a date. The missing name itself is checked above.');
  manual(FG, 'faq', 'Do I still need favicon.ico? => Only for Internet Explorer and some feed readers.'.replace(/ =>.*/, ''), 'Browser support claim; needs a source.');
};
