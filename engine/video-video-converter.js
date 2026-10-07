/**
 * Video Converter (/video/video-converter/).
 *
 * MOV, MKV, WebM or MP4 in; MP4 (H.264 + AAC) or WebM (VP9 + Opus) out,
 * sound kept. When the tracks already suit the new box — a MOV or MKV
 * holding H.264 and AAC going to MP4, a WebM's VP9 and Opus going to MP4 —
 * they are copied untouched ("repackaged"): no loss and no waiting. Else
 * the picture is re-encoded at the quality chosen and the sound is copied
 * when it fits, re-encoded when it does not.
 *
 * Remembered in localStorage '1234tools-video-converter-v1': the format,
 * the copy preference and the quality.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, check, button, fmtBytes } = A;
  const KEY = '1234tools-video-converter-v1';
  const FORMATS = [['mp4', 'MP4 — H.264 video, AAC sound: plays everywhere'], ['webm', 'WebM — VP9 video, Opus sound: for the web']];
  const QUALITY = { high: 0.10, balanced: 0.06, small: 0.035 };
  const QUALITY_OPTS = [['high', 'High'], ['balanced', 'Balanced'], ['small', 'Small']];

  /** 'copy' when both tracks can be moved into the box untouched; else the reason they cannot. */
  function plan(info, box, preferCopy) {
    if (!preferCopy) return { route: 'encode', why: 'you chose to re-encode' };
    if (!info.video) return { route: 'encode', why: 'the file could not be indexed' };
    if (!VK.copyable(info.video, box)) return { route: 'encode', why: VK.codecName(info.video.codec) + ' video does not go into ' + VK.boxName(box) + ' as it is' };
    if (info.audio && !VK.copyable(info.audio, box)) return { route: 'encode', why: VK.codecName(info.audio.codec) + ' sound does not go into ' + VK.boxName(box) + ' as it is' };
    return { route: 'copy', why: '' };
  }

  function mount(root) {
    const st = VK.store(KEY, { box: 'mp4', copy: true, quality: 'high' }, (k, v) => (k === 'box' ? v === 'mp4' || v === 'webm' : k === 'copy' ? typeof v === 'boolean' : !!QUALITY[v]));
    const S = Object.assign({}, st.values);
    let info = null, preview = null;
    const ui = VK.shell(root, { id: 'vv', label: 'Choose a video to convert', hint: 'MOV, MP4, MKV or WebM, or drop it here. Nothing is uploaded.', onFiles: (f, n) => load(f[0], n) });
    const stage = el('div', 'aiimg-stage vk-stage');
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const boxSel = select('vv-format', FORMATS, S.box);
    const copyC = check('vv-copy', 'Copy the picture and sound untouched when they already fit (no quality loss, much faster)', S.copy);
    const qualSel = select('vv-quality', QUALITY_OPTS, S.quality);
    const qualField = field('Quality when re-encoding', qualSel);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Convert the video', (signal, j) => convert(signal, j));
    const capsP = el('p', 'field-hint');
    VK.capsLine().then((p) => capsP.replaceWith(p));
    ui.side.append(field('Convert to', boxSel), copyC, qualField, est, J.el, capsP, button('Choose another video', 'btn-ghost', () => ui.pick()));

    function sync() {
      S.box = boxSel.value; S.copy = copyC.input.checked; S.quality = qualSel.value;
      st.save(S);
      if (!info) return;
      const p = plan(info, S.box, S.copy);
      qualField.hidden = p.route === 'copy';
      est.textContent = p.route === 'copy' ? 'The picture and sound already suit ' + VK.boxName(S.box) + ': they will be copied untouched into the new file.' : 'The picture will be re-encoded as ' + (S.box === 'mp4' ? 'H.264' : 'VP9') + (p.why ? ' (' + p.why + ')' : '') + '.' + (info.audio ? (VK.copyable(info.audio, S.box) ? ' The sound is copied as it is.' : ' The sound is re-encoded as ' + (S.box === 'mp4' ? 'AAC (or Opus where the browser has no AAC encoder)' : 'Opus') + '.') : '');
    }
    for (const c of [boxSel, qualSel]) c.addEventListener('change', sync);
    copyC.input.addEventListener('change', sync);

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.video && !next.element) { VK.release(next); ui.say(file.name + ': there is no picture in this file. For sound files, use the Audio Converter.', 'error'); return; }
      VK.release(info);
      if (preview) { URL.revokeObjectURL(preview.src); preview.remove(); }
      info = next;
      preview = el('video', 'vk-preview'); preview.controls = true; preview.playsInline = true; preview.preload = 'metadata';
      preview.src = URL.createObjectURL(file);
      preview.setAttribute('aria-label', 'The original video, ' + file.name);
      preview.addEventListener('error', () => { about.textContent += ' This browser cannot play it here, but it may still convert it.'; }, { once: true });
      stage.appendChild(preview);
      about.textContent = file.name + ': ' + VK.describe(info) + '.';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function convert(signal, j) {
      if (!info) return;
      const box = S.box;
      const p = plan(info, box, S.copy);
      let out, how;
      if (p.route === 'copy') {
        out = await VK.remux(info, { box, signal, onProgress: (x) => j.progress(x, 'Repackaging') });
        how = 'Repackaged: the picture (' + VK.codecName(info.video.codec) + ')' + (info.audio ? ' and sound (' + VK.codecName(info.audio.codec) + ')' : '') + ' were copied untouched.';
      } else {
        const fps = info.fps || 30;
        const bitrate = info.width * info.height * fps * QUALITY[S.quality] * (box === 'webm' ? 0.8 : 1);
        out = await VK.transcode(info, { box, bitrate, audio: 'copy', signal, onProgress: (x) => j.progress(x, 'Converting') });
        if (!out) {
          out = await VK.record(info, { signal, onProgress: (x) => j.progress(x, 'Recording in real time') });
          how = 'Recorded in real time with this browser’s media recorder (' + out.mime + '), because it has no on-device ' + (box === 'mp4' ? 'H.264' : 'VP9') + ' encoder.';
        } else how = 'Re-encoded as ' + VK.codecName(out.videoCodec) + (out.audioCodec ? ' with ' + VK.codecName(out.audioCodec) + ' sound' + (out.audioRoute === 'copy' ? ' (copied)' : '') : out.audioRoute === 'dropped' ? ' — this browser could not encode the sound, so the video is silent' : '') + '.';
      }
      const name = info.name + '.' + VK.extOf(out.blob);
      VK.result(ui.results, out.blob, name, (box === 'mp4' && VK.extOf(out.blob) === 'mp4' ? 'MP4' : VK.boxName(VK.extOf(out.blob))), { note: how });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(out.blob.size) + '. ' + how;
      VK.lastConvert = { route: p.route === 'copy' ? 'copy' : out.route, box, type: out.blob.type, size: out.blob.size };
    }
    return { state: S };
  }

  A.tools['video-converter'] = { mount, plan };
})();
