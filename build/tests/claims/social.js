/**
 * Claims on the Social Media Tools' pages (/social/): the counting and the
 * engagement formulas in Node (engine/social-caption-counter.js and
 * engine/social-engagement-rate-calculator.js in a vm with a stub window),
 * and the carousel, the post maker, the counter's storage and the
 * calculator's copy in Chrome. Files are read back with readers written
 * here (ZIP local headers and CRC-32, PNG IHDR, the PDF through the site's
 * pdf.js), never with the engines' own code.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const engine = (file, name) => K.once('social-' + file, () => {
    const sb = { console, Intl, TextEncoder, URLSearchParams }; sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(K.ROOT, 'engine', file), 'utf8'), sb, { filename: file });
    return sb[name];
  });
  const CC = () => engine('social-caption-counter.js', 'SocialCount');
  const ER = () => engine('social-engagement-rate-calculator.js', 'SocialER');
  const crcT = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t.push(c >>> 0); } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const ihdr = (b) => (K.isPng(b) ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null);
  /** a ZIP's entries from its local headers, with the CRC each one declares checked */
  const unzip = (b) => K.zipNames(b).map((e) => {
    const at = b.indexOf(Buffer.from(e.name, 'utf8'));
    const declared = b.readUInt32LE(at - 30 + 14);
    return Object.assign(e, { crcOk: crc32(e.data) === declared });
  });
  const press = (p, scope, re) => p.evaluate((s, src) => { const b = [...document.querySelectorAll(s)].find((x) => new RegExp(src).test(x.textContent)); if (!b) throw new Error('no button ' + src); b.click(); }, scope, re.source);
  const stubClipboard = (p) => p.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); });
  const waitDl = (p, n) => p.waitForFunction((n) => window.__downloads.length >= n, { timeout: 120000 }, n);

  /* ================================================================ */
  const C = '/social/carousel-maker/';
  const carousel = async (fn) => { const p = await K.open(C, { wait: '.social-phone canvas' }); try { return await fn(p); } finally { await p.close(); } };
  const carouselFiles = () => K.once('social-carousel-files', () => carousel(async (p) => {
    await p.evaluate(() => document.fonts.ready);
    await K.clearDownloads(p);
    await press(p, '.aiimg-pane[data-pane=export] button', /ZIP of PNGs/); await waitDl(p, 1);
    await press(p, '.aiimg-pane[data-pane=export] button', /PDF for LinkedIn/); await waitDl(p, 2);
    const d = await K.downloads(p);
    const zip = d.find((x) => /\.zip$/.test(x.name)), pdf = d.find((x) => /\.pdf$/.test(x.name));
    const pj = await K.pdfjs(p, pdf.bytes);
    return { zip, pdf, entries: unzip(zip.bytes), pj };
  }));
  claim(C, 'card', 'Instagram and LinkedIn carousels from text slides and photos: a ZIP of PNGs, or one PDF for LinkedIn.', 'the two exports are a ZIP of PNGs and a PDF', B, async () => {
    const f = await carouselFiles();
    return [f.zip.type === 'application/zip' && f.entries.length === 5 && f.entries.every((e) => K.isPng(e.data)) && f.pdf.bytes.slice(0, 5).toString() === '%PDF-' && f.pj.pages.length === 5,
      f.zip.name + ' (' + f.entries.length + ' PNGs), ' + f.pdf.name + ' (' + f.pj.pages.length + ' pages)'];
  });
  claim(C, 'how', 'Export a ZIP of PNGs named carousel-01.png, carousel-02.png and so on for Instagram, or one PDF with a page per slide for LinkedIn.', 'names in order; a page per slide', B, async () => {
    const f = await carouselFiles();
    const names = f.entries.map((e) => e.name).join(',');
    return [names === 'carousel-01.png,carousel-02.png,carousel-03.png,carousel-04.png,carousel-05.png' && f.pj.pages.length === f.entries.length, names + '; ' + f.pj.pages.length + ' pages'];
  });
  claim(C, 'faq', '1080 × 1350 pixels (4:5 portrait) or 1080 × 1080 (square).', 'the ZIP PNGs are 1080 × 1350, and 1080 × 1080 after choosing square', B, async () => {
    const f = await carouselFiles();
    const tall = f.entries.map((e) => ihdr(e.data).join('x'));
    const sq = await carousel(async (p) => {
      await p.select('#car-size', 'square'); await K.clearDownloads(p);
      await press(p, '.aiimg-pane[data-pane=export] button', /ZIP of PNGs/); await waitDl(p, 1);
      return unzip((await K.downloads(p))[0].bytes).map((e) => ihdr(e.data).join('x'));
    });
    return [tall.every((s) => s === '1080x1350') && sq.every((s) => s === '1080x1080'), tall[0] + ' / ' + sq[0]];
  });
  claim(C, 'point', 'the ZIP is written in the page without compression, with a CRC-32 for each file.', 'every entry stored (method 0) with a CRC that matches its bytes', B, async () => {
    const f = await carouselFiles();
    return [f.entries.every((e) => e.method === 0 && e.crcOk), f.entries.map((e) => e.name + ' m' + e.method + (e.crcOk ? ' crc ok' : ' crc BAD')).join(', ')];
  });
  claim(C, 'point', 'For the PDF each slide becomes a JPEG at quality 0.92, placed whole on its own page at 0.75 points per pixel.', 'each page holds one DCTDecode image of the slide size on a page of 0.75 × its pixels', B, async () => {
    const f = await carouselFiles();
    const s = f.pdf.bytes.toString('latin1');
    const imgs = [...s.matchAll(/\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode/g)].map((m) => m[1] + 'x' + m[2]);
    const q = /canvasBlob\(frame\(k\), 'image\/jpeg', 0\.92\)/.test(fs.readFileSync(path.join(K.ROOT, 'engine/social-carousel-maker.js'), 'utf8'));
    return [imgs.length === 5 && imgs.every((x) => x === '1080x1350') && f.pj.pages.every((pg) => Math.abs(pg.w - 810) < 0.01 && Math.abs(pg.h - 1012.5) < 0.01) && q, imgs.join(', ') + '; pages ' + f.pj.pages[0].w + ' × ' + f.pj.pages[0].h + '; quality 0.92 in the engine: ' + q];
  });
  claim(C, 'worked', 'five pages of 810 × 1012.5 points.', 'pdf.js reads five pages of 810 × 1012.5', B, async () => {
    const f = await carouselFiles();
    return [f.pj.pages.length === 5 && f.pj.pages.every((pg) => pg.w === 810 && pg.h === 1012.5), f.pj.pages.map((pg) => pg.w + '×' + pg.h).join(', ')];
  });
  claim(C, 'faq', 'If it still does not fit at the smallest size, the end is cut with “…” and the page names the slide, so nothing is ever drawn off the edge.', 'Before and after, 1,200 characters (the box’s maximum) on slide 2: named, and every box inside the frame', B, async () => carousel(async (p) => {
    await p.select('#car-template', 'before-after');
    await p.evaluate(() => { const i = document.getElementById('car-body-2'); i.value = 'Unbelievably '.repeat(92).slice(0, i.maxLength); i.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForFunction(() => /slide 2/.test(document.querySelector('.social-warn').textContent), { timeout: 5000 }).catch(() => {});
    const warn = await p.$eval('.social-warn', (e) => e.textContent);
    const r = await p.evaluate(() => { const C = document.querySelector('.tool').__carousel; const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const r = C.renderSlide(c.getContext('2d'), 1080, 1350, 1); return { t: r.truncated, out: r.boxes.filter((b) => b.x < 0 || b.y < 0 || b.x + b.w > 1080.5 || b.y + b.h > 1350.5).length }; });
    return [/slide 2/.test(warn) && /“…”/.test(warn) && r.t && r.out === 0, warn.slice(0, 100) + '; truncated ' + r.t + ', boxes outside ' + r.out];
  }));
  claim(C, 'how', 'A file that is not an image is named and skipped.', 'two PNGs and a .txt: the PNGs placed, the .txt named', B, async () => carousel(async (p) => {
    const png = await K.img.makePng(p, 300, 200, 'x.fillStyle="#c33";x.fillRect(0,0,w,h)');
    const a = K.write('social-a.png', png), b = K.write('social-b.png', png), t = K.write('social-notes.txt', Buffer.from('hello'));
    await (await p.$('.aiimg-pane[data-pane=slides] > input[type=file]')).uploadFile(a, t, b);
    await p.waitForFunction(() => /added/.test(document.querySelector('.social-carousel > .io-msg').textContent), { timeout: 20000 });
    const m = await p.$eval('.social-carousel > .io-msg', (e) => e.textContent);
    const names = await p.$$eval('.social-photo-name', (l) => l.map((e) => e.textContent).join(','));
    return [/2 photos added/.test(m) && /social-notes\.txt is not an image/.test(m) && names === 'social-a.png,social-b.png', m + ' | ' + names];
  }));
  claim(C, 'how', 'add, move or delete slides, up to 20.', 'the 21st slide is refused', B, async () => carousel(async (p) => {
    for (let i = 0; i < 16; i++) await press(p, '.aiimg-pane[data-pane=slides] .btn-ghost', /Add a slide/);
    const n = await p.$$eval('.social-slide', (l) => l.length);
    await press(p, '.aiimg-pane[data-pane=slides] .btn-ghost', /Add a slide/);
    const n2 = await p.$$eval('.social-slide', (l) => l.length);
    const m = await p.$eval('.social-carousel > .io-msg', (e) => e.textContent);
    return [n === 20 && n2 === 20 && /up to 20/.test(m), n + ' → ' + n2 + ': ' + m];
  }));
  claim(C, 'how', 'a progress indicator: dots, a bar, the slide number or none.', 'the four indicator choices', B, async () => carousel(async (p) => {
    const o = await p.$$eval('#car-progress option', (l) => l.map((x) => x.value).join(','));
    return [o === 'dots,bar,number,none', o];
  }));
  claim(C, 'privacy', 'your slides are not kept when you close the page.', 'after typing a slide, nothing in storage holds its words', B, async () => carousel(async (p) => {
    await p.evaluate(() => { const i = document.getElementById('car-title-1'); i.value = 'SECRET-SLIDE-WORDS'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await K.sleep(400);
    const all = await p.evaluate(() => JSON.stringify(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    return [all.indexOf('SECRET-SLIDE-WORDS') < 0, all.slice(0, 200)];
  }));
  claim(C, 'faq', 'Nothing is added to your slides except what you put there.', 'the drawing code has no credit or site mark', N, async () => {
    const src = fs.readFileSync(path.join(K.ROOT, 'engine/social-carousel-maker.js'), 'utf8');
    return [!/drawCredit|1234tools\.com/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'no drawCredit or 1234tools.com in engine/social-carousel-maker.js'];
  });
  manual(C, 'faq', 'LinkedIn shows each page as a slide that people swipe through.', 'How LinkedIn shows a document post is LinkedIn’s behaviour, not the tool’s; checked by hand on linkedin.com.');

  /* ================================================================ */
  const P = '/social/social-post-maker/';
  const SIZES = { 'ig-square': '1080x1080', 'ig-portrait': '1080x1350', story: '1080x1920', x: '1920x1080', linkedin: '1200x628', facebook: '1200x630', pinterest: '1000x1500', youtube: '1080x1080' };
  const post = async (fn) => { const p = await K.open(P, { wait: '.social-post-canvas' }); try { return await fn(p); } finally { await p.close(); } };
  const postZip = () => K.once('social-post-zip', () => post(async (p) => {
    await p.evaluate(() => document.fonts.ready);
    await p.click('#pm-tab-export'); await K.clearDownloads(p);
    await press(p, '.aiimg-pane[data-pane=export] button', /ticked sizes/); await waitDl(p, 1);
    const d = (await K.downloads(p))[0];
    return { d, entries: unzip(d.bytes) };
  }));
  claim(P, 'card', 'Quote and announcement posts in your brand colours, logo and fonts, exported in every platform size.', 'one export gives a PNG for each of the eight sizes', B, async () => {
    const z = await postZip();
    return [z.entries.length === 8 && z.entries.every((e) => K.isPng(e.data)), z.d.name + ': ' + z.entries.map((e) => e.name).join(', ')];
  });
  claim(P, 'faq', 'Instagram post 1080 × 1080, Instagram portrait 1080 × 1350, story or reel cover 1080 × 1920, X 1920 × 1080, LinkedIn 1200 × 628, Facebook 1200 × 630, Pinterest 1000 × 1500 and a YouTube post 1080 × 1080.', 'each PNG’s IHDR is the size quoted', B, async () => {
    const z = await postZip();
    const got = z.entries.map((e) => { const m = /^post-([a-z-]+)-/.exec(e.name); return [m && m[1], ihdr(e.data).join('x')]; });
    return [got.length === 8 && got.every(([id, s]) => SIZES[id] === s), got.map((g) => g.join(' ')).join(', ')];
  });
  claim(P, 'faq', 'PNG, at exactly the pixel size listed, so text and edges stay sharp.', 'every file is a PNG whose name and IHDR agree', B, async () => {
    const z = await postZip();
    return [z.entries.every((e) => { const m = /-(\d+)x(\d+)\.png$/.exec(e.name); return m && ihdr(e.data).join('x') === m[1] + 'x' + m[2]; }), z.entries.map((e) => e.name).join(', ')];
  });
  claim(P, 'how', 'Quote, Announcement, Offer, Event, Big number, Tip, Question, We’re hiring or New.', 'the nine templates offered', B, async () => post(async (p) => {
    const o = await p.$$eval('#pm-template option', (l) => l.map((x) => x.textContent).join(', '));
    return [o === 'Quote, Announcement, Offer, Event, Big number, Tip, Question, We’re hiring, New', o];
  }));
  claim(P, 'point', 'On the 1080 × 1920 size the top and bottom 250 pixels stay empty, where the app draws its own buttons.', 'the story PNG’s top and bottom 250 rows are all background, with a logo and a handle on', B, async () => post(async (p) => {
    const logo = await K.img.makePng(p, 400, 160, 'x.fillStyle="#e33";x.fillRect(0,0,w,h)');
    await p.click('#pm-tab-brand');
    await (await p.$('#pm-logo')).uploadFile(K.write('social-logo.png', logo));
    await p.waitForFunction(() => /Logo added/.test(document.querySelector('.social-post > .io-msg').textContent), { timeout: 20000 });
    await p.evaluate(() => { const h = document.getElementById('pm-handle'); h.value = '@claims'; h.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#pm-tab-export'); await K.clearDownloads(p);
    await press(p, '.aiimg-pane[data-pane=export] button', /each one separately/);
    await p.waitForFunction(() => /ready below/.test(document.querySelector('.social-job-status').textContent), { timeout: 60000 });
    await p.evaluate(() => [...document.querySelectorAll('.aiimg-pane[data-pane=export] .aiimg-result')].find((r) => /story/.test(r.textContent)).querySelector('.btn-download').click());
    await waitDl(p, 1);
    const png = (await K.downloads(p))[0].bytes;
    const r = await p.evaluate(async (arr) => {
      const bm = await createImageBitmap(new Blob([new Uint8Array(arr)], { type: 'image/png' }));
      const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
      const x = c.getContext('2d'); x.drawImage(bm, 0, 0);
      const d = x.getImageData(0, 0, bm.width, bm.height).data;
      const bg = [d[0], d[1], d[2]];
      let off = 0, inside = 0;
      for (let y = 0; y < bm.height; y++) {
        if (y >= 250 && y < bm.height - 250) continue;
        for (let k = 0; k < bm.width; k++) { const o = (y * bm.width + k) * 4; if (Math.abs(d[o] - bg[0]) + Math.abs(d[o + 1] - bg[1]) + Math.abs(d[o + 2] - bg[2]) > 6) off++; }
      }
      for (let y = 250; y < bm.height - 250; y++) for (let k = 0; k < bm.width; k += 3) { const o = (y * bm.width + k) * 4; if (Math.abs(d[o] - bg[0]) + Math.abs(d[o + 1] - bg[1]) + Math.abs(d[o + 2] - bg[2]) > 6) inside++; }
      return { w: bm.width, h: bm.height, off, inside };
    }, Array.from(png));
    return [r.w === 1080 && r.h === 1920 && r.off === 0 && r.inside > 0, r.w + '×' + r.h + ': ' + r.off + ' non-background pixels in the bands, ' + r.inside + ' drawn between them'];
  }));
  claim(P, 'faq', 'If it still will not fit at the smallest size, it is cut with “…” and the page names that size.', 'an absurd quote is cut and the warning names the sizes', B, async () => post(async (p) => {
    await p.evaluate(() => { const t = document.getElementById('pm-text'); t.value = 'Incomprehensibilities '.repeat(120); t.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.waitForFunction(() => /Too much text/.test(document.querySelector('.social-warn').textContent), { timeout: 5000 }).catch(() => {});
    const w = await p.$eval('.social-warn', (e) => e.textContent);
    return [/“…”/.test(w) && /Instagram post/.test(w) && /Pinterest pin/.test(w), w.slice(0, 160)];
  }));
  claim(P, 'privacy', 'a logo shrunk to 512 pixels', 'a 1600-pixel logo is kept at 512 on Save', B, async () => post(async (p) => {
    const logo = await K.img.makePng(p, 1600, 400, 'x.fillStyle="#36c";x.fillRect(0,0,w,h)');
    await p.click('#pm-tab-brand');
    await (await p.$('#pm-logo')).uploadFile(K.write('social-big-logo.png', logo));
    await p.waitForFunction(() => /Logo added/.test(document.querySelector('.social-post > .io-msg').textContent), { timeout: 20000 });
    await press(p, '.aiimg-pane[data-pane=brand] button', /Save brand kit/);
    const r = await p.evaluate(async () => { const u = localStorage.getItem('1234tools-social-logo-v1'); const i = new Image(); i.src = u; await i.decode(); return [i.width, i.height]; });
    await press(p, '.aiimg-pane[data-pane=brand] button', /Forget/);
    return [r[0] === 512 && r[1] === 128, r.join(' × ')];
  }));
  claim(P, 'tip', 'Save your brand kit once: the Carousel Maker on this site reads the same kit.', 'a kit saved here opens in the Carousel Maker', B, async () => {
    const saved = await post(async (p) => {
      await p.click('#pm-tab-brand');
      await p.evaluate(() => { const h = document.getElementById('pm-handle'); h.value = '@shared-kit'; h.dispatchEvent(new Event('input', { bubbles: true })); });
      await press(p, '.aiimg-pane[data-pane=brand] button', /Save brand kit/);
      return p.evaluate(() => localStorage.getItem('1234tools-social-brand-v1'));
    });
    const h = await carousel(async (p) => { const v = await p.$eval('#car-handle', (i) => i.value); await press(p, '.aiimg-pane[data-pane=brand] button', /Forget/); return v; });
    return [!!saved && h === '@shared-kit', 'carousel handle: ' + h];
  });
  claim(P, 'faq', 'Untick the ones you do not need in Export; the ticks are remembered in this browser.', 'unticked sizes are left out and still unticked on the next visit', B, async () => {
    const r = await post(async (p) => {
      await p.click('#pm-tab-export');
      await p.click('#pm-size-pinterest');
      await K.clearDownloads(p);
      await press(p, '.aiimg-pane[data-pane=export] button', /ticked sizes/); await waitDl(p, 1);
      return unzip((await K.downloads(p))[0].bytes).map((e) => e.name);
    });
    const again = await post(async (p) => { const v = await p.$eval('#pm-size-pinterest', (i) => i.checked); await p.evaluate(() => localStorage.removeItem('1234tools-social-post-maker-v1')); return v; });
    return [r.length === 7 && !r.some((n) => /pinterest/.test(n)) && again === false, r.length + ' files, Pinterest ticked on return: ' + again];
  });
  manual(P, 'faq', 'Each comes from the platform’s own guidance; the list with sources is further down this page.', 'The sources are the platforms’ pages, cited in build/content/social.js and checked by hand on 6 October 2026.');

  /* ================================================================ */
  const T = '/social/caption-counter/';
  claim(T, 'card', 'Check a caption against Instagram, X, LinkedIn, TikTok, YouTube, Facebook and Threads limits.', 'a row for each of the seven platforms', N, async () => {
    const ids = (await CC()).rows('x').map((r) => r.id).join(',');
    return [ids === 'instagram,x,linkedin,tiktok,youtube-title,youtube-desc,facebook,threads', ids];
  });
  claim(T, 'faq', 'an emoji counts 2 however many code points it is built from', 'a ZWJ family (7 code points) and a flag weigh 2 each on X', N, async () => {
    const c = await CC(); const a = c.xWeight('👨\u200d👩\u200d👧\u200d👦').weight, b = c.xWeight('🇬🇧').weight, s = c.xWeight('👍🏽').weight;
    return [a === 2 && b === 2 && s === 2, a + ', ' + b + ', ' + s];
  });
  claim(T, 'faq', 'every link counts 23, because X shortens it.', 'a 44-character link and a 13-character bare domain both weigh 23', N, async () => {
    const c = await CC(); const a = c.xWeight('https://www.example.com/a/very/long/path?x=1').weight, b = c.xWeight('1234tools.com').weight;
    return [a === 23 && b === 23, a + ', ' + b];
  });
  claim(T, 'faq', 'so é typed as e plus an accent counts 1', 'e + U+0301 weighs 1', N, async () => {
    const w = (await CC()).xWeight('e\u0301').weight; return [w === 1, String(w)];
  });
  claim(T, 'tip', 'most are 2 UTF-16 units, a flag is 4 and a family emoji can be 11.', 'UTF-16 lengths 2, 4 and 11', N, async () => {
    const c = await CC(); const a = c.count('😀').utf16, b = c.count('🇬🇧').utf16, f = c.count('👨\u200d👩\u200d👧\u200d👦').utf16;
    return [a === 2 && b === 4 && f === 11, a + ', ' + b + ', ' + f];
  });
  claim(T, 'faq', 'an emoji counts as the number of its UTF-8 bytes, usually 4, against the 500-character limit.', '125 emoji make 500, 126 are over; a letter counts 1', N, async () => {
    const c = await CC(); const r = (s) => c.rows(s).find((x) => x.id === 'threads');
    return [r('😀'.repeat(125)).used === 500 && r('😀'.repeat(126)).state === 'over' && r('abc').used === 3 && r('abc').limit === 500, r('😀'.repeat(125)).used + ' / ' + r('😀'.repeat(126)).used];
  });
  claim(T, 'how', 'A row turns amber at 90% and red over the limit.', '1,980 of 2,200 is ok, 1,981 near, 2,201 over', N, async () => {
    const c = await CC(); const s = (n) => c.rows('a'.repeat(n)).find((x) => x.id === 'instagram').state;
    return [s(1980) === 'ok' && s(1981) === 'near' && s(2200) === 'near' && s(2201) === 'over', [s(1980), s(1981), s(2200), s(2201)].join(', ')];
  });
  claim(T, 'how', 'Instagram allows 20 @ tags, Threads 5 links, and Instagram is cutting hashtags to 5.', '21 @ tags over, 6 links over on Threads, 6 hashtags warned', N, async () => {
    const c = await CC(); const row = (t, id) => c.rows(t).find((x) => x.id === id);
    const m21 = row(Array.from({ length: 21 }, (_, i) => '@user' + i).join(' '), 'instagram').state;
    const m20 = row(Array.from({ length: 20 }, (_, i) => '@user' + i).join(' '), 'instagram').state;
    const l6 = row('a.com b.com c.com d.com e.com f.com', 'threads').state;
    const h6 = row('#aa #bb #cc #dd #ee #ff', 'instagram');
    return [m21 === 'over' && m20 !== 'over' && l6 === 'over' && h6.state === 'near' && /5/.test(h6.notes.join(' ')), [m21, m20, l6, h6.state].join(', ')];
  });
  claim(T, 'faq', 'The counter warns above 5 and flags anything above 30 as over.', '5 tags fine, 6 warned, 31 over', N, async () => {
    const c = await CC(); const tags = (n) => Array.from({ length: n }, (_, i) => '#tag' + String.fromCharCode(97 + (i % 26)) + Math.floor(i / 26)).join(' ');
    const s = (n) => c.rows(tags(n)).find((x) => x.id === 'instagram').state;
    return [s(5) === 'ok' && s(6) === 'near' && s(30) === 'near' && s(31) === 'over', [s(5), s(6), s(30), s(31)].join(', ')];
  });
  claim(T, 'faq', 'puts an invisible character (U+2800, Braille Pattern Blank) on each empty line and trims spaces from line ends.', 'the fix on a caption with gaps and trailing spaces', N, async () => {
    const f = (await CC()).fixInstagram('One  \n\nTwo \n\n\nThree');
    return [f === 'One\n\u2800\nTwo\n\u2800\n\u2800\nThree', JSON.stringify(f)];
  });
  claim(T, 'use', 'Catches a title over 100 characters and the < and > YouTube refuses.', '101 characters and a < both flag the title', N, async () => {
    const c = await CC(); const s = (t) => c.rows(t).find((x) => x.id === 'youtube-title').state;
    return [s('x'.repeat(100)) !== 'over' && s('x'.repeat(101)) === 'over' && s('a <b>') === 'over', [s('x'.repeat(100)), s('x'.repeat(101)), s('a <b>')].join(', ')];
  });
  claim(T, 'faq', 'about 125 characters or two lines on Instagram and Facebook, 150 or three lines on LinkedIn, 100 or one line on TikTok.', 'the preview cut points', N, async () => {
    const c = await CC(); const L = 'y'.repeat(400); const lines = 'a\nb\nc\nd';
    const got = ['instagram', 'facebook', 'linkedin', 'tiktok'].map((id) => [c.preview(L, id).shown.length, c.preview(lines, id).shown.split('\n').length]);
    return [JSON.stringify(got) === JSON.stringify([[125, 2], [125, 2], [150, 3], [100, 1]]), JSON.stringify(got)];
  });
  claim(T, 'dfaq', 'Yes: one character everywhere here, and a weight of 1 on X.', 'a newline adds 1 to every count', N, async () => {
    const c = await CC(); const a = c.count('ab'), b = c.count('a\nb');
    return [b.characters - a.characters === 1 && b.utf16 - a.utf16 === 1 && b.bytes - a.bytes === 1 && b.x - a.x === 1 && b.threads - a.threads === 1, JSON.stringify([b.characters, b.x])];
  });
  claim(T, 'worked', 'X weighs it at 223, as its 27-character link counts 23, and Threads at 233, as each emoji costs its bytes.', 'the example caption on the page: X 223, Threads 233', B, async () => {
    const p = await K.open(T, { wait: '#cc-text' });
    try {
      await press(p, '.social-cc-actions button', /Try an example/); await K.sleep(300);
      const r = await p.$$eval('.social-cc-row', (l) => Object.fromEntries(l.map((x) => [x.dataset.platform, x.querySelector('.social-cc-num').textContent])));
      const ex = await p.$eval('#cc-text', (a) => a.value);
      return [r.x === '223 / 280' && r.threads === '233 / 500' && /smallbatch\.example\.com\/menu/.test(ex) && 'smallbatch.example.com/menu'.length === 27, r.x + ', ' + r.threads];
    } finally { await p.close(); }
  });
  claim(T, 'worked', 'is 225 characters but 227 UTF-16 units and 236 bytes.', 'the example caption’s three counts', B, async () => {
    const p = await K.open(T, { wait: '#cc-text' });
    try {
      await press(p, '.social-cc-actions button', /Try an example/); await K.sleep(300);
      const ex = await p.$eval('#cc-text', (a) => a.value);
      const seg = [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(ex)].length;
      return [seg === 225 && ex.length === 227 && Buffer.byteLength(ex) === 236, seg + ', ' + ex.length + ', ' + Buffer.byteLength(ex)];
    } finally { await p.close(); }
  });
  claim(T, 'worked', 'A post with three emoji and a long tracking link, 120 units in all, weighs 83 on X.', 'the run’s post: 120 UTF-16 units, X 83', N, async () => {
    const s = 'Ready for the weekend? 🎉🎉 Our new menu is live 👉 https://smallbatch.example.com/menu-autumn-2026?utm_source=x #coffee';
    const c = (await CC()).count(s);
    return [s.length === 120 && c.x === 83 && c.emoji === 3, s.length + ' units, X ' + c.x + ', ' + c.emoji + ' emoji'];
  });
  claim(T, 'privacy', 'The caption is not stored anywhere unless you tick “Keep this text as a draft on this device”', 'typing stores nothing; the tick stores it; unticking removes it', B, async () => {
    const p = await K.open(T, { wait: '#cc-text' });
    try {
      await p.evaluate(() => { const a = document.getElementById('cc-text'); a.value = 'CLAIMS-DRAFT'; a.dispatchEvent(new Event('input', { bubbles: true })); });
      await K.sleep(300);
      const before = await p.evaluate(() => JSON.stringify(Object.keys(localStorage).map((k) => localStorage.getItem(k))));
      await p.click('#cc-keep'); await K.sleep(150);
      const kept = await p.evaluate(() => localStorage.getItem('1234tools-social-caption-draft-v1'));
      await p.click('#cc-keep'); await K.sleep(150);
      const after = await p.evaluate(() => localStorage.getItem('1234tools-social-caption-draft-v1'));
      return [before.indexOf('CLAIMS-DRAFT') < 0 && /CLAIMS-DRAFT/.test(kept || '') && after === null, 'before: ' + (before.indexOf('CLAIMS-DRAFT') < 0 ? 'not stored' : 'STORED') + ', ticked: ' + !!kept + ', unticked: ' + after];
    } finally { await p.close(); }
  });
  claim(T, 'how', 'Posting on Instagram with blank lines between paragraphs? Press “Copy with the line-break fix” and paste that instead.', 'the button copies the fixed text', B, async () => {
    const p = await K.open(T, { wait: '#cc-text' });
    try {
      await stubClipboard(p);
      await p.evaluate(() => { const a = document.getElementById('cc-text'); a.value = 'First\n\nSecond'; a.dispatchEvent(new Event('input', { bubbles: true })); });
      await K.sleep(300);
      await press(p, '.social-cc button', /line-break fix/); await K.sleep(200);
      const c = await p.evaluate(() => window.__copied[0]);
      return [c === 'First\n\u2800\nSecond', JSON.stringify(c)];
    } finally { await p.close(); }
  });
  manual(T, 'faq', 'In December 2025 Instagram said it would gradually limit captions to five hashtags.', 'An announcement by Instagram’s @creators account on Threads, 18 December 2025; checked by hand.');
  manual(T, 'dfaq', 'TikTok’s developer documentation gives 2,200 UTF-16 units for captions posted through its API', 'developers.tiktok.com/doc/content-posting-api-reference-direct-post, read on 6 October 2026.');

  /* ================================================================ */
  const E = '/social/engagement-rate-calculator/';
  const A = { likes: 412, comments: 38, shares: 17, saves: 55, followers: 12400, reach: 9850, impressions: 14200, posts: 1 };
  claim(E, 'card', 'Engagement rate by followers, by reach and per post, side by side, from likes, comments, shares and saves.', 'the page shows the three side by side for the same inputs', B, async () => {
    const p = await K.open(E + '?' + Object.entries(A).map((x) => x.join('=')).join('&'), { wait: '.social-er-card' });
    try {
      const c = await p.$$eval('.social-er-card', (l) => l.map((x) => x.dataset.formula + ' ' + x.querySelector('.social-er-value').textContent));
      return [c.includes('followers 4.21%') && c.includes('reach 5.30%') && c.includes('per-post 522'), c.join(', ')];
    } finally { await p.close(); }
  });
  claim(E, 'worked', 'Against 12,400 followers that is 4.21%; against a reach of 9,850 it is 5.30%; against 14,200 impressions 3.68%.', 'computed', N, async () => {
    const e = await ER(); const r = e.compute(A); const v = (id) => e.fmtRate(r.results.find((x) => x.id === id).value, 2);
    return [v('followers') === '4.21%' && v('reach') === '5.30%' && v('impressions') === '3.68%' && v('likes-comments') === '3.63%' && r.engagements === 522, [v('followers'), v('reach'), v('impressions'), v('likes-comments')].join(', ')];
  });
  claim(E, 'faq', 'The rate by followers then divides by the number of posts as well, so it is the average rate per post.', 'ten identical posts give the rate of one', N, async () => {
    const e = await ER();
    const one = e.compute(A).results[0].value;
    const ten = e.compute({ likes: 4120, comments: 380, shares: 170, saves: 550, followers: 12400, reach: 98500, posts: 10 });
    return [Math.abs(ten.results[0].value - one) < 1e-9 && Math.abs(ten.results[1].value - e.compute(A).results[1].value) < 1e-9, one + ' / ' + ten.results[0].value];
  });
  claim(E, 'faq', 'The calculator accepts it and says so', 'reach above followers: rates given, with a note', N, async () => {
    const r = (await ER()).compute({ likes: 900, followers: 2000, reach: 15000 });
    return [r.ok && r.results[1].value === 6 && r.notes.some((n) => /Reach is higher than followers/.test(n)), r.notes[0] || 'no note'];
  });
  claim(E, 'point', 'commas and spaces are ignored, so 12,400 is read as 12400.', '"12,400" and "12 400" read as 12400', N, async () => {
    const e = await ER(); return [e.parse('12,400') === 12400 && e.parse('12 400') === 12400, e.parse('12,400') + ', ' + e.parse('12 400')];
  });
  claim(E, 'point', 'A rate is shown only when its base is above 0, and each card prints the sum behind it.', 'followers 0 gives no rate; each rate has its sum', N, async () => {
    const e = await ER(); const r = e.compute(Object.assign({}, A, { followers: 0 })); const r2 = e.compute(A);
    return [r.results[0].value === null && r2.results.every((x) => x.worked), r.results[0].why + ' | ' + r2.results[0].worked];
  });
  claim(E, 'faq', 'This page does not say.', 'no sentence on the page pairs a percentage with good, typical or average', N, async () => {
    const h = fs.readFileSync(path.join(K.ROOT, E.slice(1), 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ');
    const bad = h.split(/(?<=[.!?])\s+/).filter((s) => /\b(good|typical|average|benchmark|healthy)\b/i.test(s) && /\d+(\.\d+)?\s?%/.test(s) && !/412 likes|12,400|4\.21|5\.30|3\.68|3\.63/.test(s));
    return [!bad.length, bad.length ? bad[0].slice(0, 120) : 'none'];
  });
  claim(E, 'privacy', 'only the number of decimal places you choose is remembered in this browser.', 'after typing figures and changing decimals, storage holds only the decimals', B, async () => {
    const p = await K.open(E + '?' + Object.entries(A).map((x) => x.join('=')).join('&'), { wait: '.social-er-card' });
    try {
      await p.select('#er-decimals', '1'); await K.sleep(150);
      const s = await p.evaluate(() => { const all = Object.keys(localStorage).filter((k) => !/logo/.test(k)).map((k) => [k, localStorage.getItem(k)]); const figures = all.filter((x) => /12400|12,400|9850|14200|\b412\b/.test(x[1])).map((x) => x[0]); return JSON.stringify({ mine: Object.fromEntries(all.filter((x) => /engagement/.test(x[0]))), figures }); });
      await p.evaluate(() => localStorage.removeItem('1234tools-social-engagement-rate-v1'));
      return [s === JSON.stringify({ mine: { '1234tools-social-engagement-rate-v1': '{"decimals":1}' }, figures: [] }), s];
    } finally { await p.close(); }
  });
  claim(E, 'how', 'Press Copy results to paste every rate, with its working, into a report or a message.', 'the copied text has every rate and its sum', B, async () => {
    const p = await K.open(E + '?' + Object.entries(A).map((x) => x.join('=')).join('&'), { wait: '.social-er-card' });
    try {
      await stubClipboard(p);
      await press(p, '.social-er button', /Copy results/); await K.sleep(200);
      const c = await p.evaluate(() => window.__copied[0] || '');
      return [/by followers: 4\.21%  \(522 ÷ 12,400 × 100\)/.test(c) && /by reach: 5\.30%/.test(c) && /by impressions: 3\.68%/.test(c) && /Likes and comments by followers: 3\.63%/.test(c) && /per post: 522/.test(c), c.split('\n').join(' | ')];
    } finally { await p.close(); }
  });
};
