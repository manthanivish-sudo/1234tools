/**
 * Silence Remover (/audio/silence-remover/).
 *
 * Finds the stretches quieter than a threshold (−30 to −60 dBFS, measured
 * as the loudest channel's level over 10 ms windows) that last at least a
 * minimum (0.3 to 3 s), and takes them out — all of each, or shortened to a
 * pause of the length chosen — leaving a little of the quiet either side
 * so words are not clipped, with a 10 ms fade at every join. The waveform
 * marks what will go before anything is saved.
 *
 * Remembered in localStorage '1234tools-silence-remover-v1': threshold,
 * minimum, padding, what is left, format, bitrate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, select, range, button, fmtBytes } = A;
  const KEY = '1234tools-silence-remover-v1';
  const LEAVE = [['0', 'Nothing: cut it all'], ['0.25', 'A 0.25 s pause'], ['0.5', 'A 0.5 s pause']];

  /** The kept ranges for found silences: each silence loses all but `pad` at each end, or is shortened to `leave` seconds. */
  function keepFrom(sil, D, pad, leave) {
    const keep = [];
    let at = 0;
    for (const s of sil) {
      const cutA = s.start + pad, cutB = s.end - pad;
      const len = cutB - cutA;
      if (len <= leave + 0.02) continue;
      const a = cutA + leave / 2, b = cutB - leave / 2;
      if (a > at) keep.push([at, a]);
      at = b;
    }
    if (D > at) keep.push([at, D]);
    return keep;
  }

  function mount(root) {
    const st = VK.store(KEY, { threshold: -40, min: 0.7, pad: 0.15, leave: '0', format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (k !== 'threshold' || (v >= -60 && v <= -30)) && (k !== 'min' || (v >= 0.3 && v <= 3)) && (k !== 'pad' || (v >= 0 && v <= 0.5)) && (k !== 'leave' || LEAVE.some((l) => l[0] === v)));
    const S = Object.assign({}, st.values);
    let snd = null, sil = [], seq = 0;
    const ui = VK.shell(root, { id: 'ar', kind: 'audio', label: 'Choose a recording', hint: 'MP3, WAV, M4A, FLAC, Ogg or a video. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => load(f[0], n) });
    const wave = AK.waveform('Waveform of the recording; the silences to be removed are shaded');
    const stage = el('div', 'aiimg-stage ak-stage'); stage.appendChild(wave.el);
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const thrR = range('ar-threshold', -60, -30, 1, S.threshold, (v) => v + ' dBFS');
    const minR = range('ar-min', 0.3, 3, 0.1, S.min, (v) => v.toFixed(1) + ' s');
    const padR = range('ar-pad', 0, 0.5, 0.05, S.pad, (v) => v.toFixed(2) + ' s');
    const leaveSel = select('ar-leave', LEAVE, S.leave);
    const picker = AK.formatPicker('ar', S, sync);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Remove the silences', (signal, j) => run(signal, j));
    ui.side.append(field('Quieter than', thrR, 'Raise it (towards −30) for a noisy room.'), field('For at least', minR), field('Keep either side', padR, 'So the start and end of words are not clipped.'), field('Leave in its place', leaveSel), ...picker.fields, est, J.el, button('Choose another file', 'btn-ghost', () => ui.pick()));

    let timer = 0;
    function sync() {
      S.threshold = Number(thrR.input.value); S.min = Number(minR.input.value); S.pad = Number(padR.input.value); S.leave = leaveSel.value;
      st.save(S);
      if (!snd) return;
      clearTimeout(timer);
      timer = setTimeout(find, 150);
    }
    async function find() {
      const my = ++seq;
      est.textContent = 'Looking for silences…';
      const found = await AK.dsp('silences', AK.planesOf(snd.buffer), snd.rate, { threshold: S.threshold, min: S.min });
      if (my !== seq) return;
      sil = found;
      const keep = keepFrom(sil, snd.duration, S.pad, Number(S.leave));
      const kept = keep.reduce((s, [a, b]) => s + b - a, 0);
      const D = snd.duration;
      const marks = [];
      let at = 0; for (const [a, b] of keep) { if (a > at) marks.push([at / D, a / D]); at = b; }
      wave.draw({ sel: [0, 1], marks });
      est.textContent = sil.length ? sil.length + ' silence' + (sil.length === 1 ? '' : 's') + ' found; ' + (D - kept).toFixed(2) + ' s will go, leaving ' + VK.fmtT(kept, 2) + ' of ' + VK.fmtT(D, 2) + '.' : 'No silence quieter than ' + S.threshold + ' dBFS for ' + S.min.toFixed(1) + ' s or more. Raise the threshold or shorten the minimum.';
      J.go.disabled = J.busy || !marks.length;
      VK.lastSilences = { found: sil, keep };
    }
    for (const r of [thrR, minR, padR]) r.input.addEventListener('input', sync);
    leaveSel.addEventListener('change', sync);

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await AK.decodeFile(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      snd = next;
      wave.set(AK.planesOf(snd.buffer));
      about.textContent = file.name + ': ' + AK.describe(snd) + '.';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function run(signal, j) {
      if (!snd) return;
      const keep = keepFrom(sil, snd.duration, S.pad, Number(S.leave));
      j.progress(0.1, 'Cutting');
      const planes = await AK.dsp('cut', AK.planesOf(snd.buffer, Math.min(2, snd.channels)), snd.rate, { keep, fade: 0.01 }, null, signal);
      const r = await AK.encode(planes, snd.rate, S.format, { bitrate: S.bitrate, signal, onProgress: (x) => j.progress(0.3 + 0.7 * x, 'Saving') });
      const name = AK.nameFor(snd.name, 'tightened', r.blob);
      const secs = planes[0].length / snd.rate;
      VK.result(ui.results, r.blob, name, VK.fmtT(secs, 2) + ' (was ' + VK.fmtT(snd.duration, 2) + ')', { note: sil.length + ' silence' + (sil.length === 1 ? '' : 's') + ' shortened, ' + (snd.duration - secs).toFixed(2) + ' s taken out. ' + r.note });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(r.blob.size) + ', ' + secs.toFixed(3) + ' s.';
      VK.lastAudio = { seconds: secs, samples: planes[0].length, rate: snd.rate, removed: snd.duration - secs };
    }
    return { state: S };
  }

  A.tools['silence-remover'] = { mount, keepFrom };
})();
