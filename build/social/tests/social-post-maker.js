/*
 * Social Post Maker (/social/social-post-maker/) in headless Chrome:
 *
 *   1. the page, nine templates, eight sizes in the grid;
 *   2. every template at every size with the example, long and absurd
 *      text, with a logo and a handle: every box inside the frame, text
 *      inside the content area and clear of the logo, label and handle,
 *      the story size's top and bottom 250 px left empty, no text under
 *      14 px, absurd text flagged as cut and named under the preview;
 *   3. the ZIP of all sizes, read with this suite's own ZIP and PNG readers:
 *      one PNG per size, named post-<size>-<w>x<h>.png, each IHDR the
 *      size in the table; the Offer background pixel in the accent colour;
 *      "Make each one separately" lists eight Download buttons;
 *   4. Cancel; the brand kit (logo shrunk to 512 px) kept only on Save,
 *      shared with the Carousel Maker, removed by Forget; the words never
 *      stored; keyboard; 390 and 1400 px in both themes; no outside request.
 *
 *   node build/social/tests/social-post-maker.js [--root <site>] [--port 8876] [--out <dir>]
 */
'use strict';
const zlib = require('zlib');
const T = require('./_kit.js')({ name: 'social-post-maker', port: 8876 });
const URL_ = '/social/social-post-maker/';
/* the size table, as the platforms give it (checked 6 October 2026) */
const SIZES = { 'ig-square': [1080, 1080], 'ig-portrait': [1080, 1350], story: [1080, 1920], x: [1920, 1080], linkedin: [1200, 628], facebook: [1200, 630], pinterest: [1000, 1500], youtube: [1080, 1080] };

function makePng(w, h) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(T.crc32(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 4 + 1) + 1 + x * 4; const on = (x / w - 0.5) ** 2 + (y / h - 0.5) ** 2 < 0.2; raw[o] = 240; raw[o + 1] = 80; raw[o + 2] = 40; raw[o + 3] = on ? 255 : 0; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const exportBtn = (p, re) => p.evaluate((src) => [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => new RegExp(src).test(b.textContent)).click(), re.source);

(async () => {
  await T.start();
  const p = await T.open(URL_, { wait: '.social-post-canvas' });
  T.section('1. the page');
  T.check(/Social Post Maker/.test(await p.$eval('h1', (e) => e.textContent)), 'h1 says Social Post Maker');
  const tpls = await p.$$eval('#pm-template option', (l) => l.map((o) => o.textContent));
  T.check(tpls.length >= 8, tpls.length + ' templates: ' + tpls.join(', '));
  const grid = await p.$$eval('.social-size', (l) => l.map((f) => f.dataset.size));
  T.check(grid.join(',') === Object.keys(SIZES).join(','), 'the grid shows all eight sizes');
  const table = await p.evaluate(() => window.SocialKit.SIZES.map((s) => [s.id, s.w, s.h]));
  T.check(table.every(([id, w, h]) => SIZES[id] && SIZES[id][0] === w && SIZES[id][1] === h), 'the engine’s size table matches the platforms’ figures');

  T.section('2. every template at every size');
  const logoFile = T.save('logo.png', makePng(600, 240));
  const LONG = 'Our winter opening hours change from Monday: we open an hour later and close an hour earlier, every day until the end of February. ';
  const HUGE = 'Pneumonoultramicroscopicsilicovolcanoconiosis '.repeat(30);
  const res = await p.evaluate(async (LONG, HUGE) => {
    const P = document.querySelector('.tool').__post;
    await document.fonts.ready;
    const logo = document.createElement('canvas'); logo.width = 600; logo.height = 240; logo.getContext('2d').fillRect(0, 0, 600, 240);
    P.state.logo = logo; P.state.brand.handle = '@a_long_handle_for_the_test'; P.state.showHandle = true;
    const ins = (b, q) => b.x >= q.x - 0.5 && b.y >= q.y - 0.5 && b.x + b.w <= q.x + q.w + 0.5 && b.y + b.h <= q.y + q.h + 0.5;
    const ov = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
    const out = [];
    const c = document.createElement('canvas');
    for (const t of P.TEMPLATES) {
      for (const [len, fields] of [['example', t.ex], ['long', { heading: LONG.slice(0, 90), text: LONG + LONG, footer: LONG.slice(0, 70) }], ['huge', { heading: HUGE, text: HUGE + HUGE, footer: HUGE }]]) {
        P.state.template = t.id; Object.assign(P.state, fields);
        for (const s of window.SocialKit.SIZES) {
          c.width = s.w; c.height = s.h;
          const r = P.renderPost(c.getContext('2d'), s.w, s.h);
          const frame = { x: 0, y: 0, w: s.w, h: s.h };
          const band = { x: 0, y: r.safe, w: s.w, h: s.h - 2 * r.safe };
          out.push({
            t: t.id, len, size: s.id,
            outFrame: r.boxes.concat(r.chrome).filter((b) => !ins(b, frame)).map((b) => b.role),
            outContent: r.boxes.filter((b) => !ins(b, r.content)).map((b) => b.role),
            clash: r.boxes.flatMap((b) => r.chrome.filter((ch) => ov(b, ch)).map((ch) => b.role + '/' + ch.role)),
            outSafe: r.boxes.concat(r.chrome).filter((b) => !ins(b, band)).map((b) => b.role),
            safe: r.safe, minPx: Math.min(...r.boxes.map((b) => b.px)), truncated: r.truncated, n: r.boxes.length
          });
        }
      }
    }
    return out;
  }, LONG, HUGE);
  const bad = res.filter((r) => r.outFrame.length || r.outContent.length || r.clash.length || r.outSafe.length);
  T.check(res.length === 9 * 3 * 8 && !bad.length, res.length + ' renders: text inside the frame and its area, clear of logo, label and handle' + (bad.length ? ' — ' + bad.slice(0, 5).map((r) => r.t + '/' + r.len + '/' + r.size + ': ' + r.outFrame.concat(r.outContent, r.clash, r.outSafe.map((x) => 'safe:' + x)).join(';')).join(' | ') : ''));
  T.check(res.filter((r) => r.size === 'story').every((r) => r.safe === 250), 'story size: 250 px kept clear top and bottom');
  T.check(res.every((r) => r.minPx >= 14), 'no text under 14 px (smallest ' + Math.min(...res.map((r) => r.minPx)).toFixed(1) + ' px)');
  T.check(res.filter((r) => r.len === 'example').every((r) => !r.truncated), 'every example fits every size uncut');
  T.check(res.filter((r) => r.len === 'huge').every((r) => r.truncated), 'absurd text is flagged as cut at every size');
  const longCut = res.filter((r) => r.len === 'long' && r.truncated).map((r) => r.t + '/' + r.size);
  console.log('     long text cut in: ' + (longCut.length ? longCut.join(', ') : 'none'));
  /* the page names the sizes where text was cut */
  await p.evaluate(() => { const P = document.querySelector('.tool').__post; P.setTemplate('quote'); });
  await p.evaluate((h) => { const t = document.getElementById('pm-text'); t.value = h; t.dispatchEvent(new Event('input', { bubbles: true })); }, HUGE + HUGE);
  await p.waitForFunction(() => /Too much text/.test(document.querySelector('.social-warn').textContent), { timeout: 5000 });
  T.check(/Instagram post/.test(await p.$eval('.social-warn', (e) => e.textContent)), 'the warning names the sizes: ' + (await p.$eval('.social-warn', (e) => e.textContent)).slice(0, 90) + '…');
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=words] button')].find((b) => /example/.test(b.textContent)).click());

  T.section('3. exports');
  await p.select('#pm-template', 'offer');
  await p.evaluate(() => { const i = document.getElementById('pm-accent'); i.value = '#ff5a1f'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('#pm-tab-export');
  await T.clearDownloads(p);
  let t = Date.now();
  await exportBtn(p, /ticked sizes/);
  let d = await T.waitDownloads(p, 1);
  const ms = Date.now() - t;
  T.check(d[0].name === 'social-posts-offer.zip' && d[0].type === 'application/zip', d[0].name + ' (' + d[0].type + '), ' + d[0].bytes.length + ' bytes, ' + ms + ' ms');
  T.save(d[0].name, d[0].bytes);
  const files = T.unzip(d[0].bytes);
  T.check(files.length === 8 && files.every((f) => f.crcOk && f.method === 0), 'eight entries, each CRC-32 right');
  const sizesOk = files.map((f) => { const m = /^post-([a-z-]+)-(\d+)x(\d+)\.png$/.exec(f.name); const h = T.png(f.data); return m && SIZES[m[1]] && h.ok && h.w === SIZES[m[1]][0] && h.h === SIZES[m[1]][1] && +m[2] === h.w && +m[3] === h.h; });
  T.check(sizesOk.every(Boolean), 'each PNG’s IHDR is its platform size and its name says so: ' + files.map((f) => f.name).join(', '));
  console.log('     PNG sizes: ' + files.map((f) => f.name.replace(/^post-|\.png$/g, '') + ' ' + f.size).join(', '));
  const px = await p.evaluate(async (arr) => {
    const bm = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
    const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return Array.from(x.getImageData(3, bm.height - 3, 1, 1).data);
  }, Array.from(files.find((f) => /linkedin/.test(f.name)).data));
  T.check(px[0] === 0xff && px[1] === 0x5a && px[2] === 0x1f, 'Offer background is the accent #ff5a1f: rgb(' + px.slice(0, 3).join(', ') + ')');
  await p.evaluate(() => { document.getElementById('pm-size-pinterest').click(); document.getElementById('pm-size-youtube').click(); });
  await exportBtn(p, /each one separately/);
  await p.waitForFunction(() => /ready below/.test(document.querySelector('.social-job-status').textContent), { timeout: 60000 });
  const rows = await p.$$eval('.aiimg-pane[data-pane=export] .aiimg-result', (l) => l.map((r) => r.querySelector('strong').textContent));
  T.check(rows.length === 6 && !rows.some((n) => /pinterest|youtube/.test(n)), 'unticked sizes are left out: six separate results');
  await T.clearDownloads(p);
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] .aiimg-result')].find((r) => /story/.test(r.textContent)).querySelector('.btn-download').click());
  d = await T.waitDownloads(p, 1);
  const h = T.png(d[0].bytes);
  T.check(d[0].name === 'post-story-1080x1920.png' && d[0].type === 'image/png' && h.ok && h.w === 1080 && h.h === 1920, 'its own Download: ' + d[0].name + ', ' + h.w + ' × ' + h.h);
  await p.evaluate(() => { document.getElementById('pm-size-pinterest').click(); document.getElementById('pm-size-youtube').click(); });
  await T.clearDownloads(p);
  await exportBtn(p, /ticked sizes/);
  await p.waitForFunction(() => !document.querySelector('.social-cancel').hidden, { timeout: 5000 }).catch(() => {});
  const canSee = await p.$eval('.social-cancel', (b) => !b.hidden);
  await p.click('.social-cancel').catch(() => {});
  await p.waitForFunction(() => /Cancelled|Saved/.test(document.querySelector('.social-job-status').textContent), { timeout: 60000 });
  const st = await p.$eval('.social-job-status', (e) => e.textContent);
  await T.sleep(400);
  T.check(canSee && /Cancelled/.test(st) && (await p.evaluate(() => window.__downloads.length)) === 0, 'Cancel stops the eight-size export and nothing is saved: ' + st);

  T.section('4. the brand kit and what is stored');
  await p.click('#pm-tab-brand');
  await (await p.$('#pm-logo')).uploadFile(logoFile);
  await p.waitForFunction(() => /Logo added/.test(document.querySelector('.social-post > .io-msg').textContent), { timeout: 20000 });
  await p.evaluate(() => { const h = document.getElementById('pm-handle'); h.value = '@smallbatch'; h.dispatchEvent(new Event('input', { bubbles: true })); });
  const pre = await p.evaluate(() => Object.keys(localStorage).filter((k) => /social/.test(k)));
  T.check(pre.join(',') === '1234tools-social-post-maker-v1', 'before Save only the settings key exists: ' + pre.join(', '));
  const set = JSON.parse(await p.evaluate(() => localStorage.getItem('1234tools-social-post-maker-v1')));
  T.check(set.template === 'offer' && !/Everything in the autumn|AUTUMN20/.test(JSON.stringify(set)), 'the settings hold the template and not the words: ' + JSON.stringify(set));
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=brand] button')].find((b) => /Save brand kit/.test(b.textContent)).click());
  const logo = await p.evaluate(async () => { const u = localStorage.getItem('1234tools-social-logo-v1'); if (!u) return null; const i = new Image(); i.src = u; await i.decode(); return [i.width, i.height, u.slice(0, 22)]; });
  T.check(logo && logo[0] === 512 && logo[1] === 205 && logo[2] === 'data:image/png;base64,', 'Save keeps the logo as a PNG shrunk to 512 px wide: ' + JSON.stringify(logo));
  const c = await T.open('/social/carousel-maker/', { wait: '.social-phone canvas', keepStorage: true });
  T.check((await c.$eval('#car-handle', (i) => i.value)) === '@smallbatch' && (await c.$eval('#car-accent', (i) => i.value)) === '#ff5a1f', 'the Carousel Maker opens with the same saved kit');
  await c.close();
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=brand] button')].find((b) => /Forget/.test(b.textContent)).click());
  T.check((await p.evaluate(() => Object.keys(localStorage).filter((k) => /brand|logo/.test(k)))).length === 0, 'Forget removes the kit and the logo');
  const kb = await T.keyboard(p);
  T.check(!kb.bad.length && !kb.unlabelled.length, kb.n + ' visible controls reachable with Tab and labelled' + (kb.unlabelled.length ? '; unlabelled: ' + kb.unlabelled.join(', ') : ''));
  await p.close();
  await T.layouts(URL_);
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + e.message); await T.finish(); });
