/**
 * Video to Frames (/video/video-to-frames/).
 *
 * Still pictures out of a video: every frame of a part, one every so many
 * seconds, a set number spread evenly, or the single frame under the
 * player. Frames are decoded with VideoDecoder (frame-accurate: each
 * picture is the frame shown at its time, named with its number and time)
 * or, where WebCodecs cannot decode the file, taken from the browser's
 * player by seeking. Saved as PNG (lossless) or JPEG (quality 0.92), one
 * file at a time or all in a ZIP; at most 1,000 frames a run.
 *
 * Remembered in localStorage '1234tools-video-to-frames-v1': what to take,
 * the interval, the count, the format.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-video-to-frames-v1';
  const MAX = 1000;
  const WHAT = [['every', 'Every frame of the part'], ['interval', 'One every so many seconds'], ['count', 'A number spread evenly'], ['current', 'Only the frame in the player']];
  const FORMATS = [['image/png', 'PNG (lossless)'], ['image/jpeg', 'JPEG (smaller)']];

  /** The times wanted, in seconds, for a part [a, b] of a video with frame times `frames` (sorted). */
  function plan(what, a, b, interval, count, frames, current) {
    if (what === 'current') return [current];
    if (what === 'every') return frames.filter((t) => t >= a - 0.0005 && t < b - 0.0005);
    if (what === 'interval') { const out = []; for (let t = a; t < b - 1e-6 && out.length <= MAX; t += interval) out.push(t); return out; }
    /* spread from the first frame of the part to the last one that starts before its end */
    const inPart = frames.filter((t) => t >= a - 0.0005 && t < b - 0.0005);
    const last = inPart.length ? inPart[inPart.length - 1] : Math.max(a, b - 0.04);
    const n = Math.max(1, Math.round(count)), out = [];
    for (let i = 0; i < n; i++) out.push(n === 1 ? a : a + (last - a) * i / (n - 1));
    return out;
  }
  const pad = (n, w) => String(n).padStart(w, '0');

  function mount(root) {
    const st = VK.store(KEY, { what: 'interval', interval: 1, count: 10, format: 'image/png' }, (k, v) => (k === 'what' ? WHAT.some((w) => w[0] === v) : k === 'format' ? FORMATS.some((f) => f[0] === v) : k === 'interval' ? v >= 0.04 && v <= 600 : v >= 1 && v <= MAX));
    const S = Object.assign({}, st.values);
    let info = null, preview = null;
    const ui = VK.shell(root, { id: 'vf', label: 'Choose a video', onFiles: (f, n) => load(f[0], n) });
    const stage = el('div', 'aiimg-stage vk-stage');
    const about = el('p', 'field-hint vk-about');
    const grid = el('div', 'vk-frames'); grid.setAttribute('aria-live', 'polite');
    ui.stageCol.append(stage, about, grid);
    const whatSel = select('vf-what', WHAT, S.what);
    const intIn = el('input', 'control'); intIn.type = 'number'; intIn.id = 'vf-interval'; intIn.min = '0.04'; intIn.step = '0.1'; intIn.value = S.interval;
    const cntIn = el('input', 'control'); cntIn.type = 'number'; cntIn.id = 'vf-count'; cntIn.min = '1'; cntIn.max = String(MAX); cntIn.step = '1'; cntIn.value = S.count;
    const intField = field('Every (seconds)', intIn), cntField = field('How many', cntIn);
    const fromIn = el('input', 'control'), toIn = el('input', 'control');
    for (const [i, id] of [[fromIn, 'vf-from'], [toIn, 'vf-to']]) { i.type = 'number'; i.id = id; i.min = '0'; i.step = '0.1'; i.inputMode = 'decimal'; }
    const times = el('div', 'sv-times'); times.append(field('From (seconds)', fromIn), field('To (seconds)', toIn));
    const fmtSel = select('vf-format', FORMATS, S.format);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Take the frames', (signal, j) => run(signal, j));
    ui.side.append(field('Which frames', whatSel), intField, cntField, times, field('Save as', fmtSel), est, J.el, button('Choose another video', 'btn-ghost', () => ui.pick()));

    const range_ = () => { const D = info ? info.duration : 0; let a = clamp(Number(fromIn.value) || 0, 0, D), b = clamp(toIn.value === '' ? D : Number(toIn.value), 0, D); if (b <= a) b = D; return [a, b]; };
    const times_ = () => { const [a, b] = range_(); return plan(S.what, a, b, S.interval, S.count, info.frames || [], preview ? preview.currentTime : 0); };
    function sync() {
      S.what = whatSel.value; S.interval = clamp(Number(intIn.value) || 1, 0.04, 600); S.count = clamp(Math.round(Number(cntIn.value) || 10), 1, MAX); S.format = fmtSel.value;
      st.save(S);
      intField.hidden = S.what !== 'interval'; cntField.hidden = S.what !== 'count'; times.hidden = S.what === 'current';
      if (!info) return;
      const n = times_().length;
      est.textContent = n > MAX ? n + ' frames is over the limit of ' + MAX.toLocaleString('en-GB') + ' a run: shorten the part, or take one every few frames.' : n + ' frame' + (n === 1 ? '' : 's') + ' as ' + (S.format === 'image/png' ? 'PNG' : 'JPEG') + ' at ' + info.width + ' × ' + info.height + (n > 1 ? ', saved together in a ZIP.' : '.');
      est.className = 'sv-est vk-est' + (n > MAX ? ' is-warn' : '');
      J.go.disabled = J.busy || n > MAX || !n;
    }
    for (const c of [whatSel, fmtSel]) c.addEventListener('change', sync);
    for (const c of [intIn, cntIn, fromIn, toIn]) c.addEventListener('input', sync);

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.width) { VK.release(next); ui.say(file.name + ': there is no picture in this file.', 'error'); return; }
      VK.release(info);
      if (preview) { URL.revokeObjectURL(preview.src); preview.remove(); }
      info = next;
      preview = el('video', 'vk-preview'); preview.controls = true; preview.playsInline = true; preview.preload = 'auto'; preview.muted = true;
      preview.src = URL.createObjectURL(file);
      preview.setAttribute('aria-label', 'The video, ' + file.name);
      preview.addEventListener('seeked', sync);
      stage.appendChild(preview);
      fromIn.value = '0'; toIn.value = info.duration.toFixed(2);
      about.textContent = file.name + ': ' + VK.describe(info) + (info.frames ? ', ' + info.frames.length.toLocaleString('en-GB') + ' frames' : '') + '.';
      grid.innerHTML = '';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function run(signal, j) {
      if (!info) return;
      const want = times_();
      if (!want.length || want.length > MAX) return;
      const W = info.width, H = info.height, rot = info.rotation || 0;
      const c = el('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const ext = S.format === 'image/png' ? 'png' : 'jpg';
      const files = [];
      const digits = String(info.frames ? info.frames.length : 99999).length;
      const save = async (src, t, idx) => {
        if (src instanceof HTMLVideoElement) ctx.drawImage(src, 0, 0, W, H); else VK.drawFrame(ctx, src, rot, W, H);
        const blob = await new Promise((res) => c.toBlob(res, S.format, 0.92));
        const name = info.name + '-frame-' + pad(idx, digits) + '-' + t.toFixed(3).replace('.', '_') + 's.' + VK.extOf(blob);
        files.push({ name, blob, t });
        j.progress(files.length / want.length, 'Frame ' + files.length + ' of ' + want.length);
      };
      const idxOf = (t) => { const f = info.frames || []; let lo = 0, hi = f.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (f[m] <= t + 0.0005) lo = m; else hi = m - 1; } return lo; };
      if (info.video && info.canDecode) {
        /* decode the part once, keeping the frame shown at each wanted time */
        let k = 0;
        const a = Math.max(0, want[0] - 0.001), b = Math.min(info.duration, want[want.length - 1] + 1);
        for await (const f of VK.decodeFrames(info, { from: a, to: b, signal })) {
          const t = f.timestamp / 1e6, end = t + (f.duration || 33333) / 1e6;
          while (k < want.length && want[k] < t - 0.0005) k++;
          if (k < want.length && want[k] < end - 0.0005) {
            const shown = t;
            await save(f, shown, idxOf(shown));
            while (k < want.length && want[k] < end - 0.0005) k++;
          }
          f.close();
          if (k >= want.length) break;
        }
      } else {
        const v = preview;
        for (const t of want) { if (signal.aborted) throw VK.abortError(); await VK.seekTo(v, Math.min(t + 0.001, info.duration - 0.001), signal); await save(v, v.currentTime, files.length); }
      }
      if (signal.aborted) throw VK.abortError();
      grid.innerHTML = '';
      for (const f of files.slice(0, 24)) { const im = el('img'); im.alt = f.name; im.src = URL.createObjectURL(f.blob); im.loading = 'lazy'; grid.appendChild(im); }
      if (files.length === 1) VK.result(ui.results, files[0].blob, files[0].name, W + ' × ' + H + ' · at ' + VK.fmtT(files[0].t, 3), { note: 'The frame shown at ' + VK.fmtT(files[0].t, 3) + '.' });
      else {
        const zip = await window.MVRZip(files.map((f) => ({ name: f.name, blob: f.blob })));
        VK.result(ui.results, zip, info.name + '-frames.zip', files.length + ' ' + ext.toUpperCase() + ' files', { note: files.length + ' frames from ' + VK.fmtT(files[0].t, 3) + ' to ' + VK.fmtT(files[files.length - 1].t, 3) + ', named by frame number and time.' });
      }
      j.status.textContent = 'Done: ' + files.length + ' frame' + (files.length === 1 ? '' : 's') + ', ' + fmtBytes(files.reduce((s, f) => s + f.blob.size, 0)) + ' in all.';
      VK.lastFrames = files.map((f) => ({ name: f.name, t: f.t, type: f.blob.type, size: f.blob.size }));
    }
    sync();
    return { state: S };
  }

  A.tools['video-to-frames'] = { mount, plan };
})();
