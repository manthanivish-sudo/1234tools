/*
 * Carousel Maker (/social/carousel-maker/) in headless Chrome:
 *
 *   1. the page, the example carousel, the phone preview at 1080 × 1350;
 *   2. every template at both sizes with short, long and absurdly long
 *      text, with and without a photo: every text box inside the frame and
 *      inside the content area, none under the indicator, cue, handle or
 *      logo, nothing smaller than 22 px at 1080 wide, and over-long text
 *      flagged as cut; the swipe cue on every slide but the last;
 *   3. slides added, moved and deleted with the buttons; photos added by the
 *      file input, a text file refused by name;
 *   4. the ZIP, read with this suite's own ZIP reader: carousel-01.png …
 *      in order, every CRC right, every PNG valid with an IHDR of 1080 ×
 *      1350 (then 1080 × 1080 for the square size), the background pixel in
 *      the brand colour;
 *   5. the PDF, read with this suite's own parser (xref offsets, page count,
 *      MediaBox, DCTDecode JPEG per page) and rendered back with the site's
 *      pdf.js: as many pages as slides, 810 × 1012.5 pt, ink on each;
 *   6. Cancel stops a 20-slide export with nothing saved; timings;
 *   7. remembered settings, the brand kit kept only on Save, slides never;
 *   8. keyboard, 390 and 1400 px in both themes, no request off 127.0.0.1.
 *
 *   node build/social/tests/carousel-maker.js [--root <site>] [--port 8875] [--out <dir>]
 */
'use strict';
const zlib = require('zlib');
const T = require('./_kit.js')({ name: 'carousel-maker', port: 8875 });
const URL_ = '/social/carousel-maker/';

/** A solid-colour PNG, written here from the PNG specification. */
function makePng(w, h, rgb) {
  const crc = (b) => T.crc32(b);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = (rgb[1] + y) & 255; raw[o + 2] = rgb[2]; }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  await T.start();
  const p = await T.open(URL_, { wait: '.social-phone canvas' });
  const api = (fn, ...a) => p.evaluate(new Function('args', 'const C = document.querySelector(".tool").__carousel; return (' + fn + ')(C, ...args);'), a);

  T.section('1. the page');
  T.check(/Carousel Maker/.test(await p.$eval('h1', (e) => e.textContent)), 'h1 says Carousel Maker');
  const c0 = await p.$eval('.social-phone canvas', (c) => [c.width, c.height]);
  T.check(c0[0] === 1080 && c0[1] === 1350, 'preview canvas is 1080 × 1350');
  T.check((await p.$$('.social-slide')).length === 5, 'the example has five slides');
  T.check((await p.$$eval('#car-template option', (l) => l.length)) >= 6, 'at least six templates: ' + (await p.$$eval('#car-template option', (l) => l.map((o) => o.textContent).join(', '))));

  T.section('2. layout: every template, both sizes, three lengths of text');
  const LONG = 'Write one idea per slide and keep the words big enough to read on a phone held at arm’s length in daylight. '.repeat(3);
  const HUGE = 'Antidisestablishmentarianism '.repeat(40) + 'Supercalifragilisticexpialidocious'.repeat(6);
  const res = await api(async (C, LONG, HUGE) => {
    const out = [];
    const c = document.createElement('canvas');
    const photo = document.createElement('canvas'); photo.width = 1600; photo.height = 1000;
    const px = photo.getContext('2d'); px.fillStyle = '#3a7'; px.fillRect(0, 0, 1600, 1000);
    const saved = JSON.parse(JSON.stringify({ t: C.state.template, s: C.state.size, sl: C.state.slides.map((s) => [s.title, s.body]) }));
    C.state.brand.handle = '@a_rather_long_handle_for_testing';
    C.state.progress = 'dots'; C.state.swipe = true; C.state.showHandle = true;
    const logo = document.createElement('canvas'); logo.width = 300; logo.height = 100; logo.getContext('2d').fillRect(0, 0, 300, 100);
    C.state.logo = logo;
    for (const tpl of C.TEMPLATES.map((t) => t[0])) {
      for (const size of ['portrait', 'square']) {
        for (const [len, title, body] of [['short', 'Short title', 'One line.'], ['long', LONG.slice(0, 120), LONG + '\nSecond line\nThird line'], ['huge', HUGE, HUGE + '\n' + HUGE]]) {
          for (const withPhoto of [false, true]) {
            C.state.template = tpl; C.state.size = size;
            C.state.slides = [0, 1, 2].map((k) => ({ id: 'x' + k, title, body, img: withPhoto ? photo : null, imgName: withPhoto ? 'p.png' : '' }));
            const z = C.SIZES[size];
            for (const k of [0, 2]) {
              c.width = z.w; c.height = z.h;
              const r = C.renderSlide(c.getContext('2d'), z.w, z.h, k);
              const frame = { x: 0, y: 0, w: z.w, h: z.h };
              const text = r.boxes.filter((b) => b.role !== 'photo');
              const ins = (b, q) => b.x >= q.x - 0.5 && b.y >= q.y - 0.5 && b.x + b.w <= q.x + q.w + 0.5 && b.y + b.h <= q.y + q.h + 0.5;
              const ov = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
              out.push({
                tpl, size, len, withPhoto, k,
                outFrame: r.boxes.concat(r.chrome).filter((b) => !ins(b, frame)).map((b) => b.role),
                outContent: text.filter((b) => !ins(b, r.content)).map((b) => b.role + ' ' + Math.round(b.x) + ',' + Math.round(b.y) + ' ' + Math.round(b.w) + 'x' + Math.round(b.h)),
                clash: text.flatMap((b) => r.chrome.filter((ch) => ov(b, ch)).map((ch) => b.role + '/' + ch.role)),
                minPx: Math.min(...text.filter((b) => b.px).map((b) => b.px)),
                truncated: r.truncated, swipe: r.chrome.some((b) => b.role === 'swipe'), n: text.length
              });
            }
          }
        }
      }
    }
    C.state.template = saved.t; C.state.size = saved.s; C.state.logo = null; C.state.brand.handle = '';
    C.state.slides = saved.sl.map((x, k) => ({ id: 'r' + k, title: x[0], body: x[1], img: null, imgName: '' }));
    return out;
  }, LONG, HUGE);
  const bad = res.filter((r) => r.outFrame.length || r.outContent.length || r.clash.length);
  T.check(res.length === 7 * 2 * 3 * 2 * 2 && !bad.length, res.length + ' renders: no text outside the frame or the content area, none under the chrome' + (bad.length ? ' — ' + bad.slice(0, 4).map((r) => r.tpl + '/' + r.size + '/' + r.len + (r.withPhoto ? '/photo' : '') + ': ' + r.outFrame.concat(r.outContent, r.clash).join('; ')).join(' | ') : ''));
  const small = res.filter((r) => r.minPx < 22 - 0.01);
  T.check(!small.length, 'no text under 22 px at 1080 wide (smallest ' + Math.min(...res.map((r) => r.minPx)).toFixed(1) + ' px)');
  T.check(res.filter((r) => r.len === 'short').every((r) => !r.truncated), 'short text is never cut');
  T.check(res.filter((r) => r.len === 'huge').every((r) => r.truncated), 'absurd text is always flagged as cut');
  const longCut = res.filter((r) => r.len === 'long' && r.truncated).map((r) => r.tpl + '/' + r.size + (r.withPhoto ? '/photo' : ''));
  console.log('     long text cut in: ' + (longCut.length ? [...new Set(longCut)].join(', ') : 'none'));
  T.check(res.every((r) => r.swipe === (r.k === 0)), 'the swipe cue is on the first slide and not on the last');

  T.section('3. slides and photos');
  const titles = () => p.$$eval('.social-slide input[type=text]', (l) => l.map((i) => i.value));
  const t0 = await titles();
  await p.click('.social-slide[data-slide="2"] button[aria-label="Move slide 2 up"]');
  let t1 = await titles();
  T.check(t1[0] === t0[1] && t1[1] === t0[0], 'Move up swaps slides 1 and 2');
  await p.click('.social-slide[data-slide="5"] button[aria-label="Delete slide 5"]');
  T.check((await titles()).length === 4, 'Delete removes a slide');
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=slides] .btn-ghost')].find((b) => /Add a slide/.test(b.textContent)).click());
  T.check((await titles()).length === 5 && (await titles())[4] === 'New slide', 'Add a slide appends one');
  const png1 = T.save('photo-a.png', makePng(400, 300, [200, 40, 60]));
  const png2 = T.save('photo-b.png', makePng(300, 400, [40, 60, 200]));
  const txt = T.save('notes.txt', Buffer.from('not an image'));
  const input = await p.$('.aiimg-pane[data-pane=slides] > input[type=file]');
  await input.uploadFile(png1, txt, png2);
  await p.waitForFunction(() => /photo/.test(document.querySelector('.social-carousel > .io-msg').textContent), { timeout: 20000 });
  const msg = await p.$eval('.social-carousel > .io-msg', (e) => e.textContent);
  T.check(/2 photos added/.test(msg) && /notes\.txt is not an image/.test(msg), 'two photos added, the text file refused by name: ' + msg);
  const names = await p.$$eval('.social-photo-name', (l) => l.map((e) => e.textContent));
  T.check(names.join(',') === 'photo-a.png,photo-b.png', 'photos on slides 1 and 2: ' + names.join(', '));
  await p.click('.social-slide[data-slide="1"] .social-slide-photo button:last-child');
  T.check((await p.$$('.social-photo-name')).length === 1, 'Remove photo takes it off');
  await p.focus('.social-phone canvas');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
  await T.sleep(100);
  T.check(/Slide 3 of 5/.test(await p.$eval('.social-counter', (e) => e.textContent)), 'the right arrow key moves the preview: ' + await p.$eval('.social-counter', (e) => e.textContent));

  T.section('4. the ZIP');
  await p.evaluate(() => { const i = document.getElementById('car-bg'); i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('#car-tab-export');
  await T.clearDownloads(p);
  let t = Date.now();
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => /ZIP of PNGs/.test(b.textContent)).click());
  let d = await T.waitDownloads(p, 1);
  const zipMs = Date.now() - t;
  T.check(d[0].name === 'carousel-1080x1350.zip' && d[0].type === 'application/zip', 'download ' + d[0].name + ' (' + d[0].type + '), ' + d[0].bytes.length + ' bytes, ' + zipMs + ' ms');
  T.save(d[0].name, d[0].bytes);
  let files = T.unzip(d[0].bytes);
  T.check(files.map((f) => f.name).join(',') === 'carousel-01.png,carousel-02.png,carousel-03.png,carousel-04.png,carousel-05.png', 'entries in order: ' + files.map((f) => f.name).join(', '));
  T.check(files.every((f) => f.method === 0 && f.crcOk), 'every entry stored with a correct CRC-32');
  const ihdr = files.map((f) => T.png(f.data));
  T.check(ihdr.every((h) => h.ok && h.w === 1080 && h.h === 1350), 'every PNG valid, IHDR 1080 × 1350: ' + ihdr.map((h) => h.w + '×' + h.h).join(', '));
  const px = await p.evaluate(async (arr) => {
    const bm = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
    const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
    return Array.from(x.getImageData(20, 700, 1, 1).data);
  }, Array.from(files[3].data));
  T.check(px[0] === 0x12 && px[1] === 0x34 && px[2] === 0x56, 'slide 4’s margin is the brand background #123456: rgb(' + px.slice(0, 3).join(', ') + ')');
  console.log('     ZIP sizes: ' + files.map((f) => f.size).join(', ') + ' bytes; total ' + d[0].bytes.length);
  await p.select('#car-size', 'square');
  await T.clearDownloads(p);
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => /ZIP of PNGs/.test(b.textContent)).click());
  d = await T.waitDownloads(p, 1);
  files = T.unzip(d[0].bytes);
  T.check(d[0].name === 'carousel-1080x1080.zip' && files.length === 5 && files.every((f) => { const h = T.png(f.data); return h.ok && h.w === 1080 && h.h === 1080; }), 'square: ' + d[0].name + ', five PNGs of 1080 × 1080');
  await p.select('#car-size', 'portrait');

  T.section('5. the PDF');
  await T.clearDownloads(p);
  t = Date.now();
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => /PDF for LinkedIn/.test(b.textContent)).click());
  d = await T.waitDownloads(p, 1);
  const pdfMs = Date.now() - t;
  T.check(d[0].name === 'carousel-linkedin.pdf' && d[0].type === 'application/pdf', 'download ' + d[0].name + ' (' + d[0].type + '), ' + d[0].bytes.length + ' bytes, ' + pdfMs + ' ms');
  T.save(d[0].name, d[0].bytes);
  const pdf = T.pdf(d[0].bytes);
  T.check(pdf.header.startsWith('%PDF-1.4') && pdf.eof && pdf.xrefOk, 'header, xref offsets and %%EOF are right');
  T.check(pdf.count === 5 && pdf.pages.length === 5, 'the page tree counts 5 pages');
  T.check(pdf.pages.every((g) => g.box && g.box.join(' ') === '0 0 810 1012.5' && g.image && g.image.w === 1080 && g.image.h === 1350 && g.image.filter === 'DCTDecode' && g.image.soi), 'each page is 810 × 1012.5 pt holding a 1080 × 1350 JPEG (DCTDecode)');
  const r = await T.pdfjs(p, d[0].bytes);
  T.check(r.n === 5 && r.pages.every((g) => Math.abs(g.w - 810) < 0.01 && Math.abs(g.h - 1012.5) < 0.01 && g.ink > 0.05), 'pdf.js opens it: ' + r.n + ' pages, ink ' + r.pages.map((g) => g.ink.toFixed(2)).join(', '));

  T.section('6. Cancel and timing');
  await api((C) => { const s = C.state.slides[0]; for (let k = C.state.slides.length; k < 20; k++) C.state.slides.push({ id: 'z' + k, title: 'Slide ' + (k + 1), body: 'Body text for slide ' + (k + 1), img: s.img, imgName: '' }); });
  await T.clearDownloads(p);
  t = Date.now();
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => /ZIP of PNGs/.test(b.textContent)).click());
  await T.sleep(150);
  const shown = await p.$eval('.social-cancel', (b) => !b.hidden);
  await p.click('.social-cancel');
  await p.waitForFunction(() => /Cancelled/.test(document.querySelector('.social-job-status').textContent), { timeout: 30000 });
  await T.sleep(500);
  T.check(shown && (await p.evaluate(() => window.__downloads.length)) === 0, 'Cancel shows during a 20-slide export, stops it, and nothing is saved');
  t = Date.now();
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => /ZIP of PNGs/.test(b.textContent)).click());
  d = await T.waitDownloads(p, 1);
  const z20 = Date.now() - t;
  T.check(T.unzip(d[0].bytes).length === 20, '20 slides: ZIP of 20 PNGs in ' + z20 + ' ms, ' + d[0].bytes.length + ' bytes');
  const lt = await p.evaluate(async () => {
    /* the longest task while exporting: the page must stay responsive */
    let worst = 0; let last = performance.now(); let run = true;
    const tick = () => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; if (run) setTimeout(tick, 0); };
    tick();
    window.__downloads = [];
    [...document.querySelectorAll('.aiimg-pane[data-pane=export] button')].find((b) => /PDF for LinkedIn/.test(b.textContent)).click();
    while (!window.__downloads.length) await new Promise((r) => setTimeout(r, 50));
    run = false;
    return worst;
  });
  console.log('     longest main-thread gap during a 20-page PDF export: ' + Math.round(lt) + ' ms');
  T.check(lt < 1000, 'the page keeps responding during a 20-page PDF export (longest gap ' + Math.round(lt) + ' ms)');

  T.section('7. what is remembered');
  await p.select('#car-template', 'checklist');
  await p.select('#car-progress', 'bar');
  const ls = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => /social/.test(k)).map((k) => [k, localStorage.getItem(k)])));
  T.check(Object.keys(ls).join(',') === '1234tools-social-carousel-v1' && JSON.parse(ls['1234tools-social-carousel-v1']).template === 'checklist' && !/Slide 7|Use daylight/.test(JSON.stringify(ls)), 'only the settings key, holding the template, not the slides: ' + JSON.stringify(ls));
  await p.click('#car-tab-brand');
  await p.evaluate(() => { const h = document.getElementById('car-handle'); h.value = '@studio'; h.dispatchEvent(new Event('input', { bubbles: true })); });
  T.check(!(await p.evaluate(() => localStorage.getItem('1234tools-social-brand-v1'))), 'typing a handle stores nothing');
  await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=brand] button')].find((b) => /Save brand kit/.test(b.textContent)).click());
  const kit = await p.evaluate(() => JSON.parse(localStorage.getItem('1234tools-social-brand-v1') || 'null'));
  T.check(kit && kit.handle === '@studio' && kit.bg === '#123456', 'Save keeps the kit: ' + JSON.stringify(kit));
  const p2 = await T.open(URL_, { wait: '.social-phone canvas', keepStorage: true });
  const back = await p2.evaluate(() => ({ t: document.getElementById('car-template').value, pr: document.getElementById('car-progress').value, h: document.getElementById('car-handle').value, n: document.querySelectorAll('.social-slide').length }));
  T.check(back.t === 'checklist' && back.pr === 'bar' && back.h === '@studio' && back.n === 5, 'a new visit restores the settings and the kit, and starts from the example slides: ' + JSON.stringify(back));
  await p2.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=brand] button')].find((b) => /Forget/.test(b.textContent)).click());
  T.check(!(await p2.evaluate(() => localStorage.getItem('1234tools-social-brand-v1'))), 'Forget removes the kit');
  const kb = await T.keyboard(p2);
  T.check(!kb.bad.length && !kb.unlabelled.length, kb.n + ' visible controls reachable with Tab and labelled' + (kb.bad.length ? '; not: ' + kb.bad.join(' | ') : '') + (kb.unlabelled.length ? '; unlabelled: ' + kb.unlabelled.join(', ') : ''));
  await p2.close(); await p.close();

  T.section('8. layout');
  await T.layouts(URL_);
  await T.finish();
})().catch(async (e) => { console.error(e); T.fails.push('the run broke: ' + e.message); await T.finish(); });
