/**
 * Carousel Maker (/social/carousel-maker/).
 *
 * Slides of text, each with an optional photo, drawn on a canvas in one of
 * seven templates at 1080 × 1350 (Instagram's 4:5 portrait) or 1080 × 1080,
 * with a progress indicator, a "Swipe" cue, a handle and a logo. Exports a
 * ZIP of PNGs named carousel-01.png … (engine/social-kit.js zip) and one
 * PDF with a page per slide for LinkedIn (social-kit.js pdfFromJpegs).
 * Nothing leaves the device.
 *
 * One drawing function, renderSlide(ctx, W, H, index), is used for the
 * preview and every export, and returns the boxes it drew text in, so the
 * tests can prove that nothing leaves the frame or runs into the indicator.
 *
 * Remembered in localStorage '1234tools-social-carousel-v1': the size, the
 * template and the indicator settings. The slides' words and photos are
 * not kept. The brand kit (colours, fonts, handle, logo) is kept only when
 * the visitor presses Save, in the keys social-kit.js owns, and is shared
 * with the Social Post Maker.
 */
(function () {
  'use strict';
  const A = window.AIImg, SK = window.SocialKit;
  if (!A || !SK) return;
  const { el, button, check, field, select, colour } = A;
  const KEY = '1234tools-social-carousel-v1';
  const MAX_SLIDES = 20;
  const SIZES = { portrait: { w: 1080, h: 1350, label: '1080 × 1350 (4:5 portrait)' }, square: { w: 1080, h: 1080, label: '1080 × 1080 (square)' } };
  const TEMPLATES = [
    ['bold-hook', 'Bold hook'], ['numbered-tips', 'Numbered tips'], ['quote', 'Quote'], ['before-after', 'Before and after'],
    ['checklist', 'Checklist'], ['minimal', 'Minimal'], ['gradient', 'Gradient']
  ];
  const SAMPLE = [
    { title: '5 ways to make product photos sell', body: 'The checklist we run before every launch. Swipe through.' },
    { title: 'Use daylight', body: 'Shoot beside a window in the morning. Turn the flash off.' },
    { title: 'Clean the background', body: 'A plain wall or a sheet of white card is enough.' },
    { title: 'Show it in use', body: 'One photo of the product in someone’s hands.\nScale matters.' },
    { title: 'Save this for later', body: 'Follow for a new checklist every week.' }
  ];
  let seq = 0;
  const newSlide = (o) => Object.assign({ id: 's' + (++seq), title: '', body: '', img: null, imgName: '' }, o || {});

  /* ------------------------------------------------------------------ */
  /* drawing                                                            */
  /* ------------------------------------------------------------------ */
  const headWeight = (f) => (f === 'Sora' ? 800 : f === 'Inter' ? 600 : 700);
  const bodyWeight = (f) => (f === 'Sora' || f === 'Inter' ? 400 : 400);

  const stack = (ctx, box, items, o) => SK.stack(ctx, box, items, o);

  /**
   * Paint slide `i` of the state on a W × H context. Returns { boxes,
   * content, chrome, truncated }: content is the box text may use; chrome
   * holds the indicator, cue, handle and logo boxes.
   */
  function renderSlide(S, ctx, W, H, i, logoImg) {
    const n = S.slides.length;
    const s = S.slides[i] || newSlide();
    const B = S.brand;
    const m = Math.round(W * 0.074);
    const unit = W / 1080;
    const top = Math.round(80 * unit), bottom = Math.round(96 * unit);
    const content = { x: m, y: top + Math.round(16 * unit), w: W - 2 * m, h: H - top - bottom - Math.round(32 * unit) };
    const HF = (px) => SK.font(B.headFont, headWeight(B.headFont), px);
    const BF = (px) => SK.font(B.bodyFont, bodyWeight(B.bodyFont), px);
    const BF6 = (px) => SK.font(B.bodyFont, 600, px);
    let fg = B.fg;
    const boxes = [];
    ctx.save();
    ctx.textBaseline = 'middle';

    /* background */
    const tpl = S.template;
    const fullBleed = s.img && (tpl === 'bold-hook' || tpl === 'quote' || tpl === 'gradient');
    if (tpl === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, B.bg); g.addColorStop(1, B.accent);
      ctx.fillStyle = g;
    } else ctx.fillStyle = B.bg;
    ctx.fillRect(0, 0, W, H);
    if (fullBleed) {
      SK.cover(ctx, s.img, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.45, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      fg = '#ffffff';
    }
    let box = Object.assign({}, content);
    if (s.img && !fullBleed) {
      const ph = Math.round(box.h * 0.42);
      ctx.save();
      SK.roundRect(ctx, box.x, box.y, box.w, ph, 28 * unit); ctx.clip();
      SK.cover(ctx, s.img, box.x, box.y, box.w, ph);
      ctx.restore();
      boxes.push({ x: box.x, y: box.y, w: box.w, h: ph, role: 'photo' });
      box = { x: box.x, y: box.y + ph + Math.round(36 * unit), w: box.w, h: box.h - ph - Math.round(36 * unit) };
    }

    const title = s.title, body = s.body;
    let r;
    if (tpl === 'bold-hook' || tpl === 'gradient') {
      const align = tpl === 'gradient' ? 'center' : 'left';
      const bar = Math.round(14 * unit);
      r = stack(ctx, { x: box.x, y: box.y, w: box.w, h: box.h - bar - Math.round(28 * unit) }, [
        { text: title, font: HF, maxPx: 120 * unit, minPx: 34 * unit, lh: 1.08, color: fg, share: 0.62, gap: Math.round(60 * unit), role: 'title' },
        { text: body, font: BF, maxPx: 50 * unit, minPx: 24 * unit, lh: 1.32, color: fg, role: 'body' }
      ], { align, valign: 'center' });
      if (r.boxes.length) {
        const t = r.boxes[0];
        const bw = Math.round(150 * unit);
        const bx = align === 'center' ? box.x + (box.w - bw) / 2 : box.x;
        ctx.fillStyle = tpl === 'gradient' ? fg : B.accent;
        ctx.fillRect(bx, t.y + t.h + Math.round(22 * unit), bw, bar);
      }
    } else if (tpl === 'numbered-tips') {
      const d = Math.round(118 * unit);
      ctx.fillStyle = B.accent;
      ctx.beginPath(); ctx.arc(box.x + d / 2, box.y + d / 2, d / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SK.contrast(B.accent, '#000000') > SK.contrast(B.accent, '#ffffff') ? '#111111' : '#ffffff';
      ctx.font = HF(Math.round(56 * unit)); ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), box.x + d / 2, box.y + d / 2 + 2 * unit);
      ctx.textAlign = 'left';
      boxes.push({ x: box.x, y: box.y, w: d, h: d, role: 'number' });
      const g = d + Math.round(40 * unit);
      r = stack(ctx, { x: box.x, y: box.y + g, w: box.w, h: box.h - g }, [
        { text: title, font: HF, maxPx: 92 * unit, minPx: 32 * unit, lh: 1.1, color: fg, share: 0.55, gap: Math.round(36 * unit), role: 'title' },
        { text: body, font: BF, maxPx: 48 * unit, minPx: 24 * unit, lh: 1.35, color: fg, role: 'body' }
      ], { align: 'left', valign: 'top' });
    } else if (tpl === 'quote') {
      const q = Math.round(200 * unit);
      ctx.fillStyle = fullBleed ? '#ffffff' : B.accent;
      ctx.font = SK.font('Georgia', 700, q); ctx.textAlign = 'left';
      ctx.fillText('“', box.x - 6 * unit, box.y + q * 0.42);
      boxes.push({ x: box.x, y: box.y, w: q * 0.5, h: q * 0.62, role: 'mark' });
      const g = Math.round(q * 0.62);
      r = stack(ctx, { x: box.x, y: box.y + g, w: box.w, h: box.h - g }, [
        { text: body || title, font: (px) => SK.font(B.headFont, 600, px), maxPx: 84 * unit, minPx: 28 * unit, lh: 1.22, color: fg, share: 0.8, gap: Math.round(44 * unit), role: 'quote' },
        { text: body ? (title ? '— ' + title : '') : '', font: BF6, maxPx: 40 * unit, minPx: 22 * unit, lh: 1.3, color: fullBleed ? '#ffffff' : B.accent, role: 'by' }
      ], { align: 'left', valign: 'center' });
    } else if (tpl === 'before-after') {
      const gap = Math.round(28 * unit);
      const ph = (box.h - gap) / 2;
      const labH = Math.round(70 * unit);
      const panels = [['Before', title, SK.rgba(B.fg, 0.08), fg], ['After', body, B.accent, SK.contrast(B.accent, '#000000') > SK.contrast(B.accent, '#ffffff') ? '#111111' : '#ffffff']];
      r = { boxes: [] };
      panels.forEach((p, k) => {
        const py = box.y + k * (ph + gap);
        ctx.fillStyle = p[2];
        SK.roundRect(ctx, box.x, py, box.w, ph, 28 * unit); ctx.fill();
        const pad = Math.round(36 * unit);
        ctx.fillStyle = p[3]; ctx.font = BF6(Math.round(30 * unit)); ctx.textAlign = 'left';
        ctx.fillText(p[0].toUpperCase(), box.x + pad, py + pad + 15 * unit);
        boxes.push({ x: box.x + pad, y: py + pad, w: ctx.measureText(p[0].toUpperCase()).width, h: 30 * unit, role: 'label' });
        const sr = stack(ctx, { x: box.x + pad, y: py + pad + labH, w: box.w - 2 * pad, h: ph - 2 * pad - labH }, [
          { text: p[1], font: k ? HF : BF, maxPx: (k ? 76 : 60) * unit, minPx: 22 * unit, lh: 1.18, color: p[3], role: k ? 'after' : 'before' }
        ], { align: 'left', valign: 'center' });
        r.boxes.push(...sr.boxes);
      });
    } else if (tpl === 'checklist') {
      const head = stack(ctx, { x: box.x, y: box.y, w: box.w, h: box.h * 0.3 }, [
        { text: title, font: HF, maxPx: 84 * unit, minPx: 30 * unit, lh: 1.1, color: fg, role: 'title' }
      ], { align: 'left', valign: 'top' });
      const ly = (head.boxes.length ? head.bottom : box.y) + Math.round(40 * unit);
      const list = drawChecklist(ctx, { x: box.x, y: ly, w: box.w, h: box.y + box.h - ly }, body, BF, fg, B.accent, unit);
      r = { boxes: head.boxes.concat(list) };
    } else { /* minimal */
      ctx.fillStyle = B.accent;
      ctx.fillRect(box.x, box.y, Math.round(64 * unit), Math.round(8 * unit));
      boxes.push({ x: box.x, y: box.y, w: Math.round(64 * unit), h: Math.round(8 * unit), role: 'rule' });
      const g = Math.round(48 * unit);
      r = stack(ctx, { x: box.x, y: box.y + g, w: box.w, h: box.h - g }, [
        { text: title, font: (px) => SK.font(B.headFont, 600, px), maxPx: 80 * unit, minPx: 30 * unit, lh: 1.12, color: fg, share: 0.5, gap: Math.round(32 * unit), role: 'title' },
        { text: body, font: BF, maxPx: 44 * unit, minPx: 22 * unit, lh: 1.42, color: SK.rgba(fg, 0.86), role: 'body' }
      ], { align: 'left', valign: 'top' });
    }
    boxes.push(...r.boxes);

    /* chrome: indicator, cue, handle, logo */
    const chrome = [];
    const accentOnPhoto = fullBleed ? '#ffffff' : (tpl === 'gradient' ? fg : B.accent);
    const cy = H - bottom / 2 - 8 * unit;
    if (S.progress === 'bar') {
      const bh = Math.round(10 * unit);
      ctx.fillStyle = SK.rgba(fullBleed ? '#ffffff' : B.fg, 0.18); ctx.fillRect(0, 0, W, bh);
      ctx.fillStyle = accentOnPhoto; ctx.fillRect(0, 0, W * (i + 1) / n, bh);
      chrome.push({ x: 0, y: 0, w: W, h: bh, role: 'progress' });
    } else if (S.progress === 'dots' && n > 1) {
      const r0 = Math.max(4, Math.min(9, 150 / n) * unit), gap = r0 * 2.6;
      const total = (n - 1) * gap;
      const x0 = W / 2 - total / 2;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = k === i ? accentOnPhoto : SK.rgba(fullBleed ? '#ffffff' : B.fg, 0.3);
        ctx.beginPath(); ctx.arc(x0 + k * gap, cy, k === i ? r0 * 1.25 : r0, 0, Math.PI * 2); ctx.fill();
      }
      chrome.push({ x: x0 - r0 * 1.25, y: cy - r0 * 1.25, w: total + r0 * 2.5, h: r0 * 2.5, role: 'progress' });
    }
    if (S.progress === 'number' && n > 1) {
      const t = (i + 1) + ' / ' + n;
      ctx.font = BF6(Math.round(30 * unit)); ctx.textAlign = 'right'; ctx.fillStyle = fullBleed ? '#ffffff' : SK.rgba(fg, 0.8);
      const tw = ctx.measureText(t).width;
      ctx.fillText(t, W - m, top / 2 + 8 * unit);
      chrome.push({ x: W - m - tw, y: top / 2 + 8 * unit - 17 * unit, w: tw, h: 34 * unit, role: 'number' });
    }
    if (S.swipe && i < n - 1) {
      ctx.font = BF6(Math.round(30 * unit)); ctx.textAlign = 'right'; ctx.fillStyle = accentOnPhoto;
      const aw = Math.round(34 * unit);
      const t = 'Swipe';
      const tw = ctx.measureText(t).width;
      const ax = W - m;
      ctx.fillText(t, ax - aw - 12 * unit, cy);
      ctx.strokeStyle = accentOnPhoto; ctx.lineWidth = Math.max(2, 4 * unit); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ax - aw, cy); ctx.lineTo(ax, cy); ctx.moveTo(ax - 12 * unit, cy - 11 * unit); ctx.lineTo(ax, cy); ctx.lineTo(ax - 12 * unit, cy + 11 * unit); ctx.stroke();
      chrome.push({ x: ax - aw - 12 * unit - tw, y: cy - 17 * unit, w: tw + aw + 12 * unit, h: 34 * unit, role: 'swipe' });
    }
    const handle = String(B.handle || '').trim();
    if (S.showHandle && handle) {
      ctx.font = BF6(Math.round(28 * unit)); ctx.textAlign = 'left'; ctx.fillStyle = fullBleed ? '#ffffff' : SK.rgba(fg, 0.85);
      let t = handle;
      const room = W * 0.42;
      while (t.length > 1 && ctx.measureText(t).width > room) t = t.slice(0, -1);
      if (t !== handle) t = t.slice(0, -1) + '…';
      ctx.fillText(t, m, cy);
      chrome.push({ x: m, y: cy - 16 * unit, w: ctx.measureText(t).width, h: 32 * unit, role: 'handle' });
    }
    if (logoImg) {
      const lh = Math.round(52 * unit);
      const lw = Math.min(W * 0.28, lh * (logoImg.width / logoImg.height));
      const lhh = lw / (logoImg.width / logoImg.height);
      const ly = (top - lhh) / 2 + 8 * unit;
      ctx.drawImage(logoImg, m, ly, lw, lhh);
      chrome.push({ x: m, y: ly, w: lw, h: lhh, role: 'logo' });
    }
    ctx.restore();
    return { boxes, chrome, content, truncated: boxes.some((b) => b.truncated) };
  }

  /** A list with a drawn check box before each line of `text`, shrunk until it fits. */
  function drawChecklist(ctx, box, text, BF, fg, accent, unit) {
    const items = String(text || '').split('\n').map((t) => t.trim()).filter(Boolean);
    if (!items.length || box.h <= 0) return [];
    let px = 50 * unit;
    const minPx = 22 * unit;
    let laid;
    for (;;) {
      const ind = px * 1.5, gap = px * 0.6, lh = px * 1.3;
      ctx.font = BF(px);
      const wrapped = items.map((t) => SK.wrapText(ctx, t, box.w - ind));
      const h = wrapped.reduce((s, ls) => s + ls.length * lh, 0) + gap * (items.length - 1);
      const w = Math.max(...wrapped.map((ls) => Math.max(...ls.map((l) => ctx.measureText(l).width)))) + ind;
      laid = { px, ind, gap, lh, wrapped, h, w };
      if ((h <= box.h && w <= box.w + 0.5) || px <= minPx) break;
      px = Math.max(minPx, Math.floor(px * 0.94));
    }
    const out = [];
    let y = box.y;
    let truncated = false;
    ctx.font = BF(laid.px); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (let k = 0; k < laid.wrapped.length; k++) {
      const ls = laid.wrapped[k];
      if (y + laid.lh > box.y + box.h + 0.5) { truncated = true; break; }
      const sz = laid.px * 0.9;
      ctx.fillStyle = accent;
      SK.roundRect(ctx, box.x, y + (laid.lh - sz) / 2, sz, sz, sz * 0.22); ctx.fill();
      ctx.strokeStyle = SK.contrast(accent, '#000000') > SK.contrast(accent, '#ffffff') ? '#111111' : '#ffffff';
      ctx.lineWidth = Math.max(2, sz * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const bx = box.x, by = y + (laid.lh - sz) / 2;
      ctx.beginPath(); ctx.moveTo(bx + sz * 0.24, by + sz * 0.52); ctx.lineTo(bx + sz * 0.43, by + sz * 0.7); ctx.lineTo(bx + sz * 0.77, by + sz * 0.3); ctx.stroke();
      ctx.fillStyle = fg;
      let drawn = 0;
      for (const l of ls) {
        if (y + laid.lh > box.y + box.h + 0.5) { truncated = true; break; }
        ctx.fillText(l, box.x + laid.ind, y + laid.lh / 2);
        out.push({ x: box.x + laid.ind, y, w: ctx.measureText(l).width, h: laid.lh, role: 'item', px: laid.px });
        y += laid.lh; drawn++;
      }
      y += laid.gap;
    }
    if (truncated && out.length) out[out.length - 1].truncated = true;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* the page                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const saved = SK.store.get(KEY, {}) || {};
    const bk = SK.brand.load();
    const S = {
      size: SIZES[saved.size] ? saved.size : 'portrait',
      template: TEMPLATES.some((t) => t[0] === saved.template) ? saved.template : 'bold-hook',
      progress: ['dots', 'bar', 'number', 'none'].includes(saved.progress) ? saved.progress : 'dots',
      swipe: saved.swipe !== false,
      showHandle: saved.showHandle !== false,
      slides: SAMPLE.map((x) => newSlide(x)),
      brand: Object.assign({}, bk.kit),
      logoUrl: bk.logo, logo: null,
      current: 0,
      brandSaved: bk.saved
    };
    const remember = () => SK.store.set(KEY, { size: S.size, template: S.template, progress: S.progress, swipe: S.swipe, showHandle: S.showHandle });

    const wrap = el('div', 'aiimg social-carousel');
    const studio = el('div', 'aiimg-studio');
    const stageCol = el('div', 'aiimg-stagecol');
    const phone = el('div', 'social-phone');
    const canvas = el('canvas', 'aiimg-canvas social-phone-screen');
    canvas.tabIndex = 0;
    phone.appendChild(canvas);
    const nav = el('div', 'aiimg-transport social-nav');
    const prevB = button('← Previous', 'btn-ghost', () => go(S.current - 1));
    const counter = el('span', 'social-counter');
    const nextB = button('Next →', 'btn-ghost', () => go(S.current + 1));
    nav.append(prevB, counter, nextB);
    const warn = el('p', 'field-hint social-warn'); warn.setAttribute('aria-live', 'polite');
    stageCol.append(phone, nav, warn);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['slides', 'Slides'], ['design', 'Design'], ['brand', 'Brand'], ['export', 'Export']]) {
      const b = button(label, 'chip', () => showPane(k));
      b.dataset.pane = k; b.setAttribute('role', 'tab'); b.id = 'car-tab-' + k;
      tabs.appendChild(b);
      const p = el('div', 'aiimg-pane'); p.dataset.pane = k; p.hidden = true; p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
      panes[k] = p;
    }
    side.appendChild(tabs);
    for (const k in panes) side.appendChild(panes[k]);
    studio.append(stageCol, side);
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    wrap.append(studio, msg);
    io.appendChild(wrap);

    function showPane(k) {
      for (const b of tabs.children) { const on = b.dataset.pane === k; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
      for (const p in panes) panes[p].hidden = p !== k;
    }
    function say(text, kind) { msg.textContent = text || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); }

    /* ---------- preview ---------- */
    const pctx = canvas.getContext('2d');
    let queued = false, last = null;
    function draw() {
      queued = false;
      const z = SIZES[S.size];
      if (canvas.width !== z.w || canvas.height !== z.h) { canvas.width = z.w; canvas.height = z.h; }
      S.current = Math.max(0, Math.min(S.current, S.slides.length - 1));
      last = renderSlide(S, pctx, z.w, z.h, S.current, S.logo);
      counter.textContent = 'Slide ' + (S.current + 1) + ' of ' + S.slides.length;
      canvas.setAttribute('aria-label', 'Preview of slide ' + (S.current + 1) + ' of ' + S.slides.length + ' at ' + z.w + ' by ' + z.h + '. Left and right arrow keys move between slides.');
      prevB.disabled = S.current === 0; nextB.disabled = S.current >= S.slides.length - 1;
      editors.forEach((ed, k) => ed.classList.toggle('is-current', k === S.current));
      clearTimeout(checkTimer);
      checkTimer = setTimeout(checkAll, 250);
    }
    /* every slide, not only the one on show, is measured for text that had
       to be cut — after typing pauses, so typing stays quick */
    let checkTimer = 0;
    function checkAll() {
      const cut = [];
      S.slides.forEach((s, k) => { const r = k === S.current && last ? last : measureSlide(k); if (r.truncated) cut.push(k + 1); });
      const c = SK.contrast(S.brand.bg, S.brand.fg);
      warn.textContent = (cut.length ? 'Too much text to fit on slide ' + cut.join(', ') + ': it is cut with “…”. Shorten it or split it across two slides. ' : '') +
        (c < 4.5 ? 'Text and background contrast is ' + c.toFixed(1) + ':1; WCAG asks for at least 4.5:1 for body text.' : '');
      warn.dataset.cut = cut.join(',');
    }
    const scratch = document.createElement('canvas');
    function measureSlide(k) {
      const z = SIZES[S.size];
      scratch.width = z.w; scratch.height = z.h;
      return renderSlide(S, scratch.getContext('2d'), z.w, z.h, k, S.logo);
    }
    const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
    function go(k) { S.current = Math.max(0, Math.min(S.slides.length - 1, k)); redraw(); }
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { go(S.current - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { go(S.current + 1); e.preventDefault(); }
    });
    /* swipe on the preview */
    let sx = null;
    canvas.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    canvas.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) go(S.current + (e.clientX < sx ? 1 : -1)); sx = null; });

    /* ---------- slides pane ---------- */
    const drop = el('div', 'dropzone social-drop');
    drop.tabIndex = 0; drop.setAttribute('role', 'button');
    drop.innerHTML = '<strong>Add photos</strong><span>Choose or drop images: each goes on the next slide without one. Nothing is uploaded.</span>';
    const multi = el('input', 'visually-hidden'); multi.type = 'file'; multi.accept = 'image/*'; multi.multiple = true; multi.setAttribute('aria-label', 'Choose photos for the slides');
    const list = el('div', 'social-slides');
    const addB = button('+ Add a slide', 'btn-ghost', () => {
      if (S.slides.length >= MAX_SLIDES) { say('A carousel here has up to ' + MAX_SLIDES + ' slides.', 'error'); return; }
      S.slides.push(newSlide({ title: 'New slide', body: '' })); S.current = S.slides.length - 1; buildList(); redraw();
      const ed = editors[S.current]; if (ed) ed.querySelector('input').focus();
    });
    const resetB = button('Start from the example', 'btn-ghost', () => { S.slides = SAMPLE.map((x) => newSlide(x)); S.current = 0; buildList(); redraw(); });
    const clearB = button('Clear all slides', 'btn-ghost', () => { S.slides = [newSlide({ title: '', body: '' })]; S.current = 0; buildList(); redraw(); });
    const slideRow = el('div', 'aiimg-row'); slideRow.append(addB, resetB, clearB);
    panes.slides.append(drop, multi, list, slideRow, el('p', 'field-hint', 'Up to ' + MAX_SLIDES + ' slides. A line break in the text box starts a new line on the slide; in the Checklist template each line is one item, and in Before and after the heading is the before and the text is the after.'));
    drop.addEventListener('click', () => multi.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); multi.click(); } });
    multi.addEventListener('change', () => { addPhotos(multi.files); multi.value = ''; });
    for (const t of [drop, list]) {
      t.addEventListener('dragover', (e) => { e.preventDefault(); t.classList.add('is-over'); });
      t.addEventListener('dragleave', () => t.classList.remove('is-over'));
    }
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); addPhotos(e.dataTransfer.files); });

    async function addPhotos(files, target) {
      const fl = Array.from(files || []);
      if (!fl.length) return;
      say('Reading ' + fl.length + ' file' + (fl.length === 1 ? '' : 's') + '…');
      const r = await SK.readImages(fl);
      let placed = 0, extra = 0;
      for (const im of r.ok) {
        let k = target !== undefined && placed === 0 ? target : S.slides.findIndex((s) => !s.img);
        if (k < 0) {
          if (S.slides.length >= MAX_SLIDES) { extra++; continue; }
          S.slides.push(newSlide({ title: '', body: '' })); k = S.slides.length - 1;
        }
        S.slides[k].img = im.canvas; S.slides[k].imgName = im.name;
        if (placed === 0) S.current = k;
        placed++;
      }
      buildList(); redraw();
      const parts = [];
      if (placed) parts.push(placed + ' photo' + (placed === 1 ? '' : 's') + ' added.');
      if (extra) parts.push(extra + ' not added: the carousel is full at ' + MAX_SLIDES + ' slides.');
      r.errors.forEach((e) => parts.push(e.message));
      say(parts.join(' '), r.errors.length || extra ? 'error' : 'ok');
    }

    let editors = [];
    function buildList() {
      list.replaceChildren();
      editors = S.slides.map((s, k) => {
        const ed = el('div', 'social-slide');
        ed.dataset.slide = String(k + 1);
        const head = el('div', 'social-slide-head');
        head.appendChild(el('strong', null, 'Slide ' + (k + 1)));
        const up = button('↑', 'btn-ghost social-mini', () => move(k, -1)); up.setAttribute('aria-label', 'Move slide ' + (k + 1) + ' up'); up.disabled = k === 0;
        const dn = button('↓', 'btn-ghost social-mini', () => move(k, 1)); dn.setAttribute('aria-label', 'Move slide ' + (k + 1) + ' down'); dn.disabled = k === S.slides.length - 1;
        const del = button('Delete', 'btn-ghost social-mini', () => remove(k)); del.setAttribute('aria-label', 'Delete slide ' + (k + 1)); del.disabled = S.slides.length === 1;
        head.append(up, dn, del);
        const t = el('input', 'control'); t.type = 'text'; t.id = 'car-title-' + (k + 1); t.value = s.title; t.maxLength = 300;
        const b = el('textarea', 'control'); b.id = 'car-body-' + (k + 1); b.value = s.body; b.rows = 3; b.maxLength = 1200;
        t.addEventListener('input', () => { s.title = t.value; S.current = k; redraw(); });
        b.addEventListener('input', () => { s.body = b.value; S.current = k; redraw(); });
        for (const x of [t, b]) x.addEventListener('focus', () => { if (S.current !== k) { S.current = k; redraw(); } });
        const photo = el('div', 'social-slide-photo');
        const pf = el('input', 'visually-hidden'); pf.type = 'file'; pf.accept = 'image/*'; pf.id = 'car-photo-' + (k + 1);
        pf.setAttribute('aria-label', 'Choose a photo for slide ' + (k + 1));
        const pick = button(s.img ? 'Change photo' : 'Add a photo', 'btn-ghost social-mini', () => pf.click());
        pf.addEventListener('change', () => { addPhotos(pf.files, k); pf.value = ''; });
        photo.append(pick, pf);
        if (s.img) {
          photo.appendChild(el('span', 'social-photo-name', s.imgName));
          photo.appendChild(button('Remove photo', 'btn-ghost social-mini', () => { s.img = null; s.imgName = ''; buildList(); redraw(); }));
        }
        ed.append(head, field('Heading', t), field('Text', b), photo);
        ed.addEventListener('dragover', (e) => { e.preventDefault(); ed.classList.add('is-over'); });
        ed.addEventListener('dragleave', () => ed.classList.remove('is-over'));
        ed.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); ed.classList.remove('is-over'); addPhotos(e.dataTransfer.files, k); });
        list.appendChild(ed);
        return ed;
      });
    }
    list.addEventListener('drop', (e) => { e.preventDefault(); list.classList.remove('is-over'); });
    function move(k, d) {
      const j = k + d;
      if (j < 0 || j >= S.slides.length) return;
      const t = S.slides[k]; S.slides[k] = S.slides[j]; S.slides[j] = t;
      S.current = j; buildList(); redraw();
      const ed = editors[j]; if (ed) { const b = ed.querySelectorAll('.social-mini')[d < 0 ? 0 : 1]; if (b && !b.disabled) b.focus(); }
    }
    function remove(k) {
      if (S.slides.length <= 1) return;
      S.slides.splice(k, 1); S.current = Math.min(k, S.slides.length - 1); buildList(); redraw();
    }

    /* ---------- design pane ---------- */
    const sizeSel = select('car-size', Object.entries(SIZES).map(([k, z]) => [k, z.label]), S.size);
    const tplSel = select('car-template', TEMPLATES, S.template);
    const progSel = select('car-progress', [['dots', 'Dots'], ['bar', 'Bar along the top'], ['number', 'Slide number (3 / 8)'], ['none', 'None']], S.progress);
    const swipeC = check('car-swipe', 'Show a “Swipe” cue on every slide but the last', S.swipe);
    const handleC = check('car-show-handle', 'Show the handle on every slide', S.showHandle);
    const tplChips = el('div', 'aiimg-presets social-tpls');
    TEMPLATES.forEach(([k, label]) => {
      const c = button(label, 'chip', () => { tplSel.value = k; S.template = k; remember(); syncChips(); redraw(); });
      c.dataset.template = k; tplChips.appendChild(c);
    });
    function syncChips() { for (const c of tplChips.children) c.setAttribute('aria-pressed', c.dataset.template === S.template ? 'true' : 'false'); }
    sizeSel.addEventListener('change', () => { S.size = sizeSel.value; remember(); redraw(); });
    tplSel.addEventListener('change', () => { S.template = tplSel.value; remember(); syncChips(); redraw(); });
    progSel.addEventListener('change', () => { S.progress = progSel.value; remember(); redraw(); });
    swipeC.input.addEventListener('change', () => { S.swipe = swipeC.input.checked; remember(); redraw(); });
    handleC.input.addEventListener('change', () => { S.showHandle = handleC.input.checked; remember(); redraw(); });
    panes.design.append(field('Size', sizeSel, '1080 × 1350 fills more of the feed on Instagram; LinkedIn shows either.'), field('Template', tplSel), tplChips,
      field('Progress indicator', progSel), swipeC, handleC);

    /* ---------- brand pane ---------- */
    const bgC = colour('car-bg', S.brand.bg), fgC = colour('car-fg', S.brand.fg), acC = colour('car-accent', S.brand.accent);
    const hfSel = select('car-headfont', SK.HEAD_FONTS.map((f) => [f, f]), S.brand.headFont);
    const bfSel = select('car-bodyfont', SK.BODY_FONTS.map((f) => [f, f]), S.brand.bodyFont);
    const handleIn = el('input', 'control'); handleIn.type = 'text'; handleIn.id = 'car-handle'; handleIn.value = S.brand.handle; handleIn.placeholder = '@yourname'; handleIn.maxLength = 60;
    const logoIn = el('input', 'visually-hidden'); logoIn.type = 'file'; logoIn.accept = 'image/*'; logoIn.id = 'car-logo'; logoIn.setAttribute('aria-label', 'Choose a logo');
    const logoB = button('Add a logo', 'btn-ghost', () => logoIn.click());
    const logoX = button('Remove logo', 'btn-ghost', () => { S.logoUrl = null; S.logo = null; logoX.hidden = true; redraw(); });
    logoX.hidden = !S.logoUrl;
    const saveB = button('Save brand kit on this device', 'btn-primary', () => {
      const ok = SK.brand.save(S.brand, S.logoUrl);
      S.brandSaved = ok; brandNote.textContent = ok ? 'Saved in this browser. The Social Post Maker uses it too.' : 'This browser would not keep it (private mode or storage full).';
      forgetB.hidden = !ok;
    });
    const forgetB = button('Forget the saved kit', 'btn-ghost', () => { SK.brand.forget(); S.brandSaved = false; forgetB.hidden = true; brandNote.textContent = 'The saved kit is gone from this browser.'; });
    forgetB.hidden = !S.brandSaved;
    const brandNote = el('p', 'field-hint', S.brandSaved ? 'Loaded the brand kit saved in this browser.' : 'Nothing here is kept unless you press Save.');
    const grid = (a, b) => { const g = el('div', 'aiimg-grid2'); g.append(a, b); return g; };
    const onBrand = () => {
      Object.assign(S.brand, { bg: bgC.value, fg: fgC.value, accent: acC.value, headFont: hfSel.value, bodyFont: bfSel.value, handle: handleIn.value });
      SK.fontsReady([[S.brand.headFont, headWeight(S.brand.headFont)], [S.brand.bodyFont, 400], [S.brand.bodyFont, 600]]).then(redraw);
      redraw();
    };
    [bgC, fgC, acC].forEach((c) => c.addEventListener('input', onBrand));
    [hfSel, bfSel].forEach((c) => c.addEventListener('change', onBrand));
    handleIn.addEventListener('input', onBrand);
    logoIn.addEventListener('change', async () => {
      const f = logoIn.files[0]; logoIn.value = '';
      if (!f) return;
      try { S.logoUrl = await SK.logoFromFile(f); S.logo = await SK.imageFromDataUrl(S.logoUrl); logoX.hidden = false; say('Logo added: ' + f.name, 'ok'); redraw(); }
      catch (e) { say(e.message, 'error'); }
    });
    const lr = el('div', 'aiimg-row'); lr.append(logoB, logoX, logoIn);
    const sr = el('div', 'aiimg-row'); sr.append(saveB, forgetB);
    panes.brand.append(grid(field('Background', bgC), field('Text', fgC)), grid(field('Accent', acC), field('Handle', handleIn)),
      grid(field('Heading font', hfSel), field('Text font', bfSel)), lr, sr, brandNote,
      el('p', 'field-hint', 'Sora and Inter come with this site. The others are fonts most computers and phones already have; where one is missing, the device draws its nearest sans-serif.'));

    /* ---------- export pane ---------- */
    const job = SK.jobUI();
    const results = el('div', 'aiimg-results');
    const zipB = button('Download a ZIP of PNGs', 'btn-primary', () => exportZip());
    const pdfB = button('Download a PDF for LinkedIn', 'btn-primary', () => exportPdf());
    const oneB = button('Download this slide (PNG)', 'btn-ghost', () => exportOne());
    const er = el('div', 'aiimg-row'); er.append(zipB, pdfB, oneB);
    panes.export.append(el('p', 'field-hint', 'The ZIP holds one PNG per slide, named carousel-01.png, carousel-02.png and so on, in order — upload them together as one Instagram post. The PDF has one page per slide: on LinkedIn, add it as a document and it shows as a carousel people swipe through.'),
      er, job.el, results);

    function frame(k) {
      const z = SIZES[S.size];
      const c = document.createElement('canvas'); c.width = z.w; c.height = z.h;
      renderSlide(S, c.getContext('2d'), z.w, z.h, k, S.logo);
      return c;
    }
    function addResult(blob, name, meta) {
      const row = el('div', 'aiimg-result');
      const head = el('div', 'aiimg-result-head');
      head.append(el('strong', null, name), el('span', null, A.fmtBytes(blob.size) + ' · ' + meta), button('Download', 'btn-download', () => A.download(blob, name)));
      row.appendChild(head);
      results.insertBefore(row, results.firstChild);
    }
    const busy = (on) => { zipB.disabled = pdfB.disabled = oneB.disabled = on; };
    async function exportZip() {
      const z = SIZES[S.size];
      const n = S.slides.length;
      const signal = job.start('Drawing slide 1 of ' + n + '…');
      busy(true);
      try {
        await SK.fontsReady([[S.brand.headFont, headWeight(S.brand.headFont)], [S.brand.bodyFont, 400], [S.brand.bodyFont, 600]]);
        const files = [];
        for (let k = 0; k < n; k++) {
          if (signal.aborted) throw SK.abortError();
          job.set(k / (n + 1), 'Drawing slide ' + (k + 1) + ' of ' + n + '…');
          const blob = await SK.canvasBlob(frame(k), 'image/png');
          files.push({ name: 'carousel-' + String(k + 1).padStart(2, '0') + '.' + SK.extFor(blob.type), blob });
          await SK.yieldNow();
        }
        job.set(n / (n + 1), 'Packing the ZIP…');
        const zip = await SK.zip(files, { signal });
        const name = 'carousel-' + z.w + 'x' + z.h + '.' + SK.extFor(zip.type);
        addResult(zip, name, n + ' PNG' + (n === 1 ? '' : 's') + ', ' + z.w + ' × ' + z.h);
        A.download(zip, name);
        job.done('Saved ' + name + ': ' + n + ' slides.', 'ok');
      } catch (e) {
        job.done(e && e.name === 'AbortError' ? 'Cancelled. Nothing was saved.' : 'The export failed: ' + (e && e.message || e), e && e.name === 'AbortError' ? '' : 'error');
      } finally { busy(false); }
    }
    async function exportPdf() {
      const z = SIZES[S.size];
      const n = S.slides.length;
      const signal = job.start('Drawing page 1 of ' + n + '…');
      busy(true);
      try {
        await SK.fontsReady([[S.brand.headFont, headWeight(S.brand.headFont)], [S.brand.bodyFont, 400], [S.brand.bodyFont, 600]]);
        const pages = [];
        for (let k = 0; k < n; k++) {
          if (signal.aborted) throw SK.abortError();
          job.set(k / (n + 1), 'Drawing page ' + (k + 1) + ' of ' + n + '…');
          pages.push({ blob: await SK.canvasBlob(frame(k), 'image/jpeg', 0.92) });
          await SK.yieldNow();
        }
        job.set(n / (n + 1), 'Writing the PDF…');
        const title = (S.slides[0].title || 'Carousel').slice(0, 120);
        const pdf = await SK.pdfFromJpegs(pages, { title, signal });
        const name = 'carousel-linkedin.' + SK.extFor(pdf.type);
        addResult(pdf, name, n + ' page' + (n === 1 ? '' : 's') + ', ' + z.w + ' × ' + z.h + ' px each');
        A.download(pdf, name);
        job.done('Saved ' + name + ': ' + n + ' pages.', 'ok');
      } catch (e) {
        job.done(e && e.name === 'AbortError' ? 'Cancelled. Nothing was saved.' : 'The export failed: ' + (e && e.message || e), e && e.name === 'AbortError' ? '' : 'error');
      } finally { busy(false); }
    }
    async function exportOne() {
      const z = SIZES[S.size];
      const blob = await SK.canvasBlob(frame(S.current), 'image/png');
      const name = 'carousel-' + String(S.current + 1).padStart(2, '0') + '.' + SK.extFor(blob.type);
      addResult(blob, name, z.w + ' × ' + z.h);
      A.download(blob, name);
    }

    buildList(); syncChips(); showPane('slides');
    if (S.logoUrl) SK.imageFromDataUrl(S.logoUrl).then((im) => { S.logo = im; redraw(); }).catch(() => { S.logoUrl = null; });
    SK.fontsReady([['Sora', 800], ['Sora', 600], ['Inter', 400], ['Inter', 600], [S.brand.headFont, headWeight(S.brand.headFont)], [S.brand.bodyFont, 400]]).then(redraw);
    draw();
    const api = { state: S, renderSlide: (ctx, W, H, k) => renderSlide(S, ctx, W, H, k, S.logo), measureSlide, go, addPhotos, exportZip, exportPdf, TEMPLATES, SIZES };
    root.__carousel = api;
    return api;
  }

  A.tools['carousel-maker'] = { mount, renderSlide, TEMPLATES, SIZES };
})();
