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
  const within = async (url, fn) => { const p = await K.open(url); try { return await fn(p); } finally { await p.close(); } };
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
  claim(BR, 'point', 'Before you drag, the selection is the middle 70% of the picture.', 'street.jpg 1600×1200: selection 1120×840 at 240, 180', B, async () => within(BR, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    const st = await K.img.stats(p); const ro = await p.$eval('.select-readout', (e) => e.textContent);
    return [K.img.stat(st, 'Selection') === '1120×840' && /at 240, 180/.test(ro), K.img.stat(st, 'Selection') + ' / ' + ro];
  }));
  claim(BR, 'point', 'Block fills the area with your colour, black by default.', 'block: centre black, corner untouched', B, async () => within(BR, async (p) => {
    const f = await pngFile(p, 'br-white.png', 200, 100, "x.fillStyle='#fff';x.fillRect(0,0,w,h);");
    await K.img.set(p, 'method', 'block');
    await K.img.upload(p, [f]);
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
  const near = (bytes, figure) => { const [v, u] = figure.split(' '); return Math.abs(bytes / (u === 'MB' ? 1048576 : 1024) / Number(v) - 1) <= 0.02; };
  const brDrag = (p) => cropDrag(p, 0.38, 0.48, 0.6, 0.63);
  /* the FAQ's and the worked example's figures, from one run: each method on the starting selection, then the worked example's drag */
  const brSizes = () => K.once('img:br-sizes', () => within(BR, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    const r = {};
    for (const m of ['pixelate', 'blur', 'block']) { await K.img.change(p, 'method', m); const [b] = await K.img.results(p); r[m] = b; }
    await K.img.change(p, 'method', 'pixelate');
    r.sel = await brDrag(p);
    [r.png] = await K.img.results(p);
    await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'quality', 85);
    [r.jpg] = await K.img.results(p);
    await K.img.change(p, 'format', 'image/webp');
    [r.webp] = await K.img.results(p);
    return r;
  }));
  claim(BR, 'dfaq', 'PNG, the default, is lossless: the 321.4 KB street photo above became 2.79 MB. Undragged (the middle 70%) it gave 1.47 MB pixelated, 2.23 MB blurred, 1.46 MB blocked. JPEG or WebP is far smaller.',
    'street.jpg: each method on the starting selection as PNG, the worked example\'s drag as PNG, and that as JPEG 85 smaller', B, async () => {
      const r = await brSizes();
      const src = fmtKB(fs.statSync(S('street.jpg')).size);
      const ok = src === '321.4 KB' && r.sel === '352×179' && [r.pixelate, r.blur, r.block, r.png].every(K.isPng) && K.isJpeg(r.jpg) &&
        near(r.pixelate.length, '1.47 MB') && near(r.blur.length, '2.23 MB') && near(r.block.length, '1.46 MB') && near(r.png.length, '2.79 MB') && r.jpg.length * 5 < r.png.length && K.kind(r.webp) === 'webp' && r.webp.length * 5 < r.png.length;
      return [ok, 'source ' + src + '; starting selection: pixelate ' + fmtKB(r.pixelate.length) + ', blur ' + fmtKB(r.blur.length) + ', block ' + fmtKB(r.block.length) +
        '; drag ' + r.sel + ': PNG ' + fmtKB(r.png.length) + ', JPEG 85 ' + fmtKB(r.jpg.length) + ', WebP 85 ' + fmtKB(r.webp.length) + ' (2% allowed)'];
    });
  claim(BR, 'what', 'a drag over the people on a zebra crossing selected 352×179 pixels.', 'the worked example\'s drag selects 352×179', B, async () => {
    const r = await brSizes(); return [r.sel === '352×179', r.sel];
  });
  claim(BR, 'what', 'Saved as PNG the result weighed 2.79 MB; JPEG at quality 85 gave 355.3 KB, squares intact.', 'the worked example\'s drag as PNG, then JPEG 85', B, async () => {
    const r = await brSizes();
    return [K.isPng(r.png) && near(r.png.length, '2.79 MB') && K.isJpeg(r.jpg) && near(r.jpg.length, '355.3 KB'), r.sel + ': PNG ' + fmtKB(r.png.length) + ', JPEG 85 ' + fmtKB(r.jpg.length) + ' (2% allowed)'];
  });

  /* ================================================================ */
  /* bulk resizer                                                      */
  /* ================================================================ */
  const BU = '/image/bulk-image-resizer/';
  claim(BU, 'point', 'Fixed width or height works out the other side from the photo\'s ratio; longest edge scales the bigger side to the value; percentage scales both; exact size stretches to your width and height.',
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
  claim(BU, 'point', 'Each result is named after its source plus the new size, such as street-800x600.webp, and a batch comes as one ZIP built in the page.',
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
  claim(BU, 'works', 'encoded with canvas.toBlob, WebP at quality 85 unless you change it.', 'defaults WebP, 85; output is WebP', B, async () => within(BU, async (p) => {
    const d = await p.evaluate(() => [document.getElementById('ic-format').value, document.getElementById('ic-quality').value]);
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p);
    return [d.join() === 'image/webp,85' && K.isWebp(b), d.join() + ' → ' + K.kind(b)];
  }));
  claim(BU, 'dfaq', 'Each file is redrawn from its pixels, so a tagged test photo resized to 800 px lost its camera and GPS tags too.', 'tagged JPEG resized to JPEG keeps no EXIF', B, async () => within(BU, async (p) => {
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
    await K.img.upload(p, [S('street.jpg'), S('document.jpg')]);
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
  claim(CC, 'point', 'Squircle is the same shape with the radius fixed at 22.5%, not a true superellipse.', 'squircle clips a rounded square with radius 22.5% of the inner width', N, async () => {
    const log = paintIn('img-circle-crop.js', 'circle-crop', 800, 600, { shape: 'squircle', size: 512, border: 0 });
    const rr = log.find((x) => x[0] === 'roundRect');
    const arc = log.some((x) => x[0] === 'arc' || x[0] === 'ellipse' || x[0] === 'bezierCurveTo');
    return [rr && Math.abs(rr[5] - 512 * 0.225) < 1e-9 && !arc, rr ? 'roundRect radius ' + rr[5] + ' on ' + rr[3] + ' px' : 'no roundRect'];
  });
  claim(CC, 'point', 'A border is stroked as a ring just outside the picture, so it never covers the photo.', 'border 40: ring colour from radius 216 to 256, photo inside', B, async () => within(CC, async (p) => {
    const f = await pngFile(p, 'cc-green.png', 200, 200, "x.fillStyle='#00ff00';x.fillRect(0,0,w,h);");
    await K.img.set(p, 'border', 40); await K.img.set(p, 'borderColor', '#ff0000');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    const d = await K.img.pixels(p, b, [[256, 256 - 210], [256, 256 - 230], [256, 256 - 250]]);
    return [d.px[0][1] > 200 && d.px[0][0] < 40 && d.px[1][0] > 200 && d.px[1][1] < 40 && d.px[2][0] > 200, K.j(d.px)];
  }));
  claim(CC, 'dfaq', 'A 1024 px circle from a 220.3 KB JPEG weighed 1.40 MB', 'pet.jpg at 1024 px', B, async () => within(CC, async (p) => {
    await K.img.set(p, 'size', 1024);
    await K.img.upload(p, [S('pet.jpg')]);
    const [b] = await K.img.results(p);
    /* a size from a run of the page: within 5%, since PNG encoders differ a little between Chrome versions */
    return [fmtKB(fs.statSync(S('pet.jpg')).size) === '220.3 KB' && Math.abs(b.length / 1048576 / 1.40 - 1) <= 0.05, 'source ' + fmtKB(fs.statSync(S('pet.jpg')).size) + ', result ' + fmtKB(b.length) + ' (claim 1.40 MB, 5% allowed)'];
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

  /* ================================================================ */
  /* EXIF remover                                                      */
  /* ================================================================ */
  const ER = '/image/exif-remover/';
  claim(ER, 'works', 'This tool re-encodes. Each photo is drawn onto a fresh canvas of its own size and saved with canvas.toBlob, as JPEG at quality 92 unless you choose otherwise.',
    'defaults JPEG at 92; the result is a new JPEG of the same size, not the same bytes', B, async () => within(ER, async (p) => {
      const d = await p.evaluate(() => [document.getElementById('ic-format').value, document.getElementById('ic-quality').value]);
      await K.img.upload(p, [S('street.jpg')]);
      const [b] = await K.img.results(p); const px = await K.img.pixels(p, b);
      const src = fs.readFileSync(S('street.jpg'));
      return [d.join() === 'image/jpeg,92' && K.isJpeg(b) && !b.equals(src) && px.w === 1600 && px.h === 1200, d.join() + ' → ' + K.kind(b) + ' ' + px.w + '×' + px.h];
    }));
  claim(ER, 'point', 'The browser applies the Orientation tag as it draws, so a photo stored sideways by a phone is saved upright.', 'a 1600×1067 JPEG tagged Orientation 6 comes out 1067×1600', B, async () => within(ER, async (p) => {
    await K.img.upload(p, [await tagged('er-turned.jpg', 6, 'food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 1067 && d.h === 1600 && !hasExif(b), d.w + '×' + d.h];
  }));
  claim(ER, 'point', 'Chrome adds a 16-byte JFIF header and an sRGB colour profile to a JPEG, neither about you; its PNG holds only the image.',
    'JPEG: APP0 of 16 bytes and an ICC APP2; PNG: no metadata chunk', B, async () => within(ER, async (p) => {
      await K.img.upload(p, [await tagged('er-tagged.jpg')]);
      let [b] = await K.img.results(p);
      const segs = K.jpegSegs(b).filter((s) => s.m >= 0xe0 && s.m <= 0xef);
      const app0 = segs.find((s) => s.m === 0xe0);
      await K.img.change(p, 'format', 'image/png');
      [b] = await K.img.results(p);
      const ch = K.pngChunks(b).map((c) => c.type).filter((t) => ['IHDR', 'IDAT', 'IEND'].indexOf(t) < 0);
      return [app0 && app0.len === 16 && segs.some((s) => s.m === 0xe2 && /ICC_PROFILE/.test(s.id)) && !ch.length,
        'JPEG ' + segs.map((s) => 'APP' + (s.m - 0xe0) + '(' + s.len + ')').join(' ') + '; PNG extra chunks: ' + (ch.join(',') || 'none')];
    }));
  claim(ER, 'point', 'The original\'s list reads JPEG only; a PNG\'s text chunks go unlisted but are dropped too.', 'a PNG with a tEXt chunk: listed as none, gone from the result', B, async () => within(ER, async (p) => {
    const png = await K.img.makePng(p, 60, 40, "x.fillStyle='#369';x.fillRect(0,0,w,h);");
    const zlib = require('zlib');
    const data = Buffer.from('Author\0Secret Person', 'latin1');
    const crc = (buf) => { let c, crcT = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } let r = 0xffffffff; for (const x of buf) r = crcT[(r ^ x) & 255] ^ (r >>> 8); return (r ^ 0xffffffff) >>> 0; };
    const type = Buffer.from('tEXt'); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(Buffer.concat([type, data])));
    const withText = Buffer.concat([png.slice(0, 33), len, type, data, cr, png.slice(33)]);
    void zlib;
    await K.img.set(p, 'format', 'image/png');
    await K.img.upload(p, [K.write('er-text.png', withText)]);
    const [b] = await K.img.results(p); const st = await K.img.stats(p);
    return [K.img.stat(st, 'Metadata found in original') === 'none' && b.indexOf('Secret Person') < 0, 'listed: ' + K.img.stat(st, 'Metadata found in original') + '; text in result: ' + (b.indexOf('Secret Person') >= 0)];
  }));
  claim(ER, 'dfaq', 'the EXIF viewer showed the test JPEG with only APP0 (16 B) and ICC colour profile (472 B).', 'the cleaned JPEG, read by the EXIF viewer', B, async () => {
    const clean = await within(ER, async (p) => { await K.img.upload(p, [await tagged('er-tagged2.jpg')]); return (await K.img.results(p))[0]; });
    return within('/image/exif-viewer/', async (p) => {
      await K.img.upload(p, [K.write('er-clean.jpg', clean)]);
      const s = K.img.stat(await K.img.stats(p), 'Metadata segments');
      return [s === 'APP0 (16 B), ICC colour profile (472 B)', s];
    });
  });
  claim(ER, 'tip', 'The tool lists the metadata segments the original had, then reads the cleaned file back and reports what it really contains, rather than assuming.', 'rows for the original and for the result', B, async () => within(ER, async (p) => {
    await K.img.upload(p, [await tagged('er-tagged3.jpg')]);
    const st = await K.img.stats(p);
    return [/EXIF/.test(K.img.stat(st, 'Metadata found in original') || '') && /No EXIF/.test(K.img.stat(st, 'Metadata in result') || ''), K.img.stat(st, 'Metadata found in original') + ' / ' + K.img.stat(st, 'Metadata in result')];
  }));

  /* ================================================================ */
  /* EXIF viewer                                                       */
  /* ================================================================ */
  const EV = '/image/exif-viewer/';
  claim(EV, 'point', 'GPS degrees, minutes and seconds become signed decimal degrees, south and west negative, with a link to OpenStreetMap.', '44°6\'30.6"S 170°9\'15"E', B, async () => within(EV, async (p) => {
    await K.img.upload(p, [await tagged('ev-tagged.jpg')]);
    const st = await K.img.stats(p);
    const href = await p.$eval('.tool-io a[href*="openstreetmap"]', (a) => a.href).catch(() => '');
    return [K.img.stat(st, 'GPS latitude') === '-44.108500' && K.img.stat(st, 'GPS longitude') === '170.154167' && /openstreetmap\.org/.test(href), K.img.stat(st, 'GPS latitude') + ', ' + K.img.stat(st, 'GPS longitude') + ', ' + (href ? 'map link' : 'no link')];
  }));
  claim(EV, 'point', 'Every metadata segment is listed with its size, including XMP, IPTC and ICC blocks whose contents are not decoded.', 'an XMP block is listed with its size', B, async () => within(EV, async (p) => {
    await K.img.upload(p, [K.write('ev-xmp.jpg', K.withXmp(fs.readFileSync(S('food.jpg')), '<x:xmpmeta>creator</x:xmpmeta>'))]);
    const s = K.img.stat(await K.img.stats(p), 'Metadata segments') || '';
    return [/XMP \(\d+(\.\d+)? (B|KB)\)/.test(s), s];
  }));
  claim(EV, 'point', 'Only JPEG is parsed; a PNG or WebP gets "Not a JPEG", even if it carries EXIF.', 'a PNG is reported as not a JPEG', B, async () => within(EV, async (p) => {
    const f = await pngFile(p, 'ev.png', 40, 40, "x.fillStyle='#123';x.fillRect(0,0,w,h);");
    await K.img.upload(p, [f]);
    const m = await K.img.msg(p);
    return [/Not a JPEG/i.test(m.text), m.text];
  }));
  claim(EV, 'dfaq', 'The six decimal places shown here are about 11 cm', 'GPS is shown to six decimals', B, async () => within(EV, async (p) => {
    await K.img.upload(p, [await tagged('ev-tagged2.jpg')]);
    const v = K.img.stat(await K.img.stats(p), 'GPS latitude') || '';
    return [/\.\d{6}$/.test(v), v];
  }));
  claim(EV, 'point', 'It reads the main tag directory and the Exif and GPS directories, showing a fixed list of common tags, from Make to LensModel', 'Make and Orientation are read', B, async () => within(EV, async (p) => {
    await K.img.upload(p, [await tagged('ev-tagged3.jpg', 6)]);
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
  claim(CO, 'point', 'A max width scales the picture down in proportion first; a narrower photo is never enlarged.', 'max 800 on 1600×1200 → 800×600; max 3000 → 1600×1200', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'maxWidth', 800);
    await K.img.upload(p, [S('street.jpg')]);
    let [b] = await K.img.results(p); const a = await K.img.pixels(p, b);
    await K.img.change(p, 'maxWidth', 3000);
    [b] = await K.img.results(p); const c = await K.img.pixels(p, b);
    return [a.w === 800 && a.h === 600 && c.w === 1600 && c.h === 1200, a.w + '×' + a.h + ', ' + c.w + '×' + c.h];
  }));
  claim(CO, 'point', 'For JPEG the canvas is painted white first, since JPEG cannot store transparency.', 'a transparent PNG to JPEG has white corners', B, async () => within(CO, async (p) => {
    const f = await pngFile(p, 'co-t.png', 80, 80, "x.clearRect(0,0,w,h);x.fillStyle='#00f';x.fillRect(20,20,40,40);");
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[1, 1]]);
    return [K.isJpeg(b) && d.px[0][0] > 245 && d.px[0][1] > 245 && d.px[0][2] > 245, K.j(d.px)];
  }));
  claim(CO, 'dfaq', 'A test JPEG carrying camera, date and GPS tags came out with none of them.', 'a tagged JPEG compressed to JPEG keeps no EXIF', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('co-tagged.jpg')]);
    const [b] = await K.img.results(p);
    return [K.isJpeg(b) && !hasExif(b), hasExif(b) ? 'EXIF kept' : 'no EXIF'];
  }));
  claim(CO, 'point', 'Sizes use binary units: a KB here is 1,024 bytes.', 'street.jpg (329,068 bytes) reads 321.4 KB', B, async () => within(CO, async (p) => {
    await K.img.upload(p, [S('street.jpg')]);
    const s = K.img.stat(await K.img.stats(p), 'Original total');
    return [s === '321.4 KB', s];
  }));
  claim(CO, 'dfaq', 'With it at 0 the test photo came out at 4000×3000 at every quality.', 'max width 0 keeps the size at quality 30 and 90', B, async () => within(CO, async (p) => {
    await K.img.set(p, 'quality', 30);
    await K.img.upload(p, [S('street.jpg')]);
    let [b] = await K.img.results(p); const a = await K.img.pixels(p, b);
    await K.img.change(p, 'quality', 90);
    [b] = await K.img.results(p); const c = await K.img.pixels(p, b);
    return [a.w === 1600 && a.h === 1200 && c.w === 1600 && c.h === 1200, a.w + '×' + a.h + ' / ' + c.w + '×' + c.h + ' (4000×3000 is the page\'s own test photo; this sample is 1600×1200)'];
  }));
  claim(CO, 'dfaq', 'so the 1,846,375-byte test photo is 1.76 MB here and 1.85 MB on a Mac.', 'the page\'s size formatter on 1,846,375 bytes', N, async () => {
    const src = fs.readFileSync(path.join(K.ROOT, 'engine', 'render-image.js'), 'utf8');
    const m = /const fmtBytes = (\(n\) =>[\s\S]*?MB');/.exec(src);
    const fmt = m ? new Function('return ' + m[1] + ';')() : null;
    const here = fmt ? fmt(1846375) : '?';
    return [here === '1.76 MB' && (1846375 / 1e6).toFixed(2) === '1.85', 'here ' + here + ', decimal ' + (1846375 / 1e6).toFixed(2) + ' MB'];
  });
  claim(CO, 'lede', 'Shrink JPEG, PNG and WebP files', '"Keep original format" keeps a PNG a PNG', B, async () => within(CO, async (p) => {
    const f = await pngFile(p, 'co-same.png', 80, 80, NOISE);
    await K.img.set(p, 'format', 'same');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p);
    return [K.isPng(b), K.kind(b)];
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
  claim(CV, 'point', 'The quality slider, 92 by default, reaches the JPEG and WebP encoders as 0.92.', 'default 92', B, async () => within(CV, async (p) => {
    const q = await p.$eval('#ic-quality', (e) => e.value); return [q === '92', q];
  }));
  claim(CV, 'point', 'Only pixels cross over. EXIF, GPS and XMP blocks stay behind, and a rotation recorded as a tag is applied to the pixels.', 'Orientation 6 JPEG → upright JPEG with no EXIF', B, async () => within(CV, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('cv-turned.jpg', 6, 'food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 1067 && d.h === 1600 && !hasExif(b), d.w + '×' + d.h + (hasExif(b) ? ', EXIF kept' : ', no EXIF')];
  }));
  claim(CV, 'dfaq', 'The canvas takes the picture\'s own size, so the test photo came out at 1600×1067 in every format.', 'food.jpg 1600×1067 as PNG, JPEG and WebP', B, async () => within(CV, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    const out = [];
    for (const f of ['image/png', 'image/jpeg', 'image/webp']) { await K.img.change(p, 'format', f); const [b] = await K.img.results(p); const d = await K.img.pixels(p, b); out.push(K.kind(b) + ' ' + d.w + '×' + d.h); }
    return [out.join(', ') === 'png 1600×1067, jpeg 1600×1067, webp 1600×1067', out.join(', ')];
  }));
  claim(CV, 'dfaq', 'only a JFIF header and the browser\'s standard sRGB colour profile remained.', 'the JPEG has APP0 and an ICC APP2 only', B, async () => within(CV, async (p) => {
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [await tagged('cv-tagged.jpg')]);
    const [b] = await K.img.results(p);
    const segs = K.jpegSegs(b).filter((s) => (s.m >= 0xe0 && s.m <= 0xef) || s.m === 0xfe).map((s) => s.m.toString(16));
    return [segs.join() === 'e0,e2', segs.join()];
  }));
  claim(CV, 'mistake', 'Chrome cannot decode either, so the tool says "None of those files could be decoded."', 'a TIFF is refused with that message', B, async () => within(CV, async (p) => {
    const tif = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const i = await p.$('.tool-io input[type=file]'); await i.uploadFile(K.write('scan.tif', tif));
    await p.waitForFunction(() => /could|not images/.test((document.querySelector('.tool-io .io-msg') || {}).textContent || ''), { timeout: 15000 }).catch(() => {});
    const m = await K.img.msg(p);
    return [m.text === 'None of those files could be decoded.', m.text];
  }));

  /* ================================================================ */
  /* cropper                                                           */
  /* ================================================================ */
  const CR = '/image/image-cropper/';
  claim(CR, 'point', 'On release, drawImage copies exactly that rectangle onto a new canvas, pixel for pixel.', 'the default crop of a noise PNG equals that rectangle of the source', B, async () => within(CR, async (p) => {
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
  claim(CR, 'works', 'The preview canvas is at most 720 pixels wide, but your drag is converted back into the original\'s pixel coordinates, so the crop comes from the full-resolution file.',
    'preview 720 px wide, crop 1120×840 from a 1600×1200 photo', B, async () => within(CR, async (p) => {
      await K.img.upload(p, [S('street.jpg')]);
      const vw = await p.$eval('.select-canvas', (c) => c.width);
      const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
      return [vw === 720 && d.w === 1120 && d.h === 840, 'preview ' + vw + ' px; crop ' + d.w + '×' + d.h];
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
  claim(CR, 'point', 'With a ratio locked, the drag is first held inside the picture\'s edges, then trimmed on its longer side to match and rounded to whole pixels, so the shape holds even when you drag past an edge.',
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
  claim(CR, 'what', 'cropped with 16:9 locked by dragging across the middle gave a 1280×720 selection, a true 16:9. Downloaded as PNG, the default, the crop weighed 1.51 MB, almost five times the whole original. The same selection saved as JPEG at quality 85 was 217.2 KB.',
    'street.jpg, 16:9, drag 10%,20% to 90%,80%: PNG then JPEG 85', B, async () => within(CR, async (p) => {
      await K.img.set(p, 'ratio', '16:9');
      await K.img.upload(p, [S('street.jpg')]);
      const st = await cropDrag(p, 0.1, 0.2, 0.9, 0.8);
      const [png] = await K.img.results(p);
      await K.img.change(p, 'format', 'image/jpeg'); await K.img.change(p, 'quality', 85);
      const [jpg] = await K.img.results(p);
      const src = fs.statSync(S('street.jpg')).size;
      return [st === '1280×720' && K.isPng(png) && near(png.length, '1.51 MB') && png.length / src > 4.5 && png.length / src < 5 && K.isJpeg(jpg) && near(jpg.length, '217.2 KB'),
        st + ': PNG ' + fmtKB(png.length) + ' (' + (png.length / src).toFixed(2) + '× the original), JPEG 85 ' + fmtKB(jpg.length)];
    }));
  claim(CR, 'tip', 'With a ratio locked, the selection keeps that shape as you drag.', '1:1, a drag that runs past the bottom edge', B, async () => within(CR, async (p) => {
    await K.img.set(p, 'ratio', '1:1');
    await K.img.upload(p, [S('street.jpg')]);
    const st = await cropDrag(p, 0.1, 0.1, 0.8, 1.15);
    const [w, h] = st.split('×').map(Number);
    return [w > 100 && w === h, 'selection ' + st + ' after dragging from 10%,10% to 80%,115% of the picture'];
  }));
  claim(CR, 'mistake', 'The lock shapes the box only while you drag, and the starting box follows the picture\'s own shape, so drag once first.', '1:1 chosen first: the undragged crop is 4:3', B, async () => within(CR, async (p) => {
    await K.img.set(p, 'ratio', '1:1');
    await K.img.upload(p, [S('street.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w !== d.h, d.w + '×' + d.h];
  }));
  claim(CR, 'point', 'a JPEG gets a white backing so transparency does not turn black.', 'transparent PNG cropped to JPEG: white', B, async () => within(CR, async (p) => {
    const f = await pngFile(p, 'cr-t.png', 100, 100, "x.clearRect(0,0,w,h);");
    await K.img.set(p, 'format', 'image/jpeg');
    await K.img.upload(p, [f]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[5, 5]]);
    return [K.isJpeg(b) && d.px[0][0] > 245, K.j(d.px)];
  }));
  claim(CR, 'dfaq', 'Each crop needs its own box drawn on its own picture, so the cropper takes one image at a time.', 'the file input takes one file', B, async () => within(CR, async (p) => {
    const m = await p.$eval('.tool-io input[type=file]', (e) => e.multiple); return [m === false, 'multiple=' + m];
  }));
  claim(CR, 'dfaq', 'The browser\'s canvas writes a new file and does not copy the original\'s EXIF tags, GPS coordinates included, into it.', 'tagged JPEG cropped to JPEG: no EXIF', B, async () => within(CR, async (p) => {
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
  claim(IP, 'point', 'Each image is fitted inside the margin (28 points by default) and centred', 'on A4 portrait the image spans the width less 28 pt each side', B, async () => within(IP, async (p) => {
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
  claim(IP, 'point', 'The result is a plain PDF with no title, bookmarks or text layer.', 'no Info Title, no Outlines, no text', B, async () => within(IP, async (p) => {
    const a = await K.analyse(await makePdf(p, [S('food.jpg')]));
    return [!a.info.Title && a.root.Outlines === undefined && !/ Tj| TJ/.test(await a.content(0)), K.j(a.info) + ', outlines ' + (a.root.Outlines ? 'yes' : 'no')];
  }));
  claim(IP, 'tip', 'The list can be reordered before generating.', 'two images: "Move up" on the second puts it first', B, async () => within(IP, async (p) => {
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
  claim(MG, 'point', 'Font size is a percentage of the picture\'s height, in bold Impact, falling back to Haettenschweiler, Arial Narrow Bold or any sans-serif.', 'size 10 on a 500 px picture asks for bold 50px Impact…', N, async () => {
    const log = paintIn('img-meme-generator.js', 'meme-generator', 800, 500, { size: 10 });
    const f = (log.find((x) => x[0] === '=font') || [])[1];
    return [f === 'bold 50px Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif', f];
  });
  claim(MG, 'point', 'The text is capitalised if "Force uppercase" is on, then broken at spaces into lines no wider than 94% of the picture.', 'caps on: drawn upper-case; lines fit 94%', N, async () => {
    const log = paintIn('img-meme-generator.js', 'meme-generator', 400, 400, { top: 'one two three four five six seven eight', bottom: '', caps: 'yes', size: 10 });
    const lines = log.filter((x) => x[0] === 'fillText').map((x) => x[1]);
    const w = (s) => s.length * 20;
    return [lines.length > 1 && lines.every((l) => l === l.toUpperCase() && (w(l) <= 376 || !/ /.test(l))), K.j(lines)];
  });
  claim(MG, 'point', 'Each line is stroked in the outline colour at 12% of the font size, then filled in the text colour on top.', 'stroke before fill, line width 12% of 50', N, async () => {
    const log = paintIn('img-meme-generator.js', 'meme-generator', 800, 500, { size: 10, outline: '#123456', color: '#abcdef' });
    const lw = (log.find((x) => x[0] === '=lineWidth') || [])[1];
    const i = log.findIndex((x) => x[0] === 'strokeText'), j = log.findIndex((x) => x[0] === 'fillText');
    const ss = (log.find((x) => x[0] === '=strokeStyle') || [])[1], fs2 = (log.find((x) => x[0] === '=fillStyle') || [])[1];
    return [Math.abs(lw - 6) < 1e-9 && i >= 0 && i < j && ss === '#123456' && fs2 === '#abcdef', 'lineWidth ' + lw + ', stroke at ' + i + ', fill at ' + j];
  });
  claim(MG, 'point', 'The meme keeps the picture\'s size: PNG by default, or JPEG or WebP at your quality.', 'food.jpg stays 1600×1067, PNG', B, async () => within(MG, async (p) => {
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
  const presets = () => K.once('img:presets', () => within(PP, (p) => p.evaluate(() => (window.MVRImage && window.MVRImage.PHOTO_PRESETS || []).map((x) => ({ name: x.name, w: x.w, h: x.h, dpi: x.dpi })))));
  claim(PP, 'works', 'The tool knows six fixed sizes at 300 DPI: India passport / visa 51×51 mm, UK passport 35×45 mm, US passport 51×51 mm, Schengen visa 35×45 mm, India PAN card 25×35 mm and stamp size 20×25 mm.',
    'the preset table', B, async () => {
      const ps = await presets();
      const s = ps.map((x) => x.w + '×' + x.h + '@' + x.dpi).join(',');
      return [s === '51×51@300,35×45@300,51×51@300,35×45@300,25×35@300,20×25@300', s];
    });
  claim(PP, 'dfaq', 'At 300 DPI, 35×45 mm is 413×531 pixels.', 'the UK preset\'s photo', B, async () => within(PP, async (p) => {
    const idx = (await presets()).findIndex((x) => x.w === 35 && x.h === 45);
    await K.img.set(p, 'preset', idx); await K.img.set(p, 'sheet', 'single');
    await K.img.upload(p, [S('portrait.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 413 && d.h === 531, d.w + '×' + d.h];
  }));
  claim(PP, 'dfaq', 'Here, 8 at 35×45 mm and 21 at stamp size, but only 2 at 51×51 mm.', 'copies per 6×4 sheet', B, async () => within(PP, async (p) => {
    const ps = await presets();
    await K.img.upload(p, [S('portrait.jpg')]);
    const out = [];
    for (const want of [[35, 45], [20, 25], [51, 51]]) {
      await K.img.change(p, 'preset', ps.findIndex((x) => x.w === want[0] && x.h === want[1]));
      const cap = (await K.img.caps(p)).find((c) => /Print sheet/.test(c)) || '';
      out.push((cap.match(/(\d+) copies/) || [])[1]);
    }
    return [out.join() === '8,21,2', out.join()];
  }));
  claim(PP, 'point', 'The print sheet is 1800×1200 pixels, 6×4 inches, with as many copies as fit at a 12-pixel gap.', 'sheet 1800×1200', B, async () => within(PP, async (p) => {
    await K.img.set(p, 'sheet', 'sheet');
    await K.img.upload(p, [S('portrait.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [d.w === 1800 && d.h === 1200, d.w + '×' + d.h];
  }));
  claim(PP, 'point', 'Files are JPEG at quality 95, or PNG, and say 300 DPI inside: in the JFIF header or a pHYs chunk.', 'default JPEG at 95 with 300 DPI in JFIF', B, async () => within(PP, async (p) => {
    const q = await p.$eval('#ic-quality', (e) => e.value);
    await K.img.set(p, 'sheet', 'single');
    await K.img.upload(p, [S('portrait.jpg')]);
    const [b] = await K.img.results(p);
    const s = K.jpegSegs(b).find((x) => x.m === 0xe0);
    return [q === '95' && K.isJpeg(b) && s && s.body[7] === 1 && s.body.readUInt16BE(8) === 300, 'quality ' + q + ', JFIF units ' + (s && s.body[7]) + ' density ' + (s && s.body.readUInt16BE(8))];
  }));

  /* ================================================================ */
  /* photo filters                                                     */
  /* ================================================================ */
  const PF = '/image/photo-filters/';
  claim(PF, 'point', 'Black & white is grayscale(1), sepia sepia(0.85); Cool and Warm add a hue-rotate of −12° and +12°.', 'the filter strings', N, async () => {
    const f = (preset) => (paintIn('img-photo-filters.js', 'photo-filters', 10, 10, { preset }).find((x) => x[0] === '=filter') || [])[1];
    const v = [f('grayscale'), f('sepia'), f('cool'), f('warm')];
    return [v[0] === 'grayscale(1)' && v[1] === 'sepia(0.85)' && /^hue-rotate\(-12deg\)/.test(v[2]) && /^hue-rotate\(12deg\)/.test(v[3]), v.join(' | ')];
  });
  claim(PF, 'point', 'The preset comes first and any slider moved from its default is appended after it, so sliders adjust the filtered picture.', 'dramatic + contrast 130', N, async () => {
    const v = (paintIn('img-photo-filters.js', 'photo-filters', 10, 10, { preset: 'dramatic', contrast: 130 }).find((x) => x[0] === '=filter') || [])[1];
    return [v === 'contrast(1.35) saturate(1.25) brightness(0.95) contrast(1.3)', v];
  });
  claim(PF, 'mistake', 'Dramatic already sets contrast to 1.35; contrast at 130% on top multiplies to about 1.75', '1.35 × 1.3', N, async () => [Math.abs(1.35 * 1.3 - 1.755) < 1e-9, String(1.35 * 1.3)]);
  claim(PF, 'dfaq', 'Choose the Black & white preset', 'the grayscale preset makes R = G = B', B, async () => within(PF, async (p) => {
    await K.img.set(p, 'preset', 'grayscale');
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b, [[100, 100], [800, 500], [1500, 1000]]);
    return [d.px.every((c) => Math.abs(c[0] - c[1]) <= 1 && Math.abs(c[1] - c[2]) <= 1), K.j(d.px)];
  }));
  claim(PF, 'point', 'The result keeps the original size, as PNG unless Save as says JPEG or WebP.', 'food.jpg → 1600×1067 PNG', B, async () => within(PF, async (p) => {
    await K.img.set(p, 'preset', 'sepia');
    await K.img.upload(p, [S('food.jpg')]);
    const [b] = await K.img.results(p); const d = await K.img.pixels(p, b);
    return [K.isPng(b) && d.w === 1600 && d.h === 1067, K.kind(b) + ' ' + d.w + '×' + d.h];
  }));

  /* ================================================================ */
  /* social media resizer                                              */
  /* ================================================================ */
  const SM = '/image/social-media-resizer/';
  const social = () => K.once('img:social', () => within(SM, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    const r = await K.img.results(p);
    const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    const caps = await K.img.caps(p);
    return { kinds: r.map((b) => K.kind(b)), dims: d.map((x) => x.w + '×' + x.h), caps };
  }));
  claim(SM, 'works', '16 presets cover Instagram, Facebook, X, LinkedIn, YouTube, Pinterest, TikTok, WhatsApp and the web, from a 600×200 email header to 2560×1440 channel art.', 'all 16 sizes come out, smallest 600×200, largest 2560×1440', B, async () => {
    const s = await social();
    return [s.dims.length === 16 && s.dims.indexOf('600×200') >= 0 && s.dims.indexOf('2560×1440') >= 0, s.dims.length + ': ' + s.dims.join(', ')];
  });
  claim(SM, 'mistake', 'All 16 are on when the page opens', 'with nothing unticked, 16 files', B, async () => { const s = await social(); return [s.dims.length === 16, s.dims.length + ' files']; });
  claim(SM, 'point', 'Photos are enlarged as readily as reduced, even past their own size.', 'a 1600 px photo becomes 2560×1440', B, async () => { const s = await social(); return [s.dims.indexOf('2560×1440') >= 0, s.dims.indexOf('2560×1440') >= 0 ? 'made' : 'missing']; });
  claim(SM, 'dfaq', 'What size is an Instagram story? => 1080×1920 pixels'.replace(/^.*=> /, ''), 'a 1080×1920 slot', B, async () => { const s = await social(); return [s.dims.indexOf('1080×1920') >= 0, s.dims.join(',')]; });
  claim(SM, 'dfaq', '1280×720 pixels, the 16:9 preset here.', 'a 1280×720 slot', B, async () => { const s = await social(); return [s.dims.indexOf('1280×720') >= 0, s.dims.join(',')]; });
  claim(SM, 'point', 'Fit whole image takes the smaller factor and paints the rest in the bar colour, near-black navy (#0a0e1a) by default.', 'contain: story bars are #0a0e1a', B, async () => within(SM, async (p) => {
    await K.img.set(p, 'mode', 'contain'); await K.img.set(p, 'format', 'image/png');
    await K.img.upload(p, [S('food.jpg')]);
    const r = await K.img.results(p);
    for (const b of r) { const d = await K.img.pixels(p, b, [[5, 5]]); if (d.w === 1080 && d.h === 1920) return [close(d.px[0], [10, 14, 26, 255], 1), K.j(d.px[0])]; }
    return [false, 'no story slot'];
  }));
  claim(SM, 'point', 'Files are JPEG, PNG or WebP at a fixed quality of 90, named after their slot.', 'JPEG by default, no quality control, slot names', B, async () => within(SM, async (p) => {
    await K.img.upload(p, [S('food.jpg')]);
    await K.clearDownloads(p);
    if (!await K.clickText(p, '.tool-io button', /as ZIP/)) return [false, 'no ZIP'];
    await p.waitForFunction(() => window.__downloads.length > 0, { timeout: 60000 });
    const [d] = await K.downloads(p);
    const z = K.zipNames(d.bytes).map((x) => x.name);
    const q = await p.$('#ic-quality');
    return [!q && z.length === 16 && z.every((n) => /^food-[a-z0-9-]+\.jpg$/.test(n)), z.slice(0, 4).join(', ') + ' …'];
  }));
  /* the worked example: portrait.jpg with only Instagram Story / Reel, LinkedIn Cover and YouTube Thumbnail ticked (presets 2, 8, 9) */
  const smThree = (mode) => K.once('img:social3:' + mode, () => within(SM, async (p) => {
    await p.$$eval('.preset-list input[type=checkbox]', (l) => l.forEach((c) => { c.checked = ['2', '8', '9'].indexOf(c.value) >= 0; c.dispatchEvent(new Event('change', { bubbles: true })); }));
    await K.img.set(p, 'mode', mode);
    await K.img.upload(p, [S('portrait.jpg')]);
    const r = await K.img.results(p);
    const d = await Promise.all(r.map((b) => K.img.pixels(p, b)));
    return { files: r.map((b, i) => ({ dim: d[i].w + '×' + d[i].h, n: b.length, jpeg: K.isJpeg(b) })), total: r.reduce((s, b) => s + b.length, 0) };
  }));
  claim(SM, 'dfaq', 'As JPEG it stays small: the 1600×1067 portrait photo from the example above, on Fill and crop, made a 185.8 KB thumbnail.', 'portrait.jpg, Fill and crop: the 1280×720 JPEG', B, async () => {
    const s = await smThree('cover'); const t = s.files.find((f) => f.dim === '1280×720');
    const src = await within(SM, (p) => K.img.pixels(p, fs.readFileSync(S('portrait.jpg'))));
    return [!!t && t.jpeg && near(t.n, '185.8 KB') && src.w === 1600 && src.h === 1067, 'source ' + src.w + '×' + src.h + '; thumbnail ' + (t ? fmtKB(t.n) + (t.jpeg ? ' JPEG' : ' not JPEG') : 'missing')];
  });
  claim(SM, 'what', 'Fit whole image kept every pixel, but the 1080×1920 story is mostly bars around a band of photo; the three files came to 429.7 KB. Fill and crop filled every frame, 580.9 KB in all,',
    'portrait.jpg to the three slots: totals for Fit and for Fill', B, async () => {
      const a = await smThree('contain'), b = await smThree('cover');
      const dims = (s) => s.files.map((f) => f.dim).sort().join(',');
      return [dims(a) === '1080×1920,1280×720,1584×396' && dims(b) === dims(a) && near(a.total, '429.7 KB') && near(b.total, '580.9 KB'), 'fit ' + fmtKB(a.total) + ' (' + dims(a) + '), fill ' + fmtKB(b.total)];
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

  /* ---------- manual ---------- */
  manual(CO, 'tip', 'WebP is typically 25–35% smaller than JPEG at the same visual quality, and every current browser supports it.', 'Needs a perceptual-quality comparison over a corpus and a browser-support source; not a property of this tool.');
  manual(CO, 'tip', 'Quality 80 is the usual sweet spot for photographs.', 'Perceptual judgement.');
  manual(BR, 'tip', 'Both blur and pixelation have been reversed in published research, particularly on short strings like numbers.', 'Research claim; needs a citation, not a run.');
  manual(PP, 'tip', 'It does not check the compositional rules — head size, expression, background uniformity', 'A statement of absence (no face detection); confirmed by reading the code, not by a run.');
  manual(PP, 'tip', 'a 25 MB model and the runtime are fetched from this site the first time, then kept by your browser.', 'Model size and browser caching; image-fixes.js runs the MODNet cut-out, caching needs a real profile.');
  manual(MG, 'tip', 'Impact is the traditional meme typeface. If it is not installed the browser falls back to a similar condensed bold face.', 'Font availability depends on the device.');
  manual(SM, 'tip', 'Sizes change. These are current at the time of writing', 'Platform image sizes need each platform\'s current documentation with a date.');
  manual(EV, 'tip', 'Social networks usually strip metadata on upload, but file sharing, email attachments and cloud links generally do not.', 'Behaviour of third-party services.');
  manual(CV, 'what', 'an animated GIF comes out as one still frame', 'Needs an animated GIF fixture and a frame count of the output; not automated here.');
  manual(SPL, 'tip', 'For a 3×3 profile mosaic, upload the tiles in reverse order. The grid fills right to left, bottom to top.', 'Instagram behaviour.');
  manual(B64, 'mistake', 'Gmail and many other webmail clients do not display data: URI images', 'Third-party email client behaviour.');
};
