#!/usr/bin/env node
/**
 * The developer tools added in wave 6, each checked against a reference
 * that is not its own engine.
 *
 *   node build/tests/dev-w6.js [--root DIR] [--port 9042] [--node-only]
 *                              [--acorn FILE] [--pypath DIR]
 *
 * --root is the site (default: the one this file sits in), served on --port
 * for the browser part. --acorn names acorn.js (MIT; npm pack acorn) for the
 * JavaScript AST comparison; --pypath a folder holding the optional Python
 * packages zxingcpp (barcode reading) and sqlparse. A missing optional
 * reference is reported as SKIP, never as a pass. Exit code 2 when a case
 * fails, 1 when the run itself breaks.
 *
 *  1  Unix timestamp: instants in 40 zones against Python's zoneinfo; wall
 *     times through clock changes (fold 0); ISO week and day of the year
 *     against Python's isocalendar; RFC 2822 read back by email.utils
 *  2  Colour contrast: the WCAG 2 formula written out here, hand-worked
 *     values, 2,000 random pairs, the cut (never rounded up) at 4.5
 *  3  YAML: documents PyYAML writes in block, flow and mixed styles read
 *     back equal; JSON → YAML read back equal by PyYAML; refusals by line
 *  4  SQL: formatted and minified queries give SQLite the same rows; tokens
 *     agree with sqlparse's (optional)
 *  5  JavaScript: every script of the site minified and beautified parses to
 *     the same AST under acorn (optional)
 *  6  Barcodes: every type decoded from the SVG by a reader written here
 *     from the symbology tables (widths, not the engine's bit strings), 600
 *     random values; PNG rasters read by zxing-cpp (optional)
 *  7  Browser: CSS minified and beautified reads to the same CSSOM in Chrome
 *     for every stylesheet of the site; HTML of 12 site pages minified and
 *     beautified renders the same innerText; a PNG from the page reads in
 *     zxing-cpp; the seven pages at 390 and 1400 px: no script error, no
 *     outside request, no sideways scroll
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ROOT = path.resolve(arg('--root', path.join(__dirname, '..', '..')));
const PORT = Number(arg('--port', 9042));
const NODE_ONLY = argv.includes('--node-only');
const ACORN = arg('--acorn', '');
const PYPATH = arg('--pypath', '');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-w6-'));

let pass = 0, fail = 0, skipped = 0;
function check(ok, what, detail) {
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + what + (!ok && detail !== undefined ? '   (' + String(detail).slice(0, 500) + ')' : ''));
}
function skip(what) { skipped++; console.log('SKIP  ' + what); }
const section = (t) => console.log('\n--- ' + t);

function context() {
  const sb = { console, Intl, TextEncoder, TextDecoder, URL, URLSearchParams, atob, btoa, crypto: require('crypto').webcrypto, navigator: { language: 'en-GB' }, setTimeout, clearTimeout };
  sb.window = sb; sb.self = sb;
  return vm.createContext(sb);
}
function tool(slug) {
  const html = fs.readFileSync(path.join(ROOT, 'developer', slug, 'index.html'), 'utf8');
  const c = context();
  const re = /<script src="\/engine\/([^"]+\.js)"/g;
  let m;
  while ((m = re.exec(html))) if (!/^render-/.test(m[1])) vm.runInContext(fs.readFileSync(path.join(ROOT, 'engine', m[1]), 'utf8'), c, { filename: m[1] });
  return { spec: c.DEV_TOOLS[slug], ctx: c };
}
const defs = (s) => { const d = {}; (s.options || s.fields || []).forEach((o) => { d[o.key] = o.default; }); return d; };
const tx = (s, input, o) => s.transform(String(input), Object.assign(defs(s), o || {})) || {};
const gen = (s, f) => s.generate(Object.assign(defs(s), f || {})) || {};
function py(code, input, extraPath) {
  const env = Object.assign({}, process.env);
  if (extraPath) env.PYTHONPATH = extraPath;
  try { return execFileSync('python3', extraPath ? ['-s', '-c', code] : ['-I', '-c', code], { input: input || '', encoding: 'utf8', env: env, cwd: TMP, maxBuffer: 64 * 1024 * 1024 }); }
  catch (e) { return null; }
}
const hasPy = py('print(1)') !== null;
const hasYaml = hasPy && py('import yaml; print(1)') !== null;
let seed = 12345;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };

/* ====================================================================== 1 */
function testUnix() {
  section('1  Unix timestamp: zoneinfo, isocalendar, email.utils');
  if (!hasPy) { skip('python3 is not available: section 1'); return; }
  const U = tool('unix-timestamp').spec;
  const known = new Set((py('import zoneinfo\nprint("\\n".join(sorted(zoneinfo.available_timezones())))') || '').trim().split('\n'));
  const zones = U.options[0].options.map((o) => o.value).filter((z) => z !== 'local' && known.has(z));
  const pick = [];
  for (let i = 0; i < 40; i++) pick.push(zones[(i * 37) % zones.length]);
  pick.push('UTC', 'Europe/London', 'America/New_York', 'Asia/Kolkata', 'Australia/Lord_Howe', 'Asia/Kathmandu', 'Pacific/Chatham', 'America/St_Johns');
  const inst = [];
  /* from 1970 on: before it the tz database leaves linked zones' history to an optional file, and copies differ */
  for (let i = 0; i < 600; i++) inst.push([pick[i % pick.length], rnd(2 ** 31) + rnd(2 ** 30)]);
  const ref = py('import sys,json\nfrom zoneinfo import ZoneInfo\nfrom datetime import datetime,timezone\nfor z,t in json.loads(sys.stdin.read()):\n  d=datetime.fromtimestamp(t,timezone.utc).astimezone(ZoneInfo(z))\n  s=d.isoformat()\n  if z=="UTC": s=s.replace("+00:00","Z")\n  ic=d.isocalendar()\n  print(s, "%d-W%02d"%(ic[0],ic[1]), d.timetuple().tm_yday)', JSON.stringify(inst));
  if (!ref) { skip('Python zoneinfo did not run'); return; }
  const want = ref.trim().split('\n');
  let bad = [];
  inst.forEach(([z, t], i) => {
    const r = tx(U, String(t), { zone: z, out: 'all', unit: 's' });
    const w = want[i].split(' ');
    const iso = (new RegExp('\\n  ' + z.replace(/[/+]/g, '\\$&') + ' +(\\S+)').exec(r.output) || /UTC +(\S+)/.exec(r.output) || [])[1];
    const cal = /day (\d+) of -?\d+ · ISO week (\S+)/.exec(r.output) || [];
    if (iso !== w[0] || cal[2] !== w[1] || cal[1] !== w[2]) bad.push(z + ' ' + t + ': ' + iso + ' ' + cal[2] + ' ' + cal[1] + ' / ' + want[i]);
  });
  check(bad.length === 0, inst.length + ' instants in ' + new Set(pick).size + ' zones: ISO 8601 with offset, ISO week and day of the year equal zoneinfo and isocalendar', bad.slice(0, 3).join('; '));
  /* wall times, including every clock change of 2026-2027 in four zones */
  const walls = [];
  for (let i = 0; i < 300; i++) walls.push([pick[i % pick.length], 1970 + rnd(70), 1 + rnd(12), 1 + rnd(28), rnd(24), rnd(60), rnd(60)]);
  const tr = py('import json\nfrom zoneinfo import ZoneInfo\nfrom datetime import datetime,timedelta,timezone\nout=[]\nfor z in ["Europe/London","America/New_York","Australia/Sydney","Pacific/Chatham"]:\n  tz=ZoneInfo(z); t=datetime(2026,1,1,tzinfo=timezone.utc); prev=t.astimezone(tz).utcoffset()\n  while t.year<2028:\n    t+=timedelta(minutes=15); o=t.astimezone(tz).utcoffset()\n    if o!=prev:\n      w=t.astimezone(tz).replace(tzinfo=None)\n      for dm in (-45,-15,0,15,30,59):\n        v=w+timedelta(minutes=dm); out.append([z,v.year,v.month,v.day,v.hour,v.minute,0])\n    prev=o\nprint(json.dumps(out))');
  if (tr) JSON.parse(tr).forEach((x) => walls.push(x));
  const wref = py('import sys,json\nfrom zoneinfo import ZoneInfo\nfrom datetime import datetime\nfor z,y,mo,d,h,mi,s in json.loads(sys.stdin.read()):\n  print(int(datetime(y,mo,d,h,mi,s,tzinfo=ZoneInfo(z)).timestamp()))', JSON.stringify(walls)).trim().split('\n');
  bad = [];
  const p2 = (n) => String(n).padStart(2, '0');
  walls.forEach((c, i) => {
    const r = tx(U, c[1] + '-' + p2(c[2]) + '-' + p2(c[3]) + 'T' + p2(c[4]) + ':' + p2(c[5]) + ':' + p2(c[6]), { zone: c[0], out: 's' });
    if (String(r.output) !== wref[i]) bad.push(c.join(' ') + ' → ' + r.output + ' / ' + wref[i]);
  });
  check(bad.length === 0, walls.length + ' wall times (' + (walls.length - 300) + ' beside clock changes) read as zoneinfo reads them with fold 0', bad.slice(0, 3).join('; '));
  const rfc = [];
  for (let i = 0; i < 100; i++) rfc.push([pick[i % pick.length], rnd(2 ** 31)]);
  const outs = rfc.map(([z, t]) => tx(U, String(t), { zone: z, out: 'rfc' }).output);
  const back = py('import sys,json,email.utils\nfor s in json.loads(sys.stdin.read()):\n  print(int(email.utils.parsedate_to_datetime(s).timestamp()))', JSON.stringify(outs));
  check(!!back && back.trim().split('\n').every((v, i) => v === String(rfc[i][1])), '100 RFC 2822 dates read back by email.utils to the same instant', outs[0]);
  /* units */
  const u = tx(U, '1791374400\n1791374400123\n1791374400123456\n1791374400123456789\n-1.5', { zone: 'UTC', out: 'utc' }).output.split('\n');
  check(u.join(' ') === '2026-10-07T12:00:00Z 2026-10-07T12:00:00.123Z 2026-10-07T12:00:00.123456Z 2026-10-07T12:00:00.123456789Z 1969-12-31T23:59:58.500Z', 'seconds, ms, µs and ns by digits, fractions to the nanosecond, negative times', u.join(' '));
}

/* ====================================================================== 2 */
function testContrast() {
  section('2  Colour contrast: the WCAG 2 formula');
  const C = tool('color-contrast-checker').spec;
  const lin = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };   /* WCAG 2.0's printed threshold */
  const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const cut = (r) => (Math.floor(r * 100 + 1e-9) / 100).toFixed(2) + ':1';
  /* by hand (4 d.p.): #767676 → L 0.1812, 4.54; #595959 → L 0.0999, 7.00; #f7c948 → L 0.6202, 1.56; #0000ff → L 0.0722, 8.59 */
  const hand = [['#767676', '#ffffff', '4.54:1', '0.1812'], ['#595959', '#ffffff', '7.00:1', '0.0999'], ['#f7c948', '#ffffff', '1.56:1', '0.6202'], ['#0000ff', '#ffffff', '8.59:1', '0.0722'], ['#ffffff', '#000000', '21.00:1', '1.0000']];
  const bad = hand.filter(([f, b, r, l]) => { const g = gen(C, { fg: f, bg: b }); return (g.stats.find((x) => x[0] === 'Contrast ratio') || [])[1] !== r || g.output.indexOf('relative luminance ' + l) < 0; });
  check(bad.length === 0, '5 hand-worked pairs: ratio and luminance', JSON.stringify(bad));
  const errs = [];
  for (let i = 0; i < 2000; i++) {
    const f = '#' + rnd(16777216).toString(16).padStart(6, '0'), b = '#' + rnd(16777216).toString(16).padStart(6, '0');
    const g = gen(C, { fg: f, bg: b });
    const st = (k) => (g.stats.find((x) => x[0] === k) || [])[1];
    const r = ratio(f, b);
    if (st('Contrast ratio') !== cut(r) || st('Normal text AA') !== (r >= 4.5 ? 'Pass' : 'Fail') || st('Normal text AAA') !== (r >= 7 ? 'Pass' : 'Fail') || st('Large text AA') !== (r >= 3 ? 'Pass' : 'Fail')) errs.push(f + '/' + b);
  }
  check(errs.length === 0, '2,000 random pairs: ratio cut to two decimals and every pass/fail as the formula gives', errs.slice(0, 5).join(', '));
}

/* ====================================================================== 3 */
function testYaml() {
  section('3  YAML: against PyYAML');
  if (!hasYaml) { skip('PyYAML is not available: section 3'); return; }
  const Y = tool('yaml-json').spec;
  const docs = py('import json,random,yaml\nrandom.seed(6)\nwords=["alpha","Beta","x y","a:b","it\'s","q\\"","#h","- d","tab\\t","\\u00e9t\\u00e9","", " sp", "yes", "1.0", "null", "007", "2026-10-07", "@x", "%p"]\ndef val(d):\n  r=random.random()\n  if d>3 or r<0.45:\n    return random.choice([random.choice(words+["multi\\nline","two\\n\\nparas "]), random.randint(-10**6,10**6), round(random.uniform(-1e4,1e4),3), True, False, None])\n  if r<0.75: return [val(d+1) for _ in range(random.randint(0,4))]\n  return {random.choice(words)+str(i): val(d+1) for i in range(random.randint(0,4))}\nout=[]\nfor i in range(300):\n  v={"k%d"%j: val(0) for j in range(random.randint(1,5))}\n  style=[False,None,True][i%3]\n  out.append([yaml.safe_dump(v, default_flow_style=style, allow_unicode=bool(i%2), width=[80,20,1000][i%3], sort_keys=bool(i%4)), json.dumps(v)])\nprint(json.dumps(out))');
  const list = JSON.parse(docs);
  const bad = [];
  list.forEach(([y, j]) => {
    const r = tx(Y, y, { dir: 'y2j', indent: '0' });
    if (r.error || JSON.stringify(sortDeep(JSON.parse(r.output))) !== JSON.stringify(sortDeep(JSON.parse(j)))) bad.push((r.error || 'differs') + ' :: ' + JSON.stringify(y.slice(0, 160)));
  });
  check(bad.length === 0, list.length + ' documents PyYAML wrote (block, flow, mixed; widths 20-1000) read back to the same values (key order aside: PyYAML sorts)', bad.slice(0, 2).join(' || '));
  const outs = list.map(([, j]) => tx(Y, j, { dir: 'j2y' }).output);
  const back = py('import sys,json,yaml\nfor y in json.loads(sys.stdin.read()):\n  print(json.dumps(yaml.safe_load(y), sort_keys=True))', JSON.stringify(outs));
  const ok = back && back.trim().split('\n').every((b, i) => b === JSON.stringify(JSON.parse(list[i][1]), Object.keys(JSON.parse(list[i][1])).sort ? undefined : undefined) || JSON.stringify(sortDeep(JSON.parse(b))) === JSON.stringify(sortDeep(JSON.parse(list[i][1]))));
  check(!!ok, list.length + ' JSON values written as YAML read back equal by PyYAML (YAML 1.1)');
  /* hand cases from the YAML 1.2 specification, chapter 2 and 8 */
  const spec = [
    ['- Mark McGwire\n- Sammy Sosa\n- Ken Griffey\n', ['Mark McGwire', 'Sammy Sosa', 'Ken Griffey']],
    ['hr:  65    # Home runs\navg: 0.278 # Batting average\nrbi: 147   # Runs Batted In', { hr: 65, avg: 0.278, rbi: 147 }],
    ['american:\n- Boston Red Sox\n- Detroit Tigers\nnational:\n- New York Mets\n', { american: ['Boston Red Sox', 'Detroit Tigers'], national: ['New York Mets'] }],
    ['- [name        , hr, avg  ]\n- [Mark McGwire, 65, 0.278]', [['name', 'hr', 'avg'], ['Mark McGwire', 65, 0.278]]],
    ['>\n Mark McGwire\'s\n year was crippled\n by a knee injury.\n', 'Mark McGwire\'s year was crippled by a knee injury.\n'],
    ['>\n Sammy Sosa completed another\n fine season with great stats.\n\n   63 Home Runs\n   0.288 Batting Average\n\n What a year!\n', 'Sammy Sosa completed another fine season with great stats.\n\n  63 Home Runs\n  0.288 Batting Average\n\nWhat a year!\n'],
    ['strip: |-\n  text\nclip: |\n  text\nkeep: |+\n  text\n', { strip: 'text', clip: 'text\n', keep: 'text\n' }],
    ['unicode: "Sosa did fine.\\u263A"\ncontrol: "\\b1998\\t1999\\t2000\\n"\nsingle: \'"Howdy!" he cried.\'\nquoted: \' # Not a \'\'comment\'\'.\'', { unicode: 'Sosa did fine.\u263A', control: '\b1998\t1999\t2000\n', single: '"Howdy!" he cried.', quoted: ' # Not a \'comment\'.' }],
    ['canonical: 12345\noctal: 0o14\nhexadecimal: 0xC\nfloat: 1.23015e+3\nneg: -.inf', null]
  ];
  const sbad = [];
  spec.forEach(([y, want], i) => {
    const r = tx(Y, y, { dir: 'y2j', indent: '0' });
    if (want === null) { if (r.output.trim() !== '{"canonical":12345,"octal":12,"hexadecimal":12,"float":1230.15,"neg":null}' || !/no JSON form/.test(r.warn || '')) sbad.push(i + ': ' + r.output + r.warn); return; }
    if (r.error || JSON.stringify(JSON.parse(r.output)) !== JSON.stringify(want)) sbad.push(i + ': ' + (r.error || r.output));
  });
  check(sbad.length === 0, spec.length + ' examples from the YAML 1.2 specification, by hand', sbad.join(' | '));
  const errs = [['a: 1\n\tb: 2', 2], ['a: [1, 2\nb: 3', 1], ['a: "x\nb', 1], ['- a\nb: 1', 2], ['a: *nope', 1], ['a: 1\n  - b', 2]];
  const ebad = errs.filter(([y, line]) => { const r = tx(Y, y, { dir: 'y2j' }); return !r.error || !(r.errorAt && r.errorAt.line === line); });
  check(ebad.length === 0, errs.length + ' broken documents refused with the right line', JSON.stringify(ebad.map((e) => [e[0], tx(Y, e[0], { dir: 'y2j' }).error])));
}
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = sortDeep(v[k]); }); return o; }
  return v;
}

/* ====================================================================== 4 */
function testSql() {
  section('4  SQL: SQLite runs both; sqlparse tokens');
  if (!hasPy) { skip('python3 is not available: section 4'); return; }
  const S = tool('sql-formatter').spec;
  const cols = ['id', 'name', 'qty', 'price', 'status'];
  const qs = [];
  for (let i = 0; i < 120; i++) {
    const c = cols.slice(0, 1 + rnd(5)).join(', ');
    const cond = ['qty > ' + rnd(5), "status <> 'x'", 'price between 1 and ' + (rnd(90) + 10), "name like '%a%'", 'id in (select id from t where qty >= ' + rnd(3) + ')', 'not (qty = 1 or qty = 2)', "coalesce(status, 'n') = 'ok'", 'qty * price - -1 > 5'];
    let q = 'select ' + (rnd(3) ? c : 'count(*) as n, sum(price) / 2.0 as half') + ' from t where ' + cond[rnd(8)] + ' and ' + cond[rnd(8)];
    if (rnd(2)) q = 'select ' + c + ', case when qty > 2 then \'many\' when qty = 0 then \'none\' else \'some\' end as k from t /* c */ where ' + cond[rnd(8)] + ' -- end\n';
    if (rnd(3) === 0) q = 'with x as (select id, qty from t where ' + cond[rnd(8)] + ') select x.id, t.name from x join t on t.id = x.id order by x.id desc limit ' + (1 + rnd(9));
    if (!/limit|count/.test(q)) q += ' order by id';
    qs.push(q);
  }
  const pairs = [];
  for (const q of qs) for (const o of [{}, { mode: 'minify' }, { case: 'lower', indent: 'tab' }, { mode: 'minify', comments: 'keep' }, { dialect: 'sqlite' }, { dialect: 'postgresql' }]) {
    const r = tx(S, q, o);
    pairs.push([q, r.error ? 'ERROR ' + r.error : r.output]);
  }
  const out = py("import sys,json,sqlite3\ndb=sqlite3.connect(':memory:')\ndb.execute('create table t(id integer, name text, qty integer, price real, status text)')\nfor i in range(1,80): db.execute('insert into t values(?,?,?,?,?)',(i,'n'+chr(97+i%26),i%5,i*1.25,None if i%7==0 else ('ok' if i%3 else 'x')))\nbad=[]\nfor a,b in json.loads(sys.stdin.read()):\n  try:\n    if db.execute(a).fetchall()!=db.execute(b).fetchall(): bad.append(b)\n  except Exception as e: bad.append(str(e)+' :: '+b)\nprint(len(bad)); print(json.dumps(bad[:3]))", JSON.stringify(pairs));
  const lines = (out || '').split('\n');
  check(lines[0] === '0', pairs.length + ' formatted and minified queries (6 settings) return the same rows from SQLite as the originals', lines.slice(0, 2).join(' '));
  if (!PYPATH || py('import sqlparse', '', PYPATH) === null) { skip('sqlparse is not available (pass --pypath with it installed): token comparison'); return; }
  const tok = py("import sys,json,sqlparse\nfrom sqlparse import tokens as T\nfor a,b in json.loads(sys.stdin.read()):\n  f=lambda s:[t.value if t.ttype in T.String or t.ttype in T.Literal.String or (t.ttype in T.Name and t.value[:1] in '\"`[') else t.value.upper() for st in sqlparse.parse(s) for t in st.flatten() if not t.is_whitespace and t.ttype not in T.Comment]\n  ok=f(a)==f(b)\n  print(int(ok))\n  if not ok: sys.stderr.write(json.dumps([f(a),f(b)])+chr(10))", JSON.stringify(pairs.filter((p, i) => i % 6 === 0 || i % 6 === 1)), PYPATH);
  const t = (tok || '').trim().split('\n');
  check(tok && t.every((x) => x === '1'), t.length + ' formatted or minified queries have the same tokens, comments aside, as sqlparse reads them', t.filter((x) => x !== '1').length + ' differ');
}

/* ====================================================================== 5 */
function testJs() {
  section('5  JavaScript: acorn ASTs');
  let acorn = null;
  try { acorn = require(ACORN || 'acorn'); } catch (e) { acorn = null; }
  if (!acorn) { skip('acorn is not available (pass --acorn path/to/acorn.js): AST comparison'); return; }
  const M = tool('code-minifier').ctx.CODE_LANG;
  const strip = (n) => JSON.stringify(n, (k, v) => (k === 'start' || k === 'end' || k === 'raw' ? undefined : v));
  const parse = (s, mod) => acorn.parse(s, { ecmaVersion: 'latest', sourceType: mod ? 'module' : 'script', allowHashBang: true, allowReturnOutsideFunction: true });
  const files = [];
  for (const d of ['engine', 'assets', 'engine/vendor']) {
    const dir = path.join(ROOT, d);
    if (fs.existsSync(dir)) fs.readdirSync(dir).filter((f) => /\.m?js$/.test(f)).forEach((f) => files.push(path.join(d, f)));
  }
  let ok = 0, bytes = 0; const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (src.length > 3e6) continue;
    let ref, mod = /\.mjs$/.test(f);
    try { ref = strip(parse(src, mod)); } catch (e) { try { mod = true; ref = strip(parse(src, true)); } catch (e2) { continue; } }
    for (const [name, fn] of [['minified', M.minifyJs], ['beautified', M.beautifyJs]]) {
      let got;
      try { got = strip(parse(fn(src, {}), mod)); } catch (e) { bad.push(name + ' ' + f + ': ' + e.message); continue; }
      if (got === ref) ok++; else bad.push(name + ' ' + f + ': AST differs');
    }
    bytes += src.length;
  }
  check(bad.length === 0 && ok > 100, ok + ' minified and beautified scripts of the site (' + (bytes / 1048576).toFixed(1) + ' MB) parse to the same AST as the originals', bad.slice(0, 3).join('; '));
}

/* ====================================================================== 6 */
/* Reader written from the symbology tables: element widths, as the standards print them */
const EAN_W = ['3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112'];   /* L/R digits: space-bar-space-bar for L */
const EAN_FIRST = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const C128_W = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ');
const C39_BS = { /* bars and spaces, 1 = wide, 9 elements */ '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000', '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101', '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001', 'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000', 'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100', 'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011', 'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110', 'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001', 'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000', '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000', '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100' };
const ITF_W = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010'];
function runsFromSvg(svg) {
  /* bars between the bearer bars, as runs of modules: [bar, space, bar, …] */
  const rects = [];
  const re = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g;
  let m;
  while ((m = re.exec(svg))) rects.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
  /* bars are whole modules wide; the ITF-14 frame's sides (2.4 modules) are not bars */
  const bars = rects.filter((r) => r.h > 10 && r.w < 6 && Math.abs(r.w - Math.round(r.w)) < 1e-6).sort((a, b) => a.x - b.x);
  const runs = [];
  for (let i = 0; i < bars.length; i++) {
    if (i) runs.push(Math.round(bars[i].x - bars[i - 1].x - bars[i - 1].w));
    runs.push(Math.round(bars[i].w));
  }
  return runs;
}
const gs1 = (d) => { let s = 0; for (let i = d.length - 1, w = 3; i >= 0; i--, w = 4 - w) s += +d[i] * w; return String((10 - s % 10) % 10); };
function readEanRuns(runs, len) {
  /* simpler and stricter: module bits, then 7-module groups */
  let bits = '';
  runs.forEach((w, i) => { bits += (i % 2 ? '0' : '1').repeat(w); });
  const half = len / 2;
  const toW = (s) => { const out = []; let c = s[0], n = 0; for (const ch of s) { if (ch === c) n++; else { out.push(n); c = ch; n = 1; } } out.push(n); return out.join(''); };
  if (bits.slice(0, 3) !== '101') throw new Error('start');
  let d = '', par = '';
  for (let i = 0; i < half; i++) {
    const g = bits.substr(3 + i * 7, 7);
    if (g[0] !== '0' || g[6] !== '1') throw new Error('left group ' + g);
    const w = toW(g);
    let n = EAN_W.indexOf(w);
    if (n >= 0) { par += 'L'; } else { n = EAN_W.findIndex((t) => t.split('').reverse().join('') === w); par += 'G'; }
    if (n < 0) throw new Error('left ' + g);
    d += n;
  }
  const mid = 3 + half * 7;
  if (bits.substr(mid, 5) !== '01010') throw new Error('centre');
  for (let i = 0; i < half; i++) {
    const g = bits.substr(mid + 5 + i * 7, 7);
    if (g[0] !== '1' || g[6] !== '0') throw new Error('right group ' + g);
    const n = EAN_W.indexOf(toW(g));
    if (n < 0) throw new Error('right ' + g);
    d += n;
  }
  if (bits.substr(mid + 5 + half * 7) !== '101') throw new Error('end guard');
  if (len === 8) { if (par !== 'LLLL') throw new Error('EAN-8 parity'); return d; }
  const f = EAN_FIRST.indexOf(par);
  if (f < 0) throw new Error('parity ' + par);
  return f + d;
}
function read128(runs) {
  const vals = [];
  let k = 0;
  while (k + 6 <= runs.length) {
    const w = runs.slice(k, k + 6).join('');
    if (w === '233111' && runs.length - k === 7) { vals.push(106); break; }
    const v = C128_W.indexOf(w);
    if (v < 0) throw new Error('symbol ' + w);
    vals.push(v); k += 6;
  }
  if (vals[vals.length - 1] !== 106) throw new Error('no stop');
  const body = vals.slice(0, -2), chk = vals[vals.length - 2];
  if (body.reduce((s, v, i) => s + (i ? i * v : v), 0) % 103 !== chk) throw new Error('check symbol');
  let set = { 103: 'A', 104: 'B', 105: 'C' }[body[0]], out = '';
  for (const v of body.slice(1)) {
    if (set === 'C') { if (v < 100) { out += String(v).padStart(2, '0'); continue; } set = v === 100 ? 'B' : 'A'; continue; }
    if (v === 99) { set = 'C'; continue; }
    if (v === 100) { set = 'B'; continue; }
    if (v === 101) { set = 'A'; continue; }
    out += String.fromCharCode(set === 'A' ? (v < 64 ? v + 32 : v - 64) : v + 32);
  }
  return out;
}
function read39(runs) {
  const el = runs.map((w) => (w > 1.5 ? '1' : '0'));
  let out = '';
  for (let k = 0; k < el.length; k += 10) {
    const pat = el.slice(k, k + 9).join('');
    const ch = Object.keys(C39_BS).find((c) => C39_BS[c] === pat);
    if (ch === undefined) throw new Error('char ' + pat);
    out += ch;
  }
  if (out[0] !== '*' || out[out.length - 1] !== '*') throw new Error('no start/stop');
  return out.slice(1, -1);
}
function readItf(runs) {
  if (runs.slice(0, 4).join('') !== '1111') throw new Error('start');
  const body = runs.slice(4, -3);
  let out = '';
  for (let k = 0; k < body.length; k += 10) {
    const a = [], b = [];
    for (let i = 0; i < 5; i++) { a.push(body[k + 2 * i] > 1.5 ? '1' : '0'); b.push(body[k + 2 * i + 1] > 1.5 ? '1' : '0'); }
    const x = ITF_W.indexOf(a.join('')), y = ITF_W.indexOf(b.join(''));
    if (x < 0 || y < 0) throw new Error('pair');
    out += x + '' + y;
  }
  if (runs.slice(-3).map((w) => (w > 1.5 ? 'w' : 'n')).join('') !== 'wnn') throw new Error('stop');
  return out;
}
function testBarcodes() {
  section('6  Barcodes: read back from the bars');
  const Bt = tool('barcode-generator');
  const S = Bt.spec;
  const digits = (n) => { let s = ''; for (let i = 0; i < n; i++) s += rnd(10); return s; };
  const ascii = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(rnd(3) ? 32 + rnd(95) : (rnd(2) ? 48 + rnd(10) : rnd(32))); return s; };
  const c39 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
  const cases = [];
  for (let i = 0; i < 100; i++) {
    const e = digits(12); cases.push(['ean13', e, e + gs1(e), (r) => readEanRuns(r, 12)]);
    const e8 = digits(7); cases.push(['ean8', e8, e8 + gs1(e8), (r) => readEanRuns(r, 8)]);
    const u = digits(11); cases.push(['upca', u, u + gs1(u), (r) => readEanRuns(r, 12).slice(1)]);
    const t = digits(13); cases.push(['itf14', t, t + gs1(t), readItf]);
    const a = rnd(3) ? ascii(1 + rnd(20)) : digits(1 + rnd(20)); cases.push(['code128', a, a, read128]);
    let w = ''; for (let k = 0; k < 1 + rnd(15); k++) w += c39[rnd(43)]; w = w.trim() || 'A'; cases.push(['code39', w, w, read39]);   /* a line's outer spaces are not data */
  }
  const bad = [];
  const pngs = [];
  cases.forEach(([sym, v, want, reader], i) => {
    const r = tx(S, v, { sym: sym, text: 'yes' });
    if (r.error) { bad.push(sym + ' ' + JSON.stringify(v) + ': ' + r.error); return; }
    let got;
    try { got = reader(runsFromSvg(r.output)); } catch (e) { got = 'unreadable: ' + e.message; }
    if (got !== want) bad.push(sym + ' ' + JSON.stringify(v) + ' → ' + JSON.stringify(got));
    /* zxing-cpp reads Code 39 as Full ASCII ($A, /A, +A, %A pairs) and stops Code 128 text at a NUL, so those samples are left to the reader above */
    if ((i % 5 === 0 || i % 25 === 4) && !(sym === 'code39' && /[$/+%][A-Z]/.test(want)) && !(sym === 'code128' && /\x00/.test(want))) pngs.push([sym, want, r.output]);
  });
  check(bad.length === 0, cases.length + ' barcodes (100 of each type, Code 128 with control characters) read back by a reader written from the tables', bad.slice(0, 3).join('; '));
  /* check digits refused, not fixed */
  const wrong = ['5012345678901', '40063813', '036000291453', '15400141288764'];
  const syms = ['ean13', 'ean8', 'upca', 'itf14'];
  check(wrong.every((v, i) => /check digit should be/.test(tx(S, v, { sym: syms[i] }).error || '')), 'a wrong check digit is refused for EAN-13, EAN-8, UPC-A and ITF-14');
  /* zxing-cpp on rasters made here from the SVG */
  if (!PYPATH || py('import zxingcpp', '', PYPATH) === null) { skip('zxing-cpp is not available (pass --pypath with it installed): independent scanning'); return; }
  const files = pngs.map(([sym, want, svg], i) => { const f = path.join(TMP, 'bc' + i + '.png'); fs.writeFileSync(f, rasterise(svg, 3)); return [f, sym, want]; });
  const out = py('import sys,json,zxingcpp\nfrom PIL import Image\nfor f in json.loads(sys.stdin.read()):\n  r=zxingcpp.read_barcodes(Image.open(f))\n  print(json.dumps([x.text for x in r]))', JSON.stringify(files.map((x) => x[0])), PYPATH);
  if (!out) { skip('zxing-cpp did not run'); return; }
  const got = out.trim().split('\n').map((l) => JSON.parse(l));
  const zbad = files.filter((f, i) => { const g = got[i] || []; const w = f[1] === 'upca' ? '0' + f[2] : f[2]; return g.indexOf(w) < 0; });
  check(zbad.length === 0, files.length + ' barcodes of all six types read by zxing-cpp from rasters of the SVG', zbad.slice(0, 3).map((x) => x[1] + ' ' + JSON.stringify(x[2])).join('; '));
}
/** the SVG's rectangles as a greyscale PNG at px per module, with a white margin */
function rasterise(svg, px) {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  const W = Math.ceil(+vb[1] * px) + 20, H = Math.ceil(+vb[2] * px) + 20;
  const img = Buffer.alloc((W + 1) * H, 255);
  for (let y = 0; y < H; y++) img[y * (W + 1)] = 0;
  const re = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const x0 = Math.round(+m[1] * px) + 10, y0 = Math.round(+m[2] * px) + 10, x1 = Math.round((+m[1] + +m[3]) * px) + 10, y1 = Math.round((+m[2] + +m[4]) * px) + 10;
    for (let y = y0; y < y1 && y < H; y++) for (let x = x0; x < x1 && x < W; x++) img[y * (W + 1) + 1 + x] = 0;
  }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(img)), chunk('IEND', Buffer.alloc(0))]);
}

/* ====================================================================== 7 */
async function testBrowser() {
  section('7  Browser: CSSOM, rendered text, a real PNG, the pages');
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); } catch (e) { skip('puppeteer-core is not available: section 7'); return; }
  const server = await require('./serve.js').serve(ROOT, PORT);
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const BASE = 'http://127.0.0.1:' + PORT;
  try {
    const M = tool('code-minifier').ctx.CODE_LANG;
    const p = await browser.newPage();
    await p.goto(BASE + '/developer/code-minifier/', { waitUntil: 'load' });
    /* every stylesheet of the site */
    const sheets = [];
    const walk = (d) => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { if (e.isDirectory() && !/^(node_modules|build|\.)/.test(e.name) && d.split('/').length < 3) walk(path.join(d, e.name)); else if (/\.css$/.test(e.name)) sheets.push(path.join(d, e.name)); } };
    walk('assets'); walk('engine');
    let ok = 0; const bad = [];
    for (const f of sheets) {
      const css = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const same = await p.evaluate((a, b, c) => {
        /* Chrome keeps the text of var() values and @supports conditions as written, so spaces next to , : ( ) / are evened out on both sides */
        const read = (t) => { const s = new CSSStyleSheet(); s.replaceSync(t); return [...s.cssRules].map((r) => r.cssText).filter((x) => !/\{\s*\}$/.test(x)).join('\n').replace(/\s*([,:()/])\s*/g, '$1').replace(/\s+/g, ' '); };
        const r = read(a); return [r === read(b), r === read(c)];
      }, css, M.minifyCss(css, {}), M.beautifyCss(css, {}));
      if (same[0] && same[1]) ok++; else bad.push(f + (same[0] ? '' : ' (minified)') + (same[1] ? '' : ' (beautified)'));
    }
    check(bad.length === 0 && ok > 0, ok + ' stylesheets of the site, minified and beautified, give Chrome the same rules', bad.join(', '));
    /* HTML: rendered text of real pages, scripts off */
    const pages = ['index.html', 'developer/index.html', 'developer/json-formatter/index.html', 'about/index.html', 'privacy/index.html', 'pdf/merge-pdf/index.html', 'image/image-compressor/index.html', 'text/word-counter/index.html', 'time/age-calculator/index.html', 'qr/qr-code-generator/index.html', 'developer/sql-formatter/index.html', 'tools/index.html'].filter((f) => fs.existsSync(path.join(ROOT, f)));
    const q = await browser.newPage();
    await q.setJavaScriptEnabled(false);
    await q.setRequestInterception(true);
    q.on('request', (r) => { const u = r.url(); if (u.startsWith(BASE) && /\.css$/.test(u)) r.continue(); else if (u.startsWith('data:') || u === 'about:blank') r.continue(); else r.abort(); });
    const hbad = [];
    for (const f of pages) {
      const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const texts = [];
      for (const h of [html, M.minifyHtml(html, {}).text, M.beautifyHtml(html, { indent: '  ' }).text]) {
        await q.goto(BASE + '/404.html', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await q.setContent(h.replace(/<head>/i, '<head><base href="' + BASE + '/' + f + '">'), { waitUntil: 'load' });
        texts.push(await q.evaluate(() => document.body ? document.body.innerText : ''));
      }
      if (texts[0] !== texts[1]) hbad.push(f + ' (minified)');
      if (texts[0] !== texts[2]) hbad.push(f + ' (beautified)');
    }
    check(hbad.length === 0, pages.length + ' pages of the site, minified and beautified, show the same text (innerText, with the site CSS)', hbad.join(', '));
    /* a PNG drawn by the page's canvas, read by zxing-cpp */
    if (PYPATH && py('import zxingcpp', '', PYPATH) !== null) {
      const b = await browser.newPage();
      await b.evaluateOnNewDocument(() => { window.__dl = []; HTMLAnchorElement.prototype.click = function () { const a = this; if (a.download) window.__dl.push(fetch(a.href).then((r) => r.arrayBuffer()).then((x) => ({ name: a.download, bytes: Array.from(new Uint8Array(x)) }))); }; });
      await b.goto(BASE + '/developer/barcode-generator/', { waitUntil: 'load' });
      await b.waitForSelector('.code-area');
      const got = [];
      for (const [sym, v] of [['ean13', '4006381333931'], ['code128', 'BOX-0042-a'], ['itf14', '1540014128876'], ['code39', 'W6 TEST']]) {
        await b.evaluate((sym, v) => { const s = document.querySelector('#f-sym'); s.value = sym; s.dispatchEvent(new Event('change', { bubbles: true })); const ta = document.querySelector('.code-area'); ta.value = v; ta.dispatchEvent(new Event('input', { bubbles: true })); }, sym, v);
        await new Promise((r) => setTimeout(r, 400));
        await b.evaluate(() => { window.__dl = []; [...document.querySelectorAll('.io-actions button')].find((x) => x.textContent === 'PNG').click(); });
        await new Promise((r) => setTimeout(r, 900));
        const d = await b.evaluate(() => Promise.all(window.__dl));
        const f = path.join(TMP, 'page-' + sym + '.png');
        if (d[0]) fs.writeFileSync(f, Buffer.from(d[0].bytes));
        got.push([f, sym, v]);
      }
      const out = py('import sys,json,zxingcpp\nfrom PIL import Image\nfor f in json.loads(sys.stdin.read()):\n  try: print(json.dumps([x.text for x in zxingcpp.read_barcodes(Image.open(f))]))\n  except Exception as e: print(json.dumps([str(e)]))', JSON.stringify(got.map((x) => x[0])), PYPATH);
      const lines = (out || '').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch (e) { return []; } });
      const want = ['4006381333931', 'BOX-0042-a', '15400141288763', 'W6 TEST'];
      check(want.every((w, i) => (lines[i] || []).indexOf(w) >= 0), '4 PNGs drawn by the page’s canvas (EAN-13, Code 128, ITF-14, Code 39) read by zxing-cpp', JSON.stringify(lines));
      await b.close();
    } else skip('zxing-cpp is not available: PNGs from the page');
    /* the seven pages */
    const slugs = ['unix-timestamp', 'sql-formatter', 'code-minifier', 'code-beautifier', 'yaml-json', 'barcode-generator', 'color-contrast-checker'];
    const pbad = [];
    for (const slug of slugs) for (const w of [390, 1400]) {
      const pg = await browser.newPage();
      await pg.setViewport({ width: w, height: 900 });
      const errs = [], off = [];
      pg.on('pageerror', (e) => errs.push(e.message));
      await pg.setRequestInterception(true);
      pg.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !/^(data|blob):/.test(u)) { off.push(u); r.abort(); } else r.continue(); });
      await pg.goto(BASE + '/developer/' + slug + '/', { waitUntil: 'networkidle0' });
      await pg.evaluate(() => { const b = [...document.querySelectorAll('.io-actions button')].find((x) => x.textContent === 'Load example'); if (b) b.click(); });
      await new Promise((r) => setTimeout(r, 500));
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (errs.length || off.length || over > 0) pbad.push(slug + '@' + w + ': ' + errs.concat(off).join(' ') + (over > 0 ? ' overflow ' + over : ''));
      await pg.close();
    }
    check(pbad.length === 0, 'the seven pages at 390 and 1400 px with their examples: no script error, no outside request, no sideways scroll', pbad.join('; '));
    await p.close(); await q.close();
  } finally {
    await browser.close();
    server.close && server.close();
  }
}

(async () => {
  try {
    testUnix(); testContrast(); testYaml(); testSql(); testJs(); testBarcodes();
    if (!NODE_ONLY) await testBrowser();
  } catch (e) { console.error(e); process.exit(1); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + skipped + ' skipped');
  process.exit(fail ? 2 : 0);
})();
