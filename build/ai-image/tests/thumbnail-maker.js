/*
 * Drives /ai-image/thumbnail-maker/ in headless Chrome: upload
 * portrait-of-woman_small.jpg, wait for the cut-out, check that the glow
 * is visible, export the three variants and check that they are 1280×720
 * PNGs that differ, export a JPEG and check it is under 2 MB; then do the
 * glow check again on city-streets.jpg. Records every non-local response.
 *
 * Then the editor: every template, with the cut-out and without a photo;
 * the Noto emoji set (fetched only when asked for), a sticker dragged and
 * resized with the pointer and the keyboard; every shape; several text
 * layers (add, edit, duplicate, reorder, delete, select by clicking);
 * undo and redo against exact earlier snapshots, past 50 steps; the four
 * sizes, with each export's size read from its PNG header and the text
 * measured from pixels against each size's safe area; a project saved in
 * IndexedDB, the page reloaded, the project reopened and compared; a
 * 390-pixel phone and the light theme (screenshots, and no sideways
 * scroll). Before the browser starts, the engine is loaded in a bare vm
 * and the emoji subset and its licence are checked on disk.
 *
 *   node thumbnail-maker.js [--root <export dir>] [--port 8722] [--out <dir>] [--img <harness img dir>]
 *
 * With --root the script serves that directory itself on --port; without
 * it a server must already be listening there. Exits non-zero on failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('E:/projects/1234Tools/node_modules/puppeteer-core');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const PORT = Number(flag('port', 8722));
const ROOT = flag('root', null);
const OUT = flag('out', path.join(__dirname, 'out', 'thumbnail-maker'));
const IMG = flag('img', 'E:/tmp/1234-agents/harness/img');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
fs.mkdirSync(OUT, { recursive: true });

const failures = [];
const check = (cond, m) => { if (cond) console.log('  ok   ' + m); else { console.log('  FAIL ' + m); failures.push(m); } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
function serve(root, port) {
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const abs = path.join(root, p);
      fs.stat(abs, (err, st) => {
        if (err || !st.isFile()) { r.writeHead(404); r.end('not found'); return; }
        r.writeHead(200, { 'Content-Type': TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
        fs.createReadStream(abs).pipe(r);
      });
    }).listen(port, '127.0.0.1', () => res(srv));
  });
}
const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });
const REPO = ROOT || path.join(__dirname, '..', '..', '..');
/* The safe areas, as the brief sets them: the part of each size that a
   platform's own buttons and captions leave alone. */
const SAFE = {
  yt: { l: 0.04, r: 0.04, t: 0.04, b: 0.04 },
  short: { l: 0.06, r: 0.14, t: 0.11, b: 0.22 },
  square: { l: 0.05, r: 0.05, t: 0.05, b: 0.05 },
  portrait: { l: 0.07, r: 0.07, t: 0.05, b: 0.05 }
};

/* ---- before the browser: the engine loads, and the emoji subset is what it says ---- */
function offlineChecks() {
  const vm = require('vm');
  const src = fs.readFileSync(path.join(REPO, 'engine', 'aiimg-thumbnail-maker.js'), 'utf8');
  check(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(src), 'engine has no stray control characters');
  const A = { tools: {} };
  for (const k of ['el', 'clamp', 'field', 'select', 'range', 'colour', 'check', 'button', 'sleep', 'fmtBytes']) A[k] = () => {};
  const ctx = { window: { AIImg: A } };
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx); } catch (e) { console.log('  vm:', e.message); }
  check(A.tools['thumbnail-maker'] && typeof A.tools['thumbnail-maker'].mount === 'function', 'engine runs in a bare vm and registers mount()');
  const subset = path.join(REPO, 'engine', 'vendor', 'noto-emoji', 'noto-subset.json');
  const lic = path.join(REPO, 'engine', 'vendor', 'noto-emoji', 'LICENSE');
  const raw = fs.existsSync(subset) ? fs.readFileSync(subset) : null;
  check(!!raw, 'noto-subset.json exists');
  if (!raw) return;
  let j = null;
  try { j = JSON.parse(raw.toString('utf8')); } catch (e) { console.log('  subset:', e.message); }
  const icons = j && j.icons ? Object.values(j.icons) : [];
  console.log('  noto subset:', raw.length, 'bytes,', icons.length, 'emoji, licence', j && j.license, '| source', j && j.source);
  check(raw.length < 1.5e6, 'the emoji subset is under 1.5 MB (' + raw.length + ' bytes)');
  check(icons.length >= 300, 'the emoji subset holds at least 300 emoji (' + icons.length + ')');
  check(j && j.license === 'Apache-2.0' && /@iconify-json\/noto 1\.2\.9/.test(j.source) && j.width === 128 && j.height === 128, 'the subset names Apache-2.0, @iconify-json/noto 1.2.9 and a 128×128 box');
  check(icons.every((ic) => typeof ic.char === 'string' && ic.char && typeof ic.name === 'string' && typeof ic.group === 'string' && /<path|<circle|<ellipse|<g/.test(ic.body) && !/<script|on\w+=|href="http/i.test(ic.body)), 'every emoji has a char, a name, a group and a plain SVG body (no script, no handlers, no remote links)');
  const ltxt = fs.existsSync(lic) ? fs.readFileSync(lic, 'utf8') : '';
  check(/Apache License\s+Version 2\.0, January 2004/.test(ltxt) && /TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION/.test(ltxt), 'engine/vendor/noto-emoji/LICENSE holds the Apache-2.0 text');
}

/* ---- the editor: templates, stickers, text layers, undo, sizes, projects ---- */
async function editorChecks(page, h) {
  const { stamp, canvasPng, reqs } = h;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const doc = () => page.evaluate(() => document.querySelector('.tool').aiimgTool.docJSON());
  const st = (fn, ...a) => page.evaluate(fn, ...a);
  const notoReqs = (from) => reqs.slice(from || 0).filter((u) => /noto-subset\.json/.test(u)).length;
  const snap = () => page.evaluate(() => { const c = document.querySelector('.aiimg-canvas'); window.__snap = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; });
  /* pixels that changed since snap(), inside a box of the canvas */
  const changed = (box) => page.evaluate((b) => {
    const c = document.querySelector('.aiimg-canvas'), s = window.__snap;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    if (!s || s.length !== d.length) return -1;
    const x0 = Math.max(0, Math.floor(b ? b.x : 0)), y0 = Math.max(0, Math.floor(b ? b.y : 0));
    const x1 = Math.min(c.width, Math.ceil(b ? b.x + b.w : c.width)), y1 = Math.min(c.height, Math.ceil(b ? b.y + b.h : c.height));
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * c.width + x) * 4; if (Math.abs(d[o] - s[o]) + Math.abs(d[o + 1] - s[o + 1]) + Math.abs(d[o + 2] - s[o + 2]) > 60) n++; }
    return n;
  }, box || null);
  const sample = () => page.evaluate(() => {
    const c = document.querySelector('.aiimg-canvas'), k = document.createElement('canvas');
    k.width = 64; k.height = Math.round(64 * c.height / c.width);
    k.getContext('2d').drawImage(c, 0, 0, k.width, k.height);
    return Array.from(k.getContext('2d').getImageData(0, 0, k.width, k.height).data);
  });
  const differ = (p, q) => { let n = 0; for (let j = 0; j < p.length; j += 4) if (Math.abs(p[j] - q[j]) > 24 || Math.abs(p[j + 1] - q[j + 1]) > 24 || Math.abs(p[j + 2] - q[j + 2]) > 24) n++; return n / (p.length / 4); };
  const clickButton = (scope, re) => page.evaluate((scope, src) => {
    const rx = new RegExp(src);
    for (const b of document.querySelectorAll(scope + ' button')) if (rx.test(b.textContent.trim()) && b.offsetParent !== null && !b.disabled) { b.click(); return true; }
    return false;
  }, scope, re.source);
  const toClient = (cx, cy) => page.evaluate((cx, cy) => {
    const c = document.querySelector('.aiimg-canvas'), r = c.getBoundingClientRect();
    return { x: r.left + cx * r.width / c.width, y: r.top + cy * r.height / c.height, rw: r.width, rh: r.height, W: c.width, H: c.height };
  }, cx, cy);
  const layer = (id) => st((id) => { const S = document.querySelector('.tool').aiimgTool.state; return JSON.parse(JSON.stringify(S.layers.find((l) => l.id === id) || null)); }, id);
  const boxOf = (id) => st((id) => document.querySelector('.tool').aiimgTool.boxOf(id), id);
  const setVal = (sel, v, ev) => page.$eval(sel, (e, v, ev) => { e.value = v; e.dispatchEvent(new Event(ev || 'input', { bubbles: true })); }, String(v), ev);
  const chord = async (mods, key) => { for (const m of mods) await page.keyboard.down(m); await page.keyboard.press(key); for (const m of mods.slice().reverse()) await page.keyboard.up(m); };
  const toStage = () => page.$eval('.aiimg-canvas', (c) => c.scrollIntoView({ block: 'center' }));
  /* where the text layers draw, measured from pixels: the frame with and
     without them, over a flat grey, shadows and glows off */
  const textInk = () => page.evaluate(() => {
    const t = document.querySelector('.tool').aiimgTool, S = t.state, c = document.querySelector('.aiimg-canvas');
    const W = c.width, H = c.height;
    const base = { fmt: S.fmt, bg: { mode: 'solid', c1: '#7f7f7f', c2: '#7f7f7f', dark: 0, blur: 0, zoom: 1, pattern: 'dots' }, subject: S.subject, glow: S.glow, layers: [] };
    const texts = S.layers.filter((l) => l.type === 'text' && !l.hidden).map((l) => Object.assign({}, l, { shadowBlur: 0, shadowX: 0, shadowY: 0, glow: 0 }));
    const draw = (layers) => { const k = document.createElement('canvas'); k.width = W; k.height = H; S.variant = Object.assign({}, base, { layers }); try { t.renderFrame(k.getContext('2d'), W, H); } finally { S.variant = null; } return k.getContext('2d').getImageData(0, 0, W, H).data; };
    const a = draw([]), b = draw(texts);
    let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]) > 30) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { fmt: S.fmt, W, H, n, x0, y0, x1, y1, texts: texts.length };
  });
  const inSafe = (ink) => {
    const sa = SAFE[ink.fmt], tol = 0.005 * Math.min(ink.W, ink.H);
    return ink.n === 0 || (ink.x0 >= sa.l * ink.W - tol && ink.x1 <= (1 - sa.r) * ink.W + tol && ink.y0 >= sa.t * ink.H - tol && ink.y1 <= (1 - sa.b) * ink.H + tol);
  };
  const newestResult = () => page.evaluate(async () => {
    const row = document.querySelector('.aiimg-result');
    const b = await (await fetch(row.querySelector('img').src)).blob();
    const buf = new Uint8Array(await b.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return { name: row.querySelector('.aiimg-result-head strong').textContent, type: b.type, b64: btoa(bin) };
  });
  const exportPng = async () => {
    await page.click('.aiimg-tabs [data-pane=export]');
    const n = await page.$$eval('.aiimg-result', (r) => r.length);
    await clickButton('.aiimg-pane[data-pane=export]', /^Download PNG$/);
    await page.waitForFunction((n) => document.querySelectorAll('.aiimg-result').length > n, { timeout: 60000 }, n);
    const r = await newestResult();
    const buf = Buffer.from(r.b64, 'base64');
    fs.writeFileSync(path.join(OUT, r.name), buf);
    return Object.assign({ name: r.name, type: r.type, png: buf.subarray(1, 4).toString() === 'PNG' }, buf.length > 24 ? pngSize(buf) : {});
  };

  console.log(stamp(), 'editor');
  check(notoReqs() === 0, 'the emoji set is not fetched on page load, nor with a photo');
  const dbs0 = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : null));
  check(Array.isArray(dbs0) && !dbs0.includes('1234tools-thumbnail-maker'), 'a visit that saves nothing creates no on-device database');

  /* ---- templates, with a cut-out ---- */
  await page.click('.aiimg-tabs [data-pane=templates]');
  await sleep(300);
  const tplIds = await page.$$eval('.aiimg-thumb-tpl', (b) => b.map((x) => x.dataset.tpl));
  console.log('  templates:', tplIds.join(', '));
  check(tplIds.length >= 8, 'at least eight templates (' + tplIds.length + ')');
  const pv = await page.$$eval('.aiimg-thumb-tpl canvas', (cs) => cs.map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; if (v < mn) mn = v; if (v > mx) mx = v; } return mx - mn; }));
  check(pv.length === tplIds.length && pv.every((r) => r > 60), 'every template button shows a drawn preview');
  let prev = await sample();
  for (const id of tplIds) {
    await page.click('.aiimg-thumb-tpl[data-tpl="' + id + '"]');
    await sleep(350); await frame();
    const info = await st(() => { const S = document.querySelector('.tool').aiimgTool.state; return { tpl: S.tpl, n: S.layers.length, words: S.layers.filter((l) => l.type === 'text' || (l.type === 'shape' && /badge|burst|disc|bar/.test(l.kind))).length, cut: !!S.cut, emoji: S.layers.filter((l) => l.type === 'emoji').map((l) => l.key) }; });
    const cur = await sample();
    const d = differ(prev, cur); prev = cur;
    await canvasPng('9-template-' + id + '.png');
    console.log('  template', id, JSON.stringify(info), 'changed', (d * 100).toFixed(1) + '% of sampled pixels');
    check(info.tpl === id && info.n >= 3 && info.words >= 1 && info.cut && d > 0.05, 'template "' + id + '" lays out words and the cut-out, and redraws the frame');
  }
  check(notoReqs() === 1, 'the emoji set was fetched once, by the first template that uses an emoji (' + notoReqs() + ')');
  const titleOf = () => st(() => { const S = document.querySelector('.tool').aiimgTool.state; const L = S.layers.find((l) => l.type === 'text' && l.role === 'title'); return L ? L.text : null; });
  await page.click('.aiimg-thumb-tpl[data-tpl="quote"]'); await sleep(100);
  await page.click('.aiimg-thumb-tpl[data-tpl="neon"]'); await sleep(100);
  const placeholder = await titleOf();
  await page.click('.aiimg-tabs [data-pane=text]');
  await setVal('#aiimg-text', 'MY OWN WORDS');
  await page.click('.aiimg-tabs [data-pane=templates]');
  await page.click('.aiimg-thumb-tpl[data-tpl="tutorial"]'); await sleep(100);
  const kept = await titleOf();
  check(placeholder === 'GAME\nOVER?' && kept === 'MY OWN WORDS', 'a typed title survives a change of template; a template’s placeholder words do not (' + JSON.stringify([placeholder, kept]) + ')');

  /* ---- emoji: picker, drag, resize, keyboard ---- */
  await page.click('.aiimg-tabs [data-pane=accent]');
  await clickButton('.aiimg-pane[data-pane=accent]', /^Choose an emoji/);
  await page.waitForFunction(() => document.querySelectorAll('.aiimg-thumb-picker:not([hidden]) .aiimg-thumb-emoji-grid:not(.aiimg-thumb-recent) .aiimg-thumb-emo').length >= 300, { timeout: 30000 }).catch(() => {});
  const nEmo = await page.$$eval('.aiimg-thumb-emoji-grid:not(.aiimg-thumb-recent) .aiimg-thumb-emo', (b) => b.length);
  check(nEmo >= 300, 'the emoji picker lists at least 300 emoji (' + nEmo + ')');
  check(notoReqs() === 1, 'opening the picker reuses the set already loaded (still one request)');
  await page.type('#aiimg-thumb-esearch', 'fire');
  const found = await page.$$eval('.aiimg-thumb-emoji-grid:not(.aiimg-thumb-recent) .aiimg-thumb-emo', (b) => b.filter((x) => !x.hidden).map((x) => x.dataset.key));
  check(found.includes('fire') && found.length < 10, 'searching "fire" narrows the picker to ' + found.length + ' (' + found.join(', ') + ')');
  await setVal('#aiimg-thumb-esearch', '');
  await page.screenshot({ path: path.join(OUT, '10-emoji-picker.png') });
  await toStage();
  await snap();
  /* the cleared search re-renders the grid after a short delay: wait for it, then click the button itself (a click by
     coordinates could land on whichever emoji the re-render put there; that made this check flaky on a busy machine) */
  await page.waitForFunction(() => [...document.querySelectorAll('.aiimg-thumb-emoji-grid:not(.aiimg-thumb-recent) .aiimg-thumb-emo')].filter((x) => !x.hidden).length >= 300, { timeout: 10000 }).catch(() => {});
  await sleep(300);
  await page.evaluate(() => document.querySelector('.aiimg-thumb-emoji-grid:not(.aiimg-thumb-recent) [data-key="fire"]').click());
  await sleep(400); await frame();
  const em = await st(() => { const S = document.querySelector('.tool').aiimgTool.state; const L = S.layers[S.layers.length - 1]; return { id: L.id, type: L.type, key: L.key, sel: S.sel, x: L.x, y: L.y, size: L.size }; });
  check(em.type === 'emoji' && em.key === 'fire' && em.sel === em.id, 'choosing 🔥 adds a selected emoji layer on top');
  let bx = await boxOf(em.id);
  const inkN = await changed({ x: bx.cx - bx.hw, y: bx.cy - bx.hh, w: bx.hw * 2, h: bx.hh * 2 });
  check(inkN > 0.15 * 4 * bx.hw * bx.hh, 'the emoji is drawn on the frame (' + inkN + ' pixels in its box changed)');
  await toStage();
  bx = await boxOf(em.id);
  const p0 = await toClient(bx.cx, bx.cy);
  const DX = 60, DY = 45;
  await page.mouse.move(p0.x, p0.y); await page.mouse.down();
  await page.mouse.move(p0.x + DX / 2, p0.y + DY / 2, { steps: 4 }); await page.mouse.move(p0.x + DX, p0.y + DY, { steps: 4 });
  await page.mouse.up();
  const moved = await layer(em.id);
  const ex = em.x + DX / p0.rw, ey = em.y + DY / p0.rh;
  console.log('  drag: from', em.x.toFixed(4), em.y.toFixed(4), 'to', moved.x.toFixed(4), moved.y.toFixed(4), 'expected', ex.toFixed(4), ey.toFixed(4));
  check(Math.abs(moved.x - ex) < 0.003 && Math.abs(moved.y - ey) < 0.003, 'dragging the sticker ' + DX + '×' + DY + ' px lands it at the expected fraction of the frame');
  bx = await boxOf(em.id);
  const hp = await toClient(bx.cx + bx.hw, bx.cy + bx.hh);
  await page.mouse.move(hp.x, hp.y); await page.mouse.down(); await page.mouse.move(hp.x + 30, hp.y + 30, { steps: 5 }); await page.mouse.up();
  const resized = await layer(em.id);
  const expSize = moved.size * Math.hypot(bx.hw + 30 * hp.W / hp.rw, bx.hh + 30 * hp.H / hp.rh) / Math.hypot(bx.hw, bx.hh);
  console.log('  resize: size', moved.size.toFixed(4), '->', resized.size.toFixed(4), 'expected', expSize.toFixed(4));
  check(Math.abs(resized.size - expSize) / expSize < 0.01, 'dragging the corner handle resizes the sticker by the expected factor');
  await page.focus('.aiimg-canvas');
  await page.keyboard.press('=');
  const k1 = await layer(em.id);
  await page.keyboard.press('-');
  const k2 = await layer(em.id);
  await page.keyboard.press('ArrowRight');
  const k3 = await layer(em.id);
  await chord(['Shift'], 'ArrowDown');
  const k4 = await layer(em.id);
  check(Math.abs(k1.size - resized.size * 1.05) < 1e-9 && Math.abs(k2.size - resized.size) < 1e-9, 'keyboard + and − resize the selected layer by 5%');
  check(Math.abs(k3.x - (k2.x + 0.005)) < 1e-9 && Math.abs(k4.y - (k3.y + 0.05)) < 1e-9, 'arrow keys nudge the selected layer (0.5%, Shift 5%)');
  const nBefore = await st(() => document.querySelector('.tool').aiimgTool.state.layers.length);
  await page.keyboard.press('Delete');
  const gone = await st((id) => { const S = document.querySelector('.tool').aiimgTool.state; return { n: S.layers.length, has: S.layers.some((l) => l.id === id) }; }, em.id);
  check(gone.n === nBefore - 1 && !gone.has, 'Delete removes the selected sticker');

  /* ---- shapes, and undo of every one of them ---- */
  await sleep(500);
  await st(() => document.querySelector('.tool').aiimgTool.commit());
  const sBefore = await doc();
  const kinds = await page.$$eval('.aiimg-thumb-shape', (b) => b.map((x) => x.dataset.shape));
  const shapeFails = [];
  for (const k of kinds) {
    await snap();
    await page.click('.aiimg-thumb-shape[data-shape="' + k + '"]');
    await frame();
    const L = await st(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.layers[S.layers.length - 1]; });
    const b = await boxOf(L.id);
    const n = await changed({ x: b.cx - b.hw, y: b.cy - b.hh, w: b.hw * 2, h: b.hh * 2 });
    if (L.type !== 'shape' || L.kind !== k || n < 150) shapeFails.push(k + ':' + n);
  }
  await canvasPng('11-shapes-canvas.png');
  console.log('  shapes:', kinds.join(', '), shapeFails.length ? '| failed: ' + shapeFails.join(', ') : '');
  check(kinds.length >= 10 && !shapeFails.length, 'each of ' + kinds.length + ' shapes, arrows and badges adds a layer of its kind that draws on the frame');
  for (let i = 0; i < kinds.length; i++) await page.click('.aiimg-thumb-undo');
  check(await doc() === sBefore, 'pressing Undo ' + kinds.length + ' times restores the exact state from before the shapes');
  await page.focus('.aiimg-canvas');
  for (let i = 0; i < kinds.length; i++) await chord(['Control', 'Shift'], 'z');
  const redone = await st(() => document.querySelector('.tool').aiimgTool.state.layers.filter((l) => l.type === 'shape').map((l) => l.kind));
  check(kinds.every((k) => redone.includes(k)), 'Ctrl+Shift+Z brings every shape back');
  for (let i = 0; i < kinds.length; i++) await chord(['Control'], 'z');
  check(await doc() === sBefore, 'Ctrl+Z steps back to the same exact state again');

  /* ---- several text layers ---- */
  await page.click('.aiimg-tabs [data-pane=text]');
  const texts = () => st(() => document.querySelector('.tool').aiimgTool.state.layers.filter((l) => l.type === 'text').map((l) => JSON.parse(JSON.stringify(l))));
  const T0 = await texts();
  await clickButton('.aiimg-pane[data-pane=text]', /^Add text$/);
  const T1 = await texts();
  const added = T1.find((l) => !T0.some((o) => o.id === l.id));
  const selNow = await st(() => document.querySelector('.tool').aiimgTool.state.sel);
  check(T1.length === T0.length + 1 && added && selNow === added.id, 'Add text makes a new, selected text layer');
  await setVal('#aiimg-text', 'SECOND LAYER');
  await setVal('#aiimg-rot', 15);
  await setVal('#aiimg-font', 'Georgia', 'change');
  await setVal('#aiimg-fill', '#ff0000');
  await setVal('#aiimg-strokew', 3);
  await setVal('#aiimg-shblur', 0);
  await frame();
  const T2 = await texts();
  const a2 = T2.find((l) => l.id === added.id);
  const othersSame = T0.every((o) => JSON.stringify(T2.find((l) => l.id === o.id)) === JSON.stringify(o));
  check(a2.text === 'SECOND LAYER' && a2.rotation === 15 && a2.font === 'Georgia' && a2.fill === '#ff0000' && a2.strokeWidth === 3 && a2.shadowBlur === 0, 'the text controls set words, rotation, font, colour, outline and shadow on the selected layer');
  check(othersSame, 'the other text layers are untouched');
  await clickButton('.aiimg-pane[data-pane=text]', /^Duplicate$/);
  const T3 = await texts();
  const dup = T3.find((l) => !T2.some((o) => o.id === l.id));
  check(T3.length === T2.length + 1 && dup && dup.text === 'SECOND LAYER' && dup.font === 'Georgia', 'Duplicate copies the selected text layer');
  await page.click('.aiimg-tabs [data-pane=stack]');
  const idx = (id) => st((id) => document.querySelector('.tool').aiimgTool.state.layers.findIndex((l) => l.id === id), id);
  const i0 = await idx(dup.id);
  await page.click('.aiimg-thumb-stackrow[data-id="' + dup.id + '"] button[aria-label^="Move down"]');
  const i1 = await idx(dup.id);
  await page.click('.aiimg-thumb-stackrow[data-id="' + dup.id + '"] button[aria-label^="Move up"]');
  const i2 = await idx(dup.id);
  check(i1 === i0 - 1 && i2 === i0, 'the Layers list moves a layer down and up the stack (' + i0 + ' → ' + i1 + ' → ' + i2 + ')');
  const rows = await page.$$eval('.aiimg-thumb-stackrow', (r) => r.length);
  const nLayers = await st(() => document.querySelector('.tool').aiimgTool.state.layers.length);
  check(rows === nLayers, 'the Layers list has one row per layer (' + rows + ')');
  await page.click('.aiimg-tabs [data-pane=text]');
  await st((id) => document.querySelector('.tool').aiimgTool.selectLayer(id), dup.id);
  await clickButton('.aiimg-pane[data-pane=text]', /^Delete$/);
  const T4 = await texts();
  check(T4.length === T2.length && !T4.some((l) => l.id === dup.id), 'Delete removes the selected text layer');
  /* select by clicking: put the new layer on top, somewhere clear, select something else, then click it */
  await st((id) => {
    const t = document.querySelector('.tool').aiimgTool, S = t.state;
    const L = S.layers.find((l) => l.id === id); L.x = 0.25; L.y = 0.2; L.size = 9; L.rotation = 0;
    while (S.layers[S.layers.length - 1].id !== id) t.moveLayer(id, 1);
    t.selectLayer('subject'); t.commit();
  }, added.id);
  await toStage(); await frame();
  const tb = await boxOf(added.id);
  const tc = await toClient(tb.cx, tb.cy);
  await page.mouse.click(tc.x, tc.y);
  check(await st(() => document.querySelector('.tool').aiimgTool.state.sel) === added.id, 'clicking a text layer on the preview selects it');
  await canvasPng('12-text-layers-canvas.png');

  /* ---- undo and redo from the keyboard and the buttons ---- */
  await sleep(500);
  await st(() => document.querySelector('.tool').aiimgTool.commit());
  const u0 = await doc();
  await clickButton('.aiimg-pane[data-pane=text]', /^Add text$/);
  await sleep(100);
  await setVal('#aiimg-fill', '#00ff00'); await setVal('#aiimg-fill', '#00ff00', 'change');
  await sleep(600);
  await page.focus('.aiimg-canvas');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await sleep(600);
  const u3 = await doc();
  await page.focus('.aiimg-canvas');
  for (let i = 0; i < 3; i++) await chord(['Control'], 'z');
  const back3 = await doc();
  for (let i = 0; i < 3; i++) await chord(['Control', 'Shift'], 'z');
  const fwd3 = await doc();
  await chord(['Control'], 'z');
  await chord(['Control'], 'y');
  const fwdY = await doc();
  await page.click('.aiimg-thumb-undo');
  const btnBack = await doc();
  await page.click('.aiimg-thumb-redo');
  const btnFwd = await doc();
  check(u3 !== u0 && back3 === u0, 'Ctrl+Z three times returns to the exact state before three edits');
  check(fwd3 === u3 && fwdY === u3, 'Ctrl+Shift+Z and Ctrl+Y redo to the exact later state');
  check(btnBack !== u3 && btnFwd === u3, 'the Undo and Redo buttons step back and forward');
  const steps = await st(() => {
    const t = document.querySelector('.tool').aiimgTool, S = t.state;
    const L = S.layers.find((l) => l.type === 'text');
    const out = [];
    for (let i = 0; i < 60; i++) { L.x = 0.2 + i / 200; t.commit(); out.push(t.docJSON()); }
    return out;
  });
  const hinfo = await st(() => document.querySelector('.tool').aiimgTool.history());
  const back55 = await st(() => { const t = document.querySelector('.tool').aiimgTool; for (let i = 0; i < 55; i++) if (!t.undo()) return 'stopped after ' + i; return t.docJSON(); });
  const fwd55 = await st(() => { const t = document.querySelector('.tool').aiimgTool; for (let i = 0; i < 55; i++) if (!t.redo()) return 'stopped after ' + i; return t.docJSON(); });
  console.log('  history:', JSON.stringify(hinfo));
  check(hinfo.max >= 50 && back55 === steps[4], 'undo goes back 55 steps to the exact snapshot taken then');
  check(fwd55 === steps[59], 'redo comes forward 55 steps to the latest state');

  /* ---- sizes: canvas, export from the PNG header, text inside the safe area ---- */
  await page.click('.aiimg-tabs [data-pane=templates]');
  await page.click('.aiimg-thumb-tpl[data-tpl="neon"]');
  await sleep(400);
  for (const [fmt, w, hh] of [['short', 1080, 1920], ['square', 1080, 1080], ['portrait', 1080, 1350], ['yt', 1280, 720]]) {
    await setVal('#aiimg-thumb-format', fmt, 'change');
    await sleep(300); await frame();
    const dimsNow = await page.$eval('.aiimg-canvas', (c) => [c.width, c.height]);
    check(dimsNow[0] === w && dimsNow[1] === hh, fmt + ': the preview canvas is ' + w + '×' + hh);
    const ink = await textInk();
    console.log('  ' + fmt + ' text ink:', JSON.stringify(ink));
    check(ink.n > 500 && inSafe(ink), fmt + ': the text, measured from pixels, sits inside the safe area');
    if (fmt === 'short') {
      /* a redraw while dragging: the cached background, the cut-out with its glow, the layers */
      const ms = await page.evaluate(() => {
        const t = document.querySelector('.tool').aiimgTool, c = document.querySelector('.aiimg-canvas');
        const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
        const x = k.getContext('2d');
        const style = t.state.glow.style; t.state.glow.style = 'both';
        const f0 = performance.now(); t.renderFrame(x, k.width, k.height); x.getImageData(0, 0, 1, 1); window.__firstDraw = performance.now() - f0;
        const times = [];
        for (let i = 0; i < 5; i++) { t.state.subject.x += 0.001; const a = performance.now(); t.renderFrame(x, k.width, k.height); x.getImageData(0, 0, 1, 1); times.push(performance.now() - a); }
        t.state.subject.x -= 0.005; t.state.glow.style = style;
        return times.sort((p, q) => p - q)[2];
      });
      console.log('  1080×1920 redraw while dragging (outline and glow), median of 5:', ms.toFixed(1), 'ms; first draw at a new size:', (await page.evaluate(() => window.__firstDraw)).toFixed(1), 'ms');
      check(ms < 100, 'a 1080×1920 redraw while dragging, with outline and glow, takes under 100 ms on this machine (' + ms.toFixed(1) + ' ms)');
    }
    await canvasPng('13-size-' + fmt + '-canvas.png');
    await page.screenshot({ path: path.join(OUT, '13-size-' + fmt + '.png') });
    if (fmt !== 'yt') {
      const r = await exportPng();
      console.log('  export:', r.name, r.width + '×' + r.height);
      check(r.png && r.type === 'image/png' && r.width === w && r.height === hh && new RegExp('-' + w + 'x' + hh + '\\.png$').test(r.name), fmt + ': the PNG export is ' + w + '×' + hh + ' by its header, named …-' + w + 'x' + hh + '.png');
    }
  }
  await setVal('#aiimg-thumb-format', 'short', 'change');
  await page.click('.aiimg-tabs [data-pane=templates]');
  const tallFails = [];
  for (const id of tplIds) {
    await page.click('.aiimg-thumb-tpl[data-tpl="' + id + '"]');
    await sleep(200); await frame();
    const ink = await textInk();
    if (ink.texts && (!inSafe(ink) || ink.n < 200)) tallFails.push(id + ' ' + JSON.stringify(ink));
  }
  await canvasPng('14-short-last-template-canvas.png');
  check(!tallFails.length, 'every template keeps its text inside the 9:16 safe area' + (tallFails.length ? ': ' + tallFails.join('; ') : ''));

  /* ---- projects: save, reload, reopen, compare, delete ---- */
  await setVal('#aiimg-thumb-format', 'square', 'change');
  await page.click('.aiimg-tabs [data-pane=templates]');
  await page.click('.aiimg-thumb-tpl[data-tpl="reaction"]');
  await sleep(400);
  await page.click('.aiimg-tabs [data-pane=projects]');
  await setVal('#aiimg-thumb-pname', 'Wave S test');
  await clickButton('.aiimg-pane[data-pane=projects]', /^Save project$/);
  const noteSel = '.aiimg-pane[data-pane=projects] .aiimg-thumb-note';
  await page.waitForFunction((s) => /Saved “Wave S test”|could not/.test(document.querySelector(s).textContent), { timeout: 30000 }, noteSel).catch(() => {});
  console.log('  save:', await page.$eval(noteSel, (e) => e.textContent));
  check(!!(await page.$('.aiimg-thumb-proj[data-name="Wave S test"]')), 'Save project lists "Wave S test" as kept in this browser');
  const saved = await st(() => { const t = document.querySelector('.tool').aiimgTool, S = t.state; return { doc: t.docJSON(), keys: Array.from(S.keys).sort(), name: S.image && S.image.name, fmt: S.fmt }; });
  const ls = await page.evaluate(() => { try { return localStorage.getItem('1234tools-thumbnail-maker-v1'); } catch (e) { return null; } });
  let lsj = null; try { lsj = JSON.parse(ls); } catch (e) { /* reported below */ }
  console.log('  settings:', ls);
  check(lsj && Object.keys(lsj).every((k) => ['fmt', 'out', 'safe', 'recent'].includes(k)) && lsj.fmt === 'square' && Array.isArray(lsj.recent) && lsj.recent[0] === 'fire', 'settings sit under one versioned key and hold only the size, export size, guide and recent emoji');
  const r0 = reqs.length;
  await page.reload({ waitUntil: 'networkidle0', timeout: 120000 });
  await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
  await sleep(300);
  check(notoReqs(r0) === 0, 'reloading the page does not fetch the emoji set');
  const reopen = await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.aiimg-thumb-blank button')).find((x) => /saved project/.test(x.textContent)); return b && !b.hidden ? b.textContent : null; });
  check(/Open a saved project \(1\)/.test(reopen || ''), 'after a reload the page offers the saved project (' + reopen + ')');
  check(await page.$eval('#aiimg-thumb-format', (e) => e.value) === 'square', 'the size chosen last is remembered after a reload');

  /* templates with no photo at all */
  await clickButton('.aiimg-thumb-blank', /^Start from a template without a photo$/);
  await sleep(300);
  const blankState = await st(() => { const S = document.querySelector('.tool').aiimgTool.state; return { started: S.started, image: !!S.image, pane: !document.querySelector('.aiimg-pane[data-pane=templates]').hidden }; });
  check(blankState.started && !blankState.image && blankState.pane, 'Start without a photo opens the editor on the templates');
  const blankFails = [];
  for (const id of tplIds) {
    await page.click('.aiimg-thumb-tpl[data-tpl="' + id + '"]');
    await sleep(300); await frame();
    const info = await st(() => { const S = document.querySelector('.tool').aiimgTool.state; return { tpl: S.tpl, cut: !!S.cut }; });
    await snap();
    /* the frame without its overlay layers, against the frame with them */
    const n = await page.evaluate(() => {
      const t = document.querySelector('.tool').aiimgTool, S = t.state, c = document.querySelector('.aiimg-canvas');
      const k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
      S.variant = Object.assign({}, S, { layers: S.layers.filter((l) => l.type === 'subject') });
      try { t.renderFrame(k.getContext('2d'), k.width, k.height); } finally { S.variant = null; }
      const a = k.getContext('2d').getImageData(0, 0, k.width, k.height).data;
      t.renderFrame(k.getContext('2d'), k.width, k.height);
      const b = k.getContext('2d').getImageData(0, 0, k.width, k.height).data;
      let m = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) m++;
      return m;
    });
    await canvasPng('15-blank-template-' + id + '.png');
    if (info.tpl !== id || info.cut || n < 2000) blankFails.push(id + ':' + n);
  }
  check(!blankFails.length, 'every template draws its words and stickers with no photo' + (blankFails.length ? ': ' + blankFails.join(', ') : ''));
  const rb = await exportPng();
  check(rb.png && rb.width === 1080 && rb.height === 1080, 'a design with no photo exports (1080×1080 PNG by its header)');

  /* reopen the saved project */
  await page.click('.aiimg-tabs [data-pane=projects]');
  await page.waitForSelector('.aiimg-thumb-proj[data-name="Wave S test"]', { timeout: 10000 }).catch(() => {});
  await page.click('.aiimg-thumb-proj[data-name="Wave S test"] button[aria-label^="Open"]');
  await page.waitForFunction((s) => /Opened “Wave S test”|could not|not in this browser/.test(document.querySelector(s).textContent), { timeout: 600000, polling: 300 }, noteSel).catch(() => {});
  console.log('  open:', await page.$eval(noteSel, (e) => e.textContent));
  const back = await st(() => { const t = document.querySelector('.tool').aiimgTool, S = t.state; return { doc: t.docJSON(), keys: Array.from(S.keys).sort(), name: S.image && S.image.name, fmt: S.fmt, cut: !!S.cut }; });
  check(back.doc === saved.doc, 'the reopened project’s design is identical to the one saved before the reload');
  check(back.name === saved.name && JSON.stringify(back.keys) === JSON.stringify(saved.keys) && back.cut, 'the reopened project has the same photo, the same cut-out layers and a cut-out');
  await frame();
  await canvasPng('16-reopened-canvas.png');
  const delSel = '.aiimg-thumb-proj[data-name="Wave S test"] button[aria-label^="Delete"]';
  await page.click(delSel); await page.click(delSel);
  await page.waitForFunction(() => !document.querySelector('.aiimg-thumb-proj[data-name="Wave S test"]'), { timeout: 10000 }).catch(() => {});
  const left = await st(() => document.querySelector('.tool').aiimgTool.listProjects().then((r) => r.length));
  check(left === 0, 'Delete (pressed twice) removes the project from this browser');

  /* ---- cancelling the wait for a cut-out ---- */
  /* the model is warm by now, so press Cancel the moment it appears */
  await page.evaluate(() => {
    const b = document.querySelector('.aiimg-thumb-segcancel');
    window.__cancelled = false;
    new MutationObserver((m, o) => { if (!b.hidden) { b.click(); window.__cancelled = true; o.disconnect(); } }).observe(b, { attributes: true, attributeFilter: ['hidden'] });
  });
  const input = await page.$('.aiimg input[type=file][accept="image/*"]');
  await input.uploadFile(path.join(IMG, 'portrait-of-woman_small.jpg'));
  await sleep(3000);
  const cx = await st(() => { const S = document.querySelector('.tool').aiimgTool.state; return { pressed: window.__cancelled, cut: !!S.cut, status: document.querySelector('.aiimg-status').textContent, bar: !document.querySelector('.aiimg-pane[data-pane=layers] .aiimg-progress').hidden }; });
  console.log('  cancel:', JSON.stringify(cx));
  check(cx.pressed && !cx.cut && /^Cancelled/.test(cx.status) && !cx.bar,'Cancel stops the wait for the cut-out: no cut-out appears, the progress bar goes');

  /* ---- a phone, and the light theme ---- */
  await page.click('.aiimg-tabs [data-pane=accent]');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await sleep(500);
  const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, canvas: document.querySelector('.aiimg-canvas').getBoundingClientRect().width, side: document.querySelector('.aiimg-side').getBoundingClientRect().right }));
  console.log('  phone:', JSON.stringify(ov));
  check(ov.sw <= ov.cw + 1 && ov.side <= ov.cw + 1 && ov.canvas <= ov.cw, 'nothing scrolls sideways on a 390-pixel phone');
  await page.$eval('.aiimg-canvas', (c) => c.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(OUT, '17-phone-dark.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await sleep(200);
  await page.$eval('.aiimg-pane[data-pane=accent]', (c) => c.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(OUT, '18-phone-light-stickers.png') });
  await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
  await page.click('.aiimg-tabs [data-pane=stack]');
  await page.$eval('.aiimg-canvas', (c) => c.scrollIntoView({ block: 'center' }));
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, '19-desktop-light-layers.png') });
}

(async () => {
  const t0 = Date.now();
  const stamp = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  offlineChecks();
  const server = ROOT ? await serve(ROOT, PORT) : null;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--window-size=1400,1000', '--no-first-run', '--disable-gpu-sandbox', '--disable-features=WebGPU'], protocolTimeout: 600000 });
  const logs = [], net = [], reqs = [];
  try {
    const page = await browser.newPage();
    page.on('request', (r) => reqs.push(r.url()));
    await page.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1 });
    page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (/error/i.test(m.type())) console.log('  [console]', t.slice(0, 300)); });
    page.on('pageerror', (e) => { logs.push('pageerror: ' + e.message); console.log('  [pageerror]', e.message); failures.push('page error: ' + e.message); });
    page.on('requestfailed', (r) => { logs.push('requestfailed ' + r.url()); console.log('  [requestfailed]', r.url().slice(0, 120), r.failure() && r.failure().errorText); });
    page.on('response', (r) => { const u = r.url(); if (!/^http:\/\/127\.0\.0\.1/.test(u) && !/^(data|blob):/.test(u)) net.push(r.status() + ' ' + u.slice(0, 110)); });
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' });

    await page.goto('http://127.0.0.1:' + PORT + '/ai-image/thumbnail-maker/', { waitUntil: 'networkidle0', timeout: 120000 });
    console.log(stamp(), 'page loaded; title =', await page.title());
    check((await page.title()).length <= 70, 'title is at most 70 characters');
    const h1 = await page.$eval('h1', (e) => e.textContent.trim());
    const crumbs = await page.$$eval('.crumbs li', (l) => l.map((x) => x.textContent.trim()));
    console.log('  h1 =', h1, '| crumbs =', crumbs.join(' > '));
    check(/Thumbnail Maker/.test(h1), 'h1 names the tool');
    check(!!(await page.$('.aiimg .dropzone')), 'tool mounted');
    check((await page.$$('.aiimg input[type=file][accept="image/*"]')).length === 1, 'exactly one image file input');
    await page.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await page.screenshot({ path: path.join(OUT, '1-empty.png') });

    const ready = () => page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && /ready$|could not/.test(s.textContent.trim()); }, { timeout: 600000, polling: 500 });
    const upload = async (name) => {
      const input = await page.$('.aiimg input[type=file][accept="image/*"]');
      await input.uploadFile(path.join(IMG, name));
      const t = Date.now();
      await page.waitForFunction(() => { const s = document.querySelector('.aiimg-status'); return s && !/ready$/.test(s.textContent.trim()); }, { timeout: 10000, polling: 50 }).catch(() => {});
      await ready();
      const status = await page.$eval('.aiimg-status', (e) => e.textContent.trim());
      console.log(stamp(), name, '→', status, '(' + ((Date.now() - t) / 1000).toFixed(1) + ' s)');
      check(/ready$/.test(status), name + ': status ends in "ready"');
      const layers = await page.$$eval('.aiimg-layer', (rows) => rows.map((r) => (r.querySelector('input').checked ? '[x] ' : '[ ] ') + r.querySelector('.aiimg-lname').textContent + ' ' + r.querySelector('.aiimg-area').textContent));
      console.log('  layers:', layers.join(' | '));
      await new Promise((r) => setTimeout(r, 500));
      const cut = await page.evaluate(() => { const S = document.querySelector('.tool').aiimgTool.state; return S.cut ? { w: S.cut.w, h: S.cut.h, baseH: S.subject.baseH } : null; });
      console.log('  cut-out:', JSON.stringify(cut));
      check(!!cut, name + ': a cut-out exists');
      return layers;
    };
    const canvasPng = (file) => page.$eval('.aiimg-canvas', (c) => c.toDataURL('image/png')).then((d) => fs.writeFileSync(path.join(OUT, file), Buffer.from(d.split(',')[1], 'base64')));
    const glowCheck = async (tag) => {
      await page.click('.aiimg-tabs [data-pane=glow]');
      const setStrength = async (v) => { await page.$eval('#aiimg-thumb-glows', (e, val) => { e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); await new Promise((r) => setTimeout(r, 350)); };
      await setStrength(0);
      const a = await page.$eval('.aiimg-canvas', (c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data));
      await canvasPng(tag + '-glow-0.png');
      await setStrength(100);
      const b = await page.$eval('.aiimg-canvas', (c) => Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data));
      await canvasPng(tag + '-glow-100.png');
      let changed = 0;
      for (let j = 0; j < a.length; j += 4) if (Math.abs(a[j] - b[j]) > 40 || Math.abs(a[j + 1] - b[j + 1]) > 40 || Math.abs(a[j + 2] - b[j + 2]) > 40) changed++;
      console.log('  glow: pixels changed by > 40 between strength 0 and 100 =', changed, 'of', a.length / 4);
      check(changed > 3000, tag + ': the glow is visible (more than 3,000 pixels change)');
      await setStrength(90);
    };

    /* ---- portrait ---- */
    const layers = await upload('portrait-of-woman_small.jpg');
    check(layers.some((l) => /\[x\] People/.test(l)), 'People layer is the cut-out by default');
    const dims = await page.$eval('.aiimg-canvas', (c) => [c.width, c.height]);
    check(dims[0] === 1280 && dims[1] === 720, 'preview canvas is 1280×720');
    await page.screenshot({ path: path.join(OUT, '2-portrait.png') });
    await canvasPng('2-portrait-canvas.png');
    await glowCheck('3-portrait');

    /* title and accent, for the screenshots */
    await page.click('.aiimg-tabs [data-pane=text]');
    await page.$eval('#aiimg-text', (e) => { e.value = 'I TRIED\nTHIS'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click('.aiimg-tabs [data-pane=accent]');
    await page.$eval('#aiimg-thumb-accent', (e) => { e.value = 'arrow'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, '4-portrait-title-arrow.png') });
    await canvasPng('4-portrait-title-arrow-canvas.png');

    /* three variants */
    await page.click('.aiimg-tabs [data-pane=export]');
    const results = () => page.$$eval('.aiimg-result-head', (h) => h.map((x) => x.textContent.trim()));
    const tv = Date.now();
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Export 3 variants/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 3, { timeout: 120000, polling: 300 });
    await new Promise((r) => setTimeout(r, 400));
    const heads = await results();
    console.log(stamp(), 'variants:', heads.slice(0, 3).join(' || '), '| took', ((Date.now() - tv) / 1000).toFixed(1) + 's');
    check(heads.length >= 3 && /-c\.png/.test(heads[0]) && /-b\.png/.test(heads[1]) && /-a\.png/.test(heads[2]), 'three results named -a, -b, -c');

    /* JPEG under 2 MB */
    await page.evaluate(() => { for (const b of document.querySelectorAll('.aiimg-pane[data-pane=export] button')) if (/Download JPEG/.test(b.textContent)) b.click(); });
    await page.waitForFunction(() => document.querySelectorAll('.aiimg-result').length >= 4, { timeout: 60000 });
    console.log(stamp(), 'jpeg:', (await results())[0]);
    await page.screenshot({ path: path.join(OUT, '5-export.png') });

    const blobs = await page.evaluate(async () => {
      const out = [];
      for (const row of document.querySelectorAll('.aiimg-result')) {
        const el = row.querySelector('img');
        const name = row.querySelector('.aiimg-result-head strong').textContent;
        const b = await (await fetch(el.src)).blob();
        const buf = new Uint8Array(await b.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        /* a coarse sample of the decoded picture, for comparing variants */
        const bmp = await createImageBitmap(b);
        const c = document.createElement('canvas'); c.width = 64; c.height = 36;
        c.getContext('2d').drawImage(bmp, 0, 0, 64, 36);
        out.push({ name, type: b.type, size: b.size, b64: btoa(bin), sample: Array.from(c.getContext('2d').getImageData(0, 0, 64, 36).data) });
      }
      return out;
    });
    const byName = {};
    for (const b of blobs) {
      const f = path.join(OUT, b.name);
      const buf = Buffer.from(b.b64, 'base64');
      fs.writeFileSync(f, buf);
      const info = b.type === 'image/png' ? pngSize(buf) : {};
      console.log('  saved', b.name, b.size, 'bytes, magic:', buf.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.'), info.width ? info.width + '×' + info.height : '');
      byName[b.name] = { buf, size: b.size, sample: b.sample, type: b.type, ...info };
    }
    const vA = blobs.find((b) => /-a\.png$/.test(b.name)), vB = blobs.find((b) => /-b\.png$/.test(b.name)), vC = blobs.find((b) => /-c\.png$/.test(b.name));
    const jpg = blobs.find((b) => /\.jpg$/.test(b.name));
    for (const v of [vA, vB, vC]) {
      if (!v) { check(false, 'variant missing'); continue; }
      const buf = Buffer.from(v.b64, 'base64');
      const s = pngSize(buf);
      check(buf.subarray(1, 4).toString() === 'PNG' && s.width === 1280 && s.height === 720, v.name + ' is a 1280×720 PNG');
    }
    const differ = (p, q) => { let n = 0; for (let j = 0; j < p.sample.length; j += 4) if (Math.abs(p.sample[j] - q.sample[j]) > 24 || Math.abs(p.sample[j + 1] - q.sample[j + 1]) > 24 || Math.abs(p.sample[j + 2] - q.sample[j + 2]) > 24) n++; return n / (p.sample.length / 4); };
    if (vA && vB && vC) {
      const ab = differ(vA, vB), ac = differ(vA, vC), bc = differ(vB, vC);
      console.log('  variants differ: A/B', (ab * 100).toFixed(1) + '%', 'A/C', (ac * 100).toFixed(1) + '%', 'B/C', (bc * 100).toFixed(1) + '%', 'of sampled pixels');
      check(ab > 0.1 && ac > 0.1 && bc > 0.1, 'the three variants differ from each other (more than 10% of sampled pixels)');
    }
    check(jpg && jpg.type === 'image/jpeg' && Buffer.from(jpg.b64, 'base64').subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), 'JPEG export has the JPEG magic');
    check(jpg && jpg.size <= 2000000, 'JPEG is at most 2,000,000 bytes (' + (jpg ? jpg.size : '-') + ')');

    /* ---- a street scene: people among bikes and cars ---- */
    await upload('city-streets.jpg');
    await page.screenshot({ path: path.join(OUT, '6-streets.png') });
    await canvasPng('6-streets-canvas.png');
    await glowCheck('7-streets');
    await page.click('.aiimg-tabs [data-pane=background]');
    await page.$eval('#aiimg-thumb-bg', (e) => { e.value = 'gradient'; e.dispatchEvent(new Event('change', { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 400));
    await canvasPng('8-streets-gradient-canvas.png');

    await editorChecks(page, { stamp, upload, canvasPng, reqs, results });

    const third =[...new Set(net.map((n) => n.replace(/\?.*$/, '')))];
    console.log('  third-party responses:', third.length ? third.join('\n    ') : 'none');
    check(third.length === 0, 'zero third-party requests');
  } finally {
    fs.writeFileSync(path.join(OUT, 'console.log'), logs.join('\n'));
    await browser.close();
    if (server) server.close();
  }
  console.log(stamp(), failures.length ? 'FAILED: ' + failures.length + ' check(s)\n  - ' + failures.join('\n  - ') : 'all checks passed');
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
