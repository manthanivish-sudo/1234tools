/**
 * The SEO control centre: one spreadsheet listing every page on the site,
 * what it is, which tier of effort it deserves, and — when you give it a
 * Search Console export — how Google is treating it, with the next action.
 *
 *   node build/seo/control-centre.js
 *   node build/seo/control-centre.js --gsc-pages <Pages.csv> [--gsc-queries <Queries.csv>] [--out <file.xlsx>]
 *
 * Search Console → Performance → Search results → Export → Download CSV
 * gives a zip; Pages.csv and Queries.csv are inside. Pass Pages.csv as
 * --gsc-pages (URL, clicks, impressions, CTR, position per page) and,
 * if you like, Queries.csv as --gsc-queries (a sheet of its own). Without
 * them the metric columns are left blank, ready to paste into.
 *
 * Tiers, after the owner's plan (§19), decided by rule so they can be
 * re-run rather than argued about:
 *   P0  traffic engines: tools that run in the browser, outside the
 *       spreadsheet-workflow business tools
 *   P1  conversion pairs between everyday units (inch, kg, °C, litre, MB…)
 *   P2  AI tools and the business workflow tools
 *   P3  the long tail of conversion pairs
 *   P4  supporting pages: hubs, collections, guides, comparisons, learning
 *
 * Written to %USERPROFILE%/.1234tools-promo/seo/ by default (outside the
 * repository: the metrics are yours, not the public's). No dependencies:
 * the .xlsx is written with Node's own zlib. Inert on require.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SITE = 'https://www.1234tools.com';
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };

/* ---------- the site ---------- */

function walk(dir, out) {
  for (const n of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'build', 'pwa', 'assets', 'engine'].includes(n)) continue;
    const a = path.join(dir, n);
    if (fs.statSync(a).isDirectory()) walk(a, out);
    else if (n === 'index.html') out.push(a);
  }
  return out;
}

function loadWindow(rel) {
  const w = {};
  try { new Function('window', fs.readFileSync(path.join(ROOT, rel), 'utf8'))(w); } catch (e) { /* absent */ }
  return w;
}

/* Everyday units, by the words their page slugs use. A pair is P1 when
   both sides are on its family's list. */
const COMMON = {
  length: ['centimeter', 'inch', 'foot', 'meter', 'mile', 'kilometer', 'millimeter', 'yard'],
  mass: ['gram', 'kilogram', 'ounce', 'pound', 'stone', 'tonne'],
  temperature: ['celsius', 'fahrenheit', 'kelvin'],
  volume: ['liter', 'milliliter', 'cup', 'us-gallon', 'imperial-gallon', 'us-fluid-ounce', 'teaspoon', 'tablespoon', 'gallon'],
  area: ['square-meter', 'square-foot', 'acre', 'hectare', 'square-kilometer', 'square-yard', 'square-mile', 'square-centimeter', 'square-inch'],
  time: ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'],
  speed: ['kilometers-per-hour', 'miles-per-hour', 'meters-per-second', 'knot'],
  pressure: ['bar', 'psi', 'kilopascal', 'atmosphere', 'pascal'],
  energy: ['joule', 'kilojoule', 'calorie', 'kilocalorie', 'kilowatt-hour'],
  power: ['watt', 'kilowatt', 'horsepower', 'mechanical-horsepower'],
  data: ['bit', 'byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'],
  angle: ['degree', 'radian']
};
const WORKFLOW = /^\/business\/(tally-converter|accounting-converter|bank-reconciliation|einvoice-json|gst-reconciler|id-validator|mail-merge|sheet-merge|receivables-ageing|payroll-run|bookkeeping|mtd-quarterly-update|vat-return|full-final-settlement|ctc-structure)\/$/;

function lastUpdated() {
  /* one pass over the history: the newest commit date of each file */
  const map = {};
  try {
    const log = execFileSync('git', ['log', '--name-only', '--format=@%cs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
    let date = '';
    for (const line of log.split('\n')) {
      if (line.startsWith('@')) date = line.slice(1);
      else if (line && !map[line]) map[line] = date;
    }
  } catch (e) { /* not a git checkout */ }
  return map;
}

function pages() {
  const finder = (loadWindow('assets/finder-index.js').FINDER_INDEX || { tools: [] }).tools;
  const byPath = {};
  for (const r of finder) byPath['/' + r[1]] = { title: r[0], section: r[3], keywords: String(r[5] || '').split('|').map((s) => s.trim()).filter(Boolean) };
  const examples = loadWindow('assets/examples.js').TOOL_EXAMPLES || {};
  const stories = loadWindow('assets/stories.js').TOOL_STORIES || {};
  const updated = lastUpdated();
  const out = [];
  for (const abs of walk(ROOT, [])) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const html = fs.readFileSync(abs, 'utf8');
    if (/http-equiv="refresh"/.test(html)) continue;
    const noindex = /name="robots" content="[^"]*noindex/.test(html);
    const p = '/' + rel.replace(/index\.html$/, '');
    const h1 = ((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [])[1] || '').replace(/<[^>]+>/g, '').trim();
    const main = (/<main[\s\S]*?<\/main>/.exec(html) || [''])[0].replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    const words = (main.match(/[\p{L}\p{N}]+/gu) || []).length;
    const parts = p.split('/').filter(Boolean);
    let kind = 'page', tier = 'P4', why = 'supporting page', primary = h1.toLowerCase(), secondary = [];
    const tool = byPath[p];
    if (parts[0] === 'conversions' && parts.length === 3) {
      kind = 'conversion';
      const [a, b] = parts[2].split('-to-');
      const common = COMMON[parts[1]] || [];
      const everyday = common.includes(a) && common.includes(b);
      tier = everyday ? 'P1' : 'P3'; why = everyday ? 'everyday units' : 'long-tail units';
      const A = a.replace(/-/g, ' '), B = (b || '').replace(/-/g, ' ');
      primary = A + ' to ' + B; secondary = ['convert ' + A + ' to ' + B, A + 's in a ' + B, B + ' to ' + A];
    } else if (tool) {
      kind = 'tool';
      primary = tool.keywords[0] || tool.title.toLowerCase(); secondary = tool.keywords.slice(1, 6);
      if (p.indexOf('/ai/') === 0) { tier = 'P2'; why = 'AI tool (cloud, freemium)'; }
      else if (WORKFLOW.test(p)) { tier = 'P2'; why = 'business workflow tool'; }
      else { tier = 'P0'; why = 'browser tool: traffic engine'; }
    } else if (parts.length <= 2) { kind = parts.length === 0 ? 'home' : 'hub'; }
    if (/^\/(guides|compare|for|hi|learn|showcase)\//.test(p)) kind = parts[0] === 'hi' ? 'hindi' : parts[0];
    if (noindex) { tier = '—'; why = 'noindex'; }
    out.push({
      url: SITE + p, path: p, kind, section: tool ? tool.section : (parts[0] || 'home'), title: h1 || (tool && tool.title) || p,
      tier, why, primary, secondary: secondary.join(' | '), words,
      example: examples[p] ? 'yes' : '', story: stories[p] ? 'yes' : '', depth: /<!-- DEPTH:/.test(html) ? 'yes' : '',
      updated: updated[rel] || '', noindex: noindex ? 'noindex' : ''
    });
  }
  const order = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4, '—': 5 };
  out.sort((x, y) => order[x.tier] - order[y.tier] || x.path.localeCompare(y.path));
  return out;
}

/* ---------- Search Console ---------- */

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ''));
}
const num = (s) => { const n = Number(String(s || '').replace(/[%,]/g, '')); return Number.isFinite(n) ? n : null; };

function gscPages(file) {
  if (!file) return null;
  const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const head = rows.shift().map((h) => h.toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const iu = col(/page|url/), ic = col(/click/), ii = col(/impression/), it = col(/ctr/), ip = col(/position/);
  const map = {};
  for (const r of rows) {
    const u = String(r[iu] || '').replace(/[?#].*$/, '');
    if (!u) continue;
    map[u] = { clicks: num(r[ic]), impressions: num(r[ii]), ctr: num(r[it]), position: num(r[ip]) };
  }
  return map;
}

function nextAction(r) {
  if (r.noindex) return '';
  const g = r.gsc;
  if (g && g.impressions >= 100 && g.position >= 8 && g.position <= 20) return 'Near page one: strengthen the content and internal links';
  if (g && g.impressions >= 200 && g.ctr !== null && g.ctr < 1.5) return 'Seen but not clicked: rewrite the title and description';
  if (r.tier === 'P0' && !r.depth && r.kind === 'tool') return 'Add depth: what it is, formula, uses, more questions';
  if (r.tier === 'P0' && !r.example) return 'Add a real example';
  if (r.tier === 'P1' && g && !g.impressions) return 'No impressions yet: check indexing in URL Inspection';
  if (!g && (r.tier === 'P0' || r.tier === 'P1')) return 'Load Search Console data';
  return '';
}

/* ---------- a small .xlsx writer ---------- */

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
function colName(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

function sheetXml(rows, widths) {
  const body = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => {
    const ref = colName(ci) + (ri + 1);
    const style = ri === 0 ? ' s="1"' : '';
    if (typeof v === 'number' && Number.isFinite(v)) return '<c r="' + ref + '"' + style + '><v>' + v + '</v></c>';
    if (v === null || v === undefined || v === '') return '<c r="' + ref + '"' + style + '/>';
    return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + '</t></is></c>';
  }).join('') + '</row>').join('');
  const cols = '<cols>' + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>';
  const last = colName(rows[0].length - 1) + rows.length;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    cols + '<sheetData>' + body + '</sheetData><autoFilter ref="A1:' + last + '"/></worksheet>';
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(locals.concat([cd, end]));
}

function xlsx(sheets) {
  const names = sheets.map((s) => s.name);
  const files = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + names.map((n, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + names.map((n, i) => '<sheet name="' + xmlEsc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + names.map((n, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (names.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7C948"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']
  ];
  sheets.forEach((s, i) => files.push(['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s.rows, s.widths)]));
  return zip(files);
}

/* ---------- main ---------- */

function main() {
  const gsc = gscPages(flag('gsc-pages'));
  const list = pages();
  for (const r of list) { r.gsc = gsc ? (gsc[r.url] || gsc[r.url.replace(/\/$/, '')] || { clicks: 0, impressions: 0, ctr: null, position: null }) : null; r.action = nextAction(r); }
  const HEAD = ['URL', 'Tier', 'Why this tier', 'Kind', 'Section', 'Page', 'Primary keyword', 'Secondary keywords', 'Impressions', 'Clicks', 'CTR %', 'Avg position', 'Words on page', 'Real example', 'Story', 'Depth content', 'Last updated', 'Index', 'Next action'];
  const row = (r) => [r.url, r.tier, r.why, r.kind, r.section, r.title, r.primary, r.secondary,
    r.gsc ? r.gsc.impressions : '', r.gsc ? r.gsc.clicks : '', r.gsc && r.gsc.ctr !== null ? r.gsc.ctr : '', r.gsc && r.gsc.position !== null ? r.gsc.position : '',
    r.words, r.example, r.story, r.depth, r.updated, r.noindex || 'indexable', r.action];
  const widths = [52, 6, 26, 11, 20, 40, 30, 50, 12, 9, 8, 11, 12, 11, 8, 13, 13, 11, 52];
  const tiers = {};
  for (const r of list) { const t = tiers[r.tier] = tiers[r.tier] || { n: 0, imp: 0, clicks: 0, example: 0, depth: 0 }; t.n++; if (r.gsc) { t.imp += r.gsc.impressions || 0; t.clicks += r.gsc.clicks || 0; } if (r.example) t.example++; if (r.depth) t.depth++; }
  const summary = [['Tier', 'Pages', 'Impressions', 'Clicks', 'With a real example', 'With depth content', 'What it means']].concat(
    Object.entries(tiers).map(([t, v]) => [t, v.n, gsc ? v.imp : '', gsc ? v.clicks : '', v.example, v.depth,
      { P0: 'Traffic engines — most of the work goes here', P1: 'Everyday conversion pairs', P2: 'AI and business workflow tools', P3: 'Long-tail conversions — leave to the templates', P4: 'Hubs, guides, collections, comparisons', '—': 'Not indexed on purpose' }[t] || '']));
  summary.push([], ['Generated', new Date().toISOString().slice(0, 10)], ['Search Console data', gsc ? flag('gsc-pages') : 'none — export Performance → Pages and pass --gsc-pages']);
  summary.push(['KPI to watch', 'URLs with impressions moving into the top 10 (Avg position ≤ 10), not the number of pages']);
  const sheets = [
    { name: 'Summary', rows: summary, widths: [16, 10, 13, 10, 20, 18, 60] },
    { name: 'All pages', rows: [HEAD].concat(list.map(row)), widths },
    { name: 'P0 traffic engines', rows: [HEAD].concat(list.filter((r) => r.tier === 'P0').map(row)), widths },
    { name: 'Next actions', rows: [HEAD].concat(list.filter((r) => r.action).map(row)), widths }
  ];
  const qfile = flag('gsc-queries');
  if (qfile) {
    const rows = parseCsv(fs.readFileSync(qfile, 'utf8').replace(/^﻿/, ''));
    sheets.push({ name: 'Queries', rows, widths: [50, 10, 12, 8, 12] });
  }
  const outDir = path.join(process.env.PROMO_HOME || path.join(os.homedir(), '.1234tools-promo'), 'seo');
  const out = flag('out') || path.join(outDir, 'control-centre-' + new Date().toISOString().slice(0, 10) + '.xlsx');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, xlsx(sheets));
  console.log('\nSEO control centre: ' + list.length + ' pages → ' + out);
  for (const [t, v] of Object.entries(tiers)) console.log('  ' + t.padEnd(3) + ' ' + String(v.n).padStart(5) + ' pages');
  console.log('  next actions       ' + list.filter((r) => r.action).length + (gsc ? '' : '  (load Search Console data for the metric-driven ones)') + '\n');
}

if (require.main === module) main();
module.exports = { pages, xlsx, parseCsv };
