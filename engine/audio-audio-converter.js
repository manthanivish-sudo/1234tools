/**
 * Audio Converter (/audio/audio-converter/).
 *
 * Sound files in (anything the browser decodes: MP3, WAV, M4A/AAC, FLAC,
 * Ogg Opus or Vorbis, WebM, and the sound of a video), one file out each:
 * WAV (16-bit; at the file's own rate, or 48, 44.1, 22.05 or 16 kHz), M4A
 * (AAC at 96–192 kbit/s) or Opus in Ogg (32–128 kbit/s); stereo kept or
 * mixed to mono. Several files at once, one after another; each is
 * reported by name, and a ZIP of them all is offered.
 *
 * Remembered in localStorage '1234tools-audio-converter-v1': format,
 * bitrate, channels, rate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, select, button, fmtBytes } = A;
  const KEY = '1234tools-audio-converter-v1';
  const CHANNELS = [['keep', 'As they are (mono stays mono)'], ['1', 'Mono — one channel'], ['2', 'Stereo — two channels']];
  const RATES = [['keep', 'The file’s own rate'], ['48000', '48 kHz'], ['44100', '44.1 kHz (CD)'], ['22050', '22.05 kHz'], ['16000', '16 kHz (speech)']];

  /** planes at `from` → `to` Hz, whole. */
  function resample(planes, from, to) {
    if (from === to) return planes;
    const rs = VK.Resampler(from, to, planes.length);
    const a = rs.push(planes), b = rs.flush();
    return a.map((p, c) => { const o = new Float32Array(p.length + b[c].length); o.set(p); o.set(b[c], p.length); return o; });
  }

  function mount(root) {
    const st = VK.store(KEY, { format: 'm4a', bitrate: '128', channels: 'keep', rate: 'keep' }, (k, v) => AK.okFormat(k, v) && (k !== 'channels' || CHANNELS.some((c) => c[0] === v)) && (k !== 'rate' || RATES.some((r) => r[0] === v)));
    const S = Object.assign({}, st.values);
    let files = [];
    const ui = VK.shell(root, { id: 'ac', kind: 'audio', multiple: true, label: 'Choose sound files', hint: 'MP3, WAV, M4A, FLAC, Ogg or a video — one or several, or drop them here. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, notes) => take(f, notes) });
    const list = el('ol', 'ak-list'); list.setAttribute('aria-live', 'polite');
    ui.stageCol.append(el('p', 'aiimg-h', 'Files'), list);
    const picker = AK.formatPicker('ac', S, sync);
    const chSel = select('ac-channels', CHANNELS, S.channels);
    const rateSel = select('ac-rate', RATES, S.rate);
    const rateField = field('Sample rate', rateSel, 'For WAV. M4A is saved at 44.1 or 48 kHz and Opus at 48 kHz, as those formats ask.');
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Convert', (signal, j) => convertAll(signal, j));
    const zipB = button('Download all as a ZIP', 'btn-ghost', () => zipAll()); zipB.hidden = true;
    const more = button('Add more files', 'btn-ghost', () => ui.pick());
    ui.side.append(...picker.fields, field('Channels', chSel), rateField, est, J.el, zipB, more);
    const done = [];

    function sync() {
      S.channels = chSel.value; S.rate = rateSel.value;
      st.save(S);
      rateField.hidden = S.format !== 'wav';
      J.go.textContent = files.length > 1 ? 'Convert ' + files.length + ' files' : 'Convert';
      const total = files.reduce((s, f) => s + (f.info ? f.info.duration : 0), 0);
      if (!files.length) { est.textContent = ''; return; }
      const ch = S.channels === 'keep' ? null : Number(S.channels);
      let bytes = 0;
      for (const f of files) {
        if (!f.info) continue;
        const c = ch || Math.min(2, f.info.channels);
        if (S.format === 'wav') bytes += f.info.duration * (S.rate === 'keep' ? f.info.rate : Number(S.rate)) * c * 2;
        else bytes += f.info.duration * Number(S.bitrate) * 125;
      }
      est.textContent = files.length + ' file' + (files.length === 1 ? '' : 's') + ', ' + VK.fmtT(total, 1) + ' of sound: about ' + fmtBytes(bytes) + ' as ' + S.format.toUpperCase() + '.';
    }
    chSel.addEventListener('change', sync);
    rateSel.addEventListener('change', sync);

    function row(f) {
      const li = el('li', 'ak-item');
      const name = el('strong', null, f.file.name);
      f.state = el('span', 'ak-state', 'Reading…');
      li.append(name, f.state);
      return li;
    }
    async function take(list_, notes) {
      if (J.busy) return;
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      for (const file of list_) {
        const f = { file, info: null };
        files.push(f);
        list.appendChild(row(f));
        try { f.info = await AK.decodeFile(file); f.state.textContent = AK.describe(f.info); }
        catch (e) { f.error = (e && e.message) || String(e); f.state.textContent = 'cannot be read: ' + f.error; f.state.className = 'ak-state is-error'; }
        sync();
      }
      const bad = files.filter((x) => x.error);
      if (bad.length) ui.say(bad.map((x) => x.file.name + ': ' + x.error).join(' '), 'error');
    }

    async function convertAll(signal, j) {
      const todo = files.filter((f) => f.info && !f.out);
      if (!todo.length) { j.status.textContent = 'Nothing new to convert: add files first.'; return; }
      let k = 0;
      for (const f of todo) {
        if (signal.aborted) throw VK.abortError();
        const label = (todo.length > 1 ? (k + 1) + ' of ' + todo.length + ': ' : '') + f.file.name;
        j.progress(k / todo.length, label);
        try {
          let planes = AK.planesOf(f.info.buffer, S.channels === 'keep' ? Math.min(2, f.info.channels) : Number(S.channels));
          let rate = f.info.rate;
          if (S.format === 'wav' && S.rate !== 'keep') { planes = resample(planes, rate, Number(S.rate)); rate = Number(S.rate); }
          const r = await AK.encode(planes, rate, S.format, { bitrate: S.bitrate, signal, onProgress: (x) => j.progress((k + x) / todo.length, label) });
          const name = AK.nameFor(f.info.name, '', r.blob);
          f.out = { blob: r.blob, name };
          done.push(f.out);
          f.state.textContent = '→ ' + name + ', ' + fmtBytes(r.blob.size);
          VK.result(ui.results, r.blob, name, VK.fmtT(f.info.duration, 2) + ' · ' + (r.channels === 1 ? 'mono' : 'stereo'), { note: r.note, download: todo.length === 1 });
        } catch (e) {
          if (e && e.name === 'AbortError') throw e;
          f.error = (e && e.message) || String(e);
          f.state.textContent = 'not converted: ' + f.error; f.state.className = 'ak-state is-error';
        }
        k++;
      }
      zipB.hidden = done.length < 2;
      const failed = todo.filter((f) => !f.out);
      j.status.textContent = 'Done: ' + (todo.length - failed.length) + ' of ' + todo.length + ' converted' + (failed.length ? '; not converted: ' + failed.map((f) => f.file.name + ' (' + f.error + ')').join('; ') : '') + '.';
      VK.lastAudio = { converted: todo.length - failed.length, failed: failed.length };
    }
    async function zipAll() {
      if (!done.length || typeof window.MVRZip !== 'function') return;
      const names = new Set();
      const items = done.map((d) => { let n = d.name, i = 2; while (names.has(n)) n = d.name.replace(/(\.[^.]+)$/, '-' + (i++) + '$1'); names.add(n); return { name: n, blob: d.blob }; });
      const zip = await window.MVRZip(items);
      A.download(zip, 'converted-audio.zip');
    }
    sync();
    return { state: S };
  }

  A.tools['audio-converter'] = { mount, resample };
})();
