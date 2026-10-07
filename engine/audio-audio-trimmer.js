/**
 * Audio Trimmer (/audio/audio-trimmer/).
 *
 * A sound file in, drawn as a waveform; two handles (dragged, typed, or
 * stepped 10 ms with the buttons, 0.1 s with the arrow keys and 1 s with
 * Shift) choose a part; the part can be played; then either the part is
 * kept or it is cut out and the rest joined. Optional fades at the ends of
 * what is kept (and a short one at a join, so it does not click). Saved as
 * WAV, M4A or Opus. Cuts are to the sample: the times shown are the times
 * cut.
 *
 * Remembered in localStorage '1234tools-audio-trimmer-v1': mode, fades,
 * format, bitrate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit, DSP = window.AudioDSP;
  if (!A || !VK || !AK) return;
  const { el, field, select, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-audio-trimmer-v1';
  const MODES = [['keep', 'Keep the selection'], ['remove', 'Cut the selection out, keep the rest']];
  const FADES = [['0', 'None'], ['0.5', '0.5 s'], ['1', '1 s'], ['2', '2 s'], ['3', '3 s']];
  const JOIN_FADE = 0.01;

  /** The kept ranges, in seconds, for a selection [a, b] of a sound D seconds long. */
  function keepRanges(mode, a, b, D) {
    if (mode === 'keep') return [[a, b]];
    return [[0, a], [b, D]].filter(([x, y]) => y - x > 1e-6);
  }

  function mount(root) {
    const st = VK.store(KEY, { mode: 'keep', fadeIn: '0', fadeOut: '0', format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (k !== 'mode' || MODES.some((m) => m[0] === v)) && (!/^fade/.test(k) || FADES.some((f) => f[0] === v)));
    const S = Object.assign({}, st.values);
    let snd = null, bar = null, audio = null, playing = false, raf = 0;
    const ui = VK.shell(root, { id: 'at', kind: 'audio', label: 'Choose a sound file to trim', hint: 'MP3, WAV, M4A, FLAC, Ogg or a video, or drop it here. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => load(f[0], n) });
    const wave = AK.waveform('Waveform of the sound, with the selection highlighted');
    const barBox = el('div', 'vk-barbox');
    const playB = button('▶ Play the selection', 'btn-ghost', () => togglePlay());
    const transport = el('div', 'aiimg-transport'); transport.append(playB);
    const about = el('p', 'field-hint vk-about');
    const stage = el('div', 'aiimg-stage ak-stage'); stage.appendChild(wave.el);
    ui.stageCol.append(stage, barBox, transport, about);
    const modeSel = select('at-mode', MODES, S.mode);
    const fiSel = select('at-fadein', FADES, S.fadeIn), foSel = select('at-fadeout', FADES, S.fadeOut);
    const grid = el('div', 'aiimg-grid2'); grid.append(field('Fade in', fiSel), field('Fade out', foSel));
    const picker = AK.formatPicker('at', S, sync);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Trim the sound', (signal, j) => trim(signal, j));
    ui.side.append(field('What to keep', modeSel), grid, ...picker.fields, est, J.el, button('Choose another file', 'btn-ghost', () => ui.pick()));

    function redraw() {
      if (!snd || !bar) return;
      const D = snd.duration;
      const sel = [bar.start / D, bar.end / D];
      wave.draw({ sel: S.mode === 'keep' ? sel : [0, 1], marks: S.mode === 'remove' ? [sel] : [], head: playing && audio ? audio.currentTime / D : null });
    }
    function sync() {
      S.mode = modeSel.value; S.fadeIn = fiSel.value; S.fadeOut = foSel.value;
      st.save(S);
      if (!snd || !bar) return;
      const kept = keepRanges(S.mode, bar.start, bar.end, snd.duration).reduce((s, [a, b]) => s + b - a, 0);
      const ch = Math.min(2, snd.channels);
      const bytes = S.format === 'wav' ? kept * snd.rate * ch * 2 : kept * Number(S.bitrate) * 125;
      est.textContent = (S.mode === 'keep' ? 'Keeping ' : 'Cutting out ' + (bar.end - bar.start).toFixed(3) + ' s and keeping ') + kept.toFixed(3) + ' s: about ' + fmtBytes(bytes) + ' as ' + S.format.toUpperCase() + '.';
      redraw();
    }
    for (const c of [modeSel, fiSel, foSel]) c.addEventListener('change', sync);

    function stopPlay() { if (!playing) return; playing = false; cancelAnimationFrame(raf); try { audio.pause(); } catch (e) { /* */ } playB.textContent = '▶ Play the selection'; redraw(); }
    async function togglePlay() {
      if (!audio || !bar || J.busy) return;
      if (playing) { stopPlay(); return; }
      audio.currentTime = bar.start; playing = true; playB.textContent = '❚❚ Pause';
      try { await audio.play(); } catch (e) { stopPlay(); return; }
      const tick = () => { if (!playing) return; if (audio.currentTime >= bar.end || audio.ended) { stopPlay(); return; } redraw(); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await AK.decodeFile(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      stopPlay();
      if (audio) { URL.revokeObjectURL(audio.src); audio.remove(); }
      snd = next;
      audio = el('audio', 'ak-player'); audio.controls = true; audio.preload = 'auto'; audio.src = URL.createObjectURL(file);
      audio.setAttribute('aria-label', 'The sound, ' + file.name);
      ui.stageCol.insertBefore(audio, about);
      wave.set(AK.planesOf(snd.buffer));
      barBox.innerHTML = '';
      bar = VK.trimBar({ id: 'at', duration: snd.duration, frames: null, start: 0, end: snd.duration, step: 0.01, keyStep: 0.1, labels: ['Start', 'End'], onChange: () => { stopPlay(); sync(); } });
      barBox.appendChild(bar.el);
      about.textContent = file.name + ': ' + AK.describe(snd) + '.';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function trim(signal, j) {
      if (!snd || !bar) return;
      stopPlay();
      bar.busy(true);
      try {
        j.progress(0.05, 'Cutting');
        const all = AK.planesOf(snd.buffer, Math.min(2, snd.channels));
        const keep = keepRanges(S.mode, bar.start, bar.end, snd.duration);
        if (!keep.length) throw new Error('that would leave nothing: move a handle.');
        const planes = DSP.cutRanges(all, snd.rate, keep, keep.length > 1 ? JOIN_FADE : 0);
        DSP.fade(planes, snd.rate, Number(S.fadeIn), Number(S.fadeOut));
        const r = await AK.encode(planes, snd.rate, S.format, { bitrate: S.bitrate, signal, onProgress: (x) => j.progress(0.1 + 0.9 * x, 'Saving') });
        const name = AK.nameFor(snd.name, 'trimmed', r.blob);
        const secs = planes[0].length / snd.rate;
        const what = S.mode === 'keep' ? 'Kept ' + VK.fmtT(bar.start, 3) + ' to ' + VK.fmtT(bar.end, 3) : 'Cut out ' + VK.fmtT(bar.start, 3) + ' to ' + VK.fmtT(bar.end, 3) + ' and joined the rest';
        VK.result(ui.results, r.blob, name, secs.toFixed(3) + ' s', { note: what + (Number(S.fadeIn) || Number(S.fadeOut) ? ', with fades' : '') + '. ' + r.note });
        j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(r.blob.size) + ', ' + secs.toFixed(3) + ' s.';
        VK.lastAudio = { seconds: secs, samples: planes[0].length, rate: snd.rate };
      } finally { bar.busy(false); }
    }
    return { state: S };
  }

  A.tools['audio-trimmer'] = { mount, keepRanges };
})();
