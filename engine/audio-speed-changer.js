/**
 * Speed Changer (/audio/speed-changer/).
 *
 * Plays a recording faster or slower: 0.5× to 2× in steps of 0.05. With
 * "Keep the pitch" (the default) the time is stretched by WSOLA in
 * engine/audio-dsp.js, run in a worker, so voices do not turn into
 * chipmunks or giants; without it the sound is simply resampled, like a
 * record played at another speed, and the pitch moves with it (by
 * 12 × log2(speed) semitones). Saved as WAV, M4A or Opus.
 *
 * Remembered in localStorage '1234tools-speed-changer-v1': speed, keep
 * pitch, format, bitrate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, range, check, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-speed-changer-v1';
  const PRESETS = [0.75, 1.25, 1.5, 2];

  function mount(root) {
    const st = VK.store(KEY, { speed: 1.25, keep: true, format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (k !== 'speed' || (isFinite(v) && v >= 0.5 && v <= 2)) && (k !== 'keep' || typeof v === 'boolean'));
    const S = Object.assign({}, st.values);
    let snd = null;
    const ui = VK.shell(root, { id: 'as', kind: 'audio', label: 'Choose a sound file', hint: 'MP3, WAV, M4A, FLAC, Ogg or a video. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => load(f[0], n) });
    const wave = AK.waveform('Waveform of the sound');
    const stage = el('div', 'aiimg-stage ak-stage'); stage.appendChild(wave.el);
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const speedR = range('as-speed', 0.5, 2, 0.05, S.speed, (v) => v.toFixed(2) + '×');
    const chips = el('div', 'vk-chips');
    for (const v of PRESETS) { const b = button(v + '×', 'btn-ghost sv-mini', () => { speedR.set(v); sync(); }); b.setAttribute('aria-label', 'Speed ' + v + ' times'); chips.appendChild(b); }
    const speedField = field('Speed', speedR); speedField.appendChild(chips);
    const keepC = check('as-keep', 'Keep the pitch (voices stay natural)', S.keep);
    const picker = AK.formatPicker('as', S, sync);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Change the speed', (signal, j) => run(signal, j));
    ui.side.append(speedField, keepC, ...picker.fields, est, J.el, button('Choose another file', 'btn-ghost', () => ui.pick()));

    function sync() {
      S.speed = Math.round(clamp(Number(speedR.input.value), 0.5, 2) * 100) / 100; S.keep = keepC.input.checked; st.save(S);
      if (!snd) return;
      const secs = snd.duration / S.speed;
      const semis = 12 * Math.log2(S.speed);
      est.textContent = VK.fmtT(snd.duration, 2) + ' becomes ' + VK.fmtT(secs, 2) + ' at ' + S.speed.toFixed(2) + '×; ' + (S.keep ? 'the pitch stays where it is.' : 'the pitch moves ' + (semis >= 0 ? 'up' : 'down') + ' ' + Math.abs(semis).toFixed(1) + ' semitones.');
    }
    speedR.input.addEventListener('input', sync);
    keepC.input.addEventListener('change', sync);

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
      const planes = AK.planesOf(snd.buffer, Math.min(2, snd.channels));
      let out;
      if (Math.abs(S.speed - 1) < 1e-9) out = planes;
      else if (S.keep) out = await AK.dsp('stretch', planes, snd.rate, { speed: S.speed }, (v) => j.progress(0.8 * v, 'Stretching'), signal);
      else {
        /* a record at another speed: the same samples played at rate × speed, written back at the original rate */
        j.progress(0.2, 'Resampling');
        out = AK.resample(planes, Math.round(snd.rate * S.speed), snd.rate);
      }
      const r = await AK.encode(out, snd.rate, S.format, { bitrate: S.bitrate, signal, onProgress: (x) => j.progress(0.8 + 0.2 * x, 'Saving') });
      const name = AK.nameFor(snd.name, String(S.speed).replace('.', '_') + 'x', r.blob);
      const secs = out[0].length / snd.rate;
      VK.result(ui.results, r.blob, name, VK.fmtT(secs, 2) + ' · ' + S.speed.toFixed(2) + '×', { note: (S.keep ? 'Time-stretched with the pitch kept (WSOLA).' : 'Resampled: the pitch moved with the speed.') + ' ' + r.note });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(r.blob.size) + ', ' + secs.toFixed(3) + ' s.';
      VK.lastAudio = { seconds: secs, samples: out[0].length, rate: snd.rate, speed: S.speed, keep: S.keep };
    }
    sync();
    return { state: S };
  }

  A.tools['speed-changer'] = { mount };
})();
