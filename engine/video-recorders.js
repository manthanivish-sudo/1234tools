/**
 * Screen Recorder (/video/screen-recorder/) and Webcam Recorder
 * (/video/webcam-recorder/): one engine, two tools.
 *
 * Screen: getDisplayMedia (a screen, a window or a tab, as the browser's own
 * picker offers), with the tab's or system's sound where the browser shares
 * it, and the microphone mixed in through Web Audio if asked. Webcam:
 * getUserMedia with a camera and resolution chosen, the microphone on or
 * off, and a mirrored preview (the recording is not mirrored). Both record
 * with MediaRecorder as the browser chooses (VP9 or VP8 with Opus in WebM
 * in Chrome, Edge and Firefox; H.264 with AAC in MP4 in Safari), show the
 * time and size as they go, pause and resume, and stop when the browser's
 * own "Stop sharing" is pressed. A finished WebM can be turned into an
 * H.264 MP4 with AAC sound on the device (VideoKit.transcode).
 *
 * Remembered in localStorage '1234tools-screen-recorder-v1' (sound, mic)
 * and '1234tools-webcam-recorder-v1' (resolution, mic, mirror). Not the
 * camera's or microphone's name.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit;
  if (!A || !VK) return;
  const { el, field, select, check, button, fmtBytes } = A;
  const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/webm', 'video/mp4'];
  const RES = [['1080', '1080p (1920 × 1080)'], ['720', '720p (1280 × 720)'], ['480', '480p (854 × 480)']];
  const fmt = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };

  function shellFor(root, title) {
    const io = root.querySelector('.tool-io');
    io.innerHTML = '';
    const wrap = el('div', 'aiimg vk vk-rec');
    const msg = el('div', 'io-msg'); msg.setAttribute('role', 'status');
    const studio = el('div', 'aiimg-studio sv-studio vk-studio');
    const stageCol = el('div', 'aiimg-stagecol'), side = el('div', 'aiimg-side');
    const live = el('video', 'vk-preview'); live.muted = true; live.playsInline = true; live.autoplay = true; live.setAttribute('aria-label', title);
    const stage = el('div', 'aiimg-stage vk-stage'); stage.appendChild(live);
    const clock = el('p', 'ak-big', '0:00.0');
    const status = el('p', 'aiimg-status sv-status'); status.setAttribute('aria-live', 'polite');
    const recB = button('● Start recording', 'btn-primary');
    const pauseB = button('❚❚ Pause', 'btn-ghost'); pauseB.hidden = true;
    const stopB = button('■ Stop', 'btn-ghost'); stopB.hidden = true;
    const row = el('div', 'aiimg-row'); row.append(recB, pauseB, stopB);
    stageCol.append(stage, clock, row, status);
    studio.append(stageCol, side);
    const results = el('div', 'aiimg-results');
    wrap.append(msg, studio, results);
    io.appendChild(wrap);
    const say = (t, kind) => { msg.textContent = t || ''; msg.className = 'io-msg' + (kind ? ' is-' + kind : ''); };
    return { side, live, clock, status, recB, pauseB, stopB, results, say };
  }

  /** The recording itself, shared: start(stream, tracksToStop) … stop(); calls back with the finished Blob. */
  function session(ui, name, onDone) {
    let rec = null, chunks = [], t0 = 0, spent = 0, raf = 0, bytes = 0, owned = [], take = 0;
    const mime = () => (typeof MediaRecorder === 'undefined' ? null : MIMES.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '');
    function tick() {
      const now = spent + (rec && rec.state === 'recording' ? (performance.now() - t0) / 1000 : 0);
      ui.clock.textContent = fmt(now) + (bytes ? ' · ' + fmtBytes(bytes) : '');
      raf = requestAnimationFrame(tick);
    }
    function start(stream, toStop) {
      const m = mime();
      if (m === null) { ui.say('This browser cannot record video in the page.', 'error'); return false; }
      owned = toStop || [];
      chunks = []; spent = 0; bytes = 0; take++;
      rec = new MediaRecorder(stream, m ? { mimeType: m } : undefined);
      rec.ondataavailable = (e) => { if (e.data && e.data.size) { chunks.push(e.data); bytes += e.data.size; } };
      rec.onstop = finish;
      rec.start(1000);
      t0 = performance.now();
      ui.live.srcObject = stream;
      ui.recB.hidden = true; ui.pauseB.hidden = false; ui.stopB.hidden = false; ui.pauseB.textContent = '❚❚ Pause';
      ui.status.textContent = 'Recording. Press Stop, or stop sharing, to finish.';
      for (const t of stream.getVideoTracks()) t.addEventListener('ended', () => stop());
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
      return true;
    }
    function pause() {
      if (!rec) return;
      if (rec.state === 'recording') { rec.pause(); spent += (performance.now() - t0) / 1000; ui.pauseB.textContent = '▶ Resume'; ui.status.textContent = 'Paused.'; }
      else if (rec.state === 'paused') { rec.resume(); t0 = performance.now(); ui.pauseB.textContent = '❚❚ Pause'; ui.status.textContent = 'Recording.'; }
    }
    function stop() {
      if (!rec || rec.state === 'inactive') return;
      if (rec.state === 'recording') spent += (performance.now() - t0) / 1000;
      rec.stop();
    }
    function finish() {
      cancelAnimationFrame(raf);
      for (const t of owned) { try { t.stop(); } catch (e) { /* */ } }
      ui.live.srcObject = null;
      ui.recB.hidden = false; ui.pauseB.hidden = true; ui.stopB.hidden = true; ui.recB.textContent = '● Record again';
      const type = (rec && rec.mimeType) || 'video/webm';
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      rec = null;
      ui.clock.textContent = fmt(spent) + ' · ' + fmtBytes(blob.size);
      if (!blob.size) { ui.status.textContent = 'Nothing was recorded.'; return; }
      ui.status.textContent = 'Recorded ' + fmt(spent) + '. Sharing and the microphone are off.';
      onDone(blob, name + '-' + take, spent, type);
    }
    ui.pauseB.addEventListener('click', pause);
    ui.stopB.addEventListener('click', stop);
    return { start, stop, busy: () => !!rec };
  }

  /** The result row, with Make an MP4 when the recording is a WebM. The size shown is read from the recording itself. */
  async function deliver(ui, blob, base, secs, type) {
    const ext = VK.extOf(blob) === 'webm' ? 'webm' : VK.extOf(blob);
    let dims = '';
    try {
      const m = await window.VideoDemux.open(window.VideoDemux.bufferReader(new Uint8Array(await blob.arrayBuffer())));
      const v = m.tracks.find((t) => t.kind === 'video');
      if (v && v.width) dims = v.width + ' × ' + v.height;
    } catch (e) { dims = ''; }
    const row = VK.result(ui.results, blob, base + '.' + ext, fmt(secs) + (dims ? ' · ' + dims : '') + ' · as recorded', { note: 'As the browser recorded it (' + type + (dims ? ', ' + dims : '') + ').', download: false });
    VK.lastRecording = { seconds: secs, type, size: blob.size, dims };
    if (ext !== 'webm') return;
    const mp4B = button('Make an MP4', 'btn-ghost', async () => {
      mp4B.disabled = true; mp4B.textContent = 'Making the MP4…';
      try {
        const info = await VK.probe(new File([blob], base + '.webm', { type: 'video/webm' }));
        const out = await VK.transcode(info, { box: 'mp4', audio: 'encode', bitrate: Math.max(info.width * info.height * (info.fps || 30) * 0.08, 600000), onProgress: (x) => { mp4B.textContent = 'Making the MP4: ' + Math.round(x * 100) + '%'; } });
        if (!out) throw new Error('this browser cannot encode H.264 on the device.');
        VK.result(ui.results, out.blob, base + '.' + VK.extOf(out.blob), info.width + ' × ' + info.height, { note: 'Re-encoded as ' + VK.codecName(out.videoCodec) + (out.audioCodec ? ' with ' + VK.codecName(out.audioCodec) + ' sound' : '') + '.' });
        VK.lastRecordingMp4 = { size: out.blob.size, width: out.width, height: out.height, audio: out.audioCodec };
      } catch (e) { ui.say(base + ': ' + ((e && e.message) || e), 'error'); }
      mp4B.disabled = false; mp4B.textContent = 'Make an MP4';
    });
    row.querySelector('.aiimg-result-head').appendChild(mp4B);
  }

  /* ------------------------------------------------------------------ */
  function mountScreen(root) {
    const st = VK.store('1234tools-screen-recorder-v1', { sound: true, mic: false }, (k, v) => typeof v === 'boolean');
    const S = Object.assign({}, st.values);
    const ui = shellFor(root, 'What is being recorded');
    const soundC = check('sr-sound', 'Record the sound of the tab or screen (where the browser offers it)', S.sound);
    const micC = check('sr-mic', 'Mix in my microphone', S.mic);
    ui.side.append(soundC, micC, el('p', 'field-hint', 'The browser asks what to share: the whole screen, a window or a tab. Chrome and Edge can share a tab’s sound, and on Windows the whole system’s; other browsers record the picture only.'));
    ui.status.textContent = 'Press Start recording and choose what to share.';
    for (const c of [soundC, micC]) c.input.addEventListener('change', () => { S.sound = soundC.input.checked; S.mic = micC.input.checked; st.save(S); });
    const sess = session(ui, 'screen-recording', (b, n, s, t) => deliver(ui, b, n, s, t));
    let ac = null;
    ui.recB.addEventListener('click', async () => {
      if (sess.busy()) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { ui.say('This browser cannot record the screen from a page. Chrome, Edge, Firefox and Safari on a computer can; phones cannot.', 'error'); return; }
      let disp, mic = null;
      try { disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: S.sound }); }
      catch (e) { ui.say(e && e.name === 'NotAllowedError' ? 'Sharing was cancelled or not allowed.' : 'The screen could not be shared: ' + ((e && e.message) || e), 'error'); return; }
      if (S.mic) { try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { ui.say('The microphone could not be opened, so only the screen' + (S.sound ? ' and its sound' : '') + ' will be recorded.', 'warn'); } }
      ui.say('');
      const tracks = disp.getTracks().concat(mic ? mic.getTracks() : []);
      let stream = new MediaStream(disp.getVideoTracks());
      const sources = [disp, mic].filter((s) => s && s.getAudioTracks().length);
      if (sources.length === 1) sources[0].getAudioTracks().forEach((t) => stream.addTrack(t));
      else if (sources.length > 1) {
        /* two sounds into one track: a recorder takes one */
        ac = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ac.createMediaStreamDestination();
        for (const s of sources) ac.createMediaStreamSource(s).connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      sess.start(stream, tracks.concat(ac ? [{ stop: () => { try { ac.close(); } catch (e) { /* */ } ac = null; } }] : []));
      VK.lastShare = { video: disp.getVideoTracks().length, audio: stream.getAudioTracks().length, mixed: sources.length > 1 };
    });
    return { state: S };
  }

  function mountWebcam(root) {
    const st = VK.store('1234tools-webcam-recorder-v1', { res: '720', mic: true, mirror: true }, (k, v) => (k === 'res' ? RES.some((r) => r[0] === v) : typeof v === 'boolean'));
    const S = Object.assign({}, st.values);
    const ui = shellFor(root, 'The camera');
    const camSel = select('wc-camera', [['', 'The default camera']], '');
    const resSel = select('wc-res', RES, S.res);
    const micC = check('wc-mic', 'Record the microphone too', S.mic);
    const mirC = check('wc-mirror', 'Mirror the preview (the recording is not mirrored)', S.mirror);
    const previewB = button('Show the camera', 'btn-ghost', () => openCam());
    ui.side.append(field('Camera', camSel), field('Resolution', resSel), micC, mirC, previewB);
    ui.status.textContent = 'Press Show the camera or Start recording. The browser will ask to use the camera.';
    let stream = null;
    const syncMirror = () => { ui.live.style.transform = S.mirror ? 'scaleX(-1)' : ''; };
    for (const c of [micC, mirC]) c.input.addEventListener('change', () => { S.mic = micC.input.checked; S.mirror = mirC.input.checked; st.save(S); syncMirror(); });
    resSel.addEventListener('change', () => { S.res = resSel.value; st.save(S); if (stream && !sess.busy()) openCam(); });
    camSel.addEventListener('change', () => { if (stream && !sess.busy()) openCam(); });
    syncMirror();
    async function listCams() {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === 'videoinput' && d.deviceId);
        const cur = camSel.value; camSel.innerHTML = '';
        const def = el('option', null, 'The default camera'); def.value = ''; camSel.appendChild(def);
        cams.forEach((d, i) => { const o = el('option', null, d.label || 'Camera ' + (i + 1)); o.value = d.deviceId; camSel.appendChild(o); });
        camSel.value = [...camSel.options].some((o) => o.value === cur) ? cur : '';
      } catch (e) { /* default only */ }
    }
    async function openCam() {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { ui.say('This browser cannot use a camera from a page.', 'error'); return null; }
      const h = Number(S.res), w = Math.round(h * 16 / 9);
      try { stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: camSel.value ? { exact: camSel.value } : undefined, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } }, audio: S.mic ? { echoCancellation: true, noiseSuppression: true } : false }); }
      catch (e) { ui.say(e && e.name === 'NotAllowedError' ? 'The browser was not allowed to use the camera. Allow it in the address bar and try again.' : 'No camera could be opened: ' + ((e && e.message) || e), 'error'); return null; }
      ui.say('');
      ui.live.srcObject = stream;
      /* the size the frames really arrive at (a camera can ignore what was asked, and its settings can say otherwise) */
      await new Promise((res) => { if (ui.live.videoWidth) res(); else { ui.live.addEventListener('loadedmetadata', res, { once: true }); setTimeout(res, 3000); } });
      const gotW = ui.live.videoWidth, gotH = ui.live.videoHeight;
      ui.status.textContent = 'The camera is on (' + (gotW || '?') + ' × ' + (gotH || '?') + (gotH && gotH !== Number(S.res) ? '; it does not offer ' + S.res + 'p' : '') + '). Press Start recording when you are ready.';
      listCams();
      return stream;
    }
    const sess = session(ui, 'webcam-recording', (b, n, s, t) => { stream = null; deliver(ui, b, n, s, t); });
    ui.recB.addEventListener('click', async () => {
      if (sess.busy()) return;
      if (!stream && !(await openCam())) return;
      VK.lastCamera = { width: ui.live.videoWidth, height: ui.live.videoHeight, audio: stream.getAudioTracks().length };
      sess.start(stream, stream.getTracks());
    });
    return { state: S };
  }

  A.tools['screen-recorder'] = { mount: mountScreen };
  A.tools['webcam-recorder'] = { mount: mountWebcam };
})();
