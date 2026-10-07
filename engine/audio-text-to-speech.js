/**
 * Text to Speech (/audio/text-to-speech/).
 *
 * Text in, a voice reading it out: Kokoro-82M (Apache-2.0) through the
 * Reel Maker's engine (engine/aivid-tts.js and its worker), 28 English
 * voices, American and British, speed 0.8× to 1.2× (the model's own
 * range). The model (92 MB) and the runtime (14 MB) are fetched from this
 * site the first time and kept by the browser; the text never leaves the
 * page. Saved as WAV, M4A or Opus, each marked in its metadata as
 * AI-generated speech (WAV: LIST/INFO ICMT; M4A: ©cmt; Opus: a COMMENT tag)
 * — the machine-readable label EU AI Act Article 50(2) asks of generated
 * audio — and labelled on the page.
 *
 * Remembered in localStorage '1234tools-text-to-speech-v1': voice, speed,
 * format, bitrate. Not the text.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, range, button, fmtBytes } = A;
  const KEY = '1234tools-text-to-speech-v1';
  const MAX_CHARS = 5000;
  const TTS = () => window.AIVidTTS;
  const LABEL = 'AI-generated speech: synthetic voice (Kokoro-82M text-to-speech) made on 1234tools.com';

  function mount(root) {
    const voices = TTS() ? TTS().voices : [];
    const st = VK.store(KEY, { voice: 'af_heart', speed: 1, format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (k !== 'voice' || voices.some((x) => x.id === v)) && (k !== 'speed' || (v >= 0.8 && v <= 1.2)));
    const S = Object.assign({}, st.values);
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const wrap = el('div', 'aiimg vk ak-tts');
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    const studio = el('div', 'aiimg-studio sv-studio vk-studio');
    const stageCol = el('div', 'aiimg-stagecol'), side = el('div', 'aiimg-side');
    const text = el('textarea', 'control ak-text'); text.id = 'tts-text'; text.maxLength = MAX_CHARS; text.rows = 8;
    text.placeholder = 'Type or paste what should be read out.';
    const count = el('p', 'field-hint'); count.setAttribute('aria-live', 'polite');
    stageCol.append(field('Text', text), count);
    const vSel = el('select', 'control'); vSel.id = 'tts-voice';
    for (const [acc, label] of Object.entries((TTS() && TTS().ACCENTS) || {})) {
      const g = el('optgroup'); g.label = label;
      for (const v of voices.filter((x) => x.accent === acc)) { const o = el('option', null, v.name + ' (' + v.gender + ')'); o.value = v.id; g.appendChild(o); }
      vSel.appendChild(g);
    }
    vSel.value = S.voice;
    const speedR = range('tts-speed', 0.8, 1.2, 0.05, S.speed, (v) => v.toFixed(2) + '×');
    const picker = AK.formatPicker('tts', S, () => st.save(S));
    const first = el('p', 'field-hint', 'The voice model (' + fmtBytes((TTS() && TTS().BYTES.model) || 92e6) + ') and its runtime (' + fmtBytes((TTS() && TTS().BYTES.runtime) || 14e6) + ') are downloaded from this site the first time and kept by your browser. English only.');
    const J = VK.job('Make the speech', (signal, j) => run(signal, j));
    side.append(field('Voice', vSel), field('Speed', speedR), ...picker.fields, first, J.el);
    studio.append(stageCol, side);
    const results = el('div', 'aiimg-results');
    wrap.append(msg, studio, results);
    io.appendChild(wrap);
    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };
    if (!TTS()) say('The voice engine did not load. Reload the page.', 'error');

    function sync() {
      S.voice = vSel.value; S.speed = Number(speedR.input.value); st.save(S);
      const n = text.value.length;
      count.textContent = n.toLocaleString('en-GB') + ' of ' + MAX_CHARS.toLocaleString('en-GB') + ' characters' + (n ? ', about ' + Math.max(1, Math.round(text.value.trim().split(/\s+/).length / 2.6 / S.speed)) + ' s of speech' : '') + '.';
      J.go.disabled = J.busy || !text.value.trim() || !TTS();
    }
    text.addEventListener('input', sync); vSel.addEventListener('change', sync); speedR.input.addEventListener('input', sync);

    async function run(signal, j) {
      const words = text.value.trim();
      if (!words) return;
      const t0 = performance.now();
      const r = await TTS().speak(words, {
        voice: S.voice, speed: S.speed, signal,
        onProgress: (p) => {
          if (p.stage === 'download' && p.total) j.progress(0.6 * p.loaded / p.total, 'Downloading the voice (' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) + ')');
          else if (p.stage === 'compile') j.progress(0.6, 'Starting the voice');
          else if (p.stage === 'speak' && p.of) j.progress(0.6 + 0.35 * p.done / p.of, 'Speaking sentence ' + Math.min(p.of, p.done + 1) + ' of ' + p.of);
        }
      });
      j.progress(0.96, 'Saving');
      const out = await AK.encode([r.samples], r.sampleRate, S.format, { bitrate: S.bitrate, signal, comment: LABEL });
      const voice = voices.find((v) => v.id === S.voice);
      const name = AK.nameFor('speech-' + (voice ? voice.name.toLowerCase() : 'voice'), '', out.blob);
      VK.result(results, out.blob, name, VK.fmtT(r.duration, 2) + ' · ' + (voice ? voice.label : S.voice), { note: 'AI-generated speech. The file is marked as AI-generated in its metadata. ' + out.note });
      j.status.textContent = 'Done: ' + name + ', ' + r.duration.toFixed(2) + ' s of speech in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s.';
      VK.lastSpeech = { seconds: r.duration, rate: r.sampleRate, sentences: r.sentences.length, size: out.blob.size };
    }
    sync();
    return { state: S };
  }

  A.tools['text-to-speech'] = { mount, LABEL };
})();
