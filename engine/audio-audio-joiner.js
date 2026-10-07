/**
 * Audio Joiner (/audio/audio-joiner/).
 *
 * Two or more sound files in, one out: in the order listed (↑ ↓ to move,
 * × to drop), with nothing, a gap of silence or an equal-power crossfade
 * between them. Files at other sample rates are resampled to the highest
 * rate among them; mono files are spread to both channels when any file is
 * stereo. Saved as WAV, M4A or Opus.
 *
 * Remembered in localStorage '1234tools-audio-joiner-v1': what goes
 * between, format, bitrate.
 */
(function () {
  'use strict';
  const A = window.AIImg, VK = window.VideoKit, AK = window.AudioKit;
  if (!A || !VK || !AK) return;
  const { el, field, select, button, fmtBytes } = A;
  const KEY = '1234tools-audio-joiner-v1';
  const BETWEEN = [['none', 'Nothing: one straight after the other'], ['gap0.5', 'Half a second of silence'], ['gap1', 'One second of silence'], ['gap2', 'Two seconds of silence'], ['x1', 'A 1-second crossfade'], ['x2', 'A 2-second crossfade'], ['x3', 'A 3-second crossfade']];

  /**
   * Join decoded parts [{ planes, rate }] (already at one rate and channel
   * count) with a gap of `gap` seconds or a crossfade of `xf` seconds.
   * The crossfade is equal-power (cos/sin), shortened to half the shorter
   * neighbour when a part is too short for it.
   */
  function join(parts, rate, gap, xf) {
    const C = parts[0].planes.length;
    const G = Math.round((gap || 0) * rate);
    const lens = parts.map((p) => p.planes[0].length);
    const X = parts.map((p, i) => (i === 0 ? 0 : Math.min(Math.round((xf || 0) * rate), Math.floor(Math.min(lens[i - 1], lens[i]) / 2))));
    let total = 0;
    parts.forEach((p, i) => { total += lens[i] - X[i] + (i > 0 && !xf ? G : 0); });
    const out = []; for (let c = 0; c < C; c++) out.push(new Float32Array(total));
    let at = 0;
    parts.forEach((p, i) => {
      if (i > 0 && !xf) at += G;
      const start = at - X[i];
      for (let c = 0; c < C; c++) {
        const src = p.planes[c], dst = out[c];
        for (let k = 0; k < lens[i]; k++) {
          let g = 1;
          if (k < X[i]) g = Math.sin((k + 0.5) / X[i] * Math.PI / 2);
          const after = i + 1 < parts.length ? X[i + 1] : 0;
          if (after && k >= lens[i] - after) g *= Math.cos((k - (lens[i] - after) + 0.5) / after * Math.PI / 2);
          dst[start + k] += src[k] * g;
        }
      }
      at = start + lens[i];
    });
    return out;
  }

  function mount(root) {
    const st = VK.store(KEY, { between: 'none', format: 'wav', bitrate: '128' }, (k, v) => AK.okFormat(k, v) && (k !== 'between' || BETWEEN.some((b) => b[0] === v)));
    const S = Object.assign({}, st.values);
    const items = [];
    const ui = VK.shell(root, { id: 'aj', kind: 'audio', multiple: true, label: 'Choose the sound files to join', hint: 'Two or more: MP3, WAV, M4A, FLAC, Ogg or videos. Nothing is uploaded.', accept: 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.weba,.webm,.mp4,.mov', onFiles: (f, n) => add(f, n) });
    const list = el('ol', 'ak-list'); list.setAttribute('aria-live', 'polite');
    ui.stageCol.append(el('p', 'aiimg-h', 'In this order'), list);
    const betweenSel = select('aj-between', BETWEEN, S.between);
    const picker = AK.formatPicker('aj', S, sync);
    const est = el('p', 'sv-est vk-est'); est.setAttribute('aria-live', 'polite');
    const J = VK.job('Join the files', (signal, j) => run(signal, j));
    ui.side.append(field('Between files', betweenSel), ...picker.fields, est, J.el, button('Add more files', 'btn-ghost', () => ui.pick()));

    const ready = () => items.filter((x) => x.info);
    const plan = () => {
      const r = ready();
      const rate = r.reduce((m, x) => Math.max(m, x.info.rate), 0);
      const ch = r.some((x) => x.info.channels > 1) ? 2 : 1;
      const gap = /^gap/.test(S.between) ? Number(S.between.slice(3)) : 0;
      const xf = /^x/.test(S.between) ? Number(S.between.slice(1)) : 0;
      const secs = r.reduce((s, x) => s + x.info.duration, 0) + (r.length > 1 ? (r.length - 1) * (gap - xf) : 0);
      return { r, rate, ch, gap, xf, secs: Math.max(0, secs) };
    };
    function sync() {
      S.between = betweenSel.value; st.save(S);
      const p = plan();
      J.go.disabled = J.busy || p.r.length < 2;
      if (!items.length) { est.textContent = ''; return; }
      const bytes = S.format === 'wav' ? p.secs * p.rate * p.ch * 2 : p.secs * Number(S.bitrate) * 125;
      est.textContent = p.r.length < 2 ? 'Add at least two files to join.' : p.r.length + ' files, ' + VK.fmtT(p.secs, 2) + ' in all at ' + (p.rate / 1000) + ' kHz ' + (p.ch === 1 ? 'mono' : 'stereo') + ': about ' + fmtBytes(bytes) + ' as ' + S.format.toUpperCase() + '.' + (p.r.some((x) => x.info.rate !== p.rate) ? ' Files at a lower rate are resampled to ' + (p.rate / 1000) + ' kHz.' : '');
    }
    betweenSel.addEventListener('change', sync);

    function render() {
      list.innerHTML = '';
      items.forEach((it, i) => {
        const li = el('li', 'ak-item');
        const head = el('div', 'ak-row');
        const up = button('↑', 'btn-ghost sv-mini', () => move(i, -1)); up.setAttribute('aria-label', 'Move ' + it.file.name + ' up'); up.disabled = i === 0;
        const dn = button('↓', 'btn-ghost sv-mini', () => move(i, 1)); dn.setAttribute('aria-label', 'Move ' + it.file.name + ' down'); dn.disabled = i === items.length - 1;
        const rm = button('×', 'btn-ghost sv-mini', () => { items.splice(i, 1); render(); sync(); }); rm.setAttribute('aria-label', 'Remove ' + it.file.name);
        head.append(el('strong', null, (i + 1) + '. ' + it.file.name), up, dn, rm);
        li.append(head, el('span', 'ak-state' + (it.error ? ' is-error' : ''), it.error ? 'cannot be read: ' + it.error : it.info ? AK.describe(it.info) : 'Reading…'));
        list.appendChild(li);
      });
    }
    function move(i, d) { const j = i + d; if (j < 0 || j >= items.length || J.busy) return; const t = items[i]; items[i] = items[j]; items[j] = t; render(); sync(); }
    async function add(files, notes) {
      if (J.busy) return;
      ui.drop.hidden = true; ui.studio.hidden = false;
      ui.say(notes && notes.length ? notes.join(' ') : '', notes && notes.length ? 'warn' : '');
      for (const file of files) {
        const it = { file, info: null };
        items.push(it); render();
        try { it.info = await AK.decodeFile(file); } catch (e) { it.error = (e && e.message) || String(e); }
        render(); sync();
      }
      const bad = items.filter((x) => x.error);
      if (bad.length) ui.say(bad.map((x) => x.file.name + ': ' + x.error).join(' '), 'error');
    }

    async function run(signal, j) {
      const p = plan();
      if (p.r.length < 2) throw new Error('add at least two files that can be read.');
      j.progress(0.05, 'Matching the files');
      const parts = p.r.map((x) => ({ planes: AK.resample(AK.planesOf(x.info.buffer, p.ch), x.info.rate, p.rate) }));
      if (signal.aborted) throw VK.abortError();
      j.progress(0.3, 'Joining');
      const planes = join(parts, p.rate, p.gap, p.xf);
      const r = await AK.encode(planes, p.rate, S.format, { bitrate: S.bitrate, signal, onProgress: (x) => j.progress(0.35 + 0.65 * x, 'Saving') });
      const name = AK.nameFor(p.r[0].info.name, 'joined', r.blob);
      const secs = planes[0].length / p.rate;
      VK.result(ui.results, r.blob, name, VK.fmtT(secs, 2) + ' · ' + p.r.length + ' files', { note: 'Joined in the order listed' + (p.gap ? ' with ' + p.gap + ' s of silence between' : p.xf ? ' with ' + p.xf + ' s crossfades' : '') + '. ' + r.note });
      j.status.textContent = 'Done: ' + name + ', ' + fmtBytes(r.blob.size) + ', ' + secs.toFixed(3) + ' s.';
      VK.lastAudio = { seconds: secs, samples: planes[0].length, rate: p.rate, channels: p.ch };
    }
    sync();
    return { state: S };
  }

  A.tools['audio-joiner'] = { mount, join };
})();
