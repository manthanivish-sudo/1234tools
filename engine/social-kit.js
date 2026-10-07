/**
 * SocialKit — the pieces the /social/ tools share (window.SocialKit).
 *
 * Load order on a tool page: aiimg-core.js, aiimg-share.js, this file, the
 * tool (all `defer`). Nothing here sends anything anywhere.
 *
 *   SIZES                     the platform size table: { id, label, platform, w, h, ratio, source }
 *   store.get(key, fallback)  JSON from localStorage, or fallback (private mode,
 *   store.set(key, value)     blocked storage, bad JSON: never throws)
 *   store.remove(key)
 *   brand.load() / brand.save(kit) / brand.forget()
 *                             the brand kit, kept on this device only when the
 *                             visitor presses Save: colours, fonts and handle
 *                             in '1234tools-social-brand-v1', the logo (a PNG
 *                             data URL, at most 512 px a side) in
 *                             '1234tools-social-logo-v1'
 *   HEAD_FONTS, BODY_FONTS    the fixed font lists (Sora and Inter are served
 *                             by this site; the rest are system fonts)
 *   fontsReady(list)          resolves once the named faces are loaded
 *   graphemes(s)              user-perceived characters (Intl.Segmenter, with
 *                             a code-point fallback that keeps ZWJ sequences,
 *                             variation selectors, skin tones, flags and
 *                             keycaps together)
 *   wrapText(ctx, text, maxW) → lines, breaking at spaces and, for a word
 *                             wider than the line, between graphemes
 *   fitText(ctx, text, o)     the shrink loop: the largest size from o.maxPx
 *                             down to o.minPx at which the wrapped text fits
 *                             o.maxW × o.maxH; at o.minPx it is cut with an
 *                             ellipsis and flagged, never drawn outside
 *   drawFitted(ctx, fit, x, y, o)  paint a fitText result; returns its box
 *   cover(ctx, img, x, y, w, h)    draw an image cropped to fill a box
 *   readImages(files)         → { ok: [{ name, canvas }], errors: [{ name, message }] }
 *   canvasBlob(canvas, type, quality)
 *   zip(files, { onProgress, signal })   → Blob (application/zip), STORE
 *                             method with CRC-32, UTF-8 names, yields between
 *                             files and every 1 MB of CRC
 *   pdfFromJpegs(pages, { title, onProgress, signal }) → Blob (application/pdf):
 *                             one page per JPEG, embedded as-is (DCTDecode),
 *                             page size = the image at 72/96 (1080 px = 810 pt)
 *   extFor(type)              'png' | 'jpg' | 'zip' | 'pdf' | 'webp' | 'bin'
 *   jobUI()                   { el, start(label) → signal, set(p, label), done(text, kind) }:
 *                             a progress bar, a status line and a Cancel button
 *   yieldNow()                a macrotask break so the page can paint and react
 */
(function () {
  'use strict';
  const K = window.SocialKit = window.SocialKit || {};

  /* ------------------------------------------------------------------ */
  /* the size table                                                     */
  /* ------------------------------------------------------------------ */
  /* Checked on the platforms' own pages on 6 October 2026. X's ad specs
     list 16:9 at 1920 × 1080; LinkedIn's single-image spec says 1200 × 628
     for 1.91:1; Meta's sharing guide says "at least 1200 x 630"; Instagram
     takes 1080 px wide between 1.91:1 and 4:5, and 9:16 for stories and
     reels; Pinterest recommends 2:3 at 1000 × 1500; YouTube suggests 1:1
     for images in posts. */
  K.SIZES = [
    { id: 'ig-square', label: 'Instagram post', platform: 'Instagram', w: 1080, h: 1080, ratio: '1:1', source: 'help.instagram.com/1631821640426723' },
    { id: 'ig-portrait', label: 'Instagram portrait', platform: 'Instagram', w: 1080, h: 1350, ratio: '4:5', source: 'help.instagram.com/1631821640426723' },
    { id: 'story', label: 'Story or reel cover', platform: 'Instagram, Facebook', w: 1080, h: 1920, ratio: '9:16', source: 'help.instagram.com/1038071743007909' },
    { id: 'x', label: 'X post', platform: 'X', w: 1920, h: 1080, ratio: '16:9', source: 'business.x.com/en/help/campaign-setup/creative-ad-specifications' },
    { id: 'linkedin', label: 'LinkedIn post', platform: 'LinkedIn', w: 1200, h: 628, ratio: '1.91:1', source: 'linkedin.com/help/lms/answer/a426534' },
    { id: 'facebook', label: 'Facebook link and post', platform: 'Facebook', w: 1200, h: 630, ratio: '1.91:1', source: 'developers.facebook.com/documentation/sharing/webmasters/images' },
    { id: 'pinterest', label: 'Pinterest pin', platform: 'Pinterest', w: 1000, h: 1500, ratio: '2:3', source: 'help.pinterest.com/en/business/article/pinterest-product-specs' },
    { id: 'youtube', label: 'YouTube post', platform: 'YouTube', w: 1080, h: 1080, ratio: '1:1', source: 'support.google.com/youtube/answer/7124474' }
  ];
  K.size = (id) => K.SIZES.find((s) => s.id === id) || null;

  /* ------------------------------------------------------------------ */
  /* storage: every call survives private mode and blocked storage       */
  /* ------------------------------------------------------------------ */
  K.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* nothing kept */ } }
  };

  const BRAND_KEY = '1234tools-social-brand-v1';
  const LOGO_KEY = '1234tools-social-logo-v1';
  K.BRAND_KEY = BRAND_KEY; K.LOGO_KEY = LOGO_KEY;
  K.BRAND_DEFAULT = { bg: '#101627', fg: '#f4f6fb', accent: '#f7c948', headFont: 'Sora', bodyFont: 'Inter', handle: '' };
  K.brand = {
    /** { kit, logo (data URL or null), saved (bool) } */
    load() {
      const kit = K.store.get(BRAND_KEY, null);
      let logo = null;
      try { logo = localStorage.getItem(LOGO_KEY); } catch (e) { logo = null; }
      const clean = Object.assign({}, K.BRAND_DEFAULT);
      if (kit && typeof kit === 'object') {
        for (const k of ['bg', 'fg', 'accent']) if (/^#[0-9a-f]{6}$/i.test(kit[k] || '')) clean[k] = kit[k];
        if (K.HEAD_FONTS.includes(kit.headFont)) clean.headFont = kit.headFont;
        if (K.BODY_FONTS.includes(kit.bodyFont)) clean.bodyFont = kit.bodyFont;
        if (typeof kit.handle === 'string') clean.handle = kit.handle.slice(0, 60);
      }
      return { kit: clean, logo: /^data:image\/png;base64,/.test(logo || '') ? logo : null, saved: !!kit };
    },
    /** Returns true when everything asked for was kept. */
    save(kit, logoDataUrl) {
      const pick = { bg: kit.bg, fg: kit.fg, accent: kit.accent, headFont: kit.headFont, bodyFont: kit.bodyFont, handle: String(kit.handle || '').slice(0, 60) };
      let ok = K.store.set(BRAND_KEY, pick);
      try {
        if (logoDataUrl) localStorage.setItem(LOGO_KEY, logoDataUrl); else localStorage.removeItem(LOGO_KEY);
      } catch (e) { ok = false; }
      return ok;
    },
    forget() { K.store.remove(BRAND_KEY); K.store.remove(LOGO_KEY); }
  };
  /** A logo file → a PNG data URL no bigger than 512 px a side (so it fits in storage). */
  K.logoFromFile = async function (file) {
    const r = await K.readImages([file]);
    if (r.errors.length) throw new Error(r.errors[0].message);
    const c = r.ok[0].canvas;
    const s = Math.min(1, 512 / Math.max(c.width, c.height));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(c.width * s)); out.height = Math.max(1, Math.round(c.height * s));
    const x = out.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(c, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };
  K.imageFromDataUrl = (url) => new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = () => rej(new Error('The saved logo could not be read.'));
    i.src = url;
  });

  /* ------------------------------------------------------------------ */
  /* fonts                                                              */
  /* ------------------------------------------------------------------ */
  K.HEAD_FONTS = ['Sora', 'Inter', 'Georgia', 'Arial Black', 'Impact', 'Trebuchet MS', 'Verdana', 'Times New Roman', 'Courier New'];
  K.BODY_FONTS = ['Inter', 'Sora', 'Georgia', 'Arial', 'Verdana', 'Trebuchet MS', 'Times New Roman'];
  const FALLBACK = '"Segoe UI", system-ui, -apple-system, Arial, sans-serif';
  K.font = (family, weight, px, italic) => (italic ? 'italic ' : '') + (weight || 400) + ' ' + Math.max(1, Math.round(px)) + 'px "' + family + '", ' + FALLBACK;
  K.fontsReady = function (list) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all((list || []).map((f) => document.fonts.load(K.font(f[0], f[1], 40)).catch(() => null))).then(() => undefined);
  };

  /* ------------------------------------------------------------------ */
  /* graphemes                                                          */
  /* ------------------------------------------------------------------ */
  let seg = null;
  try { if (typeof Intl !== 'undefined' && Intl.Segmenter) seg = new Intl.Segmenter('en', { granularity: 'grapheme' }); } catch (e) { seg = null; }
  /* the fallback: join what a grapheme cluster joins in practice. Marks,
     variation selectors, skin tones and tags extend; ZWJ glues the next
     code point; a second regional indicator completes a flag. */
  const EXTEND = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u0610-\u061a\u064b-\u065f\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962\u0963\u0981-\u0983\u09bc-\u09d7\u0a01-\u0a03\u0a3c-\u0a51\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u1ab0-\u1aff\u1dc0-\u1dff\u200c\u20d0-\u20ff\ufe00-\ufe0f\ufe20-\ufe2f]|\ud83c[\udffb-\udfff]|\udb40[\udc20-\udc7f]/;
  const RI = (cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff;
  function graphemesFallback(s) {
    const cps = Array.from(s);
    const out = [];
    for (let i = 0; i < cps.length; i++) {
      const c = cps[i];
      const prev = out.length ? out[out.length - 1] : null;
      if (prev !== null) {
        const last = prev[prev.length - 1] === '\u200d';
        const pairRI = RI(c.codePointAt(0)) && Array.from(prev).length === 1 && RI(prev.codePointAt(0));
        if (EXTEND.test(c) || c === '\u200d' || last || pairRI || (c === '\n' && prev === '\r')) { out[out.length - 1] = prev + c; continue; }
      }
      out.push(c);
    }
    return out;
  }
  K.graphemes = function (s) {
    s = String(s || '');
    if (seg) { const out = []; for (const g of seg.segment(s)) out.push(g.segment); return out; }
    return graphemesFallback(s);
  };
  K.graphemesFallback = graphemesFallback;

  /* ------------------------------------------------------------------ */
  /* text on a canvas                                                   */
  /* ------------------------------------------------------------------ */
  /** Lines of text no wider than maxW at the context's current font. */
  K.wrapText = function (ctx, text, maxW) {
    const lines = [];
    const paras = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    for (const para of paras) {
      const words = para.split(/ +/).filter((w, i, a) => w !== '' || (a.length === 1));
      if (!words.length || (words.length === 1 && words[0] === '')) { lines.push(''); continue; }
      let line = '';
      for (const word of words) {
        const tryLine = line ? line + ' ' + word : word;
        if (ctx.measureText(tryLine).width <= maxW) { line = tryLine; continue; }
        if (line) { lines.push(line); line = ''; }
        if (ctx.measureText(word).width <= maxW) { line = word; continue; }
        /* a word wider than the line: break it between graphemes */
        let part = '';
        for (const g of K.graphemes(word)) {
          if (part && ctx.measureText(part + g).width > maxW) { lines.push(part); part = g; } else part += g;
        }
        line = part;
      }
      lines.push(line);
    }
    return lines;
  };

  /**
   * The shrink loop. o = { font(px) → CSS font, maxW, maxH, maxPx, minPx,
   * lineHeight = 1.2, maxLines? }. Returns { px, lines, lineH, width, height,
   * fits, truncated }. width and height never exceed maxW and maxH.
   */
  K.fitText = function (ctx, text, o) {
    const lh = o.lineHeight || 1.2;
    const minPx = Math.max(6, o.minPx || 12);
    let px = Math.max(minPx, o.maxPx || 64);
    const measure = (p) => {
      ctx.font = o.font(p);
      const lines = K.wrapText(ctx, text, o.maxW);
      const width = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
      return { px: p, lines, lineH: p * lh, width, height: lines.length * p * lh };
    };
    for (;;) {
      const m = measure(px);
      const okLines = !o.maxLines || m.lines.length <= o.maxLines;
      if (m.height <= o.maxH + 0.5 && m.width <= o.maxW + 0.5 && okLines) return Object.assign(m, { fits: true, truncated: false });
      if (px <= minPx) break;
      px = Math.max(minPx, Math.floor(px * 0.94));
    }
    /* still too much at the smallest size: keep what fits and end with an ellipsis */
    const m = measure(minPx);
    const room = Math.max(0, Math.min(o.maxLines || Infinity, Math.floor((o.maxH + 0.5) / m.lineH)));
    if (room === 0) {
      /* not even one line fits: draw nothing rather than draw outside */
      m.lines = []; m.height = 0; m.width = 0;
    } else if (m.lines.length > room) {
      const lines = m.lines.slice(0, room);
      let last = lines[room - 1];
      const gs = K.graphemes(last);
      while (gs.length && ctx.measureText(gs.join('') + '…').width > o.maxW) gs.pop();
      lines[room - 1] = gs.join('').replace(/\s+$/, '') + '…';
      m.lines = lines;
      m.height = lines.length * m.lineH;
      m.width = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
    }
    return Object.assign(m, { fits: false, truncated: true });
  };

  /**
   * Paint a fitText result with its box's top-left at (x, y), aligned in a
   * box of o.boxW (left, centre or right). Returns the painted box
   * { x, y, w, h } for overflow tests. o.font(px) as for fitText.
   */
  K.drawFitted = function (ctx, fit, x, y, o) {
    ctx.save();
    ctx.font = o.font(fit.px);
    ctx.fillStyle = o.color || '#fff';
    ctx.textBaseline = 'middle';
    const align = o.align || 'left';
    ctx.textAlign = align;
    const boxW = o.boxW || fit.width;
    const ax = align === 'center' ? x + boxW / 2 : align === 'right' ? x + boxW : x;
    fit.lines.forEach((line, i) => ctx.fillText(line, ax, y + fit.lineH * (i + 0.5)));
    ctx.restore();
    const left = align === 'center' ? x + (boxW - fit.width) / 2 : align === 'right' ? x + boxW - fit.width : x;
    return { x: left, y, w: fit.width, h: fit.height };
  };

  /**
   * Fit and paint text blocks one under another inside box = { x, y, w, h }.
   * items: [{ text, font(px), maxPx, minPx, lh, color, share (of box.h an
   * item may take when more follow), gap (after it), role }]; empty items are
   * skipped. o: { align: left|center|right, valign: top|center|bottom }.
   * Returns { boxes (each with role, px, truncated), top, bottom }.
   */
  K.stack = function (ctx, box, items, o) {
    o = o || {};
    const live = items.filter((it) => String(it.text || '').trim());
    const gaps = live.slice(0, -1).reduce((s, it) => s + (it.gap || 0), 0);
    let remaining = Math.max(0, box.h - gaps);
    /* each item after this one is promised at least one line at its smallest size */
    const floorOf = (it) => Math.max(6, it.minPx || 12) * (it.lh || 1.15);
    const fits = live.map((it, k) => {
      const last = k === live.length - 1;
      const later = live.slice(k + 1).reduce((s, x) => s + floorOf(x), 0);
      const maxH = last ? remaining : Math.max(0, Math.min(remaining - later, box.h * (it.share || 0.5)));
      const fit = K.fitText(ctx, it.text, { font: it.font, maxW: box.w, maxH, maxPx: it.maxPx, minPx: it.minPx, lineHeight: it.lh || 1.15, maxLines: it.maxLines });
      remaining -= fit.height;
      return fit;
    });
    const total = fits.reduce((s, f) => s + f.height, 0) + gaps;
    let y = o.valign === 'top' ? box.y : o.valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
    const boxes = [];
    fits.forEach((fit, k) => {
      const it = live[k];
      const b = K.drawFitted(ctx, fit, box.x, y, { font: it.font, color: it.color, align: o.align || 'left', boxW: box.w });
      b.role = it.role; b.truncated = fit.truncated; b.px = fit.px;
      boxes.push(b);
      y += fit.height + (it.gap || 0);
    });
    return { boxes, top: boxes.length ? boxes[0].y : box.y, bottom: y - (live.length ? (live[live.length - 1].gap || 0) : 0) };
  };

  /** Draw an image cropped to fill the box (object-fit: cover). */
  K.cover = function (ctx, img, x, y, w, h, fx, fy) {
    const iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih);
    const sw = w / s, sh = h / s;
    const sx = (iw - sw) * (fx === undefined ? 0.5 : fx), sy = (ih - sh) * (fy === undefined ? 0.5 : fy);
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  };
  K.roundRect = function (ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
  /** Relative luminance contrast of two #rrggbb colours (WCAG). */
  K.contrast = function (a, b) {
    const lum = (hex) => {
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
      if (!m) return 0;
      const ch = [1, 2, 3].map((i) => { const v = parseInt(m[i], 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  K.rgba = function (hex, a) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return 'rgba(0,0,0,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  };

  /* ------------------------------------------------------------------ */
  /* files in                                                           */
  /* ------------------------------------------------------------------ */
  const MAX_SIDE = 2400;
  /** Decode each file; a file that is not an image, or will not decode, is reported by name and skipped. */
  K.readImages = async function (files) {
    const ok = [], errors = [];
    for (const f of Array.from(files || [])) {
      const name = String(f.name || 'file');
      if (!/^image\//.test(f.type || '') && !/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i.test(name)) {
        errors.push({ name, message: name + ' is not an image (JPEG, PNG, WebP or GIF).' });
        continue;
      }
      if (f.size > 40 * 1024 * 1024) { errors.push({ name, message: name + ' is over 40 MB; use a smaller copy.' }); continue; }
      try {
        let bmp;
        try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); }
        catch (e) {
          bmp = await new Promise((res, rej) => {
            const url = URL.createObjectURL(f);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); res(img); };
            img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
            img.src = url;
          });
        }
        const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
        if (!w || !h) throw new Error('decode');
        const s = Math.min(1, MAX_SIDE / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
        x.drawImage(bmp, 0, 0, c.width, c.height);
        if (bmp.close) bmp.close();
        ok.push({ name, canvas: c });
      } catch (e) {
        errors.push({ name, message: name + ' could not be read as an image' + (/\.hei[cf]$/i.test(name) ? ' (HEIC needs Safari; convert it to JPEG first).' : ' — it may be damaged.') });
      }
      await K.yieldNow();
    }
    return { ok, errors };
  };

  /* ------------------------------------------------------------------ */
  /* files out                                                          */
  /* ------------------------------------------------------------------ */
  K.yieldNow = () => new Promise((r) => setTimeout(r, 0));
  K.canvasBlob = (canvas, type, quality) => new Promise((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('The browser could not encode the image.'))), type || 'image/png', quality);
  });
  K.extFor = (type) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/zip': 'zip', 'application/pdf': 'pdf', 'image/gif': 'gif', 'text/plain': 'txt' })[String(type || '').split(';')[0]] || 'bin';
  const abortError = () => { const e = new Error('Cancelled.'); e.name = 'AbortError'; return e; };
  K.abortError = abortError;

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  /** CRC-32 (IEEE), yielding every 1 MB so a big file does not freeze the page. */
  K.crc32 = async function (bytes, signal) {
    let c = 0xFFFFFFFF;
    const STEP = 1 << 20;
    for (let at = 0; at < bytes.length; at += STEP) {
      const end = Math.min(bytes.length, at + STEP);
      for (let i = at; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
      if (end < bytes.length) { await K.yieldNow(); if (signal && signal.aborted) throw abortError(); }
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  function dosTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
    const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  /**
   * A ZIP of files = [{ name, blob | bytes }], stored without compression
   * (PNG and JPEG are compressed already). Names are written as UTF-8 with
   * the language-encoding flag set.
   */
  K.zip = async function (files, o) {
    o = o || {};
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const { time, date } = dosTime(new Date());
    const u16 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255]);
    const u32 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
    let i = 0;
    for (const f of files) {
      if (o.signal && o.signal.aborted) throw abortError();
      const name = enc.encode(f.name);
      const data = f.bytes ? new Uint8Array(f.bytes) : new Uint8Array(await f.blob.arrayBuffer());
      const crc = await K.crc32(data, o.signal);
      const head = [u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name];
      const headLen = head.reduce((n, p) => n + p.length, 0);
      parts.push(...head, data);
      central.push([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
      offset += headLen + data.length;
      i++;
      if (o.onProgress) o.onProgress(i / files.length);
      await K.yieldNow();
    }
    const cdStart = offset;
    let cdSize = 0;
    for (const rec of central) for (const p of rec) { parts.push(p); cdSize += p.length; }
    parts.push(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(cdStart), u16(0));
    return new Blob(parts, { type: 'application/zip' });
  };

  /** Width and height of a baseline or progressive JPEG, from its SOF marker. */
  K.jpegSize = function (b) {
    if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xFF) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      const len = (b[i + 2] << 8) | b[i + 3];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8], comps: b[i + 9] };
      }
      i += 2 + len;
    }
    return null;
  };

  /**
   * A PDF with one page per JPEG: pages = [{ bytes (Uint8Array) | blob }].
   * Each image is embedded as it is (DCTDecode) and fills its page, which is
   * the image's pixel size at 96 px to the inch (0.75 pt a pixel).
   */
  K.pdfFromJpegs = async function (pages, o) {
    o = o || {};
    const enc = new TextEncoder();
    const parts = [];
    let pos = 0;
    const offsets = [];
    const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); pos += b.length; };
    const n = pages.length;
    /* objects: 1 catalog, 2 pages, 3 info, then 3 per page: page, image, content */
    const pageObj = (k) => 4 + k * 3;
    put('%PDF-1.4\n');
    put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    const obj = (num, body) => { offsets[num] = pos; put(num + ' 0 obj\n' + body + '\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [' + pages.map((p, k) => pageObj(k) + ' 0 R').join(' ') + '] /Count ' + n + ' >>');
    const pdfStr = (s) => '(' + String(s).replace(/[^\x20-\x7e]/g, '').replace(/([\\()])/g, '\\$1') + ')';
    const now = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    const stamp = 'D:' + now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
    obj(3, '<< /Title ' + pdfStr(o.title || 'Carousel') + ' /Producer (1234tools.com, in the browser) /CreationDate (' + stamp + ') >>');
    for (let k = 0; k < n; k++) {
      if (o.signal && o.signal.aborted) throw abortError();
      const p = pages[k];
      const bytes = p.bytes ? new Uint8Array(p.bytes) : new Uint8Array(await p.blob.arrayBuffer());
      const sz = K.jpegSize(bytes);
      if (!sz) throw new Error('Page ' + (k + 1) + ' is not a JPEG.');
      const pw = +(sz.w * 0.75).toFixed(2), ph = +(sz.h * 0.75).toFixed(2);
      const num = pageObj(k);
      obj(num, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + pw + ' ' + ph + '] /Resources << /XObject << /Im0 ' + (num + 1) + ' 0 R >> >> /Contents ' + (num + 2) + ' 0 R >>');
      offsets[num + 1] = pos;
      put((num + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + sz.w + ' /Height ' + sz.h + ' /ColorSpace ' + (sz.comps === 1 ? '/DeviceGray' : '/DeviceRGB') + ' /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n');
      put(bytes);
      put('\nendstream\nendobj\n');
      const content = 'q ' + pw + ' 0 0 ' + ph + ' 0 0 cm /Im0 Do Q';
      obj(num + 2, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      if (o.onProgress) o.onProgress((k + 1) / n);
      await K.yieldNow();
    }
    const size = 4 + n * 3;
    const xref = pos;
    let x = 'xref\n0 ' + size + '\n0000000000 65535 f \n';
    for (let i = 1; i < size; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    put(x + 'trailer\n<< /Size ' + size + ' /Root 1 0 R /Info 3 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  };

  /* ------------------------------------------------------------------ */
  /* a job: progress, status and Cancel                                 */
  /* ------------------------------------------------------------------ */
  K.jobUI = function () {
    const A = window.AIImg;
    const wrap = document.createElement('div');
    wrap.className = 'social-job';
    const prog = document.createElement('div'); prog.className = 'aiimg-progress'; prog.hidden = true;
    const bar = document.createElement('i'); prog.appendChild(bar);
    prog.setAttribute('role', 'progressbar'); prog.setAttribute('aria-valuemin', '0'); prog.setAttribute('aria-valuemax', '100');
    const row = document.createElement('div'); row.className = 'social-job-row';
    const status = document.createElement('p'); status.className = 'aiimg-status social-job-status'; status.setAttribute('aria-live', 'polite');
    const cancel = A.button('Cancel', 'btn-ghost social-cancel'); cancel.hidden = true;
    row.append(status, cancel);
    wrap.append(prog, row);
    let ctl = null;
    cancel.addEventListener('click', () => { if (ctl) ctl.abort(); });
    return {
      el: wrap, status,
      busy: () => !!ctl,
      start(label) {
        if (ctl) ctl.abort();
        ctl = new AbortController();
        prog.hidden = false; bar.style.width = '0%'; prog.setAttribute('aria-valuenow', '0');
        cancel.hidden = false;
        status.textContent = label || 'Working…';
        status.className = 'aiimg-status social-job-status';
        return ctl.signal;
      },
      set(p, label) {
        const v = Math.round(Math.max(0, Math.min(1, p)) * 100);
        bar.style.width = v + '%'; prog.setAttribute('aria-valuenow', String(v));
        if (label) status.textContent = label;
      },
      done(text, kind) {
        ctl = null; prog.hidden = true; cancel.hidden = true;
        status.textContent = text || '';
        status.className = 'aiimg-status social-job-status' + (kind ? ' is-' + kind : '');
      }
    };
  };

  /** Copy text: the async clipboard, else a hidden textarea. */
  K.copy = async function (text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* fall back */ }
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch (e) { return false; }
  };
})();
