/**
 * Claims on the developer tools added in wave 6: Unix timestamp, SQL
 * formatter, code minifier and beautifier, YAML to JSON, barcode generator
 * and colour contrast checker. Engines run in Node in a vm with a stub
 * window (all the scripts a page loads, in order); the page's own UI in
 * Chrome. References are independent of the engines: Python's zoneinfo,
 * email.utils and sqlite3, PyYAML where present, the WCAG formula written
 * out again here, Node's own V8 and the browser's CSS and HTML parsers.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const cache = {};
  /** a spec with every engine script its page loads */
  const spec = (slug) => {
    if (cache[slug]) return cache[slug];
    const html = fs.readFileSync(path.join(K.ROOT, 'developer', slug, 'index.html'), 'utf8');
    const ctx = K.context();
    const re = /<script src="\/engine\/([^"]+\.js)"/g;
    let m;
    while ((m = re.exec(html))) if (!/^render-/.test(m[1])) vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', m[1]), 'utf8'), ctx, { filename: m[1] });
    return (cache[slug] = ctx.DEV_TOOLS[slug]);
  };
  const tx = (slug, input, opts) => K.tx(spec(slug), input, opts);
  const gen = (slug, fields) => K.gen(spec(slug), fields);
  const py = (code, input) => { try { return execFileSync('python3', ['-X', 'utf8', '-E', '-P', '-c', code], { input: input || '', encoding: 'utf8', cwd: require('os').tmpdir() }).replace(/\r\n/g, '\n'); } catch (e) { return null; } };
  const hasPy = () => py('print(1)') !== null;

  /* ================= Unix timestamp ================= */
  const UT = '/developer/unix-timestamp/';
  claim(UT, 'tip', 'Numbers are read by their digits: up to 11 as seconds, 12 to 14 as milliseconds, 15 to 17 as microseconds and 18 or more as nanoseconds.',
    'one instant written in all four units converts to the same UTC time', N, async () => {
      const r = tx('unix-timestamp', '1791374400\n1791374400000\n1791374400000000\n1791374400000000000', { zone: 'UTC', out: 'utc' });
      const lines = String(r.output).split('\n');
      return [lines.length === 4 && lines.every((l) => l === '2026-10-07T12:00:00Z'), r.output];
    });
  claim(UT, 'tip', 'A date with no offset, such as 2026-10-07 13:00, is read in the time zone you pick.',
    '200 random wall times in 6 zones agree with Python’s zoneinfo (fold 0)', N, async () => {
      if (!hasPy()) return [false, 'python3 is needed for this check'];
      const zones = ['Europe/London', 'America/New_York', 'Asia/Kolkata', 'Australia/Sydney', 'America/Sao_Paulo', 'Pacific/Chatham'];
      let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
      const cases = [];
      for (let i = 0; i < 200; i++) cases.push([zones[i % 6], 1990 + rnd(50), 1 + rnd(12), 1 + rnd(28), rnd(24), rnd(60), rnd(60)]);
      /* plus the clock changes of 2026 in London and New York */
      cases.push(['Europe/London', 2026, 3, 29, 1, 30, 0], ['Europe/London', 2026, 10, 25, 1, 30, 0], ['America/New_York', 2026, 3, 8, 2, 30, 0], ['America/New_York', 2026, 11, 1, 1, 30, 0]);
      const ref = py('import sys,json\nfrom zoneinfo import ZoneInfo\nfrom datetime import datetime\nfor z,y,mo,d,h,mi,s in json.loads(sys.stdin.read()):\n  print(int(datetime(y,mo,d,h,mi,s,tzinfo=ZoneInfo(z)).timestamp()))', JSON.stringify(cases));
      if (!ref) return [false, 'python3 zoneinfo did not run'];
      const want = ref.trim().split('\n');
      const bad = [];
      cases.forEach((c, i) => {
        const p2 = (n) => String(n).padStart(2, '0');
        const r = tx('unix-timestamp', c[1] + '-' + p2(c[2]) + '-' + p2(c[3]) + ' ' + p2(c[4]) + ':' + p2(c[5]) + ':' + p2(c[6]), { zone: c[0], out: 's' });
        if (String(r.output) !== want[i]) bad.push(c.join(' ') + ' → ' + r.output + ', zoneinfo ' + want[i]);
      });
      return [bad.length === 0, bad.length ? bad.slice(0, 3).join('; ') : cases.length + ' wall times agree'];
    });
  claim(UT, 'faq', 'When the clocks go forward, a wall time in the gap does not exist; it is read with the offset before the change, so 01:30 on 29 March 2026 in London becomes 02:30 BST.',
    'the gap and the repeated hour', N, async () => {
      const r = tx('unix-timestamp', '2026-03-29 01:30\n2026-10-25 01:30', { zone: 'Europe/London', out: 'iso' });
      return [r.output === '2026-03-29T02:30:00+01:00\n2026-10-25T01:30:00+01:00' && /1792888200/.test(r.note) && /1792891800/.test(r.note), r.output + ' | ' + r.note];
    });
  claim(UT, 'tip', 'Choose a one-per-line output to paste a converted column straight back into a spreadsheet: the lines stay in step with the input, blanks included.',
    'blank and unreadable lines keep their places', N, async () => {
      const r = tx('unix-timestamp', '0\n\nnot a date\n86400', { zone: 'UTC', out: 'utc' });
      return [r.output === '1970-01-01T00:00:00Z\n\n\n1970-01-02T00:00:00Z' && /Line 3/.test(r.warn), JSON.stringify(r.output) + ' | ' + r.warn];
    });
  claim(UT, 'dfaq', 'Systems still storing time that way wrap round to 1901; the tool flags values outside that range.',
    '2147483647 is not flagged, 2147483648 is', N, async () => {
      const a = tx('unix-timestamp', '2147483647', { zone: 'UTC', out: 'utc' }), b = tx('unix-timestamp', '2147483648', { zone: 'UTC', out: 'utc' });
      return [!a.note && /32-bit/.test(b.note || '') && a.output === '2038-01-19T03:14:07Z', a.output + ' | ' + (b.note || '')];
    });
  claim(UT, 'point', 'Text is read as a date: ISO 8601, RFC 2822, slashed dates, 7 Oct 2026 and web server log stamps.',
    'RFC 2822 output reads back in Python’s email.utils; each form of input gives one instant', N, async () => {
      const forms = ['2026-10-07T13:00:00+01:00', 'Wed, 07 Oct 2026 13:00:00 +0100', '07/10/2026 12:00 Z', '7 Oct 2026 12:00 UTC', '[07/Oct/2026:12:00:00 +0000]', 'Oct 7, 2026 12:00 pm GMT'];
      const r = tx('unix-timestamp', forms.join('\n'), { zone: 'UTC', out: 's' });
      const rfc = tx('unix-timestamp', '1791374400', { zone: 'Asia/Kolkata', out: 'rfc' }).output;
      const back = hasPy() ? (py('import sys,email.utils\nprint(int(email.utils.parsedate_to_datetime(sys.stdin.read().strip()).timestamp()))', rfc) || '').trim() : null;
      return [String(r.output).split('\n').every((x) => x === '1791374400') && back === '1791374400', r.output.replace(/\n/g, ' ') + ' | ' + rfc + ' → ' + back];
    });
  claim(UT, 'faq', 'The live clock above the converter shows it in seconds and milliseconds, read from this device’s clock. Insert now adds it to the list.',
    'the clock ticks and Insert now adds the current second', B, async () => {
      const p = await K.open(UT);
      try {
        const a = await p.$eval('.uts-now-s', (e) => Number(e.textContent));
        await K.sleep(1300);
        const b = await p.$eval('.uts-now-s', (e) => Number(e.textContent));
        await p.evaluate(() => { document.querySelector('.code-area').value = ''; [...document.querySelectorAll('.uts-now button')].find((x) => x.textContent === 'Insert now').click(); });
        await K.sleep(300);
        const v = await p.$eval('.code-area', (e) => e.value.trim());
        const now = Math.floor(Date.now() / 1000);
        return [b > a && Math.abs(Number(v) - now) < 5, a + ' → ' + b + ', inserted ' + v];
      } finally { await p.close(); }
    });

  /* ================= SQL formatter ================= */
  const SQ = '/developer/sql-formatter/';
  const sqlCorpus = [
    "select c.name, count(*) as n from customers c left join orders o on o.cid = c.id and o.status <> 'x' where c.id between 1 and 50 or c.name like 'A%' group by c.name having count(*) >= 0 order by n desc, c.name limit 20",
    "select id, case when total > 100 then 'big' when total > 10 then 'mid' else 'small' end as size, -total as neg, total - -1 as plus from orders where id in (select oid from items where qty > 1) order by id",
    "with recursive x(n) as (select 1 union all select n + 1 from x where n < 10) select sum(n), group_concat(n, '-') from x",
    "select /* inline */ name -- trailing\n, 'it''s' as q, \"id\" from customers where name not like '%--%' and name <> '/*'",
    "select a.id, b.id from customers a cross join customers b where a.id < b.id and (a.id = 1 or b.id = 2) order by 1, 2"
  ];
  claim(SQ, 'faq', 'It is built not to: the formatted text is cut into tokens again and compared with your original, and if anything but spacing or reserved-word case differs, nothing is shown.',
    'formatted and minified queries give SQLite the same rows as the originals', N, async () => {
      if (!hasPy()) return [false, 'python3 is needed for this check'];
      const runs = [];
      for (const q of sqlCorpus) for (const o of [{}, { mode: 'minify' }, { case: 'lower', indent: '4' }, { mode: 'minify', comments: 'keep' }]) {
        const r = tx('sql-formatter', q, Object.assign({ dialect: 'sqlite' }, o));
        if (r.error) return [false, r.error];
        runs.push([q, r.output]);
      }
      const out = py("import sys,json,sqlite3\ndb=sqlite3.connect(':memory:')\ndb.executescript(\"create table customers(id integer, name text); create table orders(id integer, cid integer, status text, total real); create table items(oid integer, qty integer);\")\nfor i in range(1,60): db.execute('insert into customers values(?,?)',(i,chr(65+i%26)+'x'+str(i)))\nfor i in range(1,90): db.execute('insert into orders values(?,?,?,?)',(i,i%50,'ok' if i%3 else 'x',i*3.5))\nfor i in range(1,90): db.execute('insert into items values(?,?)',(i,i%4))\nbad=0\nfor a,b in json.loads(sys.stdin.read()):\n  if db.execute(a).fetchall()!=db.execute(b).fetchall(): bad+=1; print('DIFF',b)\nprint('bad',bad)", JSON.stringify(runs));
      return [!!out && /bad 0/.test(out), (out || 'python failed').trim().slice(0, 300) + ' (' + runs.length + ' pairs)'];
    });
  claim(SQ, 'tip', 'Names are never re-cased, even ones that look like words, because MySQL table names can be case-sensitive.',
    'user, Date and Orders keep their case; select and from change', N, async () => {
      const r = tx('sql-formatter', 'select Date, user from Orders', { case: 'upper' });
      return [/SELECT/.test(r.output) && /\bDate\b/.test(r.output) && /\buser\b/.test(r.output) && /\bOrders\b/.test(r.output), r.output.replace(/\n/g, ' ')];
    });
  claim(SQ, 'mistake', 'In MySQL "vip" is a string, but in standard SQL it is a column name',
    'a # comment and backslash escape are read only in the MySQL dialect', N, async () => {
      const my = tx('sql-formatter', "select 'a\\'b' # note\nfrom t", { dialect: 'mysql' });
      const gen = tx('sql-formatter', "select 'a\\'b' # note\nfrom t", { dialect: 'generic' });
      return [!my.error && /# note/.test(my.output) && !!gen.error, (my.error || my.output.replace(/\n/g, ' ')) + ' | generic: ' + gen.error];
    });
  claim(SQ, 'tip', 'Minify keeps a space only where two pieces would otherwise run together, and removes comments except /*! … */ hints, unless you keep them.',
    'a - -1 keeps its space; /*! hint */ stays; -- comment goes', N, async () => {
      const r = tx('sql-formatter', 'select a - -1 /*!50000 x */ -- c\nfrom t', { mode: 'minify' });
      return [/a- -1/.test(r.output) && /\/\*!50000 x \*\//.test(r.output) && !/-- c/.test(r.output), r.output];
    });
  claim(SQ, 'point', 'Unclosed strings, quoted names and comments are reported with the line.', 'an unclosed string names its line and column', N, async () => {
    const r = tx('sql-formatter', "select 1\nfrom t where a = 'x");
    return [/line 2, column 18/.test(r.error || ''), r.error];
  });

  /* ================= Code minifier and beautifier ================= */
  const CM = '/developer/code-minifier/', CB = '/developer/code-beautifier/';
  /* every developer engine, minified and beautified, runs its own example to the same result as the original */
  const engineRoundTrip = (slug, opt) => {
    const files = fs.readdirSync(path.join(K.ROOT, 'engine')).filter((f) => /^dev2?-[\w-]+\.js$/.test(f) && f !== 'dev-color-contrast-checker.js');
    let same = 0; const bad = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(K.ROOT, 'engine', f), 'utf8');
      const r = tx(slug, src, Object.assign({ lang: 'js' }, opt));
      if (r.error) { bad.push(f + ': ' + r.error); continue; }
      const run = (code) => {
        const c = K.context(); vm.runInContext(code, c, { filename: f });
        const out = [];
        for (const [id, s] of Object.entries(c.DEV_TOOLS || c.TEXT_TOOLS || {})) {
          try {
            if (s.transform && s.sample) out.push(id + ':' + JSON.stringify(K.tx(s, s.sample, {}), (k, v) => (typeof v === 'bigint' ? String(v) : v)).replace(/"From now[^"]*"/g, ''));
            else if (s.generate && !/uuid|password|lorem/.test(id)) out.push(id + ':' + JSON.stringify(K.gen(s, {})));
          } catch (e) { out.push(id + ': threw ' + e.message); }
        }
        return out.join('\n').replace(/in \d+ \w+|\d+ \w+ ago/g, '');
      };
      let a, b;
      try { a = run(src); b = run(r.output); } catch (e) { bad.push(f + ': ' + e.message); continue; }
      if (a === b) same++; else bad.push(f + ': results differ');
    }
    return [bad.length === 0 && same > 20, same + ' engines give the same results' + (bad.length ? '; ' + bad.slice(0, 3).join('; ') : '')];
  };
  claim(CM, 'tip', 'JavaScript keeps every name and every statement: only comments and white space go, and a line break stays wherever removing it could change where JavaScript ends a statement.',
    'every developer engine on this site, minified, gives the same results in V8', N, async () => engineRoundTrip('code-minifier', {}));
  claim(CB, 'faq', 'Yes. Only white space changes: the tool never adds or removes a semicolon, a bracket or a word, and it keeps every line break that JavaScript could need.',
    'every developer engine on this site, beautified, gives the same results in V8', N, async () => engineRoundTrip('code-beautifier', {}));
  claim(CM, 'faq', 'Where code relies on automatic semicolons, as in a line ending in b followed by a line starting with ++c, joining the lines would change what runs.',
    'a = b / ++c keeps its break and runs as before', N, async () => {
      const src = 'var a = 1, b = 2, c = 3\na = b\n++c\nout = [a, b, c].join()';
      const r = tx('code-minifier', src, { lang: 'js' });
      const run = (s) => { const c = K.context(); vm.runInContext(s, c); return c.out; };
      return [run(src) === run(r.output) && /\n\+\+c/.test(r.output), JSON.stringify(r.output) + ' → ' + run(r.output)];
    });
  claim(CM, 'tip', 'Licence comments that start with /*! or carry @license or @preserve are kept unless you untick the box, as most open-source licences ask.',
    'kept by default, dropped when unticked', N, async () => {
      const s = '/*! MIT */\n/* @license X */\n/* plain */\nvar a = 1;';
      const k = tx('code-minifier', s, { lang: 'js' }).output, d = tx('code-minifier', s, { lang: 'js', keepLicence: 'no' }).output;
      return [/\/\*! MIT \*\//.test(k) && /@license/.test(k) && !/plain/.test(k) && d === 'var a=1;', JSON.stringify(k) + ' | ' + JSON.stringify(d)];
    });
  claim(CM, 'tip', 'CSS also loses the last semicolon in each block and empty rules, and writes #aabbcc as #abc and 0.5em as .5em.',
    'Chrome’s CSS parser reads the same rules from the minified sheet', B, async () => {
      const css = '/* c */\n.a , .b > p:hover::before { color : #AABBCC ; margin : 0.5em 0 ; background: url( "x y.png" ) ; width: calc( 100% - 2px ) ; font: 12px / 1.5 Georgia , serif ; }\n.empty { }\n@media (min-width : 600px) and (max-width: 900px) { .z { color: red !important ; } }\n.c::after { content: " a  b " }\n:is(.x , .y) .z { transform: translate( -50% , 10px ) rotate(45deg) }';
      const min = tx('code-minifier', css, { lang: 'css' }).output;
      const p = await K.open(CM);
      try {
        const rules = await p.evaluate((a, b) => {
          const read = (t) => { const s = new CSSStyleSheet(); s.replaceSync(t); return [...s.cssRules].map((r) => r.cssText).filter((x) => !/^\.empty/.test(x)); };
          return [read(a), read(b)];
        }, css, min);
        return [JSON.stringify(rules[0]) === JSON.stringify(rules[1]) && /#abc/.test(min) && /\.5em/.test(min) && !/\.empty/.test(min), min];
      } finally { await p.close(); }
    });
  claim(CM, 'tip', 'HTML keeps pre, textarea and code exactly, and every attribute value as typed. White space holding a line break becomes one space, and white space next to block elements, which a browser does not show, goes.',
    'the rendered text (innerText) of a page is the same before and after, and pre is untouched', B, async () => {
      const html = '<div class="a  b">\n  <h1>  Title   here </h1>\n  <p>Hello   <b>bold</b> <i>and</i>  more\n  text.</p>\n  <!-- note -->\n  <ul>\n    <li> One </li>\n    <li>Two</li>\n  </ul>\n  <pre>  keep\n    this  </pre>\n  <textarea>  a\n b </textarea>\n  <p>a<br>\n   b <code style="white-space:pre">x   =   1</code></p>\n</div>';
      const min = tx('code-minifier', html, { lang: 'html' }).output;
      const p = await K.open(CM);
      try {
        const t = await p.evaluate((a, b) => {
          const show = (h) => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d); const r = d.innerText + '|' + d.querySelector('pre').textContent + '|' + d.querySelector('textarea').value + '|' + d.querySelector('code').textContent + '|' + d.querySelector('div').className; d.remove(); return r; };
          return [show(a), show(b)];
        }, html, min);
        return [t[0] === t[1] && min.length < html.length, JSON.stringify(min)];
      } finally { await p.close(); }
    });
  claim(CM, 'tip', 'The Gzipped figure is what most servers send: compare that, not the raw size, to judge the saving.', 'a Gzipped row appears and matches Node’s gzip within 30 bytes', B, async () => {
    const p = await K.open(CM);
    try {
      await K.clickText(p, '.io-actions button', /^Load example$/);
      await K.sleep(800);
      const row = await p.evaluate(() => { const r = [...document.querySelectorAll('.stat-row')].find((x) => /Gzipped/.test(x.textContent)); return r ? r.lastChild.textContent : ''; });
      const out = await p.$eval('.code-out', (e) => e.textContent);
      const z = require('zlib').gzipSync(Buffer.from(out)).length;
      const m = /→ (\d+) B/.exec(row);
      return [!!m && Math.abs(Number(m[1]) - z) <= 30, row + ' (Node gzip ' + z + ' B)'];
    } finally { await p.close(); }
  });
  claim(CB, 'tip', 'CSS gets one declaration per line and one selector per line in a list; HTML gets block elements on their own lines, while short runs of inline text stay together.',
    'beautified CSS reads back to the same rules in Chrome; the inline run stays on one line', B, async () => {
      const css = 'a,b>c:hover{color:red;margin:0 auto}@media (min-width:600px){.z{color:red;padding:1px 2px}}';
      const out = tx('code-beautifier', css, { lang: 'css' }).output;
      const h = tx('code-beautifier', '<div><p>Hi <b>there</b> you</p></div>', { lang: 'html' }).output;
      const p = await K.open(CB);
      try {
        const same = await p.evaluate((a, b) => { const read = (t) => { const s = new CSSStyleSheet(); s.replaceSync(t); return [...s.cssRules].map((r) => r.cssText).join('\n'); }; return read(a) === read(b); }, css, out);
        return [same && /a,\nb > c:hover \{/.test(out) && /\n  color: red;\n/.test(out) && /<p>Hi <b>there<\/b> you<\/p>/.test(h), out.replace(/\n/g, '⏎') + ' | ' + h.replace(/\n/g, '⏎')];
      } finally { await p.close(); }
    });

  /* ================= YAML to JSON ================= */
  const YJ = '/developer/yaml-json/';
  claim(YJ, 'faq', 'Strings that YAML 1.1 would read as a boolean, number, date or null are quoted, and a round trip through PyYAML gives back the same JSON.',
    'JSON → YAML → PyYAML equals the JSON, for 60 tricky strings', N, async () => {
      if (py('import yaml') === null) return [false, 'PyYAML is needed for this check (pip install pyyaml)'];
      const strs = ['yes', 'no', 'on', 'Off', 'y', 'N', '0755', '1.0', '1e3', '1_000', '0x1F', '0b101', '12:30', '1:20:30', '2026-10-07', '2026-1-7 10:00', 'true', 'null', '~', '', ' lead', 'trail ', 'a: b', 'a #b', '#c', '- x', '[x]', '{y}', '.inf', '-.NaN', 'multi\nline\n', 'two\n\n', 'nonl\nend', '  indented\nfirst', 'tab\there', 'quote"s', "it's", '@at', '`tick', '%pct', '!bang', '&amp', '*star', '|pipe', '>gt', '?q', ':colon', 'a,b', 'ünï', '😀', '=', '<<', '+1', '-', 'x:', 'NO', 'Yes', '.5', '+.5', '0o17'];
      const obj = { list: strs, map: {} };
      strs.forEach((s, i) => { obj.map[s || 'empty'] = i; });
      obj.nest = [{ a: [1, 2.5, -3, true, null] }, [], {}, [[{}]]];
      const y = tx('yaml-json', JSON.stringify(obj), { dir: 'j2y' }).output;
      const back = py('import sys,yaml,json\nprint(json.dumps(yaml.safe_load(sys.stdin.read())))', y);
      return [!!back && JSON.stringify(JSON.parse(back)) === JSON.stringify(obj), back ? 'round trip ' + (JSON.stringify(JSON.parse(back)) === JSON.stringify(obj) ? 'equal' : 'differs') : 'PyYAML failed'];
    });
  claim(YJ, 'tip', 'Anchors (&name), aliases (*name) and the << merge key are expanded, so a compose or CI file comes out as the full JSON a program would see.',
    'a compose-style file agrees with PyYAML', N, async () => {
      if (py('import yaml') === null) return [false, 'PyYAML is needed for this check'];
      const y = 'x-common: &c\n  restart: always\n  env: [A, B]\nservices:\n  web:\n    <<: *c\n    ports:\n      - "80:80"\n  db:\n    <<: [*c]\n    restart: "no"\n    image: postgres:16\n';
      const mine = JSON.parse(tx('yaml-json', y, { dir: 'y2j' }).output);
      const ref = JSON.parse(py('import sys,yaml,json\nprint(json.dumps(yaml.safe_load(sys.stdin.read())))', y));
      return [JSON.stringify(mine) === JSON.stringify(ref), JSON.stringify(mine)];
    });
  claim(YJ, 'tip', 'Numbers keep every digit: a 20-digit ID is written to the JSON exactly as typed, not rounded as JavaScript would round it.', '12345678901234567890 stays', N, async () => {
    const r = tx('yaml-json', 'id: 12345678901234567890\nneg: -007\nhex: 0x10', { dir: 'y2j', indent: '0' });
    return [r.output.trim() === '{"id":12345678901234567890,"neg":-7,"hex":16}', r.output];
  });
  claim(YJ, 'tip', 'Words such as yes, no, on and off stay strings, as YAML 1.2 says. The tool warns, because older YAML 1.1 readers turn them into true and false.',
    'yes stays "yes" and is warned about', N, async () => {
    const r = tx('yaml-json', 'a: yes\nb: off', { dir: 'y2j', indent: '0' });
    return [r.output.trim() === '{"a":"yes","b":"off"}' && /Line 1/.test(r.warn) && /Line 2/.test(r.warn), r.output + ' | ' + r.warn];
  });
  claim(YJ, 'tip', 'Not read, with an error that says so: complex ? keys, custom tags such as !Ref or !Sub, and %TAG directives.',
    'each is refused with its line', N, async () => {
      const a = tx('yaml-json', 'a: 1\n? [x]\n: 2', { dir: 'y2j' }), b = tx('yaml-json', 'x: !Ref Thing', { dir: 'y2j' }), c = tx('yaml-json', '%TAG ! tag:x,2000:\n---\na: 1', { dir: 'y2j' });
      return [/line 2/.test(a.error) && /!Ref/.test(b.error) && /%TAG/.test(c.error), [a.error, b.error, c.error].join(' | ')];
    });
  claim(YJ, 'point', 'A duplicate key is an error, with both line numbers.', 'a: 1 / a: 2', N, async () => {
    const r = tx('yaml-json', 'a: 1\nb: 2\na: 3', { dir: 'y2j' });
    return [/first on line 1/.test(r.error) && /line 3/.test(r.error), r.error];
  });
  claim(YJ, 'faq', 'Documents split by --- become one JSON array, or JSON Lines if chosen.', 'three documents', N, async () => {
    const t = '---\na: 1\n---\n- 2\n---\nc\n';
    const r1 = tx('yaml-json', t, { dir: 'y2j', indent: '0' }), r2 = tx('yaml-json', t, { dir: 'y2j', docs: 'lines' });
    return [r1.output.trim() === '[{"a":1},[2],"c"]' && r2.output.trim() === '{"a":1}\n[2]\n"c"', r1.output + ' | ' + r2.output];
  });

  /* ================= Barcode generator ================= */
  const BC = '/developer/barcode-generator/';
  const lib = () => spec('barcode-generator')._lib;
  claim(BC, 'tip', 'Type the full number and it is checked: a wrong last digit is reported, never quietly fixed.',
    'GS1 check digits of published numbers; a wrong one is refused', N, async () => {
      /* published examples: GS1's 5012345678900 family, Stabilo 4006381333931, UPC 036000291452, ISBN 978-0-306-40615-7 */
      const ok = ['5012345678900', '4006381333931', '9780306406157'].every((v) => !tx('barcode-generator', v).error) && !tx('barcode-generator', '036000291452', { sym: 'upca' }).error;
      const bad = tx('barcode-generator', '4006381333932');
      return [ok && /should be 1, not 2/.test(bad.error || ''), bad.error];
    });
  claim(BC, 'tip', 'Sizes are real: at 0.33 mm bar width an EAN-13 is 37.3 mm wide with its quiet zones, which is GS1’s 100% size.',
    'the SVG is 37.29 mm wide: 113 modules of 0.33 mm', N, async () => {
      const r = tx('barcode-generator', '501234567890');
      return [/width="37\.29mm"/.test(r.output) && /viewBox="0 0 113 /.test(r.output), r.output.slice(0, 120)];
    });
  claim(BC, 'tip', 'An ISBN-10 such as 0-306-40615-2 typed as EAN-13 becomes the ISBN-13 978-0-306-40615-7 barcode.', 'ISBN conversion', N, async () => {
    const r = tx('barcode-generator', '0-306-40615-2');
    return [K.stat(r, 'First encodes') === '9780306406157', K.stat(r, 'First encodes') + ' | ' + r.warn];
  });
  claim(BC, 'point', 'Code 128 starts in code set C for runs of digits, two to a symbol, and switches to set B for letters and A for control characters; the check symbol is the weighted sum modulo 103.',
    'the values for "AB1234" and "1234a" by hand from ISO/IEC 15417', N, async () => {
      /* AB1234: Start B 104, A 33, B 34, then 4 digits at the end → Code C 99, 12, 34; check (104+33+2*34+3*99+4*12+5*34)%103 */
      const v1 = lib().code128Values('AB1234');
      const c1 = (104 + 33 + 2 * 34 + 3 * 99 + 4 * 12 + 5 * 34) % 103;
      /* 1234a: Start C 105, 12, 34, Code B 100, a = 65; check */
      const v2 = lib().code128Values('1234a');
      const c2 = (105 + 12 + 2 * 34 + 3 * 100 + 4 * 65) % 103;
      return [JSON.stringify(v1) === JSON.stringify([104, 33, 34, 99, 12, 34, c1, 106]) && JSON.stringify(v2) === JSON.stringify([105, 12, 34, 100, 65, c2, 106]), JSON.stringify(v1) + ' ' + JSON.stringify(v2)];
    });
  claim(BC, 'tip', 'Paste a list, one value per line, for a whole range at once: download every barcode as a ZIP of SVG and PNG files, or a PDF sheet of labels.',
    'the ZIP holds an SVG and a PNG per value, PNGs carry 300 dpi; the PDF has a page of labels', B, async () => {
      const p = await K.open(BC);
      try {
        await p.evaluate(() => { const ta = document.querySelector('.code-area'); ta.value = '501234567890\n4006381333931\n9780306406157'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
        await K.sleep(500);
        await K.clickText(p, '.io-actions button', /^ZIP of all$/);
        await K.sleep(1500);
        await K.clickText(p, '.io-actions button', /^PDF sheet$/);
        await K.sleep(800);
        const dl = await K.downloads(p);
        const zip = dl.find((d) => /\.zip$/.test(d.name)), pdf = dl.find((d) => /\.pdf$/.test(d.name));
        const names = zip ? K.zipNames(zip.bytes).map((n) => n.name || n) : [];
        let dpi = 0;
        if (zip) { const i = zip.bytes.indexOf(Buffer.from('pHYs')); if (i > 0) dpi = Math.round(zip.bytes.readUInt32BE(i + 4) * 0.0254); }
        const pdfOk = pdf && /^%PDF-1\.4/.test(pdf.bytes.slice(0, 8).toString()) && /\/Count 1/.test(pdf.bytes.toString('latin1'));
        return [names.length === 6 && names.filter((n) => /\.svg$/.test(n)).length === 3 && dpi === 300 && pdfOk, names.join(', ') + ' | dpi ' + dpi + ' | pdf ' + (pdf ? pdf.bytes.length + ' B' : 'none')];
      } finally { await p.close(); }
    });
  claim(BC, 'faq', 'GS1 allows 80% to 200% of nominal size, a bar width of 0.264 mm to 0.66 mm.', 'the sizes offered include 80% (0.264 mm) and 100% (0.33 mm)', N, async () => {
    const o = spec('barcode-generator').options.find((x) => x.key === 'x').options.map((x) => x.value);
    return [o.indexOf('0.264') >= 0 && o.indexOf('0.33') >= 0, o.join(', ')];
  });
  manual(BC, 'faq', 'A made-up EAN may already belong to someone else’s product.', 'advice about GS1 number allocation; nothing to run');

  /* ================= Colour contrast checker ================= */
  const CC = '/developer/color-contrast-checker/';
  /* WCAG 2.x relative luminance, written out again from the specification */
  const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  claim(CC, 'point', 'Contrast equals (L1 + 0.05) / (L2 + 0.05), L1 being the lighter luminance, cut to two decimals and never rounded up, so a pair just under a threshold fails here as in an audit.',
    'hand-worked pairs and 500 random pairs against the formula, cut not rounded', N, async () => {
      /* by hand: black/white (1+0.05)/(0+0.05) = 21; #767676: c = 118/255 = 0.46275, ((c+0.055)/1.055)^2.4 = 0.18116, 1.05/0.23116 = 4.542 */
      const hand = [['#000000', '#ffffff', '21.00'], ['#767676', '#ffffff', '4.54'], ['#777777', '#ffffff', '4.47']];
      const bad = [];
      hand.forEach(([f, b, want]) => { const r = gen('color-contrast-checker', { fg: f, bg: b }); if (K.stat(r, 'Contrast ratio') !== want + ':1') bad.push(f + ' ' + K.stat(r, 'Contrast ratio')); });
      let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % 16777216; };
      for (let i = 0; i < 500; i++) {
        const f = '#' + rnd().toString(16).padStart(6, '0'), b = '#' + rnd().toString(16).padStart(6, '0');
        const r = gen('color-contrast-checker', { fg: f, bg: b });
        const want = (Math.floor(ratio(f, b) * 100 + 1e-9) / 100).toFixed(2) + ':1';
        if (K.stat(r, 'Contrast ratio') !== want || (K.stat(r, 'Normal text AA') === 'Pass') !== ratio(f, b) >= 4.5) bad.push(f + ' on ' + b + ': ' + K.stat(r, 'Contrast ratio') + ' want ' + want);
      }
      /* a pair whose ratio is 4.4999…: shown 4.49 and failing */
      let near = null;
      for (let g = 0; g < 256 && !near; g++) for (let k = 0; k < 256; k++) { const f = '#' + [g, g, k].map((x) => x.toString(16).padStart(2, '0')).join(''); const r0 = ratio(f, '#ffffff'); if (r0 < 4.5 && r0 >= 4.495) { near = f; break; } }
      const rn = near ? gen('color-contrast-checker', { fg: near, bg: '#ffffff' }) : null;
      return [bad.length === 0 && !!rn && K.stat(rn, 'Contrast ratio') === '4.49:1' && K.stat(rn, 'Normal text AA') === 'Fail', (bad.slice(0, 3).join('; ') || '503 pairs agree') + ' | ' + near + ' → ' + (rn && K.stat(rn, 'Contrast ratio'))];
    });
  claim(CC, 'dfaq', 'For 8-bit colours no channel value falls between the two, so every result is the same.', '0.03928 and 0.04045 split the 256 values identically', N, async () => {
    const a = [], b = [];
    for (let v = 0; v < 256; v++) { a.push(v / 255 <= 0.03928); b.push(v / 255 <= 0.04045); }
    return [JSON.stringify(a) === JSON.stringify(b), 'values at or below: ' + a.filter(Boolean).length + ' and ' + b.filter(Boolean).length];
  });
  claim(CC, 'tip', 'A see-through text colour, such as rgb(0 0 0 / 60%), is blended onto the background first, which is how it is seen.', 'rgb(0 0 0 / 60%) on white is #666666', N, async () => {
    const r = gen('color-contrast-checker', { fg: 'rgb(0 0 0 / 60%)', bg: '#ffffff' });
    const want = (Math.floor(ratio('#666666', '#ffffff') * 100) / 100).toFixed(2);
    return [/#666666/.test(r.output) && K.stat(r, 'Contrast ratio') === want + ':1', K.stat(r, 'Contrast ratio') + ' | ' + r.warn];
  });
  claim(CC, 'tip', 'Paste a list of pairs, one per line, such as #555 on #f5f5f5, to check a whole palette or a theme’s tokens at once.', 'four spellings of a pair', N, async () => {
    const r = gen('color-contrast-checker', { pairs: '#555 on #f5f5f5\n#555\t#f5f5f5\n#555 | #f5f5f5\nrgb(85, 85, 85), whitesmoke' });
    const want = (Math.floor(ratio('#555555', '#f5f5f5') * 100) / 100).toFixed(2) + ':1';
    return [r.rows && r.rows.length === 4 && r.rows.every((x) => (Math.floor(x.ratio * 100) / 100).toFixed(2) + ':1' === want), r.rows && r.rows.map((x) => x.ratio.toFixed(3)).join(', ')];
  });
  claim(CC, 'point', 'The suggested fixes keep the hue and move only the lightness, for the text colour or the background, to the nearest value that passes.',
    'every suggestion passes its target by the formula', N, async () => {
      const bad = [];
      ['#f7c948', '#2dd4ff', '#ff4500', '#999999', '#7c5cff'].forEach((f) => {
        const r = gen('color-contrast-checker', { fg: f, bg: '#ffffff' });
        (r.fixes || []).forEach((x) => { if (x.fg && ratio(x.fg, '#ffffff') < x.target) bad.push(x.fg); if (x.bg && ratio(f, x.bg) < x.target) bad.push(x.bg); });
      });
      return [bad.length === 0, bad.join(', ') || 'all pass'];
    });
  claim(CC, 'tip', 'A link to this page can carry the pair: add ?fg=1a1a1a&bg=f7c948, and fcolor and bcolor are read too.', 'both link forms set the pair', B, async () => {
    const res = [];
    for (const q of ['?fg=1a1a1a&bg=f7c948', '?fcolor=1A1A1A&bcolor=F7C948']) {
      const p = await K.open(CC + q);
      try { res.push(await p.evaluate(() => [...document.querySelectorAll('.stat-row')].find((r) => /Contrast ratio/.test(r.textContent)).lastChild.textContent)); }
      finally { await p.close(); }
    }
    const want = (Math.floor(ratio('#1a1a1a', '#f7c948') * 100) / 100).toFixed(2) + ':1';
    return [res[0] === want && res[1] === want, res.join(' | ') + ' want ' + want];
  });
  manual(CC, 'what', 'About one man in twelve has a colour vision deficiency', 'a published prevalence figure (about 8% of men of Northern European descent); needs a dated source');
};
