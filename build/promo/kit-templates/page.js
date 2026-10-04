'use strict';
/**
 * Runs inside the rendered kit page (page.evaluate) before any screenshot:
 *
 *   1. layout: size framed examples to their image's aspect, place the PDF
 *      page and its loupe on the densest region, place the video inset and
 *      the two-page spread, draw the dotted path between step nodes;
 *   2. fit: every [data-fit] element shrinks from its max to its floor
 *      (binary search); a code pane that still overflows is clipped with a
 *      fade (data-clip), anything else is line-clamped and reported;
 *   3. audit: every text-bearing element must lie inside its clipping
 *      ancestor and inside its canvas (and, on the story, inside the safe
 *      area). Anything that does not is reported as overflow.
 *
 * Returns { overflow: [...], clamped: [...], clipped: [...] }.
 */
async function kitPage(opts) {
  opts = opts || {};
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  await Promise.all(Array.from(document.images).map((i) => (i.decode ? i.decode().catch(() => null) : null)));

  const report = { overflow: [], clamped: [], clipped: [] };
  const where = (el) => {
    const cv = el.closest('.cv');
    const all = Array.from(document.querySelectorAll('.cv'));
    const cls = (el.className && el.className.baseVal == null ? String(el.className) : '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return (cv ? cv.dataset.fmt + (all.length > 1 ? '#' + (all.indexOf(cv) + 1) : '') : '?') + ' ' + el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50) + '"';
  };
  const box = (el) => el.getBoundingClientRect();

  /* ---------- 1. layout (runs after the headlines are fitted) ---------- */
  function layoutFrames() {
  // phones: the largest 0.49-wide frame that fits the zone
  document.querySelectorAll('.phone').forEach((ph) => {
    const zone = ph.parentElement;
    const r = 0.49;
    let H = zone.clientHeight;
    let W = H * r;
    const maxW = ph.classList.contains('small') ? zone.clientWidth * 0.46 : zone.clientWidth;
    if (W > maxW) { W = maxW; H = W / r; }
    ph.style.width = Math.floor(W) + 'px';
    ph.style.height = Math.floor(H) + 'px';
  });
  function contain(el) {
    const host = el.closest('.hero');
    const src = el.querySelector(el.dataset.arFrom || 'img');
    if (!host || !src || !src.naturalWidth) return;
    const f = parseFloat(el.dataset.contain) || 1;
    const ar = src.naturalWidth / src.naturalHeight;
    let W = host.clientWidth * f;
    let H = host.clientHeight * f;
    if (W / H > ar) W = H * ar; else H = W / ar;
    el.style.width = Math.round(W) + 'px';
    el.style.height = Math.round(H) + 'px';
    el.style.flex = '0 0 auto';
  }
  document.querySelectorAll('[data-contain]').forEach(contain);

  // video: the "before" inset hangs off the player's top-left corner
  document.querySelectorAll('.inset[data-inset-of]').forEach((ins) => {
    const host = ins.closest('.hero');
    const pl = host.querySelector(ins.dataset.insetOf);
    const img = ins.querySelector('img');
    if (!pl || !img || !img.naturalWidth) return;
    const hr = box(host), pr = box(pl);
    const w = Math.max(pr.width * 0.34, 120);
    const h = w * img.naturalHeight / img.naturalWidth;
    ins.style.width = Math.round(w) + 'px';
    ins.style.height = Math.round(Math.min(h, pr.height * 0.45)) + 'px';
    ins.style.left = Math.round(Math.max(pr.left - hr.left - w * 0.12, 0)) + 'px';
    ins.style.top = Math.round(Math.max(pr.top - hr.top - 14, 0)) + 'px';
  });

  // pdf edits: two pages side by side, each contained in half the hero
  document.querySelectorAll('[data-pages]').forEach((host) => {
    const figs = host.querySelectorAll('.pg');
    const arrow = host.querySelector('.arrowchip');
    const aw = arrow ? box(arrow).width : 0;
    const availW = (host.clientWidth - aw - 60) / 2;
    const availH = host.clientHeight * 0.86;
    figs.forEach((fg, i) => {
      const img = fg.querySelector('img');
      if (!img.naturalWidth) return;
      const ar = img.naturalWidth / img.naturalHeight;
      let W = availW * (i === 0 ? 0.9 : 1), Hh = availH * (i === 0 ? 0.9 : 1);
      if (W / Hh > ar) W = Hh * ar; else Hh = W / ar;
      fg.style.width = Math.round(W) + 'px';
      fg.style.height = Math.round(Hh) + 'px';
    });
  });

  // PDF viewer: page on the left, a loupe on the densest region
  function densest(img, rw, rh) {
    try {
      const gw = 48, gh = Math.max(8, Math.round(48 * img.naturalHeight / img.naturalWidth));
      const c = document.createElement('canvas');
      c.width = gw; c.height = gh;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, gw, gh);
      const d = g.getImageData(0, 0, gw, gh).data;
      const ink = new Float32Array(gw * gh);
      for (let i = 0; i < gw * gh; i++) ink[i] = 255 - (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11);
      const ww = Math.max(2, Math.round(rw * gw)), wh = Math.max(2, Math.round(rh * gh));
      let best = -1, bx = 0, by = 0;
      for (let y = 0; y + wh <= gh; y++) {
        for (let x = 0; x + ww <= gw; x++) {
          let s = 0;
          for (let yy = y; yy < y + wh; yy++) for (let xx = x; xx < x + ww; xx++) s += ink[yy * gw + xx];
          // a slight pull towards the top: headers and totals read best
          s *= 1 - 0.25 * (y / gh);
          if (s > best) { best = s; bx = x; by = y; }
        }
      }
      return { x: bx / gw, y: by / gh };
    } catch (e) { return { x: 0.05, y: 0.04 }; }
  }
  document.querySelectorAll('[data-doc]').forEach((st) => {
    const img = st.querySelector('img.v-page');
    if (!img || !img.naturalWidth) return;
    const SW = st.clientWidth, SH = st.clientHeight;
    const ar = img.naturalWidth / img.naturalHeight;
    const loupe = st.dataset.loupe === '1' && SW / SH > 0.95;
    let PH = SH * 0.88, PW = PH * ar;
    const maxW = loupe ? SW * 0.5 : SW * 0.9;
    if (PW > maxW) { PW = maxW; PH = PW / ar; }
    const px = loupe ? SW * 0.07 : (SW - PW) / 2;
    const py = (SH - PH) / 2;
    Object.assign(img.style, { left: px + 'px', top: py + 'px', width: PW + 'px', height: PH + 'px' });
    const ghost = document.createElement('div');
    ghost.className = 'v-ghost';
    Object.assign(ghost.style, { left: (px + PW * 0.05) + 'px', top: (py + PH * 0.02) + 'px', width: PW + 'px', height: PH + 'px', transform: 'rotate(4deg)' });
    st.insertBefore(ghost, img);
    if (!loupe) return;
    const lx = px + PW * 0.62, lw = SW - lx - SW * 0.05, lh = Math.min(lw * 0.72, SH * 0.62);
    const z = 2.3;
    const reg = densest(img, lw / z / PW, lh / z / PH);
    const ly = Math.min(Math.max(py + reg.y * PH - lh * 0.15, SH * 0.08), SH - lh - SH * 0.08);
    const lp = document.createElement('div');
    lp.className = 'loupe';
    Object.assign(lp.style, {
      left: lx + 'px', top: ly + 'px', width: lw + 'px', height: lh + 'px',
      backgroundImage: 'url("' + img.src + '")', backgroundSize: (PW * z) + 'px ' + (PH * z) + 'px',
      backgroundPosition: (-reg.x * PW * z) + 'px ' + (-reg.y * PH * z) + 'px',
    });
    st.appendChild(lp);
    const tag = document.createElement('span');
    tag.className = 'loupe-tag';
    tag.textContent = 'Zoomed in';
    Object.assign(tag.style, { left: (lx + 14) + 'px', top: (ly - 14) + 'px' });
    st.appendChild(tag);
  });
  }

  /* ---------- 2. fit: page text first, then frames, then text inside the frames ---------- */
  const fits = Array.from(document.querySelectorAll('[data-fit]')).sort((a, b) => (+a.dataset.order || 0) - (+b.dataset.order || 0));
  const inFrame = (el) => !!el.closest('.herobox, .phone');
  fitAll(fits.filter((el) => !inFrame(el)));
  dropPills();
  layoutFrames();
  fitAll(fits.filter(inFrame));
  function fitAll(list) {
  for (const el of list) {
    const target = el.classList.contains('fitbox') ? (el.querySelector(':scope > .t') || el) : el;
    const [a, b] = String(el.dataset.fit).split(',');
    const cs = parseFloat(getComputedStyle(target).fontSize);
    const max = a === 'css' ? cs : parseFloat(a);
    const min = a === 'css' ? cs * parseFloat(b) : parseFloat(b);
    const line = el.dataset.mode === 'line';
    const tol = () => (target !== el ? 2 : Math.max(1.5, parseFloat(getComputedStyle(target).fontSize) * 0.15));
    const over = () => (line ? el.scrollWidth > el.clientWidth + 1 : (el.scrollHeight > el.clientHeight + tol() || el.scrollWidth > el.clientWidth + 1));
    const set = (v) => { target.style.fontSize = v + 'px'; };
    set(max);
    if (!over()) continue;
    set(min);
    if (!over()) {
      let lo = min, hi = max;
      while (hi - lo > 0.5) { const mid = (lo + hi) / 2; set(mid); if (over()) hi = mid; else lo = mid; }
      set(Math.floor(lo * 2) / 2);
      continue;
    }
    // still too big at the floor: a frame drops its least important rows first
    if (el.dataset.drop) {
      let rows = Array.from(el.querySelectorAll(el.dataset.drop));
      while (over() && rows.length) { const r = rows.pop(); report.clamped.push('row dropped: ' + where(r)); r.remove(); }
      if (!over()) {
        let lo = min, hi = max;
        while (hi - lo > 0.5) { const mid = (lo + hi) / 2; set(mid); if (over()) hi = mid; else lo = mid; }
        set(Math.floor(lo * 2) / 2);
        continue;
      }
    }
    if (el.dataset.clip) { el.classList.add('clipped'); report.clipped.push(where(el)); continue; }
    if (el.dataset.noclamp) continue;
    if (line) {
      el.style.textOverflow = 'ellipsis';
      target.style.textOverflow = 'ellipsis';
      report.clamped.push(where(el));
      continue;
    }
    const lh = parseFloat(getComputedStyle(target).lineHeight) || min * 1.2;
    const n = Math.max(1, Math.floor(el.clientHeight / lh));
    Object.assign(target.style, { display: '-webkit-box', webkitBoxOrient: 'vertical', webkitLineClamp: String(n), overflow: 'hidden' });
    el.dataset.clamped = '1';
    report.clamped.push(where(el) + ' (' + n + ' lines)');
  }
  }

  /* ---------- proof pills: drop from the end rather than overflow ---------- */
  function dropPills() {
    document.querySelectorAll('.pills').forEach((row) => {
      while (row.children.length > 1 && (row.scrollWidth > row.clientWidth + 1 || row.scrollHeight > row.clientHeight + 1)) {
        report.clamped.push('pill dropped: ' + where(row.lastElementChild));
        row.removeChild(row.lastElementChild);
      }
    });
  }

  /* ---------- step path ---------- */
  document.querySelectorAll('svg[data-path]').forEach((svg) => {
    const host = svg.parentElement;
    const hr = box(host);
    const pts = Array.from(host.querySelectorAll('.node')).map((n) => { const r = box(n); return { x: r.left + r.width / 2 - hr.left, y: r.top + r.height / 2 - hr.top }; });
    if (pts.length < 2) return;
    let d = 'M' + pts[0].x + ' ' + pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], my = (p.y + q.y) / 2;
      d += ' C' + p.x + ' ' + my + ' ' + q.x + ' ' + my + ' ' + q.x + ' ' + q.y;
    }
    svg.setAttribute('viewBox', '0 0 ' + hr.width + ' ' + hr.height);
    svg.querySelector('path').setAttribute('d', d);
  });

  /* ---------- 3. audit ---------- */
  const T = 2;
  for (const el of fits) {
    if (el.classList.contains('clipped') || el.dataset.clamped) continue;
    const line = el.dataset.mode === 'line';
    if (line && el.style.textOverflow === 'ellipsis') continue;
    const tv = Math.max(T, parseFloat(getComputedStyle(el.classList.contains('fitbox') ? (el.querySelector(':scope > .t') || el) : el).fontSize) * 0.15);
    const bad = line ? el.scrollWidth > el.clientWidth + T : (el.scrollHeight > el.clientHeight + tv || el.scrollWidth > el.clientWidth + T);
    if (bad) report.overflow.push('fit ' + where(el) + ' ' + el.scrollWidth + 'x' + el.scrollHeight + ' in ' + el.clientWidth + 'x' + el.clientHeight);
  }
  document.querySelectorAll('[data-chk]').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + T || el.scrollHeight > el.clientHeight + T) report.overflow.push('box ' + where(el) + ' ' + el.scrollWidth + 'x' + el.scrollHeight + ' in ' + el.clientWidth + 'x' + el.clientHeight);
  });
  const hasText = (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
  document.querySelectorAll('.cv').forEach((cv) => {
    const cr = box(cv);
    const story = cv.dataset.fmt === 'story';
    cv.querySelectorAll('.inner *').forEach((el) => {
      if (!hasText(el) || el.closest('svg') || el.closest('.clipped') || el.closest('[data-clamped]')) return;
      if (el.closest('[style*="line-clamp"]')) return;
      const r = box(el);
      if (r.width === 0 && r.height === 0) return;
      const ecs = getComputedStyle(el);
      const V = ecs.display === 'inline' ? Math.max(T, parseFloat(ecs.fontSize) * 0.3) : Math.max(T, parseFloat(ecs.fontSize) * 0.12);
      if (r.left < cr.left - T || r.right > cr.right + T || r.top < cr.top - V || r.bottom > cr.bottom + V) {
        report.overflow.push('canvas ' + where(el)); return;
      }
      if (story && (r.top < cr.top + 250 - V || r.bottom > cr.top + cr.height - 340 + V)) {
        report.overflow.push('safe-area ' + where(el)); return;
      }
      // inside the nearest clipping ancestor?
      for (let a = el.parentElement; a && a !== cv; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflow !== 'visible' || s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          const ar = box(a);
          if (r.left < ar.left - T || r.right > ar.right + T || r.top < ar.top - V || r.bottom > ar.bottom + V) report.overflow.push('clip ' + where(el) + ' outside ' + where(a));
          break;
        }
      }
    });
  });
  return report;
}

module.exports = { kitPage };
