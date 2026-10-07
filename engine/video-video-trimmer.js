/**
 * Video Trimmer (/video/video-trimmer/).
 *
 * Keep one part of a video. The handles move a frame at a time (the frame
 * times come from the file's own index), the preview shows the frame under
 * the handle being moved, and the selection can be played.
 *
 * Two ways to cut, and the page says which one ran:
 *   Exact      — the part is decoded and re-encoded (H.264 MP4, or VP9 WebM
 *                for a WebM), starting on the very frame chosen. The sound
 *                is copied packet by packet when it fits the box.
 *   Fast       — the samples are copied untouched (no quality loss, a few
 *                seconds for any length), but a cut can only begin on a
 *                keyframe, so the clip starts at the keyframe at or before
 *                the chosen start; the page shows how much earlier.
 *
 * Remembered in localStorage '1234tools-video-trimmer-v1': the mode.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-video-trimmer-v1';
  const MODES = [['exact', 'Exact, on your frame (re-encodes)'], ['fast', 'Fast, no quality loss (keyframe)']];

  /** Where a fast cut really starts: the keyframe at or before `start`. */
  function keyframeBefore(info, start) {
    const k = info.keyframes || [];
    let best = k.length ? k[0] : 0;
    for (const t of k) if (t <= start + 1e-6) best = t;
    return best;
  }
  /** The box a trimmed file goes in: WebM stays WebM, everything else becomes MP4. */
  const boxFor = (info) => (info.container === 'webm' ? 'webm' : 'mp4');

  function mount(root) {
    const st = VK.store(KEY, { mode: 'exact' }, (k, v) => MODES.some((m) => m[0] === v));
    const S = Object.assign({}, st.values);
    let info = null, preview = null, bar = null, playing = false, raf = 0;
    const ui = VK.shell(root, { id: 'vt', label: 'Choose a video to trim', onFiles: (f, n) => load(f[0], n) });
    const stage = el('div', 'aiimg-stage vk-stage');
    const about = el('p', 'field-hint vk-about');
    const barBox = el('div', 'vk-barbox');
    const playB = button('▶ Play the selection', 'btn-ghost', () => togglePlay());
    const transport = el('div', 'aiimg-transport'); transport.append(playB);
    ui.stageCol.append(stage, barBox, transport, about);

    const modeSel = select('vt-mode', MODES, S.mode);
    const modeHint = el('p', 'sv-est vk-est'); modeHint.setAttribute('aria-live', 'polite');
    const J = VK.job('Trim the video', (signal, j) => trim(signal, j));
    const capsP = el('p', 'field-hint');
    VK.capsLine().then((p) => capsP.replaceWith(p));
    ui.side.append(field('How to cut', modeSel), modeHint, J.el, capsP, button('Choose another video', 'btn-ghost', () => ui.pick()));

    function canFast() {
      if (!info || !info.video) return 'this file could not be indexed, so it can only be re-encoded';
      const box = boxFor(info);
      if (!VK.copyable(info.video, box)) return 'its picture (' + VK.codecName(info.video.codec) + ') cannot be copied into ' + VK.boxName(box);
      if (info.audio && !VK.copyable(info.audio, box)) return 'its sound (' + VK.codecName(info.audio.codec) + ') cannot be copied into ' + VK.boxName(box);
      return '';
    }
    function hint() {
      if (!info || !bar) return;
      const why = canFast();
      modeSel.options[1].disabled = !!why;
      if (why && S.mode === 'fast') { S.mode = 'exact'; modeSel.value = 'exact'; }
      if (S.mode === 'fast') {
        const k = keyframeBefore(info, bar.start);
        const early = bar.start - k;
        modeHint.textContent = early > 0.0005 ? 'A fast cut starts at the keyframe at ' + VK.fmtT(k, 3) + ', ' + early.toFixed(3) + ' s before your start. Choose Exact to start on your frame.' : 'Your start is on a keyframe, so the fast cut starts exactly there.';
        modeHint.className = 'sv-est vk-est' + (early > 0.0005 ? ' is-warn' : '');
      } else {
        modeHint.textContent = 'The part is re-encoded so it starts on the frame you chose' + (why ? '. A fast cut is not offered for this file: ' + why + '.' : '. Fast keeps the original quality but starts at a keyframe.');
        modeHint.className = 'sv-est vk-est';
      }
    }
    modeSel.addEventListener('change', () => { S.mode = modeSel.value; st.save(S); hint(); });

    function show(t) {
      if (!preview || !isFinite(t)) return;
      /* a quarter of a frame in, so the player shows that frame and not the one before */
      const q = info.fps ? 0.25 / info.fps : 0.005;
      try { preview.currentTime = clamp(t + q, 0, Math.max(0, info.duration - 0.001)); } catch (e) { /* */ }
    }
    function stopPlay() { if (!playing) return; playing = false; cancelAnimationFrame(raf); try { preview.pause(); } catch (e) { /* */ } playB.textContent = '▶ Play the selection'; bar.playhead(null); }
    async function togglePlay() {
      if (!preview || !bar || J.busy) return;
      if (playing) { stopPlay(); return; }
      preview.currentTime = bar.start; playing = true; playB.textContent = '❚❚ Pause';
      try { await preview.play(); } catch (e) { stopPlay(); return; }
      const tick = () => { if (!playing) return; if (preview.currentTime >= bar.end || preview.ended) { stopPlay(); show(bar.end - 0.001); return; } bar.playhead(preview.currentTime); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.video && !next.element) { VK.release(next); ui.say(file.name + ': there is no picture in this file. To cut sound, use the Audio Trimmer.', 'error'); return; }
      stopPlay();
      VK.release(info);
      if (preview) { URL.revokeObjectURL(preview.src); preview.remove(); }
      info = next;
      preview = el('video', 'vk-preview'); preview.controls = true; preview.playsInline = true; preview.preload = 'auto'; preview.muted = false;
      preview.src = URL.createObjectURL(file);
      preview.setAttribute('aria-label', 'The video, ' + file.name);
      stage.appendChild(preview);
      barBox.innerHTML = '';
      bar = VK.trimBar({ id: 'vt', duration: info.duration, frames: info.video ? info.frames : null, start: 0, end: info.duration, labels: ['Start', 'End'],
        onChange: (s, e, which) => { stopPlay(); show(which === 'end' ? (bar && info.frames ? info.frames[bar.lastKept(e)] : e - 0.001) : s); hint(); } });
      barBox.appendChild(bar.el);
      about.textContent = file.name + ': ' + VK.describe(info) + (info.keyframes && info.keyframes.length ? ', a keyframe every ' + (info.duration / info.keyframes.length).toFixed(1) + ' s on average' : '') + '.';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      hint();
    }

    async function trim(signal, j) {
      if (!info || !bar) return;
      stopPlay();
      bar.busy(true);
      try {
        const box = boxFor(info);
        const from = bar.start, to = bar.end;
        let out, how;
        if (S.mode === 'fast' && !canFast()) {
          j.progress(0, 'Copying');
          out = await VK.remux(info, { box, from, to, signal, onProgress: (x) => j.progress(x, 'Copying') });
          how = 'Copied without re-encoding, from the keyframe at ' + VK.fmtT(out.start, 3) + (out.start < from - 0.0005 ? ' (' + (from - out.start).toFixed(3) + ' s before your start)' : '') + '.';
          out.seconds = out.end - out.start;
        } else {
          const bitrate = Math.max(info.videoBitrate ? info.videoBitrate * 1.2 : 0, info.width * info.height * (info.fps || 30) * 0.08);
          out = await VK.transcode(info, { box, from, to, bitrate, audio: 'copy', signal, onProgress: (x) => j.progress(x, 'Re-encoding') });
          if (!out) {
            out = await VK.record(info, { from, to, signal, onProgress: (x) => j.progress(x, 'Recording in real time') });
            how = 'Recorded in real time with this browser’s media recorder (' + out.mime + '), because it has no on-device video encoder.';
          } else how = 'Re-encoded from the frame at ' + VK.fmtT(from, 3) + ' (' + VK.codecName(out.videoCodec) + (out.audioCodec ? ' + ' + VK.codecName(out.audioCodec) + (out.audioRoute === 'copy' ? ', sound copied' : '') : '') + ').';
        }
        const name = info.name + '-trimmed.' + VK.extOf(out.blob);
        VK.result(ui.results, out.blob, name, VK.fmtT(out.seconds, 3) + ' long', { note: how });
        j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(out.blob.size) + ', ' + out.seconds.toFixed(3) + ' s.';
        VK.lastTrim = { mode: S.mode, from, to, start: out.start, end: out.end, seconds: out.seconds, size: out.blob.size };
      } finally { bar.busy(false); }
    }
    return { state: S };
  }

  A.tools['video-trimmer'] = { mount, keyframeBefore, boxFor };
})();
