/**
 * Audio to Text (/audio/audio-to-text/).
 *
 * A recording (or a video's sound) in, a transcript out: plain text with
 * or without times, and SRT or VTT subtitles. Speech recognition is Whisper
 * tiny running on the device (engine/aivid-whisper.js, the model in
 * engine/models/whisper-tiny/, 41 MB, MIT), the same engine as Auto
 * Captions, whose cue and subtitle writers this page reuses
 * (engine/aivid-auto-captions.js, loaded but not mounted). The model is
 * fetched from this site the first time and kept by the browser.
 *
 * Remembered in localStorage '1234tools-audio-to-text-v1': the language and
 * whether times are shown.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, check, button, fmtBytes } = A;
  const KEY = '1234tools-audio-to-text-v1';
  const MAX_SECONDS = 3600;
  const CAP = () => A.tools['auto-captions'];
  const W = () => window.AIVidWhisper;
  const stamp = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, r = Math.floor(s % 60); return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (r < 10 ? '0' : '') + r; };

  /** Plain text: one line per segment, with [m:ss] in front when `times`. */
  function plainText(segments, times) {
    return segments.map((s) => (times ? '[' + stamp(s.start) + '] ' : '') + s.text.trim()).join('\n') + '\n';
  }

  function mount(root) {
    const langs = (CAP() && CAP().LANGS) || [['auto', 'Auto-detect'], ['en', 'English']];
    const st = VK.store(KEY, { lang: 'auto', times: true }, (k, v) => (k === 'lang' ? langs.some((l) => l[0] === v) : typeof v === 'boolean'));
    const S = Object.assign({}, st.values);
    let file = null, decoded = null, result = null;
    const ui = VK.shell(root, { id: 'tt', kind: 'audio', label: 'Choose a recording', hint: 'MP3, WAV, M4A, Ogg, or a video — up to an hour. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => load(f[0], n) });
    const about = el('p', 'field-hint vk-about');
    const player = el('audio', 'ak-player'); player.controls = true; player.preload = 'metadata'; player.hidden = true;
    const out = el('div', 'ak-transcript'); out.setAttribute('aria-live', 'polite'); out.setAttribute('tabindex', '0'); out.setAttribute('aria-label', 'The transcript'); out.hidden = true;
    const actions = el('div', 'aiimg-row'); actions.hidden = true;
    ui.stageCol.append(player, about, out, actions);
    const langSel = select('tt-lang', langs, S.lang);
    const timesC = check('tt-times', 'Show the time of each line', S.times);
    const note = el('p', 'field-hint', 'Whisper tiny (41 MB) is downloaded from this site the first time and kept by your browser. It is most accurate in English; check other languages carefully.');
    const J = VK.job('Transcribe', (signal, j) => run(signal, j));
    ui.side.append(field('Language', langSel), timesC, note, J.el, button('Choose another file', 'btn-ghost', () => ui.pick()));
    function sync() { S.lang = langSel.value; S.times = timesC.input.checked; st.save(S); if (result) render(); }
    langSel.addEventListener('change', sync); timesC.input.addEventListener('change', sync);

    function render() {
      out.textContent = plainText(result.segments, S.times).trim() || '(No speech was heard.)';
      out.hidden = false;
    }
    async function load(f, notes) {
      if (J.busy) return;
      ui.say('Reading ' + f.name + '…');
      if (!W()) { ui.say('The speech engine did not load. Reload the page.', 'error'); return; }
      let d;
      try { d = await W().decodeAudio(f); } catch (e) { ui.say(f.name + ': ' + ((e && e.message) || e), 'error'); return; }
      if (d.duration > MAX_SECONDS) { ui.say(f.name + ': it lasts ' + VK.fmtT(d.duration, 0) + '; this tool takes up to an hour.', 'error'); return; }
      file = f; decoded = d; result = null;
      if (player.src) URL.revokeObjectURL(player.src);
      player.src = URL.createObjectURL(f); player.hidden = false; player.setAttribute('aria-label', 'The recording, ' + f.name);
      about.textContent = f.name + ': ' + VK.fmtT(d.duration, 1) + ', ' + fmtBytes(f.size) + '.';
      out.hidden = true; actions.hidden = true; actions.innerHTML = '';
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
    }
    async function run(signal, j) {
      if (!decoded) return;
      const t0 = performance.now();
      const res = await W().transcribe(decoded.samples, {
        language: S.lang, signal,
        onLoad: (p) => { if (p && p.total) j.progress(0.15 * (p.loaded / p.total), 'Downloading the speech model (' + fmtBytes(p.loaded) + ' of ' + fmtBytes(p.total) + ')'); },
        onProgress: (p) => j.progress(0.15 + 0.85 * (p.fraction || 0), p.stage === 'detect' ? 'Listening for the language' : 'Transcribing ' + VK.fmtT(p.seconds || 0, 0) + ' of ' + VK.fmtT(p.total || 0, 0))
      });
      result = res;
      render();
      const base = VK.baseName(file.name);
      const cues = CAP() ? CAP().fileCues(res.segments) : [];
      const files = [['TXT', new Blob([plainText(res.segments, S.times)], { type: 'text/plain' }), base + '.txt']];
      if (CAP()) files.push(['SRT', new Blob([CAP().toSRT(cues)], { type: 'application/x-subrip' }), base + '.srt'], ['VTT', new Blob([CAP().toVTT(cues)], { type: 'text/vtt' }), base + '.vtt']);
      actions.innerHTML = '';
      const copyB = button('Copy the text', 'btn-ghost', async () => { try { await navigator.clipboard.writeText(plainText(res.segments, S.times)); copyB.textContent = 'Copied'; setTimeout(() => { copyB.textContent = 'Copy the text'; }, 1500); } catch (e) { copyB.textContent = 'Select the text to copy it'; } });
      actions.appendChild(copyB);
      for (const [label, blob, name] of files) actions.appendChild(button('Download ' + label, 'btn-ghost', () => A.download(blob, name)));
      actions.hidden = false;
      const words = res.segments.reduce((n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
      const langName = (langs.find((l) => l[0] === res.language) || [res.language, res.language])[1];
      j.status.textContent = 'Done: ' + words + ' words in ' + res.segments.length + ' lines from ' + VK.fmtT(res.seconds, 1) + ' of sound, in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s' + (res.detection ? '; language detected: ' + langName : '') + '.';
      VK.lastTranscript = { text: plainText(res.segments, false), segments: res.segments.length, language: res.language };
    }
    return { state: S };
  }

  A.tools['audio-to-text'] = { mount, plainText };
})();
