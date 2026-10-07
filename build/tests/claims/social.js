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

function drop1({ claim, manual, kit: K }) {
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
}

/**
 * Claims on three Social Media Tools' pages — Video to GIF, Reels Resizer,
 * Link in Bio (drop 2). Everything
 * here runs the real page in Chrome; the outputs are read back with
 * readers written in this file (GIF blocks from the GIF89a specification,
 * MP4 boxes from ISO/IEC 14496-12), by the browser's own ImageDecoder and
 * <video>, never with the engines' code. The test videos are made in the
 * page with WebCodecs and the site's muxer and carry what the checks read:
 * the frame number in binary (GIF), or a green border round a magenta
 * picture with a 440 Hz tone (MP4).
 */
function drop2({ claim, manual, kit: K }) {
  const B = 'browser';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const setVal = (p, sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); if (!e) throw new Error('no ' + sel); if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
  const press = (p, re) => p.evaluate((src) => { const b = [...document.querySelectorAll('.tool-io button')].find((x) => new RegExp(src).test(x.textContent)); if (!b) throw new Error('no button ' + src); b.click(); }, re.source);
  const b64 = (buf) => Buffer.from(buf).toString('base64');
  /* a clean start: past the site's service worker (so every request is seen), with this tool's stored settings cleared and the page reloaded */
  const fresh = async (p, key, wait) => {
    await p.setBypassServiceWorker(true);
    await p.evaluate((k) => { try { localStorage.removeItem(k); } catch (e) { /* */ } }, key);
    await p.reload({ waitUntil: 'load' });
    await p.evaluate(() => { const b = document.querySelector('.cc'); if (b) b.remove(); });
    await p.waitForSelector(wait, { timeout: 30000 });
  };
  /* every resource the page fetched (the worker's script included), whoever served it */
  const fetched = (p) => p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));

  /* ---------- readers ---------- */
  function parseGif(b) {
    const r = { ok: false, frames: 0, delays: [], loop: null, w: 0, h: 0, globalColours: 0, localTables: 0 };
    if (b.slice(0, 6).toString('latin1') !== 'GIF89a') return r;
    r.w = b.readUInt16LE(6); r.h = b.readUInt16LE(8);
    let i = 13;
    if (b[10] & 0x80) { r.globalColours = 2 << (b[10] & 7); i += 3 * r.globalColours; }
    const skip = () => { while (b[i] !== 0) i += b[i] + 1; i++; };
    for (;;) {
      const t = b[i++];
      if (t === 0x3B) { r.ok = true; break; }
      if (t === 0x21) {
        const label = b[i++];
        if (label === 0xF9) { r.delays.push(b.readUInt16LE(i + 2)); i += b[i] + 1; skip(); }
        else if (label === 0xFF) { const n = b[i]; const id = b.slice(i + 1, i + 1 + n).toString('latin1'); i += n + 1; if (id === 'NETSCAPE2.0' && b[i] === 3) r.loop = b.readUInt16LE(i + 2); skip(); }
        else { i += b[i] + 1; skip(); }
      } else if (t === 0x2C) {
        const fp = b[i + 8]; i += 9;
        if (fp & 0x80) { r.localTables++; i += 3 * (2 << (fp & 7)); }
        i++; skip(); r.frames++;
      } else return r;
    }
    return r;
  }
  function boxes(b, s, e) { const o = []; let i = s; while (i + 8 <= e) { let z = b.readUInt32BE(i); const t = b.slice(i + 4, i + 8).toString('latin1'); let h = 8; if (z === 1) { z = Number(b.readBigUInt64BE(i + 8)); h = 16; } else if (z === 0) z = e - i; if (z < h || i + z > e) break; o.push({ type: t, body: i + h, end: i + z }); i += z; } return o; }
  const kid = (b, x, t) => boxes(b, x.body, x.end).find((y) => y.type === t);
  function parseMp4(b) {
    const top = boxes(b, 0, b.length), moov = top.find((x) => x.type === 'moov');
    const tracks = [];
    if (moov) for (const tr of boxes(b, moov.body, moov.end).filter((x) => x.type === 'trak')) {
      const tk = kid(b, tr, 'tkhd'), at = tk.body + (b[tk.body] === 1 ? 88 : 76);
      const md = kid(b, tr, 'mdia'), mh = kid(b, md, 'mdhd'), v1 = b[mh.body] === 1;
      const ts = b.readUInt32BE(mh.body + (v1 ? 20 : 12)), du = v1 ? Number(b.readBigUInt64BE(mh.body + 24)) : b.readUInt32BE(mh.body + 16);
      const st = kid(b, kid(b, md, 'minf'), 'stbl');
      tracks.push({ w: b.readUInt32BE(at) / 65536, h: b.readUInt32BE(at + 4) / 65536, handler: b.slice(kid(b, md, 'hdlr').body + 8, kid(b, md, 'hdlr').body + 12).toString('latin1'),
        codec: b.slice(kid(b, st, 'stsd').body + 12, kid(b, st, 'stsd').body + 16).toString('latin1'), samples: b.readUInt32BE(kid(b, st, 'stsz').body + 8), duration: du / ts });
    }
    return { ftyp: top.length && top[0].type === 'ftyp', tracks, video: tracks.find((t) => t.handler === 'vide'), sound: tracks.find((t) => t.handler === 'soun') };
  }

  /* ---------- test videos, made once in a page ---------- */
  const fixtures = () => K.once('sv-fixtures', async () => {
    const p = await K.open('/social/video-to-gif/', { wait: '.tool-io .dropzone' });
    try {
      const make = (o) => p.evaluate(async (o) => {
        const c = document.createElement('canvas'); c.width = o.w; c.height = o.h; const x = c.getContext('2d');
        const n = Math.round(o.seconds * o.fps);
        function* frames() {
          for (let i = 0; i < n; i++) {
            if (o.kind === 'bits') {
              const sq = o.w / 8, sh = Math.round(o.h / 4.5);
              x.fillStyle = '#204080'; x.fillRect(0, 0, o.w, o.h);
              x.fillStyle = '#e01010'; x.fillRect(0, sh, Math.round(o.w / 3), o.h - sh);
              for (let k = 0; k < 8; k++) { x.fillStyle = (i >> (7 - k)) & 1 ? '#ffffff' : '#000000'; x.fillRect(k * sq, 0, sq, sh); }
            } else {
              const bw = Math.round(o.w / 40);
              x.fillStyle = '#00e000'; x.fillRect(0, 0, o.w, o.h); x.fillStyle = '#e000e0'; x.fillRect(bw, bw, o.w - 2 * bw, o.h - 2 * bw);
              for (let k = 0; k < 8; k++) { x.fillStyle = (i >> (7 - k)) & 1 ? '#ffffff' : '#000000'; x.fillRect(Math.round(o.w * 0.05) + k * Math.round(o.w * 0.1125), Math.round(o.h * 0.09), Math.round(o.w * 0.1125), Math.round(o.h * 0.13)); }
            }
            yield { canvas: c, timestampUs: Math.round(i * 1e6 / o.fps), durationUs: Math.round(1e6 / o.fps) };
          }
        }
        let audio = null;
        if (o.tone) { const len = Math.round(o.seconds * 48000); const ab = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: 48000 }); for (let ch = 0; ch < 2; ch++) { const d = ab.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = 0.3 * Math.sin(2 * Math.PI * 440 * k / 48000); } audio = { buffer: ab }; }
        const r = await window.AIImg.encodeVideoFrames(frames(), { fps: o.fps, width: o.w, height: o.h, bitrate: o.bitrate || 3e6, audio });
        const u = new Uint8Array(await r.blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
        return btoa(s);
      }, o).then((s) => Buffer.from(s, 'base64'));
      const f = {};
      f.frames = K.write('frames.mp4', await make({ kind: 'bits', w: 640, h: 360, fps: 30, seconds: 6 }));
      f.longGif = K.write('sv-long-gif.mp4', await make({ kind: 'bits', w: 160, h: 90, fps: 2, seconds: 32 }));
      f.landscape = K.write('sv-landscape.mp4', await make({ kind: 'border', w: 640, h: 360, fps: 30, seconds: 3, tone: true, bitrate: 2e6 }));
      f.silent = K.write('sv-silent.mp4', await make({ kind: 'border', w: 640, h: 360, fps: 30, seconds: 2, bitrate: 2e6 }));
      f.tooLong = K.write('sv-185s.mp4', await make({ kind: 'border', w: 64, h: 36, fps: 1, seconds: 185 }));
      return f;
    } finally { await p.close(); }
  });

  /* ================================================================ */
  const V = '/social/video-to-gif/';
  const gifPage = async (fn) => {
    const f = await fixtures();
    const p = await K.open(V, { wait: '.tool-io .dropzone' });
    try {
      await fresh(p, '1234tools-social-video-to-gif-v1', '.tool-io .dropzone');
      await (await p.$('#sv-gif-file')).uploadFile(f.frames);
      await p.waitForFunction(() => !document.querySelector('.sv-studio').hidden, { timeout: 30000 });
      return await fn(p, f);
    } finally { await p.close(); }
  };
  const estimate = async (p) => { await sleep(100); await p.waitForFunction(() => /^Estimated size/.test(document.querySelector('.sv-est').textContent), { timeout: 60000 }); return Number(await p.$eval('.sv-est', (e) => e.dataset.bytes)); };
  const makeGif = async (p) => {
    const n0 = await p.evaluate(() => window.__downloads.length);
    await press(p, /^Make the GIF$/);
    await p.waitForFunction((n) => window.__downloads.length > n, { timeout: 240000 }, n0);
    const d = await K.downloads(p); return d[d.length - 1];
  };
  const decodeGif = (p, bytes) => p.evaluate(async (s) => {
    const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const d = new ImageDecoder({ data: u, type: 'image/gif' }); await d.completed; await d.tracks.ready;
    const t = d.tracks.selectedTrack; const o = { frames: t.frameCount, rep: t.repetitionCount === Infinity ? 'Infinity' : t.repetitionCount }; d.close(); return o;
  }, b64(bytes));
  /* the 1.0–3.0 s, 480 px, 10 fps, "Play 3 times" GIF of the worked example, made once */
  const gif1 = () => K.once('sv-gif1', () => gifPage(async (p) => {
    await setVal(p, '#sv-gif-start', '1'); await setVal(p, '#sv-gif-end', '3');
    await setVal(p, '#sv-gif-width', 480); await setVal(p, '#sv-gif-fps', 10); await setVal(p, '#sv-gif-speed', 1); await setVal(p, '#sv-gif-loop', '3');
    const est = await estimate(p);
    const g = await makeGif(p);
    await setVal(p, '#sv-gif-dither', false); await estimate(p);
    const flat = await makeGif(p);
    await setVal(p, '#sv-gif-dither', true); await setVal(p, '#sv-gif-width', 240); await estimate(p);
    const half = await makeGif(p);
    await setVal(p, '#sv-gif-width', 480); await setVal(p, '#sv-gif-loop', '1'); await setVal(p, '#sv-gif-fps', 15); await estimate(p);
    const once15 = await makeGif(p);
    return { est, g, P: parseGif(g.bytes), D: await decodeGif(p, g.bytes), flat, half, once15, P15: parseGif(once15.bytes), D15: await decodeGif(p, once15.bytes), requests: p.__requests.slice(), fetched: await fetched(p), workers: p.workers().map((w) => w.url()) };
  }));

  claim(V, 'faq', 'Up to 600 frames — 30 seconds at 20 frames per second, or a minute at 10 — and up to 640 pixels wide.', '32 s at 20 fps refused, 30 s allowed; widest option 640', B, async () => {
    const f = await fixtures();
    const p = await K.open(V, { wait: '.tool-io .dropzone' });
    try {
      await (await p.$('#sv-gif-file')).uploadFile(f.longGif);
      await p.waitForFunction(() => !document.querySelector('.sv-studio').hidden, { timeout: 30000 });
      await setVal(p, '#sv-gif-start', '0'); await setVal(p, '#sv-gif-end', '32'); await setVal(p, '#sv-gif-fps', 20); await sleep(300);
      const a = await p.evaluate(() => ({ t: document.querySelector('.sv-est').textContent, d: [...document.querySelectorAll('.tool-io button')].find((b) => /^Make the GIF$/.test(b.textContent)).disabled }));
      await setVal(p, '#sv-gif-end', '30'); await sleep(300);
      const b = await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((x) => /^Make the GIF$/.test(x.textContent)).disabled);
      const widths = await p.$$eval('#sv-gif-width option', (l) => l.map((o) => Number(o.value)));
      return [/^640 frames is over/.test(a.t) && a.d && !b && Math.max(...widths) === 640, a.t.slice(0, 50) + ' | 600 frames allowed: ' + !b + ' | widths ' + widths.join(',')];
    } finally { await p.close(); }
  });
  claim(V, 'faq', 'Play 3 times writes “repeat twice after the first play”, which is how Chrome reads it. Play once writes no repeat block at all.', 'NETSCAPE2.0 loop 2 → Chrome 2 repeats; Play once → no block, 0 repeats', B, async () => {
    const r = await gif1();
    return [r.P.loop === 2 && r.D.rep === 2 && r.P15.loop === null && r.D15.rep === 0, 'Play 3 times: block ' + r.P.loop + ', Chrome ' + r.D.rep + '; Play once: block ' + r.P15.loop + ', Chrome ' + r.D15.rep];
  });
  claim(V, 'faq', 'it takes four frames of your selection, compresses them exactly as the export will, and multiplies up by the number of frames.', 'the estimate is within 25% of the file', B, async () => {
    const r = await gif1(); const e = r.est / r.g.bytes.length - 1;
    return [Math.abs(e) <= 0.25, 'estimate ' + r.est + ', file ' + r.g.bytes.length + ' (' + (e * 100).toFixed(1) + '%)'];
  });
  claim(V, 'faq', 'The tool picks up to 256 that suit your clip from eight frames spread over it and uses that one palette for every frame, so colours do not flicker from frame to frame.', 'one global table of at most 256, no local tables', B, async () => {
    const r = await gif1(); return [r.P.globalColours >= 2 && r.P.globalColours <= 256 && r.P.localTables === 0 && r.P.frames === 20, r.P.globalColours + ' global colours (this flat clip needs few), ' + r.P.localTables + ' local tables over ' + r.P.frames + ' frames'];
  });
  claim(V, 'point', 'Eight frames spread over the selection choose one palette of up to 256 colours for the whole GIF, so colours hold steady from frame to frame.', 'one global palette', B, async () => {
    const r = await gif1(); return [r.P.globalColours >= 2 && r.P.globalColours <= 256 && r.P.localTables === 0, r.P.globalColours + ' global, ' + r.P.localTables + ' local'];
  });
  claim(V, 'worked', 'became frames.gif: 61,026 bytes, 20 frames of 480 × 270, every delay 10 hundredths, and a NETSCAPE2.0 repeat count of 2.', 'name, frames, size, delays, loop (bytes within 5%)', B, async () => {
    const r = await gif1();
    const ok = r.g.name === 'frames.gif' && r.P.frames === 20 && r.P.w === 480 && r.P.h === 270 && r.P.delays.every((d) => d === 10) && r.P.loop === 2 && Math.abs(r.g.bytes.length / 61026 - 1) <= 0.05;
    return [ok, r.g.name + ' ' + r.g.bytes.length + ' bytes, ' + r.P.frames + ' frames ' + r.P.w + '×' + r.P.h + ', delays ' + [...new Set(r.P.delays)].join('/') + ', loop ' + r.P.loop];
  });
  claim(V, 'tip', 'turn it off for flat graphics and screen recordings, which then come out smaller.', 'dither off is smaller on the flat test clip', B, async () => {
    const r = await gif1(); return [r.flat.bytes.length < r.g.bytes.length, r.flat.bytes.length + ' bytes off vs ' + r.g.bytes.length + ' on'];
  });
  claim(V, 'mistake', 'on our test clip turning it off cut the file by about a third.', 'dither off: 25–45% smaller', B, async () => {
    const r = await gif1(); const cut = 1 - r.flat.bytes.length / r.g.bytes.length; return [cut >= 0.25 && cut <= 0.45, (cut * 100).toFixed(0) + '% smaller'];
  });
  claim(V, 'tip', 'Half the width is a quarter of the pixels; on our flat test clip it halved the file.', '240 px is 45–55% of 480 px', B, async () => {
    const r = await gif1(); const k = r.half.bytes.length / r.g.bytes.length; const P = parseGif(r.half.bytes);
    return [P.w === 240 && P.h === 135 && k >= 0.45 && k <= 0.55, P.w + '×' + P.h + ', ' + (k * 100).toFixed(0) + '% of the 480 px file'];
  });
  claim(V, 'dfaq', 'the tool alternates 7 and 6, and 30 frames add up to exactly 2.00 s.', '15 fps delays are 6 and 7, summing to 200', B, async () => {
    const r = await gif1(); const d = r.P15.delays;
    return [d.length === 30 && d.every((x) => x === 6 || x === 7) && d.reduce((a, b) => a + b, 0) === 200, d.length + ' frames, ' + d.slice(0, 6).join(',') + '…, total ' + d.reduce((a, b) => a + b, 0)];
  });
  claim(V, 'dfaq', 'Our 2-second test GIF, 61,026 bytes, was more than twice the 6-second MP4 it came from, 24,708 bytes.', 'GIF > 2 × source MP4 (sizes within 5%)', B, async () => {
    const r = await gif1(); const f = await fixtures(); const mp4 = fs.statSync(f.frames).size;
    return [r.g.bytes.length > 2 * mp4 && Math.abs(mp4 / 24708 - 1) <= 0.05, 'GIF ' + r.g.bytes.length + ', MP4 ' + mp4];
  });
  claim(V, 'how', 'select a handle and use the arrow keys (a tenth of a second a press, a whole second with Shift)', 'arrow keys move the start handle 0.1 s, Shift 1 s', B, async () => gifPage(async (p) => {
    await p.evaluate(() => document.querySelectorAll('.sv-trim-h')[0].focus());
    await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight');
    const a = await p.$eval('#sv-gif-start', (e) => e.value);
    await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
    const b = await p.$eval('#sv-gif-start', (e) => e.value);
    return [a === '0.2' && b === '1.2', 'two presses → ' + a + ' s; Shift → ' + b + ' s'];
  }));
  claim(V, 'how', 'Pick the width (240 to 640 px; the height follows the shape), 5 to 20 frames per second, a speed from 0.5× to 2×, and how many times it plays.', 'the controls offer exactly those ranges', B, async () => gifPage(async (p) => {
    const c = await p.evaluate(() => ({ w: [...document.querySelectorAll('#sv-gif-width option')].map((o) => Number(o.value)), f: [document.getElementById('sv-gif-fps').min, document.getElementById('sv-gif-fps').max], s: [...document.querySelectorAll('#sv-gif-speed option')].map((o) => Number(o.value)), h: document.querySelector('.sv-canvas').height }));
    return [Math.min(...c.w) === 240 && Math.max(...c.w) === 640 && c.f.join() === '5,20' && Math.min(...c.s) === 0.5 && Math.max(...c.s) === 2 && c.h === 270, JSON.stringify(c)];
  }));
  claim(V, 'privacy', 'the video, its name and the caption’s words are not kept.', 'storage holds settings only', B, async () => gifPage(async (p) => {
    await setVal(p, '#sv-gif-caption', 'SECRET WORDS'); await setVal(p, '#sv-gif-width', 320); await sleep(200);
    const s = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    return [/"width\\?":320/.test(s) && !/SECRET|sv-frames/.test(s), s.slice(0, 300)];
  }));
  claim(V, 'card', 'Size shown before you export.', 'an estimate in bytes appears before export', B, async () => gifPage(async (p) => { const n = await estimate(p); const t = await p.$eval('.sv-est', (e) => e.textContent); return [n > 0 && /^Estimated size: about/.test(t), t.slice(0, 90)]; }));
  claim(V, 'faq', 'The page reads the file from your device, seeks through it with the browser’s own decoder and builds the GIF in a worker in this tab. Nothing is sent anywhere', 'no request leaves the site; the work is in a worker', B, async () => {
    const r = await gif1();
    const bad = r.requests.filter((q) => !q.url.startsWith(K.BASE) || q.method !== 'GET').map((q) => q.method + ' ' + q.url).concat(r.fetched.filter((u) => !u.startsWith(K.BASE) && !/^(data|blob):/.test(u)));
    const worker = r.workers.some((u) => /\/engine\/social-gif-worker\.js$/.test(u));
    return [!bad.length && worker && r.requests.length > 0, (bad.length ? 'outside or non-GET: ' + bad.join(', ') : r.requests.length + ' requests and ' + r.fetched.length + ' resources, all GETs from the site') + '; worker running: ' + r.workers.join(', ')];
  });
  manual(V, 'faq', 'MP4 (H.264) and WebM everywhere, and MOV when it holds H.264.', 'browser codec support; checked here only for H.264 MP4 in Chrome');
  manual(V, 'faq', 'GIF is a picture format and has no sound track.', 'a fact of the GIF89a format, not of the tool');

  /* ================================================================ */
  const R = '/social/reels-resizer/';
  const reelPage = async (file, fn) => {
    const f = await fixtures();
    const p = await K.open(R, { wait: '.tool-io .dropzone' });
    try {
      await fresh(p, '1234tools-social-reels-resizer-v1', '.tool-io .dropzone');
      await (await p.$('#sv-reel-file')).uploadFile(f[file]);
      await p.waitForFunction(() => { const t = document.querySelector('.sv-reel > .io-msg').textContent; return t && !/^(Reading|Decoding)/.test(t); }, { timeout: 60000 });
      return await fn(p, f);
    } finally { await p.close(); }
  };
  const makeMp4 = async (p) => {
    const n0 = await p.evaluate(() => window.__downloads.length);
    await press(p, /^Make the MP4$/);
    await p.waitForFunction((n) => window.__downloads.length > n || /could not be made/.test(document.querySelector('.sv-status').textContent), { timeout: 240000 }, n0);
    const d = await K.downloads(p);
    if (d.length <= n0) throw new Error(await p.$eval('.sv-reel > .io-msg', (e) => e.textContent));
    return { file: d[d.length - 1], status: await p.$eval('.sv-status', (e) => e.textContent), cfg: await p.evaluate(() => window.AIImg.lastVideoConfig) };
  };
  const pixels = (p, bytes, type, t, pts) => p.evaluate(async (s, type, t, pts) => {
    const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], { type }));
    await new Promise((r) => { v.onloadeddata = r; setTimeout(r, 10000); });
    if (!isFinite(v.duration)) { v.currentTime = 1e7; await new Promise((r) => { v.ondurationchange = r; setTimeout(r, 4000); }); }
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; setTimeout(r, 5000); });
    const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d'); x.drawImage(v, 0, 0);
    return { w: c.width, h: c.height, px: pts.map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data).slice(0, 3)) };
  }, b64(bytes), type, t, pts);
  const green = (q) => q[1] > 160 && q[0] < 90 && q[2] < 90, magenta = (q) => q[0] > 160 && q[2] > 160 && q[1] < 90;
  /* the 1080 × 1920 blurred-copy export and the "Higher" one, made once */
  const reel1 = () => K.once('sv-reel1', () => reelPage('landscape', async (p) => {
    const a = await makeMp4(p);
    const seq = await p.evaluate(async (s) => {
      const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], { type: 'video/mp4' }));
      await new Promise((r) => { v.onloadeddata = r; });
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d', { willReadFrequently: true });
      const out = [];
      for (let k = 0; k < 90; k++) {
        await new Promise((r) => { v.onseeked = r; v.currentTime = (k + 0.5) / 30; });
        x.drawImage(v, 0, 0);
        let n = 0; for (let b = 0; b < 8; b++) { const d = x.getImageData(Math.round((68 + 72 * b) * 1.6875), Math.round(656 + 56 * 1.6875), 1, 1).data; n = n * 2 + (d[0] + d[1] + d[2] > 384 ? 1 : 0); }
        out.push(n);
      }
      return out;
    }, b64(a.file.bytes));
    const px = (await pixels(p, a.file.bytes, 'video/mp4', 1.5, [[13, 960], [540, 960], [540, 668], [540, 1250], [540, 300], [540, 1700], [540, 1400]])).px;
    const dark = await p.$eval('#sv-reel-dark', (e) => e.value);
    await setVal(p, '#sv-reel-pos', 'high');
    const b = await makeMp4(p);
    const pxb = (await pixels(p, b.file.bytes, 'video/mp4', 1.5, [[540, 768], [540, 478], [540, 1060], [540, 1150]])).px;
    return { a, M: parseMp4(a.file.bytes), seq, px, dark, b, pxb };
  }));

  claim(R, 'faq', 'Yes. The sound is decoded from your file and encoded again as AAC, or as Opus where the browser has no AAC encoder, and put in the MP4 beside the picture.', 'a second track, AAC or Opus, as long as the picture', B, async () => {
    const r = await reel1(); const s = r.M.sound;
    return [!!s && /^(mp4a|Opus)$/.test(s.codec) && Math.abs(s.duration - r.M.video.duration) <= 0.15, s ? s.codec + ' ' + s.duration.toFixed(3) + ' s beside ' + r.M.video.duration.toFixed(3) + ' s of picture' : 'no sound track'];
  });
  claim(R, 'faq', 'if a frame goes by before the page could take it, the video goes back to the last frame taken and plays on at half the speed (down to an eighth), so frames are not skipped', 'frame k of the output is frame k of the input, all 90', B, async () => {
    const r = await reel1(); const ok = r.seq.every((n, k) => n === k);
    return [ok && r.M.video.samples === 90, r.M.video.samples + ' samples; ' + (ok ? 'frames 0…89 in order' : r.seq.join(',')) + '; ' + (/fell behind (\d+ times?)/.exec(r.a.status) || ['', 'no slow-down needed'])[1]];
  });
  claim(R, 'worked', 'The picture sat at 1080 × 608 from y 656, its 16-pixel border now 27 pixels wide.', 'green at x 13 and y 668, 1250; magenta at the middle', B, async () => {
    const r = await reel1(); const q = r.px;
    return [r.M.video.w === 1080 && r.M.video.h === 1920 && green(q[0]) && magenta(q[1]) && green(q[2]) && green(q[3]), JSON.stringify(q.slice(0, 4))];
  });
  claim(R, 'worked', 'With “Higher” it moved up to y 464, leaving the bottom 848 pixels clear', 'magenta at y 768, green at y 478 and 1060, the band at y 1150', B, async () => {
    const r = await reel1(); const q = r.pxb;
    return [magenta(q[0]) && green(q[1]) && green(q[2]) && !magenta(q[3]) && !green(q[3]), JSON.stringify(q)];
  });
  claim(R, 'dfaq', 'It is darkened by 45% unless you change it', 'default 45; the band is 0.55 × the blurred magenta', B, async () => {
    /* y 1400 of the band is the blurred copy of the clip's plain magenta (source row 262): 224 × 0.55 ≈ 123 */
    const r = await reel1(); const q = r.px[6];
    return [r.dark === '45' && Math.abs(q[0] - 224 * 0.55) <= 12 && Math.abs(q[2] - 224 * 0.55) <= 12 && q[1] < 30, 'default ' + r.dark + '%, band at y 1400 ' + JSON.stringify(q)];
  });
  claim(R, 'faq', 'at about 8 Mbps for 1080-pixel-wide output (5 Mbps for 720)', 'the encoder is configured at 8 Mbps / 5 Mbps', B, async () => {
    const r = await reel1();
    const c720 = await reelPage('landscape', async (p) => { await setVal(p, '#sv-reel-size', '9x16-720'); return (await makeMp4(p)).cfg; });
    return [r.a.cfg.bitrate === 8e6 && c720.bitrate === 5e6, r.a.cfg.bitrate + ' at ' + r.a.cfg.width + ', ' + c720.bitrate + ' at ' + c720.width];
  });
  claim(R, 'worked', 'at 720 × 1280 it was 720 × 405 from y 438.', 'solid #2050a0 band; picture from y 438', B, async () => reelPage('landscape', async (p) => {
    await setVal(p, '#sv-reel-size', '9x16-720'); await setVal(p, '#sv-reel-mode', 'colour'); await setVal(p, '#sv-reel-bg', '#2050a0');
    const r = await makeMp4(p); const M = parseMp4(r.file.bytes);
    const q = (await pixels(p, r.file.bytes, 'video/mp4', 1.5, [[360, 430], [360, 446], [360, 640], [360, 836], [360, 850]])).px;
    const col = (x) => Math.abs(x[0] - 32) <= 14 && Math.abs(x[1] - 80) <= 14 && Math.abs(x[2] - 160) <= 14;
    return [M.video.w === 720 && M.video.h === 1280 && col(q[0]) && green(q[1]) && magenta(q[2]) && green(q[3]) && col(q[4]), JSON.stringify(q)];
  }));
  claim(R, 'dfaq', 'our 30 fps test clip exported at 60 still had 90 frames over its 3 seconds.', '60 fps setting, 90 samples', B, async () => reelPage('landscape', async (p) => {
    await setVal(p, '#sv-reel-size', '9x16-720'); await setVal(p, '#sv-reel-fps', 60);
    const M = parseMp4((await makeMp4(p)).file.bytes);
    return [M.video.samples >= 88 && M.video.samples <= 90 && Math.abs(M.video.duration - 3) <= 0.15, M.video.samples + ' samples over ' + M.video.duration.toFixed(2) + ' s'];
  }));
  claim(R, 'faq', 'A video with no sound track comes out silent, and the page says so.', 'one track; the status says so', B, async () => reelPage('silent', async (p) => {
    const m = await p.$eval('.sv-reel > .io-msg', (e) => e.textContent);
    await setVal(p, '#sv-reel-size', '9x16-720');
    const r = await makeMp4(p); const M = parseMp4(r.file.bytes);
    return [M.tracks.length === 1 && /no sound track found/.test(m) && /has no sound track/.test(r.status), M.tracks.length + ' track(s); ' + m + ' | ' + r.status.slice(-50)];
  }));
  claim(R, 'faq', 'Three minutes and 500 MB per video, one video at a time.', 'a 3 min 5 s video is refused (the 500 MB cap is not exercised)', B, async () => reelPage('tooLong', async (p) => {
    const m = await p.$eval('.sv-reel > .io-msg', (e) => ({ t: e.textContent, c: e.className }));
    return [/it is 3:05 long; this tool takes up to 3 minutes/.test(m.t) && /is-error/.test(m.c), m.t.slice(0, 100)];
  }));
  claim(R, 'faq', 'so there the video is recorded in real time as it plays, usually as WebM, with the sound played into the same recording.', 'forced MediaRecorder path: WebM with sound, about real time', B, async () => reelPage('landscape', async (p) => {
    await p.evaluate(() => { window.__svForceRecorder = true; });
    await setVal(p, '#sv-reel-size', '9x16-720');
    const t0 = Date.now(); const r = await makeMp4(p); const s = (Date.now() - t0) / 1000;
    const ebml = r.file.bytes.readUInt32BE(0) === 0x1A45DFA3;
    return [r.file.type === 'video/webm' && ebml && /\.webm$/.test(r.file.name) && /recorded in real time with sound/.test(r.status) && s >= 2.8, r.file.name + ', ' + r.file.type + ', ' + s.toFixed(1) + ' s for 3 s of video'];
  }));
  claim(R, 'how', 'the progress bar shows how far it has got, and Cancel stops it.', 'progress rises; Cancel saves nothing', B, async () => reelPage('landscape', async (p) => {
    const n0 = await p.evaluate(() => window.__downloads.length);
    await press(p, /^Make the MP4$/);
    await p.waitForFunction(() => Number(document.querySelector('.sv-reel .aiimg-progress').getAttribute('aria-valuenow')) >= 20, { timeout: 60000 });
    const v = await p.evaluate(() => document.querySelector('.sv-reel .aiimg-progress').getAttribute('aria-valuenow'));
    await press(p, /^Cancel$/);
    await p.waitForFunction(() => /Cancelled/.test(document.querySelector('.sv-status').textContent), { timeout: 30000 });
    await sleep(1000);
    const n1 = await p.evaluate(() => window.__downloads.length);
    return [n1 === n0, 'cancelled at ' + v + '%, downloads ' + n0 + ' → ' + n1];
  }));
  claim(R, 'card', 'Landscape video to a 9:16, 4:5 or 1:1 MP4 over a blurred copy or a colour, with its sound and a title.', 'the three shapes, each with two tracks; a title draws white above the picture', B, async () => reelPage('landscape', async (p) => {
    const out = [];
    for (const [s, w, h] of [['4x5', 1080, 1350], ['1x1', 1080, 1080]]) { await setVal(p, '#sv-reel-size', s); const M = parseMp4((await makeMp4(p)).file.bytes); out.push(M.video.w === w && M.video.h === h && M.tracks.length === 2); }
    const r = await reel1(); out.push(r.M.video.w === 1080 && r.M.video.h === 1920 && r.M.tracks.length === 2);
    await setVal(p, '#sv-reel-size', '9x16-720'); await setVal(p, '#sv-reel-title', 'HELLO WORLD');
    const t = await makeMp4(p);
    const white = await p.evaluate(async (s) => {
      const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(new Blob([u], { type: 'video/mp4' }));
      await new Promise((r) => { v.onloadeddata = r; }); await new Promise((r) => { v.onseeked = r; v.currentTime = 1; });
      const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const x = c.getContext('2d'); x.drawImage(v, 0, 0);
      const d = x.getImageData(0, 80, c.width, 340).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] > 200 && d[k + 1] > 200 && d[k + 2] > 200) n++; return n;
    }, b64(t.file.bytes));
    return [out.every(Boolean) && white > 1000, 'sizes ' + out.join(',') + '; title pixels ' + white];
  }));
  claim(R, 'privacy', 'the video, its name and the title’s words are not kept.', 'storage holds settings only', B, async () => reelPage('landscape', async (p) => {
    await setVal(p, '#sv-reel-title', 'PRIVATE TITLE'); await setVal(p, '#sv-reel-size', '4x5'); await sleep(200);
    const s = await p.evaluate(() => localStorage.getItem('1234tools-social-reels-resizer-v1') || '');
    return [/"size":"4x5"/.test(s) && !/PRIVATE|landscape/.test(s), s];
  }));
  manual(R, 'faq', 'MP4 is encoded on the device with WebCodecs, which Chrome, Edge and Safari 16.4+ provide.', 'browser support; only Chrome is run here (the WebM fallback is checked by forcing it)');
  manual(R, 'faq', 'Keep the tab in front: browsers slow down tabs in the background.', 'browser behaviour, not the tool’s');

  /* ================================================================ */
  const L = '/social/link-in-bio/';
  const libPage = async (fn) => {
    const p = await K.open(L, { wait: '.sv-lib-frame' });
    try { await fresh(p, '1234tools-social-link-in-bio-v1', '.sv-lib-frame'); await sleep(300); return await fn(p); } finally { await p.close(); }
  };
  const type = (p, sel, v, i) => p.evaluate((sel, v, i) => { const e = document.querySelectorAll(sel)[i || 0]; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v, i || 0);
  const download = async (p) => { await K.clearDownloads(p); await press(p, /^Download index\.html$/); await p.waitForFunction(() => window.__downloads.length >= 1, { timeout: 30000 }); return (await K.downloads(p))[0]; };
  /* a page with links of every kind, built once: two good links, three refused, four icons */
  const built = () => K.once('sv-lib-built', () => libPage(async (p) => {
    await press(p, /^\+ Add a link$/); await press(p, /^\+ Add a link$/); await sleep(200);
    const links = [['Shop', 'example.com/shop'], ['Bad', 'javascript:alert(1)'], ['Old', 'http://example.org/'], ['Data', 'data:text/html,x'], ['Blog', 'https://blog.example.net/']];
    for (let i = 0; i < links.length; i++) { await type(p, '.lib-link-title', links[i][0], i); await type(p, '.lib-link-url', links[i][1], i); }
    await type(p, '.lib-icon-value', 'https://www.instagram.com/someone', 0); await type(p, '.lib-icon-value', 'someone@example.com', 1);
    await press(p, /^\+ Add an icon$/); await press(p, /^\+ Add an icon$/); await sleep(200);
    await p.evaluate(() => { const s = document.querySelectorAll('.lib-icon-kind'); s[2].value = 'phone'; s[2].dispatchEvent(new Event('change', { bubbles: true })); s[3].value = 'whatsapp'; s[3].dispatchEvent(new Event('change', { bubbles: true })); });
    await type(p, '.lib-icon-value', '+44 20 7946 0000', 2); await type(p, '.lib-icon-value', '447700900000', 3);
    await sleep(400);
    const errs = await p.$$eval('.sv-lib-err', (l) => l.map((e) => e.textContent));
    const left = await p.$$eval('.sv-lib-left li', (l) => l.map((e) => e.textContent));
    const d = await download(p);
    return { html: d.bytes.toString('utf8'), name: d.name, errs, left };
  }));
  const anchors = (h) => [...h.matchAll(/<a\s([^>]*)>/g)].map((m) => ({ href: ((/href="([^"]*)"/.exec(m[1]) || [])[1] || '').replace(/&amp;/g, '&'), rel: (/rel="([^"]*)"/.exec(m[1]) || [])[1], label: (/aria-label="([^"]*)"/.exec(m[1]) || [])[1] }));

  claim(L, 'faq', 'Opening it makes no network request at all, so it also works offline.', 'served alone: no request; offline: renders', B, async () => {
    const r = await built();
    const q = await K.browser.newPage(); const seen = [];
    try {
      await q.setRequestInterception(true);
      q.on('request', (x) => { const u = x.url(); if (u === 'https://bio.example.test/') return x.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: r.html }); if (!/^data:/.test(u)) seen.push(u); x.abort(); });
      await q.goto('https://bio.example.test/', { waitUntil: 'networkidle0' });
      await sleep(400);
    } finally { await q.close(); }
    const o = await K.browser.newPage();
    let a = 0;
    try { await o.setOfflineMode(true); await o.setContent(r.html, { waitUntil: 'load' }); a = await o.evaluate(() => document.querySelectorAll('a').length); } finally { await o.close(); }
    return [!seen.length && a === 6, (seen.length ? 'requests: ' + seen.join(', ') : 'no request') + '; offline it shows ' + a + ' links'];
  });
  claim(L, 'faq', 'other kinds of address — javascript:, data:, plain http:// — can be used to run code or to send people somewhere unsafe, so they are refused and left out of the page with a note saying why.', 'three refused with reasons; none in the file', B, async () => {
    const r = await built();
    const hrefs = anchors(r.html).map((a) => a.href);
    return [/javascript:/.test(r.errs[1]) && /http:\/\//.test(r.errs[2]) && /data:/.test(r.errs[3]) && r.left.length === 3 && !/javascript:|data:text|http:\/\//.test(r.html) && hrefs.every((h) => /^(https:|mailto:|tel:)/.test(h)), r.left.join(' | ').slice(0, 200)];
  });
  claim(L, 'faq', 'Email and phone icons are the exception: they become mailto: and tel: links built from an address or number that has been checked.', 'mailto: and tel: from the typed values; a bad address refused', B, async () => {
    const r = await built();
    const h = anchors(r.html).map((a) => a.href);
    const bad = await libPage(async (p) => { await type(p, '.lib-icon-value', 'not an email', 1); await sleep(300); return p.$$eval('.sv-lib-iconrow .sv-lib-err', (l) => l[1].textContent); });
    return [h.includes('mailto:someone@example.com') && h.includes('tel:+442079460000') && h.includes('https://wa.me/447700900000') && /not an email address/.test(bad), h.slice(2).join(' ') + ' | bad email: ' + bad];
  });
  claim(L, 'faq', 'Each icon carries the platform’s name as its label, which screen readers announce and which shows when you hover.', 'aria-label and title on every icon link', B, async () => {
    const r = await built();
    const ic = [...r.html.matchAll(/<a [^>]*aria-label="([^"]*)" title="([^"]*)"/g)].map((m) => m[1] + '=' + m[2]);
    return [ic.join() === 'Instagram=Instagram,Email=Email,Phone=Phone,WhatsApp=WhatsApp', ic.join(', ')];
  });
  claim(L, 'lede', 'The file has no scripts and makes no outside requests, so it works offline and on any static host.', 'no <script>, @import, @font-face or non-data url(); rel="noopener" on every link', B, async () => {
    const r = await built();
    const a = anchors(r.html);
    const ok = !/<script|@import|@font-face/i.test(r.html) && !(r.html.match(/url\(\s*['"]?(?!data:)/gi) || []).length && a.every((x) => /noopener/.test(x.rel)) && /<link rel="icon" href="data:,">/.test(r.html) && r.name === 'index.html';
    return [ok, r.name + ', ' + a.length + ' links, ' + r.html.length + ' bytes'];
  });
  claim(L, 'faq', 'Without a photo the example page is about 3 KB', 'the example page measures 2.5–3.5 KB', B, async () => libPage(async (p) => {
    await sleep(400); const n = Number(await p.$eval('.sv-lib-size', (e) => e.dataset.bytes));
    const d = await download(p);
    return [n >= 2560 && n <= 3584 && d.bytes.length === n, n + ' bytes shown, ' + d.bytes.length + ' saved'];
  }));
  claim(L, 'faq', 'with each of our three sample photos the whole page came to between 23 and 27 KB.', 'portrait, group and pet sample photos: 23–27 KB (decimal)', B, async () => libPage(async (p) => {
    const out = [];
    for (const s of ['portrait.jpg', 'group.jpg', 'pet.jpg']) {
      await (await p.$('#lib-photo')).uploadFile(K.sample(s));
      await p.waitForFunction((n) => document.querySelector('.tool-io .io-msg').textContent.indexOf(n + ': added') === 0, { timeout: 15000 }, s);
      await sleep(400); out.push(Number(await p.$eval('.sv-lib-size', (e) => e.dataset.bytes)));
    }
    return [out.every((n) => n >= 23000 && n <= 27999), out.join(', ') + ' bytes'];
  }));
  claim(L, 'faq', 'Unless you tick “Remember this page in this browser”, your name, bio, photo and links are gone when you close the page; only the theme, buttons, corners and font are remembered.', 'unticked: only the look is stored; ticked: the project; unticked again: deleted', B, async () => libPage(async (p) => {
    await type(p, '#lib-name', 'Private Name'); await sleep(400);
    const a = await p.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1'));
    await p.click('#lib-keep'); await sleep(400);
    const b = await p.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1'));
    await p.click('#lib-keep'); await sleep(400);
    const c = await p.evaluate(() => localStorage.getItem('1234tools-social-link-in-bio-v1'));
    const look = (s) => { const o = JSON.parse(s); return o.look && Object.keys(o.look).sort().join(); };
    return [!/Private Name/.test(a) && look(a) === 'button,corner,font,theme' && /Private Name/.test(b) && !/Private Name/.test(c), 'before: ' + a.slice(0, 80) + ' | ticked: has the name ' + /Private Name/.test(b) + ' | unticked: ' + c.slice(0, 80)];
  }));
  claim(L, 'how', 'Pick a theme (eight to choose from), a button style, corners and a font, and watch the preview.', 'eight theme buttons, each changing the preview', B, async () => libPage(async (p) => {
    const ids = await p.$$eval('.sv-lib-theme', (l) => l.map((b) => b.dataset.theme));
    const docs = new Set();
    for (const id of ids) { await p.evaluate((t) => document.querySelector('.sv-lib-theme[data-theme="' + t + '"]').click(), id); await sleep(250); docs.add(await p.$eval('.sv-lib-frame', (f) => (/<style>[\s\S]*?<\/style>/.exec(f.srcdoc) || [''])[0])); }
    return [ids.length === 8 && docs.size === 8, ids.length + ' themes, ' + docs.size + ' different stylesheets in the preview'];
  }));
  claim(L, 'dworked', 'Across eight themes and four button styles the lowest text contrast measured was 5.18:1.', 'every theme × style rendered; WCAG ratio worked out here', B, async () => libPage(async (p) => {
    const lum = (c) => { const v = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const col = (s) => { const v = /rgba?\(([^)]+)\)/.exec(s)[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 }; };
    let low = 99;
    const themes = await p.$$eval('.sv-lib-theme', (l) => l.map((b) => b.dataset.theme));
    const styles = await p.$$eval('#lib-button option', (l) => l.map((o) => o.value));
    for (const th of themes) for (const st of styles) {
      await p.evaluate((t, s) => { document.querySelector('.sv-lib-theme[data-theme="' + t + '"]').click(); const e = document.getElementById('lib-button'); e.value = s; e.dispatchEvent(new Event('change', { bubbles: true })); }, th, st);
      await sleep(300);
      const want = await p.$eval('.sv-lib-frame', (f) => f.srcdoc.length);
      let c = null;
      for (let k = 0; k < 40 && !c; k++) {
        const f = await (await p.$('.sv-lib-frame')).contentFrame();
        try { c = await f.evaluate((len) => { if (document.readyState !== 'complete' || document.documentElement.outerHTML.length < len * 0.5) return null; const g = (s) => getComputedStyle(document.querySelector(s)); return { bg: g('body').backgroundColor, img: g('body').backgroundImage, h1: g('h1').color, bio: g('.bio').color, a: g('.links a').color, ab: g('.links a').backgroundColor }; }, want); } catch (e) { c = null; }
        if (!c) await sleep(100);
      }
      const bgs = (c.img.match(/rgba?\([^)]+\)/g) || [c.bg]).map((s) => col(s).c);
      for (const bg of bgs) {
        const ab = col(c.ab); const bb = ab.a === 0 ? bg : ab.c.map((v, i) => Math.round(v * ab.a + bg[i] * (1 - ab.a)));
        low = Math.min(low, ratio(col(c.h1).c, bg), ratio(col(c.bio).c, bg), ratio(col(c.a).c, bb));
      }
    }
    return [Math.abs(low - 5.18) < 0.01, 'lowest ' + low.toFixed(2) + ':1 over ' + themes.length + ' × ' + styles.length];
  }));
  claim(L, 'faq', 'press Export the project to save a .json file you can import on any device.', 'export, edit, import: the links come back', B, async () => libPage(async (p) => {
    await type(p, '#lib-name', 'Round Trip'); await sleep(300);
    await K.clearDownloads(p); await press(p, /^Export the project/);
    await p.waitForFunction(() => window.__downloads.length >= 1, { timeout: 30000 });
    const j = (await K.downloads(p))[0];
    await type(p, '#lib-name', 'Changed'); await sleep(200);
    const f = K.write('sv-lib-project.json', j.bytes);
    await (await p.$('#lib-import')).uploadFile(f); await sleep(600);
    const name = await p.$eval('#lib-name', (e) => e.value);
    return [j.name === 'link-in-bio-project.json' && j.type === 'application/json' && name === 'Round Trip', j.name + ' (' + j.type + ') → name back to "' + name + '"'];
  }));
  manual(L, 'faq', 'Free static-site hosts let you drag the file into a web page; your own domain’s web space works just as well.', 'about third-party hosts, not the tool');
}

module.exports = function (api) { drop1(api); drop2(api); };
