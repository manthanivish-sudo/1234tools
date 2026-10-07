/**
 * Social Post Maker (/social/social-post-maker/).
 *
 * Quote and announcement images from nine templates, in the visitor's brand
 * kit (colours, logo, a heading font and a text font from fixed lists),
 * drawn for every platform size in SocialKit.SIZES at once. One drawing
 * function, renderPost(ctx, W, H), serves the preview, the size grid and
 * every export; it lays the post out from the frame's own proportions —
 * margins and type are measured from the short side, a wide frame moves
 * the decoration aside — and fits every block of text with the shrink loop
 * (SocialKit.fitText), so no text is drawn outside the frame at any size.
 * It returns the boxes it drew, for the tests.
 *
 * Exports: one PNG per ticked size (post-<size id>-<w>x<h>.png) and a ZIP
 * of them all. Remembered in '1234tools-social-post-maker-v1': the template,
 * the preview size, the ticked sizes and the handle switch. The words are
 * not kept. The brand kit is kept only when Save is pressed (social-kit.js
 * keys, shared with the Carousel Maker).
 */
(function () {
  'use strict';
  const A = window.AIImg, SK = window.SocialKit;
  if (!A || !SK) return;
  const { el, button, check, field, select, colour } = A;
  const KEY = '1234tools-social-post-maker-v1';

  /* the templates, each with the example its fields start from */
  const TEMPLATES = [
    { id: 'quote', name: 'Quote', label: '', align: 'center', ex: { heading: '', text: 'Good coffee takes time. So does good work.', footer: 'Small Batch Café' } },
    { id: 'announcement', name: 'Announcement', label: 'Announcement', align: 'left', ex: { heading: 'We’re open on Sundays', text: 'From 5 October, 10 am to 4 pm. Same menu, same team.', footer: 'smallbatch.example.com' } },
    { id: 'offer', name: 'Offer', label: 'Offer', align: 'center', ex: { heading: '20% off', text: 'Everything in the autumn range, this weekend only.', footer: 'Code AUTUMN20' } },
    { id: 'event', name: 'Event', label: 'Event', align: 'left', ex: { heading: 'Open studio evening', text: 'Thursday 16 October, 6–9 pm\nUnit 4, Mill Lane', footer: 'Free, book a place via the link in bio' } },
    { id: 'stat', name: 'Big number', label: '', align: 'center', ex: { heading: '1,200', text: 'orders packed by hand this month. Thank you.', footer: '' } },
    { id: 'tip', name: 'Tip', label: 'Tip', align: 'left', ex: { heading: 'Back up before you update', text: 'Two minutes now saves a lost weekend later.', footer: '' } },
    { id: 'question', name: 'Question', label: '', align: 'center', ex: { heading: 'Tea or coffee first thing?', text: '', footer: 'Tell us in the comments' } },
    { id: 'hiring', name: 'We’re hiring', label: 'We’re hiring', align: 'left', ex: { heading: 'Part-time barista', text: '20 hours a week, weekends included. Training given.', footer: 'Apply: jobs@example.com' } },
    { id: 'launch', name: 'New', label: 'New', align: 'left', ex: { heading: 'The winter blend is here', text: 'Dark chocolate, orange peel and a long finish.', footer: 'In the shop and online now' } }
  ];
  const tplOf = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
  const headWeight = (f) => (f === 'Sora' ? 800 : f === 'Inter' ? 600 : 700);
  const inkOn = (bg) => (SK.contrast(bg, '#000000') > SK.contrast(bg, '#ffffff') ? '#111111' : '#ffffff');

  /**
   * Paint the post on a W × H context. P = { template, heading, text,
   * footer, brand, showHandle }. Returns { boxes, chrome, content, truncated }.
   */
  function renderPost(P, ctx, W, H, logoImg) {
    const t = tplOf(P.template);
    const B = P.brand;
    const short = Math.min(W, H);
    /* type grows with how long the frame is for its short side, so a wide
       or tall frame is not left with a postage stamp of text in the middle;
       the shrink loop still has the last word */
    const u = short / 1080 * Math.min(1.35, Math.sqrt(Math.max(W, H) / short));
    const wide = W / H > 1.4, tall = H / W > 1.4;
    const m = Math.round(short * (wide ? 0.075 : 0.085));
    /* 9:16: the top and bottom 250 px (of 1920) are where the app draws its
       own buttons and the reply bar, so nothing is drawn there */
    const safe = H / W >= 1.7 ? Math.round(H * 250 / 1920) : 0;
    const mt = Math.max(m, safe), mb = Math.max(m, safe);
    const HF = (px) => SK.font(B.headFont, headWeight(B.headFont), px);
    const HF6 = (px) => SK.font(B.headFont, 600, px);
    const BF = (px) => SK.font(B.bodyFont, 400, px);
    const BF6 = (px) => SK.font(B.bodyFont, 600, px);
    let fg = B.fg;
    const boxes = [], chrome = [];
    ctx.save();
    ctx.textBaseline = 'middle';

    /* background and decoration */
    let bg = B.bg;
    if (t.id === 'offer') bg = B.accent;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (t.id === 'offer') fg = inkOn(bg);
    const acc = t.id === 'offer' ? fg : B.accent;
    if (t.id === 'announcement' || t.id === 'launch' || t.id === 'hiring') {
      /* a band of the accent down the side (wide) or along the bottom */
      ctx.fillStyle = B.accent;
      if (wide) ctx.fillRect(W - Math.round(W * 0.03), 0, Math.round(W * 0.03), H);
      else ctx.fillRect(0, H - Math.round(short * 0.025), W, Math.round(short * 0.025));
    } else if (t.id === 'stat' || t.id === 'question') {
      ctx.fillStyle = SK.rgba(B.accent, 0.14);
      const r = short * 0.62;
      ctx.beginPath(); ctx.arc(wide ? W * 0.82 : W * 0.85, wide ? H * 0.2 : H * 0.12, r, 0, Math.PI * 2); ctx.fill();
    } else if (t.id === 'event') {
      ctx.strokeStyle = SK.rgba(B.accent, 0.9); ctx.lineWidth = Math.max(3, 10 * u);
      SK.roundRect(ctx, m / 2, m / 2, W - m, H - m, 24 * u); ctx.stroke();
    }

    /* top band: the logo and the label */
    const topH = Math.round(short * 0.075);
    let topUsed = false;
    if (logoImg) {
      const lh = topH;
      const ratio = logoImg.width / logoImg.height;
      const lw = Math.min(W * 0.3, lh * ratio), lhh = lw / ratio;
      ctx.drawImage(logoImg, m, mt + (lh - lhh) / 2, lw, lhh);
      chrome.push({ x: m, y: mt + (lh - lhh) / 2, w: lw, h: lhh, role: 'logo' });
      topUsed = true;
    }
    if (t.label) {
      const px = Math.round(30 * u);
      ctx.font = BF6(px);
      const tx = t.label.toUpperCase();
      const tw = ctx.measureText(tx).width;
      const ph = Math.round(px * 1.9), pw = Math.min(W - 2 * m, tw + px * 1.6);
      const lx = logoImg ? W - m - pw : (t.align === 'center' ? (W - pw) / 2 : m);
      const ly = mt + (topH - ph) / 2;
      ctx.fillStyle = t.id === 'offer' ? fg : B.accent;
      SK.roundRect(ctx, lx, ly, pw, ph, ph / 2); ctx.fill();
      ctx.fillStyle = inkOn(t.id === 'offer' ? fg : B.accent); ctx.textAlign = 'center';
      ctx.fillText(tx, lx + pw / 2, ly + ph / 2);
      chrome.push({ x: lx, y: ly, w: pw, h: ph, role: 'label' });
      topUsed = true;
    }

    /* bottom band: the handle */
    const handle = String(B.handle || '').trim();
    const botH = P.showHandle && handle ? Math.round(short * 0.06) : 0;
    if (botH) {
      ctx.font = BF6(Math.round(28 * u)); ctx.textAlign = t.align === 'center' ? 'center' : 'left';
      ctx.fillStyle = SK.rgba(fg, 0.8);
      let s = handle;
      while (s.length > 1 && ctx.measureText(s).width > W - 2 * m) s = s.slice(0, -1);
      if (s !== handle) s = s.slice(0, -1) + '…';
      const hy = H - mb - botH / 2;
      const hw = ctx.measureText(s).width;
      ctx.fillText(s, t.align === 'center' ? W / 2 : m, hy);
      chrome.push({ x: t.align === 'center' ? (W - hw) / 2 : m, y: hy - 16 * u, w: hw, h: 32 * u, role: 'handle' });
    }

    const gapTop = topUsed ? topH + Math.round(short * 0.04) : 0;
    const content = { x: m, y: mt + gapTop, w: W - 2 * m - (wide && (t.id === 'announcement' || t.id === 'launch' || t.id === 'hiring') ? W * 0.03 : 0), h: H - mt - mb - gapTop - (botH ? botH + Math.round(short * 0.03) : 0) };
    let box = Object.assign({}, content);
    const align = t.align;

    /* the big mark of the quote and the question */
    if (t.id === 'quote' || t.id === 'question') {
      const q = Math.round(short * 0.2);
      const mark = t.id === 'quote' ? '“' : '?';
      ctx.font = SK.font(t.id === 'quote' ? 'Georgia' : B.headFont, 700, q);
      ctx.fillStyle = B.accent; ctx.textAlign = 'center';
      const mh = q * 0.62;
      ctx.fillText(mark, W / 2, box.y + q * (t.id === 'quote' ? 0.42 : 0.36));
      chrome.push({ x: W / 2 - q * 0.3, y: box.y, w: q * 0.6, h: mh, role: 'mark' });
      box = { x: box.x, y: box.y + mh + Math.round(short * 0.02), w: box.w, h: box.h - mh - Math.round(short * 0.02) };
    }

    const H1 = t.id === 'stat' || t.id === 'offer' ? 260 : 110;
    const items = [];
    if (t.id === 'quote') {
      items.push({ text: P.heading, font: BF6, maxPx: 34 * u, minPx: 18 * u, lh: 1.3, color: B.accent, share: 0.15, gap: 24 * u, role: 'heading' });
      items.push({ text: P.text, font: HF6, maxPx: 96 * u, minPx: 22 * u, lh: 1.2, color: fg, share: 0.8, gap: 40 * u, role: 'text' });
      items.push({ text: P.footer ? '— ' + P.footer : '', font: BF6, maxPx: 40 * u, minPx: 18 * u, lh: 1.3, color: B.accent, role: 'footer' });
    } else {
      items.push({ text: P.heading, font: HF, maxPx: H1 * u, minPx: 26 * u, lh: 1.08, color: t.id === 'stat' ? B.accent : fg, share: t.id === 'stat' ? 0.5 : 0.6, gap: 34 * u, role: 'heading' });
      items.push({ text: P.text, font: BF, maxPx: 52 * u, minPx: 18 * u, lh: 1.35, color: SK.rgba(fg, t.id === 'offer' ? 1 : 0.9), share: 0.55, gap: 40 * u, role: 'text' });
      items.push({ text: P.footer, font: BF6, maxPx: 38 * u, minPx: 18 * u, lh: 1.3, color: t.id === 'offer' ? fg : B.accent, role: 'footer' });
    }
    const valign = tall ? 'center' : (t.id === 'event' || t.id === 'tip' ? 'top' : 'center');
    const r = SK.stack(ctx, box, items, { align, valign });
    boxes.push(...r.boxes);

    /* offer: a pill round the footer code */
    if (t.id === 'offer') {
      const f = r.boxes.find((b) => b.role === 'footer');
      if (f) {
        ctx.strokeStyle = fg; ctx.lineWidth = Math.max(2, 4 * u);
        const pad = Math.min(16 * u, m * 0.5);
        SK.roundRect(ctx, Math.max(1, f.x - pad * 1.5), f.y - pad * 0.4, Math.min(W - 2, f.w + pad * 3), f.h + pad * 0.8, (f.h + pad) / 2); ctx.stroke();
      }
    }
    ctx.restore();
    return { boxes, chrome, content, safe, truncated: boxes.some((b) => b.truncated) };
  }

  /* ------------------------------------------------------------------ */
  /* the page                                                           */
  /* ------------------------------------------------------------------ */
  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const saved = SK.store.get(KEY, {}) || {};
    const bk = SK.brand.load();
    const tpl0 = tplOf(saved.template);
    const P = {
      template: tpl0.id,
      heading: tpl0.ex.heading, text: tpl0.ex.text, footer: tpl0.ex.footer,
      brand: Object.assign({}, bk.kit),
      showHandle: saved.showHandle !== false,
      preview: SK.size(saved.preview) ? saved.preview : 'ig-square',
      sizes: Array.isArray(saved.sizes) ? saved.sizes.filter((id) => SK.size(id)) : SK.SIZES.map((s) => s.id),
      logoUrl: bk.logo, logo: null, brandSaved: bk.saved, edited: false
    };
    if (!P.sizes.length) P.sizes = SK.SIZES.map((s) => s.id);
    const remember = () => SK.store.set(KEY, { template: P.template, preview: P.preview, sizes: P.sizes, showHandle: P.showHandle });

    const wrap = el('div', 'aiimg social-post');
    const studio = el('div', 'aiimg-studio');
    const stageCol = el('div', 'aiimg-stagecol');
    const stage = el('div', 'aiimg-stage social-post-stage');
    const canvas = el('canvas', 'aiimg-canvas social-post-canvas'); canvas.tabIndex = 0;
    stage.appendChild(canvas);
    const sizeLine = el('div', 'aiimg-transport');
    const prevSel = select('pm-preview', SK.SIZES.map((s) => [s.id, s.label + ' — ' + s.w + ' × ' + s.h]), P.preview);
    sizeLine.append(el('label', null, 'Preview'), prevSel);
    sizeLine.firstChild.htmlFor = 'pm-preview';
    const gridH = el('h3', 'aiimg-h', 'Every size');
    const thumbs = el('div', 'social-sizes');
    const warn = el('p', 'field-hint social-warn'); warn.setAttribute('aria-live', 'polite');
    stageCol.append(stage, sizeLine, warn, gridH, thumbs);

    const side = el('div', 'aiimg-side');
    const tabs = el('div', 'aiimg-tabs'); tabs.setAttribute('role', 'tablist');
    const panes = {};
    for (const [k, label] of [['words', 'Words'], ['brand', 'Brand'], ['export', 'Export']]) {
      const b = button(label, 'chip', () => showPane(k));
      b.dataset.pane = k; b.setAttribute('role', 'tab'); b.id = 'pm-tab-' + k;
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

    /* ---------- drawing ---------- */
    const pctx = canvas.getContext('2d');
    let queued = false, thumbTimer = 0, last = null;
    const thumbCanvases = {};
    SK.SIZES.forEach((s) => {
      const fig = el('figure', 'social-size');
      fig.dataset.size = s.id;
      const c = el('canvas'); c.width = Math.round(s.w / 6); c.height = Math.round(s.h / 6);
      c.setAttribute('role', 'img'); c.setAttribute('aria-label', s.label + ', ' + s.w + ' by ' + s.h);
      const cap = el('figcaption', null, s.label + ' · ' + s.w + '×' + s.h);
      const b = button('Show', 'btn-ghost social-mini', () => { prevSel.value = s.id; P.preview = s.id; remember(); redraw(); });
      b.setAttribute('aria-label', 'Preview ' + s.label);
      fig.append(c, cap, b);
      thumbs.appendChild(fig);
      thumbCanvases[s.id] = c;
    });
    const full = document.createElement('canvas');
    function renderAt(s, target) {
      target.width = s.w; target.height = s.h;
      return renderPost(P, target.getContext('2d'), s.w, s.h, P.logo);
    }
    function draw() {
      queued = false;
      const s = SK.size(P.preview);
      last = renderAt(s, canvas);
      canvas.setAttribute('aria-label', 'Preview at ' + s.w + ' by ' + s.h + ' for ' + s.label + ': ' + [P.heading, P.text, P.footer].filter(Boolean).join(' — '));
      clearTimeout(thumbTimer);
      thumbTimer = setTimeout(drawThumbs, 200);
    }
    function drawThumbs() {
      const cut = [];
      for (const s of SK.SIZES) {
        const r = renderAt(s, full);
        if (r.truncated) cut.push(s.label);
        const c = thumbCanvases[s.id];
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
        x.clearRect(0, 0, c.width, c.height);
        x.drawImage(full, 0, 0, c.width, c.height);
        c.parentNode.classList.toggle('is-current', s.id === P.preview);
        c.parentNode.classList.toggle('is-off', !P.sizes.includes(s.id));
      }
      const con = SK.contrast(P.brand.bg, P.brand.fg);
      warn.textContent = (cut.length ? 'Too much text for ' + cut.join(', ') + ': it is cut with “…” there. Shorten the text. ' : '') +
        (con < 4.5 && P.template !== 'offer' ? 'Text and background contrast is ' + con.toFixed(1) + ':1; WCAG asks for at least 4.5:1 for body text.' : '');
      warn.dataset.cut = cut.join('|');
    }
    const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
    prevSel.addEventListener('change', () => { P.preview = prevSel.value; remember(); redraw(); });

    /* ---------- words ---------- */
    const tplSel = select('pm-template', TEMPLATES.map((t) => [t.id, t.name]), P.template);
    const chips = el('div', 'aiimg-presets social-tpls');
    TEMPLATES.forEach((t) => { const c = button(t.name, 'chip', () => setTemplate(t.id)); c.dataset.template = t.id; chips.appendChild(c); });
    const head = el('input', 'control'); head.type = 'text'; head.id = 'pm-heading'; head.maxLength = 200;
    const text = el('textarea', 'control'); text.id = 'pm-text'; text.rows = 4; text.maxLength = 600;
    const foot = el('input', 'control'); foot.type = 'text'; foot.id = 'pm-footer'; foot.maxLength = 160;
    const exB = button('Use this template’s example', 'btn-ghost', () => { const t = tplOf(P.template); Object.assign(P, t.ex); P.edited = false; syncFields(); redraw(); });
    const handleC = check('pm-show-handle', 'Show my handle', P.showHandle);
    function syncFields() { head.value = P.heading; text.value = P.text; foot.value = P.footer; }
    function syncChips() { for (const c of chips.children) c.setAttribute('aria-pressed', c.dataset.template === P.template ? 'true' : 'false'); tplSel.value = P.template; }
    function setTemplate(id) {
      P.template = id; remember();
      if (!P.edited) { Object.assign(P, tplOf(id).ex); syncFields(); }
      syncChips(); redraw();
    }
    tplSel.addEventListener('change', () => setTemplate(tplSel.value));
    head.addEventListener('input', () => { P.heading = head.value; P.edited = true; redraw(); });
    text.addEventListener('input', () => { P.text = text.value; P.edited = true; redraw(); });
    foot.addEventListener('input', () => { P.footer = foot.value; P.edited = true; redraw(); });
    handleC.input.addEventListener('change', () => { P.showHandle = handleC.input.checked; remember(); redraw(); });
    panes.words.append(field('Template', tplSel), chips, field('Heading', head, 'The big line: a title, a number, a question.'), field('Text', text, 'A line break here starts a new line. In Quote this is the quote.'),
      field('Small line', foot, 'A name, a date, a code or where to go.'), handleC, exB);

    /* ---------- brand ---------- */
    const bgC = colour('pm-bg', P.brand.bg), fgC = colour('pm-fg', P.brand.fg), acC = colour('pm-accent', P.brand.accent);
    const hfSel = select('pm-headfont', SK.HEAD_FONTS.map((f) => [f, f]), P.brand.headFont);
    const bfSel = select('pm-bodyfont', SK.BODY_FONTS.map((f) => [f, f]), P.brand.bodyFont);
    const handleIn = el('input', 'control'); handleIn.type = 'text'; handleIn.id = 'pm-handle'; handleIn.value = P.brand.handle; handleIn.placeholder = '@yourname'; handleIn.maxLength = 60;
    const logoIn = el('input', 'visually-hidden'); logoIn.type = 'file'; logoIn.accept = 'image/*'; logoIn.id = 'pm-logo'; logoIn.setAttribute('aria-label', 'Choose a logo');
    const logoB = button('Add a logo', 'btn-ghost', () => logoIn.click());
    const logoX = button('Remove logo', 'btn-ghost', () => { P.logoUrl = null; P.logo = null; logoX.hidden = true; redraw(); });
    logoX.hidden = !P.logoUrl;
    const brandNote = el('p', 'field-hint', P.brandSaved ? 'Loaded the brand kit saved in this browser.' : 'Nothing here is kept unless you press Save.');
    const saveB = button('Save brand kit on this device', 'btn-primary', () => {
      const ok = SK.brand.save(P.brand, P.logoUrl);
      P.brandSaved = ok; forgetB.hidden = !ok;
      brandNote.textContent = ok ? 'Saved in this browser. The Carousel Maker uses it too.' : 'This browser would not keep it (private mode or storage full).';
    });
    const forgetB = button('Forget the saved kit', 'btn-ghost', () => { SK.brand.forget(); P.brandSaved = false; forgetB.hidden = true; brandNote.textContent = 'The saved kit is gone from this browser.'; });
    forgetB.hidden = !P.brandSaved;
    const grid = (a, b) => { const g = el('div', 'aiimg-grid2'); g.append(a, b); return g; };
    const fontsNow = () => SK.fontsReady([[P.brand.headFont, headWeight(P.brand.headFont)], [P.brand.headFont, 600], [P.brand.bodyFont, 400], [P.brand.bodyFont, 600]]);
    const onBrand = () => {
      Object.assign(P.brand, { bg: bgC.value, fg: fgC.value, accent: acC.value, headFont: hfSel.value, bodyFont: bfSel.value, handle: handleIn.value });
      fontsNow().then(redraw); redraw();
    };
    [bgC, fgC, acC].forEach((c) => c.addEventListener('input', onBrand));
    [hfSel, bfSel].forEach((c) => c.addEventListener('change', onBrand));
    handleIn.addEventListener('input', onBrand);
    logoIn.addEventListener('change', async () => {
      const f = logoIn.files[0]; logoIn.value = '';
      if (!f) return;
      try { P.logoUrl = await SK.logoFromFile(f); P.logo = await SK.imageFromDataUrl(P.logoUrl); logoX.hidden = false; say('Logo added: ' + f.name, 'ok'); redraw(); }
      catch (e) { say(e.message, 'error'); }
    });
    const lr = el('div', 'aiimg-row'); lr.append(logoB, logoX, logoIn);
    const sr = el('div', 'aiimg-row'); sr.append(saveB, forgetB);
    panes.brand.append(grid(field('Background', bgC), field('Text', fgC)), grid(field('Accent', acC), field('Handle', handleIn)),
      grid(field('Heading font', hfSel), field('Text font', bfSel)), lr, sr, brandNote,
      el('p', 'field-hint', 'Sora and Inter come with this site. The others are fonts most computers and phones already have; where one is missing, the device draws its nearest sans-serif. A logo is shrunk to 512 pixels on its longest side before it is kept.'));

    /* ---------- export ---------- */
    const checks = el('div', 'social-size-checks');
    const boxes = {};
    SK.SIZES.forEach((s) => {
      const c = check('pm-size-' + s.id, s.label + ' — ' + s.w + ' × ' + s.h, P.sizes.includes(s.id));
      c.input.addEventListener('change', () => { P.sizes = SK.SIZES.filter((x) => boxes[x.id].input.checked).map((x) => x.id); remember(); clearTimeout(thumbTimer); thumbTimer = setTimeout(drawThumbs, 50); });
      boxes[s.id] = c; checks.appendChild(c);
    });
    const job = SK.jobUI();
    const results = el('div', 'aiimg-results');
    const zipB = button('Download the ticked sizes (ZIP)', 'btn-primary', () => exportAll(true));
    const eachB = button('Make each one separately', 'btn-ghost', () => exportAll(false));
    const er = el('div', 'aiimg-row'); er.append(zipB, eachB);
    panes.export.append(checks, er, job.el, results,
      el('p', 'field-hint', 'Every image is a PNG drawn at the platform’s own size. “Make each one separately” lists them below with a Download button each.'));
    const nameFor = (s, blob) => 'post-' + s.id + '-' + s.w + 'x' + s.h + '.' + SK.extFor(blob.type);
    function addResult(blob, name, meta) {
      const row = el('div', 'aiimg-result');
      const h = el('div', 'aiimg-result-head');
      h.append(el('strong', null, name), el('span', null, A.fmtBytes(blob.size) + ' · ' + meta), button('Download', 'btn-download', () => A.download(blob, name)));
      row.appendChild(h);
      results.appendChild(row);
    }
    async function exportAll(asZip) {
      const list = SK.SIZES.filter((s) => P.sizes.includes(s.id));
      if (!list.length) { say('Tick at least one size.', 'error'); return; }
      const signal = job.start('Drawing ' + list[0].label + '…');
      zipB.disabled = eachB.disabled = true;
      results.replaceChildren();
      try {
        await fontsNow();
        const files = [];
        for (let k = 0; k < list.length; k++) {
          if (signal.aborted) throw SK.abortError();
          const s = list[k];
          job.set(k / (list.length + 1), 'Drawing ' + s.label + ' (' + (k + 1) + ' of ' + list.length + ')…');
          const c = document.createElement('canvas');
          renderAt(s, c);
          const blob = await SK.canvasBlob(c, 'image/png');
          const name = nameFor(s, blob);
          files.push({ name, blob });
          if (!asZip) addResult(blob, name, s.w + ' × ' + s.h + ' · ' + s.label);
          await SK.yieldNow();
        }
        if (asZip) {
          job.set(list.length / (list.length + 1), 'Packing the ZIP…');
          const zip = await SK.zip(files, { signal });
          const name = 'social-posts-' + P.template + '.' + SK.extFor(zip.type);
          addResult(zip, name, files.length + ' PNG' + (files.length === 1 ? '' : 's'));
          A.download(zip, name);
          job.done('Saved ' + name + ': ' + files.length + ' sizes.', 'ok');
        } else job.done(files.length + ' image' + (files.length === 1 ? '' : 's') + ' ready below.', 'ok');
      } catch (e) {
        job.done(e && e.name === 'AbortError' ? 'Cancelled. Nothing was saved.' : 'The export failed: ' + (e && e.message || e), e && e.name === 'AbortError' ? '' : 'error');
      } finally { zipB.disabled = eachB.disabled = false; }
    }

    syncFields(); syncChips(); showPane('words');
    if (P.logoUrl) SK.imageFromDataUrl(P.logoUrl).then((im) => { P.logo = im; redraw(); }).catch(() => { P.logoUrl = null; });
    SK.fontsReady([['Sora', 800], ['Sora', 600], ['Inter', 400], ['Inter', 600]]).then(() => fontsNow()).then(redraw);
    draw();
    const api = { state: P, renderPost: (ctx, W, H) => renderPost(P, ctx, W, H, P.logo), setTemplate, exportAll, TEMPLATES, drawThumbs };
    root.__post = api;
    return api;
  }

  A.tools['social-post-maker'] = { mount, renderPost, TEMPLATES };
})();
