/**
 * Claims on the image tools' pages (/image/), checked in Chrome on the real
 * page (files in through the file input, results read from their own bytes),
 * and, for what a paint function asks of the canvas, in Node with a
 * recording canvas.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

module.exports = function ({ claim, manual, kit: K }) {
  const N = 'node', B = 'browser';
  const S = (f) => K.sample(f);
  /* every page opens as a first visit: the image tools remember their settings
     on the device (1234tools-img-<tool>-v1), and one claim's settings must not
     carry into the next */
  const freshPage = (p) => p.evaluateOnNewDocument(() => { try { Object.keys(localStorage).filter((k) => /^1234tools-img-/.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* none */ } });
  const openFresh = async (url) => {
    const orig = K.browser.newPage;
    K.browser.newPage = async function () { const p = await orig.call(this); await freshPage(p); return p; };
    try { return await K.open(url); } finally { K.browser.newPage = orig; }
  };
  const within = async (url, fn) => { const p = await openFresh(url); try { return await fn(p); } finally { await p.close(); } };
  const tagged = (name, orient, src) => K.once('img:tag:' + name, () => K.write(name, K.withExif(fs.readFileSync(S(src || 'street.jpg')), orient || 1)));
  const hasExif = (b) => b.indexOf('Exif\0') >= 0 || b.indexOf('DemoCam') >= 0;
  /** a PNG made in the page: noise, so every pixel differs from its neighbours */
  const NOISE = 'const d=x.createImageData(w,h);let s=7;for(let i=0;i<d.data.length;i+=4){s=(s*1103515245+12345)&0x7fffffff;d.data[i]=s&255;d.data[i+1]=(s>>8)&255;d.data[i+2]=(s>>16)&255;d.data[i+3]=255;}x.putImageData(d,0,0);';
  const pngFile = async (p, name, w, h, draw) => K.write(name, await K.img.makePng(p, w, h, draw));
  const close = (a, b, t) => a.every((v, i) => Math.abs(v - b[i]) <= t);
  const fmtKB = (n) => n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';

  /* a recording canvas for paint functions run in Node */
  function paintIn(file, id, w, h, opts) {
    const spec = K.tool(file, id);
    const log = [];
    const ctx = new Proxy({ canvas: { width: 0, height: 0 } }, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'measureText') return (s) => ({ width: String(s).length * (parseFloat(/(\d+(\.\d+)?)px/.exec(t.font || '10px')[1]) * 0.5) });
        return (...a) => { log.push([k, ...a]); return undefined; };
      },
      set(t, k, v) { t[k] = v; log.push(['=' + String(k), v]); return true; }
    });
    const helpers = { size(W, H) { ctx.canvas.width = W; ctx.canvas.height = H; log.push(['size', W, H]); }, fill(c) { log.push(['fill', c]); }, fit(img, mw, mh) { let a = img.naturalWidth, b = img.naturalHeight; if (mw && a > mw) { b = Math.round(b * (mw / a)); a = mw; } if (mh && b > mh) { a = Math.round(a * (mh / b)); b = mh; } return { w: a, h: b }; }, roundRect(c, x, y, w, h, r) { log.push(['roundRect', x, y, w, h, r]); }, scratch() { return { getContext: () => ctx, width: 1, height: 1 }; } };
    const o = {}; (spec.controls || []).forEach((c) => { o[c.key] = c.default; }); Object.assign(o, opts || {});
    spec.paint(ctx, { naturalWidth: w, naturalHeight: h, width: w, height: h }, o, helpers);
    return log;
  }

  /* ================================================================ */
  /* background remover                                                */
  /* ================================================================ */
  const BG = '/image/background-remover/';
  /* white | #e0e0e0 (31 below white: 53.7 away) | #dddddd (34 below: 58.9 away) | white, each a full-height stripe; a navy ring with a white hole in the middle */
  const STRIPES = "x.fillStyle='#fff';x.fillRect(0,0,w,h);x.fillStyle='#e0e0e0';x.fillRect(50,0,50,h);x.fillStyle='#dddddd';x.fillRect(100,0,50,h);x.fillStyle='#1d3557';x.fillRect(160,30,60,60);x.fillStyle='#fff';x.fillRect(180,50,20,20);";
  const bgRun = (opts) => within(BG, async (p) => {
    const f = await pngFile(p, 'bg-stripes.png', 240, 120, STRIPES);
    for (const k of Object.keys(opts || {})) await K.img.set(p, k, opts[k]);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const px = await K.img.pixels(p, b, [[25, 60], [75, 60], [125, 60], [190, 60], [165, 35], [230, 5]]);
    return { b, px: px.px.map((c) => c[3]), outside: p.__requests.filter((r) => !r.url.startsWith(K.BASE)).length };
  });
  claim(BG, 'dfaq', 'at the default 32, a pixel up to about 55 units from the reference counts as background, since 32 × √3 ≈ 55.4.', 'pick white at 32: #e0e0e0 (53.7 away) goes, #dddddd (58.9 away) stays', B, async () => {
    const r = await bgRun({ mode: 'colour', key: '#ffffff', tolerance: 32, feather: 0 });
    return [r.px[0] === 0 && r.px[1] === 0 && r.px[2] === 255, 'alpha white/e0/dd: ' + r.px.slice(0, 3).join('/')];
  });
  claim(BG, 'tip', 'At 0 only the exact colour goes.', 'tolerance 0 removes white and keeps #e0e0e0', B, async () => {
    const r = await bgRun({ mode: 'colour', key: '#ffffff', tolerance: 0, feather: 0 });
    return [r.px[0] === 0 && r.px[1] === 255, 'alpha white/e0: ' + r.px.slice(0, 2).join('/')];
  });
  claim(BG, 'point', 'The fill starts from every edge pixel and spreads only to matching neighbours above, below and beside, so background cut off from the border stays.',
    'the white hole inside the navy ring stays opaque', B, async () => {
      const r = await bgRun({ mode: 'auto', tolerance: 32, feather: 0 });
      return [r.px[3] === 255 && r.px[0] === 0 && r.px[5] === 0, 'hole alpha ' + r.px[3] + ', edge white ' + r.px[0]];
    });
  claim(BG, 'tip', 'The result is always a PNG, because JPEG has no alpha channel', 'the result is a PNG and there is no format control', B, async () => {
    const r = await bgRun({});
    const ctl = await within(BG, (p) => p.$('#ic-format'));
    return [K.isPng(r.b) && !ctl, K.kind(r.b) + ', format control ' + (ctl ? 'present' : 'absent')];
  });
  claim(BG, 'dfaq', 'Set Edge softness to 0.', 'softness 0 leaves only fully clear or fully solid pixels', B, async () => {
    const vals = await within(BG, async (p) => {
      const f = await pngFile(p, 'bg-hard.png', 240, 120, STRIPES);
      await K.img.set(p, 'feather', 0);
      await K.img.upload(p, [f]);
      const [b] = await K.img.results(p);
      return p.evaluate(async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; const s = new Set(); for (let i = 3; i < d.length; i += 4) s.add(d[i]); return [...s]; }, Array.from(b));
    });
    return [vals.every((v) => v === 0 || v === 255), 'alpha values: ' + vals.slice(0, 8).join(',')];
  });
  claim(BG, 'faq', 'Does this tool contact any other server? => No.'.replace(' => No.', ''), 'loading and using the page requests nothing outside the site', B, async () => {
    const r = await bgRun({ mode: 'auto' });
    return [r.outside === 0, r.outside + ' outside requests'];
  });

  /* ================================================================ */
  /* blur & redact                                                     */
  /* ================================================================ */
  const BR = '/image/blur-redact/';
  /* a drag on the picture canvas, as a person does it: scrolled into view first, the result waited for */
  const brDragBox = (p, fx0, fy0, fx1, fy1) => K.img.act(p, async () => {
    await p.$eval('.select-canvas', (e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await K.sleep(300);
    const box = await (await p.$('.select-canvas')).boundingBox();
    await p.mouse.move(box.x + box.width * fx0, box.y + box.height * fy0);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * fx1, box.y + box.height * fy1, { steps: 8 });
    await p.mouse.up();
  }).then(() => idle(p));
  const brAreas = async (p) => K.img.stat(await K.img.stats(p), 'Areas covered');
  claim(BR, 'howto', 'Nothing is covered until you draw.', 'street.jpg uploaded: Areas covered 0 and the page says nothing is covered yet', B, async () => within(BR, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    const m = await K.img.msg(p);
    const n = await brAreas(p);
    return [n === '0' && /Nothing is covered yet/.test(m.text), 'areas ' + n + ' / ' + m.text];
  }));
  claim(BR, 'point', 'Drag a box, an oval or a free brush stroke, as many areas as you need; Undo, or Ctrl+Z, takes back the last one.', 'two boxes → 2 areas; Ctrl+Z → 1; Undo → 0; an oval and a brush stroke each count as an area', B, async () => within(BR, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    await brDragBox(p, 0.1, 0.1, 0.3, 0.3); await brDragBox(p, 0.5, 0.5, 0.8, 0.8);
    const two = await brAreas(p);
    await K.img.act(p, async () => { await p.keyboard.down('Control'); await p.keyboard.press('z'); await p.keyboard.up('Control'); });
    const one = await brAreas(p);
    await K.img.act(p, async () => { await p.evaluate(() => [...document.querySelectorAll('.tool-io button')].find((b) => b.textContent.trim() === 'Undo').click()); });
    const none = await brAreas(p);
    await K.img.change(p, 'shape', 'ellipse'); await brDragBox(p, 0.2, 0.2, 0.4, 0.5);
    const oval = await brAreas(p);
    await K.img.change(p, 'shape', 'brush'); await brDragBox(p, 0.5, 0.5, 0.7, 0.7);
    const brush = await brAreas(p);
    return [two === '2' && one === '1' && none === '0' && oval === '1' && brush === '2', [two, one, none, oval, brush].join(', ')];
  }));
  claim(BR, 'point', 'Block fills the area with your colour, black by default.', 'block on a white picture: the dragged centre is black, a corner untouched', B, async () => within(BR, async (p) => {
    const f = await pngFile(p, 'br-white.png', 200, 100, "x.fillStyle='#fff';x.fillRect(0,0,w,h);");
    await K.img.set(p, 'method', 'block');
    await K.img.upload(p, [f]);
    await brDragBox(p, 0.25, 0.25, 0.75, 0.75);
    const [b] = await K.img.results(p);
    const px = await K.img.pixels(p, b, [[100, 50], [2, 2]]);
    return [close(px.px[0], [0, 0, 0, 255], 0) && close(px.px[1], [255, 255, 255, 255], 0), K.j(px.px)];
  }));
  claim(BR, 'point', 'then draws it back with smoothing off, so each block is one flat colour.', 'pixelate 16: every pixel of a block is the same colour', B, async () => within(BR, async (p) => {
    const f = await pngFile(p, 'br-noise.png', 320, 160, NOISE);
    await K.img.set(p, 'method', 'pixelate'); await K.img.set(p, 'scope', 'whole');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const px = await K.img.pixels(p, b, [[0, 0], [5, 7], [15, 15], [16, 0]]);
    return [close(px.px[0], px.px[1], 0) && close(px.px[0], px.px[2], 0) && !close(px.px[0], px.px[3], 0), K.j(px.px)];
  }));
  claim(BR, 'dfaq', 'Only the changed pixels are in the new file, and none of the source photo\'s metadata is copied.', 'a JPEG with camera and GPS tags comes out with none', B, async () => within(BR, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('br-tagged.jpg')]);
    const [b] = await K.img.results(p);
    return [K.isJpeg(b) && !hasExif(b), K.kind(b) + (hasExif(b) ? ' with EXIF' : ' without EXIF')];
  }));
  /* a figure read off the page against a measured byte count: within 2% (PNG/JPEG encoders drift between Chrome versions) */
  const idle = async (p) => { await K.sleep(400); await p.waitForFunction(() => !document.querySelector('.tool-io[aria-busy]'), { timeout: 180000, polling: 100 }); await K.sleep(400); };
  const near = (bytes, figure) => { const [v, u] = figure.split(' '); return Math.abs(bytes / (u === 'MB' ? 1048576 : 1024) / Number(v) - 1) <= 0.02; };
  /* the worked example's figures, from one run: nothing drawn as PNG, then one box (38%,48% to 60%,63%) as PNG, JPEG 85, then blur and block as PNG */
  const brSizes = () => K.once('img:br-sizes', () => within(BR, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    const r = { areas0: await brAreas(p) };
    [r.none] = await K.img.results(p);
    await brDragBox(p, 0.38, 0.48, 0.6, 0.63);
    r.areas1 = await brAreas(p);
    [r.png] = await K.img.results(p);
    await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'quality', 85);
    [r.jpg] = await K.img.results(p);
    await K.img.change(p, 'format', 'image/png');
    await K.img.change(p, 'method', 'blur'); [r.blur] = await K.img.results(p);
    await K.img.change(p, 'method', 'block'); [r.block] = await K.img.results(p);
    return r;
  }));
  claim(BR, 'dfaq', 'PNG, the default, is lossless: the 321.4 KB street photo above became 2.79 MB. JPEG at 85 gave 349.5 KB, close to the original.',
    'street.jpg: one box as PNG, then as JPEG 85', B, async () => {
      const r = await brSizes();
      const src = fmtKB(fs.statSync(S('street.jpg')).size);
      return [src === '321.4 KB' && r.areas1 === '1' && K.isPng(r.png) && K.isJpeg(r.jpg) && near(r.png.length, '2.79 MB') && near(r.jpg.length, '349.5 KB'),
        'source ' + src + '; ' + r.areas1 + ' area: PNG ' + fmtKB(r.png.length) + ', JPEG 85 ' + fmtKB(r.jpg.length) + ' (2% allowed)'];
    });
  claim(BR, 'what', 'Saved as PNG the result weighed 2.79 MB; JPEG at quality 85 gave 349.5 KB. Blur gave 2.86 MB as PNG; with nothing drawn, the PNG was 2.91 MB.',
    'the worked example: box as PNG and JPEG 85, blur as PNG, nothing drawn as PNG', B, async () => {
      const r = await brSizes();
      return [r.areas0 === '0' && K.isPng(r.none) && near(r.none.length, '2.91 MB') && near(r.png.length, '2.79 MB') && near(r.jpg.length, '349.5 KB') && K.isPng(r.blur) && near(r.blur.length, '2.86 MB'),
        'nothing ' + fmtKB(r.none.length) + ', box PNG ' + fmtKB(r.png.length) + ', JPEG 85 ' + fmtKB(r.jpg.length) + ', blur ' + fmtKB(r.blur.length) + ', block ' + fmtKB(r.block.length) + ' (2% allowed)'];
    });

  /* ================================================================ */
  /* bulk resizer                                                      */
  /* ================================================================ */
  const BU = '/image/bulk-image-resizer/';
  claim(BU, 'point', 'Fixed width or height works out the other side from the photo\'s ratio; longest edge scales the bigger side to the value; percentage scales both; exact size takes your width and height.',
    'street.jpg 1600×1200 in each mode', B, async () => within(BU, async (p) => {
      await K.img.set(p, 'mode', 'width'); await K.img.set(p, 'value', 800);
      await K.img.upload(p, [S('street.jpg')]);
      const dim = async () => { const [b] = await K.img.results(p); const d = await K.img.pixels(p, b); return d.w + '×' + d.h; };
      const out = { width: await dim() };
      await K.img.change(p, 'mode', 'height'); await K.img.change(p, 'value', 600); out.height = await dim();
      await K.img.change(p, 'mode', 'longest'); await K.img.change(p, 'value', 800); out.longest = await dim();
      await K.img.change(p, 'mode', 'percent'); await K.img.change(p, 'value', 50); out.percent = await dim();
      await K.img.change(p, 'mode', 'exact'); await K.img.change(p, 'value', 300); await K.img.change(p, 'height', 200); out.exact = await dim();
      return [K.j(out) === K.j({ width: '800×600', height: '800×600', longest: '800×600', percent: '800×600', exact: '300×200' }), K.j(out)];
    }));
  claim(BU, 'point', 'Results are named after their source plus the new size, such as street-800x600.webp, and come as one ZIP or go straight into a folder.',
    'two photos at width 800: one ZIP with street-800x600.webp and food-800x534.webp', B, async () => within(BU, async (p) => {
      await K.img.set(p, 'mode', 'width'); await K.img.set(p, 'value', 800);
      await K.img.upload(p, [S('street.jpg'), S('food.jpg')]);
      await K.clearDownloads(p);
      if (!await K.clickText(p, '.tool-io button', /as ZIP/)) return [false, 'no ZIP button'];
      await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
      const [d] = await K.downloads(p);
      const names = K.zipNames(d.bytes).map((x) => x.name).sort().join(',');
      return [names === 'food-800x534.webp,street-800x600.webp', d.name + ': ' + names];
    }));
  claim(BU, 'works', 'Each photo is shrunk by Lanczos3 resampling in a background worker, then written by a WebAssembly encoder, WebP at quality 85 unless you change it.', 'defaults WebP, 85; output is WebP; the Resampling row names Lanczos3', B, async () => within(BU, async (p) => {
    const d = await p.evaluate(() => [document.getElementById('ic-format').value, document.getElementById('ic-quality').value]);
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p);
    const rs = K.img.stat(await K.img.stats(p), 'Resampling') || '';
    return [d.join() === 'image/webp,85' && K.isWebp(b) && /Lanczos3/.test(rs), d.join() + ' → ' + K.kind(b) + ', ' + rs];
  }));
  claim(BU, 'dfaq', 'By default, yes: each file is rewritten without camera and GPS tags, though Metadata can keep them.', 'tagged JPEG resized to JPEG keeps no EXIF', B, async () => within(BU, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg'); await K.img.set(p, 'value', 800);
    await K.img.upload(p, [await tagged('bu-tagged.jpg')]);
    const [b] = await K.img.results(p);
    return [K.isJpeg(b) && !hasExif(b), hasExif(b) ? 'EXIF kept' : 'no EXIF'];
  }));
  claim(BU, 'tip', 'Images smaller than the target are never enlarged unless you set Allow enlarging to Yes; they are saved at their own size and the page tells you which.',
    'width 2400 leaves a 1600 px photo at 1600 and says so', B, async () => within(BU, async (p) => {
      await K.img.set(p, 'mode', 'width'); await K.img.set(p, 'value', 2400);
      await K.img.upload(p, [S('street.jpg')]);
      const [b] = await K.img.results(p); const d = await K.img.pixels(p, b); const m = await K.img.msg(p);
      return [d.w === 1600 && /left at its own size/.test(m.text), d.w + '×' + d.h + ' / ' + m.text];
    }));
  claim(BU, 'mistake', 'Reading the Source figure as the whole batch. It gives the first file\'s dimensions only', 'Source shows the first file only', B, async () => within(BU, async (p) => {
    await K.img.upload(p, [S('street.jpg'), S('document.jpg')]); await idle(p);
    const s = K.img.stat(await K.img.stats(p), 'Source');
    return [s === '1600×1200', s];
  }));

  /* ================================================================ */
  /* circle crop                                                       */
  /* ================================================================ */
  const CC = '/image/circle-crop/';
  claim(CC, 'works', 'A square canvas of the output size, 512 px by default, is clipped to the shape', '512×512 PNG with see-through corners', B, async () => within(CC, async (p) => {
    await K.img.upload(p, [S('pet.jpg')]);
    const [b] = await K.img.results(p);
    const d = await K.img.pixels(p, b, [[2, 2], [256, 256], [-3, -3]]);
    return [K.isPng(b) && d.w === 512 && d.h === 512 && d.px[0][3] === 0 && d.px[2][3] === 0 && d.px[1][3] === 255, K.kind(b) + ' ' + d.w + '×' + d.h + ' corner alpha ' + d.px[0][3]];
  }));
  claim(CC, 'tip', 'The image is centre-cropped to a square first', 'a 300×100 red|green|blue strip comes out all green', B, async () => within(CC, async (p) => {
    const f = await pngFile(p, 'cc-strip.png', 300, 100, "x.fillStyle='#f00';x.fillRect(0,0,100,h);x.fillStyle='#0f0';x.fillRect(100,0,100,h);x.fillStyle='#00f';x.fillRect(200,0,100,h);");
    await K.img.set(p, 'shape', 'rounded'); await K.img.set(p, 'radius', 0);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const d = await K.img.pixels(p, b, [[5, 256], [256, 256], [506, 256]]);
    return [d.px.every((c) => c[1] > 200 && c[0] < 30 && c[2] < 30), K.j(d.px)];
  }));
  claim(CC, 'point', 'Squircle is a rounded square with the radius fixed at 22.5%, not a true superellipse.', 'squircle clips a rounded square with radius 22.5% of the inner width', N, async () => {
    const log = paintIn('img-circle-crop.js', 'circle-crop', 800, 600, { shape: 'squircle', size: 512, border: 0 });
    const rr = log.find((x) => x[0] === 'roundRect');
    const arc = log.some((x) => x[0] === 'arc' || x[0] === 'ellipse' || x[0] === 'bezierCurveTo');
    return [rr && Math.abs(rr[5] - 512 * 0.225) < 1e-9 && !arc, rr ? 'roundRect radius ' + rr[5] + ' on ' + rr[3] + ' px' : 'no roundRect'];
  });
  claim(CC, 'point', 'A ring is stroked just outside the picture, so it never covers the photo', 'border 40: ring colour from radius 216 to 256, photo inside', B, async () => within(CC, async (p) => {
    const f = await pngFile(p, 'cc-green.png', 200, 200, "x.fillStyle='#00ff00';x.fillRect(0,0,w,h);");
    await K.img.set(p, 'border', 40); await K.img.set(p, 'borderColor', '#ff0000');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const d = await K.img.pixels(p, b, [[256, 256 - 210], [256, 256 - 230], [256, 256 - 250]]);
    return [d.px[0][1] > 200 && d.px[0][0] < 40 && d.px[1][0] > 200 && d.px[1][1] < 40 && d.px[2][0] > 200, K.j(d.px)];
  }));
  claim(CC, 'what', 'A 1600 × 1067 photo of a dog in long grass, a 220.3 KB JPEG, became a 1024×1024 circle that weighed 1.48 MB as PNG and 113.6 KB as WebP. At 256 px with a 6 px ring set apart from the picture by a gap, the PNG was 125.5 KB, light enough for any profile upload.',
    'pet.jpg at 1024 as PNG and WebP; at 256 with a 6 px gap ring as PNG', B, async () => within(CC, async (p) => {
      await K.img.set(p, 'size', 1024);
      await K.img.upload(p, [S('pet.jpg')]); await idle(p);
      const [png] = await K.img.results(p); const pd = await K.img.pixels(p, png, [[2, 2]]);
      await K.img.change(p, 'format', 'image/webp'); await idle(p);
      const [web] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/png'); await K.img.change(p, 'size', 256); await K.img.change(p, 'border', 6); await K.img.change(p, 'ring', 'gap'); await idle(p);
      const [ring] = await K.img.results(p); const rd = await K.img.pixels(p, ring);
      return [K.isPng(png) && pd.w === 1024 && pd.px[0][3] === 0 && near(png.length, '1.48 MB') && K.isWebp(web) && near(web.length, '113.6 KB') && K.isPng(ring) && rd.w === 256 && near(ring.length, '125.5 KB'),
        'PNG ' + fmtKB(png.length) + ', WebP ' + fmtKB(web.length) + ', 256 px ring ' + fmtKB(ring.length) + ' (2% allowed)'];
    }));
  claim(CC, 'dfaq', 'A 1024 px circle from a 220.3 KB JPEG weighed 1.48 MB', 'pet.jpg at 1024 px', B, async () => within(CC, async (p) => {
    await K.img.set(p, 'size', 1024);
    await K.img.upload(p, [S('pet.jpg')]);
    const [b] = await K.img.results(p);
    /* a size from a run of the page: within 5%, since PNG encoders differ a little between Chrome versions */
    return [fmtKB(fs.statSync(S('pet.jpg')).size) === '220.3 KB' && Math.abs(b.length / 1048576 / 1.48 - 1) <= 0.03, 'source ' + fmtKB(fs.statSync(S('pet.jpg')).size) + ', result ' + fmtKB(b.length) + ' (claim 1.48 MB, 3% allowed)'];
  }));

  /* ================================================================ */
  /* colour palette                                                    */
  /* ================================================================ */
  const CP = '/image/color-palette-extractor/';
  const palette = (p) => K.img.stats(p);
  claim(CP, 'tip', 'Colours are found with median cut, which is deterministic — the same image always produces the same palette.', 'two runs on food.jpg give the same rows', B, async () => {
    const one = () => within(CP, async (p) => { await K.img.upload(p, [S('food.jpg')]); await p.waitForSelector('.palette-swatch'); return K.j(await palette(p)); });
    const a = await one(), b = await one();
    return [a === b && a.length > 10, a === b ? 'identical' : 'differ'];
  });
  claim(CP, 'dfaq', 'Pixels with alpha under 125 out of 255 are skipped, so the transparent background never becomes a swatch.', 'a red square on a transparent PNG: every swatch is red', B, async () => within(CP, async (p) => {
    const f = await pngFile(p, 'cp-logo.png', 200, 200, "x.clearRect(0,0,w,h);x.fillStyle='#ff0000';x.fillRect(80,80,40,40);x.fillStyle='rgba(0,0,255,0.3)';x.fillRect(0,0,60,60);");
    await K.img.upload(p, [f]);
    await p.waitForSelector('.palette-swatch');
    const hex = await p.$$eval('.palette-hex', (l) => l.map((e) => e.textContent));
    return [hex.every((h) => /^#F[0-9A-F]0[0-9A-F]0[0-9A-F]$/.test(h)), hex.join(',')];
  }));
  claim(CP, 'point', 'Each swatch is its box\'s average colour, and its share the box\'s fraction of the pixels, rounded to a whole percentage.', 'every share is a whole percentage', B, async () => within(CP, async (p) => {
    await K.img.upload(p, [S('food.jpg')]); await p.waitForSelector('.palette-swatch');
    const sh = await p.$$eval('.palette-share:not(.palette-hsl):not(.palette-contrast)', (l) => l.map((e) => e.textContent));
    return [sh.length >= 2 && sh.every((s) => /^\d+%$/.test(s)), sh.join(' ')];
  }));
  claim(CP, 'dfaq', 'The coral #ED815C is hsl(15, 80%, 65%), 2.66:1 against white text, a fail, and 7.90:1 against black, AAA.', 'the Colour Converter engine on #ED815C', N, async () => {
    const cc = K.tool('dev-color-converter.js', 'color-converter');
    const w = K.gen(cc, { colour: '#ED815C', bg: '#ffffff' }), b = K.gen(cc, { colour: '#ED815C', bg: '#000000' });
    const hsl = (w.output.match(/hsl\([^)]+\)/) || [])[0];
    return [hsl === 'hsl(15, 80%, 65%)' && K.stat(w, 'Contrast ratio') === '2.66:1' && K.stat(b, 'Contrast ratio') === '7.90:1', hsl + ', ' + K.stat(w, 'Contrast ratio') + ', ' + K.stat(b, 'Contrast ratio')];
  });
  claim(CP, 'works', 'The image is drawn onto a small canvas, 160 px on its longest side', 'the pixels read are a 160×107 canvas for a 1600×1067 photo', B, async () => within(CP, async (p) => {
    await p.evaluate(() => { window.__reads = []; const g = CanvasRenderingContext2D.prototype.getImageData; CanvasRenderingContext2D.prototype.getImageData = function (...a) { window.__reads.push(this.canvas.width + '×' + this.canvas.height); return g.apply(this, a); }; });
    await K.img.upload(p, [S('food.jpg')]); await p.waitForSelector('.palette-swatch');
    const reads = await p.evaluate(() => window.__reads);
    return [reads.indexOf('160×107') >= 0 && !reads.some((r) => r === '1600×1067'), 'getImageData on ' + (reads.join(', ') || 'nothing')];
  }));

  /* wave 1: the eyedropper and the exports, each read back here by a parser of the test's own */
  const QUAD = "x.fillStyle='#d62828';x.fillRect(0,0,w/2,h/2);x.fillStyle='#003049';x.fillRect(w/2,0,w/2,h/2);x.fillStyle='#fcbf49';x.fillRect(0,h/2,w/2,h/2);x.fillStyle='#2a9d8f';x.fillRect(w/2,h/2,w/2,h/2);";
  claim(CP, 'tip', 'Click the picture to pick the exact colour of one pixel — a logo’s brand colour, say — and it joins the palette and every export.', 'a click on the navy quarter adds “Picked 1 #003049”, and the CSS export has it', B, async () => within(CP, async (p) => {
    const f = await pngFile(p, 'cp-quad.png', 200, 120, QUAD);
    await K.img.upload(p, [f]); await p.waitForSelector('.pal-view');
    const r = await p.$eval('.pal-view', (c) => { c.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = c.getBoundingClientRect(); return { x: b.left + b.width * 0.75, y: b.top + b.height * 0.25 }; });
    await p.mouse.click(r.x, r.y);
    await p.waitForFunction(() => [...document.querySelectorAll('.tool-io .stat-row')].some((x) => /^Picked 1/.test(x.textContent)), { timeout: 15000 });
    const st = await K.img.stats(p);
    const row = st.find((x) => /^Picked 1/.test(x[0]));
    const css = await p.$eval('.tool-io pre.code-out', (e) => e.textContent);
    return [row && /#003049$/.test(row[0]) && /: #003049;/.test(css), (row || []).join(' ') + ' / ' + (css.match(/--colour-\d+: #003049/) || ['not in CSS'])[0]];
  }));
  claim(CP, 'tip', 'Export as CSS custom properties, JSON, a Tailwind colour scale, a GIMP/Inkscape .gpl palette, an Adobe .ase swatch file or a PNG swatch card.',
    'the .ase (parsed here: ASEF 1.0, RGB floats), .gpl and JSON downloads hold the palette’s colours', B, async () => within(CP, async (p) => {
      await K.img.set(p, 'count', 4);
      await K.img.upload(p, [S('food.jpg')]); await p.waitForSelector('.palette-swatch');
      const want = (await K.img.stats(p)).map((r) => r[0].match(/#[0-9A-F]{6}/)[0].toLowerCase());
      const get = async (kind) => {
        await K.img.set(p, 'export', kind); await K.sleep(500);
        await K.clearDownloads(p);
        await K.clickText(p, '.tool-io .io-pane .io-actions button', /^Download/);
        await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 10000 });
        return (await K.downloads(p))[0];
      };
      const ase = await get('ase');
      const b = ase.bytes; const got = [];
      let ok = b.slice(0, 4).toString('latin1') === 'ASEF' && b.readUInt16BE(4) === 1 && b.readUInt32BE(8) === want.length;
      let i = 12;
      for (let k = 0; k < want.length && ok; k++) {
        const type = b.readUInt16BE(i), len = b.readUInt32BE(i + 2), nlen = b.readUInt16BE(i + 6);
        const m = i + 8 + nlen * 2;
        const model = b.slice(m, m + 4).toString('latin1');
        const rgb = [0, 1, 2].map((c) => Math.round(b.readFloatBE(m + 4 + c * 4) * 255));
        got.push('#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join(''));
        ok = ok && type === 1 && model === 'RGB ';
        i += 6 + len;
      }
      const gpl = (await get('gpl')).bytes.toString('utf8');
      const gplHex = gpl.split('\n').filter((l) => /^\s*\d+\s+\d+\s+\d+/.test(l)).map((l) => '#' + l.trim().split(/\s+/).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''));
      const json = JSON.parse((await get('json')).bytes.toString('utf8')).map((c) => c.hex);
      const png = await get('png');
      ok = ok && got.join() === want.join() && /^GIMP Palette\n/.test(gpl) && gplHex.join() === want.join() && json.join() === want.join() && K.isPng(png.bytes) && /food-palette\.png$/.test(png.name);
      return [ok, 'palette ' + want.join(',') + ' | ase ' + got.join(',') + ' | gpl ' + gplHex.join(',') + ' | json ' + json.join(',') + ' | ' + png.name];
    }));

  /* ================================================================ */
  /* EXIF remover                                                      */
  /* ================================================================ */
  const ER = '/image/exif-remover/';
  const FX = require(path.join(__dirname, '..', 'image-fixtures.js'));
  /* the remover's and viewer's test file: landscape.jpg with an EXIF APP1 (camera, GPS) and an XMP APP1 (creator, rights) */
  const lakeTagged = () => K.once('img:lake-tagged', () => {
    const jpg = fs.readFileSync(S('landscape.jpg'));
    const eb = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), FX.exifTiff(1)]);
    const xmp = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator><rdf:Seq><rdf:li>A. Photographer</rdf:li></rdf:Seq></dc:creator><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">(c) 2026 A. Photographer</rdf:li></rdf:Alt></dc:rights></rdf:Description></rdf:RDF></x:xmpmeta>';
    const xb = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), Buffer.from(xmp)]);
    const seg = (b) => Buffer.concat([Buffer.from([0xff, 0xe1, (b.length + 2) >> 8, (b.length + 2) & 255]), b]);
    return K.write('lake-tagged.jpg', Buffer.concat([jpg.slice(0, 2), seg(eb), seg(xb), jpg.slice(2)]));
  });
  claim(ER, 'works', 'Lossless, the default, copies the file’s own bytes and leaves out every metadata segment or chunk',
    'the result is the original JPEG with its EXIF and XMP segments taken out, byte for byte', B, async () => within(ER, async (p) => {
      const m = await p.evaluate(() => document.getElementById('ic-method').value);
      await K.img.upload(p, [await lakeTagged()]);
      const [b] = await K.img.results(p);
      const plain = fs.readFileSync(S('landscape.jpg'));
      return [m === 'lossless' && b.equals(plain), m + ': result ' + b.length + ' bytes, landscape.jpg ' + plain.length + (b.equals(plain) ? ', identical' : ', different')];
    }));
  claim(ER, 'point', 'A JPEG keeps its scan byte for byte, with its JFIF header and colour profile; a PNG keeps only its drawing chunks; a WebP loses its EXIF and XMP chunks.',
    'JPEG: same scan, APP0 and ICC kept; PNG: eXIf and tEXt gone, IDAT identical; WebP: EXIF chunk gone, VP8X flag cleared', B, async () => within(ER, async (p) => {
      await K.img.upload(p, [await lakeTagged()]);
      const [j] = await K.img.results(p);
      const segs = K.jpegSegs(j).filter((s) => s.m >= 0xe0 && s.m <= 0xef).map((s) => s.m.toString(16));
      const okJ = K.jpegScan(j).equals(K.jpegScan(fs.readFileSync(S('landscape.jpg')))) && segs.join() === 'e0,e2';
      const png0 = await K.img.makePng(p, 60, 40, NOISE);
      const t = Buffer.from('Author\0Secret Person', 'latin1');
      const withText = FX.pngWithExif(png0, FX.exifTiff(1));
      const ihdrEnd = 8 + 12 + withText.readUInt32BE(8);
      const td = Buffer.concat([Buffer.from('tEXt'), t]); const len = Buffer.alloc(4); len.writeUInt32BE(t.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(FX.crc32(td));
      const png = Buffer.concat([withText.slice(0, ihdrEnd), len, td, cr, withText.slice(ihdrEnd)]);
      await K.img.upload(p, [K.write('er-meta.png', png)]);
      const [pb] = await K.img.results(p);
      const types = K.pngChunks(pb).map((c) => c.type);
      const idat = (b) => Buffer.concat(K.pngChunks(b).filter((c) => c.type === 'IDAT').map((c) => c.data));
      const okP = !types.includes('eXIf') && !types.includes('tEXt') && idat(pb).equals(idat(png));
      const webp0 = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#2a6'; x.fillRect(0, 0, 64, 48); return Array.from(atob(c.toDataURL('image/webp', 0.8).split(',')[1]), (ch) => ch.charCodeAt(0)); }));
      await K.img.upload(p, [K.write('er-meta.webp', FX.webpWithExif(webp0, FX.exifTiff(1), 64, 48))]);
      const [wb] = await K.img.results(p);
      const img = FX.webpWithExif(webp0, FX.exifTiff(1), 64, 48); const body = img.slice(30, img.indexOf('EXIF', 30));
      const okW = K.isWebp(wb) && wb.indexOf('EXIF') < 0 && wb.indexOf('DemoCam') < 0 && (wb[20] & 0x08) === 0 && wb.readUInt32LE(4) === wb.length - 8 && wb.indexOf(body) > 0;
      return [okJ && okP && okW, 'JPEG ' + okJ + ' (' + segs.join() + '); PNG ' + okP + ' (' + types.join(',') + '); WebP ' + okW];
    }));
  claim(ER, 'point', 'Keep writes the chosen fields back as a small EXIF block of their own: the orientation tag by default, or the copyright and author.',
    'a sideways JPEG keeps Orientation 6 and nothing else; "Copyright and author" keeps those two', B, async () => within(ER, async (p) => {
      await K.img.upload(p, [await tagged('er-turned.jpg', 6, 'food.jpg')]);
      const [b] = await K.img.results(p);
      const ex = K.core().readExif ? null : null; void ex;
      const tiffOf = (buf) => { const s = K.jpegSegs(buf).find((x) => x.m === 0xe1 && /^Exif/.test(x.id)); return s ? buf.slice(s.at + 10, s.at + 2 + s.len) : null; };
      const t = tiffOf(b);
      const tagsOf = (t) => { if (!t) return []; const le = t[0] === 0x49; const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o)); const ifd = le ? t.readUInt32LE(4) : t.readUInt32BE(4); const n = u16(ifd); return Array.from({ length: n }, (_, k) => [u16(ifd + 2 + k * 12), u16(ifd + 2 + k * 12 + 8)]); };
      const tags = tagsOf(t);
      return [tags.length === 1 && tags[0][0] === 0x0112 && tags[0][1] === 6 && b.indexOf('DemoCam') < 0, K.j(tags)];
    }));
  claim(ER, 'point', 'First the site’s own parser lists the original’s metadata and any GPS position being removed; then it reads each cleaned file back and reports what is really in it.',
    'rows for the original (EXIF, XMP …), the GPS position, and the result', B, async () => within(ER, async (p) => {
      await K.img.upload(p, [await lakeTagged()]);
      const st = await K.img.stats(p);
      const a = K.img.stat(st, 'Metadata found in original'), g = K.img.stat(st, 'GPS removed'), r = K.img.stat(st, 'Metadata in result');
      return [a === 'EXIF, XMP, APP0, ICC colour profile' && g === '-44.10850, 170.15417' && r === 'No EXIF, GPS or camera data; standard JFIF header and sRGB colour profile kept', a + ' / ' + g + ' / ' + r];
    }));
  claim(ER, 'point', 'GIF, BMP and AVIF have no lossless path here, so they are redrawn, and the page says so.', 'a GIF comes out a JPEG with a note naming it', B, async () => within(ER, async (p) => {
    const gif = Buffer.from('R0lGODlhAgACAIAAAP8AAAAA/yH5BAAAAAAALAAAAAACAAIAAAICRAoAOw==', 'base64');
    await K.img.upload(p, [K.write('er-tiny.gif', gif)]);
    const [b] = await K.img.results(p); const m = await K.img.msg(p);
    return [K.isJpeg(b) && /er-tiny\.gif is GIF, which has no lossless path here, so it was redrawn as JPEG/.test(m.text), K.kind(b) + ' / ' + m.text];
  }));
  claim(ER, 'dfaq', 'Not in Lossless mode: the compressed picture is copied as it is, so the pixels are identical.', 'decoded pixels of the result equal the original’s', B, async () => within(ER, async (p) => {
    const f = await lakeTagged();
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const same = await p.evaluate(async (a, c) => {
      const px = async (u8) => { const bm = await createImageBitmap(new Blob([new Uint8Array(u8)])); const cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height; const x = cv.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data; };
      const A = await px(a), C = await px(c); if (A.length !== C.length) return false; for (let i = 0; i < A.length; i++) if (A[i] !== C[i]) return false; return true;
    }, Array.from(b), Array.from(fs.readFileSync(f)));
    return [same, same ? 'identical' : 'different'];
  }));
  claim(ER, 'dfaq', 'Redraw turns the pixels upright so no tag is needed.', 'Redraw: a 1600×1067 JPEG tagged Orientation 6 comes out 1067×1600 with no EXIF', B, async () => within(ER, async (p) => {
    await K.img.set(p, 'method', 'redraw');
    await K.img.upload(p, [await tagged('er-turned.jpg', 6, 'food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 1067 && d.h === 1600 && !hasExif(b), d.w + '×' + d.h];
  }));
  claim(ER, 'dfaq', 'the EXIF viewer then lists only APP0 and the ICC colour profile for the test JPEG.', 'the cleaned JPEG, read by the EXIF viewer', B, async () => {
    const clean = await within(ER, async (p) => { await K.img.upload(p, [await lakeTagged()]); return (await K.img.results(p))[0]; });
    return within('/image/exif-viewer/', async (p) => {
      await K.img.upload(p, [K.write('er-clean.jpg', clean)]);
      const s = K.img.stat(await K.img.stats(p), 'Metadata segments');
      return [s === 'APP0 (16 B), ICC colour profile (472 B)', s];
    });
  });

  /* ================================================================ */
  /* EXIF viewer                                                       */
  /* ================================================================ */
  const EV = '/image/exif-viewer/';
  /* the viewer may show no picture (a HEIC in Chrome), so a run is over when its File row names the file */
  const evUpload = async (p, f) => { const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(f); await p.waitForFunction((n) => [...document.querySelectorAll('.tool-io .stat-row')].some((r) => r.textContent === 'File' + n), { timeout: 30000 }, path.basename(f)); await K.sleep(200); };
  claim(EV, 'point', 'GPS degrees, minutes and seconds become signed decimal degrees, south and west negative, with a map link that sends only those two numbers.', '44°6\'30.6"S 170°9\'15"E', B, async () => within(EV, async (p) => {
    await evUpload(p, await tagged('ev-tagged.jpg'));
    const st = await K.img.stats(p);
    const href = await p.$eval('.tool-io a[href*="openstreetmap"]', (a) => a.href).catch(() => '');
    const q = href.replace(/^https:\/\/www\.openstreetmap\.org\//, '');
    return [K.img.stat(st, 'GPS latitude') === '-44.108500' && K.img.stat(st, 'GPS longitude') === '170.154167' && /^\?mlat=-44\.108500&mlon=170\.154167#map=15\/-44\.108500\/170\.154167$/.test(q), K.img.stat(st, 'GPS latitude') + ', ' + K.img.stat(st, 'GPS longitude') + ', ' + href];
  }));
  claim(EV, 'works', 'the site’s own parser finds the metadata in whichever container it is: a JPEG’s APP1 segment, a PNG’s eXIf chunk, a WebP’s EXIF chunk, the Exif item a HEIC or AVIF file locates through its iloc box, or a TIFF’s tag directory.',
    'the same EXIF (DemoCam, GPS) read from a PNG, a WebP, a HEIC and a TIFF built byte by byte in the test', B, async () => {
      const t = FX.exifTiff(6);
      const files = await within(EV, async (p) => {
        const png = await K.img.makePng(p, 40, 30, NOISE);
        const webp = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const x = c.getContext('2d'); x.fillStyle = '#c63'; x.fillRect(0, 0, 40, 30); return Array.from(atob(c.toDataURL('image/webp', 0.8).split(',')[1]), (ch) => ch.charCodeAt(0)); }));
        return [K.write('ev-exif.png', FX.pngWithExif(png, t)), K.write('ev-exif.webp', FX.webpWithExif(webp, t, 40, 30)), K.write('ev-exif.heic', FX.heicWithExif(t, 4032, 3024)), K.write('ev-exif.tif', t)];
      });
      const got = [];
      for (const f of files) {
        got.push(await within(EV, async (p) => {
          await evUpload(p, f);
          const st = await K.img.stats(p);
          return path.basename(f) + ':' + K.img.stat(st, 'Format') + ',' + K.img.stat(st, 'Make') + ',' + K.img.stat(st, 'GPS latitude') + ',' + K.img.stat(st, 'Orientation');
        }));
      }
      return [got.every((g) => /,DemoCam,-44\.108500,Rotated 90° CW \(6\)$/.test(g)), got.join(' | ')];
    });
  claim(EV, 'point', 'A HEIC photo’s metadata is read even where the browser cannot draw the picture itself.', 'Chrome cannot decode HEIC; the page says so and lists the EXIF, with Dimensions from the ispe box', B, async () => within(EV, async (p) => {
    await evUpload(p, K.write('ev-phone.heic', FX.heicWithExif(FX.exifTiff(6), 4032, 3024)));
    const st = await K.img.stats(p);
    const note = await p.$eval('.tool-io .image-stage', (e) => e.textContent).catch(() => '');
    return [K.img.stat(st, 'Dimensions') === '4032×3024' && K.img.stat(st, 'Make') === 'DemoCam' && /cannot show HEIC/.test(note), K.img.stat(st, 'Dimensions') + ' / ' + note];
  }));
  claim(EV, 'point', 'XMP and IPTC fields such as creator, rights and caption follow the EXIF.', 'XMP creator and rights are listed', B, async () => within(EV, async (p) => {
    await evUpload(p, await lakeTagged());
    const st = await K.img.stats(p);
    return [K.img.stat(st, 'XMP Creator') === 'A. Photographer' && K.img.stat(st, 'XMP Rights') === '(c) 2026 A. Photographer', K.img.stat(st, 'XMP Creator') + ' / ' + K.img.stat(st, 'XMP Rights')];
  }));
  claim(EV, 'tip', '“Save as JSON” keeps every field in a file', 'the JSON holds the EXIF, GPS and XMP fields the page lists', B, async () => within(EV, async (p) => {
    await evUpload(p, await lakeTagged());
    await K.clearDownloads(p);
    await K.clickText(p, '.tool-io .image-actions button', /^Save as JSON$/);
    const [d] = await K.downloads(p);
    const j = JSON.parse(d.bytes.toString('utf8'));
    return [d.name === 'lake-tagged-metadata.json' && j.exif.Make === 'DemoCam' && Math.abs(j.gps.latitude + 44.1085) < 1e-6 && j.xmp.Creator === 'A. Photographer', d.name + ' ' + K.j({ make: j.exif.Make, lat: j.gps && j.gps.latitude, xmp: j.xmp })];
  }));
  claim(EV, 'dfaq', 'The six decimal places shown here are about 11 cm', 'GPS is shown to six decimals', B, async () => within(EV, async (p) => {
    await evUpload(p, await tagged('ev-tagged2.jpg'));
    const v = K.img.stat(await K.img.stats(p), 'GPS latitude') || '';
    return [/\.\d{6}$/.test(v), v];
  }));
  claim(EV, 'point', 'It reads the main tag directory and the Exif and GPS directories, showing a fixed list of common tags, from Make to LensModel', 'Make and Orientation are read', B, async () => within(EV, async (p) => {
    await evUpload(p, await tagged('ev-tagged3.jpg', 6));
    const st = await K.img.stats(p);
    return [K.img.stat(st, 'Make') === 'DemoCam' && /90|Rotate/i.test(K.img.stat(st, 'Orientation') || ''), K.img.stat(st, 'Make') + ' / ' + K.img.stat(st, 'Orientation')];
  }));

  /* ================================================================ */
  /* border                                                            */
  /* ================================================================ */
  const BO = '/image/image-border/';
  const border = (opts, draw) => within(BO, async (p) => {
    const f = await pngFile(p, 'bo-src.png', 100, 100, draw || NOISE);
    for (const k of Object.keys(opts)) await K.img.set(p, k, opts[k]);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    return { p, b, f };
  });
  claim(BO, 'point', 'Polaroid makes the bottom strip three times the border width.', '100×100 with 10 px polaroid → 120×140', B, async () => within(BO, async (p) => {
    const f = await pngFile(p, 'bo-a.png', 100, 100, NOISE);
    await K.img.set(p, 'style', 'polaroid'); await K.img.set(p, 'width', 10);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 120 && d.h === 140, d.w + '×' + d.h];
  }));
  claim(BO, 'what', 'a 60 px border adds 120 px to both width and height', 'solid 60 on 100×100 → 220×220', B, async () => within(BO, async (p) => {
    const f = await pngFile(p, 'bo-b.png', 100, 100, NOISE);
    await K.img.set(p, 'width', 60);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 220 && d.h === 220, d.w + '×' + d.h];
  }));
  claim(BO, 'point', 'A corner radius rounds the frame\'s outer edge and leaves the cut-away corners transparent.', 'radius 40 as PNG: corner pixel clear', B, async () => within(BO, async (p) => {
    const f = await pngFile(p, 'bo-c.png', 100, 100, NOISE);
    await K.img.set(p, 'width', 30); await K.img.set(p, 'radius', 40);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[1, 1], [80, 1]]);
    return [K.isPng(b) && d.px[0][3] === 0 && d.px[1][3] === 255, K.j(d.px)];
  }));
  claim(BO, 'dfaq', 'Not as PNG: the photo is copied at its own size, pixel for pixel, and saved losslessly.', 'the photo inside the frame equals the source pixel for pixel', B, async () => within(BO, async (p) => {
    const f = await pngFile(p, 'bo-d.png', 100, 100, NOISE);
    await K.img.set(p, 'width', 20);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const same = await p.evaluate(async (a1, a2) => {
      const dec = async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
      const s = await dec(a1), o = await dec(a2);
      let diff = 0; for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) for (let k = 0; k < 4; k++) if (s.data[(y * 100 + x) * 4 + k] !== o.data[((y + 20) * o.width + x + 20) * 4 + k]) diff++;
      return diff;
    }, Array.from(fs.readFileSync(f)), Array.from(b));
    return [same === 0, same + ' channel values differ'];
  }));
  claim(BO, 'point', 'Double draws its inner line 45% of the border width in from the edge, 12% of the border thick, only when the border is wider than 8 px.', 'accent line at 45% of 40 px; none at 8 px', B, async () => within(BO, async (p) => {
    const f = await pngFile(p, 'bo-e.png', 100, 100, NOISE);
    await K.img.set(p, 'style', 'double'); await K.img.set(p, 'width', 40); await K.img.set(p, 'accent', '#ff0000');
    await K.img.upload(p, [f]);
    let [b] = await K.img.results(p);
    const at40 = (await K.img.pixels(p, b, [[18, 90]])).px[0];
    await K.img.change(p, 'width', 8);
    [b] = await K.img.results(p);
    const at8 = await p.evaluate(async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); const d = x.getImageData(0, 0, c.width, 8).data; let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60) red++; return red; }, Array.from(b));
    return [at40[0] > 200 && at40[1] < 60 && at8 === 0, 'at 40 px: ' + K.j(at40) + '; red pixels in an 8 px border: ' + at8];
  }));
  claim(BO, 'dfaq', 'Why is the bordered image so much bigger? => PNG, the default'.replace(/^.*=> /, ''), 'the default is PNG', B, async () => within(BO, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p);
    return [K.isPng(b), K.kind(b)];
  }));

  /* ================================================================ */
  /* compressor                                                        */
  /* ================================================================ */
  const CO = '/image/image-compressor/';
  claim(CO, 'point', 'A max width scales the picture down first with Lanczos3; a narrower photo is never enlarged.', 'max 800 on 1600×1200 → 800×600; max 3000 → 1600×1200', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'maxWidth', 800);
    await K.img.upload(p, [S('street.jpg')]);
    let [b] = await K.img.results(p); const a = await K.img.pixels(p, b);
    await K.img.change(p, 'maxWidth', 3000);
    [b] = await K.img.results(p); const c = await K.img.pixels(p, b);
    return [a.w === 800 && a.h === 600 && c.w === 1600 && c.h === 1200, a.w + '×' + a.h + ', ' + c.w + '×' + c.h];
  }));
  claim(CO, 'dfaq', 'By default, yes: a test JPEG with camera, date and GPS tags came out with none.', 'a tagged JPEG compressed to JPEG keeps no EXIF', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('co-tagged.jpg')]);
    const [b] = await K.img.results(p);
    return [K.isJpeg(b) && !hasExif(b), hasExif(b) ? 'EXIF kept' : 'no EXIF'];
  }));
  claim(CO, 'dfaq', 'Not unless you set a max width, or a limit that quality alone cannot meet. Otherwise the street photo stayed 1600×1200.', 'max width 0 keeps the size at quality 30 and 90', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'quality', 30);
    await K.img.upload(p, [S('street.jpg')]);
    let [b] = await K.img.results(p); const a = await K.img.pixels(p, b);
    await K.img.change(p, 'quality', 90);
    [b] = await K.img.results(p); const c = await K.img.pixels(p, b);
    return [a.w === 1600 && a.h === 1200 && c.w === 1600 && c.h === 1200, a.w + '×' + a.h + ' / ' + c.w + '×' + c.h + ' (4000×3000 is the page\'s own test photo; this sample is 1600×1200)'];
  }));
  claim(CO, 'dfaq', 'This page divides by 1,024 and macOS by 1,000: 329,068 bytes is 321.4 KB here, 329.1 KB on a Mac.', 'street.jpg (329,068 bytes) reads 321.4 KB on the page; 329,068 ÷ 1,000 is 329.1', B, async () => within(CO, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    const shown = K.img.stat(await K.img.stats(p), 'Original total');
    const bytes = fs.statSync(S('street.jpg')).size;
    return [bytes === 329068 && shown === '321.4 KB' && (bytes / 1000).toFixed(1) === '329.1', bytes + ' bytes shown as ' + shown + '; decimal ' + (bytes / 1000).toFixed(1) + ' KB'];
  }));
  claim(CO, 'lede', 'Shrink JPEG, PNG, WebP and AVIF files', '"Keep original format" keeps a PNG a PNG; AVIF is offered and produced (an ftyp avif box)', B, async () => within(CO, async (p) => {
    const f = await pngFile(p, 'co-same.png', 80, 80, NOISE);
    await K.img.set(p, 'format', 'same');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    await K.img.change(p, 'format', 'image/avif', 120000);
    const [a] = await K.img.results(p);
    const avif = a && a.slice(4, 12).toString('latin1') === 'ftypavif';
    return [K.isPng(b) && avif, K.kind(b) + '; ' + (a ? a.slice(4, 12).toString('latin1') : 'no result')];
  }));

  /* ================================================================ */
  /* converter                                                         */
  /* ================================================================ */
  const CV = '/image/image-converter/';
  claim(CV, 'tip', 'Converting a transparent PNG to JPEG fills the transparency with the background colour chosen above.', 'background #ff0000: transparent corner becomes red', B, async () => within(CV, async (p) => {
    const f = await pngFile(p, 'cv-t.png', 80, 80, "x.clearRect(0,0,w,h);x.fillStyle='#00f';x.fillRect(20,20,40,40);");
    await K.img.set(p, 'format', 'image/jpeg'); await K.img.set(p, 'bg', '#ff0000');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[1, 1]]);
    return [K.isJpeg(b) && d.px[0][0] > 240 && d.px[0][1] < 20 && d.px[0][2] < 20, K.j(d.px)];
  }));
  claim(CV, 'tip', 'PNG is lossless, so the quality slider has no effect on it', 'PNG at quality 10 and 92 is the same file', B, async () => within(CV, async (p) => {
    await K.img.set(p, 'format', 'image/png'); await K.img.set(p, 'quality', 92);
    await K.img.upload(p, [S('food.jpg')]);
    const [a] = await K.img.results(p);
    await K.img.change(p, 'quality', 10);
    const [b] = await K.img.results(p);
    return [a.equals(b), a.equals(b) ? 'identical' : a.length + ' vs ' + b.length + ' bytes'];
  }));
  claim(CV, 'point', 'The quality slider, 92 by default, reaches JPEG, WebP and AVIF', 'default 92', B, async () => within(CV, async (p) => {
    const q = await p.$eval('#ic-quality', (e) => e.value); return [q === '92', q];
  }));
  claim(CV, 'point', 'EXIF, GPS and XMP stay behind unless Metadata keeps them; a rotation recorded as a tag is applied to the pixels.', 'Orientation 6 JPEG → upright JPEG with no EXIF', B, async () => within(CV, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('cv-turned.jpg', 6, 'food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 1067 && d.h === 1600 && !hasExif(b), d.w + '×' + d.h + (hasExif(b) ? ', EXIF kept' : ', no EXIF')];
  }));
  claim(CV, 'dfaq', 'Not unless you set a longest side. The test photo stayed 1600×1067, except in ICO, which holds at most 256×256.', 'food.jpg 1600×1067 as PNG, JPEG and WebP; the ICO card says 256×256', B, async () => within(CV, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    const out = [];
    for (const f of ['image/png', 'image/jpeg', 'image/webp']) { await K.img.change(p, 'format', f); const [b] = await K.img.results(p); const d = await K.img.pixels(p, b); out.push(K.kind(b) + ' ' + d.w + '×' + d.h); }
    await K.img.change(p, 'format', 'image/x-icon'); await idle(p);
    const cap = await p.$eval('.img-compare-readout', (e) => e.textContent).catch(() => '');
    return [out.join(', ') === 'png 1600×1067, jpeg 1600×1067, webp 1600×1067' && /Result[^R]*256×256/.test(cap), out.join(', ') + ' / ico: ' + cap];
  }));
  claim(CV, 'dfaq', 'Not by default. A test JPEG with camera tags and a GPS position came out with only a JFIF header; Metadata can keep EXIF.', 'the JPEG has APP0 (JFIF) only', B, async () => within(CV, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('cv-tagged.jpg')]);
    const [b] = await K.img.results(p);
    const segs = K.jpegSegs(b).filter((s) => (s.m >= 0xe0 && s.m <= 0xef) || s.m === 0xfe).map((s) => s.m.toString(16));
    return [segs.join() === 'e0', segs.join()];
  }));
  claim(CV, 'mistake', 'Chrome cannot decode either, and the page names the file; export a JPEG first.', 'a TIFF is refused with that message', B, async () => within(CV, async (p) => {
    const tif = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(K.write('scan.tif', tif));
    await p.waitForFunction(() => /could|not images/.test((document.querySelector('.tool-io .io-msg') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
    const m = await K.img.msg(p);
    return [/None of those files could be decoded\./.test(m.text) && /scan\.tif could not be read as an image/.test(m.text), m.text];
  }));

  /* ================================================================ */
  /* cropper                                                           */
  /* ================================================================ */
  const CR = '/image/image-cropper/';
  claim(CR, 'point', 'so the crop comes from the full-resolution file.', 'the default crop of a noise PNG equals that rectangle of the source', B, async () => within(CR, async (p) => {
    const f = await pngFile(p, 'cr-noise.png', 200, 100, NOISE);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const diff = await p.evaluate(async (a1, a2) => {
      const dec = async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
      const s = await dec(a1), o = await dec(a2);
      let d = 0; for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) for (let k = 0; k < 4; k++) if (o.data[(y * o.width + x) * 4 + k] !== s.data[((y + 15) * s.width + x + 30) * 4 + k]) d++;
      return { d, w: o.width, h: o.height };
    }, Array.from(fs.readFileSync(f)), Array.from(b));
    return [diff.d === 0 && diff.w === 140 && diff.h === 70, K.j(diff)];
  }));
  /* drag on the crop canvas from (fx0, fy0) to (fx1, fy1), as fractions of it; the page scrolls smoothly, so it is put in place instantly first */
  const cropDrag = async (p, fx0, fy0, fx1, fy1) => {
    await p.$eval('.select-canvas', (e) => window.scrollTo({ top: e.getBoundingClientRect().top + window.scrollY - 120, behavior: 'instant' }));
    await K.sleep(100);
    const box = await (await p.$('.select-canvas')).boundingBox();
    const before = await K.img.previews(p);
    await p.mouse.move(box.x + box.width * fx0, box.y + box.height * fy0);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * fx1, box.y + box.height * fy1, { steps: 8 });
    await p.mouse.up();
    await p.waitForFunction((old) => [...document.querySelectorAll('.tool-io .image-stage img.image-preview')].some((i) => old.indexOf(i.src) < 0), { timeout: 10000 }, before).catch(() => {});
    return K.img.stat(await K.img.stats(p), 'Selection') || '';
  };
  /* the readout under the crop canvas, "W × H px at X, Y", as numbers */
  const cropBox = async (p) => { const m = /(\d+) × (\d+) px\s+at (\d+), (\d+)/.exec(await p.$eval('.select-readout', (e) => e.textContent)) || []; return { w: +m[1], h: +m[2], x: +m[3], y: +m[4] }; };
  claim(CR, 'point', 'With a ratio locked, the selection keeps that shape as you drag.',
    '1:1 inside, 1:1 past the bottom-right corner, 1:1 up-left past the top-left corner, 16:9 past the right edge: each the right shape and inside 1600×1200', B, async () => within(CR, async (p) => {
      await K.img.set(p, 'ratio', '1:1');
      await K.img.upload(p, [S('street.jpg')]);
      const runs = [];
      const one = async (label, ar, d) => { const st = await cropDrag(p, ...d); const b = await cropBox(p); const [w, h] = st.split('×').map(Number); runs.push({ label, ar, w, h, b }); };
      await one('1:1 inside', 1, [0.1, 0.1, 0.8, 0.5]);
      /* the canvas sits at about x 428-1150, y 120-662 of the 1280×1000 viewport: every point stays in the viewport */
      await one('1:1 past bottom-right', 1, [0.5, 0.5, 1.15, 1.3]);
      await one('1:1 up-left past top-left', 1, [0.3, 0.6, -0.4, -0.2]);
      await K.img.change(p, 'ratio', '16:9');
      await one('16:9 past right', 16 / 9, [0.6, 0.2, 1.15, 0.9]);
      const bad = runs.filter((r) => !(r.w > 50 && r.w === r.b.w && r.h === r.b.h && Math.abs(r.h - r.w / r.ar) <= 0.5 && r.b.x >= 0 && r.b.y >= 0 && r.b.x + r.w <= 1600 && r.b.y + r.h <= 1200));
      return [!bad.length, runs.map((r) => r.label + ' ' + r.w + '×' + r.h + ' at ' + r.b.x + ',' + r.b.y).join('; ')];
    }));
  /* the number boxes: set one, fire change, as a person typing and leaving the box */
  const cropNum = (p, k, v) => K.img.act(p, () => p.$eval('#crop-' + k, (e, v) => { e.value = String(v); e.dispatchEvent(new Event('change', { bubbles: true })); }, v)).then(() => idle(p));
  claim(CR, 'what', 'the number boxes were set to X 160, Y 240 and a width of 1280, and the height followed: a 1280×720 box, a true 16:9. Downloaded as PNG, the default, the crop weighed 1.51 MB, nearly five times the whole original. The same box saved as JPEG at quality 85 was 184.7 KB.',
    'street.jpg, 16:9, X 160, Y 240, width 1280 typed in: 1280×720; PNG then JPEG 85', B, async () => within(CR, async (p) => {
      await K.img.set(p, 'ratio', '16:9');
      await K.img.upload(p, [S('street.jpg')]);
      await cropNum(p, 'x', 160); await cropNum(p, 'y', 240); await cropNum(p, 'w', 1280);
      const box = await cropBox(p);
      await idle(p);
      const [png] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'quality', 85); await idle(p);
      const [jpg] = await K.img.results(p);
      const src = fs.statSync(S('street.jpg')).size;
      return [box.w === 1280 && box.h === 720 && box.x === 160 && box.y === 240 && K.isPng(png) && near(png.length, '1.51 MB') && png.length / src > 4.5 && png.length / src < 5 && K.isJpeg(jpg) && near(jpg.length, '184.7 KB'),
        K.j(box) + ': PNG ' + fmtKB(png.length) + ' (' + (png.length / src).toFixed(2) + '× the original), JPEG 85 ' + fmtKB(jpg.length) + ' (2% allowed)'];
    }));
  claim(CR, 'works', 'Draw a box, drag it, pull its handles, or type X, Y, Width and Height; a locked ratio is obeyed at once.',
    '1:1 chosen first: the starting box is already square; typing a width on 16:9 sets the height', B, async () => within(CR, async (p) => {
      await K.img.set(p, 'ratio', '1:1');
      await K.img.upload(p, [S('street.jpg')]);
      const sq = await cropBox(p);
      await K.img.change(p, 'ratio', '16:9');
      await cropNum(p, 'w', 800);
      const wide = await cropBox(p);
      return [sq.w === sq.h && wide.w === 800 && wide.h === 450, K.j(sq) + ' / ' + K.j(wide)];
    }));
  claim(CR, 'tip', 'With a ratio locked, the selection keeps that shape as you drag.', '1:1, a drag that runs past the bottom edge', B, async () => within(CR, async (p) => {
    await K.img.set(p, 'ratio', '1:1');
    await K.img.upload(p, [S('street.jpg')]);
    const st = await cropDrag(p, 0.1, 0.1, 0.8, 1.15);
    const [w, h] = st.split('×').map(Number);
    return [w > 100 && w === h, 'selection ' + st + ' after dragging from 10%,10% to 80%,115% of the picture'];
  }));
  claim(CR, 'dfaq', 'Each crop needs its own box on its own picture, so the cropper takes one image at a time.', 'the file input takes one file', B, async () => within(CR, async (p) => {
    const m = await p.$eval('.tool-io input[type=file]', (e) => e.multiple); return [m === false, 'multiple=' + m];
  }));
  claim(CR, 'dfaq', 'By default, yes: the crop is a new file with no EXIF or GPS tags. Metadata can keep the colour profile or EXIF without GPS.', 'tagged JPEG cropped to JPEG: no EXIF', B, async () => within(CR, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('cr-tagged.jpg')]);
    const [b] = await K.img.results(p);
    return [!hasExif(b), hasExif(b) ? 'EXIF kept' : 'no EXIF'];
  }));

  /* ================================================================ */
  /* rotate & flip                                                     */
  /* ================================================================ */
  const RF = '/image/image-rotate-flip/';
  claim(RF, 'works', 'The canvas is sized to the turned picture\'s bounding box, w·|cos θ| + h·|sin θ| wide by w·|sin θ| + h·|cos θ| high, rounded to whole pixels.', '300×200 at 30° → 360×323', B, async () => within(RF, async (p) => {
    const f = await pngFile(p, 'rf-a.png', 300, 200, NOISE);
    await K.img.set(p, 'angle', 30);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[0, 0]]);
    return [d.w === 360 && d.h === 323 && close(d.px[0], [255, 255, 255, 255], 0), d.w + '×' + d.h + ', corner ' + K.j(d.px[0])];
  }));
  claim(RF, 'tip', 'Rotating by 90, 180 or 270 degrees is lossless in shape — no interpolation is needed.', '90° on a noise PNG moves pixels exactly', B, async () => within(RF, async (p) => {
    const f = await pngFile(p, 'rf-b.png', 60, 40, NOISE);
    await K.img.set(p, 'angle', 90);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const r = await p.evaluate(async (a1, a2) => {
      const dec = async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
      const s = await dec(a1), o = await dec(a2);
      let d = 0; for (let y = 0; y < 40; y++) for (let x = 0; x < 60; x++) { const ox = 39 - y, oy = x; for (let k = 0; k < 3; k++) if (s.data[(y * 60 + x) * 4 + k] !== o.data[(oy * o.width + ox) * 4 + k]) d++; }
      return { d, w: o.width, h: o.height };
    }, Array.from(fs.readFileSync(f)), Array.from(b));
    return [r.w === 40 && r.h === 60 && r.d === 0, K.j(r)];
  }));
  claim(RF, 'dfaq', 'Mirroring both ways at once equals a 180° turn.', 'flip H + V is pixel for pixel a 180° turn', B, async () => within(RF, async (p) => {
    const f = await pngFile(p, 'rf-c.png', 60, 40, NOISE);
    await K.img.set(p, 'flipH', 'yes'); await K.img.set(p, 'flipV', 'yes');
    await K.img.upload(p, [f]);
    const [a] = await K.img.results(p);
    await K.img.change(p, 'flipH', 'no'); await K.img.change(p, 'flipV', 'no'); await K.img.change(p, 'angle', 180);
    const [b] = await K.img.results(p);
    const same = await p.evaluate(async (a1, a2) => { const dec = async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; }; const x = await dec(a1), y = await dec(a2); let d = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i] - y[i]) > 1) d++; return d; }, Array.from(a), Array.from(b));
    return [same === 0, same + ' channel values differ'];
  }));
  claim(RF, 'point', 'Several images dropped together get the same settings and download as one ZIP.', 'two images: two results and a ZIP button', B, async () => within(RF, async (p) => {
    await K.img.set(p, 'angle', 90);
    await K.img.upload(p, [S('food.jpg'), S('pet.jpg')]);
    const r = await K.img.results(p);
    const z = await p.$$eval('.tool-io button', (l) => l.some((b) => /as ZIP/.test(b.textContent)));
    const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    return [r.length === 2 && z && d.every((x) => x.w === 1067 && x.h === 1600), r.length + ' results ' + d.map((x) => x.w + '×' + x.h).join(',') + ', ZIP ' + z];
  }));
  /* the FAQ's and the worked example's figures, from one run on landscape.jpg */
  const rfSizes = () => K.once('img:rf-sizes', () => within(RF, async (p) => {
    const r = {};
    await K.img.set(p, 'angle', -4);
    await K.img.upload(p, [S('landscape.jpg')]);
    [r.tilt] = await K.img.results(p); r.tiltDim = await K.img.pixels(p, r.tilt);
    await K.img.change(p, 'format', 'image/jpeg');
    r.q = await p.$eval('#ic-quality', (e) => e.value);
    [r.tiltJpg] = await K.img.results(p);
    await K.img.change(p, 'angle', 0); await K.img.change(p, 'flipH', 'yes');
    [r.mirJpg] = await K.img.results(p); r.mirDim = await K.img.pixels(p, r.mirJpg);
    await K.img.change(p, 'format', 'image/png');
    [r.mir] = await K.img.results(p);
    return r;
  }));
  claim(RF, 'dfaq', 'the 215.5 KB landscape JPEG above, mirrored, became 2.31 MB. Pick JPEG under Save as, quality 92, and it was 254.6 KB.', 'landscape.jpg mirrored, PNG then JPEG 92', B, async () => {
    const r = await rfSizes();
    const src = fmtKB(fs.statSync(S('landscape.jpg')).size);
    return [src === '215.5 KB' && r.q === '92' && K.isPng(r.mir) && near(r.mir.length, '2.31 MB') && K.isJpeg(r.mirJpg) && near(r.mirJpg.length, '254.6 KB'),
      'source ' + src + ', PNG ' + fmtKB(r.mir.length) + ', JPEG ' + r.q + ' ' + fmtKB(r.mirJpg.length) + ' (2% allowed)'];
  });
  claim(RF, 'what', 'by −4° produced a 1670×1172 canvas: the picture plus four white wedges in the corners, which a crop then has to remove. As a PNG it weighed 2.49 MB; saved as JPEG at 92, 288.2 KB. A plain horizontal mirror kept the size at 1600×1063 and weighed 2.31 MB as PNG, 254.6 KB as JPEG',
    'landscape.jpg at −4° and mirrored, PNG and JPEG 92', B, async () => {
      const r = await rfSizes();
      const ok = r.tiltDim.w === 1670 && r.tiltDim.h === 1172 && near(r.tilt.length, '2.49 MB') && near(r.tiltJpg.length, '288.2 KB') &&
        r.mirDim.w === 1600 && r.mirDim.h === 1063 && near(r.mir.length, '2.31 MB') && near(r.mirJpg.length, '254.6 KB');
      return [ok, '−4°: ' + r.tiltDim.w + '×' + r.tiltDim.h + ' PNG ' + fmtKB(r.tilt.length) + ', JPEG ' + fmtKB(r.tiltJpg.length) + '; mirror: ' + r.mirDim.w + '×' + r.mirDim.h + ' PNG ' + fmtKB(r.mir.length) + ', JPEG ' + fmtKB(r.mirJpg.length) + ' (2% allowed)'];
    });

  /* ================================================================ */
  /* splitter                                                          */
  /* ================================================================ */
  const SPL = '/image/image-splitter/';
  claim(SPL, 'works', 'Tile size is the picture\'s size divided by the grid and rounded down: floor(width ÷ columns) by floor(height ÷ rows).', '3×3 of 1600×1067 → 533×355 tiles', B, async () => within(SPL, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    const r = await K.img.results(p); const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    return [r.length === 9 && d.every((x) => x.w === 533 && x.h === 355), r.length + ' tiles, ' + [...new Set(d.map((x) => x.w + '×' + x.h))].join(',')];
  }));
  claim(SPL, 'point', 'Each tile is copied with drawImage from its own rectangle of the original, so tiles meet exactly, unscaled and without overlap.', 'PNG tiles of a noise image match the source exactly', B, async () => within(SPL, async (p) => {
    const f = await pngFile(p, 'spl.png', 90, 60, NOISE);
    await K.img.set(p, 'format', 'image/png');
    await K.img.upload(p, [f]);
    const r = await K.img.results(p);
    const d = await p.evaluate(async (src, tiles) => {
      const dec = async (arr) => { const bm = await createImageBitmap(new Blob([new Uint8Array(arr)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height); };
      const s = await dec(src); let diff = 0;
      for (let t = 0; t < tiles.length; t++) { const o = await dec(tiles[t]); const r0 = Math.floor(t / 3), c0 = t % 3; for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) for (let k = 0; k < 4; k++) if (o.data[(y * o.width + x) * 4 + k] !== s.data[((y + r0 * 20) * 90 + x + c0 * 30) * 4 + k]) diff++; }
      return diff;
    }, Array.from(fs.readFileSync(f)), r.map((b) => Array.from(b)));
    return [r.length === 9 && d === 0, r.length + ' tiles, ' + d + ' values differ'];
  }));
  claim(SPL, 'point', 'Tiles are JPEG at a fixed quality of 90, or PNG, named r1c1, r1c2 and so on, and download together as a ZIP.', 'ZIP of JPEGs named …-r1c1.jpg … r3c3', B, async () => within(SPL, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    await K.clearDownloads(p);
    if (!await K.clickText(p, '.tool-io button', /as ZIP/)) return [false, 'no ZIP button'];
    await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
    const [d] = await K.downloads(p);
    const z = K.zipNames(d.bytes);
    return [z.length === 9 && z[0].name === 'food-r1c1.jpg' && z[8].name === 'food-r3c3.jpg' && z.every((x) => K.isJpeg(x.data)) && !(await p.$('#ic-quality')), z.map((x) => x.name).join(',')];
  }));
  claim(SPL, 'dfaq', 'The custom boxes go up to 12 columns and 12 rows, 144 tiles in all.', 'columns and rows max 12', B, async () => within(SPL, async (p) => {
    const m = await p.evaluate(() => [document.getElementById('ic-cols').max, document.getElementById('ic-rows').max]);
    return [m.join() === '12,12', m.join()];
  }));
  claim(SPL, 'point', 'Presets set the grid: 3 or 2 carousel panels, a 3×3 mosaic or two halves', 'the 3-panel carousel preset gives 3 tiles in a row', B, async () => within(SPL, async (p) => {
    await K.img.set(p, 'preset', 'carousel3');
    await K.img.upload(p, [S('food.jpg')]);
    const r = await K.img.results(p); const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    return [r.length === 3 && d.every((x) => x.w === 533 && x.h === 1067), r.length + ' tiles ' + d.map((x) => x.w + '×' + x.h).join(',')];
  }));

  /* ================================================================ */
  /* image to Base64                                                   */
  /* ================================================================ */
  const B64 = '/image/image-to-base64/';
  const codeOut = (p) => p.$eval('.tool-io pre.code-out', (e) => e.textContent);
  claim(B64, 'works', 'The file is read byte for byte with FileReader.readAsArrayBuffer and never redrawn, so the text decodes back to an identical copy of it.', 'raw Base64 of food.jpg decodes to the same bytes', B, async () => within(B64, async (p) => {
    await K.img.set(p, 'wrap', 'raw');
    await K.img.upload(p, [S('pet.jpg')]);
    await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); });
    await K.clickText(p, '.tool-io button.btn-copy', /Copy/);
    const t = await p.evaluate(() => window.__copied);
    return [Buffer.from(t || '', 'base64').equals(fs.readFileSync(S('pet.jpg'))), (t || '').length + ' characters copied'];
  }));
  claim(B64, 'point', 'The preview stops at 40,000 characters to stay responsive; Copy always takes the full value.', 'preview cut at 40,000, Copy gives all of it', B, async () => within(B64, async (p) => {
    await K.img.upload(p, [S('pet.jpg')]);
    await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } } }); });
    const pre = await codeOut(p);
    await K.clickText(p, '.tool-io button.btn-copy', /Copy/);
    const full = await p.evaluate(() => window.__copied);
    return [/truncated/.test(pre) && pre.indexOf('\n') === 40000 && full.length > 300000 && full.startsWith('data:image/jpeg;base64,'), 'preview ' + pre.length + ' chars, copied ' + (full || '').length];
  }));
  claim(B64, 'point', 'The prefix uses the type the browser reports for the file (file.type), such as image/svg+xml, falling back to image/png.', 'an SVG gives data:image/svg+xml', B, async () => within(B64, async (p) => {
    await K.img.upload(p, [K.write('b64.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')]);
    const t = await codeOut(p);
    return [/^data:image\/svg\+xml;base64,/.test(t), t.slice(0, 40)];
  }));
  claim(B64, 'point', 'Output can be a data URI, a CSS background-image rule, an HTML <img> tag or bare Base64.', 'the four wraps', B, async () => within(B64, async (p) => {
    await K.img.upload(p, [K.write('b64.gif', Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'))]);
    const out = [];
    for (const w of ['datauri', 'css', 'html', 'raw']) {
      const was = await codeOut(p);
      await K.img.set(p, 'wrap', w);
      if (w !== 'datauri') await p.waitForFunction((was) => document.querySelector('.tool-io pre.code-out') && document.querySelector('.tool-io pre.code-out').textContent !== was, { timeout: 10000 }, was);
      out.push((await codeOut(p)).slice(0, 40));
    }
    return [/^data:image\/gif;base64,/.test(out[0]) && /^background-image: url\("data:/.test(out[1]) && /^<img src="data:/.test(out[2]) && /^R0lGOD/.test(out[3]), out.join(' | ')];
  }));
  claim(B64, 'dfaq', 'The bytes are not converted, so a GIF stays a GIF inside the data URI.', 'a GIF gives data:image/gif', B, async () => within(B64, async (p) => {
    await K.img.upload(p, [K.write('b64b.gif', Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'))]);
    const t = await codeOut(p);
    return [t === 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', t];
  }));
  claim(B64, 'tip', 'Base64 inflates data by roughly 33%', 'overhead row reads +33%', B, async () => within(B64, async (p) => {
    await K.img.upload(p, [S('pet.jpg')]);
    const o = K.img.stat(await K.img.stats(p), 'Overhead'); return [o === '+33%', o];
  }));

  /* ================================================================ */
  /* image to PDF                                                      */
  /* ================================================================ */
  const IP = '/image/image-to-pdf/';
  const makePdf = async (p, files, set) => {
    if (set) for (const k of Object.keys(set)) await K.img.set(p, k, set[k]);
    await K.clearDownloads(p);
    const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(...files);
    await p.waitForFunction(() => [...document.querySelectorAll('.tool-io .io-actions .btn-primary')].some((b) => /Download PDF/.test(b.textContent)), { timeout: 30000 });
    await K.sleep(300);
    await K.clickText(p, '.tool-io .io-actions .btn-primary', /Download PDF/);
    await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
    const [d] = await K.downloads(p);
    return d.bytes;
  };
  claim(IP, 'tip', 'A JPEG goes into the PDF as it is: its own compressed bytes are the page image (the PDF DCTDecode filter), so it loses nothing.', 'the JPEG\'s bytes are inside the PDF', B, async () => within(IP, async (p) => {
    const pdf = await makePdf(p, [S('document.jpg')]);
    return [pdf.includes(fs.readFileSync(S('document.jpg'))) && /DCTDecode/.test(pdf.toString('latin1')), pdf.length + ' bytes'];
  }));
  claim(IP, 'point', 'Each image fits inside the margin (28 points by default) or fills the page', 'on A4 portrait the image spans the width less 28 pt each side', B, async () => within(IP, async (p) => {
    const pdf = await makePdf(p, [S('document.jpg')]);
    const a = await K.analyse(pdf); const c = await a.content(0);
    const m = /([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(c);
    if (!m) return [false, c.slice(0, 120)];
    const [w, h, x, y] = m.slice(1, 5).map(Number);
    const mb = a.pages[0].dict.MediaBox;
    const inside = x >= 27.5 && y >= 27.5 && x + w <= mb[2] - 27.5 && y + h <= mb[3] - 27.5;
    const centred = Math.abs(x - (mb[2] - w) / 2) < 0.5 && Math.abs(y - (mb[3] - h) / 2) < 0.5;
    const touches = Math.abs(x - 28) < 0.5 || Math.abs(y - 28) < 0.5;
    return [inside && centred && touches, 'image ' + w.toFixed(1) + '×' + h.toFixed(1) + ' at ' + x.toFixed(1) + ',' + y.toFixed(1) + ' on ' + mb.map((v) => Math.round(v)).join(' ')];
  }));
  claim(IP, 'point', '"Fit to image" makes the page one point per pixel.', 'a 1600×1067 JPEG gives a 1600×1067 pt page', B, async () => within(IP, async (p) => {
    const pdf = await makePdf(p, [S('food.jpg')], { pageSize: 'fit' });
    const mb = (await K.analyse(pdf)).pages[0].dict.MediaBox.map(Math.round).join(' ');
    return [mb === '0 0 1600 1067', mb];
  }));
  claim(IP, 'point', 'The result has no title, bookmarks or text layer.', 'no Info Title, no Outlines, no text', B, async () => within(IP, async (p) => {
    const a = await K.analyse(await makePdf(p, [S('food.jpg')]));
    return [!a.info.Title && a.root.Outlines === undefined && !/ Tj| TJ/.test(await a.content(0)), K.j(a.info) + ', outlines ' + (a.root.Outlines ? 'yes' : 'no')];
  }));
  claim(IP, 'tip', 'Drag the thumbnails to reorder, turn a single page with ⟲ or ⟳, and name the file yourself.', 'two images: "Move up" on the second puts it first', B, async () => within(IP, async (p) => {
    const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(S('food.jpg'), S('document.jpg'));
    await p.waitForSelector('.file-list .file-row button[title="Move up"]', { timeout: 30000 });
    const up = await p.$$('.file-list .file-row button[title="Move up"]');
    await up[1].click();
    await K.sleep(800);
    const first = await p.$eval('.file-list .file-row .file-name', (e) => e.textContent);
    return [first === 'document.jpg', 'first is now ' + first];
  }));
  claim(IP, 'point', '"Match each image" turns pages landscape for wide images', 'a wide photo on A4 auto: an 842×595 page', B, async () => within(IP, async (p) => {
    const mb = (await K.analyse(await makePdf(p, [S('food.jpg')]))).pages[0].dict.MediaBox.map(Math.round).join(' ');
    return [mb === '0 0 842 595', mb];
  }));

  /* ================================================================ */
  /* meme                                                              */
  /* ================================================================ */
  const MG = '/image/meme-generator/';
  claim(MG, 'point', 'Font size is a percentage of the picture’s height, in Anton unless you choose Impact (where the device has it), Bebas Neue, Comic Neue or Permanent Marker.', 'size 10 on a 500 px picture asks for 50px Anton; Impact when chosen', N, async () => {
    const f = (opts) => (paintIn('img-meme-generator.js', 'meme-generator', 800, 500, opts).find((x) => x[0] === '=font') || [])[1];
    const a = f({ size: 10 }), b = f({ size: 10, font: 'impact' });
    return [/50px "?Anton"?/.test(a) && /50px "?Impact"?|50px Impact/.test(b), a + ' | ' + b];
  });
  claim(MG, 'point', 'The text is capitalised if "Force uppercase" is on, then broken at spaces into lines no wider than 94% of the picture.', 'caps on: drawn upper-case; lines fit 94%', N, async () => {
    const log = paintIn('img-meme-generator.js', 'meme-generator', 400, 400, { top: 'one two three four five six seven eight', bottom: '', caps: 'yes', size: 10 });
    const lines = log.filter((x) => x[0] === 'fillText').map((x) => x[1]);
    const w = (s) => s.length * 20;
    return [lines.length > 1 && lines.every((l) => l === l.toUpperCase() && (w(l) <= 376 || !/ /.test(l))), K.j(lines)];
  });
  claim(MG, 'point', 'Each line is stroked in the outline colour, 12% of the font size by default, then filled in the text colour on top.', 'stroke before fill, line width 12% of 50', N, async () => {
    const log = paintIn('img-meme-generator.js', 'meme-generator', 800, 500, { size: 10, outline: '#123456', color: '#abcdef' });
    const lw = (log.find((x) => x[0] === '=lineWidth') || [])[1];
    const i = log.findIndex((x) => x[0] === 'strokeText'), j = log.findIndex((x) => x[0] === 'fillText');
    const ss = (log.find((x) => x[0] === '=strokeStyle') || [])[1], fs2 = (log.find((x) => x[0] === '=fillStyle') || [])[1];
    return [Math.abs(lw - 6) < 1e-9 && i >= 0 && i < j && ss === '#123456' && fs2 === '#abcdef', 'lineWidth ' + lw + ', stroke at ' + i + ', fill at ' + j];
  });
  claim(MG, 'point', 'Drag any caption, add more text boxes and image stickers, and save PNG (the default), JPEG or WebP at the picture’s own size.', 'food.jpg stays 1600×1067, PNG', B, async () => within(MG, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [K.isPng(b) && d.w === 1600 && d.h === 1067, K.kind(b) + ' ' + d.w + '×' + d.h];
  }));
  claim(MG, 'dfaq', 'Leave the bottom box empty and nothing is drawn there', 'empty bottom: no text drawn for it', N, async () => {
    const log = paintIn('img-meme-generator.js', 'meme-generator', 800, 500, { top: 'TOP', bottom: '' });
    const t = log.filter((x) => x[0] === 'fillText');
    return [t.length === 1 && t[0][1] === 'TOP', K.j(t.map((x) => [x[1], Math.round(x[3])]))];
  });

  /* ================================================================ */
  /* passport photo                                                    */
  /* ================================================================ */
  const PP = '/image/passport-photo/';
  const presets = () => K.once('img:presets', () => within(PP, (p) => p.evaluate(() => (window.MVRPassportPresets || []).map((x) => ({ id: x.id, name: x.name, w: x.w, h: x.h, source: x.source })))));
  const sheetCopies = (caps, re) => { const c = caps.find((x) => re.test(x)) || ''; return (c.match(/(\d+) copies/) || [])[1]; };
  claim(PP, 'works', 'The tool holds 43 documents with their sizes at 300 DPI; all but a generic stamp size name the issuer’s page.', 'the preset table: 43 documents, each with an https source and a size; the Source row names it', B, async () => within(PP, async (p) => {
    const ps = await presets();
    const bad = ps.filter((x) => !(/^https?:\/\//.test(x.source || '') || x.id === 'stamp') || !(x.w > 0 && x.h > 0));
    await K.img.upload(p, [S('portrait.jpg')]); await idle(p);
    const row = K.img.stat(await K.img.stats(p), 'Source of these sizes') || '';
    return [ps.length === 43 && !bad.length && row.length > 0, ps.length + ' presets, ' + bad.length + ' without a source; Source row: ' + row];
  }));
  claim(PP, 'dfaq', 'At 300 DPI, 35×45 mm is 413×531 pixels.', 'the UK preset\'s photo', B, async () => within(PP, async (p) => {
    await K.img.set(p, 'preset', 'uk-passport'); await K.img.set(p, 'sheet', 'single');
    await K.img.upload(p, [S('portrait.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 413 && d.h === 531, d.w + '×' + d.h];
  }));
  claim(PP, 'dfaq', 'Here, 8 at 35×45 mm on a 6×4 inch sheet and 30 on A4, but only 2 of India’s 51×51 mm photos on the 6×4.', 'copies per sheet: UK 8 on 6×4 and 30 on A4, the India 2×2 in 2 on 6×4', B, async () => within(PP, async (p) => {
    await K.img.set(p, 'sheet', 'all'); await K.img.set(p, 'preset', 'uk-passport');
    await K.img.upload(p, [S('portrait.jpg')]); await idle(p);
    const uk = await K.img.caps(p);
    await K.img.change(p, 'preset', 'in-2x2'); await idle(p);
    const ind = await K.img.caps(p);
    const out = [sheetCopies(uk, /6×4/), sheetCopies(uk, /A4/), sheetCopies(ind, /6×4/)];
    return [out.join() === '8,30,2', out.join()];
  }));
  claim(PP, 'point', 'The print sheet is 6×4 inches (1800×1200) or A4 (2480×3508), with as many copies as fit and thin cutting lines.', 'the 6×4 sheet is 1800×1200 and the A4 sheet 2480×3508', B, async () => within(PP, async (p) => {
    await K.img.set(p, 'sheet', 'all');
    await K.img.upload(p, [S('portrait.jpg')]); await idle(p);
    const r = await K.img.results(p);
    const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    const dims = d.map((x) => x.w + '×' + x.h).join();
    return [dims === '602×602,1800×1200,2480×3508', dims];
  }));
  claim(PP, 'point', 'Files are JPEG or PNG and say 300 DPI inside; “under N KB” finds the highest JPEG quality that fits.', 'JPEG with 300 DPI in JFIF; PNG with pHYs 11811; a 50 KB limit gives a JPEG under 50,000 bytes', B, async () => within(PP, async (p) => {
    await K.img.set(p, 'preset', 'uk-passport'); await K.img.set(p, 'sheet', 'single');
    await K.img.upload(p, [S('portrait.jpg')]);
    const [b] = await K.img.results(p);
    const sg = K.jpegSegs(b).find((x) => x.m === 0xe0);
    const jfif = !!sg && sg.body[7] === 1 && sg.body.readUInt16BE(8) === 300;
    await K.img.change(p, 'format', 'image/png');
    const [png] = await K.img.results(p);
    const at = png.indexOf('pHYs');
    const phys = at > 0 && png.readUInt32BE(at + 4) === 11811;
    await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'target', '50');
    const [small] = await K.img.results(p);
    return [K.isJpeg(b) && jfif && K.isPng(png) && phys && K.isJpeg(small) && small.length <= 50000 && small.length > 25000, 'JFIF 300 ' + jfif + ', pHYs 11811 ' + phys + ', under 50 KB: ' + small.length + ' bytes'];
  }));
  claim(PP, 'what', 'From a 1600×1067 portrait, the UK preset gave a 413×531 single photo of 79.7 KB as JPEG and 288.4 KB as PNG. The 6×4 sheet held 8 copies and weighed 671.4 KB; the A4 sheet held 30 copies at 2480×3508 and weighed 2.45 MB. With a limit of 50 KB the JPEG came to 45.1 KB at quality 89. India’s 602×602 square fitted 2 copies on a 6×4 sheet.',
    'portrait.jpg, UK preset: JPEG, PNG, the two sheets and a 50 KB limit', B, async () => within(PP, async (p) => {
      await K.img.set(p, 'preset', 'uk-passport'); await K.img.set(p, 'sheet', 'all');
      await K.img.upload(p, [S('portrait.jpg')]); await idle(p);
      const r = await K.img.results(p);
      const jpgSingle = r[0], six = r[1], a4 = r[2];
      await K.img.change(p, 'format', 'image/png'); await idle(p);
      const png = (await K.img.results(p))[0];
      await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'sheet', 'single'); await K.img.change(p, 'target', '50'); await idle(p);
      const [small] = await K.img.results(p);
      const cap = (await K.img.caps(p))[0] || '';
      return [near(jpgSingle.length, '79.7 KB') && near(png.length, '288.4 KB') && near(six.length, '671.4 KB') && near(a4.length, '2.45 MB') && near(small.length, '45.1 KB') && /quality 89/.test(cap),
        'JPEG ' + fmtKB(jpgSingle.length) + ', PNG ' + fmtKB(png.length) + ', 6×4 ' + fmtKB(six.length) + ', A4 ' + fmtKB(a4.length) + ', under 50 KB ' + fmtKB(small.length) + ' [' + cap + '] (2% allowed)'];
    }));

  /* ================================================================ */
  /* photo filters                                                     */
  /* ================================================================ */
  const PF = '/image/photo-filters/';
  /* since wave 1 the filters are worked on the pixels (engine/img-filters-core.mjs); the reference here is
     Chrome's own CSS filter on a canvas, a separate implementation of the same Filter Effects maths */
  const openWith = async (url, init) => {
    const orig = K.browser.newPage;
    K.browser.newPage = async function () { const p = await orig.call(this); await freshPage(p); if (init) await p.evaluateOnNewDocument(init); return p; };
    try { return await K.open(url); } finally { K.browser.newPage = orig; }
  };
  /* the page's PNG result and Chrome's ctx.filter of the same picture, compared pixel by pixel */
  const pfVsCss = (set, css) => within(PF, async (p) => {
    const f = await pngFile(p, 'pf-noise.png', 160, 120, NOISE);
    for (const k of Object.keys(set)) await K.img.set(p, k, set[k]);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    return p.evaluate(async (res, src, css) => {
      const dec = async (u8) => { const bm = await createImageBitmap(new Blob([new Uint8Array(u8)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); return { c, x, bm }; };
      const r = await dec(res); r.x.drawImage(r.bm, 0, 0);
      const s = await dec(src); s.x.filter = css; s.x.drawImage(s.bm, 0, 0);
      const a = r.x.getImageData(0, 0, r.c.width, r.c.height).data, e = s.x.getImageData(0, 0, s.c.width, s.c.height).data;
      let worst = 0; for (let i = 0; i < a.length; i++) if ((i & 3) !== 3) worst = Math.max(worst, Math.abs(a[i] - e[i]));
      return worst;
    }, Array.from(b), Array.from(fs.readFileSync(f)), css);
  });
  claim(PF, 'point', 'Presets are the Filter Effects colour matrices: Black & white is grayscale at 1, sepia 0.85, and Cool and Warm turn the hue by −12° and +12°.', 'each preset within 2 levels of Chrome’s own CSS filter', B, async () => {
    const w = [await pfVsCss({ preset: 'grayscale' }, 'grayscale(1)'), await pfVsCss({ preset: 'sepia' }, 'sepia(0.85)'),
      await pfVsCss({ preset: 'cool' }, 'hue-rotate(-12deg) saturate(1.15) brightness(1.02)'), await pfVsCss({ preset: 'warm' }, 'hue-rotate(12deg) saturate(1.2) brightness(1.04)')];
    return [w.every((x) => x <= 2), 'largest difference per preset (levels): ' + w.join(', ')];
  });
  claim(PF, 'point', 'Preset strength mixes the filtered picture with the original, so 40% keeps 60% of each pixel as it was.', 'grayscale at 40% = 0.6 × original + 0.4 × Chrome’s grayscale(1)', B, async () => within(PF, async (p) => {
    const f = await pngFile(p, 'pf-noise.png', 160, 120, NOISE);
    await K.img.set(p, 'preset', 'grayscale'); await K.img.set(p, 'intensity', 40);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const worst = await p.evaluate(async (res, src) => {
      const load = async (u8, css) => { const bm = await createImageBitmap(new Blob([new Uint8Array(u8)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); if (css) x.filter = css; x.drawImage(bm, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const r = await load(res), o = await load(src), g = await load(src, 'grayscale(1)');
      let w = 0; for (let i = 0; i < r.length; i++) if ((i & 3) !== 3) w = Math.max(w, Math.abs(r[i] - (0.6 * o[i] + 0.4 * g[i])));
      return w;
    }, Array.from(b), Array.from(fs.readFileSync(f)));
    return [worst <= 2, 'largest difference ' + worst.toFixed(2) + ' levels'];
  }));
  claim(PF, 'point', 'Exposure doubles the light per stop', 'a flat grey of 100 at +1 stop: sRGB → linear × 2 → sRGB, worked here = 137', B, async () => within(PF, async (p) => {
    const f = await pngFile(p, 'pf-grey.png', 40, 30, "x.fillStyle='rgb(100,100,100)';x.fillRect(0,0,w,h);");
    await K.img.set(p, 'exposure', 1);
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const d = await K.img.pixels(p, b, [[10, 10]]);
    const lin = Math.pow((100 / 255 + 0.055) / 1.055, 2.4) * 2;
    const want = Math.round((1.055 * Math.pow(lin, 1 / 2.4) - 0.055) * 255);
    return [Math.abs(d.px[0][0] - want) <= 1, 'got ' + d.px[0][0] + ', want ' + want];
  }));
  claim(PF, 'mistake', 'Dramatic already sets contrast to 1.35; contrast at 130% on top multiplies to about 1.75', '1.35 × 1.3', N, async () => [Math.abs(1.35 * 1.3 - 1.755) < 1e-9, String(1.35 * 1.3)]);
  claim(PF, 'dfaq', 'Choose the Black & white preset', 'the grayscale preset makes R = G = B', B, async () => within(PF, async (p) => {
    await K.img.set(p, 'preset', 'grayscale');
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[100, 100], [800, 500], [1500, 1000]]);
    return [d.px.every((c) => Math.abs(c[0] - c[1]) <= 1 && Math.abs(c[1] - c[2]) <= 1), K.j(d.px)];
  }));
  claim(PF, 'point', 'The result keeps the original size, saved as PNG unless Save as says JPEG or WebP.', 'food.jpg → 1600×1067 PNG', B, async () => within(PF, async (p) => {
    await K.img.set(p, 'preset', 'sepia');
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [K.isPng(b) && d.w === 1600 && d.h === 1067, K.kind(b) + ' ' + d.w + '×' + d.h];
  }));
  claim(PF, 'dfaq', 'The page calculates them itself, so a photo filtered in Safari matches the one from Chrome.', 'with the canvas filter switched off (Safari stood in for) the pixels are the same as Chrome’s', B, async () => {
    const run = async (init) => {
      const p = await openWith(PF, init);
      try {
        const f = await pngFile(p, 'pf-noise.png', 160, 120, NOISE);
        await K.img.set(p, 'preset', 'vintage'); await K.img.set(p, 'vignette', 50);
        await K.img.upload(p, [f]);
        const [b] = await K.img.results(p);
        return await p.evaluate(async (u8) => { const bm = await createImageBitmap(new Blob([new Uint8Array(u8)])); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return Array.from(x.getImageData(0, 0, c.width, c.height).data); }, Array.from(b));
      } finally { await p.close(); }
    };
    const chrome = await run(null);
    const safari = await run(() => { Object.defineProperty(CanvasRenderingContext2D.prototype, 'filter', { get() { return 'none'; }, set() { /* Safari: no canvas filters */ }, configurable: true }); });
    let diff = 0; for (let i = 0; i < chrome.length; i++) if (chrome[i] !== safari[i]) diff++;
    return [chrome.length > 0 && diff === 0, diff + ' of ' + chrome.length + ' values differ'];
  });

  /* ================================================================ */
  /* social media resizer                                              */
  /* ================================================================ */
  const SM = '/image/social-media-resizer/';
  /* the editor fills its cards one by one: a run is over when the shell's aria-busy clears */
  const settled = async (p) => { await K.sleep(300); await p.waitForFunction(() => !document.querySelector('.tool-io[aria-busy]'), { timeout: 120000, polling: 100 }); await K.sleep(200); };
  const smTick = (p, list) => p.$$eval('.preset-list input[type=checkbox]', (l, want) => l.forEach((c) => { c.checked = want.indexOf(c.value) >= 0; c.dispatchEvent(new Event('change', { bubbles: true })); }), list);
  const social = () => K.once('img:social', () => within(SM, async (p) => {
    await K.img.upload(p, [S('food.jpg')]); await settled(p);
    const r = await K.img.results(p);
    const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    const caps = await K.img.caps(p);
    return { kinds: r.map((b) => K.kind(b)), dims: d.map((x) => x.w + '×' + x.h), caps };
  }));
  claim(SM, 'works', '16 presets cover Instagram, Facebook, X, LinkedIn, YouTube, Pinterest, TikTok, WhatsApp and the web, from a 600×200 email header to 2560×1440 channel art, dated beside the list.', 'all 16 sizes come out, smallest 600×200, largest 2560×1440; the list is dated', B, async () => {
    const s = await social();
    const label = await within(SM, (p) => p.$eval('label[for="ic-presets"]', (e) => e.textContent).catch(() => ''));
    return [s.dims.length === 16 && s.dims.indexOf('600×200') >= 0 && s.dims.indexOf('2560×1440') >= 0 && /as of \d{1,2} [A-Z][a-z]+ 20\d\d/.test(label), s.dims.length + ': ' + s.dims.join(', ') + ' / ' + label];
  });
  claim(SM, 'mistake', 'All 16 are on when the page opens', 'with nothing unticked, 16 files', B, async () => { const s = await social(); return [s.dims.length === 16, s.dims.length + ' files']; });
  claim(SM, 'point', 'A frame bigger than the photo enlarges it, and each card says by how much.', 'food.jpg (1600×1067) → 2560×1440, its card saying “enlarged 1.60×”', B, async () => { const s = await social(); const c = s.caps.find((x) => /2560×1440/.test(x)) || ''; return [s.dims.indexOf('2560×1440') >= 0 && /enlarged 1\.60×/.test(c), c]; });
  claim(SM, 'dfaq', 'What size is an Instagram story? => 1080×1920 pixels'.replace(/^.*=> /, ''), 'a 1080×1920 slot', B, async () => { const s = await social(); return [s.dims.indexOf('1080×1920') >= 0, s.dims.join(',')]; });
  claim(SM, 'point', 'Fit whole image takes the smaller factor and fills the rest with the bar colour, or with a soft, darkened copy of the photo itself.', 'contain: the story’s bars are #0a0e1a; blur: they are not that navy but darker than the photo there', B, async () => within(SM, async (p) => {
    await smTick(p, ['2']); await K.img.set(p, 'mode', 'contain'); await K.img.set(p, 'format', 'image/png');
    await K.img.upload(p, [S('food.jpg')]); await settled(p);
    let [b] = await K.img.results(p); const bars = await K.img.pixels(p, b, [[5, 5], [540, 960]]);
    await K.img.set(p, 'mode', 'blur'); await settled(p);
    [b] = await K.img.results(p); const soft = await K.img.pixels(p, b, [[5, 5], [540, 960]]);
    return [bars.w === 1080 && bars.h === 1920 && close(bars.px[0], [10, 14, 26, 255], 1) && !close(soft.px[0], [10, 14, 26, 255], 6) && close(bars.px[1], soft.px[1], 3),
      'bars ' + K.j(bars.px[0]) + ', blurred fill ' + K.j(soft.px[0]) + ', middle ' + K.j(bars.px[1]) + ' / ' + K.j(soft.px[1])];
  }));
  claim(SM, 'point', 'Fill and crop takes the larger of the two scale factors and keeps the point you clicked on the photo as near the middle as the edges allow.',
    'a 1600×1000 position-coded PNG into 1280×720, focus clicked at 20% across: the left edge is x 0 (it cannot go further), the vertical middle stays centred', B, async () => within(SM, async (p) => {
      await smTick(p, ['9']); await K.img.set(p, 'format', 'image/png');
      const f = await pngFile(p, 'sm-pos.png', 1600, 1000, "const d=x.createImageData(w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=(j*w+i)*4;d.data[k]=Math.round(i*255/(w-1));d.data[k+1]=Math.round(j*255/(h-1));d.data[k+2]=0;d.data[k+3]=255;}x.putImageData(d,0,0);");
      await K.img.upload(p, [f]); await settled(p);
      const r = await p.$eval('.sm-focus-view', (c) => { c.scrollIntoView({ block: 'center', behavior: 'instant' }); const b = c.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
      await p.mouse.click(r[0] + r[2] * 0.2, r[1] + r[3] * 0.5); await settled(p);
      const [b] = await K.img.results(p);
      const d = await K.img.pixels(p, b, [[0, 0], [1279, 719]]);
      const at = (c) => [Math.round(c[0] * 1599 / 255), Math.round(c[1] * 999 / 255)];
      /* scale 0.8 (1280/1600, the larger of 0.8 and 0.72): 1000 px tall becomes 800, so 80 px are cut top and bottom: source y 50 to 950 */
      const tl = at(d.px[0]), br = at(d.px[1]);
      return [d.w === 1280 && d.h === 720 && tl[0] <= 8 && Math.abs(tl[1] - 50) <= 8 && br[0] >= 1591 && Math.abs(br[1] - 949) <= 8, 'corners from source ' + K.j(tl) + ' to ' + K.j(br) + ' (a smooth ramp read back to within 8 px)'];
    }));
  claim(SM, 'dfaq', '1280×720 pixels, the 16:9 preset here. The 1600×1067 portrait photo above, filled and cropped, made a 210.1 KB JPEG at quality 90.', 'portrait.jpg, Fill and crop: the 1280×720 JPEG', B, async () => within(SM, async (p) => {
    await smTick(p, ['9']);
    await K.img.upload(p, [S('portrait.jpg')]); await settled(p);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [K.isJpeg(b) && d.w === 1280 && d.h === 720 && near(b.length, '210.1 KB'), K.kind(b) + ' ' + d.w + '×' + d.h + ' ' + fmtKB(b.length)];
  }));
  /* the worked example: portrait.jpg with only Instagram Story / Reel, LinkedIn Cover and YouTube Thumbnail ticked (presets 2, 8, 9) */
  const smThree = (mode, q) => K.once('img:social3:' + mode + q, () => within(SM, async (p) => {
    await smTick(p, ['2', '8', '9']);
    await K.img.set(p, 'mode', mode); await K.img.set(p, 'quality', q);
    await K.img.upload(p, [S('portrait.jpg')]); await settled(p);
    const r = await K.img.results(p);
    const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    return { files: r.map((b, i) => ({ dim: d[i].w + '×' + d[i].h, n: b.length, jpeg: K.isJpeg(b) })), total: r.reduce((s, b) => s + b.length, 0) };
  }));
  claim(SM, 'what', 'Fill and crop gave 660.9 KB in all at quality 90, the 1080×1920 story enlarged 1.80× and the 1584×396 LinkedIn cover keeping only a strip of the photo. Fit whole image kept every pixel, 484.5 KB in all; on a blurred copy instead of bars it came to 582.3 KB. At quality 75 the cropped set fell to 289.3 KB.',
    'portrait.jpg to the three slots: totals for each fitting and at quality 75', B, async () => {
      const a = await smThree('cover', 90), b = await smThree('contain', 90), c = await smThree('blur', 90), d = await smThree('cover', 75);
      const dims = (s) => s.files.map((f) => f.dim).sort().join(',');
      return [dims(a) === '1080×1920,1280×720,1584×396' && dims(b) === dims(a) && near(a.total, '660.9 KB') && near(b.total, '484.5 KB') && near(c.total, '582.3 KB') && near(d.total, '289.3 KB'),
        'fill ' + fmtKB(a.total) + ', fit ' + fmtKB(b.total) + ', blur ' + fmtKB(c.total) + ', fill at 75 ' + fmtKB(d.total) + ' (' + dims(a) + ')'];
    });

  /* ================================================================ */
  /* SVG optimiser, in Node on the shipped imagecore                   */
  /* ================================================================ */
  const SV = '/image/svg-optimizer/';
  const svgSpec = () => {
    if (!K._svg) {
      const ctx = K.context();
      for (const f of ['engine/imagecore.bundle.js', 'engine/img-svg-optimizer.js']) vm.runInContext(fs.readFileSync(path.join(K.ROOT, f), 'utf8'), ctx, { filename: f });
      K._svg = ctx.IMAGE_TOOLS['svg-optimizer'];
    }
    return K._svg;
  };
  const opt = (svg, o) => (svgSpec().transform(svg, Object.assign({ precision: '2', roundCoords: 'yes' }, o || {})) || {}).output || '';
  const DIRTY = '<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<!-- c -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 100 100" data-name="Layer 1">' +
    '<metadata>m</metadata><desc>Created with Sketch.</desc><sodipodi:namedview id="nv"/><defs></defs><g></g>' +
    '<path inkscape:label="p" d="M 10.123456 20.987654 L 30.5 40.25 C 1.111 2.222 3.333 4.444 5.555 6.666 Z" fill="#000"/></svg>';
  claim(SV, 'point', 'It deletes comments, the XML declaration, DOCTYPE, <metadata>, a "Created with" <desc>, editor elements (self-closed or not) and attributes, empty <defs> and <g> that nothing points at, and data-name.', 'each kind of clutter goes', N, async () => {
    const o = opt(DIRTY);
    const left = [['comment', /<!--/], ['declaration', /<\?xml/], ['DOCTYPE', /DOCTYPE/], ['metadata', /<metadata/], ['desc', /<desc/], ['editor element', /sodipodi:namedview/], ['editor attribute', /inkscape:label/], ['namespace', /xmlns:inkscape|xmlns:sodipodi/], ['empty defs', /<defs>\s*<\/defs>|<defs\/>/], ['empty g', /<g>\s*<\/g>|<g\/>/], ['data-name', /data-name/]].filter((x) => x[1].test(o)).map((x) => x[0]);
    return [!left.length, left.length ? 'left: ' + left.join(', ') : o];
  });
  claim(SV, 'point', 'editor elements (self-closed or not) and attributes, empty <defs> and <g> that nothing points at',
    'open and self-closed editor elements, <metadata id>, nested and attributed empty groups go; a referenced empty group and one inside <switch> stay', N, async () => {
      const s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" viewBox="0 0 10 10">' +
        '<sodipodi:namedview id="base" inkscape:zoom="2"><inkscape:grid type="xygrid" id="grid1"/></sodipodi:namedview><metadata id="metadata5"><rdf:RDF/></metadata>' +
        '<defs id="defs2"/><g id="g9"/><g transform="translate(1,1)">\n  <g>\n  </g>\n</g><g id="kept"></g><use xlink:href="#kept"/>' +
        '<switch><g systemLanguage="xx"><rect width="1" height="1"/></g><g></g><rect width="2" height="2"/></switch><sodipodi:guide position="1,1"/><rect width="10" height="10"/></svg>';
      const o = opt(s);
      const bad = [['editor element', /sodipodi:|inkscape:/], ['metadata', /<metadata|rdf:/], ['empty defs', /<defs/], ['empty group with an unreferenced id or a transform', /id="g9"|translate/]].filter((x) => x[1].test(o)).map((x) => x[0] + ' left');
      if (o.indexOf('<g id="kept"></g>') < 0) bad.push('the referenced empty group went');
      if (!/<switch><g systemLanguage="xx">.*?<\/g><g><\/g><rect/.test(o)) bad.push('the empty group inside <switch> went');
      if (/xmlns:(sodipodi|inkscape|rdf)/.test(o)) bad.push('editor namespace left');
      if (o.indexOf('<rect width="10" height="10"/>') < 0) bad.push('the artwork after the editor elements went');
      return [!bad.length, bad.length ? bad.join('; ') + ': ' + o : o];
    });
  /* real-shaped editor files, run on the live page's own engine and checked by Chrome: each output must parse as
     image/svg+xml (DOMParser, strict XML) and, with rounding off, draw the same pixels as the original */
  const SV_FILES = {
    'Inkscape 1.x, self-closed namedview': '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<!-- Created with Inkscape (http://www.inkscape.org/) -->\n<svg width="64" height="64" viewBox="0 0 16.933333 16.933333" version="1.1" id="svg5" inkscape:version="1.2.2" sodipodi:docname="star.svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:cc="http://creativecommons.org/ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <sodipodi:namedview id="namedview7" pagecolor="#ffffff" inkscape:zoom="11.313708" inkscape:current-layer="layer1" />\n  <defs id="defs2">\n    <linearGradient inkscape:collect="always" id="linearGradient1"><stop style="stop-color:#ff7a00;stop-opacity:1;" offset="0" id="stop1" /><stop style="stop-color:#ffd000;stop-opacity:1;" offset="1" id="stop2" /></linearGradient>\n    <linearGradient inkscape:collect="always" xlink:href="#linearGradient1" id="linearGradient3" x1="2.1166666" y1="2.1166666" x2="14.816667" y2="14.816667" gradientUnits="userSpaceOnUse" />\n  </defs>\n  <metadata id="metadata5"><rdf:RDF><cc:Work rdf:about=""><dc:format>image/svg+xml</dc:format></cc:Work></rdf:RDF></metadata>\n  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">\n    <path sodipodi:type="star" style="fill:url(#linearGradient3);stroke:#7a3b00;stroke-width:0.264583" id="path1" d="M 8.4666662,1.8520833 10.29,6.4302083 15.20,6.7833333 11.420833,9.9583333 12.6,14.7 8.4666662,12.170833 4.3333333,14.7 5.5125,9.9583333 1.7333333,6.7833333 6.6433333,6.4302083 Z" />\n    <g id="g9" />\n  </g>\n</svg>\n',
    'Inkscape 0.92, open namedview with a grid, text': '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="120" height="60" viewBox="0 0 120 60" version="1.1" id="svg8">\n  <defs id="defs2" />\n  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="2.8" showgrid="true">\n    <inkscape:grid type="xygrid" id="grid815" />\n  </sodipodi:namedview>\n  <metadata id="metadata5"><rdf:RDF><cc:Work rdf:about=""><dc:format>image/svg+xml</dc:format></cc:Work></rdf:RDF></metadata>\n  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1">\n    <rect style="fill:#2a7fff;stroke:none" id="rect10" width="110.5" height="50.25" x="4.75" y="4.875" ry="6.0000001" />\n    <text xml:space="preserve" style="font-size:16px;font-family:sans-serif;fill:#ffffff" x="14.5" y="36.25" id="text12"><tspan sodipodi:role="line" id="tspan14" x="14.5" y="36.25">Hello</tspan> <tspan id="tspan16">world</tspan></text>\n  </g>\n</svg>\n',
    'Illustrator, DOCTYPE entities and i:pgf': '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 16.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [\n\t<!ENTITY ns_extend "http://ns.adobe.com/Extensibility/1.0/">\n\t<!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/">\n\t<!ENTITY ns_graphs "http://ns.adobe.com/Graphs/1.0/">\n]>\n<svg version="1.1" id="Layer_1" xmlns:x="&ns_extend;" xmlns:i="&ns_ai;" xmlns:graph="&ns_graphs;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="100px" height="100px" viewBox="0 0 100 100" xml:space="preserve">\n<switch>\n\t<foreignObject requiredExtensions="&ns_ai;" x="0" y="0" width="1" height="1">\n\t\t<i:pgfRef  xlink:href="#adobe_illustrator_pgf">\n\t\t</i:pgfRef>\n\t</foreignObject>\n\t<g i:extraneous="self">\n\t\t<radialGradient id="SVGID_1_" cx="50" cy="50" r="45.5" gradientUnits="userSpaceOnUse"><stop  offset="0" style="stop-color:#FFFFFF"/><stop  offset="1" style="stop-color:#006837"/></radialGradient>\n\t\t<circle fill="url(#SVGID_1_)" stroke="#000000" stroke-miterlimit="10" cx="50" cy="50" r="45.5"/>\n\t\t<g>\n\t\t</g>\n\t</g>\n</switch>\n<i:pgf  id="adobe_illustrator_pgf">\n\t<![CDATA[\n\teJzsvWuTHMd1IPrdEf4PtR9uhOS9aFU+qjJLc2MjOAOM1rsioaCkkHy1GxM9IhzorWUbf8Mn2G7n\n\t]]>\n</i:pgf>\n</svg>\n'
  };
  claim(SV, 'point', 'Editor namespaces go once unused, so the XML stays well-formed.','Inkscape (self-closed and open namedview) and Illustrator files: Chrome parses every output as XML, and with rounding off it draws the same pixels', B, async () => within(SV, async (p) => {
    const rows = await p.evaluate(async (files) => {
      const spec = window.IMAGE_TOOLS['svg-optimizer'];
      const parse = (s) => { const d = new DOMParser().parseFromString(s, 'image/svg+xml'); const e = d.getElementsByTagName('parsererror')[0]; return e ? e.textContent.replace(/\s+/g, ' ').slice(0, 120) : ''; };
      const draw = (s) => new Promise((ok) => {
        const img = new Image();
        img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 120, 120); ok(g.getImageData(0, 0, 120, 120).data); };
        img.onerror = () => ok(null);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      });
      const out = [];
      for (const name of Object.keys(files)) {
        const src = files[name];
        const def = spec.transform(src, { precision: '2', roundCoords: 'yes' }).output;
        const raw = spec.transform(src, { precision: '2', roundCoords: 'no' }).output;
        const a = await draw(src), b = await draw(raw);
        let diff = a && b ? 0 : -1;
        if (a && b) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
        let ink = 0; if (a) for (let i = 3; i < a.length; i += 4) if (a[i]) ink++;
        out.push({ name, err: parse(def) || parse(raw), diff, ink, size: src.length + ' → ' + def.length + ' B' });
      }
      return out;
    }, SV_FILES);
    const bad = rows.filter((r) => r.err || r.diff !== 0 || !r.ink);
    return [!bad.length, rows.map((r) => r.name + ': ' + (r.err ? 'NOT XML (' + r.err + ')' : 'parses') + ', ' + (r.diff === 0 ? 'same pixels' : r.diff + ' channel values differ') + ', ' + r.size).join('; ')];
  }));
  claim(SV, 'lede', 'Strip editor metadata and shrink SVG files without touching the artwork.', 'an Inkscape file with a self-closed <sodipodi:namedview/> stays well-formed XML', N, async () => {
    const s = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="0 0 10 10"><sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1"/><rect width="10" height="10" fill="#c00"/></svg>';
    const o = opt(s);
    const prefixes = [...new Set((o.match(/<\/?([A-Za-z][\w-]*):/g) || []).map((x) => x.replace(/[</:]/g, '')))];
    const unbound = prefixes.filter((pf) => pf !== 'xml' && o.indexOf('xmlns:' + pf + '=') < 0);
    return [!unbound.length, unbound.length ? 'elements with the prefix ' + unbound.join(', ') + ' are left but its xmlns is removed, so the file no longer parses as XML: ' + o : 'well-formed'];
  });
  claim(SV, 'point', 'With rounding on, decimal numbers inside tags are rounded to the chosen precision, 2 by default.', '10.123456 → 10.12', N, async () => {
    const o = opt(DIRTY); const d = (o.match(/d="([^"]+)"/) || [])[1];
    return [/M\s*10\.12\s*20\.99/.test(d || '') && !/\.\d{3}/.test(d || ''), d];
  });
  claim(SV, 'tip', 'Optimising an already-optimised file changes nothing further, so it is safe to run twice.', 'a second pass is identical', N, async () => {
    const a = opt(DIRTY), b = opt(a); return [a === b, a === b ? 'identical' : 'changed: ' + b];
  });
  claim(SV, 'tip', 'it never rewrites path geometry beyond rounding coordinates', 'path commands kept in order', N, async () => {
    const d = (opt(DIRTY).match(/d="([^"]+)"/) || [])[1] || '';
    return [d.replace(/[^A-Za-z]/g, '') === 'MLCZ', d];
  });
  claim(SV, 'faq', 'an id used by url(#…), href="#…", aria-labelledby, an animation\'s begin or end, or a #id rule in the SVG\'s own <style> is kept. An id that only outside CSS or JavaScript uses is not referenced in the file, so it is removed',
    'referenced ids kept, unreferenced id removed', N, async () => {
      const s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>#styled{fill:red}</style><rect id="styled" width="1" height="1"/><rect id="anim" width="1" height="1"><animate id="a1" begin="trig.click" attributeName="x" to="5"/></rect><rect id="trig" width="1" height="1"/><rect id="lonely" width="1" height="1"/><animate begin="a1.end" attributeName="y" to="1"/></svg>';
      const o = opt(s);
      const kept = ['styled', 'trig', 'a1'].filter((i) => o.indexOf('id="' + i + '"') >= 0);
      return [kept.length === 3 && o.indexOf('id="lonely"') < 0, 'kept ' + kept.join(',') + '; lonely ' + (o.indexOf('id="lonely"') >= 0 ? 'kept' : 'removed')];
    });
  claim(SV, 'dfaq', 'the page\'s own example lost 58.1%', 'the published example re-run', N, async () => {
    const f = path.join(K.ROOT, 'assets', 'examples.js');
    const src = fs.readFileSync(f, 'utf8');
    const m = /"\/image\/svg-optimizer\/"\s*:\s*(\{[\s\S]*?\})\s*,\s*"\//.exec(src);
    if (!m) return [false, 'example not found in assets/examples.js'];
    let ex; try { ex = JSON.parse(m[1]); } catch (e) { return [false, 'example not parseable'];}
    const input = ex.input || ''; const out = opt(input);
    const saved = (1 - Buffer.byteLength(out) / Buffer.byteLength(input)) * 100;
    return [Math.abs(saved - 58.1) < 0.05, saved.toFixed(1) + '% from ' + Buffer.byteLength(input) + ' bytes'];
  });

  /* ================================================================ */
  /* wave 1 additions: the shell's own promises and the new page        */
  /* ================================================================ */
  /* pet.jpg re-saved as a PNG in Chrome, as the depth figures were made (2.41 MB) */
  const petPng = () => K.once('img:petpng', () => within(CO, async (p) => K.write('pet-as-png.png', Buffer.from(await p.evaluate(async () => {
    const bm = await createImageBitmap(await (await fetch('/build/promo/samples/pet.jpg')).blob());
    const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64'))));
  const KB = (b) => fmtKB(b.length);
  claim(CO, 'tip', '“Make it under” tries qualities, then smaller sizes, until the file fits. A KB there is 1,000 bytes, so the result fits a form whichever kilobyte it counts.', 'street.jpg, Keep original format, under 100 KB: a JPEG of at most 100,000 bytes, 1472×1104', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'target', '100');
    await K.img.upload(p, [S('street.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [K.isJpeg(b) && b.length <= 100000 && b.length > 80000 && d.w === 1472 && d.h === 1104, K.kind(b) + ' ' + b.length + ' bytes, ' + d.w + '×' + d.h];
  }));
  claim(CO, 'tip', '“Keep original format” turns a PNG into a 256-colour PNG with dithering, which is where PNG compressors find their big savings. Choose “All — lossless” under PNG colours to keep every pixel.', 'a pet photo as PNG: 256 colours is far smaller than All, and All keeps every pixel', B, async () => within(CO, async (p) => {
    const f = await petPng();
    await K.img.upload(p, [f]);
    const [a] = await K.img.results(p); const pa = await K.img.pixels(p, a, [[400, 300]]);
    await K.img.change(p, 'pngColours', 'all');
    const [all] = await K.img.results(p);
    const src = await K.img.pixels(p, fs.readFileSync(f), [[400, 300], [1000, 700]]);
    const out = await K.img.pixels(p, all, [[400, 300], [1000, 700]]);
    return [K.isPng(a) && K.isPng(all) && a.length * 1.5 < all.length && close(src.px[0], out.px[0], 0) && close(src.px[1], out.px[1], 0), '256 colours ' + KB(a) + ', all colours ' + KB(all) + '; pixels ' + K.j(src.px) + ' vs ' + K.j(out.px)];
  }));
  claim(CO, 'what', 'A 1600×1200 street photo, already a tight 321.4 KB JPEG, came out at 322.4 KB at quality 80, Keep original format: larger, and the page said so. WebP at 80 gave 277.0 KB, JPEG at 60 185.8 KB, AVIF 188.0 KB. Under 100 KB gave 96.1 KB at 1472×1104 after 12 tries; a max width of 800 gave 92.4 KB. A 2.41 MB PNG fell to 835.3 KB in 256 colours, 1.60 MB with all colours, 1.10 MB as lossless WebP.',
    'street.jpg: each setting; pet.jpg as PNG: 256 colours, all colours, lossless WebP', B, async () => {
      const f = await petPng();
      const r = await within(CO, async (p) => {
        const o = {};
        await K.img.upload(p, [S('street.jpg')]);
        [o.same] = await K.img.results(p); o.msg = (await K.img.msg(p)).text;
        await K.img.change(p, 'format', 'image/webp'); await idle(p); [o.webp] = await K.img.results(p);
        await K.img.change(p, 'format', 'image/avif', 180000); await idle(p); [o.avif] = await K.img.results(p);
        await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'quality', 60); await idle(p); [o.jpg60] = await K.img.results(p);
        await K.img.change(p, 'format', 'same'); await K.img.change(p, 'quality', 80); await idle(p);
        await K.img.change(p, 'target', '100'); await idle(p); [o.under] = await K.img.results(p); o.tries = (await K.img.caps(p)).join(' | ') + ' / ' + K.j(await K.img.stats(p));
        await K.img.change(p, 'target', '0'); await K.img.change(p, 'maxWidth', 800); await idle(p); [o.w800] = await K.img.results(p);
        return o;
      });
      const pg = await within(CO, async (p) => {
        const o = {};
        await K.img.upload(p, [f]); await idle(p); o.srcBytes = fs.statSync(f).size; [o.c256] = await K.img.results(p);
        await K.img.change(p, 'pngColours', 'all'); await idle(p); [o.all] = await K.img.results(p);
        await K.img.change(p, 'format', 'image/webp'); await K.img.change(p, 'webpMode', 'lossless'); await idle(p); [o.wl] = await K.img.results(p);
        return o;
      });
      const ok = near(r.same.length, '322.4 KB') && /larger/i.test(r.msg) && near(r.webp.length, '277.0 KB') && near(r.jpg60.length, '185.8 KB') && near(r.avif.length, '188.0 KB') && near(r.under.length, '96.1 KB') && /12 tries/.test(r.tries) && near(r.w800.length, '92.4 KB')
        && near(pg.srcBytes, '2.41 MB') && near(pg.c256.length, '835.3 KB') && near(pg.all.length, '1.60 MB') && near(pg.wl.length, '1.10 MB');
      return [ok, 'keep ' + KB(r.same) + ' (' + r.msg + '), WebP ' + KB(r.webp) + ', JPEG 60 ' + KB(r.jpg60) + ', AVIF ' + KB(r.avif) + ', under 100 KB ' + KB(r.under) + ' [' + r.tries + '], 800 wide ' + KB(r.w800) + '; PNG ' + fmtKB(pg.srcBytes) + ' → 256 ' + KB(pg.c256) + ', all ' + KB(pg.all) + ', WebP lossless ' + KB(pg.wl) + ' (2% allowed)'];
    });
  claim(CV, 'point', 'A link ending ?from=png&to=jpg opens the page set for that pair.', '?from=png&to=jpg sets JPEG; ?to=avif sets AVIF; the link carries no image', B, async () => {
    const a = await within(CV + '?from=png&to=jpg', (p) => p.evaluate(() => [document.getElementById('ic-format').value, location.search]));
    const b = await within(CV + '?to=avif', (p) => p.evaluate(() => document.getElementById('ic-format').value));
    return [a[0] === 'image/jpeg' && b === 'image/avif', a.join(' ') + ' / ' + b];
  });
  claim(CV, 'what', 'A dog in long grass, a 1600 × 1067 photograph saved as a PNG of 2.41 MB, became a 205.1 KB WebP at the default quality of 92, 92% smaller. JPEG at 92 gave 285.1 KB, AVIF 84.2 KB, WebP at 80 101.6 KB. An ICO came out at 256×256 and 161.0 KB.',
    'pet.jpg as PNG: WebP 92, JPEG 92, AVIF, WebP 80, ICO', B, async () => within(CV, async (p) => {
      const f = await petPng();
      const o = {};
      await K.img.set(p, 'format', 'image/webp');
      await K.img.upload(p, [f]);
      [o.w92] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/jpeg'); [o.j92] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/avif', 180000); [o.av] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/webp'); await K.img.change(p, 'quality', 80); [o.w80] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/x-icon');
      await idle(p);
      const caps = await p.$eval('.img-compare-readout', (e) => e.textContent).catch(() => '');
      const m = /Result\s*([\d.]+) KB/.exec(caps);
      const saved = 100 - o.w92.length / fs.statSync(f).size * 100;
      return [near(o.w92.length, '205.1 KB') && Math.round(saved) === 92 && near(o.j92.length, '285.1 KB') && near(o.av.length, '84.2 KB') && near(o.w80.length, '101.6 KB') && /256×256/.test(caps) && m && Math.abs(Number(m[1]) / 161.0 - 1) <= 0.02,
        'WebP 92 ' + KB(o.w92) + ' (' + saved.toFixed(1) + '% off), JPEG ' + KB(o.j92) + ', AVIF ' + KB(o.av) + ', WebP 80 ' + KB(o.w80) + ', ICO ' + caps + ' (2% allowed)'];
    }));
  claim(BU, 'what', 'Longest edge 800 with WebP at 85 gave 800×534, 800×600 and 800×534, 220.7 KB in all (66.2, 112.8 and 41.7 KB); as JPEG they came to 253.7 KB. Under 100 KB each, the street photo fell to quality 81 and the batch to 203.1 KB. A width of 2400 left all three at their own size, 624.6 KB, with a note; with “Allow enlarging” on they became 2400×1601 and 2400×1800, 993.3 KB.',
    'portrait + street + food: longest 800 as WebP and JPEG, under 100 KB, width 2400 without and with enlarging', B, async () => within(BU, async (p) => {
      const o = {};
      await K.img.set(p, 'mode', 'longest'); await K.img.set(p, 'value', 800);
      await K.img.upload(p, [S('portrait.jpg'), S('street.jpg'), S('food.jpg')]); await idle(p);
      const tot = async () => { await idle(p); return K.img.stat(await K.img.stats(p), 'Total size'); };
      const dims = async () => (await Promise.all((await K.img.results(p)).map((b) => K.img.pixels(p, b)))).map((x) => x.w + '×' + x.h).join();
      o.w = await tot(); o.dims = await dims();
      await K.img.change(p, 'format', 'image/jpeg'); o.j = await tot();
      await K.img.change(p, 'format', 'image/webp'); await K.img.change(p, 'target', '100'); o.t = await tot();
      o.q = (await K.img.caps(p)).join(' | ');
      await K.img.change(p, 'target', '0'); await K.img.change(p, 'mode', 'width'); await K.img.change(p, 'value', 2400); o.n = await tot(); o.nm = (await K.img.msg(p)).text;
      await K.img.change(p, 'enlarge', 'yes'); o.y = await tot(); o.ydims = await dims();
      const kb = (t) => Number(/[\d.]+/.exec(t)[0]) * (/MB/.test(t) ? 1024 : 1);
      const ok = o.dims === '800×534,800×600,800×534' && Math.abs(kb(o.w) / 220.7 - 1) <= 0.02 && Math.abs(kb(o.j) / 253.7 - 1) <= 0.02 && Math.abs(kb(o.t) / 203.1 - 1) <= 0.02 && /800×600 · [\d.]+ KB · quality 81/.test(o.q)
        && Math.abs(kb(o.n) / 624.6 - 1) <= 0.02 && /left at their own size/.test(o.nm) && o.ydims === '2400×1601,2400×1800,2400×1601' && Math.abs(kb(o.y) / 993.3 - 1) <= 0.02;
      return [ok, K.j(o) + ' (2% allowed)'];
    }));
  claim(IP, 'point', 'PNG, GIF and BMP keep every pixel, with transparency as a soft mask.', 'an opaque noise PNG: a FlateDecode image with the source pixels, no DCTDecode; a transparent PNG gets an SMask', B, async () => within(IP, async (p) => {
    const f = await pngFile(p, 'ip-noise.png', 80, 60, NOISE);
    const pdf = await makePdf(p, [f]);
    const a = await K.analyse(pdf);
    const img = a.streams.find((s) => s.dict && String(s.dict.Subtype) === '/Image' || (s.dict && s.dict.get && s.dict.get('Subtype') && String(s.dict.get('Subtype')).indexOf('Image') >= 0));
    const txt = pdf.toString('latin1');
    const src = await K.img.pixels(p, fs.readFileSync(f), [[0, 0], [40, 30], [79, 59]]);
    const at = (x, y) => [0, 1, 2].map((k) => img && img.data ? img.data.charCodeAt((y * 80 + x) * 3 + k) : -1);
    const same = img && img.data && img.data.length === 80 * 60 * 3 && close(at(0, 0), src.px[0].slice(0, 3), 0) && close(at(40, 30), src.px[1].slice(0, 3), 0) && close(at(79, 59), src.px[2].slice(0, 3), 0);
    const g = await pngFile(p, 'ip-glass.png', 40, 40, "x.clearRect(0,0,w,h);x.fillStyle='rgba(0,0,255,0.5)';x.fillRect(10,10,20,20);");
    const pdf2 = await makePdf(p, [g]);
    return [!!same && /FlateDecode/.test(txt) && !/DCTDecode/.test(txt) && /SMask/.test(pdf2.toString('latin1')), 'image stream ' + (img && img.data ? img.data.length + ' bytes' : 'not found') + ', same pixels ' + !!same + ', SMask on the transparent one ' + /SMask/.test(pdf2.toString('latin1'))];
  }));
  claim(IP, 'tip', 'A JPEG goes into the PDF as it is: its own compressed bytes are the page image', 'turning a page keeps the JPEG bytes and swaps the page shape', B, async () => within(IP, async (p) => {
    const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(S('document.jpg'), S('food.jpg'));
    await p.waitForSelector('.tool-io button[title="Turn right"]', { timeout: 30000 });
    await p.click('.tool-io button[title="Turn right"]');
    await K.sleep(800);
    await p.waitForFunction(() => [...document.querySelectorAll('.tool-io .io-actions .btn-primary')].some((b) => /Download PDF/.test(b.textContent)), { timeout: 30000 });
    await K.clearDownloads(p);
    await K.clickText(p, '.tool-io .io-actions .btn-primary', /Download PDF/);
    await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 30000 });
    const [d] = await K.downloads(p);
    const a = await K.analyse(d.bytes);
    const c = await a.content(0);
    const m = /([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+) cm/.exec(c);
    return [d.bytes.includes(fs.readFileSync(S('document.jpg'))) && !!m && Number(m[1]) === 0 && Number(m[4]) === 0, 'JPEG bytes inside: ' + d.bytes.includes(fs.readFileSync(S('document.jpg'))) + '; content: ' + c.slice(0, 90).replace(/\s+/g, ' ')];
  }));

  /* ---- the new single-image resizer ---- */
  const IR = '/image/image-resizer/';
  const irSet = async (p, o) => { for (const k of Object.keys(o)) await K.img.change(p, k, o[k]); };
  claim(IR, 'tip', '“Exact size, crop to fit” fills the whole frame and trims the edges that do not fit; “pad to fit” keeps the whole picture and fills the gap with the padding colour.', 'street.jpg to 1080×1080: crop has photo in the corner, pad has the padding colour there and the photo in the middle', B, async () => within(IR, async (p) => {
    await K.img.set(p, 'format', 'image/png'); await K.img.set(p, 'mode', 'cover'); await K.img.set(p, 'value', 1080); await K.img.set(p, 'height', 1080);
    await K.img.upload(p, [S('street.jpg')]);
    const [c] = await K.img.results(p); const cd = await K.img.pixels(p, c, [[2, 2]]);
    await K.img.change(p, 'mode', 'pad'); await K.img.change(p, 'padColour', '#ff0000');
    const [q] = await K.img.results(p); const qd = await K.img.pixels(p, q, [[2, 2], [540, 540]]);
    return [cd.w === 1080 && cd.h === 1080 && !close(cd.px[0], [255, 0, 0, 255], 40) && qd.w === 1080 && qd.h === 1080 && close(qd.px[0], [255, 0, 0, 255], 0) && !close(qd.px[1], [255, 0, 0, 255], 40), 'crop corner ' + K.j(cd.px[0]) + '; pad corner ' + K.j(qd.px[0]) + ', pad middle ' + K.j(qd.px[1])];
  }));
  claim(IR, 'tip', 'A picture smaller than the size you ask for is never enlarged unless you set Allow enlarging to Yes, because enlarging adds softness, not detail. Padding centres it at its own size instead.', 'a 200×100 PNG to a 1080×1080 pad: enlarging off keeps it 200×100 in the middle; a 3000 px width leaves 1600 px; with Yes it becomes 3000', B, async () => within(IR, async (p) => {
    const f = await pngFile(p, 'ir-small.png', 200, 100, "x.fillStyle='#00ff00';x.fillRect(0,0,w,h);");
    await K.img.set(p, 'format', 'image/png'); await K.img.set(p, 'mode', 'pad'); await K.img.set(p, 'value', 1080); await K.img.set(p, 'height', 1080); await K.img.set(p, 'padColour', '#ff0000');
    await K.img.upload(p, [f]);
    const [a] = await K.img.results(p); const ad = await K.img.pixels(p, a, [[540, 540], [430, 540], [450, 540], [635, 540], [650, 540]]);
    await K.img.change(p, 'mode', 'width'); await K.img.change(p, 'value', 3000);
    const [b] = await K.img.results(p); const bd = await K.img.pixels(p, b);
    await K.img.change(p, 'enlarge', 'yes');
    const [c] = await K.img.results(p); const cd = await K.img.pixels(p, c);
    const g = [0, 255, 0, 255], r = [255, 0, 0, 255];
    return [ad.w === 1080 && close(ad.px[0], g, 0) && close(ad.px[1], r, 0) && close(ad.px[2], g, 0) && close(ad.px[3], g, 0) && close(ad.px[4], r, 0) && bd.w === 200 && cd.w === 3000, 'pad middle row ' + K.j(ad.px) + '; width 3000: ' + bd.w + ' px, with Yes: ' + cd.w + ' px'];
  }));
  claim(IR, 'tip', '“Make it under” finds the best quality that fits, then shrinks the size only if it must. A KB there is 1,000 bytes, so it fits a form whichever kilobyte the form counts.', 'street.jpg at 800×600 under 100 KB: a file of at most 100,000 bytes, at the original size, with a quality reported', B, async () => within(IR, async (p) => {
    await K.img.set(p, 'mode', 'width'); await K.img.set(p, 'value', 800); await K.img.set(p, 'format', 'image/jpeg'); await K.img.set(p, 'target', '50');
    await K.img.upload(p, [S('street.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    const cap = (await K.img.caps(p))[0] || '';
    return [K.isJpeg(b) && b.length <= 50000 && b.length > 35000 && d.w === 800 && /quality \d+/.test(cap), K.kind(b) + ' ' + b.length + ' bytes, ' + d.w + '×' + d.h + ' [' + cap + ']'];
  }));
  claim(IR, 'tip', 'DPI only tells a printer how big to print; it does not change a single pixel. 300 DPI is the usual figure for photo prints.', 'width 1200 JPEG with DPI 300: JFIF density 300, the pixels equal a run with DPI 0', B, async () => within(IR, async (p) => {
    await K.img.set(p, 'mode', 'width'); await K.img.set(p, 'value', 1200); await K.img.set(p, 'format', 'image/jpeg'); await K.img.set(p, 'quality', 85);
    await K.img.upload(p, [S('street.jpg')]);
    const [a] = await K.img.results(p);
    await K.img.change(p, 'dpi', 300);
    const [b] = await K.img.results(p);
    const sg = K.jpegSegs(b).find((x) => x.m === 0xe0);
    const row = K.img.stat(await K.img.stats(p), 'DPI in the file');
    const pts = [[10, 10], [600, 450], [1190, 890]];
    const pa = await K.img.pixels(p, a, pts), pb = await K.img.pixels(p, b, pts);
    return [!!sg && sg.body[7] === 1 && sg.body.readUInt16BE(8) === 300 && row === '300' && pa.w === pb.w && pa.px.every((c, i) => close(c, pb.px[i], 0)), 'JFIF density ' + (sg && sg.body.readUInt16BE(8)) + ', row ' + row + ', ' + pa.w + '×' + pa.h];
  }));
  claim(IR, 'what', 'A 1600×1200 street photograph, a 321.4 KB JPEG, was halved to 800×600 and came to 112.6 KB as WebP. Cropped to a 1080×1080 square it weighed 235.0 KB, since the frame keeps the full scale. Padded to the same square it kept every pixel on a colour fill and weighed 182.4 KB. A width of 1200 as JPEG at 85 with 300 DPI gave 224.2 KB and the row “DPI in the file = 300”.',
    'street.jpg: 50%, cover 1080×1080, pad 1080×1080, width 1200 as JPEG 85 with DPI 300', B, async () => within(IR, async (p) => {
      const o = {};
      await K.img.set(p, 'mode', 'percent'); await K.img.set(p, 'value', 50);
      await K.img.upload(p, [S('street.jpg')]);
      await idle(p); [o.half] = await K.img.results(p); o.halfd = await K.img.pixels(p, o.half);
      await K.img.change(p, 'mode', 'cover'); await K.img.change(p, 'value', 1080); await K.img.change(p, 'height', 1080); await idle(p); [o.cover] = await K.img.results(p);
      await K.img.change(p, 'mode', 'pad'); await idle(p); [o.pad] = await K.img.results(p);
      await K.img.change(p, 'mode', 'width'); await K.img.change(p, 'value', 1200); await K.img.change(p, 'dpi', 300); await K.img.change(p, 'format', 'image/jpeg'); await idle(p); [o.w] = await K.img.results(p);
      o.row = K.img.stat(await K.img.stats(p), 'DPI in the file');
      return [o.halfd.w === 800 && o.halfd.h === 600 && near(o.half.length, '112.6 KB') && near(o.cover.length, '235.0 KB') && near(o.pad.length, '182.4 KB') && near(o.w.length, '224.2 KB') && o.row === '300' && K.isWebp(o.half) && K.isJpeg(o.w),
        '50% ' + KB(o.half) + ', cover ' + KB(o.cover) + ', pad ' + KB(o.pad) + ', JPEG ' + KB(o.w) + ', DPI row ' + o.row + ' (2% allowed)'];
    }));
  claim(IR, 'dfaq', 'JPEG, unless the form names another. A KB limit on this page counts 1,000 bytes to the KB.', 'the limit is in 1,000-byte KB: under 20 KB gives at most 20,000 bytes', B, async () => within(IR, async (p) => {
    await K.img.set(p, 'mode', 'width'); await K.img.set(p, 'value', 600); await K.img.set(p, 'format', 'image/jpeg'); await K.img.set(p, 'target', '20');
    await K.img.upload(p, [S('street.jpg')]);
    const [b] = await K.img.results(p);
    return [K.isJpeg(b) && b.length <= 20000 && b.length > 15000, b.length + ' bytes'];
  }));
  claim(IR, 'dfaq', 'No. It is decoded, resampled and encoded on your device, with encoders that run in the page; nothing is sent anywhere.', 'no request leaves the origin while the page resizes a photo', B, async () => {
    const out = await within(IR, async (p) => {
      const seen = [];
      p.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u) && new URL(u).origin !== new URL(p.url()).origin) seen.push(u); });
      await K.img.upload(p, [S('street.jpg')]);
      return seen;
    });
    return [out.length === 0, out.length + ' outside requests'];
  });

  /* ---------- manual ---------- */
  manual(CO, 'tip', 'WebP is typically 25–35% smaller than JPEG at the same visual quality, and every current browser supports it.', 'Needs a perceptual-quality comparison over a corpus and a browser-support source; not a property of this tool.');
  manual(CO, 'tip', 'Quality 80 is the usual sweet spot for photographs.', 'Perceptual judgement.');
  manual(BR, 'tip', 'Both blur and pixelation have been reversed in published research, particularly on short strings like numbers.', 'Research claim; needs a citation, not a run.');
  manual(PP, 'tip', 'It does not check the compositional rules — head size, expression, background uniformity', 'A statement of absence (no face detection); confirmed by reading the code, not by a run.');
  manual(PP, 'tip', 'a 25 MB model and the runtime are fetched from this site the first time, then kept by your browser.', 'Model size and browser caching; image-fixes.js runs the MODNet cut-out, caching needs a real profile.');
  manual(MG, 'tip', 'Impact itself is a Microsoft font that most phones lack, so choose it only if you know the device has it.', 'Font availability depends on the device.');
  manual(CR, 'mistake', 'Cropping a shrunk copy. Crop the original first, then resize.', 'Advice about workflow order; no property of the tool to run.');
  manual(PP, 'tip', 'Check the issuing authority’s own specification before printing: each document in the list, except the generic stamp size, names the page its size came from, and requirements change.', 'Whether each issuer page still says what the list says needs a person reading it; the owner spot-check is listed in NOTES.');
  manual(SM, 'tip', 'Sizes change. These are current at the time of writing', 'Platform image sizes need each platform\'s current documentation with a date.');
  manual(EV, 'tip', 'Social networks usually strip metadata on upload, but file sharing, email attachments and cloud links generally do not.', 'Behaviour of third-party services.');
  manual(CV, 'what', 'An animated GIF or WebP gives one still frame in any other format.', 'Covered by build/tests/wave1-image.js case 14 (a two-frame GIF, kept byte for byte to GIF, first frame to PNG); not a claims-harness check.');
  manual(SPL, 'tip', 'For a 3×3 profile mosaic, upload the tiles in reverse order. The grid fills right to left, bottom to top.', 'Instagram behaviour.');
  manual(B64, 'mistake', 'Gmail and many other webmail clients do not display data: URI images', 'Third-party email client behaviour.');
};
