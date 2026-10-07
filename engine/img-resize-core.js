/**
 * The resizing both resizer pages share: /image/bulk-image-resizer/ (many
 * files, a rename pattern, a ZIP or a folder) and /image/image-resizer/ (one
 * picture). Pixels are resampled with Lanczos3 in the codec worker (or by
 * halving steps on canvases without WebAssembly), and nothing is enlarged
 * unless "Allow enlarging" says so.
 */
(function () {
  'use strict';
  const SOCIAL = () => (window.MVRImage && window.MVRImage.SOCIAL_PRESETS) || [];

  function controls(multi) {
    const presetOptions = [{ value: 'custom', label: 'My own size (the settings below)' }]
      .concat(SOCIAL().map((p, i) => ({ value: String(i), label: `${p.group} · ${p.name} — ${p.w}×${p.h}` })));
    const list = [
      { key: 'preset', label: 'Size preset', type: 'select', default: 'custom', options: presetOptions, noRemember: false },
      { key: 'mode', label: 'Resize by', type: 'select', default: 'width', when: { preset: ['custom'] }, options: [
        { value: 'width', label: 'Fixed width (keep ratio)' },
        { value: 'height', label: 'Fixed height (keep ratio)' },
        { value: 'longest', label: 'Longest edge' },
        { value: 'percent', label: 'Percentage' },
        { value: 'exact', label: 'Exact size (may distort)' },
        { value: 'cover', label: 'Exact size, crop to fit' },
        { value: 'pad', label: 'Exact size, pad to fit' }] },
      { key: 'value', label: 'Value (px or %)', type: 'number', default: 1200, min: 1, when: { preset: ['custom'] } },
      { key: 'height', label: 'Height (exact sizes)', type: 'number', default: 800, min: 1, when: { preset: ['custom'], mode: ['exact', 'cover', 'pad'] } },
      { key: 'padColour', label: 'Padding colour', type: 'color', default: '#ffffff', when: { mode: ['pad'] } },
      { key: 'enlarge', label: 'Allow enlarging', type: 'select', default: 'no', options: [
        { value: 'no', label: 'No — smaller images keep their size' },
        { value: 'yes', label: 'Yes — scale small images up' }] },
      { key: 'format', label: 'Output format', type: 'select', default: 'image/webp', options: [
        { value: 'image/webp', label: 'WebP' }, { value: 'image/jpeg', label: 'JPEG' }, { value: 'image/png', label: 'PNG' },
        { value: 'image/avif', label: 'AVIF' }, { value: 'same', label: 'Keep original format' }] },
      { key: 'quality', label: 'Quality', type: 'range', default: 85, min: 10, max: 100, when: { format: ['image/webp', 'image/jpeg', 'image/avif'] } },
      { key: 'target', label: multi ? 'Make each under' : 'Make it under', type: 'select', default: '0', options: [
        { value: '0', label: 'No size limit' }, { value: '20', label: '20 KB' }, { value: '50', label: '50 KB' }, { value: '100', label: '100 KB' },
        { value: '200', label: '200 KB' }, { value: '500', label: '500 KB' }, { value: '1000', label: '1 MB' }, { value: '2000', label: '2 MB' },
        { value: 'custom', label: 'Another size…' }] },
      { key: 'targetKB', label: 'Size limit (KB)', type: 'number', default: 150, min: 5, when: { target: ['custom'] } },
      { key: 'dpi', label: 'DPI written to the file (0 = none)', type: 'number', default: 0, min: 0, max: 2400 },
      { key: 'metadata', label: 'Metadata', type: 'select', default: 'none', options: [
        { value: 'none', label: 'Remove all (colours converted to sRGB)' },
        { value: 'icc', label: 'Keep the colour profile only' },
        { value: 'exif', label: 'Keep colour profile and EXIF, without GPS' },
        { value: 'all', label: 'Keep everything: EXIF with GPS, XMP, colour profile' }] }
    ];
    if (multi) list.push({ key: 'rename', label: 'File names', type: 'text', default: '{name}-{w}x{h}', wide: true,
      hint: '{name} the original name, {n} its place in the batch (001…), {w} and {h} the new size. The extension follows the format.' });
    return list;
  }

  /* the size a setting asks for, before the "never enlarge" rule */
  function wanted(nw, nh, o) {
    if (o.preset && o.preset !== 'custom') {
      const p = SOCIAL()[Number(o.preset)];
      if (p) return { w: p.w, h: p.h, mode: 'cover' };
    }
    const v = Math.max(1, Number(o.value) || 1);
    const mode = o.mode || 'width';
    let w, h;
    if (mode === 'width') { w = v; h = Math.round(nh * (v / nw)); }
    else if (mode === 'height') { h = v; w = Math.round(nw * (v / nh)); }
    else if (mode === 'longest') { const s = v / Math.max(nw, nh); w = Math.round(nw * s); h = Math.round(nh * s); }
    else if (mode === 'percent') { w = Math.round(nw * v / 100); h = Math.round(nh * v / 100); }
    else { w = v; h = Math.max(1, Number(o.height) || nh); }
    return { w: Math.max(1, w), h: Math.max(1, h), mode };
  }

  function nameFor(pattern, s, n, total, w, h) {
    const base = s.file.name.replace(/\.[^.]+$/, '') || 'image';
    const pad = String(total).length < 3 ? 3 : String(total).length;
    const out = String(pattern || '{name}-{w}x{h}')
      .replace(/\{name\}/g, base).replace(/\{n\}/g, String(n).padStart(pad, '0'))
      .replace(/\{w\}/g, String(w)).replace(/\{h\}/g, String(h))
      .replace(/[\\/:*?"<>|]+/g, '-').trim();
    return out || base;
  }

  /* the jobs for one picture: one output, or one "kept" when it would have to grow */
  function produce(img, o, h, s, api) {
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const want = wanted(nw, nh, o);
    const { w, mode } = want;
    const hh = want.h;
    const enlarge = o.enlarge === 'yes';
    const flat = (ctx, W, H) => { if (o.format === 'image/jpeg') h.fillOn(ctx, '#fff', W, H); };
    const job = (extra) => Object.assign({ suffix: `${extra.width}x${extra.height}` }, extra);

    if (mode === 'pad') {
      /* fit inside w×h and fill the rest; a smaller picture is centred at its own size */
      const k = Math.min(w / nw, hh / nh, enlarge ? Infinity : 1);
      const dw = Math.max(1, Math.round(nw * k)), dh = Math.max(1, Math.round(nh * k));
      return [job({ width: w, height: hh, label: `${w}×${hh}, padded`, paint: async (ctx, hp) => {
        ctx.fillStyle = o.padColour || '#ffffff'; ctx.fillRect(0, 0, w, hh);
        const src = await hp.resample(img, dw, dh);
        ctx.drawImage(src, Math.round((w - dw) / 2), Math.round((hh - dh) / 2));
      } })];
    }
    if (mode === 'cover') {
      /* crop to w:h around the middle, then scale; without enlarging, the
         largest w:h crop the picture holds is kept at its own size */
      let k = Math.max(w / nw, hh / nh);
      let W = w, H = hh, kept = false;
      if (k > 1 && !enlarge) {
        const r = w / hh;
        if (nw / nh > r) { H = nh; W = Math.round(nh * r); } else { W = nw; H = Math.round(nw / r); }
        k = 1; kept = true;
      }
      const sw = Math.min(nw, Math.round(W / k)), sh = Math.min(nh, Math.round(H / k));
      const sx = Math.round((nw - sw) / 2), sy = Math.round((nh - sh) / 2);
      return [job({ width: W, height: H, kept, label: kept ? `${W}×${H}, kept: smaller than ${w}×${hh}` : `${W}×${H}, cropped to fit`, paint: async (ctx, hp) => {
        const crop = hp.scratch(sw, sh);
        crop.ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        crop.canvas.naturalWidth = sw; crop.canvas.naturalHeight = sh;
        const src = await hp.resample(crop.canvas, W, H);
        flat(ctx, W, H);
        ctx.drawImage(src, 0, 0);
      } })];
    }
    /* Never enlarge unless asked: an image the target would make bigger in
       either direction is saved at its own size, and the page says so. */
    if ((w > nw || hh > nh) && !enlarge) {
      return [job({ width: nw, height: nh, kept: true, label: `${nw}×${nh}, kept: smaller than ${w}×${hh}`, paint: (ctx) => { flat(ctx, nw, nh); ctx.drawImage(img, 0, 0, nw, nh); } })];
    }
    return [job({ width: w, height: hh, paint: async (ctx, hp) => {
      const src = await hp.resample(img, w, hh);
      flat(ctx, w, hh);
      ctx.drawImage(src, 0, 0, w, hh);
    } })];
  }

  /* names for a batch, from the pattern, made unique */
  function nameJobs(jobs, o, multi) {
    if (!multi) return;
    const seen = {};
    const srcs = [];
    jobs.forEach(j => { if (srcs.indexOf(j.src) < 0) srcs.push(j.src); });
    jobs.forEach(j => {
      let n = nameFor(o.rename, j.src, srcs.indexOf(j.src) + 1, srcs.length, j.width, j.height);
      const key = n.toLowerCase();
      if (seen[key]) { seen[key]++; n += '-' + seen[key]; } else seen[key] = 1;
      j.name = n;
    });
  }

  window.MVRResize = { controls, produce, wanted, nameFor, nameJobs };
})();
