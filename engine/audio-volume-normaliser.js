/**
 * Volume Normaliser (/audio/volume-normaliser/).
 *
 * Measures a file's loudness the way broadcasters and streaming services do
 * (ITU-R BS.1770-4 integrated loudness in LUFS, with its true peak), then
 * applies one gain so it lands on the chosen target: −14 LUFS (music
 * streaming), −16 (podcasts), −19, −23 (EBU R128 broadcast) or a peak of
 * −1 dBTP. The gain is never allowed to push the true peak over −1 dBTP:
 * when it would, the gain stops there and the page says how loud the
 * result is instead. No compression or limiting is applied, so the
 * dynamics are untouched. The result is measured again and both readings
 * are shown.
 *
 * Remembered in localStorage '1234tools-volume-normaliser-v1': target,
 * format, bitrate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit, DSP = window.AudioDSP;
  if (!A || !VK || !AK) return;
  const { el, field, select, button, fmtBytes } = A;
  const KEY = '1234tools-volume-normaliser-v1';
  const TARGETS = [['-14', '−14 LUFS — music streaming'], ['-16', '−16 LUFS — podcasts'], ['-19', '−19 LUFS — quieter speech'], ['-23', '−23 LUFS — EBU R128 broadcast'], ['peak', 'Loudest peak at −1 dBTP']];
  const CEILING = -1;
  const f1 = (v) => (isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(1) : '−∞');

  /** The gain in dB for a measurement and a target, and whether the ceiling held it back. */
  function plan(m, target) {
    if (!isFinite(m.integrated) && target !== 'peak') return { gain: 0, limited: false, silent: true };
    const want = target === 'peak' ? CEILING - m.truePeak : Number(target) - m.integrated;
    const room = CEILING - m.truePeak;
    const gain = Math.min(want, room);
    return { gain, want, limited: gain < want - 0.05 };
  }

  function mount(root) {
    const st = VK.store(KEY, { target: '-16', format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (k !== 'target' || TARGETS.some((t) => t[0] === v)));
    const S = Object.assign({}, st.values);
    let snd = null, meas = null, measuring = null;
    const ui = VK.shell(root, { id: 'an', kind: 'audio', label: 'Choose a sound file', hint: 'MP3, WAV, M4A, FLAC, Ogg or a video. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => load(f[0], n) });
    const wave = AK.waveform('Waveform of the sound');
    const stage = el('div', 'aiimg-stage ak-stage'); stage.appendChild(wave.el);
    const about = el('p', 'field-hint vk-about');
    const readout = el('div', 'ak-readout'); readout.setAttribute('aria-live', 'polite');
    ui.stageCol.append(stage, about, readout);
    const tSel = select('an-target', TARGETS, S.target);
    const picker = AK.formatPicker('an', S, sync);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Normalise', (signal, j) => run(signal, j));
    ui.side.append(field('Target', tSel, 'The gain never takes the true peak above −1 dBTP.'), ...picker.fields, est, J.el, button('Choose another file', 'btn-ghost', () => ui.pick()));

    function show(m, label) {
      return VK.table([[label + ' integrated loudness', f1(m.integrated) + ' LUFS'], [label + ' true peak', f1(m.truePeak) + ' dBTP'], [label + ' sample peak', f1(m.peak) + ' dBFS']], 'ak-meas');
    }
    function sync() {
      S.target = tSel.value; st.save(S);
      if (!meas) { est.textContent = snd ? 'Measuring…' : ''; J.go.disabled = true; return; }
      const p = plan(meas, S.target);
      J.go.disabled = J.busy || p.silent;
      if (p.silent) { est.textContent = 'This file is silent: there is nothing to normalise.'; return; }
      const after = meas.integrated + p.gain;
      est.textContent = (p.gain >= 0 ? 'Raise' : 'Lower') + ' by ' + Math.abs(p.gain).toFixed(1) + ' dB: from ' + f1(meas.integrated) + ' to ' + f1(after) + ' LUFS, true peak ' + f1(meas.truePeak + p.gain) + ' dBTP.' +
        (p.limited ? ' The target would take the true peak above −1 dBTP, so the gain stops there: the result is quieter than ' + (S.target === 'peak' ? 'asked' : S.target.replace('-', '−') + ' LUFS') + '.' : '');
      est.className = 'sv-est vk-est' + (p.limited ? ' is-warn' : '');
    }
    tSel.addEventListener('change', sync);

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await AK.decodeFile(file); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      snd = next; meas = null;
      wave.set(AK.planesOf(snd.buffer));
      about.textContent = file.name + ': ' + AK.describe(snd) + '.';
      readout.innerHTML = '';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
      const mine = measuring = AK.dsp('loudness', AK.planesOf(snd.buffer), snd.rate);
      try {
        const m = await mine;
        if (measuring !== mine) return;
        meas = m; readout.innerHTML = ''; readout.appendChild(show(m, 'Now'));
      } catch (e) { est.textContent = 'The loudness could not be measured: ' + ((e && e.message) || e); }
      sync();
    }

    async function run(signal, j) {
      if (!snd || !meas) return;
      const p = plan(meas, S.target);
      j.progress(0.05, 'Applying ' + p.gain.toFixed(1) + ' dB');
      const planes = DSP.gain(AK.planesOf(snd.buffer, Math.min(2, snd.channels)), p.gain);
      const r = await AK.encode(planes, snd.rate, S.format, { bitrate: S.bitrate, signal, onProgress: (x) => j.progress(0.1 + 0.6 * x, 'Saving') });
      j.progress(0.75, 'Measuring the result');
      const after = await AK.dsp('loudness', planes, snd.rate, null, null, signal);
      const name = AK.nameFor(snd.name, 'normalised', r.blob);
      const tbl = show(meas, 'Before');
      for (const tr of show(after, 'After').querySelectorAll('tr')) tbl.querySelector('tbody').appendChild(tr);
      VK.result(ui.results, r.blob, name, (p.gain >= 0 ? '+' : '−') + Math.abs(p.gain).toFixed(1) + ' dB', { note: 'One gain of ' + p.gain.toFixed(1) + ' dB, nothing else changed.' + (p.limited ? ' Held back by the −1 dBTP ceiling.' : '') + ' ' + r.note, table: tbl });
      j.status.textContent = 'Done: ' + name + ', ' + f1(after.integrated) + ' LUFS, true peak ' + f1(after.truePeak) + ' dBTP.';
      VK.lastAudio = { gain: p.gain, before: meas, after, limited: p.limited };
    }
    sync();
    return { state: S };
  }

  A.tools['volume-normaliser'] = { mount, plan };
})();
