/**
 * Extract Audio from Video (/video/extract-audio/).
 *
 * The sound of a video as its own file:
 *   Original  — the sound's own packets copied out untouched, when they can
 *               stand alone: AAC into an M4A, Opus into an Ogg (RFC 7845
 *               pages written here), an MP3 track as an MP3. No loss, and
 *               seconds for any length.
 *   WAV       — decoded to 16-bit PCM: big, but plays and edits everywhere.
 *   Opus      — re-encoded into an Ogg at 64, 96 or 128 kbit/s: small.
 *   M4A (AAC) — re-encoded where the browser has an AAC encoder.
 * There is no MP3 encoder: the usual one (LAME) is LGPL, which this site
 * does not ship. A part of the sound can be taken by typing a start and an
 * end.
 *
 * Remembered in localStorage '1234tools-video-extract-audio-v1': the format
 * and the Opus bitrate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, button, fmtBytes, clamp } = A;
  const KEY = '1234tools-video-extract-audio-v1';
  const RATES = [['64', '64 kbit/s (speech)'], ['96', '96 kbit/s'], ['128', '128 kbit/s (music)']];

  /** What can be offered for this file: [[value, label]] with 'original' first when the sound can be copied out. */
  function formats(info) {
    const out = [];
    const c = info.audio && info.audio.codec || '';
    if (/^mp4a\.40\./.test(c)) out.push(['original', 'Original sound, untouched (AAC in an .m4a)']);
    else if (c === 'opus') out.push(['original', 'Original sound, untouched (Opus in an .ogg)']);
    else if (c === 'mp3') out.push(['original', 'Original sound, untouched (.mp3)']);
    out.push(['wav', 'WAV — uncompressed, plays and edits everywhere']);
    out.push(['opus', 'Opus in .ogg — small, re-encoded']);
    out.push(['m4a', 'M4A (AAC) — re-encoded']);
    return out;
  }

  function mount(root) {
    const st = VK.store(KEY, { format: 'original', rate: '96' }, (k, v) => (k === 'format' ? ['original', 'wav', 'opus', 'm4a'].indexOf(v) >= 0 : RATES.some((r) => r[0] === v)));
    const S = Object.assign({}, st.values);
    let info = null, preview = null;
    const ui = VK.shell(root, { id: 'va', label: 'Choose a video', hint: 'MP4, MOV, MKV or WebM, or drop it here. Nothing is uploaded.', onFiles: (f, n) => load(f[0], n) });
    const stage = el('div', 'aiimg-stage vk-stage');
    const about = el('p', 'field-hint vk-about');
    ui.stageCol.append(stage, about);
    const fmtSel = select('va-format', [['wav', 'WAV']], 'wav');
    const rateSel = select('va-rate', RATES, S.rate);
    const rateField = field('Opus bitrate', rateSel);
    const fromIn = el('input', 'control'), toIn = el('input', 'control');
    for (const [i, id] of [[fromIn, 'va-from'], [toIn, 'va-to']]) { i.type = 'number'; i.id = id; i.min = '0'; i.step = '0.01'; i.inputMode = 'decimal'; }
    const times = el('div', 'sv-times'); times.append(field('From (seconds)', fromIn), field('To (seconds)', toIn));
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Extract the sound', (signal, j) => extract(signal, j));
    const capsP = el('p', 'field-hint');
    VK.capsLine().then((p) => capsP.replaceWith(p));
    ui.side.append(field('Save as', fmtSel), rateField, times, el('p', 'field-hint', 'Leave From and To as they are for the whole sound.'), est, J.el, capsP, button('Choose another video', 'btn-ghost', () => ui.pick()));

    const range = () => {
      const D = info ? info.duration : 0;
      let a = clamp(Number(fromIn.value) || 0, 0, D), b = clamp(toIn.value === '' ? D : Number(toIn.value), 0, D);
      if (b <= a) b = D;
      return [a, b];
    };
    function sync() {
      S.format = fmtSel.value; S.rate = rateSel.value; st.save(S);
      if (!info) return;
      rateField.hidden = S.format !== 'opus';
      const [a, b] = range();
      const whole = a <= 0.0005 && b >= info.duration - 0.0005;
      const sec = b - a;
      const ch = Math.min(2, info.audio.channels || 2);
      let size = '';
      if (S.format === 'wav') size = 'about ' + fmtBytes(sec * info.audio.sampleRate * ch * 2) + ' (' + (info.audio.sampleRate / 1000) + ' kHz, ' + (ch === 1 ? 'mono' : 'stereo') + ', 16-bit)';
      else if (S.format === 'opus') size = 'about ' + fmtBytes(sec * Number(S.rate) * 125);
      else if (S.format === 'm4a') size = 'about ' + fmtBytes(sec * 128 * 125);
      else size = 'about ' + fmtBytes((info.audioBytes || 0) * sec / info.duration) + ', exactly the original sound';
      est.textContent = (whole ? 'The whole sound, ' : 'From ' + VK.fmtT(a, 2) + ' to ' + VK.fmtT(b, 2) + ', ') + sec.toFixed(2) + ' s: ' + size + '.' +
        (S.format === 'original' && !whole ? ' A copied part starts and ends on whole packets, within about 0.03 s of the times typed.' : '');
    }
    for (const c of [fmtSel, rateSel]) c.addEventListener('change', sync);
    for (const c of [fromIn, toIn]) c.addEventListener('input', sync);

    async function load(file, notes) {
      if (J.busy) return;
      ui.say('Reading ' + file.name + '…');
      let next;
      try { next = await VK.probe(file, { element: false }); } catch (e) { ui.say(file.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (!next.audio) { VK.release(next); ui.say(file.name + ': this video has no sound track' + (next.movie ? '' : ' that this tool can read') + '.', 'error'); return; }
      if (!next.canDecodeAudio && !/^mp4a\.40\.|^opus$|^mp3$/.test(next.audio.codec || '')) { VK.release(next); ui.say(file.name + ': this browser cannot decode its sound (' + VK.codecName(next.audio.codec) + ').', 'error'); return; }
      VK.release(info);
      if (preview) { URL.revokeObjectURL(preview.src); preview.remove(); }
      info = next;
      preview = el('video', 'vk-preview'); preview.controls = true; preview.playsInline = true; preview.preload = 'metadata';
      preview.src = URL.createObjectURL(file);
      preview.setAttribute('aria-label', 'The video, ' + file.name);
      stage.appendChild(preview);
      about.textContent = file.name + ': ' + VK.describe(info) + '; the sound is ' + VK.codecName(info.audio.codec) + ', ' + (info.audio.sampleRate / 1000) + ' kHz, ' + (info.audio.channels === 1 ? 'mono' : info.audio.channels === 2 ? 'stereo' : info.audio.channels + ' channels') + ', ' + VK.fmtRate(info.audioBitrate) + '.';
      fmtSel.innerHTML = '';
      for (const [v, l] of formats(info)) { const o = el('option', null, l); o.value = v; fmtSel.appendChild(o); }
      fmtSel.value = [...fmtSel.options].some((o) => o.value === S.format) ? S.format : fmtSel.options[0].value;
      fromIn.value = '0'; toIn.value = info.duration.toFixed(2);
      fromIn.max = toIn.max = info.duration.toFixed(2);
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      sync();
    }

    async function extract(signal, j) {
      if (!info) return;
      const [a, b] = range();
      const whole = a <= 0.0005 && b >= info.duration - 0.0005;
      const ch = Math.min(2, info.audio.channels || 2);
      const c = info.audio.codec;
      let blob, how;
      if (S.format === 'original') {
        if (/^mp4a\.40\./.test(c)) {
          const r = await VK.remux(info, { box: 'm4a', video: false, from: a, to: whole ? undefined : b, signal, onProgress: (x) => j.progress(x, 'Copying the sound') });
          blob = r.blob;
        } else if (whole) blob = await VK.copyAudioTrack(info, signal, (x) => j.progress(x, 'Copying the sound'));
        else {
          /* a part of an Opus or MP3 track: the packets in the range, copied */
          const part = Object.assign({}, info, { audio: Object.assign({}, info.audio, { samples: info.audio.samples.filter((s) => s.pts + s.dur > a * 1e6 && s.pts < b * 1e6) }) });
          blob = await VK.copyAudioTrack(part, signal, (x) => j.progress(x, 'Copying the sound'));
        }
        how = 'The original ' + VK.codecName(c) + ' sound, copied without re-encoding.';
      } else if (S.format === 'wav') {
        const r = await VK.toWav(VK.audioBlocks(info, { from: a, to: b, channels: ch, signal }), info.audio.sampleRate, ch, signal, (t) => j.progress(t / (b - a), 'Decoding'));
        blob = r.blob; how = 'Decoded to 16-bit PCM WAV.';
      } else if (S.format === 'opus') {
        const r = await VK.toOggOpus(VK.audioBlocks(info, { from: a, to: b, rate: 48000, channels: ch, signal }), ch, Number(S.rate) * 1000, signal);
        blob = r.blob; how = 'Re-encoded as Opus at ' + S.rate + ' kbit/s.';
      } else {
        const cfg = await VK.audioConfig('m4a', ch, info.audio.sampleRate, 128000);
        if (!cfg) throw new Error('this browser has no AAC encoder. Choose WAV or Opus.');
        const mux = await VK.openBox('m4a', { audio: { codec: cfg.config.codec, channels: ch, rate: cfg.config.sampleRate } });
        await VK.encodeAudioBlocks(VK.audioBlocks(info, { from: a, to: b, rate: cfg.config.sampleRate, channels: ch, signal }), cfg, (chunk, meta) => mux.addAudio(chunk, meta), signal);
        blob = new Blob([mux.finish()], { type: 'audio/mp4' });
        how = 'Re-encoded as AAC at 128 kbit/s.';
      }
      const name = info.name + (whole ? '' : '-' + a.toFixed(1).replace('.', '_') + '-' + b.toFixed(1).replace('.', '_')) + '.' + VK.extOf(blob);
      VK.result(ui.results, blob, name, (b - a).toFixed(2) + ' s', { note: how });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(blob.size) + '. ' + how;
    }
    return { state: S };
  }

  A.tools['extract-audio'] = { mount, formats };
})();
