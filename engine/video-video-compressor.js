/**
 * Video Compressor (/video/video-compressor/).
 *
 * A video in, a smaller H.264 MP4 out, aimed either at a file size or at a
 * quality level, optionally at a lower resolution and frame rate, with the
 * sound copied as it is, re-encoded smaller, or removed.
 *
 *   Target size: the picture's bitrate is what is left of the target after
 *   the sound and 2% for the MP4 boxes, spread over the length:
 *     video bit/s = (target bytes × 8 × 0.98 − sound bits) ÷ seconds.
 *   An encoder hits a bitrate on average, not exactly, so when the file
 *   comes out over the target it is encoded again with the bitrate cut by
 *   the overshoot (at most twice more), and the page says how many passes
 *   it took and whether the target was met.
 *   Quality: bits per pixel per frame — High 0.10, Balanced 0.06, Small
 *   0.035 — times width × height × frames a second.
 *
 * The before-and-after table is measured from both files (the output is
 * read back by the same demuxer), never assumed. When the result is no
 * smaller than the original the page says so and recommends keeping the
 * original.
 *
 * Remembered in localStorage '1234tools-video-compressor-v1': the mode,
 * the target in MB, the quality, resolution, frame rate and sound choice.
 * Never the video or its name.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, clamp, field, select, button, fmtBytes } = A;

  const KEY = '1234tools-video-compressor-v1';
  const QUALITY = { high: 0.10, balanced: 0.06, small: 0.035 };
  const QUALITY_OPTS = [['high', 'High — little visible loss'], ['balanced', 'Balanced — good for sharing'], ['small', 'Small — smallest file, softer picture']];
  const SHORT = [[0, 'Original'], [1080, '1080p'], [720, '720p'], [480, '480p'], [360, '360p']];
  const FPS = [[0, 'Original'], [30, '30 fps'], [24, '24 fps'], [15, '15 fps']];
  /* 128 and 96: the bitrates every AAC encoder takes (Windows' accepts only 96, 128, 160 and 192), so MP4 sound stays AAC */
  const SOUND = [['copy', 'Keep it as it is'], ['128', 'Re-encode at 128 kbit/s'], ['96', 'Re-encode at 96 kbit/s'], ['none', 'Remove the sound']];
  const MIN_BPP = 0.018;

  /** The bitrate to aim at, the sound's share and a warning when the target is too tight. */
  function plan(info, S) {
    const seconds = info.duration;
    const out = VK.outputSize(info, { maxShort: S.short || 0 });
    const fps = Math.min(info.fps || 30, S.fps || info.fps || 30);
    const pixels = out.width * out.height * fps;
    let audioBits = 0;
    if (info.audio && S.sound !== 'none') audioBits = S.sound === 'copy' ? (info.audioBitrate || 128000) * seconds : Number(S.sound) * 1000 * seconds;
    let bitrate, expected, warn = '';
    if (S.mode === 'size') {
      const bytes = S.target * 1048576;
      bitrate = (bytes * 8 * 0.98 - audioBits) / seconds;
      expected = bytes;
      if (bitrate <= 0) warn = 'The sound alone needs about ' + fmtBytes(audioBits / 8) + ', more than the target. Remove the sound or choose a larger size.';
      else if (bitrate / pixels < MIN_BPP) {
        const ok = SHORT.filter((r) => r[0] && r[0] < Math.min(out.width, out.height)).find((r) => {
          const o2 = VK.outputSize(info, { maxShort: r[0] });
          return bitrate / (o2.width * o2.height * fps) >= MIN_BPP;
        });
        warn = 'That leaves ' + VK.fmtRate(bitrate) + ' for the picture at ' + out.width + ' × ' + out.height + ', which will look blocky.' + (ok ? ' ' + ok[1] + ' will look better at this size.' : ' A lower resolution or a larger target will look better.');
      }
    } else {
      bitrate = pixels * QUALITY[S.quality];
      expected = (bitrate * seconds + audioBits) / 8 / 0.98;
    }
    /* `bitrate` is what the numbers say; the encoder is never asked for less than 50 kbit/s */
    return { bitrate: bitrate || 0, encodeAt: Math.max(50000, bitrate || 0), expected, warn, out, fps, audioBits };
  }

  function mount(root) {
    const st = VK.store(KEY, { mode: 'size', target: 0, quality: 'balanced', short: 0, fps: 0, sound: 'copy' }, (k, v) => {
      if (k === 'mode') return v === 'size' || v === 'quality';
      if (k === 'target') return isFinite(v) && v >= 0 && v < 4096;
      if (k === 'quality') return !!QUALITY[v];
      if (k === 'short') return SHORT.some((r) => r[0] === v);
      if (k === 'fps') return FPS.some((r) => r[0] === v);
      if (k === 'sound') return SOUND.some((r) => r[0] === v);
      return false;
    });
    const S = Object.assign({}, st.values);
    let info = null, preview = null;
    const ui = VK.shell(root, { id: 'vc', label: 'Choose a video to compress', onFiles: (files, notes) => load(files[0], notes) });

    /* stage: the original, playable */
    const stageInfo = el('p', 'field-hint vk-about');
    const stage = el('div', 'aiimg-stage vk-stage');
    ui.stageCol.append(stage, stageInfo);

    /* settings */
    const modeSel = select('vc-mode', [['size', 'A file size'], ['quality', 'A quality level']], S.mode);
    const targetIn = el('input', 'control'); targetIn.type = 'number'; targetIn.id = 'vc-target'; targetIn.min = '0.1'; targetIn.step = '0.1'; targetIn.inputMode = 'decimal';
    const chips = el('div', 'vk-chips');
    const targetField = field('Target size (MB)', targetIn, 'The file will be at or just under this size.');
    targetField.appendChild(chips);
    const qualSel = select('vc-quality', QUALITY_OPTS, S.quality);
    const qualField = field('Quality', qualSel);
    const shortSel = select('vc-res', SHORT, S.short);
    const fpsSel = select('vc-fps', FPS, S.fps);
    const soundSel = select('vc-sound', SOUND, S.sound);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Compress the video', (signal, j) => compress(signal, j));
    const another = button('Choose another video', 'btn-ghost', () => ui.pick());
    const capsP = el('p', 'field-hint');
    VK.capsLine().then((p) => capsP.replaceWith(p));
    ui.side.append(field('Aim for', modeSel), targetField, qualField, field('Resolution', shortSel), field('Frame rate', fpsSel), field('Sound', soundSel), est, J.el, capsP, another);

    const syncMode = () => { targetField.hidden = S.mode !== 'size'; qualField.hidden = S.mode !== 'quality'; };
    function fillChoices() {
      const short = Math.min(info.width, info.height);
      shortSel.innerHTML = '';
      for (const [v, l] of SHORT) {
        if (v && v >= short) continue;
        const o = el('option', null, v ? l : 'Original (' + info.width + ' × ' + info.height + ')'); o.value = v; shortSel.appendChild(o);
      }
      if (![...shortSel.options].some((o) => Number(o.value) === S.short)) S.short = 0;
      shortSel.value = String(S.short);
      fpsSel.innerHTML = '';
      for (const [v, l] of FPS) {
        if (v && v >= info.fps - 0.5) continue;
        const o = el('option', null, v ? l : 'Original (' + info.fps + ' fps)'); o.value = v; fpsSel.appendChild(o);
      }
      if (![...fpsSel.options].some((o) => Number(o.value) === S.fps)) S.fps = 0;
      fpsSel.value = String(S.fps);
      soundSel.disabled = !info.audio;
      chips.innerHTML = '';
      const mb = info.size / 1048576;
      for (const [label, v] of [['Half', mb / 2], ['A quarter', mb / 4], ['10 MB', 10], ['25 MB', 25], ['50 MB', 50]]) {
        if (v >= mb * 0.95 || v < 0.1) continue;
        const b = button(label, 'btn-ghost sv-mini', () => { targetIn.value = (Math.floor(v * 10) / 10).toFixed(1); changed(); });
        b.setAttribute('aria-label', 'Target ' + (Math.floor(v * 10) / 10).toFixed(1) + ' MB');
        chips.appendChild(b);
      }
    }
    function changed() {
      S.mode = modeSel.value; S.quality = qualSel.value; S.short = Number(shortSel.value) || 0; S.fps = Number(fpsSel.value) || 0; S.sound = soundSel.value;
      const t = Number(targetIn.value);
      if (isFinite(t) && t > 0) S.target = t;
      st.save(S);
      syncMode();
      estimate();
    }
    for (const c of [modeSel, qualSel, shortSel, fpsSel, soundSel]) c.addEventListener('change', changed);
    targetIn.addEventListener('input', changed);
    syncMode();

    function estimate() {
      if (!info) return;
      const p = plan(info, S);
      const smaller = 1 - p.expected / info.size;
      est.textContent = (S.mode === 'size' ? 'Aiming at ' + fmtBytes(p.expected) : 'Expected about ' + fmtBytes(p.expected)) +
        (smaller > 0 ? ' (' + Math.round(smaller * 100) + '% smaller than ' + fmtBytes(info.size) + ')' : ' — not smaller than the original (' + fmtBytes(info.size) + ')') +
        ': ' + p.out.width + ' × ' + p.out.height + ' at ' + p.fps + ' fps' + (p.bitrate > 0 && !p.warn ? ', picture at ' + VK.fmtRate(p.bitrate) : '') + '.' + (p.warn ? ' ' + p.warn : '');
      est.className = 'sv-est vk-est' + (p.warn || smaller <= 0 ? ' is-warn' : '');
      J.go.disabled = J.busy || (S.mode === 'size' && p.bitrate <= 0);
    }

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file); }
      catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.video && !next.element) { VK.release(next); ui.say(file.name + ': there is no picture in this file. For sound, use the audio tools.', 'error'); return; }
      VK.release(info);
      if (preview) { URL.revokeObjectURL(preview.src); preview.remove(); }
      info = next;
      preview = el('video', 'vk-preview'); preview.controls = true; preview.playsInline = true; preview.preload = 'metadata';
      preview.src = URL.createObjectURL(file);
      preview.setAttribute('aria-label', 'The original video, ' + file.name);
      stage.appendChild(preview);
      stageInfo.textContent = file.name + ': ' + VK.describe(info) + (info.videoBitrate ? ', picture at ' + VK.fmtRate(info.videoBitrate) : '') + '.';
      if (!S.target || S.target * 1048576 >= info.size) targetIn.value = (Math.max(0.1, Math.floor(info.size / 1048576 / 2 * 10) / 10)).toFixed(1);
      else targetIn.value = S.target.toFixed(1);
      fillChoices();
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      changed();
    }

    async function compress(signal, j) {
      if (!info) return;
      const p = plan(info, S);
      const box = 'mp4';
      const audio = S.sound === 'none' ? 'none' : S.sound === 'copy' ? 'copy' : 'encode';
      const audioBitrate = S.sound === 'copy' || S.sound === 'none' ? undefined : Number(S.sound) * 1000;
      let bitrate = p.encodeAt, out = null, passes = 0, floor = false, prev = 0;
      const target = S.mode === 'size' ? S.target * 1048576 : 0;
      const t0 = performance.now();
      for (;;) {
        passes++;
        const label = passes === 1 ? 'Compressing' : 'Pass ' + passes + ' (the last came out at ' + fmtBytes(out.blob.size) + ', over the target)';
        const r = await VK.transcode(info, { box, width: p.out.width, height: p.out.height, fps: S.fps || undefined, bitrate, audio, audioBitrate, signal, onProgress: (x) => j.progress(x, label) });
        if (!r) {
          j.progress(0, 'This browser has no H.264 encoder: recording the video in real time instead');
          out = await VK.record(info, { width: p.out.width, height: p.out.height, bitrate, audio: audio !== 'none', signal, onProgress: (x) => j.progress(x, 'Recording in real time') });
          break;
        }
        out = r;
        if (!target || out.blob.size <= target || passes >= 3) break;
        /* a cut in the bitrate that no longer shrinks the file means the encoder is at its coarsest for this picture */
        if (prev && out.blob.size > prev * 0.97) { floor = true; break; }
        prev = out.blob.size;
        bitrate = Math.max(50000, bitrate * (target / out.blob.size) * 0.96);
      }
      const name = info.name + '-compressed.' + VK.extOf(out.blob);
      /* measured from the file itself */
      let after = null;
      try { after = await VK.probe(new File([out.blob], name, { type: out.blob.type }), { element: false }); } catch (e) { after = null; }
      const rows = [['', 'Original', 'Compressed'],
        ['Size', fmtBytes(info.size), fmtBytes(out.blob.size)],
        ['Picture', info.width + ' × ' + info.height, after && after.width ? after.width + ' × ' + after.height : out.width + ' × ' + out.height],
        ['Frame rate', info.fps ? info.fps + ' fps' : '–', after && after.fps ? after.fps + ' fps' : '–'],
        ['Picture bitrate', VK.fmtRate(info.videoBitrate), VK.fmtRate(after && after.videoBitrate)],
        ['Video codec', VK.codecName(info.video && info.video.codec), after && after.video ? VK.codecName(after.video.codec) : (out.mime || '–')],
        ['Sound', info.audio ? VK.codecName(info.audio.codec) + ', ' + VK.fmtRate(info.audioBitrate) : 'none', after && after.audio ? VK.codecName(after.audio.codec) + ', ' + VK.fmtRate(after.audioBitrate) : 'none'],
        ['Length', VK.fmtT(info.duration, 2), VK.fmtT(after ? after.duration : out.seconds, 2)]];
      const tbl = VK.table(rows.slice(1), 'vk-compare');
      const thead = el('thead'); const hr = el('tr'); rows[0].forEach((c) => { const th = el('th', null, c); th.scope = 'col'; hr.appendChild(th); }); thead.appendChild(hr); tbl.insertBefore(thead, tbl.firstChild);
      if (after) VK.release(after);
      const saved = 1 - out.blob.size / info.size;
      const notes = [];
      if (out.route === 'recorder') notes.push('Recorded in real time with this browser’s media recorder (' + out.mime + '), because it has no on-device H.264 encoder; the size is set by the browser, not by the target.');
      if (target) notes.push(out.blob.size <= target ? 'Under the ' + fmtBytes(target) + ' target' + (passes > 1 ? ' after ' + passes + ' passes.' : '.') : 'Still over the ' + fmtBytes(target) + ' target after ' + passes + ' passes' + (floor ? ': the encoder cannot make this picture any smaller at this resolution' : '') + '. A lower resolution or frame rate will get it there.');
      if (out.audioRoute === 'dropped') notes.push('This browser could not encode the sound, so the video is silent.');
      if (saved <= 0) notes.push('This is not smaller than your original, which was already well compressed: keep the original, or choose a lower resolution or a smaller quality.');
      VK.result(ui.results, out.blob, name, (saved > 0 ? Math.round(saved * 100) + '% smaller' : 'not smaller') + ' · ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s', { note: notes.join(' '), table: tbl });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(out.blob.size) + ' from ' + fmtBytes(info.size) + (saved > 0 ? ' (' + Math.round(saved * 100) + '% smaller)' : ' (not smaller)') + (passes > 1 ? ', ' + passes + ' passes' : '') + '.';
      VK.lastCompress = { passes, size: out.blob.size, target, bitrate, floor, route: out.route || 'encode' };
    }

    return { state: S, plan: () => info && plan(info, S) };
  }

  A.tools['video-compressor'] = { mount, plan, QUALITY, MIN_BPP };
})();
