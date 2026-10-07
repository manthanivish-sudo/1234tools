/**
 * Voice Recorder (/audio/voice-recorder/).
 *
 * Records the microphone in the browser with MediaRecorder: a live level
 * meter, a clock, Pause and Resume, and a choice of microphone once the
 * browser has been allowed to list them. Echo cancellation, noise
 * suppression and automatic gain are the browser's own and can be switched
 * off (for music, or a good microphone in a quiet room). The recording is
 * kept in the page as the browser recorded it (usually Opus in WebM, or AAC
 * in MP4 on Safari) and can be saved as it is, or as WAV, M4A or Opus.
 * Nothing is sent anywhere; the browser shows its own recording indicator
 * while the microphone is on.
 *
 * Remembered in localStorage '1234tools-voice-recorder-v1': the three
 * processing switches and the save format. Not the microphone's name.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, select, check, button, fmtBytes } = A;
  const KEY = '1234tools-voice-recorder-v1';
  const MIMES = ['audio/webm;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];

  function mount(root) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const st = VK.store(KEY, { echo: true, noise: true, agc: true, format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (!/^(echo|noise|agc)$/.test(k) || typeof v === 'boolean'));
    const S = Object.assign({}, st.values);
    const wrap = el('div', 'aiimg vk ak-rec');
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    const studio = el('div', 'aiimg-studio sv-studio vk-studio');
    const stageCol = el('div', 'aiimg-stagecol'), side = el('div', 'aiimg-side');
    const clock = el('p', 'ak-big', '0:00.0'); clock.setAttribute('aria-live', 'off');
    const meter = el('div', 'ak-meter'); meter.setAttribute('role', 'meter'); meter.setAttribute('aria-label', 'Microphone level'); meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100');
    const bar = el('i'); meter.appendChild(bar);
    const status = el('p', 'aiimg-status sv-status', 'Press Record to start. The browser will ask to use your microphone.'); status.setAttribute('aria-live', 'polite');
    const recB = button('● Record', 'btn-primary', () => start());
    const pauseB = button('❚❚ Pause', 'btn-ghost', () => pause()); pauseB.hidden = true;
    const stopB = button('■ Stop', 'btn-ghost', () => stop()); stopB.hidden = true;
    const row = el('div', 'aiimg-row'); row.append(recB, pauseB, stopB);
    stageCol.append(clock, meter, row, status);
    const devSel = select('vr-device', [['', 'The default microphone']], '');
    const echoC = check('vr-echo', 'Echo cancellation', S.echo), noiseC = check('vr-noise', 'Noise suppression', S.noise), agcC = check('vr-agc', 'Automatic gain', S.agc);
    const picker = AK.formatPicker('vr', S, () => st.save(S));
    side.append(field('Microphone', devSel), echoC, noiseC, agcC, el('p', 'field-hint', 'Leave these on for speech. Turn them off for music, or a good microphone in a quiet room.'), el('p', 'aiimg-h', 'Save a copy as'), ...picker.fields);
    studio.append(stageCol, side);
    const results = el('div', 'aiimg-results');
    wrap.append(msg, studio, results);
    io.appendChild(wrap);
    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };
    for (const c of [echoC, noiseC, agcC]) c.input.addEventListener('change', () => { S.echo = echoC.input.checked; S.noise = noiseC.input.checked; S.agc = agcC.input.checked; st.save(S); });

    let stream = null, rec = null, chunks = [], ac = null, an = null, raf = 0, t0 = 0, spent = 0, take = 0;
    const mime = () => (typeof MediaRecorder === 'undefined' ? null : MIMES.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '');
    async function listDevices() {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const mics = all.filter((d) => d.kind === 'audioinput' && d.deviceId);
        const cur = devSel.value;
        devSel.innerHTML = '';
        const def = el('option', null, 'The default microphone'); def.value = ''; devSel.appendChild(def);
        mics.forEach((d, i) => { const o = el('option', null, d.label || 'Microphone ' + (i + 1)); o.value = d.deviceId; devSel.appendChild(o); });
        devSel.value = [...devSel.options].some((o) => o.value === cur) ? cur : '';
      } catch (e) { /* the list stays the default */ }
    }
    const fmt = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
    function tick() {
      const now = spent + (rec && rec.state === 'recording' ? (performance.now() - t0) / 1000 : 0);
      clock.textContent = fmt(now);
      if (an) {
        const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d);
        let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v));
        const db = 20 * Math.log10(pk || 1e-6);
        const pct = Math.max(0, Math.min(100, (db + 60) / 60 * 100));
        bar.style.width = pct + '%'; meter.setAttribute('aria-valuenow', String(Math.round(pct)));
      }
      raf = requestAnimationFrame(tick);
    }
    async function start() {
      const m = mime();
      if (m === null || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say('This browser cannot record sound in the page.', 'error'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: devSel.value ? { exact: devSel.value } : undefined, echoCancellation: S.echo, noiseSuppression: S.noise, autoGainControl: S.agc } });
      } catch (e) {
        say(e && e.name === 'NotAllowedError' ? 'The browser was not allowed to use the microphone. Allow it in the address bar and press Record again.' : 'No microphone could be opened: ' + ((e && e.message) || e), 'error');
        return;
      }
      say('');
      listDevices();
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); an = ac.createAnalyser(); an.fftSize = 2048; ac.createMediaStreamSource(stream).connect(an); } catch (e) { an = null; }
      chunks = []; spent = 0; take++;
      /* 64 kbit/s: clear speech at about 29 MB an hour where the browser honours it */
      rec = new MediaRecorder(stream, m ? { mimeType: m, audioBitsPerSecond: 64000 } : { audioBitsPerSecond: 64000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => finish();
      rec.start(1000);
      t0 = performance.now();
      recB.hidden = true; pauseB.hidden = false; stopB.hidden = false; pauseB.textContent = '❚❚ Pause';
      for (const c of [devSel, echoC.input, noiseC.input, agcC.input]) c.disabled = true;
      status.textContent = 'Recording. The microphone is on until you press Stop.';
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    }
    function pause() {
      if (!rec) return;
      if (rec.state === 'recording') { rec.pause(); spent += (performance.now() - t0) / 1000; pauseB.textContent = '▶ Resume'; status.textContent = 'Paused. The microphone is still on.'; }
      else if (rec.state === 'paused') { rec.resume(); t0 = performance.now(); pauseB.textContent = '❚❚ Pause'; status.textContent = 'Recording.'; }
    }
    function stop() {
      if (!rec) return;
      if (rec.state === 'recording') spent += (performance.now() - t0) / 1000;
      if (rec.state !== 'inactive') rec.stop();
    }
    async function finish() {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ac) { try { await ac.close(); } catch (e) { /* */ } }
      stream = null; ac = null; an = null; bar.style.width = '0%';
      recB.hidden = false; pauseB.hidden = true; stopB.hidden = true; recB.textContent = '● Record again';
      for (const c of [devSel, echoC.input, noiseC.input, agcC.input]) c.disabled = false;
      clock.textContent = fmt(spent);
      const type = (rec && rec.mimeType) || (chunks[0] && chunks[0].type) || 'audio/webm';
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      rec = null;
      if (!blob.size) { status.textContent = 'Nothing was recorded.'; return; }
      const base = 'recording-' + take;
      const original = base + '.' + (VK.extOf(blob) === 'bin' ? 'webm' : VK.extOf(blob) === 'weba' ? 'webm' : VK.extOf(blob));
      const row = VK.result(results, blob, original, fmt(spent) + ' · as recorded', { note: 'As the browser recorded it (' + type + ').', download: false });
      const saveB = button('Save as ' + S.format.toUpperCase(), 'btn-ghost', () => convert(blob, base, saveB));
      row.querySelector('.aiimg-result-head').appendChild(saveB);
      status.textContent = 'Recorded ' + fmt(spent) + '. The microphone is off. Download it as it is, or save a copy as WAV, M4A or Opus.';
      VK.lastRecording = { seconds: spent, type, size: blob.size };
    }
    async function convert(blob, base, btn) {
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const snd = await AK.decodeFile(new File([blob], base + '.' + VK.extOf(blob), { type: blob.type }));
        const r = await AK.encode(AK.planesOf(snd.buffer, Math.min(2, snd.channels)), snd.rate, S.format, { bitrate: S.bitrate });
        VK.result(results, r.blob, AK.nameFor(base, '', r.blob), VK.fmtT(snd.duration, 2), { note: r.note });
      } catch (e) { say(base + ': ' + ((e && e.message) || e), 'error'); }
      btn.disabled = false; btn.textContent = 'Save as ' + S.format.toUpperCase();
    }
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) listDevices();
    return { state: S };
  }

  A.tools['voice-recorder'] = { mount };
})();
