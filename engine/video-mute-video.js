/**
 * Mute Video (/video/mute-video/).
 *
 * The same video without its sound track. The picture's samples are
 * copied untouched into a new file (MP4 for MP4, MOV and MKV; WebM for
 * WebM), so there is no loss of quality and a long video takes seconds.
 * Only when the picture cannot be copied (a codec the new box cannot
 * describe) is it re-encoded, and the page says so.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, button, fmtBytes } = A;

  const boxFor = (info) => (info.container === 'webm' ? 'webm' : 'mp4');

  function mount(root) {
    let info = null, preview = null;
    const ui = VK.shell(root, { id: 'vm', label: 'Choose a video to mute', onFiles: (f, n) => load(f[0], n) });
    const stage = el('div', 'aiimg-stage vk-stage');
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Remove the sound', (signal, j) => mute(signal, j));
    ui.side.append(est, J.el, button('Choose another video', 'btn-ghost', () => ui.pick()));

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.video && !next.element) { VK.release(next); ui.say(file.name + ': there is no picture in this file.', 'error'); return; }
      VK.release(info);
      if (preview) { URL.revokeObjectURL(preview.src); preview.remove(); }
      info = next;
      preview = el('video', 'vk-preview'); preview.controls = true; preview.playsInline = true; preview.preload = 'metadata';
      preview.src = URL.createObjectURL(file);
      preview.setAttribute('aria-label', 'The original video, ' + file.name);
      stage.appendChild(preview);
      about.textContent = file.name + ': ' + VK.describe(info) + '.';
      const box = boxFor(info);
      const copy = info.video && VK.copyable(info.video, box);
      est.textContent = (info.audio ? '' : 'This video has no sound track already; a copy without one can still be made. ') +
        (copy ? 'The picture will be copied untouched into a new ' + VK.boxName(box) + ': same quality, same size less the sound.' : 'The picture cannot be copied as it is' + (info.video ? ' (' + VK.codecName(info.video.codec) + ')' : '') + ', so it will be re-encoded.');
      est.className = 'sv-est vk-est' + (copy ? '' : ' is-warn');
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
    }

    async function mute(signal, j) {
      if (!info) return;
      const box = boxFor(info);
      let out, how;
      if (info.video && VK.copyable(info.video, box)) {
        out = await VK.remux(info, { box, audio: false, signal, onProgress: (x) => j.progress(x, 'Copying the picture') });
        how = 'The picture was copied untouched; the sound track is gone.';
      } else {
        const bitrate = Math.max(info.videoBitrate ? info.videoBitrate * 1.2 : 0, info.width * info.height * (info.fps || 30) * 0.08);
        out = await VK.transcode(info, { box, bitrate, audio: 'none', signal, onProgress: (x) => j.progress(x, 'Re-encoding') });
        if (!out) {
          out = await VK.record(info, { audio: false, signal, onProgress: (x) => j.progress(x, 'Recording in real time') });
          how = 'Recorded in real time without sound (' + out.mime + '), because this browser has no on-device video encoder.';
        } else how = 'The picture was re-encoded as ' + VK.codecName(out.videoCodec) + ' without sound.';
      }
      const name = info.name + '-muted.' + VK.extOf(out.blob);
      VK.result(ui.results, out.blob, name, 'no sound', { note: how });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(out.blob.size) + ' (was ' + fmtBytes(info.size) + ').';
    }
    return {};
  }

  A.tools['mute-video'] = { mount, boxFor };
})();
