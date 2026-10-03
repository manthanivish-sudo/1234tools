/**
 * AIImg.share — the growth features every /ai-image/ tool can use.
 *
 * Load order on a tool page: aiimg-core.js, this file, then the tool (all
 * `defer`). Everything here runs on the device; nothing is sent anywhere.
 *
 * API (window.AIImg.share)
 *   credit()                 → boolean: the visitor has asked for the small credit
 *   setCredit(on)            → remember it, in localStorage '1234tools-aiimg-credit'
 *   creditControl()          → a `.field-check` (input#aiimg-credit) wired to the two
 *                              above; label "Add a small 1234tools.com credit to the
 *                              corner of clips". Off by default.
 *   drawCredit(ctx, W, H)    → paints "1234tools.com" bottom-right — Sora/Inter at 2.2%
 *                              of the short edge (min 11 px), 14 px padding, white at
 *                              0.85 alpha with a soft dark shadow — ONLY when the credit
 *                              is on. Call it last in render() for GIF and MP4 frames;
 *                              stills may leave it out. Returns whether it drew.
 *   pageUrl()                → this page's URL without query or hash
 *   copyText(text)           → Promise<boolean>: navigator.clipboard, else a hidden
 *                              textarea + execCommand('copy')
 *   captionButton(getText)   → a "Copy caption" .btn-ghost. getText() returns the tool's
 *                              suggested caption (one sentence + 3–5 hashtags); the module
 *                              appends "\nMade free, on my device: <pageUrl>" and shows
 *                              "Copied" on the button for 1.5 s.
 *   presets({ list, root })  → renders `.aiimg-presets` chips (button.chip[data-preset])
 *                              for list = [{ id, label, swatch?, apply() }] into root, plus
 *                              a "Copy link to this look" .btn-ghost. A click calls apply()
 *                              and sets ?preset=<id> on the address bar (replaceState).
 *                              Returns { element, apply(id), current(), applyFromUrl() }.
 *                              The TOOL calls applyFromUrl() when it is ready for a look
 *                              (the image is loaded): it reads ?preset= once and applies it.
 *   presetLink(id)           → absolute URL `pageUrl?preset=<id>`
 *   makingOf(o)              → Promise<{ blob, ext, note }> through AIImg.encodeVideo: a
 *                              9:16 "making-of" clip. o = { title, subtitle?, width = 1080,
 *                              height = 1920, seconds = 6, fps = 30, original (canvas),
 *                              stages: [{ canvas, label }] back to front, final: render(ctx,
 *                              W, H, t) | canvas, onProgress(0..1), signal }. 0–1.5 s the
 *                              original photo on a dark gradient with the title; 1.5–4 s the
 *                              layers slide apart (ease-out, each its own way, labelled) and
 *                              back together; 4–6 s the final render, ending on a 0.5 s
 *                              hold. The credit is drawn if it is on.
 */
(function () {
  'use strict';
  const A = window.AIImg;
  if (!A) return;
  const { el, clamp, lerp, easeOut, button, check } = A;
  const share = A.share = A.share || {};
  const KEY = '1234tools-aiimg-credit';
  const SITE = '1234tools.com';
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const HEAD = '"Sora", "Inter", "Segoe UI", system-ui, sans-serif';
  const BODY = '"Inter", "Sora", "Segoe UI", system-ui, sans-serif';

  /* ------------------------------------------------------------------ */
  /* the credit                                                         */
  /* ------------------------------------------------------------------ */
  function credit() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function setCredit(on) { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { /* private mode: not remembered */ } }
  function creditControl() {
    const c = check('aiimg-credit', 'Add a small 1234tools.com credit to the corner of clips', credit());
    c.input.addEventListener('change', () => setCredit(c.input.checked));
    return c;
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 20px "Sora"').catch(() => {});
    document.fonts.load('700 20px "Sora"').catch(() => {});
  }
  function drawCredit(ctx, W, H, force) {
    if (!force && !credit()) return false;
    const px = Math.max(11, Math.round(Math.min(W, H) * 0.022));
    const pad = Math.max(14, Math.round(px * 0.6));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.font = '600 ' + px + 'px ' + HEAD;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = Math.max(2, px * 0.5);
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = Math.max(1, Math.round(px * 0.08));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(SITE, W - pad, H - pad);
    ctx.restore();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* copying                                                            */
  /* ------------------------------------------------------------------ */
  function pageUrl() { return location.origin + location.pathname; }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* fall through to the textarea */ }
    try {
      const ta = el('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = !!(document.execCommand && document.execCommand('copy'));
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }
  /** Show `text` on the button for 1.5 s, then put its label back. */
  function flash(b, text) {
    if (!b.dataset.label) b.dataset.label = b.textContent;
    b.textContent = text; b.classList.add('is-copied');
    clearTimeout(b._flash);
    b._flash = setTimeout(() => { b.textContent = b.dataset.label; b.classList.remove('is-copied'); }, 1500);
  }
  function captionButton(getText) {
    const b = button('Copy caption', 'btn-ghost');
    b.addEventListener('click', async () => {
      let text = '';
      try { text = String((typeof getText === 'function' ? getText() : getText) || '').trim(); } catch (e) { text = ''; }
      const ok = await copyText((text ? text + '\n' : '') + 'Made free, on my device: ' + pageUrl());
      flash(b, ok ? 'Copied' : 'Could not copy');
    });
    return b;
  }

  /* ------------------------------------------------------------------ */
  /* presets — "looks" with a link each                                 */
  /* ------------------------------------------------------------------ */
  function presetLink(id) { return pageUrl() + '?preset=' + encodeURIComponent(id); }
  function presets(o) {
    const list = (o && o.list) || [];
    const wrap = el('div', 'aiimg-presets');
    wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', 'Looks');
    const chips = new Map();
    let current = null, urlDone = false;
    const mark = () => { for (const [id, c] of chips) { const on = id === current; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); } };
    const apply = (id, fromUrl) => {
      const p = list.find((x) => x.id === id);
      if (!p) return false;
      current = id; mark();
      try { p.apply(); } catch (e) { console.error(e); }
      if (!fromUrl) {
        try { const u = new URL(location.href); u.searchParams.set('preset', id); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* fine */ }
      }
      return true;
    };
    for (const p of list) {
      const c = button(p.label || p.id, 'chip');
      c.dataset.preset = p.id; c.setAttribute('aria-pressed', 'false');
      if (p.swatch) { const s = el('i', 'aiimg-preset-swatch'); s.style.background = p.swatch; c.prepend(s); }
      c.addEventListener('click', () => apply(p.id, false));
      chips.set(p.id, c);
      wrap.appendChild(c);
    }
    const link = button('Copy link to this look', 'btn-ghost');
    link.addEventListener('click', async () => {
      const ok = await copyText(current ? presetLink(current) : pageUrl());
      flash(link, ok ? 'Link copied' : 'Could not copy');
    });
    wrap.appendChild(link);
    if (o && o.root) o.root.appendChild(wrap);
    return {
      element: wrap,
      apply: (id) => apply(id, false),
      current: () => current,
      applyFromUrl: () => {
        if (urlDone) return null;
        urlDone = true;
        let id = null;
        try { id = new URLSearchParams(location.search).get('preset'); } catch (e) { id = null; }
        return id && apply(id, true) ? id : null;
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* the making-of clip                                                 */
  /* ------------------------------------------------------------------ */
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  async function makingOf(o) {
    o = o || {};
    const W = Math.max(2, Math.round(o.width || 1080)), H = Math.max(2, Math.round(o.height || 1920));
    const seconds = clamp(Number(o.seconds) || 6, 3, 20), fps = clamp(Math.round(o.fps) || 30, 10, 60);
    const T1 = Math.min(1.5, seconds * 0.25), T2 = Math.min(4, seconds - 1), HOLD = 0.5;
    const stages = (o.stages || []).filter((s) => s && s.canvas && s.canvas.width && s.canvas.height);
    const original = o.original || (stages[0] && stages[0].canvas);
    if (!original) throw new Error('The making-of needs the original picture.');
    const title = String(o.title || '').trim(), subtitle = String(o.subtitle || '').trim();
    const final = o.final;
    const n = stages.length;

    /* the picture sits under the title, at most 88% wide and the rest tall */
    const ar = original.width / original.height;
    const topY = Math.round(H * (title || subtitle ? 0.19 : 0.1));
    const boxW = Math.round(W * 0.88), boxH = Math.round(H * 0.93) - topY;
    let fw = boxW, fh = Math.round(boxW / ar);
    if (fh > boxH) { fh = boxH; fw = Math.round(boxH * ar); }
    const fx = Math.round((W - fw) / 2), fy = topY + Math.round((boxH - fh) / 2);
    const fin = typeof final === 'function' ? el('canvas') : null;
    if (fin) { fin.width = fw; fin.height = fh; }
    const fctx = fin ? fin.getContext('2d') : null;
    const titlePx = Math.round(W * 0.062), subPx = Math.round(W * 0.028), labelPx = Math.round(W * 0.03);
    const APART = 0.84;
    /* each layer slides its own way along a diagonal: the back one down and
       left, the front one up and right, the middle staying put */
    const peel = (i) => {
      const c = (n - 1) / 2, k = n > 1 ? (i - c) / Math.max(1, c) : 0;
      return { dx: k * fw * 0.14, dy: -k * fh * 0.1, rot: k * 3.5 };
    };
    const fitFont = (ctx, text, px, weight, family, maxW) => {
      for (let p = px; p >= 10; p -= 2) { ctx.font = weight + ' ' + p + 'px ' + family; if (ctx.measureText(text).width <= maxW) return p; }
      return 10;
    };

    function backdrop(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0e1428'); g.addColorStop(1, '#06080f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const r = ctx.createRadialGradient(W / 2, fy + fh / 2, 10, W / 2, fy + fh / 2, Math.max(fw, fh) * 0.8);
      r.addColorStop(0, 'rgba(247,201,72,0.14)'); r.addColorStop(1, 'rgba(247,201,72,0)');
      ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
      if (!title && !subtitle) return;
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let y = H * 0.08;
      if (title) {
        const p = fitFont(ctx, title, titlePx, 700, HEAD, W * 0.86);
        ctx.fillStyle = '#f4f6fb';
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = p * 0.4; ctx.shadowOffsetY = 2;
        ctx.fillText(title, W / 2, y);
        y += p * 0.95;
      }
      if (subtitle) {
        const p = fitFont(ctx, subtitle, subPx, 500, BODY, W * 0.86);
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = 'rgba(244,246,251,0.72)';
        ctx.fillText(subtitle, W / 2, y + p * 0.2);
      }
      ctx.restore();
    }
    function card(ctx, img, x, y, w, h, alpha, rot, scale, shadow) {
      if (alpha <= 0.002) return;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(rot * Math.PI / 180);
      ctx.scale(scale, scale);
      if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = w * 0.06; ctx.shadowOffsetY = w * 0.015; }
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    function pill(ctx, text, x, y, alpha) {
      if (alpha <= 0.01 || !text) return;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font = '600 ' + labelPx + 'px ' + HEAD;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width, ph = labelPx * 1.9, pw = tw + labelPx * 1.4;
      ctx.fillStyle = 'rgba(6,8,15,0.8)';
      roundRect(ctx, x, y - ph / 2, pw, ph, ph / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(247,201,72,0.65)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#f7c948';
      ctx.fillText(text, x + labelPx * 0.7, y + 1);
      ctx.restore();
    }
    /** All the layers, `apart` 0 (stacked) to 1 (spread), at `alpha`. */
    function stack(ctx, apart, alpha) {
      if (!n) { card(ctx, original, fx, fy, fw, fh, alpha, 0, 1, true); return; }
      const sc = lerp(1, APART, apart);
      stages.forEach((s, i) => {
        const p = peel(i);
        card(ctx, s.canvas, fx + p.dx * apart, fy + p.dy * apart, fw, fh, alpha, p.rot * apart, sc, apart > 0.02 || i === 0);
      });
      const la = clamp((apart - 0.55) / 0.45, 0, 1) * alpha;
      stages.forEach((s, i) => {
        const p = peel(i);
        const cx = fx + fw / 2 + p.dx * apart, cy = fy + fh / 2 + p.dy * apart;
        pill(ctx, s.label, cx - fw * sc / 2 + labelPx * 0.5, cy + fh * sc / 2 - labelPx * 1.5, la);
      });
    }
    function render(ctx, w, h, t) {
      backdrop(ctx);
      if (t < T1) {
        /* 1: the original, fading in with a settle; the stack shows through as it goes */
        const a = clamp(t / 0.35, 0, 1), s = lerp(1.04, 1, easeOut(clamp(t / 1.2, 0, 1)));
        const fade = t > T1 - 0.3 ? clamp(1 - (t - (T1 - 0.3)) / 0.3, 0, 1) : 1;
        if (fade < 1) stack(ctx, 0, 1 - fade);
        card(ctx, original, fx, fy, fw, fh, a * fade, 0, s, true);
        return;
      }
      if (t < T2) {
        /* 2: apart in the first 36%, hold to 68%, back together by the end */
        const u = (t - T1) / (T2 - T1);
        const apart = u < 0.36 ? easeOut(u / 0.36) : u < 0.68 ? 1 : 1 - easeInOut((u - 0.68) / 0.32);
        stack(ctx, apart, 1);
        return;
      }
      /* 3: the result, cross-faded in, then held for the last half second */
      const u = t - T2, tf = Math.max(0, Math.min(u, seconds - HOLD - T2));
      const a = clamp(u / 0.3, 0, 1);
      if (a < 1) stack(ctx, 0, 1 - a);
      if (fin) { fctx.clearRect(0, 0, fw, fh); final(fctx, fw, fh, tf); card(ctx, fin, fx, fy, fw, fh, a, 0, 1, true); }
      else if (final) card(ctx, final, fx, fy, fw, fh, a, 0, 1, true);
      else stack(ctx, 0, a);
    }
    const frame = (ctx, w, h, t) => { render(ctx, w, h, t); drawCredit(ctx, w, h); };
    if (document.fonts && document.fonts.load) {
      await Promise.all(['700 40px "Sora"', '600 20px "Sora"', '500 20px "Inter"'].map((f) => document.fonts.load(f).catch(() => {})));
    }
    return A.encodeVideo(frame, { width: W, height: H, fps, duration: seconds, onProgress: o.onProgress, signal: o.signal });
  }

  Object.assign(share, { credit, setCredit, creditControl, drawCredit, pageUrl, copyText, captionButton, presets, presetLink, makingOf });
})();
