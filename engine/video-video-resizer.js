/**
 * Video Resizer (/video/video-resizer/).
 *
 * A video in; the same video at another size or shape out, as an H.264 MP4
 * with its sound copied (or re-encoded where it cannot be copied):
 *   - the shape: keep it, or 16:9, 9:16, 1:1, 4:5, 4:3, 21:9;
 *   - the size: the short side at 2160, 1440, 1080, 720, 480 or 360 px,
 *     never larger than the original unless asked;
 *   - how the picture meets a new shape: fitted whole over a blurred,
 *     darkened copy of itself or a solid colour, cropped to fill (with a
 *     position for the crop), or stretched.
 * One function, place(), lays the picture out for the preview and every
 * frame of the export. The blur is made by shrinking the frame to a 24th
 * and drawing it back up twice, which needs no canvas filter.
 *
 * For social formats with a title and safe zones, the Reels Resizer in the
 * Social Media tools does more; this tool is for any size.
 *
 * Remembered in localStorage '1234tools-video-resizer-v1': shape, size,
 * mode, colour, crop position.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, range, colour, check, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-video-resizer-v1';
  const SHAPES = [['keep', 'Keep the shape'], ['16:9', '16:9 landscape'], ['9:16', '9:16 vertical'], ['1:1', '1:1 square'], ['4:5', '4:5 portrait'], ['4:3', '4:3'], ['21:9', '21:9 cinema']];
  const SHORT = [[0, 'The original size'], [2160, '2160 (4K)'], [1440, '1440'], [1080, '1080'], [720, '720'], [480, '480'], [360, '360']];
  const MODES = [['blur', 'Fit, blurred copy behind'], ['colour', 'Fit, solid colour behind'], ['fill', 'Crop to fill'], ['stretch', 'Stretch to fill']];
  const HEX = /^#[0-9a-f]{6}$/i;
  const even = VK.evenDown;

  /** The output size for a shown W × H, a shape ('keep' or 'a:b') and a short side (0 = from the original). */
  function sizeFor(W, H, shape, short, allowUp) {
    let r = W / H;
    if (shape !== 'keep') { const [a, b] = shape.split(':').map(Number); r = a / b; }
    const base = Math.min(W, H);
    let s = short || base;
    if (!allowUp) s = Math.min(s, shape === 'keep' ? base : Math.max(W, H));
    const out = r >= 1 ? { width: s * r, height: s } : { width: s, height: s / r };
    return { width: even(Math.round(out.width)), height: even(Math.round(out.height)) };
  }
  /** Where the picture goes in OW × OH: { sx, sy, sw, sh, x, y, w, h }. pos 0..100 moves a crop. */
  function place(vw, vh, OW, OH, mode, pos) {
    if (mode === 'stretch') return { sx: 0, sy: 0, sw: vw, sh: vh, x: 0, y: 0, w: OW, h: OH };
    if (mode === 'fill') {
      const s = Math.max(OW / vw, OH / vh), sw = OW / s, sh = OH / s, p = clamp(pos, 0, 100) / 100;
      return { sx: (vw - sw) * p, sy: (vh - sh) * p, sw, sh, x: 0, y: 0, w: OW, h: OH };
    }
    const s = Math.min(OW / vw, OH / vh), w = Math.round(vw * s), h = Math.round(vh * s);
    return { sx: 0, sy: 0, sw: vw, sh: vh, x: Math.round((OW - w) / 2), y: Math.round((OH - h) / 2), w, h };
  }
  function blurInto(ctx, src, vw, vh, W, H, scratch) {
    const tw = Math.max(4, Math.round(W / 24)), th = Math.max(4, Math.round(H / 24));
    if (!scratch.a) { scratch.a = el('canvas'); scratch.b = el('canvas'); }
    const a = scratch.a, b = scratch.b;
    if (a.width !== tw || a.height !== th) { a.width = tw; a.height = th; b.width = tw * 4; b.height = th * 4; }
    const ax = a.getContext('2d'), bx = b.getContext('2d');
    const s = Math.max(tw / vw, th / vh), cw = tw / s, ch = th / s;
    ax.drawImage(src, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, tw, th);
    bx.imageSmoothingQuality = 'high'; bx.drawImage(a, 0, 0, b.width, b.height);
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(b, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
  }
  /** One output frame from a source image (a <video>, a VideoFrame or a canvas) shown at vw × vh. */
  function compose(ctx, src, vw, vh, OW, OH, o, scratch) {
    const L = place(vw, vh, OW, OH, o.mode, o.pos);
    if (o.mode === 'blur') blurInto(ctx, src, vw, vh, OW, OH, scratch);
    else { ctx.fillStyle = o.mode === 'colour' ? o.bg : '#000'; ctx.fillRect(0, 0, OW, OH); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, L.sx, L.sy, L.sw, L.sh, L.x, L.y, L.w, L.h);
    return L;
  }

  function mount(root) {
    const st = VK.store(KEY, { shape: 'keep', short: 0, mode: 'blur', bg: '#000000', pos: 50, up: false }, (k, v) => (k === 'shape' ? SHAPES.some((s) => s[0] === v) : k === 'short' ? SHORT.some((s) => s[0] === v) : k === 'mode' ? MODES.some((m) => m[0] === v) : k === 'bg' ? HEX.test(v || '') : k === 'pos' ? v >= 0 && v <= 100 : typeof v === 'boolean'));
    const S = Object.assign({}, st.values);
    let info = null, video = null;
    const ui = VK.shell(root, { id: 'vr', label: 'Choose a video to resize', onFiles: (f, n) => load(f[0], n) });
    const canvas = el('canvas', 'aiimg-canvas sv-canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Preview of the resized video');
    const stage = el('div', 'aiimg-stage vk-stage'); stage.appendChild(canvas);
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const shapeSel = select('vr-shape', SHAPES, S.shape), shortSel = select('vr-size', SHORT, S.short), modeSel = select('vr-mode', MODES, S.mode);
    const bgIn = colour('vr-bg', S.bg); const bgField = field('Colour behind', bgIn);
    const posR = range('vr-pos', 0, 100, 1, S.pos, (v) => v + '%'); const posField = field('Crop position', posR, '0% keeps the left or top, 100% the right or bottom.');
    const upC = check('vr-up', 'Allow a size larger than the original', S.up);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Resize the video', (signal, j) => run(signal, j));
    const capsP = el('p', 'field-hint'); VK.capsLine().then((p) => capsP.replaceWith(p));
    ui.side.append(field('Shape', shapeSel), field('Short side (px)', shortSel), upC, field('Fitting', modeSel), bgField, posField, est, J.el, capsP, button('Choose another video', 'btn-ghost', () => ui.pick()));
    const scratch = {};
    function sync() {
      S.shape = shapeSel.value; S.short = Number(shortSel.value) || 0; S.mode = modeSel.value; S.bg = bgIn.value; S.pos = Number(posR.input.value); S.up = upC.input.checked;
      st.save(S);
      const reshaped = S.shape !== 'keep';
      modeSel.disabled = !reshaped; bgField.hidden = !(reshaped && S.mode === 'colour'); posField.hidden = !(reshaped && S.mode === 'fill');
      if (!info) return;
      const o = sizeFor(info.width, info.height, S.shape, S.short, S.up);
      est.textContent = info.width + ' × ' + info.height + ' becomes ' + o.width + ' × ' + o.height + (reshaped ? ', ' + MODES.find((m) => m[0] === S.mode)[1].toLowerCase() : '') + '. The picture is re-encoded as H.264; the sound is copied.';
      draw();
    }
    function draw() {
      if (!info || !video || video.readyState < 2) return;
      const o = sizeFor(info.width, info.height, S.shape, S.short, S.up);
      const s = Math.min(1, 640 / Math.max(o.width, o.height));
      canvas.width = Math.round(o.width * s); canvas.height = Math.round(o.height * s);
      const ctx = canvas.getContext('2d');
      ctx.save(); ctx.scale(s, s);
      compose(ctx, video, video.videoWidth, video.videoHeight, o.width, o.height, S.shape === 'keep' ? { mode: 'stretch' } : S, scratch);
      ctx.restore();
    }
    for (const c of [shapeSel, shortSel, modeSel]) c.addEventListener('change', sync);
    for (const c of [bgIn, posR.input]) c.addEventListener('input', sync);
    upC.input.addEventListener('change', sync);

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.width) { VK.release(next); ui.say(file.name + ': there is no picture in this file.', 'error'); return; }
      VK.release(info);
      if (video) { URL.revokeObjectURL(video.src); video.remove(); }
      info = next;
      video = el('video', 'sv-hidden-video'); video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.src = URL.createObjectURL(file);
      stage.appendChild(video);
      video.addEventListener('loadeddata', () => { video.currentTime = Math.min(1, (info.duration || 1) / 3); }, { once: true });
      video.addEventListener('seeked', draw);
      about.textContent = file.name + ': ' + VK.describe(info) + '.';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function run(signal, j) {
      if (!info) return;
      const o = sizeFor(info.width, info.height, S.shape, S.short, S.up);
      const opts = S.shape === 'keep' ? { mode: 'stretch' } : Object.assign({}, S);
      const rot = info.rotation || 0;
      let upright = null;
      /* a decoded frame is in the file's coded orientation: turn it upright first, then lay it out */
      const draw_ = (ctx, f, inf, W, H) => {
        const fw = f.displayWidth || f.videoWidth || f.width, fh = f.displayHeight || f.videoHeight || f.height;
        let src = f, vw = fw, vh = fh;
        if (rot) {
          const sw = rot % 180 ? fh : fw, sh = rot % 180 ? fw : fh;
          if (!upright) { upright = el('canvas'); upright.width = sw; upright.height = sh; }
          VK.drawFrame(upright.getContext('2d'), f, rot, sw, sh);
          src = upright; vw = sw; vh = sh;
        }
        compose(ctx, src, vw, vh, W, H, opts, scratch);
      };
      const bitrate = Math.max(o.width * o.height * (info.fps || 30) * 0.08, 400000);
      let out = await VK.transcode(info, { box: 'mp4', width: o.width, height: o.height, bitrate, audio: 'copy', draw: draw_, signal, onProgress: (x) => j.progress(x, 'Resizing') });
      let how;
      if (!out) {
        out = await VK.record(info, { width: o.width, height: o.height, draw: (ctx, v, inf, W, H) => compose(ctx, v, v.videoWidth, v.videoHeight, W, H, opts, scratch), signal, onProgress: (x) => j.progress(x, 'Recording in real time') });
        how = 'Recorded in real time with this browser’s media recorder (' + out.mime + '), because it has no on-device H.264 encoder.';
      } else how = 'Re-encoded as ' + VK.codecName(out.videoCodec) + (out.audioCodec ? ' with ' + VK.codecName(out.audioCodec) + ' sound' + (out.audioRoute === 'copy' ? ' (copied)' : '') : '') + '.';
      const name = info.name + '-' + o.width + 'x' + o.height + '.' + VK.extOf(out.blob);
      VK.result(ui.results, out.blob, name, o.width + ' × ' + o.height, { note: how });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(out.blob.size) + '.';
      VK.lastResize = { width: o.width, height: o.height, route: out.route };
    }
    sync();
    return { state: S };
  }

  A.tools['video-resizer'] = { mount, sizeFor, place };
})();
